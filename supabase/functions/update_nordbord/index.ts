import { createClient } from "https://esm.sh/@supabase/supabase-js";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";

type NordbordTest = {
  profileId: string;
  testId: string;
  modifiedDateUtc: string;
  testDateUtc: string;
  testTypeId: string;
  testTypeName: string;
  notes: null | string;
  device: string;
  leftAvgForce: number;
  leftImpulse: number;
  leftMaxForce: number;
  leftTorque: number;
  leftCalibration: number;
  leftRepetitions: number;
  rightAvgForce: number;
  rightImpulse: number;
  rightMaxForce: number;
  rightTorque: number;
  rightCalibration: number;
  rightRepetitions: number;
};

type ValdTestResults<T> = {
  tests: Array<T>;
};

function normalizeTestData(test: NordbordTest) {
  return {
    profileId: test.profileId,
    testId: test.testId,
    modifiedDate: test.modifiedDateUtc,
    testDate: test.testDateUtc,
    testTypeId: test.testTypeId,
    testTypeName: test.testTypeName,
    notes: test.notes,
    device: test.device,
    leftAvgForce: test.leftAvgForce,
    leftImpulse: test.leftImpulse,
    leftMaxForce: test.leftMaxForce,
    leftTorque: test.leftTorque,
    leftCalibration: test.leftCalibration,
    leftRepetitions: test.leftRepetitions,
    rightAvgForce: test.rightAvgForce,
    rightImpulse: test.rightImpulse,
    rightMaxForce: test.rightMaxForce,
    rightTorque: test.rightTorque,
    rightCalibration: test.rightCalibration,
    rightRepetitions: test.rightRepetitions,
  };
}

// Supabase Environment Variables (automatically provided in Supabase Edge Functions)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CLIENT_ID = Deno.env.get("VALD_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("VALD_CLIENT_SECRET")!;
const TEAM_ID: string = Deno.env.get("VALD_TENANT_ID")!;

// Create a Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const ENDPOINT: string =
  "https://prd-use-api-externalnordbord.valdperformance.com";
const AUTH_URL: string = "https://security.valdperformance.com/connect/token";
const START_DATE: Date = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

async function authenticate(): Promise<string> {
  const secret: string = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
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
  const tests: Array<NordbordTest> = [];
  let response: Response = await get_batch(START_DATE);
  let lastDate: Date = START_DATE;
  let data: ValdTestResults<NordbordTest>;

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

    const { error } = await supabase.from("nordbord").insert(newData);

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
