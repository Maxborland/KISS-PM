"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckSquare, FilePlus2, GitBranch, Plus, Scale } from "lucide-react";
import { toast } from "sonner";

import type {
  DecisionLogStatus,
  KnowledgeActionItemStatus,
  KnowledgeApprovalStatus,
  KnowledgeDocumentType
} from "@kiss-pm/domain";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { DeliveryFrame, type DeliveryTab } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, useProjectBase } from "@/delivery/lib/project-chrome";
import {
  createKnowledgeClient,
  knowledgeErr,
  type DecisionLogEntryView,
  type KnowledgeActionItemView,
  type KnowledgeClient,
  type KnowledgeDocumentVersionView,
  type KnowledgeDocumentView,
  type KnowledgeUserView,
  type KnowledgeVersionCreateInput
} from "./knowledge-client";
import { useKnowledge, useKnowledgeDocument, type KnowledgeData, type KnowledgeDataResult } from "./use-knowledge";

/* ============================================================
   Поверхность «База знаний проекта» (Р3): три секции — «Документы»
   (список, создание, просмотр содержимого и версий; редактирование =
   новая версия), «Решения» (журнал решений: список + фиксация),
   «Поручения» (action items: список + создание + смена статуса).

   Данные — боевые ручки knowledgeRoutes (см. knowledge-client).
   RBAC честно: чтение — tenant.projects.read (403 → forbidden-статус),
   мутационные контролы видимы только с tenant.projects.manage —
   серверная точка отказа та же (canManageProjects).

   Deferred в этом слайсе (роуты есть, UI нет): архивация документа
   (DELETE), правка решения (PATCH), связи sourceMeetingId/documentId/
   decisionId/target у решений и поручений.
   ============================================================ */

// Таб «Знания» объявлен в DELIVERY_TAB_SLUGS (delivery-frame, лейн каталога);
// здесь только ссылаемся на него как на активный.
const ACTIVE_TAB: DeliveryTab = "Знания";

const MANAGE_PERMISSION = "tenant.projects.manage";

const DOC_TYPE_LABEL: Record<KnowledgeDocumentType, string> = {
  project_brief: "Бриф проекта",
  meeting_minutes: "Протокол встречи",
  specification: "Спецификация",
  decision_record: "Карточка решения",
  general: "Общий"
};
const DOC_TYPES = Object.keys(DOC_TYPE_LABEL) as KnowledgeDocumentType[];

const APPROVAL: Record<KnowledgeApprovalStatus, { label: string; variant: "info" | "success" | "warning" | "danger" }> = {
  none: { label: "Без согласования", variant: "info" },
  pending: { label: "На согласовании", variant: "warning" },
  approved: { label: "Согласован", variant: "success" },
  rejected: { label: "Отклонён", variant: "danger" }
};

const DECISION_STATUS: Record<DecisionLogStatus, { label: string; variant: "info" | "success" | "warning" | "danger" | "violet" }> = {
  proposed: { label: "Предложено", variant: "info" },
  accepted: { label: "Принято", variant: "success" },
  superseded: { label: "Заменено", variant: "violet" },
  rejected: { label: "Отклонено", variant: "danger" }
};
const DECISION_STATUSES = Object.keys(DECISION_STATUS) as DecisionLogStatus[];

const ACTION_STATUS: Record<KnowledgeActionItemStatus, { label: string; variant: "info" | "success" | "danger" }> = {
  open: { label: "Открыто", variant: "info" },
  done: { label: "Готово", variant: "success" },
  cancelled: { label: "Отменено", variant: "danger" }
};

// Локальные UI-классы (зеркало meetings/deals-surface): select/label единым стилем.
const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";
const cardCls = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]";

const dt = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const ddmmyyyy = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

type Section = "documents" | "decisions" | "actions";
const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "documents", label: "Документы" },
  { id: "decisions", label: "Решения" },
  { id: "actions", label: "Поручения" }
];

// Справочник имён: id → имя, честный fallback на id (справочник мог не загрузиться).
function userName(users: KnowledgeUserView[], userId: string): string {
  return users.find((user) => user.id === userId)?.name ?? userId;
}

export function ProjectKnowledge({
  projectId,
  client: injectedClient
}: {
  projectId: string;
  /** Инъекция клиента для тестов; по умолчанию — боевой same-origin клиент. */
  client?: KnowledgeClient;
}) {
  const clientRef = useRef<KnowledgeClient | null>(injectedClient ?? null);
  if (clientRef.current === null) clientRef.current = createKnowledgeClient({ apiOrigin: "" });
  const client = clientRef.current;

  const sessionUser = useSessionUser();
  const canManage = hasPermission(sessionUser?.permissions ?? [], MANAGE_PERMISSION);
  const projectBase = useProjectBase(projectId, PROJECT_FALLBACK);
  const knowledge = useKnowledge(client, projectId);
  const [section, setSection] = useState<Section>("documents");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Deep-link из глобального поиска: /projects/:id/knowledge?document=|decision=|actionItem=<id>.
  // Открываем нужную секцию (и выделяем документ) — иначе клик по knowledge-результату
  // вёл бы на несуществующий под-путь /knowledge/documents/:id (Next 404). Реагируем на
  // смену searchParams и guard'им по ЗНАЧЕНИЮ (ref), а не по жизни компонента — чтобы
  // повторный клик по другому knowledge-результату при уже открытой странице срабатывал
  // (образец — commits-surface). В Storybook хук отдаёт null → fallback на location.search.
  const searchParams = useSearchParams();
  const resolvedDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const search = searchParams ? searchParams.toString() : (typeof window === "undefined" ? "" : window.location.search);
    const params = new URLSearchParams(search);
    const doc = params.get("document");
    const decision = params.get("decision");
    const actionItem = params.get("actionItem");
    const key = doc ? `document:${doc}` : decision ? `decision:${decision}` : actionItem ? `actionItem:${actionItem}` : "";
    if (resolvedDeepLinkRef.current === key) return;
    resolvedDeepLinkRef.current = key;
    if (doc) {
      setSection("documents");
      setSelectedDocumentId(doc);
    } else if (decision) {
      setSection("decisions");
    } else if (actionItem) {
      setSection("actions");
    }
  }, [searchParams]);

  const documents = useMemo(
    () => [...(knowledge.data?.documents ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [knowledge.data]
  );
  const effectiveDocumentId = selectedDocumentId ?? documents[0]?.id ?? null;
  // Деталь документа — отдельный GET (документ + версии); хук ДО early-return.
  const detail = useKnowledgeDocument(client, projectId, effectiveDocumentId);

  const surfaceStatus = surfaceStatusOf(knowledge.status, Boolean(knowledge.data));
  if (surfaceStatus !== "ready" || !knowledge.data) {
    return (
      <DeliveryFrame project={projectBase} projectId={projectId} activeTab={ACTIVE_TAB}>
        <SurfaceState
          status={surfaceStatus}
          error={knowledge.error}
          onRetry={() => void knowledge.reload()}
          errorFormat={knowledgeErr}
          loadingLabel="Загрузка базы знаний…"
          forbidden={{ title: "Нет доступа к базе знаний", description: "Нужно право на чтение проектов." }}
        >
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }
  const data = knowledge.data;

  return (
    <DeliveryFrame project={projectBase} projectId={projectId} activeTab={ACTIVE_TAB}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">База знаний проекта</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Документы с версионированием, журнал решений и поручения по итогам. Редактирование документа — всегда новая версия.</p>
        </div>
      </div>

      {/* Секции поверхности */}
      <div role="tablist" aria-label="Секции базы знаний" className="mb-3 flex items-center gap-1 border-b border-[var(--border)]">
        {SECTIONS.map(({ id, label }) => {
          const active = id === section;
          const count = id === "documents" ? data.documents.length : id === "decisions" ? data.decisions.length : data.actionItems.length;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`knowledge-section-${id}`}
              onClick={() => setSection(id)}
              className={cn(
                "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[length:var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)]",
                active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text-strong)]"
              )}
            >
              {label}
              <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{count}</span>
              {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" /> : null}
            </button>
          );
        })}
      </div>

      {section === "documents" ? (
        <DocumentsSection
          data={data}
          documents={documents}
          selectedDocumentId={effectiveDocumentId}
          onSelect={setSelectedDocumentId}
          detail={detail}
          canManage={canManage}
          busy={busy}
          setBusy={setBusy}
          createDocument={async (input) => {
            const result = await knowledge.createDocument(input);
            if (result.ok) setSelectedDocumentId(result.data.document.id);
            return result;
          }}
          reloadLists={() => knowledge.reload()}
        />
      ) : null}
      {section === "decisions" ? (
        <DecisionsSection data={data} canManage={canManage} busy={busy} setBusy={setBusy} createDecision={knowledge.createDecision} />
      ) : null}
      {section === "actions" ? (
        <ActionItemsSection data={data} canManage={canManage} busy={busy} setBusy={setBusy} createActionItem={knowledge.createActionItem} patchActionItem={knowledge.patchActionItem} />
      ) : null}
    </DeliveryFrame>
  );
}

/* ============================================================
   Секция «Документы»: список слева, деталь (содержимое + версии) справа.
   ============================================================ */
function DocumentsSection({
  data,
  documents,
  selectedDocumentId,
  onSelect,
  detail,
  canManage,
  busy,
  setBusy,
  createDocument,
  reloadLists
}: {
  data: KnowledgeData;
  documents: KnowledgeDocumentView[];
  selectedDocumentId: string | null;
  onSelect: (id: string) => void;
  detail: ReturnType<typeof useKnowledgeDocument>;
  canManage: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  createDocument: ReturnType<typeof useKnowledge>["createDocument"];
  reloadLists: () => Promise<void>;
}) {
  const createDialog = canManage ? (
    <CreateDocumentDialog busy={busy} setBusy={setBusy} create={createDocument} />
  ) : null;

  if (documents.length === 0) {
    return (
      <div className={cn(cardCls, "p-6")}>
        <EmptyState
          title="Документов пока нет"
          description={canManage ? "Создайте первый документ базы знаний проекта." : "Документы появятся, когда их создаст руководитель проекта."}
          {...(createDialog ? { action: createDialog } : {})}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]" data-testid="knowledge-documents">
      <section className={cn(cardCls, "flex flex-col gap-2 p-2")}>
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <h3 className="flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
            <BookOpen className="size-4" aria-hidden /> Документы
            <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{documents.length}</span>
          </h3>
          {createDialog}
        </div>
        <ul className="flex flex-col gap-1.5">
          {documents.map((doc) => {
            const active = doc.id === selectedDocumentId;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  data-testid="knowledge-document-row"
                  data-document-id={doc.id}
                  aria-pressed={active}
                  onClick={() => onSelect(doc.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                    active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent-muted)]"
                  )}
                >
                  <span className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{doc.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
                    <Chip variant="violet">{DOC_TYPE_LABEL[doc.documentType]}</Chip>
                    <Chip variant={APPROVAL[doc.approvalStatus].variant}>{APPROVAL[doc.approvalStatus].label}</Chip>
                    <span className="text-[var(--muted-soft)]">обновлён {dt(doc.updatedAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* key: смена документа сбрасывает выбор версии предыдущего документа */}
      <DocumentDetailPanel key={selectedDocumentId ?? "none"} data={data} detail={detail} canManage={canManage} busy={busy} setBusy={setBusy} reloadLists={reloadLists} />
    </div>
  );
}

function DocumentDetailPanel({
  data,
  detail,
  canManage,
  busy,
  setBusy,
  reloadLists
}: {
  data: KnowledgeData;
  detail: ReturnType<typeof useKnowledgeDocument>;
  canManage: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  reloadLists: () => Promise<void>;
}) {
  // Выбранная версия: null = текущая (первая по номеру убыв.).
  const [versionId, setVersionId] = useState<string | null>(null);

  const detailStatus = surfaceStatusOf(detail.status, Boolean(detail.data));
  if (detailStatus !== "ready" || !detail.data) {
    return (
      <SurfaceState
        status={detailStatus}
        error={detail.error}
        onRetry={() => void detail.reload()}
        errorFormat={knowledgeErr}
        loadingLabel="Загрузка документа…"
        narrow
      >
        <span />
      </SurfaceState>
    );
  }

  const { document: doc, versions: rawVersions } = detail.data;
  const versions = [...rawVersions].sort((a, b) => b.versionNumber - a.versionNumber);
  const current = versions.find((version) => version.id === versionId) ?? versions[0] ?? null;
  const latest = versions[0] ?? null;

  return (
    <section className={cn(cardCls, "flex flex-col")} data-testid="knowledge-document-detail">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="mr-auto min-w-0">
          <h3 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{doc.title}</h3>
          <p className="text-[length:var(--text-xs)] text-[var(--muted)]">
            Создан {dt(doc.createdAt)} · автор {userName(data.users, doc.createdByUserId)}
          </p>
        </div>
        <Chip variant="violet">{DOC_TYPE_LABEL[doc.documentType]}</Chip>
        <Chip variant={APPROVAL[doc.approvalStatus].variant}>{APPROVAL[doc.approvalStatus].label}</Chip>
        {canManage && latest ? (
          <CreateVersionDialog
            key={doc.id}
            busy={busy}
            setBusy={setBusy}
            latest={latest}
            create={async (input) => {
              const result = await detail.createVersion(input);
              if (result.ok) {
                setVersionId(null);
                await reloadLists();
              }
              return result;
            }}
          />
        ) : null}
      </div>

      {doc.summary ? (
        <p className="border-b border-[var(--border-subtle)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{doc.summary}</p>
      ) : null}

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_240px]">
        {/* Содержимое выбранной версии */}
        <div className="px-4 py-3">
          {current ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted)]">
                <span className="mono rounded bg-[var(--panel-strong)] px-1.5 py-0.5 font-semibold text-[var(--muted-strong)]">v{current.versionNumber}</span>
                <span>{dt(current.createdAt)} · {userName(data.users, current.createdByUserId)}</span>
                {current.changeReason ? <span className="text-[var(--muted-soft)]">— {current.changeReason}</span> : null}
              </div>
              <pre data-testid="knowledge-version-body" className="whitespace-pre-wrap break-words font-[inherit] text-[length:var(--text-sm)] leading-relaxed text-[var(--text)]">{current.body}</pre>
            </>
          ) : (
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">У документа нет версий.</p>
          )}
        </div>

        {/* Список версий */}
        <div className="border-t border-[var(--border)] md:border-l md:border-t-0">
          <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <GitBranch className="size-3.5" aria-hidden /> Версии ({versions.length})
          </div>
          <ul>
            {versions.map((version) => {
              const active = version.id === (current?.id ?? null);
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    data-testid="knowledge-version-row"
                    data-version-id={version.id}
                    aria-pressed={active}
                    onClick={() => setVersionId(version.id)}
                    className={cn(
                      "flex w-full items-baseline gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--panel-subtle)]",
                      active && "bg-[var(--accent-soft)]"
                    )}
                  >
                    <span className="mono shrink-0 rounded bg-[var(--panel-strong)] px-1 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">v{version.versionNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:var(--text-sm)] text-[var(--text)]">{version.title}</span>
                      <span className="block text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{dt(version.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CreateDocumentDialog({
  busy,
  setBusy,
  create
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  create: ReturnType<typeof useKnowledge>["createDocument"];
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<KnowledgeDocumentType>("general");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const valid = Boolean(title.trim() && body.trim());
  const reset = () => { setTitle(""); setDocumentType("general"); setSummary(""); setBody(""); };

  return (
    <FormDialog
      title="Новый документ"
      trigger={<Button variant="default" size="sm"><FilePlus2 className="size-3.5" aria-hidden />Документ</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Документ создан (версия v1)"
      onClose={reset}
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const result = await create({
          title: title.trim(),
          body,
          documentType,
          ...(summary.trim() ? { summary: summary.trim() } : {})
        });
        setBusy(false);
        return result.ok ? null : `Отклонено: ${knowledgeErr(result.code, result.message)}`;
      }}
    >
      <div className="grid gap-3">
        <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Устав проекта" /></label>
        <label className={labelCls}>Тип документа
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value as KnowledgeDocumentType)} className={selCls}>
            {DOC_TYPES.map((type) => <option key={type} value={type}>{DOC_TYPE_LABEL[type]}</option>)}
          </select>
        </label>
        <label className={labelCls}>Краткое описание<Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="О чём документ (необязательно)" /></label>
        <label className={labelCls}>Содержимое<Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Текст документа…" /></label>
      </div>
    </FormDialog>
  );
}

function CreateVersionDialog({
  busy,
  setBusy,
  latest,
  create
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  latest: KnowledgeDocumentVersionView;
  create: (input: KnowledgeVersionCreateInput) => Promise<KnowledgeDataResult<KnowledgeDocumentView>>;
}) {
  // Префилл текущей версией: «редактирование» честно создаёт следующую версию.
  const [title, setTitle] = useState(latest.title);
  const [body, setBody] = useState(latest.body);
  const [changeReason, setChangeReason] = useState("");
  const valid = Boolean(title.trim() && body.trim());
  const reset = () => { setTitle(latest.title); setBody(latest.body); setChangeReason(""); };

  return (
    <FormDialog
      title={`Новая версия (после v${latest.versionNumber})`}
      trigger={<Button variant="secondary" size="sm"><GitBranch className="size-3.5" aria-hidden />Новая версия</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Сохранить версию</>}
      submitDisabled={!valid || busy}
      successToast="Новая версия сохранена"
      onClose={reset}
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const result = await create({
          title: title.trim(),
          body,
          ...(changeReason.trim() ? { changeReason: changeReason.trim() } : {})
        });
        setBusy(false);
        return result.ok ? null : `Отклонено: ${knowledgeErr(result.code, result.message)}`;
      }}
    >
      <div className="grid gap-3">
        <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className={labelCls}>Содержимое<Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <label className={labelCls}>Причина изменения<Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Что и почему изменилось (необязательно)" /></label>
      </div>
    </FormDialog>
  );
}

/* ============================================================
   Секция «Решения»: журнал решений проекта + фиксация нового.
   ============================================================ */
function DecisionsSection({
  data,
  canManage,
  busy,
  setBusy,
  createDecision
}: {
  data: KnowledgeData;
  canManage: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  createDecision: ReturnType<typeof useKnowledge>["createDecision"];
}) {
  const decisions = [...data.decisions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const createDialog = canManage ? <CreateDecisionDialog busy={busy} setBusy={setBusy} create={createDecision} /> : null;

  return (
    <section className={cn(cardCls)} data-testid="knowledge-decisions">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
          <Scale className="size-4" aria-hidden /> Журнал решений
          <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{decisions.length}</span>
        </h3>
        {createDialog}
      </div>
      {decisions.length === 0 ? (
        <div className="p-6">
          <EmptyState title="Решений пока нет" description="Фиксируйте ключевые решения проекта с обоснованием — журнал заменит поиск по переписке." />
        </div>
      ) : (
        <ul>
          {decisions.map((decision: DecisionLogEntryView) => (
            <li key={decision.id} data-testid="knowledge-decision-row" className="border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{decision.title}</span>
                <Chip variant={DECISION_STATUS[decision.status].variant}>{DECISION_STATUS[decision.status].label}</Chip>
                <span className="ml-auto text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{dt(decision.createdAt)} · {userName(data.users, decision.createdByUserId)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{decision.decision}</p>
              {decision.rationale ? (
                <p className="mt-1 text-[length:var(--text-xs)] text-[var(--muted)]">Обоснование: {decision.rationale}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateDecisionDialog({
  busy,
  setBusy,
  create
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  create: ReturnType<typeof useKnowledge>["createDecision"];
}) {
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [status, setStatus] = useState<DecisionLogStatus>("accepted");
  const valid = Boolean(title.trim() && decision.trim());
  const reset = () => { setTitle(""); setDecision(""); setRationale(""); setStatus("accepted"); };

  return (
    <FormDialog
      title="Новое решение"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Решение</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Зафиксировать</>}
      submitDisabled={!valid || busy}
      successToast="Решение зафиксировано"
      onClose={reset}
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const result = await create({
          title: title.trim(),
          decision: decision.trim(),
          status,
          ...(rationale.trim() ? { rationale: rationale.trim() } : {})
        });
        setBusy(false);
        return result.ok ? null : `Отклонено: ${knowledgeErr(result.code, result.message)}`;
      }}
    >
      <div className="grid gap-3">
        <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Выбор стека интеграции" /></label>
        <label className={labelCls}>Решение<Textarea rows={3} value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Что решили…" /></label>
        <label className={labelCls}>Обоснование<Textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Почему (необязательно)" /></label>
        <label className={labelCls}>Статус
          <select value={status} onChange={(e) => setStatus(e.target.value as DecisionLogStatus)} className={selCls}>
            {DECISION_STATUSES.map((value) => <option key={value} value={value}>{DECISION_STATUS[value].label}</option>)}
          </select>
        </label>
      </div>
    </FormDialog>
  );
}

/* ============================================================
   Секция «Поручения»: список + создание + смена статуса (PATCH).
   ============================================================ */
function ActionItemsSection({
  data,
  canManage,
  busy,
  setBusy,
  createActionItem,
  patchActionItem
}: {
  data: KnowledgeData;
  canManage: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  createActionItem: ReturnType<typeof useKnowledge>["createActionItem"];
  patchActionItem: ReturnType<typeof useKnowledge>["patchActionItem"];
}) {
  const items = [...data.actionItems].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const createDialog = canManage ? <CreateActionItemDialog busy={busy} setBusy={setBusy} users={data.users} create={createActionItem} /> : null;

  const doPatchStatus = async (actionItemId: string, status: KnowledgeActionItemStatus) => {
    setBusy(true);
    const result = await patchActionItem(actionItemId, { status });
    setBusy(false);
    if (result.ok) toast.success(`Статус поручения: «${ACTION_STATUS[status].label}»`);
    else toast.error(`Отклонено: ${knowledgeErr(result.code, result.message)}`);
  };

  return (
    <section className={cn(cardCls)} data-testid="knowledge-actions">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
          <CheckSquare className="size-4" aria-hidden /> Поручения
          <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{items.length}</span>
        </h3>
        {createDialog}
      </div>
      {items.length === 0 ? (
        <div className="p-6">
          <EmptyState title="Поручений пока нет" description="Поручения фиксируют договорённости: кто, что и к какому сроку." />
        </div>
      ) : (
        <ul>
          {items.map((item: KnowledgeActionItemView) => (
            <li key={item.id} data-testid="knowledge-action-row" data-action-item-id={item.id} className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className={cn("text-[length:var(--text-sm)] text-[var(--text)]", item.status !== "open" && "text-[var(--muted)] line-through")}>{item.title}</p>
                <p className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
                  {userName(data.users, item.ownerUserId)}
                  {item.dueDate ? ` · срок ${ddmmyyyy(item.dueDate)}` : ""}
                  {` · создано ${dt(item.createdAt)}`}
                </p>
                {item.description ? <p className="mt-1 text-[length:var(--text-xs)] text-[var(--muted)]">{item.description}</p> : null}
              </div>
              {canManage ? (
                <select
                  value={item.status}
                  disabled={busy}
                  onChange={(e) => void doPatchStatus(item.id, e.target.value as KnowledgeActionItemStatus)}
                  className={cn(selCls, "h-8 w-[124px] shrink-0")}
                  title="Изменить статус поручения"
                >
                  {(Object.keys(ACTION_STATUS) as KnowledgeActionItemStatus[]).map((value) => (
                    <option key={value} value={value}>{ACTION_STATUS[value].label}</option>
                  ))}
                </select>
              ) : (
                <Chip variant={ACTION_STATUS[item.status].variant}>{ACTION_STATUS[item.status].label}</Chip>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateActionItemDialog({
  busy,
  setBusy,
  users,
  create
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  users: KnowledgeUserView[];
  create: ReturnType<typeof useKnowledge>["createActionItem"];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const valid = Boolean(title.trim() && ownerUserId);
  const reset = () => { setTitle(""); setDescription(""); setOwnerUserId(users[0]?.id ?? ""); setDueDate(""); };

  return (
    <FormDialog
      title="Новое поручение"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Поручение</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Поручение создано"
      onClose={reset}
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const result = await create({
          title: title.trim(),
          ownerUserId,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(dueDate ? { dueDate } : {})
        });
        setBusy(false);
        return result.ok ? null : `Отклонено: ${knowledgeErr(result.code, result.message)}`;
      }}
    >
      <div className="grid gap-3">
        <label className={labelCls}>Поручение<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать…" /></label>
        <label className={labelCls}>Описание<Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Детали (необязательно)" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>Ответственный
            <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={selCls}>
              {users.length === 0 ? <option value="" disabled>Справочник недоступен</option> : null}
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Срок<Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        </div>
        <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Поручение создаётся со статусом «Открыто»; статус меняется селектом в списке.</p>
      </div>
    </FormDialog>
  );
}
