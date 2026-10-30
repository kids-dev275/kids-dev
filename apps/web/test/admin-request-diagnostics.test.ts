import assert from "node:assert/strict";
import { classifyAdminRequestError } from "../src/lib/admin-request-error";
import { adminLogin } from "../src/lib/admin-api";

async function run(): Promise<void> {
  assert.equal(classifyAdminRequestError(new DOMException("cancelled", "AbortError")).code, "REQUEST_ABORTED");
  assert.equal(classifyAdminRequestError(new DOMException("timed out", "TimeoutError")).code, "TIMEOUT");
  const network = classifyAdminRequestError(new TypeError("Failed to fetch"));
  assert.equal(network.code, "NETWORK_ERROR");
  assert.doesNotMatch(network.message, /Failed to fetch/);
  console.log("PASS: abort, timeout, and browser network failures are classified safely");

  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const calls: { url: string; options: RequestInit }[] = [];
  console.warn = () => {};
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    if (String(url).endsWith("/csrf")) {
      return new Response(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }), { status: 401 });
    }
    throw new TypeError("Failed to fetch");
  };
  try {
    const result = await adminLogin("admin@example.test", "test-password");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "NETWORK_ERROR");
    assert.doesNotMatch(result.error?.message ?? "", /Failed to fetch/);
    assert.match(result.error?.requestId ?? "", /^[0-9a-f-]{36}$/i);
    assert.equal(calls.filter((call) => call.url.endsWith("/login")).length, 1);
    assert.ok(calls.filter((call) => call.url.endsWith("/login")).every((call) => new Headers(call.options.headers).has("X-Request-ID")));
    assert.ok(calls.filter((call) => call.url.endsWith("/csrf")).every((call) => !new Headers(call.options.headers).has("X-Request-ID")));
    console.log("PASS: login network failure has a trace ID and no mutation retry");
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
