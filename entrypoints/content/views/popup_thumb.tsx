import type { EventManager } from "@/libs/event_manager";

type PopupThumbProps = {
  eventManager: EventManager;
};

function ActionButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 ${tone}`}
    >
      {label}
    </button>
  );
}

export default function PopupThumb({ eventManager }: PopupThumbProps) {
  return (
    <div className="flex min-w-[210px] gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur">
      <ActionButton
        label="单词"
        tone="hover:border-sky-300 hover:bg-sky-50"
        onClick={() => eventManager.emit("show-word-card")}
      />
      <ActionButton
        label="翻译"
        tone="hover:border-emerald-300 hover:bg-emerald-50"
        onClick={() => eventManager.emit("show-ai-trans-card")}
      />
      <ActionButton
        label="高亮"
        tone="hover:border-amber-300 hover:bg-amber-50"
        onClick={() => eventManager.emit("highlight-sentence")}
      />
    </div>
  );
}
