import type { LlmChatRequest } from "@/libs/llm_proxy";

function completionUrl(apiUrl: string): { url: string; permission: string } {
  const url = new URL(apiUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LLM API 地址必须使用 HTTP 或 HTTPS");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  if (!url.pathname.endsWith("/chat/completions")) {
    url.pathname += "/chat/completions";
  }
  return {
    url: url.toString(),
    permission: `${url.protocol}//${url.host}/*`,
  };
}

async function fetchCompletion(
  request: LlmChatRequest,
  signal?: AbortSignal,
): Promise<Response> {
  if (!request?.apiKey || !request?.body?.model) {
    throw new Error("LLM 请求配置不完整");
  }
  const endpoint = completionUrl(request.apiUrl);
  const permitted = await browser.permissions.contains({
    origins: [endpoint.permission],
  });
  if (!permitted) {
    throw new Error("LLM 域名尚未授权，请在设置页点击“测试”并允许访问");
  }

  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
      Accept: request.body.stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(request.body),
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || text;
    } catch {
      // Keep the upstream response text.
    }
    throw new Error(message || `LLM 请求失败（${response.status}）`);
  }
  return response;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "LLM 请求失败";
}

async function handleStream(port: Browser.runtime.Port, request: LlmChatRequest) {
  const controller = new AbortController();
  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
    controller.abort();
  });
  const send = (message: unknown) => {
    if (!disconnected) port.postMessage(message);
  };

  try {
    const response = await fetchCompletion(request, controller.signal);
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      send({ type: "chunk", data: await response.json() });
      send({ type: "done" });
      return;
    }
    if (!response.body) throw new Error("LLM 接口没有返回流式响应");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          send({ type: "chunk", data: JSON.parse(data) });
        } catch {
          // Ignore malformed keepalive events.
        }
      }
      if (done) break;
    }
    send({ type: "done" });
  } catch (error) {
    if (!disconnected) send({ type: "error", error: errorMessage(error) });
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "llm-chat-completion") return undefined;
    return fetchCompletion(message.payload as LlmChatRequest)
      .then((response) => response.json())
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error: errorMessage(error) }));
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "llm-chat-stream") return;
    port.onMessage.addListener((message) => {
      if (message?.type === "start") {
        void handleStream(port, message.payload as LlmChatRequest);
      }
    });
  });
});
