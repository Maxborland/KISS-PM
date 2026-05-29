import { useEffect, useState, type CSSProperties } from "react";

type NotifyKind = "system" | "signal" | "chat" | "audit" | "task" | "approval";

interface NotifyItem {
  id: string;
  kind: NotifyKind;
  app: string;
  title: string;
  body: string;
  time: string;
  glyph: string;
}

const ITEMS: NotifyItem[] = [
  {
    id: "signal",
    kind: "signal",
    app: "KISS PM · Риски",
    title: "Перегрев роли «Дизайн»",
    body: "142% к плану · прогноз 3 недели",
    time: "сейчас",
    glyph: "⚡",
  },
  {
    id: "approval",
    kind: "approval",
    app: "Согласование",
    title: "Сценарий ждёт подтверждения",
    body: "Сжать спринт · ведущий инженер",
    time: "1 мин",
    glyph: "✓",
  },
  {
    id: "task",
    kind: "task",
    app: "Задачи",
    title: "Срок сдвинут на 4 дня",
    body: "MDS-39 · новая homepage",
    time: "3 мин",
    glyph: "▣",
  },
  {
    id: "chat",
    kind: "chat",
    app: "Проект «Гелиос»",
    title: "Анна → команда",
    body: "Задачи №221 и №224 → Роман",
    time: "5 мин",
    glyph: "А",
  },
  {
    id: "audit",
    kind: "audit",
    app: "Аудит",
    title: "Решение записано",
    body: "Сценарий портфеля · след №4128",
    time: "8 мин",
    glyph: "§",
  },
  {
    id: "system",
    kind: "system",
    app: "Система",
    title: "Дедлайн под риском",
    body: "Приёмка −3 дня без второго ресурса",
    time: "12:04",
    glyph: "!",
  },
];

const CYCLE_MS = 3600;

export default function SignalNotificationStack() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ITEMS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced]);

  const stack = [0, 1, 2].map((offset) => ITEMS[(index + offset) % ITEMS.length]!);

  return (
    <div
      className="notify-dock"
      aria-live="polite"
      aria-label="Входящие уведомления"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {stack.map((item, stackIndex) => (
        <article
          key={`${item.id}-${index}-${stackIndex}`}
          className={`notify notify--${item.kind}${stackIndex === 0 ? " notify--front" : ""}`}
          style={{ "--notify-i": stackIndex } as CSSProperties}
        >
          <div className="notify__icon" aria-hidden="true">
            {item.glyph}
          </div>
          <div className="notify__body">
            <div className="notify__app">{item.app}</div>
            <div className="notify__title">{item.title}</div>
            <div className="notify__text">{item.body}</div>
          </div>
          <time className="notify__time">{item.time}</time>
        </article>
      ))}
    </div>
  );
}
