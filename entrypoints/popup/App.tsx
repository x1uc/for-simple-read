import { options_tab_storage } from "@/libs/local_storage";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

type PopupAction = {
  id: "ai" | "word";
  title: string;
  description: string;
  icon: string;
};

const actions: PopupAction[] = [
  { id: "ai", title: "AI 翻译", description: "配置翻译模型与接口", icon: "AI" },
  { id: "word", title: "生词本", description: "查看与导出已收藏单词", icon: "WB" },
];

async function openOptionsTab(tabName?: PopupAction["id"]) {
  if (tabName) {
    await options_tab_storage.setValue(tabName);
  }
  browser.runtime.openOptionsPage();
}

export default function App() {
  return (
    <main className="w-[360px] p-3 text-slate-900">
      <Card className="overflow-hidden border-sky-100/80 bg-white/95">
        <CardContent className="grid grid-cols-2 gap-3 p-3">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => openOptionsTab(action.id)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/60"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-white">
                {action.icon}
              </div>
              <div className="text-sm font-semibold">{action.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
