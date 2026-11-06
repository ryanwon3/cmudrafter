"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTRO_KEY = "team-draft-eclipse-seen-v1";
const SCREEN_KEY = "team-draft-transition-screen-v1";
const FADE_MS = 180;
const MAX_WAIT_MS = 5000;

export function transitionScreen(phase?: string, activePage?: "bracket") {
  if (activePage === "bracket" && phase === "complete") return "bracket";
  if (phase === "drafting") return "draft";
  if (phase === "complete") return "results";
  if (phase === "lobby" || phase === "review") return phase;
  return null;
}

function stored(key: string) {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function remember(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value); } catch { /* Animation never requires storage. */ }
}

export function SiteTransition({ screen }: { screen: string | null }) {
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef(false);
  const closingRef = useRef(false);
  const mountedRef = useRef(false);
  const reducedRef = useRef(false);
  const lastScreen = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const fadeRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (fadeRef.current !== null) window.clearTimeout(fadeRef.current);
    timeoutRef.current = null;
    fadeRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    activeRef.current = false;
    closingRef.current = false;
    if (!mountedRef.current) return;
    setActive(false);
    setPlaying(false);
    setExiting(false);
  }, [clearTimers]);

  const finish = useCallback(() => {
    if (!mountedRef.current || !activeRef.current || closingRef.current) return;
    closingRef.current = true;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setExiting(true);
    fadeRef.current = window.setTimeout(dismiss, FADE_MS);
  }, [dismiss]);

  const start = useCallback(() => {
    if (!mountedRef.current || reducedRef.current || activeRef.current) return;
    activeRef.current = true;
    closingRef.current = false;
    setPlaying(false);
    setExiting(false);
    setActive(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reducedRef.current = motion?.matches ?? false;
    lastScreen.current = stored(SCREEN_KEY);
    const seen = stored(INTRO_KEY) === "true";
    remember(INTRO_KEY, "true");
    if (!seen) start();
    const onMotion = (event: MediaQueryListEvent) => {
      reducedRef.current = event.matches;
      if (event.matches) dismiss();
    };
    motion?.addEventListener("change", onMotion);
    return () => {
      mountedRef.current = false;
      motion?.removeEventListener("change", onMotion);
      clearTimers();
    };
  }, [clearTimers, dismiss, start]);

  useEffect(() => {
    if (screen === null || screen === lastScreen.current) return;
    const changed = lastScreen.current !== null;
    lastScreen.current = screen;
    remember(SCREEN_KEY, screen);
    if (changed) start();
  }, [screen, start]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!active) {
      if (dialog?.open) dialog.close();
      return;
    }
    activeRef.current = true;
    if (dialog && !dialog.open) dialog.showModal();
    timeoutRef.current = window.setTimeout(finish, MAX_WAIT_MS);
    // Muted inline playback works on mobile; a browser refusal releases the page.
    video?.play()?.catch(finish);
    return () => {
      clearTimers();
      video?.pause();
      if (dialog?.open) dialog.close();
    };
  }, [active, clearTimers, finish]);

  return (
    <dialog
      ref={dialogRef}
      className={`site-transition${playing ? " is-playing" : ""}${exiting ? " is-exiting" : ""}`}
      aria-label="Page transition"
      onCancel={(event) => { event.preventDefault(); finish(); }}
    >
      {active && <>
        <video
          ref={videoRef}
          src="/transitions/eclipse-v1.mp4"
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
          onEnded={finish}
          onError={finish}
        />
        <button type="button" className="transition-skip" onClick={finish}>
          Skip animation
        </button>
      </>}
    </dialog>
  );
}
