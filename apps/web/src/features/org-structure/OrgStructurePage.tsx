"use client";

import { useEffect, useMemo, useState } from "react";

import "../planning/planning.css";
import { toOrgStructureReplaceInput } from "./orgStructureDraft";
import { OrgStructureTrackEditor } from "./OrgStructureTrackEditor";
import { getOrgStructureTrackSnapshot } from "./orgStructureTrackUtils";
import {
  type OrgStructureTrack,
  type TenantOrgStructureSnapshot,
  useOrgStructure
} from "./useOrgStructure";

type WorkspaceUser = { id: string; name: string; positionId: string | null };
type WorkspacePosition = { id: string; name: string };

export function OrgStructurePage(props: {
  canRead: boolean;
  canManage: boolean;
  users: WorkspaceUser[];
  positions: WorkspacePosition[];
}) {
  const orgQuery = useOrgStructure(props.canRead);
  const [draft, setDraft] = useState<TenantOrgStructureSnapshot | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [activeTrack, setActiveTrack] = useState<OrgStructureTrack>("functional");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (orgQuery.orgStructure && !isDraftDirty) {
      setDraft(orgQuery.orgStructure);
    }
  }, [isDraftDirty, orgQuery.orgStructure]);

  const replaceInput = useMemo(
    () => (draft ? toOrgStructureReplaceInput(draft) : null),
    [draft]
  );

  if (!props.canRead) {
    return (
      <main className="org-structure-page" data-testid="org-structure-forbidden">
        <p>Оргструктура недоступна без права tenant.org_structure.read.</p>
      </main>
    );
  }

  const trackSnapshot = draft ? getOrgStructureTrackSnapshot(draft, activeTrack) : undefined;

  return (
    <main className="org-structure-page" data-testid="org-structure-page">
      <header className="org-structure-page__header">
        <div>
          <h1>Оргструктура</h1>
          <p className="planning-pane__muted">
            Направление → отдел/команда → должность → сотрудник. Два параллельных трека для матрицы
            ресурсов.
          </p>
        </div>
        {props.canManage ? (
          <button
            className="primary-button"
            type="button"
            data-testid="org-structure-save"
            disabled={!replaceInput || orgQuery.isSaving}
            onClick={() => {
              if (!replaceInput) return;
              setMessage("");
              void orgQuery
                .saveOrgStructure(replaceInput)
                .then(() => {
                  setIsDraftDirty(false);
                  setMessage("Сохранено");
                })
                .catch((error: unknown) => {
                  setMessage(
                    error instanceof Error ? error.message : "Не удалось сохранить оргструктуру"
                  );
                });
            }}
          >
            Сохранить
          </button>
        ) : null}
      </header>

      <div className="org-structure-page__track-toggle" role="tablist">
        <button
          type="button"
          className={activeTrack === "functional" ? "primary-button" : "secondary-button"}
          onClick={() => setActiveTrack("functional")}
        >
          Функциональная
        </button>
        <button
          type="button"
          className={activeTrack === "project" ? "primary-button" : "secondary-button"}
          onClick={() => setActiveTrack("project")}
        >
          Проектная
        </button>
      </div>

      {orgQuery.isLoading || !draft || !trackSnapshot ? (
        <p className="planning-pane__muted">Загрузка…</p>
      ) : (
        <OrgStructureTrackEditor
          track={activeTrack}
          snapshot={trackSnapshot}
          canManage={props.canManage}
          users={props.users}
          positions={props.positions}
          onChange={(nextTrack) => {
            setIsDraftDirty(true);
            setDraft((current) =>
              current
                ? {
                    ...current,
                    [activeTrack]: nextTrack
                  }
                : current
            );
          }}
        />
      )}

      {message ? <p className="planning-pane__muted">{message}</p> : null}
    </main>
  );
}
