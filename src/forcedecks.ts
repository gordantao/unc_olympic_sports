import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";
import { ForcedecksTest, ValdTestResults } from "./types";

const ENDPOINT: string =
  "https://prd-use-api-extforcedecks.valdperformance.com";
const TEAM_ID: string = "5b4690e7-25c4-4b79-927f-aec642e3c53e";
const START_DATE: Date = new Date("1900-01-01T00:00:00.000Z");
const EXPORT_DATA: boolean = true;
let AUTH_TOKEN: string = "";

// -------------- Throttling Utilities --------------
function createRateLimiter(maxCalls: number, perMs: number) {
  let queue: (() => void)[] = [];
  let activeCalls = 0;

  setInterval(() => {
    activeCalls = 0;
    for (let i = 0; i < maxCalls && queue.length > 0; i++) {
      const fn = queue.shift();
      if (fn) {
        activeCalls++;
        fn();
      }
    }
  }, perMs);

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve) => {
      queue.push(() => {
        fn().then(resolve);
      });
    });
  };
}

const limitedFetch = createRateLimiter(25, 200); // 25 requests per 5 seconds

// -------------- API Calls --------------
async function get_batch(date: Date): Promise<Response> {
  if (!AUTH_TOKEN) AUTH_TOKEN = await authenticate();

  const url =
    `${ENDPOINT}/tests?TenantId=${TEAM_ID}&ModifiedFromUtc=${date.toISOString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: AUTH_TOKEN,
    },
  });

  if (response.status === 401) {
    console.warn("Auth expired, refreshing token...");
    AUTH_TOKEN = await authenticate();
    return await get_batch(date); // retry with new token
  }

  return response;
}

async function get_trials(testId: string): Promise<any[]> {
  const url = `${ENDPOINT}/v2019q3/teams/${TEAM_ID}/tests/${testId}/trials`;

  const response = await limitedFetch(() =>
    fetch(url, {
      method: "GET",
      headers: {
        Authorization: AUTH_TOKEN,
      },
    })
  );

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    console.error("Non-JSON trial response for", testId, ":", text);
    throw new Error("Trial response was not JSON");
  }

  const trials: any[] = JSON.parse(text);
  const destacked_trials: any[] = [];

  for (const trial of trials) {
    destack_results(trial, testId).forEach((element) =>
      destacked_trials.push(element)
    );
  }

  return destacked_trials;
}

// -------------- Main Data Fetch Logic --------------
async function get_all() {
  let response: Response = await get_batch(START_DATE);
  let testIds: ForcedecksTest[] = [];
  let tests: any[] = [];
  let lastDate: Date = START_DATE;

  while (response.status === 200) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!contentType.includes("application/json")) {
      console.error("Unexpected response content-type:", contentType);
      console.error("Response body:", text);
      throw new Error("Response was not JSON");
    }

    let data: ValdTestResults<ForcedecksTest>;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      throw e;
    }

    for (const element of data.tests) {
      testIds.push(element);
    }

    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    console.log("Next fetch from:", lastDate.toISOString());

    response = await get_batch(lastDate);
  }

  if (response.status === 204) {
    let i = 0;
    for (const testId of testIds) {
      console.log(
        `Fetching trial ${i}/${testIds.length} for: ${testId.testId}`,
      );
      const trialResults = await get_trials(testId.testId);
      trialResults.forEach((trial) => {
        trial.testType = testId.testType;
        trial.weight = testId.weight;
        trial.notes = testId.notes;
      });
      tests = tests.concat(trialResults);
      i++;
    }
    return tests;
  } else {
    console.error("Unexpected final response:", response.status);
    throw new Error(`Status code: ${response.status}`);
  }
}

// -------------- Trial Result Processing --------------
function destack_results(data: any, testId: string) {
  const results: any[] = [];
  const {
    id: trialId,
    athleteId,
    recordedUTC: recordedDate,
    startTime,
    endTime,
    lastModifiedUTC: lastModified,
  } = data;

  for (const result of data.results) {
    result.testId = testId;
    result.trialId = trialId;
    result.athleteId = athleteId;
    result.recordedDate = recordedDate;
    result.startTime = startTime;
    result.endTime = endTime;
    result.lastModified = lastModified;
    delete result.definition;
    results.push(result);
  }

  return results;
}

// -------------- Entrypoint --------------
if (EXPORT_DATA) {
  get_all()
    .then((tests) => {
      console.log(`✅ Loaded ${tests.length} rows of data`);
      saveJsonToCsv(tests, "forcedecks.csv");
    })
    .catch((error) => {
      console.error("❌ Failed to load data:", error);
    });
} else {
  get_all()
    .then((tests) => {
      console.log(tests);
      console.log(`✅ Loaded ${tests.length} rows of data`);
    })
    .catch((error) => {
      console.error("❌ Failed to load data:", error);
    });
}
