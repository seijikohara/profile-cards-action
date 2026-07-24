/**
 * GitHub GraphQL client on Node.js built-ins only.
 *
 * Queries are deliberately shallow and split (documented mitigation for the
 * "Resource limits for this query exceeded" error that kills heavier
 * generators); the client adds bounded retries for transient failures.
 */

const ENDPOINT = 'https://api.github.com/graphql';
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export class GitHubApiError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'GitHubApiError';
    this.retryable = retryable;
  }
}

interface GraphQlErrorItem {
  readonly type?: string;
  readonly message?: string;
}

interface GraphQlEnvelope<T> {
  readonly data?: T;
  readonly errors?: readonly GraphQlErrorItem[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestOnce<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
        // The API rejects requests without a User-Agent.
        'user-agent': 'seijikohara-profile-generator',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new GitHubApiError(`network failure: ${String(cause)}`, true);
  }

  if (!response.ok) {
    const retryable = response.status >= 500 || response.status === 429;
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(`HTTP ${response.status}: ${body.slice(0, 200)}`, retryable);
  }

  const envelope: GraphQlEnvelope<T> = await response.json();
  if (envelope.errors && envelope.errors.length > 0) {
    const first = envelope.errors[0];
    const retryable = first?.type === 'RATE_LIMITED';
    throw new GitHubApiError(
      `GraphQL error${first?.type ? ` [${first.type}]` : ''}: ${first?.message ?? 'unknown'}`,
      retryable
    );
  }
  if (envelope.data === undefined) {
    throw new GitHubApiError('GraphQL response has neither data nor errors', true);
  }
  return envelope.data;
}

/** Execute a query with retries (exponential backoff + jitter) for transient failures. */
export async function graphql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      return await requestOnce<T>(token, query, variables);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof GitHubApiError && error.retryable;
      if (!retryable || attempt === ATTEMPTS) throw error;
      const backoff = BASE_BACKOFF_MS * 4 ** (attempt - 1);
      await sleep(backoff + Math.random() * 500);
    }
  }
  throw lastError;
}
