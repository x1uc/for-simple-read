const CLOUD_API_URL = "https://word-collection-api.ergouli848.workers.dev";

export type CloudAccount = {
  username: string;
  hourlyLimit: number;
};

export type RemoteWord = {
  id: string;
  username: string;
  deviceName: string;
  originalWord: string;
  meaning: string;
  syncedToYoudao: boolean;
  createdAt: string;
  updatedAt: string;
};

type ErrorBody = {
  error?: { code?: string; message?: string; resetAt?: string };
};

export class CloudApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = "CloudApiError";
  }
}

async function request<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CLOUD_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const resetAt = body.error?.resetAt || response.headers.get("X-RateLimit-Reset") || undefined;
    const message =
      response.status === 401
        ? "同步密钥无效，请检查后重试"
        : response.status === 429 && resetAt
          ? `请求次数已达上限，请在 ${new Date(resetAt).toLocaleTimeString()} 后重试`
          : body.error?.message || `云端请求失败（${response.status}）`;
    throw new CloudApiError(message, response.status, body.error?.code, resetAt);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getCloudAccount(apiKey: string): Promise<CloudAccount> {
  const response = await request<{ data: CloudAccount }>(apiKey, "/api/v1/account");
  return response.data;
}

export async function listRemoteWords(
  apiKey: string,
): Promise<{ words: RemoteWord[]; username: string }> {
  const response = await request<{ data: RemoteWord[]; username: string }>(
    apiKey,
    "/api/v1/words",
  );
  return { words: response.data, username: response.username };
}

export async function upsertRemoteWord(
  apiKey: string,
  input: {
    deviceName: string;
    originalWord: string;
    meaning: string;
    syncedToYoudao: boolean;
  },
): Promise<RemoteWord> {
  const response = await request<{ data: RemoteWord }>(apiKey, "/api/v1/words", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function markRemoteWordSynced(
  apiKey: string,
  id: string,
): Promise<RemoteWord> {
  const response = await request<{ data: RemoteWord }>(
    apiKey,
    `/api/v1/words/${encodeURIComponent(id)}/sync`,
    { method: "PATCH", body: JSON.stringify({ syncedToYoudao: true }) },
  );
  return response.data;
}

export async function deleteRemoteWord(apiKey: string, id: string): Promise<void> {
  await request<void>(apiKey, `/api/v1/words/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
