import { options_tab_storage } from "@/libs/local_storage";
import { Button } from "@/src/components/ui/button";

async function openOptionsTab(tabName: "ai" | "word") {
  if (tabName) {
    await options_tab_storage.setValue(tabName);
  }
  browser.runtime.openOptionsPage();
}

export default function App() {
  return (
    <main className="box-border w-[240px] select-none p-2.5 bg-slate-100/90 border border-slate-200/90 rounded-none">
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-10 w-full rounded-none border-slate-300/90 bg-white text-sm font-medium text-slate-900 shadow-2xs hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all"
          onClick={() => openOptionsTab("ai")}
        >
          翻译配置
        </Button>
        <Button
          variant="outline"
          className="h-10 w-full rounded-none border-slate-300/90 bg-white text-sm font-medium text-slate-900 shadow-2xs hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all"
          onClick={() => openOptionsTab("word")}
        >
          生词本
        </Button>
      </div>
    </main>
  );
}
