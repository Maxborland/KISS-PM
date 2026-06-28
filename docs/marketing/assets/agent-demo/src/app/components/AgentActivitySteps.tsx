import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

export function AgentActivitySteps({ steps }: { steps: { label: string; status: "pending" | "active" | "done" }[] }) {
  return (
    <div className="flex flex-col gap-2.5 mt-2 mb-4 bg-gray-50/50 rounded-xl p-4 border border-gray-100 max-w-[400px]">
      {steps.map((step, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: step.status === 'pending' ? 0.4 : 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex items-center gap-3 text-[13px]",
            step.status === "pending" && "text-gray-400",
            step.status === "active" && "text-blue-600 font-medium",
            step.status === "done" && "text-gray-700"
          )}
        >
          {step.status === "done" ? (
            <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
          ) : step.status === "active" ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-gray-300 shrink-0" />
          )}
          <span>{step.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
