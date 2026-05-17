import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

import { getApiJson, getDeploymentReadback, getOpsAudit, openKissPm, phase12ApiBaseUrl, phase12Users, resetPhase12Fixtures } from "./helpers";

type ReleaseReadinessReadback = {
  tenantId: string;
  summary: { status: "passed" | "failed" | "blocked"; totalChecks: number; blockedChecks: number };
  latestRun: {
    id: string;
    auditEventId: string;
    status: "passed" | "failed" | "blocked";
    checks: Array<{ id: string; status: string; actual: string }>;
  } | null;
};

const productionLikeApiPort = process.env.PW_PRODUCTION_LIKE_API_PORT ?? "4298";
const productionLikeApiUrl = `http://127.0.0.1:${productionLikeApiPort}`;

async function startProductionLikeApi(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["../../scripts/dev-api-server.mjs", "--host", "127.0.0.1", "--port", productionLikeApiPort], {
    cwd: "apps/api",
    env: {
      ...process.env,
      KISS_PM_RUNTIME_ENV: "production_like",
      KISS_PM_PUBLIC_BASE_URL: "http://127.0.0.1:5287",
      KISS_PM_API_BASE_URL: productionLikeApiUrl,
      KISS_PM_ALLOWED_ORIGINS: "http://127.0.0.1:5287",
      KISS_PM_SECRET_REF: "secret://kiss-pm/prod/app",
      KISS_PM_AUDIT_RETENTION_DAYS: "365",
      KISS_PM_EXTERNAL_SERVICES_MODE: "mocked",
      KISS_PM_ALLOW_TEST_FIXTURE_RESET: "false",
      KISS_PM_ALLOW_TEST_FIXTURE_AUTH: "false",
      VITE_KISS_PM_ALLOW_FIXTURE_AUTH: "false",
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost"
    },
    stdio: "ignore"
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`production-like API exited before /health/deployment became available: ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${productionLikeApiUrl}/health/deployment`);
      if (response.ok) return child;
    } catch {
      // Keep polling until the isolated API finishes bundling and starts listening.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error("production-like API did not become ready in time");
}

async function stopProductionLikeApi(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(resolve, 1000);
  });
}

test("E2E-113 deployment smoke proves safe env readback, readiness command, denial, audit, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  const productionLikeApi = await startProductionLikeApi();
  try {
    const productionLikeDeployment = (await (await fetch(`${productionLikeApiUrl}/health/deployment`)).json()) as {
      status: string;
      target: string;
      checks: Array<{ id: string; status: string; actual: string }>;
    };
    expect(productionLikeDeployment).toMatchObject({ status: "passed", target: "production_like" });
    expect(JSON.stringify(productionLikeDeployment)).not.toContain("raw-super-secret");
    expect(productionLikeDeployment.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "runtime-target", status: "passed", actual: "production_like" }),
        expect.objectContaining({ id: "secret-ref.KISS_PM_SECRET_REF", status: "passed", actual: "configured" }),
        expect.objectContaining({ id: "external-services-mode", status: "passed", actual: "mocked" }),
        expect.objectContaining({ id: "dev-only.KISS_PM_ALLOW_TEST_FIXTURE_RESET", status: "passed", actual: "disabled" }),
        expect.objectContaining({ id: "dev-only.KISS_PM_ALLOW_TEST_FIXTURE_AUTH", status: "passed", actual: "disabled" })
      ])
    );
  } finally {
    await stopProductionLikeApi(productionLikeApi);
  }

  const deployment = await getDeploymentReadback(request);
  expect(deployment.status).toBe("passed");
  expect(JSON.stringify(deployment)).not.toContain("raw-super-secret");
  expect(deployment.checks.find((check) => check.id === "secret-ref.KISS_PM_SECRET_REF")?.actual).not.toContain("secret://");
  expect(deployment.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "runtime-target", actual: "development" }),
      expect.objectContaining({ id: "external-services-mode", status: "passed", actual: "mocked" }),
      expect.objectContaining({ id: "dev-only.KISS_PM_ALLOW_TEST_FIXTURE_RESET", status: "passed", actual: "enabled" })
    ])
  );

  await openKissPm(page, phase12Users.operatorAdmin);
  await expect(page.getByTestId("release-readiness-summary")).toContainText("Latest run: not_run");
  await page.getByRole("button", { name: "Запустить readiness" }).click();
  await expect(page.getByTestId("release-readiness-result")).toContainText("p12-readiness-tenant-a-0001");
  await expect(page.getByTestId("release-readiness-summary")).toContainText("p12-readiness-tenant-a-0001");

  const readback = await getApiJson<ReleaseReadinessReadback>(
    request,
    "/api/ops/release-readiness",
    phase12Users.operatorAdmin
  );
  expect(readback).toMatchObject({
    tenantId: "tenant-a",
    latestRun: {
      id: "p12-readiness-tenant-a-0001",
      status: "blocked"
    }
  });
  expect(readback.summary.totalChecks).toBeGreaterThan(0);
  expect(readback.latestRun?.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "p12.deployment-smoke", status: "passed" }),
      expect.objectContaining({ id: "p12.no-live-external-dependency", status: "passed" })
    ])
  );

  const deniedRead = await request.get(
    `${phase12ApiBaseUrl()}/api/ops/release-readiness?testUser=${encodeURIComponent(phase12Users.readonlyObserver)}`
  );
  expect(deniedRead.status()).toBe(403);
  const deniedRun = await request.post(
    `${phase12ApiBaseUrl()}/api/ops/release-readiness/run?testUser=${encodeURIComponent(phase12Users.readonlyObserver)}`
  );
  expect(deniedRun.status()).toBe(403);
  await openKissPm(page, phase12Users.readonlyObserver);
  await expect(page.getByTestId("operator-readiness-denied")).toBeVisible();

  await openKissPm(page, phase12Users.operatorAdmin);
  expect((await getOpsAudit(request)).events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionKey: "ops.release_readiness.run",
        target: expect.objectContaining({ entityId: "p12-readiness-tenant-a-0001" })
      })
    ])
  );
  await page.reload();
  await expect(page.getByTestId("release-readiness-summary")).toContainText("p12-readiness-tenant-a-0001");

  await resetPhase12Fixtures(request);
  const afterReset = await getApiJson<ReleaseReadinessReadback>(request, "/api/ops/release-readiness", phase12Users.operatorAdmin);
  expect(afterReset.latestRun).toBeNull();
});
