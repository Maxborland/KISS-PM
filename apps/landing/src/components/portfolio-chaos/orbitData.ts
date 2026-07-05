import type { OrbitConfig, OrbitKind, OrbitNodeDef, OrbitRingDef, ScaleId } from "./types";
import {
  areOrbitNodesSeparated,
  projectedNodeAt,
  visualRadiusFor,
  type ProjectedOrbitNode,
} from "./orbitSimulation";

const RINGS_BY_SCALE: Record<ScaleId, OrbitRingDef[]> = {
  team: [
    { index: 1, radius: 1.32, kind: "project", label: "Проекты" },
    { index: 2, radius: 1.92, kind: "signal", label: "Сигналы" },
    { index: 3, radius: 2.48, kind: "decision", label: "Решения" },
  ],
  office: [
    { index: 1, radius: 1.12, kind: "project", label: "Активные проекты" },
    { index: 2, radius: 1.56, kind: "project", label: "Проектные потоки" },
    { index: 3, radius: 2.02, kind: "resource", label: "Ресурсы" },
    { index: 4, radius: 2.48, kind: "signal", label: "Сигналы" },
    { index: 5, radius: 2.94, kind: "decision", label: "Решения" },
    { index: 6, radius: 3.4, kind: "scenario", label: "Клиентские ожидания" },
  ],
  holding: [
    { index: 1, radius: 0.82, kind: "project", label: "Hot-проекты" },
    { index: 2, radius: 1.08, kind: "project", label: "Основные проекты" },
    { index: 3, radius: 1.42, kind: "project", label: "Активный портфель" },
    { index: 4, radius: 1.74, kind: "resource", label: "Команды" },
    { index: 5, radius: 2.18, kind: "project", label: "Внешний контур" },
    { index: 6, radius: 2.5, kind: "scenario", label: "Сценарии" },
    { index: 7, radius: 2.94, kind: "resource", label: "Загрузка" },
    { index: 8, radius: 3.22, kind: "signal", label: "Сигналы" },
    { index: 9, radius: 3.76, kind: "project", label: "Новые инициативы" },
    { index: 10, radius: 4.14, kind: "signal", label: "Риски" },
    { index: 11, radius: 4.72, kind: "scenario", label: "Кластеры" },
    { index: 12, radius: 5.08, kind: "decision", label: "Решения" },
    { index: 13, radius: 6.2, kind: "project", label: "Будущий спрос" },
    { index: 14, radius: 7.1, kind: "resource", label: "Резерв мощности" },
    { index: 15, radius: 8.1, kind: "decision", label: "Управленческий контур" },
  ],
};

const LABELS_BY_KIND: Record<OrbitKind, string[]> = {
  project: [
    "ГК Север",
    "Лобби А",
    "Башня 2",
    "Коммерция",
    "Парк Юг",
    "Интерьеры C1",
    "МФК Центр",
    "Реновация",
    "Офисы W",
    "Паркинг",
    "Фасад 2",
    "Ландшафт",
    "Коворкинг",
    "Башня 4",
    "ЖК Альфа",
    "Парк Север",
  ],
  resource: [
    "Дизайнеры 91%",
    "Проектирование 82%",
    "Аналитика 68%",
    "Архитекторы 76%",
    "Визуализация 88%",
    "Сметчики 73%",
    "Команда Б",
    "PMO поток",
  ],
  signal: [
    "Риск срока",
    "Ресурс занят",
    "Перегруз через 2 недели",
    "Нет владельца",
    "Срок спорный",
    "Зависит от клиента",
    "Буфер исчерпан",
    "Приоритет конфликтует",
  ],
  decision: [
    "Перенести 4 проекта",
    "Добавить ресурс",
    "Утвердить буфер",
    "Зафиксировать приоритет",
    "Согласовать сценарий",
    "Открыть действие",
  ],
  scenario: [
    "Риск сроков",
    "Перегруз ресурсов",
    "Ожидание согласования",
    "Конфликт приоритетов",
    "Недостаток данных",
    "Клиентский стоппер",
  ],
};

const PLANET_COLORS: Record<OrbitKind, string[]> = {
  project: ["#2563eb", "#2f80ed", "#0ea5e9", "#38bdf8", "#60a5fa", "#647dee"],
  resource: ["#14b8a6", "#2dd4bf", "#10b981", "#0fbea7", "#34d399"],
  signal: ["#f59e0b", "#f2a65a", "#fb923c", "#f97316", "#f87171"],
  decision: ["#6366f1", "#7c6df2", "#8b7cf6", "#9575cd", "#a78bfa"],
  scenario: ["#94a3b8", "#93c5fd", "#67e8f9", "#7dd3fc", "#a5b4fc"],
};

const PLANET_GRADIENTS: Record<OrbitKind, string[]> = {
  project: ["#9ddcff", "#b7c8ff", "#7dd3fc", "#bfdbfe"],
  resource: ["#baf7e5", "#99f6e4", "#bbf7d0", "#ccfbf1"],
  signal: ["#fee7a8", "#fed7aa", "#fecaca", "#fde68a"],
  decision: ["#ddd6fe", "#c4b5fd", "#e9d5ff", "#bfdbfe"],
  scenario: ["#e2e8f0", "#bae6fd", "#cffafe", "#ddd6fe"],
};

const NODE_COUNTS: Record<ScaleId, Record<number, number>> = {
  team: {
    1: 10,
    2: 4,
    3: 3,
  },
  office: {
    1: 14,
    2: 20,
    3: 12,
    4: 9,
    5: 6,
    6: 5,
  },
  holding: {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 8,
    6: 8,
    7: 9,
    8: 9,
    9: 10,
    10: 10,
    11: 11,
    12: 10,
    13: 11,
    14: 9,
    15: 8,
  },
};

function baseAngleFor(index: number, count: number, ringIndex: number): number {
  const base = (index / count) * Math.PI * 2;
  const phase = ringIndex * 0.37;
  const jitter = Math.sin((index + 1) * (ringIndex + 2)) * 0.08;
  return base + phase + jitter;
}

function collisionFreeAngleFor({
  baseAngle,
  radius,
  visualRadius,
  placedNodes,
}: {
  baseAngle: number;
  radius: number;
  visualRadius: number;
  placedNodes: ProjectedOrbitNode[];
}): number {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const direction = attempt % 2 === 0 ? 1 : -1;
    const step = Math.ceil(attempt / 2) * 0.052;
    const angle = baseAngle + direction * step;
    const candidate = projectedNodeAt(radius, angle, visualRadius);
    if (areOrbitNodesSeparated(candidate, placedNodes)) {
      return angle;
    }
  }

  return baseAngle;
}

function labelFor(kind: OrbitKind, index: number, ringIndex: number): string {
  const labels = LABELS_BY_KIND[kind];
  return labels[(index + ringIndex * 2) % labels.length] ?? labels[0] ?? "Проект";
}

function priorityFor(kind: OrbitKind, index: number): OrbitNodeDef["priority"] {
  if (kind === "signal" || kind === "decision") {
    return "hot";
  }
  if (index % 4 === 0) {
    return "quiet";
  }
  return "normal";
}

function speedFor(): number {
  return 0.018;
}

function sizeFor(kind: OrbitKind, ringIndex: number, index: number): number {
  const kindScale: Record<OrbitKind, number> = {
    project: 1,
    resource: 0.98,
    signal: 1,
    decision: 1.04,
    scenario: 0.99,
  };
  const distanceScale = 0.38 + Math.min(ringIndex, 15) * 0.055;
  const localVariation = 0.92 + (index % 4) * 0.04;
  return kindScale[kind] * distanceScale * localVariation;
}

function colorFor(kind: OrbitKind, ringIndex: number, index: number): string {
  const colors = PLANET_COLORS[kind];
  return colors[(ringIndex + index) % colors.length] ?? colors[0] ?? "#2563eb";
}

function colorToFor(kind: OrbitKind, ringIndex: number, index: number): string {
  const colors = PLANET_GRADIENTS[kind];
  return colors[(ringIndex * 2 + index) % colors.length] ?? colors[0] ?? "#bfdbfe";
}

function hasGradient(kind: OrbitKind, ringIndex: number, index: number): boolean {
  return kind === "project" || kind === "resource" || (ringIndex + index) % 3 === 0;
}

function moonCountFor(kind: OrbitKind, ringIndex: number, index: number): number {
  if (kind === "signal" || kind === "scenario") {
    return 0;
  }
  if ((ringIndex + index) % 9 === 0) {
    return 2;
  }
  return (ringIndex * 3 + index) % 5 === 0 ? 1 : 0;
}

function moonColorFor(kind: OrbitKind): string {
  const colors: Record<OrbitKind, string> = {
    project: "#dbeafe",
    resource: "#ccfbf1",
    signal: "#fde68a",
    decision: "#e9d5ff",
    scenario: "#e2e8f0",
  };
  return colors[kind];
}

function buildNodes(scaleId: ScaleId, rings: OrbitRingDef[]): OrbitNodeDef[] {
  const placedNodes: ProjectedOrbitNode[] = [];

  return rings.flatMap((ring) => {
    const count = NODE_COUNTS[scaleId][ring.index] ?? 0;
    return Array.from({ length: count }, (_, index) => {
      const priority = priorityFor(ring.kind, index);
      const size = sizeFor(ring.kind, ring.index, index);
      const visualRadius = visualRadiusFor({ size, priority });
      const angle = collisionFreeAngleFor({
        baseAngle: baseAngleFor(index, count, ring.index),
        radius: ring.radius,
        visualRadius,
        placedNodes,
      });
      placedNodes.push(projectedNodeAt(ring.radius, angle, visualRadius));

      return {
        id: `${scaleId}-${ring.index}-${index}`,
        label: labelFor(ring.kind, index, ring.index),
        kind: ring.kind,
        ring: ring.index,
        angle,
        speed: speedFor(),
        size,
        color: colorFor(ring.kind, ring.index, index),
        colorTo: colorToFor(ring.kind, ring.index, index),
        gradient: hasGradient(ring.kind, ring.index, index),
        moonCount: moonCountFor(ring.kind, ring.index, index),
        moonColor: moonColorFor(ring.kind),
        priority,
      };
    });
  });
}

export const ORBIT_CONFIGS: Record<ScaleId, OrbitConfig> = {
  team: {
    rings: RINGS_BY_SCALE.team,
    nodes: buildNodes("team", RINGS_BY_SCALE.team),
    mobileNodeLimit: 17,
  },
  office: {
    rings: RINGS_BY_SCALE.office,
    nodes: buildNodes("office", RINGS_BY_SCALE.office),
    mobileNodeLimit: 34,
  },
  holding: {
    rings: RINGS_BY_SCALE.holding,
    nodes: buildNodes("holding", RINGS_BY_SCALE.holding),
    mobileNodeLimit: 76,
  },
};
