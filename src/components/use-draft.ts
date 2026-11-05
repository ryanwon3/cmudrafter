"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { request } from "@/lib/client";
import { makeRefreshRunner } from "@/lib/refresh";
import type { DraftState } from "@/lib/types";

const TOKEN_KEY = "cmu-pitt-captain-token";
const SPECTATOR_KEY = "cmu-pitt-spectator";

export function useDraft(identity = true) {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [spectator, setSpectator] = useState(false);
  const [connected, setConnected] = useState(false);
  const tokenRef = useRef("");
  const mounted = useRef(false);

  const refresh = useMemo(
    () =>
      makeRefreshRunner(async () => {
        const queriedToken = tokenRef.current;
        try {
          const [data, me] = await Promise.all([
            request<DraftState>("/api/state"),
            identity && queriedToken
              ? request<{ captainId: number | null }>("/api/me", {
                  token: queriedToken,
                })
              : Promise.resolve({ captainId: null }),
          ]);
          if (!mounted.current) return;
          setState(data);
          setConnected(true);
          // A claim/storage event queues another read. An older response cannot
          // revoke or overwrite a newer identity.
          if (tokenRef.current !== queriedToken) return;
          setCaptainId(me.captainId);
          if (identity && queriedToken && me.captainId === null) {
            tokenRef.current = "";
            setToken("");
            try {
              if (localStorage.getItem(TOKEN_KEY) === queriedToken)
                localStorage.removeItem(TOKEN_KEY);
            } catch {
              /* The revoked identity is already cleared in memory. */
            }
          }
        } catch (e) {
          if (mounted.current) {
            setConnected(false);
            setError(
              e instanceof Error ? e.message : "Unable to sync the draft.",
            );
          }
        }
      }),
    [identity],
  );

  useEffect(() => {
    mounted.current = true;
    const syncToken = () => {
      if (!identity) return;
      try {
        const saved = localStorage.getItem(TOKEN_KEY) || "";
        if (saved !== tokenRef.current) {
          tokenRef.current = saved;
          setToken(saved);
          setCaptainId(null);
        }
      } catch {
        setError(
          "Browser storage is unavailable. Keep this tab open to retain your captain identity.",
        );
      }
    };
    syncToken();
    try {
      setSpectator(sessionStorage.getItem(SPECTATOR_KEY) === "true");
    } catch {
      /* Tab-only preference. */
    }
    void refresh(true);
    const onFocus = () => {
      syncToken();
      void refresh(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) {
        syncToken();
        void refresh(true);
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [identity, refresh]);

  useEffect(() => {
    const interval = setInterval(
      () => void refresh(),
      state?.mode === "local" ? 1000 : 5000,
    );
    return () => clearInterval(interval);
  }, [refresh, state?.mode]);

  useEffect(() => {
    if (state?.mode !== "supabase") return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const client = createClient(url, key);
    let channel = client.channel("inhouse-draft");
    for (const table of ["draft", "captains", "players"]) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void refresh(),
      );
    }
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, state?.mode]);

  const remember = useCallback((newToken: string, id: number | null) => {
    tokenRef.current = newToken;
    setToken(newToken);
    setCaptainId(id);
    try {
      if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      setError(
        "Your browser could not save the captain session. Keep this tab open.",
      );
    }
  }, []);

  const watch = useCallback((value: boolean) => {
    setSpectator(value);
    try {
      sessionStorage.setItem(SPECTATOR_KEY, String(value));
    } catch {
      /* Remains active in this tab. */
    }
  }, []);

  return {
    state,
    error,
    setError,
    token,
    captainId,
    remember,
    spectator,
    watch,
    connected,
    refresh,
  };
}
