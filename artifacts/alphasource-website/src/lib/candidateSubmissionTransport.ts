export const CANDIDATE_SUBMISSION_MAX_ATTEMPTS = 2;

type CandidateSubmissionRequest = {
  url: string;
  buildBody: () => FormData;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
  onRetry?: (attempt: number) => void;
};

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, delayMs)));
}

export async function postCandidateSubmission({
  url,
  buildBody,
  fetchImpl = fetch,
  retryDelayMs = 350,
  onRetry,
}: CandidateSubmissionRequest): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CANDIDATE_SUBMISSION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchImpl(url, {
        method: "POST",
        credentials: "include",
        body: buildBody(),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= CANDIDATE_SUBMISSION_MAX_ATTEMPTS) break;
      onRetry?.(attempt + 1);
      await wait(retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new TypeError("candidate_submission_network_failure");
}
