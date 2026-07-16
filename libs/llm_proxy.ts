export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatRequest = {
  apiUrl: string;
  apiKey: string;
  body: {
    model: string;
    messages: LlmMessage[];
    stream?: boolean;
    [key: string]: unknown;
  };
};

type ProxyResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type StreamMessage =
  | { type: "chunk"; data: unknown }
  | { type: "done" }
  | { type: "error"; error: string };

function permissionOrigin(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LLM API 地址必须使用 HTTP 或 HTTPS");
  }
  return `${url.protocol}//${url.host}/*`;
}

export async function requestLlmHostPermission(apiUrl: string): Promise<void> {
  const granted = await browser.permissions.request({
    origins: [permissionOrigin(apiUrl)],
  });
  if (!granted) throw new Error("未授予 LLM API 域名访问权限");
}

export async function createLlmChatCompletion<T = any>(
  request: LlmChatRequest,
): Promise<T> {
  const response = (await browser.runtime.sendMessage({
    type: "llm-chat-completion",
    payload: { ...request, body: { ...request.body, stream: false } },
  })) as ProxyResponse<T> | undefined;

  if (!response) throw new Error("LLM 后台代理未响应，请重新加载插件");
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function* streamLlmChatCompletion(
  request: LlmChatRequest,
): AsyncGenerator<any> {
  const port = browser.runtime.connect({ name: "llm-chat-stream" });
  const queue: StreamMessage[] = [];
  let wake: (() => void) | null = null;
  let finished = false;

  const push = (message: StreamMessage) => {
    queue.push(message);
    wake?.();
    wake = null;
  };

  port.onMessage.addListener((message) => push(message as StreamMessage));
  port.onDisconnect.addListener(() => {
    if (!finished) push({ type: "error", error: "LLM 后台连接已断开" });
  });
  port.postMessage({
    type: "start",
    payload: { ...request, body: { ...request.body, stream: true } },
  });

  try {
    while (!finished) {
      if (!queue.length) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      const message = queue.shift();
      if (!message) continue;
      if (message.type === "chunk") yield message.data;
      if (message.type === "error") throw new Error(message.error);
      if (message.type === "done") finished = true;
    }
  } finally {
    finished = true;
    port.disconnect();
  }
}
