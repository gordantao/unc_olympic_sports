import { authenticate } from "./authenticate";
import { ForcedecksTest, ValdTestResults } from "./types";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const ENDPOINT: string =
  "https://prd-use-api-extforcedecks.valdperformance.com";
const TEAM_ID: string = "5b4690e7-25c4-4b79-927f-aec642e3c53e";
const START_DATE: Date = new Date("2023-12-04T20:23:45.615Z");
let AUTH_TOKEN: string = "";

// ⬇️ Your Supabase credentials here
const SUPABASE_URL: string = process.env.SUPABASE_PROJECT_URL!;
const SUPABASE_ANON_KEY: string = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    return await get_batch(date);
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
    destack_results(trial, testId).forEach((element) => {
      destacked_trials.push(element);
    });
  }

  return destacked_trials;
}

// -------------- Main Data Fetch Logic --------------
async function get_all() {
  let response: Response = await get_batch(START_DATE);
  let testIds: ForcedecksTest[] = [];
  let batchCounter = 0;
  let lastDate: Date = START_DATE;

  while (response.status === 200 || response.status === 204) {
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

    testIds.push(...data.tests);

    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    console.log("Next fetch from:", lastDate.toISOString());

    response = await get_batch(lastDate);
    batchCounter++;

    // Process every 10 batches or at the end (204)
    if (batchCounter === 1 || response.status === 204) {
      let tests: any[] = [];

      for (const testId of testIds) {
        console.log(`Fetching trials for: ${testId.testId}`);
        const trialResults = await get_trials(testId.testId);
        tests = tests.concat(trialResults);
      }

      console.log(`📤 Inserting ${tests.length} rows into Supabase...`);
      await saveToSupabase(tests);

      // Clear memory
      tests = [];
      testIds = [];
      batchCounter = 0;
    }

    if (response.status === 204) break;
  }

  console.log("✅ All batches processed.");
}

// -------------- Trial Result Processing --------------
function destack_results(data: any, testId: string) {
  const results: any[] = [];
  const {
    startTime,
    endTime,
  } = data;

  for (const result of data.results) {
    result.testId = testId;
    result.startTime = startTime;
    result.endTime = endTime;
    delete result.definition;
    delete result.repeat;
    delete result.time;
    results.push(result);
  }

  return results;
}

// -------------- Supabase Insert Helper --------------
async function saveToSupabase(data: any[], chunkSize: number = 500) {
  if (data.length === 0) return;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("forcedecks_v2") // Replace with your actual table
      .insert(chunk);

    if (error) {
      console.error("❌ Supabase insert failed:", error);
      throw error;
    } else {
      console.log(
        `✅ Inserted chunk ${i / chunkSize + 1} (${chunk.length} rows)`,
      );
    }
  }
}

// -------------- Entrypoint --------------
get_all()
  .then(() => {
    console.log("🎉 Complete");
  })
  .catch((error) => {
    console.error("❌ Failed to load data:", error);
  });
