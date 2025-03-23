import { createClient } from "https://esm.sh/@supabase/supabase-js";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";

type ForcedecksTest = {
  testId: string;
  tenantId: string;
  profileId: string;
  recordingId: string;
  modifiedDateUtc: string;
  recordedDateUtc: string;
  recordedDateOffset: number;
  recordedDateTimezone: string;
  analysedDateUtc: string;
  analysedDateOffset: number;
  analysedDateTimezone: string;
  testType: string;
  notes: string;
  weight: number;
  parameter: null | {
    resultId: number;
    value: number;
  };
  extendedParameters: null | [
    {
      resultId: number;
      value: number;
    },
  ];
  attributes: null | [
    {
      attributeValueId: string;
      attributeValueName: string;
      attributeTypeId: string;
      attributeTypeName: string;
    },
  ];
};

type ValdTestResults<T> = {
  tests: Array<T>;
};

function normalizeTestData(test: ForcedecksTest) {
  return {
    testId: test.testId,
    tenantId: test.tenantId,
    profileId: test.profileId,
    recordingId: test.recordingId,
    modifiedDate: test.modifiedDateUtc, // Remove 'Utc' in key name
    recordedDate: test.recordedDateUtc,
    recordedDateOffset: test.recordedDateOffset,
    analysedDate: test.analysedDateUtc,
    analysedDateOffset: test.analysedDateOffset,
    testType: test.testType,
    notes: test.notes,
    weight: test.weight,
  };
}

// Supabase Environment Variables (automatically provided in Supabase Edge Functions)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const clientId = Deno.env.get("VALD_CLIENT_ID")!;
const clientSecret = Deno.env.get("VALD_CLIENT_SECRET")!;

// Create a Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const ENDPOINT: string =
  "https://prd-use-api-externalforceframe.valdperformance.com";
const AUTH_URL: string = "https://security.valdperformance.com/connect/token";
const TEAM_ID: string = "5b4690e7-25c4-4b79-927f-aec642e3c53e";
const START_DATE: Date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

async function authenticate(): Promise<string> {
  const secret: string = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await fetch(
    AUTH_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: "grant_type=client_credentials",
    },
  );

  const data = await response.json();
  const token = `Bearer ${data.access_token}`;
  return token;
}

async function get_batch(date: Date): Promise<Response> {
  const token = await authenticate();
  const response = await fetch(
    ENDPOINT +
      `/tests/v2?TenantId=${TEAM_ID}&ModifiedFromUtc=${date.toISOString()}`,
    {
      method: "GET",
      headers: {
        Authorization: token,
      },
    },
  );
  return response;
}

async function get_data() {
  const tests: Array<ForcedecksTest> = [];
  let response: Response = await get_batch(START_DATE);
  let lastDate: Date = START_DATE;
  let data: ValdTestResults<ForcedecksTest>;

  while (response.status == 200) {
    data = await response.json();
    data.tests.forEach((element) => {
      tests.push(element);
    });
    lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
    lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    response = await get_batch(lastDate);
  }
  if (response.status == 204) {
    return tests.map(normalizeTestData);
  } else {
    const errorJson = await response.json();
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorJson)}`);
  }
}

Deno.serve(async (_req) => {
  try {
    const newData = await get_data();

    const { error } = await supabase.from("forcedecks").insert(newData);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: `${newData.length} records updated successfully`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } // Fetch new data
  // deno-lint-ignore no-explicit-any
  catch (_error: any) {
    const error: Error = _error;
    return new Response(
      JSON.stringify({
        message: `Error:\n${error.message}`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
