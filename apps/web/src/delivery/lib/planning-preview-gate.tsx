"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  isBlockingValidationIssue,
  type PlanningCommand
} from "@kiss-pm/domain";
import type { PlanningPreviewResponse } from "@kiss-pm/planning-client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type PreviewConfirmationInput = {
  commands: PlanningCommand[];
  preview: PlanningPreviewResponse;
};

type PendingConfirmation = PreviewConfirmationInput & {
  resolve: (confirmed: boolean) => void;
};

type PlanningPreviewGate = {
  requestConfirmation(input: PreviewConfirmationInput): Promise<boolean>;
};

const PlanningPreviewGateContext = createContext<PlanningPreviewGate | null>(null);

export function PlanningPreviewGateProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }, []);

  const requestConfirmation = useCallback(
    (input: PreviewConfirmationInput) =>
      new Promise<boolean>((resolve) => {
        pendingRef.current?.resolve(false);
        const next = { ...input, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    []
  );

  const value = useMemo(() => ({ requestConfirmation }), [requestConfirmation]);
  const blocking = pending?.preview.validationIssues.some(isBlockingValidationIssue) ?? false;
  const delta = pending?.preview.planDelta;

  return (
    <PlanningPreviewGateContext.Provider value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <DialogContent className="max-w-[520px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Предпросмотр изменений</DialogTitle>
            <DialogDescription>
              Проверьте последствия команды до изменения плана.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <div className="space-y-3 text-[length:var(--text-sm)]">
              <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-3 sm:grid-cols-4">
                <PreviewMetric label="Команды" value={pending.commands.length} />
                <PreviewMetric label="Задачи" value={delta?.changedTaskIds.length ?? 0} />
                <PreviewMetric label="Назначения" value={delta?.changedAssignmentIds.length ?? 0} />
                <PreviewMetric label="Связи" value={delta?.changedDependencyIds.length ?? 0} />
              </div>

              {pending.preview.validationIssues.length > 0 ? (
                <div
                  className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-subtle)] p-3"
                  role="alert"
                >
                  <div className="font-medium text-[var(--danger)]">
                    Проверка плана
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-[var(--text)]">
                    {pending.preview.validationIssues.map((issue, index) => (
                      <li key={issue.code + ":" + (issue.entity?.id ?? "") + ":" + index}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-[var(--radius-sm)] border border-[var(--success-border)] bg-[var(--success-subtle)] p-3 text-[var(--success)]">
                  Блокирующих ошибок не найдено.
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => settle(false)}>
              Отмена
            </Button>
            <Button variant="primary" disabled={blocking} onClick={() => settle(true)}>
              Применить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlanningPreviewGateContext.Provider>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[var(--muted)]">{label}</div>
      <div className="v4-num font-medium text-[var(--text)]">
        {label}: {value}
      </div>
    </div>
  );
}

export function usePlanningPreviewGate(): PlanningPreviewGate {
  const gate = useContext(PlanningPreviewGateContext);
  if (!gate) throw new Error("PlanningPreviewGateProvider is required");
  return gate;
}
