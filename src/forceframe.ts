import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";
import { ForceframeTest, ValdTestResults } from "./types";

const ENDPOINT: string = 'https://prd-use-api-externalforceframe.valdperformance.com';
const TEAM_ID: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const START_DATE: Date = new Date('1900-01-01T00:00:00.000Z');
const EXPORT_DATA: boolean = true;

async function get_batch(date: Date): Promise<Response> {
  const response = await fetch(
    ENDPOINT + `/tests/v2?TenantId=${TEAM_ID}&ModifiedFromUtc=${date.toISOString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: await authenticate(),
      },
    }
  )
  return response
}

async function get_all() {
  var response: Response = await get_batch(START_DATE);
  var tests: Array<ForceframeTest> = [];
  var lastDate: Date = START_DATE;

  while ((response.status != 204) && (response.status == 200)) {
    var data: ValdTestResults<ForceframeTest> = await response.json()
    data.tests.forEach(element => {
      tests.push(element);
    });
    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    response = await get_batch(lastDate);
  }
  if (response.status == 204) {
    return tests;
  } else {
    throw Error(response.toString());
  }
}

if (EXPORT_DATA) {
  get_all().then((tests) => {
    console.log(`loaded ${tests.length} rows of data`)
    saveJsonToCsv(tests, 'forceframe.csv')
  });
} else {
  get_all().then((tests) => {
    console.log(tests)
    console.log(`loaded ${tests.length} rows of data`)
  });
}