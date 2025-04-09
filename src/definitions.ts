import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

const endpoint: string =
  "https://prd-use-api-extforcedecks.valdperformance.com";
const EXPORT_DATA: boolean = true;

async function get_data() {
  const response = await fetch(
    endpoint + `/resultdefinitions`,
    {
      method: "GET",
      headers: {
        Authorization: await authenticate(),
      },
    },
  );
  return response.json();
}

if (EXPORT_DATA) {
  get_data().then((data) => {
    saveJsonToCsv(data.resultDefinitions, "results.csv");
  });
} else {
  get_data().then((data) => console.log(data));
}
