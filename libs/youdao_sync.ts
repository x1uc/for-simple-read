export type YoudaoSyncResult = {
  success: number;
  failed: number;
  failedWords: string[];
}

export class YoudaoLoginRequiredError extends Error {
  constructor() {
    super("需要登录有道词典");
    this.name = "YoudaoLoginRequiredError";
  }
}

async function getYoudaoCookie(): Promise<string> {
  const cookies = await browser.cookies.getAll({ domain: "dict.youdao.com" });
  const cookieString = cookies.length
    ? cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ")
    : "";
  if (!cookieString) {
    const rootCookies = await browser.cookies.getAll({ domain: ".youdao.com" });
    if (!rootCookies.length) {
      throw new YoudaoLoginRequiredError();
    }
    return rootCookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
  }
  return cookieString;
}

async function checkYoudaoLogin(): Promise<boolean> {
  try {
    const url = new URL("https://dict.youdao.com/wordbook/webapi/v2/ajax/add");
    url.searchParams.set("word", "__login_check__");
    url.searchParams.set("lan", "en");
    const res = await fetch(url.toString(), { credentials: "include" });
    if (res.status === 401 || res.status === 403) return false;
    const data = await res.json();
    if (data?.code === 401 || data?.code === 403) return false;
    if (data?.success === false && data?.message?.includes("login")) return false;
    return true;
  } catch {
    return false;
  }
}

async function addWord(cookie: string, word: string): Promise<boolean> {
  const url = new URL("https://dict.youdao.com/wordbook/webapi/v2/ajax/add");
  url.searchParams.set("word", word);
  url.searchParams.set("lan", "en");
  const res = await fetch(url.toString(), {
    headers: { Cookie: cookie },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data?.code === 0 || data?.success === true;
}

export async function syncWordsToYoudao(words: string[]): Promise<YoudaoSyncResult> {
  const cookie = await getYoudaoCookie();

  const loggedIn = await checkYoudaoLogin();
  if (!loggedIn) {
    throw new YoudaoLoginRequiredError();
  }

  let success = 0;
  let failed = 0;
  const failedWords: string[] = [];

  for (const word of words) {
    try {
      const ok = await addWord(cookie, word);
      if (ok) {
        success++;
      } else {
        failed++;
        failedWords.push(word);
      }
    } catch {
      failed++;
      failedWords.push(word);
    }
  }

  return { success, failed, failedWords };
}
