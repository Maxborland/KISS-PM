import { useEffect, useRef, useState } from "react";

// Общая механика window-жеста перетягивания: зеркало-реф (свежее состояние без устаревших
// замыканий), подписка pointermove/pointerup на window и её очистка. Возвращает begin(state) —
// старт жеста. onMove получает актуальный снимок из рефа и set() для обновления (зеркалит в реф
// + state, чтобы следующий move/up видели свежее). onUp вызывается после сброса состояния — с
// последним снимком жеста. Обработчики читаются через реф: эффект подписан лишь на [активен?],
// поэтому move/up всегда зовут ПОСЛЕДНИЕ onMove/onUp (свежие readModel/mapped/dayW из рендера).
export function usePointerDrag<S>(handlers: {
  onMove: (e: PointerEvent, state: S, set: (next: S) => void) => void;
  onUp: (e: PointerEvent, state: S) => void;
}): { state: S | null; begin: (state: S) => void } {
  const [state, setState] = useState<S | null>(null);
  const ref = useRef<S | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const active = state !== null;
  useEffect(() => {
    if (!active) return;
    const set = (next: S) => { ref.current = next; setState(next); };
    const move = (e: PointerEvent) => { const cur = ref.current; if (cur == null) return; handlersRef.current.onMove(e, cur, set); };
    const up = (e: PointerEvent) => {
      const cur = ref.current;
      ref.current = null;
      setState(null);
      if (cur == null) return;
      handlersRef.current.onUp(e, cur);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [active]);

  const begin = (next: S) => { ref.current = next; setState(next); };
  return { state, begin };
}
