import { useState } from "react";
import { Check, X, Edit2 } from "lucide-react";
import { cn } from "../lib/utils";
import { ChangeHunk, ChangeStatus } from "./landingAgentDemoScenario";
import * as Checkbox from "@radix-ui/react-checkbox";

interface ChangeHunkCardProps {
  change: ChangeHunk;
  onUpdate: (id: string, updates: Partial<ChangeHunk>) => void;
}

export function ChangeHunkCard({ change, onUpdate }: ChangeHunkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(change.after);

  const handleSaveEdit = () => {
    onUpdate(change.id, { after: editValue, status: 'modified' });
    setIsEditing(false);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(change.id, { status: 'rejected', selected: false });
  };

  const toggleSelect = () => {
    if (change.status === 'rejected' || change.status === 'applied') return;
    onUpdate(change.id, { selected: !change.selected });
  };

  const renderStatus = (status: ChangeStatus) => {
    switch (status) {
      case 'modified': return <div className="text-[10px] uppercase font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Изменено</div>;
      case 'rejected': return <div className="text-[10px] uppercase font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Отклонено</div>;
      case 'applied': return <div className="text-[10px] uppercase font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Применено</div>;
      default: return null;
    }
  };

  return (
    <div 
      className={cn(
        "relative rounded-xl border p-3.5 transition-colors text-[13px] bg-white",
        change.status === 'applied' ? "border-green-100 bg-green-50/30" :
        change.status === 'rejected' ? "border-gray-200 opacity-60 bg-gray-50" :
        change.selected ? "border-blue-200 shadow-sm" : "border-gray-200 hover:border-gray-300"
      )}
      onClick={() => {
        if (!isEditing) toggleSelect();
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Checkbox.Root
            checked={change.selected}
            disabled={change.status === 'rejected' || change.status === 'applied'}
            onCheckedChange={toggleSelect}
            className={cn(
              "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors outline-none",
              change.selected 
                ? "bg-blue-600 border-blue-600 text-white" 
                : "border-gray-300 bg-white"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox.Indicator>
              <Check className="w-3 h-3" />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <span className="font-semibold text-gray-900">{change.field}</span>
          {renderStatus(change.status)}
        </div>

        {change.status !== 'applied' && change.status !== 'rejected' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Изменить"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleReject}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Отклонить"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <div className="text-gray-400 text-right text-[12px]">Было:</div>
        <div className="text-gray-500 line-through decoration-red-300/50">{change.before}</div>
        
        <div className="text-gray-400 text-right text-[12px] pt-0.5">Стало:</div>
        <div>
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {change.type === 'select' && change.options ? (
                <select 
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full border border-blue-300 rounded-md px-2 py-1 outline-none text-[13px] bg-white text-gray-900 focus:ring-2 focus:ring-blue-100"
                >
                  {change.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : change.type === 'date' ? (
                <input 
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full border border-blue-300 rounded-md px-2 py-1 outline-none text-[13px] text-gray-900 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <input 
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full border border-blue-300 rounded-md px-2 py-1 outline-none text-[13px] text-gray-900 focus:ring-2 focus:ring-blue-100"
                />
              )}
              <button onClick={handleSaveEdit} className="text-blue-600 hover:text-blue-700 p-1 shrink-0">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className={cn(
              "font-medium",
              change.status === 'rejected' ? "text-gray-400" : "text-green-700"
            )}>
              {change.after}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
