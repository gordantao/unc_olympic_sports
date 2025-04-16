// supabase/functions/sync_vald_forcedecks/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

const ENDPOINT = "https://prd-use-api-extforcedecks.valdperformance.com";
const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY: string = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
)!;
const CLIENT_ID: string = Deno.env.get("VALD_CLIENT_ID")!;
const CLIENT_SECRET: string = Deno.env.get("VALD_CLIENT_SECRET")!;
const TEAM_ID: string = Deno.env.get("VALD_TENANT_ID")!;
const START_DATE: Date = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

const AUTH_URL: string = "https://security.valdperformance.com/connect/token";

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

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

let AUTH_TOKEN = "";

function createRateLimiter(maxCalls: number, perMs: number) {
  const queue: (() => void)[] = [];
  setInterval(() => {
    for (let i = 0; i < maxCalls && queue.length > 0; i++) {
      const fn = queue.shift();
      if (fn) fn();
    }
  }, perMs);

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve) => queue.push(() => fn().then(resolve)));
  };
}

const limitedFetch = createRateLimiter(25, 200);

async function get_batch(date: Date): Promise<Response> {
  if (!AUTH_TOKEN) AUTH_TOKEN = await authenticate();

  const url =
    `${ENDPOINT}/tests?TenantId=${TEAM_ID}&ModifiedFromUtc=${date.toISOString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: AUTH_TOKEN },
  });

  if (response.status === 401) {
    console.warn("Auth expired, refreshing token...");
    AUTH_TOKEN = await authenticate();
    return await get_batch(date);
  }

  return response;
}

async function get_trials(testId: string): Promise<any[]> {
  const url = `${ENDPOINT}/v2019q3/teams/${TEAM_ID}/tests/${testId}/trials`;

  const response = await limitedFetch(() =>
    fetch(url, {
      method: "GET",
      headers: { Authorization: AUTH_TOKEN },
    })
  );

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    console.error("Non-JSON trial response for", testId, ":", text);
    throw new Error("Trial response was not JSON");
  }

  const trials = JSON.parse(text);
  const destacked: any[] = [];

  for (const trial of trials) {
    destack_results(trial, testId).forEach((item) => destacked.push(item));
  }

  return destacked;
}

function destack_results(data: any, testId: string) {
  const results: any[] = [];
  const { startTime, endTime } = data;

  for (const result of data.results) {
    results.push({
      ...result,
      testId,
      startTime,
      endTime,
    });
  }

  return results;
}

async function saveToSupabase(data: any[], chunkSize = 500) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    const { error } = await supabase.from("forcedecks_v2").insert(chunk);

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }
  }
}

async function get_all() {
  let response = await get_batch(START_DATE);
  let testIds: ForcedecksTest[] = [];
  let batchCounter = 0;
  let lastDate = START_DATE;

  while (response.status === 200 || response.status === 204) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!contentType.includes("application/json")) {
      throw new Error("Response was not JSON");
    }

    const data: ValdTestResults<ForcedecksTest> = JSON.parse(text);
    testIds.push(...data.tests);

    if (data.tests.length > 0) {
      lastDate = new Date(data.tests[data.tests.length - 1].modifiedDateUtc);
      lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
    }

    response = await get_batch(lastDate);
    batchCounter++;

    if (batchCounter === 1 || response.status === 204) {
      let tests: any[] = [];

      for (const testId of testIds) {
        const trials = await get_trials(testId.testId);
        tests = tests.concat(trials);
      }

      await saveToSupabase(tests);
      tests = [];
      testIds = [];
      batchCounter = 0;
    }

    if (response.status === 204) break;
  }
}

// Main handler
serve(async (_req: any) => {
  try {
    await get_all();
    return new Response("✅ Sync complete", { status: 200 });
  } catch (e) {
    console.error("❌ Error in sync:", e);
    return new Response("❌ Sync failed", { status: 500 });
  }
});
