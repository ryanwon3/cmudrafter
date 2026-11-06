import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";

test("player check-in confirms the selected name and allows only their own withdrawal", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  const old = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const originalFetch = globalThis.fetch;
  const calls: Record<string, unknown>[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    return Response.json(
      body.action === "check-in"
        ? { token: "test-player-token-123", playerId: 1 }
        : body.action === "me"
          ? { playerId: 1 }
          : { ok: true },
    );
  };
  try {
    const { AttendancePanel } =
      await import("../src/components/attendance-panel");
    const player = {
      id: 1,
      display_name: "moon",
      riot_id: "moon#90849",
      peak_rank: "Emerald 4",
      rank_score: 20,
      opgg_url: "https://op.gg",
      team_captain_id: null,
      pick_number: null,
      present: false,
    };
    const props = {
      players: [player],
      onChanged: async () => {},
      onError: (message: string) => {
        throw new Error(message);
      },
    };
    const ui = render(React.createElement(AttendancePanel, props));
    fireEvent.change(ui.getByLabelText("Your player name"), {
      target: { value: "1" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Confirm attendance" }));
    await waitFor(() =>
      assert.ok(calls.some((c) => c.action === "check-in" && c.playerId === 1)),
    );
    ui.rerender(
      React.createElement(AttendancePanel, {
        ...props,
        players: [{ ...player, present: true }],
      }),
    );
    await waitFor(() =>
      assert.ok(ui.getByRole("button", { name: "Withdraw attendance" })),
    );
    assert.equal(
      localStorage.getItem("cmu-pitt-player-token"),
      "test-player-token-123",
    );
    fireEvent.click(ui.getByRole("button", { name: "Withdraw attendance" }));
    await waitFor(() =>
      assert.ok(
        calls.some(
          (c) => c.action === "leave" && c.token === "test-player-token-123",
        ),
      ),
    );
    await waitFor(() =>
      assert.equal(localStorage.getItem("cmu-pitt-player-token"), null),
    );
    ui.unmount();
    localStorage.setItem("cmu-pitt-player-token", "revoked-old-player-token");
    let finishOld!: () => void;
    let queried = false;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.token === "revoked-old-player-token") {
        queried = true;
        await new Promise<void>((resolve) => {
          finishOld = resolve;
        });
        return Response.json({ playerId: null });
      }
      return Response.json({ playerId: 2 });
    };
    render(React.createElement(AttendancePanel, props));
    await waitFor(() => assert.equal(queried, true));
    // Another tab can save a replacement before its storage event is delivered.
    localStorage.setItem(
      "cmu-pitt-player-token",
      "new-player-token-from-another-tab",
    );
    await act(async () => {
      finishOld();
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.equal(
      localStorage.getItem("cmu-pitt-player-token"),
      "new-player-token-from-another-tab",
    );
  } finally {
    cleanup();
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.fetch = originalFetch;
    for (const [key, value] of old) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
