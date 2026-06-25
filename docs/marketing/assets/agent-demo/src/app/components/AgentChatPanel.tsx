import { useEffect, useRef } from "react";
import { ArrowUp, Bot } from "lucide-react";
import { cn } from "../lib/utils";
import { MessageType } from "./LandingAgentDemo";
import { AgentActivitySteps } from "./AgentActivitySteps";
import { motion, AnimatePresence } from "motion/react";

interface AgentChatPanelProps {
  messages: MessageType[];
  inputDraft: string;
  setInputDraft: (val: string) => void;
  onSend: () => void;
  isThinking: boolean;
}

export function AgentChatPanel({ messages, inputDraft, setInputDraft, onSend, isThinking }: AgentChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 scroll-smooth"
      >
        <div className="max-w-[700px] mx-auto flex flex-col gap-6">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex gap-4 w-full",
                  msg.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.sender === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-blue-600 text-xs font-bold">ГГ</span>
                  </div>
                )}
                
                <div className={cn(
                  "flex flex-col gap-1 max-w-[85%]",
                  msg.sender === "user" ? "items-end" : "items-start"
                )}>
                  {msg.isThinking && msg.activitySteps ? (
                    <AgentActivitySteps steps={msg.activitySteps} />
                  ) : msg.isAudit ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {msg.text}
                    </div>
                  ) : (
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed",
                      msg.sender === "user" 
                        ? "bg-gray-100 text-gray-900 rounded-br-none" 
                        : "bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm"
                    )}>
                      {msg.text}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-4 sm:px-6">
        <div className="max-w-[700px] mx-auto relative">
          <div className="relative shadow-[0_2px_12px_rgb(0,0,0,0.06)] rounded-2xl border border-gray-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all overflow-hidden">
            <textarea
              value={inputDraft}
              onChange={(e) => setInputDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросите Генри или попросите изменить проект..."
              className="w-full max-h-[150px] min-h-[56px] py-4 pl-4 pr-14 resize-none outline-none text-[14px] bg-transparent"
              rows={1}
              disabled={isThinking}
            />
            <button
              onClick={onSend}
              disabled={!inputDraft.trim() || isThinking}
              className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white flex items-center justify-center transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2.5 text-[11px] text-gray-400">
            Генри может ошибаться. Проверяйте важные изменения.
          </div>
        </div>
      </div>
    </div>
  );
}
