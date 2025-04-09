import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

const ENDPOINT: string =
  "https://prd-use-api-extforcedecks.valdperformance.com";
const TEAM_ID: string = "5b4690e7-25c4-4b79-927f-aec642e3c53e";
const TEST_ID: string = "a151f04d-127a-48ed-8c85-f2e5e7705e6f";

async function get_trials(testId: string): Promise<Array<any>> {
  const response = await fetch(
    ENDPOINT + `/v2019q3/teams/${TEAM_ID}/tests/${testId}/trials`,
    {
      method: "GET",
      headers: {
        Authorization: await authenticate(),
      },
    },
  );
  let trials: Array<any> = await response.json();
  let destacked_trials: Array<any> = [];
  for (let i = 0; i < trials.length; i++) {
    destack_results(trials[i], testId).forEach((element) =>
      destacked_trials.push(element)
    );
  }
  return destacked_trials;
}

function destack_results(data: any, testId: string) {
  let results: Array<any> = [];
  let trialId = data.id;
  let athleteId = data.athleteId;
  let recordedDate = data.recordedUTC;
  let startTime = data.startTime;
  let endTime = data.endTime;
  let lastModified = data.lastModifiedUTC;

  let result;
  for (let i = 0; i < data.results.length; i++) {
    result = data.results[i];
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

get_trials(TEST_ID).then((data) => {
  console.log(data);
});
