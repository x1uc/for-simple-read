import { useEffect, useRef, useState } from "react";
import { OpenAI } from "openai";

import type { EventManager } from "@/libs/event_manager";
import {
  ai_api_key_storage,
  ai_api_url_storage,
  ai_word_model_storage,
  collection_words_storage,
} from "@/libs/local_storage";
import type { SelectInfo, WordData } from "@/libs/select_word";

type SelectedWordStore = {
  getValue: () => Promise<SelectInfo | null>;
};

type WordCardProps = {
  eventManager: EventManager;
  selectedWordStore: SelectedWordStore;
  cachedWordData?: WordData | null;
};

const defaultPrompt = `
You are an assistant that extracts dictionary-like information.

I will give you a word and its context.  
Return the result strictly as a JSON object with the following TypeScript type:

export type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};

Rules:
- Do not include anything outside the JSON.
- "word": exactly the given word.
- "pronunciation": return the phonetic transcription in IPA if possible (e.g., "/wɜːd/"), otherwise leave it as an empty string.
- "meaning": give the chinese meaning of the word in the provided context, concise but clear.just the word meaning, don't include context, this is important.
`;

export default function WordCard({
  eventManager,
  selectedWordStore,
  cachedWordData = null,
}: WordCardProps) {
  const [loading, setLoading] = useState(true);
  const [wordData, setWordData] = useState<WordData | null>(cachedWordData);
  const [isCollected, setIsCollected] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (cachedWordData) {
        setWordData(cachedWordData);
        const storedWords = (await collection_words_storage.getValue()) || [];
        if (active) {
          setIsCollected(storedWords.some((item) => item.word === cachedWordData.word));
          setLoading(false);
        }
        return;
      }

      const [apiKey, apiUrl, model, selected] = await Promise.all([
        ai_api_key_storage.getValue(),
        ai_api_url_storage.getValue(),
        ai_word_model_storage.getValue(),
        selectedWordStore.getValue(),
      ]);

      if (!selected?.word) {
        if (active) {
          setWordData({ word: "Error", pronunciation: "", meaning: "未找到当前选中的单词。" });
          setLoading(false);
        }
        return;
      }

      if (!apiKey || !apiUrl || !model) {
        if (active) {
          setWordData({
            word: "Error",
            pronunciation: "",
            meaning: "Please set your OpenAI API configuration in the settings.",
          });
          setLoading(false);
        }
        return;
      }

      try {
        const openai = new OpenAI({
          apiKey,
          baseURL: apiUrl,
          dangerouslyAllowBrowser: true,
        });
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: defaultPrompt },
            { role: "user", content: `Word: ${selected.word} Context: ${selected.context}` },
          ],
          response_format: { type: "json_object" },
          ...(model.includes("deepseek") ? { thinking: { "type": "disabled" } } : {}),
        });
        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(content || "{}") as WordData;
        const storedWords = (await collection_words_storage.getValue()) || [];

        if (active) {
          setWordData(parsed);
          setIsCollected(storedWords.some((item) => item.word === parsed.word));
        }
      } catch (error) {
        if (active) {
          console.error("Word lookup error:", error);
          setWordData({
            word: selected.word,
            pronunciation: "",
            meaning: "请求查词接口失败，请检查配置和网络。",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [cachedWordData, selectedWordStore]);

  async function handleCollect() {
    if (!wordData || isCollected) return;
    const storedWords = (await collection_words_storage.getValue()) || [];
    await collection_words_storage.setValue([...storedWords, wordData]);
    setIsCollected(true);
  }

  async function handleHighlight() {
    if (!wordData?.word) return;
    if (!isCollected) {
      const storedWords = (await collection_words_storage.getValue()) || [];
      await collection_words_storage.setValue([...storedWords, wordData]);
      setIsCollected(true);
    }
    eventManager.emit("highlight-word", {
      word: wordData.word,
      wordData,
    });
    eventManager.emit("close-word-card");
  }

  function playAudio() {
    if (!wordData?.word) return;

    const fallbackToRemoteAudio = () => {
      const audio = new Audio(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(wordData.word)}&type=2`,
      );
      audioRef.current = audio;
      audio.play().catch((error) => {
        console.error("Audio playback failed:", error);
      });
    };

    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      fallbackToRemoteAudio();
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(wordData.word);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (voice) => voice.lang.toLowerCase().startsWith("en") && !voice.localService,
      ) || voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onerror = () => {
        fallbackToRemoteAudio();
      };

      synth.speak(utterance);
    } catch (error) {
      console.error("Speech synthesis failed:", error);
      fallbackToRemoteAudio();
    }
  }

  return (
    <div className="min-w-[360px] max-w-[480px] rounded-[10px] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
      {loading ? (
        <div className="space-y-3">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">{wordData?.word}</div>
              <button
                type="button"
                onClick={playAudio}
                className="mt-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {wordData?.pronunciation || "点击发音"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                title="高亮并收藏"
                onClick={handleHighlight}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium transition hover:border-amber-300 hover:bg-amber-50"
              >
                高亮并收藏
              </button>
              <button
                type="button"
                title="收藏"
                onClick={handleCollect}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  isCollected
                    ? "bg-amber-100 text-amber-700"
                    : "border border-slate-200 hover:border-sky-300 hover:bg-sky-50"
                }`}
              >
                {isCollected ? "已收藏" : "收藏"}
              </button>
            </div>
          </div>
          <div
            className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
            dangerouslySetInnerHTML={{ __html: wordData?.meaning || "暂无释义" }}
          />
        </div>
      )}
    </div>
  );
}
