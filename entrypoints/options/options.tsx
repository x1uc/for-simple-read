import { useEffect, useRef, useState } from "react";
import { OpenAI } from "openai";

import {
  ai_api_key_storage,
  ai_api_url_storage,
  ai_model_storage,
  ai_prompt_storage,
  ai_word_model_storage,
  collection_words_storage,
  options_tab_storage,
} from "@/libs/local_storage";
import { DEFAULT_TRANSLATION_PROMPT } from "@/libs/ai_prompts";
import { type WordData } from "@/libs/select_word";
import { syncWordsToYoudao, YoudaoLoginRequiredError, type YoudaoSyncResult } from "@/libs/youdao_sync";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

type Tab = "ai" | "word";

function stripMeaning(text?: string | null) {
  if (!text) return "暂无释义";
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "暂无释义";
}

export default function OptionsPage() {
  const [tab, setTab] = useState<Tab>("ai");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [wordModel, setWordModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [collectionWords, setCollectionWords] = useState<WordData[]>([]);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    let active = true;
    (async () => {
      const [
        savedTab,
        storedApiUrl,
        storedApiKey,
        storedModel,
        storedWordModel,
        storedPrompt,
        storedWords,
      ] = await Promise.all([
        options_tab_storage.getValue(),
        ai_api_url_storage.getValue(),
        ai_api_key_storage.getValue(),
        ai_model_storage.getValue(),
        ai_word_model_storage.getValue(),
        ai_prompt_storage.getValue(),
        collection_words_storage.getValue(),
      ]);
      if (!active) return;
      setTab((savedTab as Tab) || "ai");
      setApiUrl(storedApiUrl || "");
      setApiKey(storedApiKey || "");
      setModel(storedModel || "");
      setWordModel(storedWordModel || "");
      setPrompt(storedPrompt || DEFAULT_TRANSLATION_PROMPT);
      setCollectionWords(storedWords || []);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    options_tab_storage.setValue(tab);
  }, [tab]);

  function notify(text: string, type: "success" | "error" = "success") {
    setMessage({ text, type });
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 3000);
  }

  async function handleSaveAi() {
    if (!apiUrl.trim() || !apiKey.trim() || !model.trim() || !wordModel.trim()) {
      notify("请填写 API 调用信息", "error");
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        ai_api_url_storage.setValue(apiUrl.trim()),
        ai_api_key_storage.setValue(apiKey.trim()),
        ai_model_storage.setValue(model.trim()),
        ai_word_model_storage.setValue(wordModel.trim()),
        ai_prompt_storage.setValue(prompt.trim() === DEFAULT_TRANSLATION_PROMPT.trim() ? null : prompt.trim() || null),
      ]);
      notify("AI 配置已保存");
    } catch {
      notify("保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!apiUrl.trim() || !apiKey.trim() || !model.trim()) {
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
      const openai = new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: apiUrl.trim(),
        dangerouslyAllowBrowser: true,
      });
      const stream = await openai.chat.completions.create({
        model: model.trim(),
        stream: true,
        messages: [{ role: "user", content: promptText }],
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

  async function handleDeleteWord(idx: number) {
    const next = collectionWords.filter((_, index) => index !== idx);
    setCollectionWords(next);
    await collection_words_storage.setValue(next);
    notify("已删除单词");
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
    if (!apiUrl.trim() || !apiKey.trim() || !wordModel.trim()) {
      notify("请先在 AI 翻译页面配置 API 信息", "error");
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
      const openai = new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: apiUrl.trim(),
        dangerouslyAllowBrowser: true,
      });
      const wordList = unsyncedWords.map((w) => w.word).join("\n");
      const response = await openai.chat.completions.create({
        model: wordModel.trim(),
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
        ...(wordModel.includes("deepseek") ? { thinking: { type: "disabled" } } : {}),
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
    <main className="h-screen overflow-hidden px-4 py-6 text-slate-900">
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
          <TabsList className="w-full flex-wrap gap-1">
            <TabsTrigger value="ai">AI 翻译</TabsTrigger>
            <TabsTrigger value="word">生词本</TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>AI 配置</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">API 接口地址</label>
                  <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.example.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key</label>
                  <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-xxxx" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI 模型（翻译）</label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI 模型（查词）</label>
                  <Input value={wordModel} onChange={(e) => setWordModel(e.target.value)} placeholder="gpt-4o-mini" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">翻译提示词</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-72 leading-6"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleTest} disabled={testing}>
                    {testing ? "测试中..." : "测试 API"}
                  </Button>
                  <Button onClick={handleSaveAi} disabled={saving}>
                    {saving ? "保存中..." : "保存设置"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="word" className="flex min-h-0 flex-1 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col">
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
                          提取原型
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleExtractLemmas}
                        disabled={!collectionWords.length || lemmaLoading}
                      >
                        {lemmaLoading ? "提取中..." : "提取原型"}
                      </Button>
                    )}
                    <Button onClick={handleExportWords} disabled={!collectionWords.length}>
                      导出 TXT
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                {!collectionWords.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                    暂无单词收藏。你可以在网页上选中单词后打开单词卡进行收藏。
                  </div>
                ) : (
                  <ScrollArea className="min-h-0 flex-1 pr-2">
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
                                  onClick={() => handleDeleteWord(idx)}
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
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
              {youdaoSyncing ? "同步中..." : "同步到有道词典"}
            </Button>
            <Button variant="outline" onClick={() => setLemmaDialogOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
