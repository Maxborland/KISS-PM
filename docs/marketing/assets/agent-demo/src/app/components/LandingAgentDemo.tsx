import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { CollapsedAppNav } from "./CollapsedAppNav";
import { AgentConversationList } from "./AgentConversationList";
import { AgentChatPanel } from "./AgentChatPanel";
import { ChangeReviewPanel } from "./ChangeReviewPanel";
import { INITIAL_CHANGES, ChangeHunk, THINKING_STEPS } from "./landingAgentDemoScenario";
import { AgentStatusMenu } from "./AgentStatusMenu";
import { Menu, Settings, X } from "lucide-react";

export type MessageType = {
  id: string;
  sender: "user" | "agent";
  text?: string;
  isThinking?: boolean;
  activitySteps?: { label: string; status: "pending" | "active" | "done" }[];
  isAudit?: boolean;
};

export function LandingAgentDemo() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputDraft, setInputDraft] = useState("Генри, проверь задержку по дизайну и подготовь план на неделю.");
  const [changes, setChanges] = useState<ChangeHunk[]>(INITIAL_CHANGES);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const [demoState, setDemoState] = useState<"initial" | "thinking" | "review" | "applying" | "applied" | "second_thinking">("initial");
  
  // Mobile drawer states
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileReviewOpen, setIsMobileReviewOpen] = useState(false);

  const handleSend = () => {
    if (!inputDraft.trim()) return;
    
    const newUserMsg: MessageType = { id: Date.now().toString(), sender: "user", text: inputDraft };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputDraft("");

    if (demoState === "initial") {
      setDemoState("thinking");
      startThinkingSequence(1);
    } else if (demoState === "applied") {
      setDemoState("second_thinking");
      startThinkingSequence(2);
    }
  };

  const startThinkingSequence = (round: number) => {
    const activityMsgId = Date.now().toString() + "_act";
    setMessages((prev) => [
      ...prev,
      {
        id: activityMsgId,
        sender: "agent",
        isThinking: true,
        activitySteps: THINKING_STEPS.map((step, i) => ({
          label: step,
          status: i === 0 ? "active" : "pending"
        }))
      }
    ]);

    // Simulate thinking steps progression
    let currentStep = 0;
    const interval = setInterval(() => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === activityMsgId && msg.activitySteps) {
            const newSteps = msg.activitySteps.map((step, i) => {
              if (i < currentStep) return { ...step, status: "done" };
              if (i === currentStep) return { ...step, status: "active" };
              return step;
            });
            return { ...msg, activitySteps: newSteps as any };
          }
          return msg;
        })
      );
      
      currentStep++;
      if (currentStep > THINKING_STEPS.length) {
        clearInterval(interval);
        // End of thinking
        setMessages((prev) => {
          const finished = prev.map((msg) => {
            if (msg.id === activityMsgId && msg.activitySteps) {
              return { ...msg, isThinking: false, activitySteps: msg.activitySteps.map(s => ({ ...s, status: "done" })) };
            }
            return msg;
          });
          
          if (round === 1) {
            finished.push({
              id: Date.now().toString() + "_reply",
              sender: "agent",
              text: "Проверил. Задержка затронула две задачи и клиентскую демонстрацию. Подготовил сверку из 5 изменений."
            });
          } else {
            finished.push({
              id: Date.now().toString() + "_reply",
              sender: "agent",
              text: "Второй запрос обработан. Жду дальнейших указаний."
            });
          }
          
          return finished;
        });

        if (round === 1) {
          setDemoState("review");
          setIsReviewPanelOpen(true);
        }
      }
    }, 800);
  };

  const handleApplyChanges = () => {
    setDemoState("applying");
    
    setTimeout(() => {
      const selectedCount = changes.filter(c => c.selected && c.status !== 'rejected').length;
      const rejectedCount = changes.filter(c => c.status === 'rejected').length;
      
      setChanges(prev => prev.map(c => 
        (c.selected && c.status !== 'rejected') ? { ...c, status: 'applied' } : c
      ));
      
      setDemoState("applied");
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + "_audit",
          sender: "agent",
          isAudit: true,
          text: `${selectedCount} изменения применены · запись в журнале создана`
        },
        {
          id: Date.now().toString() + "_final",
          sender: "agent",
          text: `Готово. Применил ${selectedCount} изменения и оставил запись в журнале.` + (rejectedCount > 0 ? ` Отклонено: ${rejectedCount}.` : '')
        }
      ]);

      if (window.innerWidth < 1024) {
        setIsMobileReviewOpen(false); // Close review drawer on mobile after applying
      }
    }, 1200);
  };

  const handleToggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
    if (isMobileReviewOpen) setIsMobileReviewOpen(false);
  };

  const handleToggleMobileReview = () => {
    setIsMobileReviewOpen(!isMobileReviewOpen);
    if (isMobileNavOpen) setIsMobileNavOpen(false);
  };

  return (
    <div className="w-full max-w-[1280px] h-[760px] max-h-[90vh] bg-white rounded-2xl shadow-2xl shadow-gray-200/40 border border-gray-100 flex overflow-hidden relative text-[14px]">
      
      {/* Mobile Header (Visible only on lg and down) */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-20">
        <button onClick={handleToggleMobileNav} className="p-2 -ml-2 text-gray-500 hover:text-gray-900">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 font-medium">
          <AgentStatusMenu />
        </div>
        {demoState !== "initial" && demoState !== "thinking" ? (
          <button onClick={handleToggleMobileReview} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md">
            Сверка
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Main layout container (desktop flex, mobile full width chat) */}
      <div className="flex w-full h-full pt-14 lg:pt-0">
        
        {/* Left Nav (Desktop) */}
        <div className="hidden lg:flex">
          <CollapsedAppNav />
        </div>
        
        {/* History (Desktop) */}
        <div className="hidden lg:flex w-56 border-r border-gray-100 flex-shrink-0 bg-gray-50">
          <AgentConversationList />
        </div>

        {/* Center Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative z-0 transition-all duration-300">
          <div className="hidden lg:flex items-center justify-between h-14 px-6 border-b border-gray-100">
            <AgentStatusMenu />
          </div>
          <AgentChatPanel 
            messages={messages} 
            inputDraft={inputDraft} 
            setInputDraft={setInputDraft} 
            onSend={handleSend}
            isThinking={demoState === "thinking" || demoState === "second_thinking"}
          />
        </div>

        {/* Right Review Panel (Desktop) */}
        <AnimatePresence>
          {isReviewPanelOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="hidden lg:block border-l border-gray-100 bg-white flex-shrink-0 z-10 overflow-hidden"
            >
              <div className="w-[400px] h-full">
                <ChangeReviewPanel 
                  changes={changes} 
                  setChanges={setChanges} 
                  onApply={handleApplyChanges}
                  isApplying={demoState === "applying"}
                  isApplied={demoState === "applied"}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Drawers */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden absolute inset-0 bg-black/20 z-30"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <motion.div 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden absolute top-0 left-0 bottom-0 w-72 bg-white flex z-40 shadow-xl"
            >
              <CollapsedAppNav expanded />
              <div className="flex-1 border-l border-gray-100">
                <AgentConversationList />
              </div>
            </motion.div>
          </>
        )}

        {isMobileReviewOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden absolute inset-0 bg-black/20 z-30"
              onClick={() => setIsMobileReviewOpen(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden absolute top-14 left-0 right-0 bottom-0 bg-white z-40 rounded-t-xl shadow-xl overflow-hidden"
            >
              <ChangeReviewPanel 
                changes={changes} 
                setChanges={setChanges} 
                onApply={handleApplyChanges}
                isApplying={demoState === "applying"}
                isApplied={demoState === "applied"}
                onClose={() => setIsMobileReviewOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
