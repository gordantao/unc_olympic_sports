import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";


const endpoint: string = 'https://prd-use-api-externalnordbord.valdperformance.com';
const team_id: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const date: string = '1900-01-01T00:00:00.000Z'
const EXPORT_DATA: boolean = true;

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
    saveJsonToCsv(data.tests, 'nordboard.csv')
  });
} else {
  get_data().then((data) => console.log(data));
}