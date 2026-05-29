import type { Meta, StoryObj } from "@storybook/react";

import { API_CONTRACT_ENTRIES } from "@/lib/mock-data/api-contract-registry";
import { STORYBOOK_MSW_HANDLER_PATHS } from "@/lib/mock-data/storybook-msw-routes";

const meta: Meta = {
  title: "API Contract/Индекс сущностей",
  parameters: { layout: "padded" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

function ApiContractIndexTable() {
  return (
    <div className="api-contract-index">
      <header className="api-contract-index__header">
        <p className="api-contract-index__eyebrow">API Contract · design-v3</p>
        <h1 className="type-h2">Карта сущностей mock → MSW → UI</h1>
        <p className="type-body u-text-muted">
          Источник истины в коде:{" "}
          <code className="mono text-[length:var(--text-sm)]">api-contract-registry.ts</code>. Полная таблица
          — <code className="mono text-[length:var(--text-sm)]">docs/design-v3/API-CONTRACT-MAP.md</code>.
          Мутации задач: <code className="mono text-[length:var(--text-sm)]">API Contract/Задачи</code>.
        </p>
        <p className="type-body u-text-muted">
          MSW handlers: {STORYBOOK_MSW_HANDLER_PATHS.length} GET-маршрутов (
          <code className="mono text-[length:var(--text-xs)]">.storybook/msw-handlers.ts</code>).
        </p>
      </header>
      <div className="table-wrap">
        <table className="table table--compact api-contract-index__table">
          <thead>
            <tr>
              <th>Сущность</th>
              <th>Web type</th>
              <th>Fixture</th>
              <th>MSW route</th>
              <th>Consuming stories</th>
              <th>Backend</th>
            </tr>
          </thead>
          <tbody>
            {API_CONTRACT_ENTRIES.map((entry) => (
              <tr key={entry.entity}>
                <td className="u-text-strong">{entry.entity}</td>
                <td className="mono u-text-xs">{entry.webType}</td>
                <td className="mono u-text-xs">{entry.fixtureExport}</td>
                <td className="mono u-text-xs">{entry.route}</td>
                <td className="u-text-xs">{entry.stories.join(", ")}</td>
                <td className="mono u-text-xs">{entry.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="api-contract-index__mutations">
        <h2 className="type-h3">Мутации (не в MSW GET)</h2>
        <ul className="type-body">
          <li>
            <strong>CreateTaskBody</strong> —{" "}
            <code className="mono">apps/web/src/views/domain/task-api/task-api-contract.ts</code> ↔{" "}
            <code className="mono">apps/api/src/projectWorkParsers.ts</code>
          </li>
          <li>
            <strong>UpdateTaskBody</strong> — story{" "}
            <code className="mono">api-contract--update-task-payload</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

export const EntityIndex: Story = {
  name: "Индекс сущностей",
  render: () => <ApiContractIndexTable />
};
