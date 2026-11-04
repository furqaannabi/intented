// Where a verdict's time goes. judge() makes two kinds of call to NEAR AI: the model call, then the
// signature fetch, which retries while the node that served the call hasn't cached it yet. A fetch
// wrapped here, passed to createJudge, times each kind; the firewall core itself is unchanged.

export interface Timing {
  /** POST /v1/chat/completions. */
  model_ms: number;
  /** Every GET /v1/signature/... for this verdict, the waits between retries included. */
  signature_ms: number;
  /** How many signature fetches it took; more than 1 means 404s while the node cached it. */
  signature_attempts: number;
}

export function timedFetch(inner: typeof fetch = fetch, clock: () => number = () => performance.now()) {
  let modelMs = 0;
  let signatureStart: number | undefined;
  let signatureEnd = 0;
  let attempts = 0;

  const wrapped: typeof fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const started = clock();
    const isSignature = url.includes("/v1/signature/");
    if (isSignature) {
      signatureStart ??= started;
      attempts++;
    }
    try {
      return await inner(input, init);
    } finally {
      if (isSignature) signatureEnd = clock();
      else if (url.includes("/v1/chat/completions")) modelMs += clock() - started;
    }
  };

  return {
    fetch: wrapped,
    timing: (): Timing => ({
      model_ms: Math.round(modelMs),
      signature_ms: Math.round(signatureStart === undefined ? 0 : signatureEnd - signatureStart),
      signature_attempts: attempts,
    }),
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s.length % 2 ? s[s.length >> 1]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
};

/** Medians over every timed run, and how many runs waited on a signature 404. */
export function timingSummary(timings: Timing[]) {
  return {
    median_model_ms: median(timings.map((t) => t.model_ms)),
    median_signature_ms: median(timings.map((t) => t.signature_ms)),
    signature_retried_runs: timings.filter((t) => t.signature_attempts > 1).length,
    timed_runs: timings.length,
  };
}
