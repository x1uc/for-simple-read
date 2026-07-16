import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { EventManager } from "@/libs/event_manager";
import { DEFAULT_TRANSLATION_PROMPT } from "@/libs/ai_prompts";
import { ai_api_key_storage, ai_api_url_storage, ai_model_storage, ai_prompt_storage, ai_trans_card_size_storage } from "@/libs/local_storage";
import type { SelectInfo } from "@/libs/select_word";
import { streamLlmChatCompletion } from "@/libs/llm_proxy";

type SelectedWordStore = {
  getValue: () => Promise<SelectInfo | null>;
};

type AITransCardProps = {
  eventManager: EventManager;
  selectedWordStore: SelectedWordStore;
  initialPinned?: boolean;
};

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 120;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 220;
const EDGE = 6; // px — thickness of invisible resize strips

const cursorMap: Record<ResizeDir, string> = {
  n: "cursor-n-resize",
  s: "cursor-s-resize",
  e: "cursor-e-resize",
  w: "cursor-w-resize",
  ne: "cursor-ne-resize",
  nw: "cursor-nw-resize",
  se: "cursor-se-resize",
  sw: "cursor-sw-resize",
};

export default function AITransCard({
  eventManager,
  selectedWordStore,
  initialPinned = false,
}: AITransCardProps) {
  const [content, setContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDir | null>(null);
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [cardWidth, setCardWidth] = useState(DEFAULT_WIDTH);
  const [cardHeight, setCardHeight] = useState(DEFAULT_HEIGHT);

  const cardRef = useRef<HTMLDivElement | null>(null);

  // drag-move refs
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const dragStartLeft = useRef(0);
  const dragStartTop = useRef(0);
  const lastLeft = useRef(0);
  const lastTop = useRef(0);
  const draggingRef = useRef(false);

  // resize refs
  const resizingRef = useRef(false);
  const resizeDirRef = useRef<ResizeDir>("se");
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartRect = useRef({ left: 0, top: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  useEffect(() => {
    let active = true;

    async function translate() {
      const [apiKey, apiUrl, model, customPrompt, selection] = await Promise.all([
        ai_api_key_storage.getValue(),
        ai_api_url_storage.getValue(),
        ai_model_storage.getValue(),
        ai_prompt_storage.getValue(),
        selectedWordStore.getValue(),
      ]);

      if (!apiKey) { setContent("请先在选项页配置 AI API Key"); return; }
      if (!apiUrl) { setContent("请先在选项页配置 AI API URL"); return; }
      if (!model)  { setContent("请先在选项页配置 AI 模型"); return; }

      try {
        const stream = streamLlmChatCompletion({
          apiKey,
          apiUrl,
          body: {
            model,
            messages: [
              { role: "system", content: customPrompt || DEFAULT_TRANSLATION_PROMPT },
              { role: "user", content: selection?.word || "" },
            ],
            ...(model.includes("deepseek") ? { thinking: { type: "disabled" } } : {}),
          },
        });

        for await (const chunk of stream) {
          const nowText = chunk.choices[0]?.delta?.content;
          if (active && nowText) setContent((v) => v + nowText);
        }
      } catch (error) {
        if (active) {
          console.error("AI translation error:", error);
          setContent(error instanceof Error ? error.message : "请求 AI 翻译接口失败");
        }
      }
    }

    function handlePinSync(pinned: boolean) { setIsPinned(Boolean(pinned)); }

    // load persisted size
    ai_trans_card_size_storage.getValue().then((saved) => {
      if (saved) {
        setCardWidth(saved.width);
        setCardHeight(saved.height);
      }
    });

    translate();
    eventManager.on("ai-trans-card-apply-pin", handlePinSync);

    return () => {
      active = false;
      eventManager.off("ai-trans-card-apply-pin", handlePinSync);
      stopDragging();
      stopResizing();
    };
  }, [eventManager, selectedWordStore]);

  // ── drag-move ──────────────────────────────────────────────
  function onPointerMove(event: PointerEvent) {
    if (!draggingRef.current) return;
    const deltaX = event.clientX - pointerStartX.current;
    const deltaY = event.clientY - pointerStartY.current;
    lastLeft.current = dragStartLeft.current + deltaX;
    lastTop.current = dragStartTop.current + deltaY;
    eventManager.emit("ai-trans-card-position-change", {
      left: lastLeft.current,
      top: lastTop.current,
      dragging: true,
    });
  }

  function stopDragging() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
    eventManager.emit("ai-trans-card-position-change", {
      left: lastLeft.current || dragStartLeft.current,
      top: lastTop.current || dragStartTop.current,
      dragging: false,
    });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    event.preventDefault();

    pointerStartX.current = event.clientX;
    pointerStartY.current = event.clientY;

    const rect = cardRef.current?.getBoundingClientRect();
    dragStartLeft.current = rect?.left || 0;
    dragStartTop.current = rect?.top || 0;
    lastLeft.current = dragStartLeft.current;
    lastTop.current = dragStartTop.current;
    draggingRef.current = true;
    setIsDragging(true);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  }

  // ── resize ─────────────────────────────────────────────────
  function onResizePointerMove(event: PointerEvent) {
    if (!resizingRef.current) return;
    const dx = event.clientX - resizeStartX.current;
    const dy = event.clientY - resizeStartY.current;
    const { left, top, width, height } = resizeStartRect.current;
    const dir = resizeDirRef.current;

    let newW = width;
    let newH = height;
    let newL = left;
    let newT = top;

    if (dir.includes("e")) newW = Math.max(MIN_WIDTH, width + dx);
    if (dir.includes("s")) newH = Math.max(MIN_HEIGHT, height + dy);
    if (dir.includes("w")) {
      newW = Math.max(MIN_WIDTH, width - dx);
      newL = left + width - newW;
    }
    if (dir.includes("n")) {
      newH = Math.max(MIN_HEIGHT, height - dy);
      newT = top + height - newH;
    }

    setCardWidth(newW);
    setCardHeight(newH);

    // emit position update only when left/top actually changes (w or n edge)
    if (dir.includes("w") || dir.includes("n")) {
      lastLeft.current = newL;
      lastTop.current = newT;
      eventManager.emit("ai-trans-card-position-change", { left: newL, top: newT, dragging: true });
    }
  }

  function stopResizing() {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    setIsResizing(false);
    setResizeDir(null);
    window.removeEventListener("pointermove", onResizePointerMove);
    window.removeEventListener("pointerup", stopResizing);
    window.removeEventListener("pointercancel", stopResizing);
    // finalise position
    eventManager.emit("ai-trans-card-position-change", {
      left: lastLeft.current,
      top: lastTop.current,
      dragging: false,
    });
    // persist size
    const w = cardRef.current?.offsetWidth ?? resizeStartRect.current.width;
    const h = cardRef.current?.offsetHeight ?? resizeStartRect.current.height;
    ai_trans_card_size_storage.setValue({ width: w, height: h });
  }

  function makeResizeHandler(dir: ResizeDir) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = cardRef.current?.getBoundingClientRect();
      resizeStartX.current = event.clientX;
      resizeStartY.current = event.clientY;
      resizeStartRect.current = {
        left: rect?.left ?? 0,
        top: rect?.top ?? 0,
        width: rect?.width ?? cardWidth,
        height: rect?.height ?? cardHeight,
      };
      // prime lastLeft/lastTop so stopResizing can emit final position
      lastLeft.current = rect?.left ?? 0;
      lastTop.current = rect?.top ?? 0;

      resizeDirRef.current = dir;
      resizingRef.current = true;
      setIsResizing(true);
      setResizeDir(dir);

      window.addEventListener("pointermove", onResizePointerMove);
      window.addEventListener("pointerup", stopResizing);
      window.addEventListener("pointercancel", stopResizing);
    };
  }

  // ── pin / close ────────────────────────────────────────────
  function togglePin() {
    const next = !isPinned;
    setIsPinned(next);
    eventManager.emit("ai-trans-card-pin-state-change", next);
  }

  function closeCard() {
    if (isPinned) {
      setIsPinned(false);
      eventManager.emit("ai-trans-card-pin-state-change", false);
    }
    eventManager.emit("close-ai-trans-card");
  }

  const activeCursor = isResizing && resizeDir ? cursorMap[resizeDir] : "";

  return (
    <div
      ref={cardRef}
      className={`overflow-hidden rounded-[10px] border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.16)] flex flex-col relative select-none ${activeCursor}`}
      style={{ width: cardWidth, height: cardHeight }}
    >
      {/* ── edge resize handles ── */}
      {/* top */}
      <div className="absolute top-0 left-[8px] right-[8px] cursor-n-resize z-30" style={{ height: EDGE }} onPointerDown={makeResizeHandler("n")} />
      {/* bottom */}
      <div className="absolute bottom-0 left-[8px] right-[8px] cursor-s-resize z-30" style={{ height: EDGE }} onPointerDown={makeResizeHandler("s")} />
      {/* left */}
      <div className="absolute left-0 top-[8px] bottom-[8px] cursor-w-resize z-30" style={{ width: EDGE }} onPointerDown={makeResizeHandler("w")} />
      {/* right */}
      <div className="absolute right-0 top-[8px] bottom-[8px] cursor-e-resize z-30" style={{ width: EDGE }} onPointerDown={makeResizeHandler("e")} />

      {/* ── corner resize handles (on top of edges) ── */}
      <div className="absolute top-0 left-0 cursor-nw-resize z-40" style={{ width: 12, height: 12 }} onPointerDown={makeResizeHandler("nw")} />
      <div className="absolute top-0 right-0 cursor-ne-resize z-40" style={{ width: 12, height: 12 }} onPointerDown={makeResizeHandler("ne")} />
      <div className="absolute bottom-0 left-0 cursor-sw-resize z-40" style={{ width: 12, height: 12 }} onPointerDown={makeResizeHandler("sw")} />
      <div className="absolute bottom-0 right-0 cursor-se-resize z-40" style={{ width: 12, height: 12 }} onPointerDown={makeResizeHandler("se")} />

      {/* header / drag handle */}
      <div
        className={`relative z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-1 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
      >
        <div className="text-sm font-semibold">AI 翻译</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={togglePin}
            title={isPinned ? "取消固定" : "固定窗口"}
            aria-label={isPinned ? "取消固定" : "固定窗口"}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition ${isPinned ? "bg-sky-100 text-sky-700" : "border border-slate-200 hover:bg-slate-100"}`}
          >
            {isPinned ? "已固定" : "固定"}
          </button>
          <button
            type="button"
            onClick={closeCard}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium transition hover:bg-slate-100"
          >
            关闭
          </button>
        </div>
      </div>

      {/* content area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
        {content ? (
          <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="space-y-3">
            <div className="h-4 w-5/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-8/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-6/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-7/12 animate-pulse rounded bg-slate-100" />
          </div>
        )}
      </div>
    </div>
  );
}
