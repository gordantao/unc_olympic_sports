import { createClient } from "https://esm.sh/@supabase/supabase-js";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ForcedecksTest = {
  testId: string
  tenantId: string
  profileId: string
  recordingId: string
  modifiedDateUtc: string
  recordedDateUtc: string
  recordedDateOffset: number,
  recordedDateTimezone: string,
  analysedDateUtc: string
  analysedDateOffset: number,
  analysedDateTimezone: string,
  testType: string,
  notes: string,
  weight: number,
  parameter: null | {
    resultId: number,
    value: number
  },
  extendedParameters: null | [
    {
      resultId: number,
      value: number
    }
  ],
  attributes: null | [
    {
      attributeValueId: string
      attributeValueName: string
      attributeTypeId: string
      attributeTypeName: string
    }
  ]
}

type ValdTestResults<T> = {
  tests: Array<T>;
}

// Supabase Environment Variables (automatically provided in Supabase Edge Functions)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const clientId = Deno.env.get("CLIENT_ID")!;
const clientSecret = Deno.env.get("CLIENT_SECRET")!;

// Create a Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const ENDPOINT: string = 'https://prd-use-api-externalforceframe.valdperformance.com';
const AUTH_URL: string = 'https://security.valdperformance.com/connect/token';
const TEAM_ID: string = '5b4690e7-25c4-4b79-927f-aec642e3c53e';
const START_DATE: Date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

function normalizeTestData(test: ForcedecksTest) {
  return {
    testId: test.testId,
    tenantId: test.tenantId,
    profileId: test.profileId,
    recordingId: test.recordingId,
    modifiedDate: test.modifiedDateUtc, // Remove "Utc" in key name
    recordedDate: test.recordedDateUtc,
    recordedDateOffset: test.recordedDateOffset,
    analysedDate: test.analysedDateUtc,
    analysedDateOffset: test.analysedDateOffset,
    testType: test.testType,
    notes: test.notes,
    weight: test.weight,
  };
}

async function authenticate(): Promise<string> {
  let secret: string = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(
    AUTH_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: 'grant_type=client_credentials',
    }
  );

  const data = await response.json();
  const token = `Bearer ${data.access_token}`;
  return token;
}

async function get_batch(date: Date): Promise<Response> {
  const token = await authenticate();
  const response = await fetch(
    ENDPOINT + `/tests/v2?TenantId=${TEAM_ID}&ModifiedFromUtc=${date.toISOString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: token,
      },
    }
  )
  return response
}

async function get_data() {
  var response: Response = await get_batch(START_DATE);
  var tests: Array<ForcedecksTest> = [];
  var lastDate: Date = START_DATE;

  while (response.status == 200) {
    var data: ValdTestResults<ForcedecksTest> = await response.json()
    data.tests.forEach(element => {
      tests.push(element);
    });
    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    response = await get_batch(lastDate);
  }
  if (response.status == 204) {
    return tests.map(normalizeTestData);
  } else {
    throw Error(response.toString());
  }
}


// Function Handler
Deno.serve(async (req) => {
  try {
    // Fetch new data
    const newData = await get_data();

    // Insert into Supabase table
    const { error } = await supabase.from("forcedecks").insert(newData);

    if (error) throw error;

    return new Response(JSON.stringify({ message: `${newData.length} records updated successfully` }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error updating forcedecks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});