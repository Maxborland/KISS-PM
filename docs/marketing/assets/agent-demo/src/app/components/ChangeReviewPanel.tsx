import { X, CheckCircle2, CheckSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { ChangeHunk } from "./landingAgentDemoScenario";
import { ChangeHunkCard } from "./ChangeHunkCard";

interface ChangeReviewPanelProps {
  changes: ChangeHunk[];
  setChanges: React.Dispatch<React.SetStateAction<ChangeHunk[]>>;
  onApply: () => void;
  isApplying: boolean;
  isApplied: boolean;
  onClose?: () => void;
}

export function ChangeReviewPanel({ changes, setChanges, onApply, isApplying, isApplied, onClose }: ChangeReviewPanelProps) {
  const selectedCount = changes.filter(c => c.selected && c.status !== 'rejected').length;
  const appliedCount = changes.filter(c => c.status === 'applied').length;
  
  const handleUpdateChange = (id: string, updates: Partial<ChangeHunk>) => {
    setChanges(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const hasPendingChanges = selectedCount > 0 && !isApplied;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="h-14 border-b border-gray-100 flex items-center justify-between px-5 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-gray-900">Сверка</span>
          {!isApplied && (
            <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {changes.length} изменений
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 -mr-2 text-gray-400 hover:text-gray-900 lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 scroll-smooth">
        <div className="flex flex-col gap-3">
          {changes.map(change => (
            <ChangeHunkCard key={change.id} change={change} onUpdate={handleUpdateChange} />
          ))}
        </div>
      </div>

      <div className="p-5 border-t border-gray-100 bg-white shrink-0">
        {isApplied ? (
          <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 py-3 rounded-xl border border-green-100 font-medium text-[13px]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Запись в журнале создана</span>
          </div>
        ) : (
          <button
            onClick={onApply}
            disabled={!hasPendingChanges || isApplying}
            className={cn(
              "w-full py-3 rounded-xl font-medium text-[13px] transition-all flex items-center justify-center gap-2",
              hasPendingChanges && !isApplying
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {isApplying ? "Применяем..." : `Применить выбранное (${selectedCount})`}
          </button>
        )}
      </div>
    </div>
  );
}
