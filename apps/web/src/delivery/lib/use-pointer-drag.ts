import { useEffect, useRef, useState } from "react";

// Порог активации: до этого сдвига жест не считается начатым (случайный клик по
// хэндлу не рисует drag-состояние; onUp без движения — не жест, а клик).
const DRAG_THRESHOLD_PX = 3;

/**
 * Общая механика window-жеста перетягивания с полным жизненным циклом.
 *
 * Контракт:
 * - `begin(e, state)` вызывается из onPointerDown: жест привязывается к e.pointerId
 *   (мультитач/второй указатель игнорируются);
 * - активация — только после сдвига ≥ DRAG_THRESHOLD_PX (до неё state === null);
 * - `onMove` получает актуальный снимок из рефа и set() для обновления;
 * - `onUp` — ЕДИНСТВЕННОЕ место, где консьюмер создаёт команды; вызывается только
 *   для активированного жеста;
 * - отмена (`pointercancel` — прерывание touch/OS-жестом, потеря фокуса окна,
 *   Escape, ручной `cancel()`) НИКОГДА не вызывает onUp — только опциональный
 *   `onCancel(state)` для отката визуального состояния (например, ширин колонок).
 *
 * Обработчики читаются через реф: эффект подписан лишь на [tracking], поэтому
 * move/up всегда зовут ПОСЛЕДНИЕ onMove/onUp (свежие readModel/mapped/dayW из рендера).
 */
export function usePointerDrag<S>(handlers: {
  onMove: (e: PointerEvent, state: S, set: (next: S) => void) => void;
  onUp: (e: PointerEvent, state: S) => void;
  onCancel?: (state: S) => void;
}): {
  state: S | null;
  begin: (e: { pointerId: number; clientX: number; clientY: number }, state: S) => void;
  cancel: () => void;
} {
  const [state, setState] = useState<S | null>(null);
  const ref = useRef<S | null>(null);
  // Ожидающий активации жест (pointerdown случился, порог ещё не пройден).
  const pendingRef = useRef<{ x: number; y: number; state: S } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Подписка живёт от pointerdown (begin) до up/cancel — включая фазу порога.
  const [tracking, setTracking] = useState(false);

  const finishRef = useRef(() => {
    ref.current = null;
    pendingRef.current = null;
    pointerIdRef.current = null;
    setState(null);
    setTracking(false);
  });

  const cancelRef = useRef(() => {
    const cur = ref.current;
    finishRef.current();
    if (cur != null) handlersRef.current.onCancel?.(cur);
  });

  useEffect(() => {
    if (!tracking) return;
    const set = (next: S) => { ref.current = next; setState(next); };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return;
      const pending = pendingRef.current;
      if (pending) {
        if (Math.abs(e.clientX - pending.x) < DRAG_THRESHOLD_PX && Math.abs(e.clientY - pending.y) < DRAG_THRESHOLD_PX) return;
        pendingRef.current = null;
        set(pending.state);
      }
      const cur = ref.current;
      if (cur == null) return;
      handlersRef.current.onMove(e, cur, set);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return;
      const cur = ref.current;
      const wasPending = pendingRef.current != null;
      finishRef.current();
      // Клик без движения (порог не пройден) — не жест: onUp не зовём.
      if (wasPending || cur == null) return;
      handlersRef.current.onUp(e, cur);
    };
    const pointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerIdRef.current) cancelRef.current();
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape во время жеста — только отмена жеста (не закрытие диалогов/меню).
      e.preventDefault();
      e.stopPropagation();
      cancelRef.current();
    };
    const windowBlur = () => cancelRef.current();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("keydown", keyDown, true);
    window.addEventListener("blur", windowBlur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("keydown", keyDown, true);
      window.removeEventListener("blur", windowBlur);
    };
  }, [tracking]);

  const begin = (e: { pointerId: number; clientX: number; clientY: number }, next: S) => {
    // Второй указатель (мультитач) во время активного жеста игнорируется —
    // иначе он молча перехватил бы жест без onUp/onCancel у первого.
    if (pointerIdRef.current != null) return;
    pointerIdRef.current = e.pointerId;
    pendingRef.current = { x: e.clientX, y: e.clientY, state: next };
    setTracking(true);
  };

  return { state, begin, cancel: () => cancelRef.current() };
}
