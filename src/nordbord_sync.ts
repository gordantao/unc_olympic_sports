import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

type ValdTest = {
  modifiedDateUtc: string;
}

type ValdTestResults = {
  tests: Array<ValdTest>;
}

const endpoint: string = 'https://prd-use-api-externalnordbord.valdperformance.com';
const team_id: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const start_date: string = '2000-01-01T00:00:00.000Z'
const EXPORT_DATA: boolean = false;

async function get_data(date: string): Promise<Response> {
  const response = await fetch(
    endpoint + `/tests/v2?TenantId=${team_id}&ModifiedFromUtc=${date}`,
    {
      method: 'GET',
      headers: {
        Authorization: await authenticate(),
      },
    }
  )
  return response
}

async function get_nordboard() {
  var response: Response = await get_data(start_date);
  var tests: Array<ValdTest> = [];
  var last_date: string = start_date;
  var current_date: string;

  while ((response.status != 204) && (response.status == 200)) {
    console.log("Status code: " + response.status);
    var data: ValdTestResults = await response.json()
    data.tests.forEach(element => {
      tests.push(element);
    });
    last_date = data.tests[data.tests.length - 1].modifiedDateUtc;
    console.log("Last date: " + last_date);
    console.log("===========");
    response = await get_data(last_date);
  }
  if (response.status == 204) {
    return tests;
  } else {
    throw Error;
  }
}

get_nordboard();