"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";

import type { FixtureBundle } from "./fixture-bundle";
import { getFixtureBundle } from "./fixture-bundle";
import {
  createScenarioState,
  type ScenarioName,
  type ScenarioState
} from "./scenarios";

export type ScenarioContextValue = {
  scenario: ScenarioName;
  state: ScenarioState;
  fixtures: FixtureBundle;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

const DEFAULT_VALUE: ScenarioContextValue = {
  scenario: "default",
  state: createScenarioState("default"),
  fixtures: getFixtureBundle("default")
};

export function ScenarioProvider({
  value,
  children
}: {
  value: ScenarioContextValue;
  children: ReactNode;
}) {
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

/** Фикстуры и состояние сценария (Storybook toolbar или default вне SB). */
export function useScenarioFixtures(): ScenarioContextValue {
  return useContext(ScenarioContext) ?? DEFAULT_VALUE;
}

/** Сценарные fetch-состояния для data-heavy blocks (loading / error / forbidden). */
export function ScenarioFetchGate({
  children,
  loadingLabel = "Загрузка данных…"
}: {
  children: ReactNode;
  loadingLabel?: string;
}) {
  const { state } = useScenarioFixtures();

  if (state.fetchPhase === "loading") {
    return <LoadingState label={loadingLabel} />;
  }

  if (state.fetchPhase === "error") {
    return (
      <ErrorState
        title="Не удалось загрузить данные"
        description={state.errorMessage ?? "Повторите попытку позже."}
        onRetry={() => undefined}
      />
    );
  }

  if (state.fetchPhase === "forbidden") {
    return (
      <ForbiddenState
        title="Нет доступа"
        description="Недостаточно прав для просмотра этого раздела."
      />
    );
  }

  return children;
}

export function resolveStateScreenKind(
  propKind: "empty" | "error" | "forbidden" | "loading",
  scenario: ScenarioName
): "empty" | "error" | "forbidden" | "loading" {
  switch (scenario) {
    case "empty":
      return "empty";
    case "loading":
      return "loading";
    case "error":
      return "error";
    case "forbidden":
      return "forbidden";
    default:
      return propKind;
  }
}
