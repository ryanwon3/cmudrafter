/** Coalesce polls; force one subsequent read after a mutation or identity change. */
export function makeRefreshRunner(task: () => Promise<void>) {
  let inFlight: Promise<void> | null = null;
  let queued = false;
  return function refresh(force = false): Promise<void> {
    if (inFlight) {
      if (force) queued = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        queued = false;
        await task();
      } while (queued);
    })().finally(() => {
      inFlight = null;
      queued = false;
    });
    return inFlight;
  };
}
