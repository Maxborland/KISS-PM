import { Bot, Folder, CheckSquare, Users, Calendar, PieChart, Settings } from "lucide-react";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { icon: Bot, label: "Агент", active: true },
  { icon: Folder, label: "Проекты" },
  { icon: CheckSquare, label: "Задачи" },
  { icon: Users, label: "Ресурсы" },
  { icon: Calendar, label: "Сроки" },
  { icon: PieChart, label: "Отчеты" },
];

export function CollapsedAppNav({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className={cn(
      "h-full border-r border-gray-100 bg-white flex flex-col py-4 shrink-0 transition-all",
      expanded ? "w-56" : "w-14 items-center"
    )}>
      <div className={cn("flex flex-col gap-2 flex-1", expanded ? "px-3" : "px-2")}>
        {NAV_ITEMS.map((item, i) => (
          <button 
            key={i}
            className={cn(
              "flex items-center gap-3 rounded-lg transition-colors group",
              expanded ? "px-3 py-2 w-full" : "w-10 h-10 justify-center",
              item.active 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
            title={!expanded ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {expanded && <span className="font-medium text-[13px]">{item.label}</span>}
          </button>
        ))}
      </div>
      
      <div className={cn("mt-auto", expanded ? "px-3" : "px-2")}>
        <button 
          className={cn(
            "flex items-center gap-3 rounded-lg transition-colors text-gray-500 hover:bg-gray-50 hover:text-gray-900 group",
            expanded ? "px-3 py-2 w-full" : "w-10 h-10 justify-center"
          )}
          title={!expanded ? "Настройки" : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {expanded && <span className="font-medium text-[13px]">Настройки</span>}
        </button>
      </div>
    </div>
  );
}
