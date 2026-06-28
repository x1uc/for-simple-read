import type { ReactNode } from "react";
import type { EventManager } from "@/libs/event_manager";

type PopupThumbProps = {
  eventManager: EventManager;
};

function ActionButton({
  title,
  children,
  tone,
  onClick,
}: {
  title: string;
  children: ReactNode;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 ${tone}`}
    >
      {children}
    </button>
  );
}

export default function PopupThumb({ eventManager }: PopupThumbProps) {
  return (
    <div className="flex h-9 items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/90 p-0.5 shadow-[0_6px_16px_rgba(15,23,42,0.12)] backdrop-blur">
      <ActionButton
        title="单词"
        tone="hover:bg-sky-50 hover:text-sky-700"
        onClick={() => eventManager.emit("show-word-card")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h5" />
        </svg>
      </ActionButton>
      <ActionButton
        title="翻译"
        tone="hover:bg-emerald-50 hover:text-emerald-700"
        onClick={() => eventManager.emit("show-ai-trans-card")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m14 22 5-10 3 10" />
          <path d="M15.5 18h5" />
        </svg>
      </ActionButton>
    </div>
  );
}
