import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

type ValdTest = {
  modifiedDateUtc: string;
}

type ValdTestResults = {
  tests: Array<ValdTest>;
}

const ENDPOINT: string = 'https://prd-use-api-externalnordbord.valdperformance.com';
const TEAM_ID: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const START_DATE: Date = new Date('1900-01-01T00:00:00.000Z');
const EXPORT_DATA: boolean = false;

async function get_data(date: Date): Promise<Response> {
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

async function get_nordbord() {
  var response: Response = await get_data(START_DATE);
  var tests: Array<ValdTest> = [];
  var lastDate: Date = START_DATE;
  var currentDate: string;

  while ((response.status != 204) && (response.status == 200)) {
    var data: ValdTestResults = await response.json()
    data.tests.forEach(element => {
      tests.push(element);
    });
    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    response = await get_data(lastDate);
  }
  if (response.status == 204) {
    return tests;
  } else {
    throw Error;
  }
}

if (EXPORT_DATA) {
  get_nordbord().then((tests) => {
    console.log(`loaded ${tests.length} rows of data`)
    saveJsonToCsv(tests, 'nordbord.csv')
  });
} else {
  get_nordbord().then((tests) => {
    console.log(`loaded ${tests.length} rows of data`)
    saveJsonToCsv(tests, 'nordbord.csv')
  });
}