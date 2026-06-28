import { MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";

const HISTORY = [
  { label: "План недели", active: false },
  { label: "Задержка дизайна", active: true },
  { label: "Риски перед звонком", active: false },
  { label: "Передача проекта", active: false },
];

export function AgentConversationList() {
  return (
    <div className="flex-1 flex flex-col pt-5">
      <div className="px-5 mb-4 font-medium text-gray-900 text-sm">
        История
      </div>
      <div className="flex flex-col gap-0.5 px-3">
        {HISTORY.map((item, i) => (
          <button
            key={i}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg text-left transition-colors",
              item.active 
                ? "bg-white border border-gray-100 shadow-sm text-gray-900 font-medium" 
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <MessageSquare className={cn("w-4 h-4 shrink-0", item.active ? "text-blue-500" : "text-gray-400")} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
