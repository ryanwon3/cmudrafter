import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { useDraft } from "../src/components/use-draft";
import { GET as getState } from "../src/app/api/state/route";
import { POST as getMe } from "../src/app/api/me/route";
import { POST as claim } from "../src/app/api/claim/route";
import { getStore } from "../src/lib/server";

const TOKEN_KEY = "cmu-pitt-captain-token";
async function claimCaptain(id: number) {
  const response = await claim(
    new Request("http://localhost/api/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ captainId: id }),
    }),
  );
  assert.equal(response.status, 200);
  return (await response.json()).token as string;
}

function environment() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  const oldFetch = globalThis.fetch;
  const old = new Map<string, PropertyDescriptor | undefined>();
  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(values)) {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const req = new Request(new URL(url, "http://localhost"), init);
    if (url === "/api/state") return getState();
    if (url === "/api/me") return getMe(req);
    throw new Error("Unexpected request " + url);
  };
  return {
    dom,
    restore: () => {
      cleanup();
      globalThis.fetch = oldFetch;
      for (const [key, descriptor] of old) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      dom.window.close();
    },
  };
}

test("an already-open tab adopts a captain claimed in another tab", async () => {
  await getStore().adminReset(true);
  const env = environment();
  try {
    const { result } = renderHook(() => useDraft());
    await waitFor(() => assert.equal(result.current.state?.mode, "local"));
    assert.equal(result.current.captainId, null);
    const token = await claimCaptain(1);
    act(() => {
      localStorage.setItem(TOKEN_KEY, token);
      window.dispatchEvent(
        new env.dom.window.StorageEvent("storage", {
          key: TOKEN_KEY,
          newValue: token,
        }),
      );
    });
    await waitFor(() => assert.equal(result.current.captainId, 1));
    assert.equal(result.current.token, token);
  } finally {
    env.restore();
  }
});

test("a delayed revoked-token response cannot delete a newer captain session", async () => {
  await getStore().adminReset(true);
  const env = environment();
  try {
    localStorage.setItem(TOKEN_KEY, "old-revoked-captain-token");
    const transport = globalThis.fetch;
    let release!: () => void;
    let delayed = false;
    globalThis.fetch = async (input, init) => {
      const response = await transport(input, init);
      if (
        String(input) === "/api/me" &&
        JSON.parse(String(init?.body)).token === "old-revoked-captain-token"
      ) {
        delayed = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return response;
    };
    const { result } = renderHook(() => useDraft());
    await waitFor(() => assert.equal(delayed, true));
    const token = await claimCaptain(2);
    act(() => {
      localStorage.setItem(TOKEN_KEY, token);
      window.dispatchEvent(
        new env.dom.window.StorageEvent("storage", {
          key: TOKEN_KEY,
          newValue: token,
        }),
      );
      release();
    });
    await waitFor(() => assert.equal(result.current.captainId, 2));
    assert.equal(localStorage.getItem(TOKEN_KEY), token);
  } finally {
    env.restore();
  }
});
