# Eclipse Transition Implementation Plan

**Goal:** Play the supplied 1.8-second clip on initial entry and phase changes across lobby, draft, review, results and bracket. The organizer confirmed using the full clip, including the opening university seal.

**Design:** A shared Header-mounted client component observes its screen key. Per-tab session storage avoids repeat introductions and remembers phases through full-page navigation. Same-phase updates do not replay; changes during playback are coalesced. A native full-screen dialog uses muted inline video, preserves the entire square frame, and fades back to the current page. Skip, Escape, autoplay refusal, media errors and a five-second watchdog release the overlay. Reduced-motion users skip playback. No backend or draft-state mutations are needed.

1. [x] Inspect clip and confirm branding choice. Copy original asset unchanged into public/transitions.
2. [x] Write failing component tests, then implement phase detection, playback and lifecycle safeguards.
3. [x] Run focused/full tests and production build, independent review, and local browser first-entry/phase/navigation checks. 73 tests passed; browser playback verified muted 1.8-second video during lobby-to-draft, review/results and bracket navigation. Same-phase navigation did not replay. Skip worked and the browser reported no errors. The entire square clip remains visible at wide aspect ratios.
4. [ ] Push/deploy and verify the live video and page without changing event data.
