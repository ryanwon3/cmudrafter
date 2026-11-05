/** An error whose message is safe and meant to be shown to the user. */
const BRAND = Symbol.for("cmu-pitt.draft-error");

export class DraftError extends Error {
  readonly [BRAND] = true;

  // The development store survives in globalThis across separately bundled
  // route modules and hot reloads. Constructor identity does not survive them.
  static [Symbol.hasInstance](value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const error = value as {
      [BRAND]?: unknown;
      message?: unknown;
      status?: unknown;
    };
    return (
      error[BRAND] === true &&
      typeof error.message === "string" &&
      typeof error.status === "number" &&
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status <= 599
    );
  }

  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "DraftError";
  }
}
