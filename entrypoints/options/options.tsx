import { useEffect, useMemo, useRef, useState } from "react";
import { OpenAI } from "openai";

import {
  ai_api_key_storage,
  ai_api_url_storage,
  ai_model_storage,
  ai_prompt_storage,
  ai_word_model_storage,
  collection_words_storage,
  options_tab_storage,
  DEFAULT_SENTENCE_HIGHLIGHT_COLOR,
  sentence_highlight_color_storage,
} from "@/libs/local_storage";
import { SentenceHighlightStorage, type SentenceHighlightData } from "@/libs/sentence_highlight_storage";
import { type WordData } from "@/libs/select_word";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

type Tab = "ai" | "word" | "sentence";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getWebsiteTitle(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname + (pathname !== "/" ? pathname : "");
  } catch {
    return url;
  }
}

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
  const [sentenceHighlights, setSentenceHighlights] = useState<SentenceHighlightData[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState("");
  const [websiteSearchQuery, setWebsiteSearchQuery] = useState("");
  const [sentenceHighlightColor, setSentenceHighlightColor] = useState(DEFAULT_SENTENCE_HIGHLIGHT_COLOR);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState("");
  const [dialogError, setDialogError] = useState(false);
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
        storedColor,
      ] = await Promise.all([
        options_tab_storage.getValue(),
        ai_api_url_storage.getValue(),
        ai_api_key_storage.getValue(),
        ai_model_storage.getValue(),
        ai_word_model_storage.getValue(),
        ai_prompt_storage.getValue(),
        collection_words_storage.getValue(),
        sentence_highlight_color_storage.getValue(),
      ]);
      const highlights = await SentenceHighlightStorage.getAllHighlights();
      if (!active) return;
      setTab((savedTab as Tab) || "ai");
      setApiUrl(storedApiUrl || "");
      setApiKey(storedApiKey || "");
      setModel(storedModel || "");
      setWordModel(storedWordModel || "");
      setPrompt(storedPrompt || "");
      setCollectionWords(storedWords || []);
      setSentenceHighlightColor(storedColor || DEFAULT_SENTENCE_HIGHLIGHT_COLOR);
      setSentenceHighlights(highlights);
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

  async function refreshHighlights() {
    const highlights = await SentenceHighlightStorage.getAllHighlights();
    setSentenceHighlights(highlights);
    if (selectedWebsite && !highlights.some((item) => item.url === selectedWebsite)) {
      setSelectedWebsite("");
    }
  }

  const websiteGroups = useMemo(() => {
    const groups = new Map<string, { title: string; url: string; highlights: SentenceHighlightData[] }>();
    sentenceHighlights.forEach((highlight) => {
      if (!groups.has(highlight.url)) {
        groups.set(highlight.url, {
          title: highlight.title || getWebsiteTitle(highlight.url),
          url: highlight.url,
          highlights: [],
        });
      }
      groups.get(highlight.url)!.highlights.push(highlight);
    });
    return [...groups.values()].sort((a, b) => {
      const aLatest = Math.max(...a.highlights.map((item) => item.timestamp));
      const bLatest = Math.max(...b.highlights.map((item) => item.timestamp));
      return bLatest - aLatest;
    });
  }, [sentenceHighlights]);

  const filteredWebsiteGroups = useMemo(() => {
    const query = websiteSearchQuery.trim().toLowerCase();
    if (!query) return websiteGroups;
    return websiteGroups.filter(
      (group) =>
        group.title.toLowerCase().includes(query) || group.url.toLowerCase().includes(query),
    );
  }, [websiteGroups, websiteSearchQuery]);

  const selectedWebsiteHighlights = useMemo(() => {
    return websiteGroups
      .find((group) => group.url === selectedWebsite)
      ?.highlights.slice()
      .sort((a, b) => b.timestamp - a.timestamp) || [];
  }, [selectedWebsite, websiteGroups]);

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
        ai_prompt_storage.setValue(prompt.trim() || null),
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

    setDialogOpen(true);
    setDialogContent("");
    setDialogError(false);
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
        messages: [{ role: "user", content: "你好，我想测试一下你是否可用！" }],
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

  async function handleSentenceHighlightColorChange(color: string) {
    setSentenceHighlightColor(color);
    await sentence_highlight_color_storage.setValue(color);
    notify("高亮颜色已保存");
  }

  async function handleResetSentenceHighlightColor() {
    setSentenceHighlightColor(DEFAULT_SENTENCE_HIGHLIGHT_COLOR);
    await sentence_highlight_color_storage.setValue(DEFAULT_SENTENCE_HIGHLIGHT_COLOR);
    notify("已恢复默认高亮颜色");
  }

  async function handleDeleteHighlight(id: string) {
    await SentenceHighlightStorage.removeHighlight(id);
    await refreshHighlights();
    notify("已删除高亮");
  }

  async function handleClearWebsiteHighlights() {
    if (!selectedWebsite || !window.confirm(`确定要清空 "${getWebsiteTitle(selectedWebsite)}" 的所有高亮吗？`)) {
      return;
    }
    await SentenceHighlightStorage.clearHighlights(selectedWebsite);
    await refreshHighlights();
    notify("已清空网站高亮");
  }

  async function handleClearAllHighlights() {
    if (!window.confirm("确定要清空所有句子高亮吗？此操作不可恢复。")) {
      return;
    }
    for (const highlight of sentenceHighlights) {
      await SentenceHighlightStorage.removeHighlight(highlight.id);
    }
    await refreshHighlights();
    notify("已清空所有高亮");
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("已复制到剪贴板");
    } catch {
      notify("复制失败", "error");
    }
  }

  function handleExportHighlights() {
    if (!sentenceHighlights.length) {
      notify("暂无可导出的高亮", "error");
      return;
    }
    const headers = ["网站", "句子", "时间", "颜色", "备注"];
    const csvContent = [
      headers.join(","),
      ...sentenceHighlights
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((highlight) =>
          [
            getWebsiteTitle(highlight.url),
            highlight.sentence,
            formatDate(highlight.timestamp),
            highlight.color || DEFAULT_SENTENCE_HIGHLIGHT_COLOR,
            highlight.note || "",
          ]
            .map((item) => `"${String(item).replace(/"/g, '""')}"`)
            .join(","),
        ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentence_highlights_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify(`已导出 ${sentenceHighlights.length} 个高亮`);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-4">

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

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="space-y-4">
          <TabsList className="w-full flex-wrap gap-1">
            <TabsTrigger value="ai">AI 翻译</TabsTrigger>
            <TabsTrigger value="word">生词本</TabsTrigger>
            <TabsTrigger value="sentence">句子高亮</TabsTrigger>
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
                  <label className="text-sm font-medium">Prompt</label>
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="如果不想使用默认，请输入自定义 Prompt" />
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

          <TabsContent value="word">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>生词本</CardTitle>
                    <CardDescription>共 {collectionWords.length} 个单词，可删除和导出。</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleExportWords} disabled={!collectionWords.length}>
                      导出 TXT
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!collectionWords.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                    暂无单词收藏。你可以在网页上选中单词后打开单词卡进行收藏。
                  </div>
                ) : (
                  <ScrollArea className="max-h-[34rem] space-y-3 pr-2">
                    <div className="space-y-3">
                      {collectionWords.map((word, idx) => (
                        <div key={`${word.word}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <div className="text-lg font-semibold">{word.word}</div>
                              <div className="text-sm text-slate-500">{word.pronunciation?.trim() || "—"}</div>
                              <div className="max-w-3xl text-sm leading-6 text-slate-600">{stripMeaning(word.meaning)}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteWord(idx)}>
                                删除
                              </Button>
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

          <TabsContent value="sentence">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>句子高亮</CardTitle>
                    <CardDescription>共 {sentenceHighlights.length} 个高亮，覆盖 {websiteGroups.length} 个网站。</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-500">
                      <span>高亮颜色</span>
                      <input
                        type="color"
                        value={sentenceHighlightColor}
                        onChange={(e) => handleSentenceHighlightColorChange(e.target.value)}
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-transparent"
                      />
                    </label>
                    <Button variant="outline" size="sm" onClick={handleResetSentenceHighlightColor}>
                      恢复默认颜色
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportHighlights} disabled={!sentenceHighlights.length}>
                      导出
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClearAllHighlights} disabled={!sentenceHighlights.length}>
                      清空
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!sentenceHighlights.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                    暂无句子高亮。在网页选中句子并执行高亮后，这里会自动汇总。
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <Input
                        value={websiteSearchQuery}
                        onChange={(e) => setWebsiteSearchQuery(e.target.value)}
                        placeholder="搜索网站..."
                      />
                      <ScrollArea className="max-h-[34rem] space-y-2 pr-2">
                        <div className="space-y-2">
                          {filteredWebsiteGroups.map((group) => (
                            <button
                              key={group.url}
                              type="button"
                              onClick={() => setSelectedWebsite(group.url)}
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                selectedWebsite === group.url
                                  ? "border-sky-300 bg-sky-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="font-medium">{group.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{group.url}</div>
                              <div className="mt-2 text-xs text-slate-400">{group.highlights.length} 个高亮</div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <div>
                      {!selectedWebsite ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                          请选择左侧网站查看高亮详情。
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold">{getWebsiteTitle(selectedWebsite)}</h3>
                              <p className="text-sm text-slate-500">{selectedWebsite}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => window.open(selectedWebsite, "_blank")}>
                                打开网页
                              </Button>
                              <Button variant="destructive" size="sm" onClick={handleClearWebsiteHighlights}>
                                清空网站高亮
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="max-h-[34rem] space-y-3 pr-2">
                            <div className="space-y-3">
                              {selectedWebsiteHighlights.map((highlight) => (
                                <div key={highlight.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="space-y-2">
                                      <p className="text-sm leading-6 text-slate-700">{highlight.sentence}</p>
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                        <span>{formatDate(highlight.timestamp)}</span>
                                        <span>{highlight.color || DEFAULT_SENTENCE_HIGHLIGHT_COLOR}</span>
                                        {highlight.note ? <span>{highlight.note}</span> : null}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(highlight.sentence)}>
                                        复制
                                      </Button>
                                      <Button variant="destructive" size="sm" onClick={() => handleDeleteHighlight(highlight.id)}>
                                        删除
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
            {dialogContent || "等待响应..."}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
