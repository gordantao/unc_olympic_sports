import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

const endpoint: string = 'https://prd-use-api-externalprofile.valdperformance.com';
const team_id: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const EXPORT_DATA: boolean = true;

async function get_data() {
  const response = await fetch(
    endpoint + `/profiles?TenantId=${team_id}`,
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
    saveJsonToCsv(data.profiles, 'profiles.csv');
  });
} else {
  get_data().then((data) => console.log(data));
}