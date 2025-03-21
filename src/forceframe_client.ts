import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

const endpoint: string = 'https://prd-use-api-externalforceframe.valdperformance.com';
const team_id: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const date: string = '2025-01-01T00:00:00.000Z'
const EXPORT_DATA: boolean = false;


async function get_data() {
  const response = await fetch(
    endpoint + `/tests/v2?TenantId=${team_id}&ModifiedFromUtc=${date}`,
    {
      method: 'GET',
      headers: {
        Authorization: await authenticate(),
      },
    }
  )
  return response.json()
}

if (EXPORT_DATA) {
  get_data().then((data) => {
    console.log(`loaded ${data.tests.length} rows of data`)
    saveJsonToCsv(data.tests, 'forceframe.csv')
  });
} else {
  get_data().then((data) => {
    console.log(data)
    console.log(`loaded ${data.tests.length} rows of data`)
  });
}