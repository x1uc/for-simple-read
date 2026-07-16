import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ai_api_key_storage,
  ai_api_url_storage,
  ai_model_storage,
  ai_prompt_storage,
  ai_split_config_storage,
  ai_word_api_key_storage,
  ai_word_api_url_storage,
  ai_word_model_storage,
  cloud_account_storage,
  cloud_api_key_storage,
  cloud_device_name_storage,
  cloud_sync_enabled_storage,
  collection_words_storage,
  options_tab_storage,
} from "@/libs/local_storage";
import { DEFAULT_TRANSLATION_PROMPT } from "@/libs/ai_prompts";
import { type WordData } from "@/libs/select_word";
import { syncWordsToYoudao, YoudaoLoginRequiredError, type YoudaoSyncResult } from "@/libs/youdao_sync";
import {
  configureCloudSync,
  deleteCollectedWord,
  pushYoudaoStatuses,
  syncCloudWords,
} from "@/libs/word_cloud_sync";
import {
  createLlmChatCompletion,
  requestLlmHostPermission,
  streamLlmChatCompletion,
} from "@/libs/llm_proxy";
import { getCloudAccount } from "@/libs/cloud_api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

type Tab = "ai" | "word";

function stripMeaning(text?: string | null) {
  if (!text) return "暂无释义";
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "暂无释义";
}

function ButtonIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function OptionsPage() {
  const [tab, setTab] = useState<Tab>("ai");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [splitConfig, setSplitConfig] = useState(false);
  const [wordApiUrl, setWordApiUrl] = useState("");
  const [wordApiKey, setWordApiKey] = useState("");
  const [wordModel, setWordModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [collectionWords, setCollectionWords] = useState<WordData[]>([]);
  const [cloudApiKey, setCloudApiKey] = useState("");
  const [savedCloudApiKey, setSavedCloudApiKey] = useState("");
  const [cloudDeviceName, setCloudDeviceName] = useState("default");
  const [savedCloudDeviceName, setSavedCloudDeviceName] = useState("default");
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState("");
  const [dialogError, setDialogError] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [lemmaDialogOpen, setLemmaDialogOpen] = useState(false);
  const [lemmaLoading, setLemmaLoading] = useState(false);
  const [lemmaResults, setLemmaResults] = useState<{ word: string; lemma: string }[]>([]);
  const [lemmaError, setLemmaError] = useState("");
  const [youdaoSyncing, setYoudaoSyncing] = useState(false);
  const [youdaoSyncResult, setYoudaoSyncResult] = useState<YoudaoSyncResult | null>(null);
  const [youdaoSyncError, setYoudaoSyncError] = useState("");
  const messageTimerRef = useRef<number | null>(null);
  const skipNextCloudAutoSyncRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [
        savedTab,
        storedApiUrl,
        storedApiKey,
        storedModel,
        storedSplitConfig,
        storedWordApiUrl,
        storedWordApiKey,
        storedWordModel,
        storedPrompt,
        storedWords,
        storedCloudApiKey,
        storedCloudDeviceName,
        storedCloudSyncEnabled,
      ] = await Promise.all([
        options_tab_storage.getValue(),
        ai_api_url_storage.getValue(),
        ai_api_key_storage.getValue(),
        ai_model_storage.getValue(),
        ai_split_config_storage.getValue(),
        ai_word_api_url_storage.getValue(),
        ai_word_api_key_storage.getValue(),
        ai_word_model_storage.getValue(),
        ai_prompt_storage.getValue(),
        collection_words_storage.getValue(),
        cloud_api_key_storage.getValue(),
        cloud_device_name_storage.getValue(),
        cloud_sync_enabled_storage.getValue(),
      ]);
      if (!active) return;
      setTab(savedTab === "word" ? "word" : "ai");
      setApiUrl(storedApiUrl || "");
      setApiKey(storedApiKey || "");
      setModel(storedModel || "");
      setSplitConfig(Boolean(storedSplitConfig));
      setWordApiUrl(storedWordApiUrl || storedApiUrl || "");
      setWordApiKey(storedWordApiKey || storedApiKey || "");
      setWordModel(storedWordModel || "");
      setPrompt(storedPrompt || DEFAULT_TRANSLATION_PROMPT);
      setCollectionWords(storedWords || []);
      setCloudApiKey(storedCloudApiKey || "");
      setSavedCloudApiKey(storedCloudApiKey || "");
      setCloudDeviceName(storedCloudDeviceName || "default");
      setSavedCloudDeviceName(storedCloudDeviceName || "default");
      setCloudSyncEnabled(storedCloudSyncEnabled);
    })()
      .catch(() => undefined)
      .finally(() => {
        if (active) setInitialLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialLoaded) return;
    void options_tab_storage.setValue(tab);
  }, [tab, initialLoaded]);

  useEffect(() => {
    return collection_words_storage.watch((words) => setCollectionWords(words || []));
  }, []);

  useEffect(() => {
    if (!initialLoaded || tab !== "word" || !savedCloudApiKey || !cloudSyncEnabled) return;
    if (skipNextCloudAutoSyncRef.current) {
      skipNextCloudAutoSyncRef.current = false;
      return;
    }
    void handleCloudSync(false);
  }, [initialLoaded, tab, cloudSyncEnabled]);

  function notify(text: string, type: "success" | "error" = "success") {
    setMessage({ text, type });
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 3000);
  }

  function getLookupConfig() {
    return splitConfig
      ? { apiUrl: wordApiUrl, apiKey: wordApiKey, model: wordModel }
      : { apiUrl, apiKey, model };
  }

  function updateApiUrl(value: string) {
    setApiUrl(value);
    void ai_api_url_storage.setValue(value.trim() || null);
  }

  function updateApiKey(value: string) {
    setApiKey(value);
    void ai_api_key_storage.setValue(value.trim() || null);
  }

  function updateModel(value: string) {
    setModel(value);
    void ai_model_storage.setValue(value.trim() || null);
  }

  function updateWordApiUrl(value: string) {
    setWordApiUrl(value);
    void ai_word_api_url_storage.setValue(value.trim() || null);
  }

  function updateWordApiKey(value: string) {
    setWordApiKey(value);
    void ai_word_api_key_storage.setValue(value.trim() || null);
  }

  function updateWordModel(value: string) {
    setWordModel(value);
    void ai_word_model_storage.setValue(value.trim() || null);
  }

  function updatePrompt(value: string) {
    setPrompt(value);
    void ai_prompt_storage.setValue(value.trim() === DEFAULT_TRANSLATION_PROMPT.trim() ? null : value.trim() || null);
  }

  function updateSplitConfig(checked: boolean) {
    setSplitConfig(checked);
    void ai_split_config_storage.setValue(checked);
    if (!checked) return;

    const nextWordApiUrl = wordApiUrl || apiUrl;
    const nextWordApiKey = wordApiKey || apiKey;
    const nextWordModel = wordModel || model;
    setWordApiUrl(nextWordApiUrl);
    setWordApiKey(nextWordApiKey);
    setWordModel(nextWordModel);
    void ai_word_api_url_storage.setValue(nextWordApiUrl.trim() || null);
    void ai_word_api_key_storage.setValue(nextWordApiKey.trim() || null);
    void ai_word_model_storage.setValue(nextWordModel.trim() || null);
  }

  async function handleTest(config?: { apiUrl: string; apiKey: string; model: string }) {
    const testApiUrl = config?.apiUrl ?? apiUrl;
    const testApiKey = config?.apiKey ?? apiKey;
    const testModel = config?.model ?? model;

    if (!testApiUrl.trim() || !testApiKey.trim() || !testModel.trim()) {
      setDialogError(true);
      setDialogContent("API 接口地址、模型、Secret Key 不能为空");
      setDialogOpen(true);
      return;
    }

    const promptText = "你好，我想测试一下你是否可用！";
    setDialogOpen(true);
    setDialogContent("");
    setDialogError(false);
    setTestPrompt(promptText);
    setTesting(true);
    try {
      await requestLlmHostPermission(testApiUrl.trim());
      const stream = streamLlmChatCompletion({
        apiKey: testApiKey.trim(),
        apiUrl: testApiUrl.trim(),
        body: {
          model: testModel.trim(),
          messages: [{ role: "user", content: promptText }],
        },
      });
      for await (const chunk of stream) {
        const nowText = chunk?.choices?.[0]?.delta?.content ?? "";
        if (nowText) {
          setDialogContent((value) => value + nowText);
        }
      }
    } catch (error: any) {
      setDialogError(true);
      setDialogContent(error?.message || "请求失败");
    } finally {
      setTesting(false);
    }
  }

  function cloudResultText(result: {
    uploaded: number;
    downloaded: number;
    removed: number;
    failed: number;
  }) {
    return `同步完成：上传 ${result.uploaded}，拉取 ${result.downloaded}，删除 ${result.removed}${
      result.failed ? `，失败 ${result.failed}` : ""
    }`;
  }

  async function handleCloudSync(showMessage = true) {
    if (cloudSyncing) return;
    setCloudSyncing(true);
    try {
      const result = await syncCloudWords();
      const text = cloudResultText(result);
      if (showMessage) notify(text, result.failed ? "error" : "success");
    } catch (error: any) {
      const text = error?.message || "云端同步失败";
      if (showMessage) notify(text, "error");
    } finally {
      setCloudSyncing(false);
    }
  }

  async function applyCloudConfig(forceTest = false): Promise<boolean> {
    const nextApiKey = cloudApiKey.trim();
    const nextDeviceName = cloudDeviceName.trim() || "default";
    if (!nextApiKey) {
      setCloudApiKey(savedCloudApiKey);
      notify("同步密钥不能为空", "error");
      return false;
    }
    const changed =
      nextApiKey !== savedCloudApiKey || nextDeviceName !== savedCloudDeviceName;
    if (!changed && !forceTest) return true;

    if (!cloudSyncEnabled) {
      if (savedCloudApiKey && nextApiKey !== savedCloudApiKey) {
        setCloudApiKey(savedCloudApiKey);
        notify("请先开启云端同步，再更换账户密钥", "error");
        return false;
      }
      setCloudSaving(true);
      try {
        const account = await getCloudAccount(nextApiKey);
        await Promise.all([
          cloud_api_key_storage.setValue(nextApiKey),
          cloud_device_name_storage.setValue(nextDeviceName),
          cloud_account_storage.setValue(account),
        ]);
        setCloudApiKey(nextApiKey);
        setSavedCloudApiKey(nextApiKey);
        setCloudDeviceName(nextDeviceName);
        setSavedCloudDeviceName(nextDeviceName);
        if (forceTest) notify("同步密钥可用");
        return true;
      } catch (error: any) {
        notify(error?.message || "同步密钥不可用", "error");
        return false;
      } finally {
        setCloudSaving(false);
      }
    }

    setCloudSaving(true);
    try {
      if (changed) {
        await configureCloudSync(nextApiKey, nextDeviceName);
      } else {
        await getCloudAccount(nextApiKey);
      }
      setCloudApiKey(nextApiKey);
      setSavedCloudApiKey(nextApiKey);
      setCloudDeviceName(nextDeviceName);
      setSavedCloudDeviceName(nextDeviceName);
      if (forceTest) notify("同步密钥可用");
      return true;
    } catch (error: any) {
      notify(error?.message || "同步密钥不可用", "error");
      return false;
    } finally {
      setCloudSaving(false);
    }
  }

  async function handleCloudSyncToggle(enabled: boolean) {
    if (!enabled) {
      setCloudSyncEnabled(false);
      await cloud_sync_enabled_storage.setValue(false);
      return;
    }
    if (!cloudApiKey.trim()) {
      await cloud_sync_enabled_storage.setValue(true);
      setCloudSyncEnabled(true);
      return;
    }

    setCloudSaving(true);
    try {
      const { result } = await configureCloudSync(cloudApiKey, cloudDeviceName);
      setCloudApiKey(cloudApiKey.trim());
      setSavedCloudApiKey(cloudApiKey.trim());
      const nextDeviceName = cloudDeviceName.trim() || "default";
      setCloudDeviceName(nextDeviceName);
      setSavedCloudDeviceName(nextDeviceName);
      await cloud_sync_enabled_storage.setValue(true);
      skipNextCloudAutoSyncRef.current = true;
      setCloudSyncEnabled(true);
      if (result.failed) notify(cloudResultText(result), "error");
    } catch (error: any) {
      notify(error?.message || "启用云端同步失败", "error");
    } finally {
      setCloudSaving(false);
    }
  }

  async function handleDeleteWord(word: WordData) {
    try {
      await deleteCollectedWord(word);
      notify("已从本地和云端删除单词");
    } catch (error: any) {
      notify(error?.message || "删除单词失败", "error");
    }
  }

  function handleExportWords() {
    if (!collectionWords.length) {
      notify("暂无可导出的单词", "error");
      return;
    }
    const wordsText = collectionWords.map((item) => item.word.trim()).filter(Boolean).join("\n");
    const blob = new Blob([wordsText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `words_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify(`已导出 ${collectionWords.length} 个单词`);
  }

  async function handleExtractLemmas() {
    if (!collectionWords.length) {
      notify("暂无可处理的单词", "error");
      return;
    }
    const lookupConfig = getLookupConfig();
    if (!lookupConfig.apiUrl.trim() || !lookupConfig.apiKey.trim() || !lookupConfig.model.trim()) {
      notify("请先配置查词 API 信息", "error");
      return;
    }
    const unsyncedWords = collectionWords.filter((w) => !w.syncedToYoudao);
    if (!unsyncedWords.length) {
      notify("所有单词均已同步到有道词典", "error");
      return;
    }
    setLemmaDialogOpen(true);
    setLemmaLoading(true);
    setLemmaError("");
    setLemmaResults([]);
    setYoudaoSyncResult(null);
    setYoudaoSyncError("");
    try {
      await requestLlmHostPermission(lookupConfig.apiUrl.trim());
      const wordList = unsyncedWords.map((w) => w.word).join("\n");
      const response = await createLlmChatCompletion({
        apiKey: lookupConfig.apiKey.trim(),
        apiUrl: lookupConfig.apiUrl.trim(),
        body: {
          model: lookupConfig.model.trim(),
          messages: [
            {
              role: "system",
              content:
                "You are a linguistics expert. Given a list of English words or phrases, return the base/lemma form of each word. " +
                "Respond with a JSON object in the format: {\"lemmas\": [{\"word\": \"original\", \"lemma\": \"base form\"}]}. " +
                "If the word is already in its base form, return it as-is. For phrases, lemmatize the main verb/noun.",
            },
            { role: "user", content: wordList },
          ],
          response_format: { type: "json_object" },
          ...(lookupConfig.model.includes("deepseek") ? { thinking: { type: "disabled" } } : {}),
        },
      });
      const content = response.choices[0]?.message?.content;
      const parsed = JSON.parse(content || "{}");
      const lemmas: { word: string; lemma: string }[] = parsed.lemmas || [];
      setLemmaResults(lemmas);
    } catch (error: any) {
      const msg = error?.message || "请求失败";
      setLemmaError(`AI 提取原型失败：${msg}。请检查 AI 配置是否正确，或更换模型后重试。`);
    } finally {
      setLemmaLoading(false);
    }
  }

  async function handleSyncToYoudao() {
    if (!lemmaResults.length) {
      notify("暂无可同步的单词原型", "error");
      return;
    }
    setYoudaoSyncing(true);
    setYoudaoSyncResult(null);
    setYoudaoSyncError("");
    try {
      const words = lemmaResults.map((item) => item.lemma);
      const result = await syncWordsToYoudao(words);
      setYoudaoSyncResult(result);

      const failedLemmaSet = new Set(result.failedWords);
      const syncedOriginalWords = new Set(
        lemmaResults.filter((item) => !failedLemmaSet.has(item.lemma)).map((item) => item.word)
      );
      if (syncedOriginalWords.size) {
        const next = collectionWords.map((w) =>
          syncedOriginalWords.has(w.word) ? { ...w, syncedToYoudao: true } : w
        );
        setCollectionWords(next);
        await collection_words_storage.setValue(next);
        await pushYoudaoStatuses(
          next.filter((word) => syncedOriginalWords.has(word.word)),
        );
      }

      if (!result.failed) {
        notify(`已成功同步 ${result.success} 个单词到有道词典`);
      } else {
        notify(`同步完成：成功 ${result.success} 个，失败 ${result.failed} 个`, "error");
      }
    } catch (error: any) {
      if (error instanceof YoudaoLoginRequiredError) {
        const confirmed = window.confirm(
          "检测到您尚未登录有道词典，是否跳转到有道词典页面进行登录？登录后请重新点击同步按钮。"
        );
        if (confirmed) {
          browser.tabs.create({ url: "https://dict.youdao.com/wordbook/wordlist" });
        }
        setYoudaoSyncError("需要登录有道词典才能同步单词");
      } else {
        setYoudaoSyncError(error?.message || "同步失败");
        notify(error?.message || "同步失败", "error");
      }
    } finally {
      setYoudaoSyncing(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-slate-900">
      <div className="mx-auto flex h-full max-w-6xl flex-col space-y-4">

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex min-h-0 flex-1 flex-col space-y-4">
          <TabsList className="flex-wrap gap-1 self-start">
            <TabsTrigger value="ai" className="flex items-center gap-1.5 text-xs font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              AI 翻译
            </TabsTrigger>
            <TabsTrigger value="word" className="flex items-center gap-1.5 text-xs font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/>
                <path d="M6 10h10"/>
              </svg>
              生词本
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>AI 配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-sm font-medium">分开配置翻译和查词</div>
                      <div className="mt-1 text-xs text-slate-500">
                        开启后可以分别设置翻译和查词模型。查词使用速度快、成本低的模型，翻译使用能力更强的模型，以获得更自然、准确的长文本翻译体验。
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={splitConfig}
                    onCheckedChange={updateSplitConfig}
                  />
                </div>

                {!splitConfig ? (
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API 接口地址</label>
                      <Input value={apiUrl} onChange={(e) => updateApiUrl(e.target.value)} placeholder="https://api.example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Secret Key</label>
                      <Input type="password" value={apiKey} onChange={(e) => updateApiKey(e.target.value)} placeholder="sk-xxxx" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">AI 模型</label>
                      <Input value={model} onChange={(e) => updateModel(e.target.value)} placeholder="gpt-4o" />
                    </div>
                    <Button variant="secondary" onClick={() => handleTest()} disabled={testing}>
                      <ButtonIcon>
                        <path d="M9 12.75 11.25 15 15 9.75" />
                        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </ButtonIcon>
                      {testing ? "测试中..." : "测试 API"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">翻译配置</div>
                          <div className="mt-1 text-xs text-slate-500">用于选中文本后的 AI 翻译。</div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => handleTest({ apiUrl, apiKey, model })} disabled={testing}>
                          <ButtonIcon>
                            <path d="M9 12.75 11.25 15 15 9.75" />
                            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </ButtonIcon>
                          {testing ? "测试中..." : "测试"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">API 接口地址</label>
                        <Input value={apiUrl} onChange={(e) => updateApiUrl(e.target.value)} placeholder="https://api.example.com" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Secret Key</label>
                        <Input type="password" value={apiKey} onChange={(e) => updateApiKey(e.target.value)} placeholder="sk-xxxx" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">AI 模型</label>
                        <Input value={model} onChange={(e) => updateModel(e.target.value)} placeholder="gpt-4o" />
                      </div>
                    </div>
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">查词配置</div>
                          <div className="mt-1 text-xs text-slate-500">用于单词释义、音标和单词原型提取。</div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => handleTest({ apiUrl: wordApiUrl, apiKey: wordApiKey, model: wordModel })} disabled={testing}>
                          <ButtonIcon>
                            <path d="M9 12.75 11.25 15 15 9.75" />
                            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </ButtonIcon>
                          {testing ? "测试中..." : "测试"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">API 接口地址</label>
                        <Input value={wordApiUrl} onChange={(e) => updateWordApiUrl(e.target.value)} placeholder="https://api.example.com" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Secret Key</label>
                        <Input type="password" value={wordApiKey} onChange={(e) => updateWordApiKey(e.target.value)} placeholder="sk-xxxx" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">AI 模型</label>
                        <Input value={wordModel} onChange={(e) => updateWordModel(e.target.value)} placeholder="deepseek-v4-flash" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">翻译提示词</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(e.target.value)}
                    className="min-h-72 leading-6"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="word">
            <Card className="mb-4">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>云端同步</CardTitle>
                    <CardDescription>
                      开启后，本地收藏会立即上传；每次打开生词本时自动拉取更新。
                    </CardDescription>
                  </div>
                  <Switch
                    checked={cloudSyncEnabled}
                    onCheckedChange={handleCloudSyncToggle}
                    disabled={cloudSaving || cloudSyncing}
                  />
                </div>
              </CardHeader>
              {cloudSyncEnabled ? (
                <CardContent className="space-y-3">
                  <div className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">同步密钥</label>
                    <Input
                      type="password"
                      value={cloudApiKey}
                      onChange={(event) => setCloudApiKey(event.target.value)}
                      onBlur={(event) => {
                        if ((event.relatedTarget as HTMLElement | null)?.dataset.cloudKeyTest) return;
                        void applyCloudConfig();
                      }}
                      placeholder="填写账户密钥"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">设备名</label>
                    <Input
                      value={cloudDeviceName}
                      onChange={(event) => setCloudDeviceName(event.target.value)}
                      onBlur={(event) => {
                        if ((event.relatedTarget as HTMLElement | null)?.dataset.cloudKeyTest) return;
                        void applyCloudConfig();
                      }}
                      placeholder="default"
                    />
                  </div>
                  <Button
                    variant="outline"
                    data-cloud-key-test="true"
                    onClick={() => applyCloudConfig(true)}
                    disabled={!cloudApiKey.trim() || cloudSaving || cloudSyncing}
                  >
                    {cloudSaving ? "测试中…" : "测试密钥"}
                  </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>生词本</CardTitle>
                    <CardDescription>共 {collectionWords.length} 个单词，可删除和导出。</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {collectionWords.length && collectionWords.every((w) => w.syncedToYoudao) ? (
                      <span title="没有未同步的单词">
                        <Button
                          variant="outline"
                          onClick={handleExtractLemmas}
                          disabled
                        >
                          <ButtonIcon>
                            <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                            <path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                          </ButtonIcon>
                          提取原型
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleExtractLemmas}
                        disabled={!collectionWords.length || lemmaLoading}
                      >
                        <ButtonIcon>
                          <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                          <path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                        </ButtonIcon>
                        {lemmaLoading ? "提取中..." : "提取原型"}
                      </Button>
                    )}
                    <Button onClick={handleExportWords} disabled={!collectionWords.length}>
                      <ButtonIcon>
                        <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
                        <path d="M7.5 7.5 12 12m0 0 4.5-4.5M12 12V3" />
                      </ButtonIcon>
                      导出 TXT
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!collectionWords.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                    暂无单词收藏。你可以在网页上选中单词后打开单词卡进行收藏。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {collectionWords.map((word, idx) => (
                        <div
                          key={`${word.word}-${idx}`}
                          className="flex min-h-32 flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                        >
                          <div className="min-h-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 p-0 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                                  onClick={() => handleDeleteWord(word)}
                                  title="删除单词"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                  <span className="sr-only">删除单词</span>
                                </Button>
                                <div className="min-w-0 truncate text-base font-semibold" title={word.word}>{word.word}</div>
                              </div>
                              {word.syncedToYoudao ? (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  已同步
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="line-clamp-4 text-xs leading-5 text-slate-500"
                              title={stripMeaning(word.meaning)}
                            >
                              {stripMeaning(word.meaning)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                              <span
                                className="rounded-full bg-slate-100 px-2 py-0.5"
                                title={`来源设备：${word.sourceDevice || "本地"}`}
                              >
                                来源：{word.sourceDevice || "本地"}
                              </span>
                              {word.cloudSyncPending || word.pendingYoudaoSync ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                                  待同步
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>API 测试</DialogTitle>
                <DialogDescription>直接使用当前配置调用翻译模型，展示流式返回结果。</DialogDescription>
              </div>
              <Badge variant={dialogError ? "error" : testing ? "secondary" : "success"}>
                {dialogError ? "错误" : testing ? "测试中" : "可用"}
              </Badge>
            </div>
          </DialogHeader>
          <div className="mt-4">
            {dialogError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
                {dialogContent}
              </div>
            ) : (
              <ScrollArea className="max-h-[24rem]">
                <div className="space-y-4 pr-2">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-800 px-4 py-3 text-sm leading-6 text-white">
                      {testPrompt}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                      {dialogContent || (testing ? "正在思考..." : "等待响应...")}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <ButtonIcon>
                <path d="M6 18 18 6M6 6l12 12" />
              </ButtonIcon>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lemmaDialogOpen} onOpenChange={setLemmaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>单词原型提取</DialogTitle>
                <DialogDescription>AI 分析每个单词/短语的原型（lemma）。</DialogDescription>
              </div>
              <Badge variant={lemmaError ? "error" : lemmaLoading ? "secondary" : "success"}>
                {lemmaError ? "错误" : lemmaLoading ? "处理中" : `${lemmaResults.length} 个结果`}
              </Badge>
            </div>
          </DialogHeader>
          <div className="mt-4">
            {lemmaLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                正在请求 AI 分析单词原型，请稍候...
              </div>
            ) : lemmaError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {lemmaError}
              </div>
            ) : lemmaResults.length ? (
              <ScrollArea className="max-h-[24rem] pr-2">
                <div className="space-y-2">
                  {lemmaResults.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm text-slate-600">{item.word}</span>
                      <span className="text-sm font-semibold text-sky-600">{item.lemma}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}
          </div>
          {youdaoSyncError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {youdaoSyncError}
            </div>
          ) : null}
          {youdaoSyncResult ? (
            <div className={`mt-3 rounded-xl border px-4 py-2 text-sm ${
              youdaoSyncResult.failed
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              同步完成：成功 {youdaoSyncResult.success} 个
              {youdaoSyncResult.failed ? `，失败 ${youdaoSyncResult.failed} 个（${youdaoSyncResult.failedWords.join("、")}）` : ""}
            </div>
          ) : null}
          <div className="mt-4 flex justify-between gap-2">
            <Button
              variant="secondary"
              onClick={handleSyncToYoudao}
              disabled={!lemmaResults.length || lemmaLoading || youdaoSyncing}
            >
              <ButtonIcon>
                <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </ButtonIcon>
              {youdaoSyncing ? "同步中..." : "同步到有道词典"}
            </Button>
            <Button variant="outline" onClick={() => setLemmaDialogOpen(false)}>
              <ButtonIcon>
                <path d="M6 18 18 6M6 6l12 12" />
              </ButtonIcon>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
