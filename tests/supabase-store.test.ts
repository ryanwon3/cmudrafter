import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseStore } from "../src/lib/server/supabase-store";
import { DraftError } from "../src/lib/server/errors";

test("a revoked captain is rejected with the same 403 status in Supabase and local mode", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "P0001",
        details: null,
        hint: null,
        message: "You are not a captain",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  try {
    const store = new SupabaseStore(
      "https://example.supabase.co",
      "test-server-key",
    );
    await assert.rejects(
      store.pick("revoked-token-hash", 1, 0),
      (error: unknown) =>
        error instanceof DraftError &&
        error.status === 403 &&
        error.message === "You are not a captain",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
