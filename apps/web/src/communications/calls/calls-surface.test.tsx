// @vitest-environment happy-dom

/* ============================================================
   CallsSurface: связность живой комнаты звонка.
   Контракт UI:
   - при активной сессии primary-действие «Открыть комнату» —
     внутренняя ссылка /calls/{roomId} (рантайм сам получает
     join-токен по roomId, токен через URL не передаётся);
   - сырой контракт join-ссылки (ws-joinUrl/токен) виден только
     под prototypeNotesEnabled (dev-кнопка «Данные подключения»);
   - без активной сессии живой ссылки нет — есть «Начать сессию».
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CallEvent, CallRoom, VideoJoinContract } from "@/communications/lib/comms-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* Гейт прототип-заметок — мутируемый мок (vitest компилирует импорт в доступ к свойству). */
const gate = vi.hoisted(() => ({ prototypeNotesEnabled: false }));
vi.mock("@/views/lib/prototype-gate", () => gate);

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/* next/link вне Next-рантайма → обычный <a href>. */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  )
}));

/* Scope резолвим напрямую в children — селектор проекта вне скоупа теста. */
vi.mock("@/communications/lib/entity-scope", () => ({
  WithCommsEntityScope: ({ children }: { children: (scope: unknown) => React.ReactNode }) =>
    <>{children({ entityType: "project", entityId: "proj-1", title: "Портал", picker: null })}</>
}));

vi.mock("@/communications/ui/comms-frame", () => ({
  CommsFrame: ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) => (
    <main><div data-testid="frame-actions">{actions}</div>{children}</main>
  )
}));

vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ trigger }: { trigger?: React.ReactNode }) => <div data-testid="create-room">{trigger}</div>
}));

/* Radix-диалог без портала: рендер только при open. */
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="join-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

const RAW_JOIN: VideoJoinContract = {
  provider: "livekit",
  joinUrl: "wss://livekit.example/rtc",
  token: "raw-livekit-token",
  expiresAt: null
};

/* vi.hoisted: мок-фабрика use-comms исполняется при импорте calls-surface (hoisted import). */
const joinToken = vi.hoisted(() =>
  vi.fn(async (_sessionId: string) => ({ ok: true as const, data: RAW_JOIN }))
);

const roomFixture = (status: CallRoom["status"]): CallRoom => ({
  roomId: "room-live-1",
  entityType: "project",
  entityId: "proj-1",
  meetingId: null,
  title: "Синк команды",
  mediaKind: "video",
  provider: "livekit",
  status,
  createdByUserId: "u-1",
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z"
});

const startedEvent: CallEvent = {
  id: "ev-1",
  roomId: "room-live-1",
  sessionId: "sess-1",
  eventType: "session_started",
  actorUserId: "u-1",
  payload: {},
  createdAt: "2026-07-18T10:05:00.000Z"
};

/* Мутируемое состояние мока use-comms — меняется между тестами.
   capabilities зеркалит контракт GET /call-rooms/:roomId (Н10). */
const state = vi.hoisted(() => ({
  room: null as unknown,
  events: [] as unknown[],
  capabilities: null as { videoProviderKind: string; egressEnabled: boolean; canManage: boolean } | null
}));

vi.mock("@/communications/lib/use-comms", () => ({
  useCallRooms: () => ({
    data: { callRooms: [state.room] },
    status: "ready",
    error: null,
    reload: vi.fn(),
    createRoom: vi.fn()
  }),
  useCallRoom: () => ({
    data: { callRoom: state.room, events: state.events, recordings: [], capabilities: state.capabilities },
    status: "ready",
    error: null,
    reload: vi.fn(),
    startSession: vi.fn(async () => ({ ok: true })),
    joinToken,
    participantState: vi.fn(async () => ({ ok: true })),
    endSession: vi.fn(async () => ({ ok: true })),
    addRecording: vi.fn(async () => ({ ok: true }))
  }),
  useCommsUsers: () => ({ list: [], byId: new Map(), name: () => "Иван" })
}));

import { CallsSurface } from "./calls-surface";

describe("CallsSurface: путь в живую комнату звонка", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    gate.prototypeNotesEnabled = false;
    state.room = roomFixture("active");
    state.events = [startedEvent];
    state.capabilities = { videoProviderKind: "livekit", egressEnabled: false, canManage: true };
    joinToken.mockClear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function render() {
    act(() => {
      root.render(<CallsSurface entityType="project" entityId="proj-1" />);
    });
  }

  function linkByText(text: string): HTMLAnchorElement | null {
    return (
      Array.from(host.querySelectorAll("a")).find((a) => a.textContent?.includes(text)) ?? null
    );
  }

  it("активная сессия: primary «Открыть комнату» ведёт на внутренний роут /calls/{roomId}", () => {
    render();

    const link = linkByText("Открыть комнату");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/calls/room-live-1");
    // Токен и ws-адрес через URL не передаются.
    expect(link?.getAttribute("href")).not.toContain("token");
    expect(host.innerHTML).not.toContain("wss://");
  });

  it("без гейта прототипа сырые данные подключения недоступны", () => {
    render();

    expect(host.textContent).not.toContain("Данные подключения");
    expect(host.textContent).not.toContain(RAW_JOIN.joinUrl);
    expect(host.textContent).not.toContain(RAW_JOIN.token as string);
    expect(joinToken).not.toHaveBeenCalled();
  });

  it("под prototypeNotesEnabled dev-кнопка показывает сырой joinUrl в диалоге", async () => {
    gate.prototypeNotesEnabled = true;
    render();

    const devButton = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Данные подключения")
    );
    expect(devButton).toBeDefined();
    await act(async () => {
      devButton?.click();
      await Promise.resolve();
    });

    expect(joinToken).toHaveBeenCalledWith("sess-1");
    const dialog = host.querySelector('[data-testid="join-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(RAW_JOIN.joinUrl);
  });

  it("без активной сессии живой ссылки нет — есть «Начать сессию»", () => {
    state.room = roomFixture("open");
    state.events = [];
    render();

    expect(linkByText("Открыть комнату")).toBeNull();
    const startButton = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Начать сессию")
    );
    expect(startButton).toBeDefined();
  });

  /* Н10: KISS_PM_VIDEO_PROVIDER=disabled ⇒ вместо кнопок старта/подключения —
     честная плашка; метаданные (участие/завершение) остаются рабочими. */
  it("disabled-провайдер, открытая комната: вместо «Начать сессию» — плашка о ненастроенном провайдере", () => {
    state.room = roomFixture("open");
    state.events = [];
    state.capabilities = { videoProviderKind: "disabled", egressEnabled: false, canManage: true };
    render();

    expect(host.textContent).toContain("Видео-провайдер не настроен (KISS_PM_VIDEO_PROVIDER)");
    const startButton = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Начать сессию")
    );
    expect(startButton).toBeUndefined();
  });

  it("disabled-провайдер, активная сессия: без «Открыть комнату», но с плашкой и «Завершить сессию»", () => {
    state.capabilities = { videoProviderKind: "disabled", egressEnabled: false, canManage: true };
    render();

    expect(linkByText("Открыть комнату")).toBeNull();
    expect(host.textContent).toContain("Видео-провайдер не настроен (KISS_PM_VIDEO_PROVIDER)");
    // Управление метаданными сессии остаётся рабочим — это не мёртвые контролы.
    const endButton = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Завершить сессию")
    );
    expect(endButton).toBeDefined();
  });

  it("manual-провайдер остаётся рабочим: кнопки старта/подключения на месте, плашки нет", () => {
    state.capabilities = { videoProviderKind: "manual", egressEnabled: false, canManage: true };
    render();
    expect(linkByText("Открыть комнату")).not.toBeNull();
    expect(host.textContent).not.toContain("Видео-провайдер не настроен");

    state.room = roomFixture("open");
    state.events = [];
    render();
    const startButton = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Начать сессию")
    );
    expect(startButton).toBeDefined();
  });

  it("сервер без capabilities (старый контракт): гейт не активируется, кнопки на месте", () => {
    state.capabilities = null;
    render();
    expect(linkByText("Открыть комнату")).not.toBeNull();
    expect(host.textContent).not.toContain("Видео-провайдер не настроен");
  });
});
