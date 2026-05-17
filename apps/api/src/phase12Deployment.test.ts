import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";
import { validatePhase12DeploymentEnvironment } from "./phase12Deployment";

const productionLikeEnv = {
  KISS_PM_RUNTIME_ENV: "production_like",
  KISS_PM_PUBLIC_BASE_URL: "https://kiss-pm.example.test",
  KISS_PM_API_BASE_URL: "https://api.kiss-pm.example.test",
  KISS_PM_ALLOWED_ORIGINS: "https://kiss-pm.example.test",
  KISS_PM_SECRET_REF: "secret://kiss-pm/prod/app",
  KISS_PM_AUDIT_RETENTION_DAYS: "365",
  KISS_PM_EXTERNAL_SERVICES_MODE: "mocked"
};

describe("Phase 12 deployment environment contract", () => {
  it("accepts a production-like environment without exposing secret references", () => {
    const result = validatePhase12DeploymentEnvironment(productionLikeEnv);

    expect(result.status).toBe("passed");
    expect(result.target).toBe("production_like");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "required-env.KISS_PM_PUBLIC_BASE_URL",
          status: "passed",
          actual: "configured"
        }),
        expect.objectContaining({
          id: "secret-ref.KISS_PM_SECRET_REF",
          status: "passed",
          actual: "configured"
        }),
        expect.objectContaining({
          id: "external-services-mode",
          status: "passed",
          actual: "mocked"
        })
      ])
    );
    expect(JSON.stringify(result)).not.toContain("secret://kiss-pm/prod/app");
  });

  it("reports missing production variables safely without throwing or leaking values", () => {
    const result = validatePhase12DeploymentEnvironment({
      KISS_PM_RUNTIME_ENV: "production",
      KISS_PM_SECRET_REF: "raw-super-secret-value"
    });

    expect(result.status).toBe("failed");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "required-env.KISS_PM_PUBLIC_BASE_URL",
          status: "failed",
          actual: "missing"
        }),
        expect.objectContaining({
          id: "secret-ref.KISS_PM_SECRET_REF",
          status: "failed",
          actual: "invalid-secret-reference"
        })
      ])
    );
    expect(JSON.stringify(result)).not.toContain("raw-super-secret-value");
  });

  it("fails production-like smoke when fixture-only switches are enabled", () => {
    const result = validatePhase12DeploymentEnvironment({
      ...productionLikeEnv,
      KISS_PM_ALLOW_TEST_FIXTURE_RESET: "true",
      VITE_KISS_PM_ALLOW_FIXTURE_AUTH: "true"
    });

    expect(result.status).toBe("failed");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dev-only.KISS_PM_ALLOW_TEST_FIXTURE_RESET",
          status: "failed",
          actual: "enabled"
        }),
        expect.objectContaining({
          id: "dev-only.VITE_KISS_PM_ALLOW_FIXTURE_AUTH",
          status: "failed",
          actual: "enabled"
        })
      ])
    );
  });

  it("exposes deployment smoke through health API with safe readback", async () => {
    const app = createApiApp({ deploymentEnvironment: productionLikeEnv });

    const response = await app.request("/health/deployment");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        service: "kiss-pm-api",
        status: "passed",
        target: "production_like",
        checks: expect.arrayContaining([
          expect.objectContaining({
            id: "secret-ref.KISS_PM_SECRET_REF",
            status: "passed",
            actual: "configured"
          })
        ])
      })
    );
  });
});
