import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLocalStorageProvider,
  createS3StorageProvider,
  createStorageProviderFromEnv
} from "./storageProvider";

describe("local storage provider", () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it("keeps object keys inside the configured root", async () => {
    root = await mkdtemp(join(tmpdir(), "kiss-pm-storage-root-"));
    const provider = createLocalStorageProvider({ root });

    await provider.putObject({
      storageKey: "tenant-a/asset-a/brief.txt",
      bytes: new TextEncoder().encode("ok"),
      mimeType: "text/plain"
    });
    await expect(readFile(join(root, "tenant-a", "asset-a", "brief.txt"), "utf8")).resolves.toBe("ok");

    await expect(
      provider.putObject({
        storageKey: "../kiss-pm-storage-root-evil/escape.txt",
        bytes: new TextEncoder().encode("bad"),
        mimeType: "text/plain"
      })
    ).rejects.toThrow("storage_key_invalid");
  });
});

describe("storage provider env", () => {
  it("requires an explicit local storage root in production", () => {
    expect(() =>
      createStorageProviderFromEnv({
        NODE_ENV: "production",
        KISS_PM_STORAGE_PROVIDER: "local"
      } as NodeJS.ProcessEnv)
    ).toThrow("kiss_pm_storage_local_root_required");
  });

  it("rejects unsafe S3 timeout configuration", () => {
    expect(() =>
      createStorageProviderFromEnv({
        KISS_PM_STORAGE_PROVIDER: "s3",
        KISS_PM_STORAGE_S3_ACCESS_KEY_ID: "access",
        KISS_PM_STORAGE_S3_BUCKET: "bucket",
        KISS_PM_STORAGE_S3_ENDPOINT: "https://storage.example.test",
        KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY: "secret",
        KISS_PM_STORAGE_S3_TIMEOUT_MS: "0"
      } as NodeJS.ProcessEnv)
    ).toThrow("kiss_pm_storage_s3_timeout_ms_invalid");
  });

  it("rejects unsafe S3 endpoint and bucket configuration", () => {
    const baseEnv = {
      KISS_PM_STORAGE_PROVIDER: "s3",
      KISS_PM_STORAGE_S3_ACCESS_KEY_ID: "access",
      KISS_PM_STORAGE_S3_BUCKET: "bucket",
      KISS_PM_STORAGE_S3_ENDPOINT: "https://storage.example.test",
      KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY: "secret"
    } as NodeJS.ProcessEnv;

    expect(() =>
      createStorageProviderFromEnv({
        ...baseEnv,
        KISS_PM_STORAGE_S3_ENDPOINT: "https://user:pass@storage.example.test"
      })
    ).toThrow("kiss_pm_storage_s3_endpoint_invalid");
    expect(() =>
      createStorageProviderFromEnv({
        ...baseEnv,
        KISS_PM_STORAGE_S3_ENDPOINT: "https://storage.example.test/base-path"
      })
    ).toThrow("kiss_pm_storage_s3_endpoint_invalid");
    expect(() =>
      createStorageProviderFromEnv({
        ...baseEnv,
        KISS_PM_STORAGE_S3_BUCKET: "bucket/with-path"
      })
    ).toThrow("kiss_pm_storage_s3_bucket_invalid");
  });

  it("rejects insecure S3 endpoints in production", () => {
    expect(() =>
      createStorageProviderFromEnv({
        NODE_ENV: "production",
        KISS_PM_STORAGE_PROVIDER: "s3",
        KISS_PM_STORAGE_S3_ACCESS_KEY_ID: "access",
        KISS_PM_STORAGE_S3_BUCKET: "bucket",
        KISS_PM_STORAGE_S3_ENDPOINT: "http://storage.example.test",
        KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY: "secret"
      } as NodeJS.ProcessEnv)
    ).toThrow("kiss_pm_storage_s3_endpoint_insecure");
  });
});

describe("s3 storage provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bounds outbound storage requests with an abort signal", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createS3StorageProvider({
      accessKeyId: "access",
      bucket: "bucket",
      endpoint: "https://storage.example.test",
      region: "us-east-1",
      secretAccessKey: "secret",
      timeoutMs: 1_000
    });

    await provider.putObject({
      bytes: new TextEncoder().encode("ok"),
      mimeType: "text/plain",
      storageKey: "tenant-alpha/file-asset-alpha/brief.txt"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
