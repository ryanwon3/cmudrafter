export const N_CAPTAINS = 8;

/** Captain slot (1-based) on the clock for 0-based pick index k, in snake order. */
export function slotOnClock(k: number, n = N_CAPTAINS): number {
  const round = Math.floor(k / n);
  const i = k % n;
  return round % 2 === 0 ? i + 1 : n - i;
}
