import { createHmac, createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { FileAssetProvider } from "@kiss-pm/persistence";

export type StoredObject = {
  bytes: Uint8Array;
  mimeType: string;
  safeDisplayName: string;
};

export type StorageProvider = {
  readonly provider: FileAssetProvider;
  putObject(input: {
    storageKey: string;
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<void>;
  readObject(storageKey: string): Promise<StoredObject>;
  deleteObject(storageKey: string): Promise<void>;
  getSafeDownloadName(storageKey: string): string;
};

export function createStorageProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): StorageProvider {
  if (env.KISS_PM_STORAGE_PROVIDER === "s3") {
    return createS3StorageProvider({
      accessKeyId: requireEnv(env, "KISS_PM_STORAGE_S3_ACCESS_KEY_ID"),
      bucket: requireEnv(env, "KISS_PM_STORAGE_S3_BUCKET"),
      endpoint: requireEnv(env, "KISS_PM_STORAGE_S3_ENDPOINT"),
      region: env.KISS_PM_STORAGE_S3_REGION ?? "us-east-1",
      secretAccessKey: requireEnv(env, "KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY"),
      timeoutMs: parseBoundedIntegerEnv(env, "KISS_PM_STORAGE_S3_TIMEOUT_MS", 15_000, 1_000, 60_000),
      allowInsecureHttp:
        env.KISS_PM_STORAGE_S3_ALLOW_INSECURE_HTTP === "true" &&
        env.NODE_ENV !== "production"
    });
  }

  if (env.NODE_ENV === "production" && !env.KISS_PM_STORAGE_LOCAL_ROOT) {
    throw new Error("kiss_pm_storage_local_root_required");
  }

  return createLocalStorageProvider({
    root: env.KISS_PM_STORAGE_LOCAL_ROOT ?? resolve(process.cwd(), ".kiss-pm-storage")
  });
}

export function createLocalStorageProvider(input: { root: string }): StorageProvider {
  const root = resolve(input.root);

  function resolveKey(storageKey: string): string {
    const resolved = resolve(root, storageKey);
    const relativePath = relative(root, resolved);
    if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("storage_key_invalid");
    }
    return resolved;
  }

  return {
    provider: "local",
    async putObject({ storageKey, bytes }) {
      const path = resolveKey(storageKey);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    async readObject(storageKey) {
      const bytes = await readFile(resolveKey(storageKey));
      return {
        bytes,
        mimeType: "application/octet-stream",
        safeDisplayName: this.getSafeDownloadName(storageKey)
      };
    },
    async deleteObject(storageKey) {
      await rm(resolveKey(storageKey), { force: true });
    },
    getSafeDownloadName(storageKey) {
      return storageKey.split(/[\\/]/).at(-1) || "download";
    }
  };
}

export function createS3StorageProvider(input: {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  timeoutMs?: number;
  allowInsecureHttp?: boolean;
}): StorageProvider {
  const endpoint = normalizeS3Endpoint(input.endpoint, {
    allowInsecureHttp: input.allowInsecureHttp ?? true
  });
  const bucket = normalizeS3Bucket(input.bucket);
  const timeoutMs = input.timeoutMs ?? 15_000;

  async function request(method: string, storageKey: string, bytes?: Uint8Array, mimeType?: string) {
    const encodedKey = storageKey
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const url = new URL(`${endpoint}/${bucket}/${encodedKey}`);
    const payloadHash = sha256(bytes ?? new Uint8Array());
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    };
    if (mimeType) headers["content-type"] = mimeType;

    headers.authorization = signV4({
      accessKeyId: input.accessKeyId,
      dateStamp,
      headers,
      method,
      payloadHash,
      region: input.region,
      secretAccessKey: input.secretAccessKey,
      service: "s3",
      url
    });

    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
    if (bytes) init.body = toArrayBuffer(bytes);
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`s3_storage_${method.toLowerCase()}_failed`);
    }
    return response;
  }

  return {
    provider: "s3",
    async putObject({ storageKey, bytes, mimeType }) {
      await request("PUT", storageKey, bytes, mimeType);
    },
    async readObject(storageKey) {
      const response = await request("GET", storageKey);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type") ?? "application/octet-stream",
        safeDisplayName: this.getSafeDownloadName(storageKey)
      };
    },
    async deleteObject(storageKey) {
      await request("DELETE", storageKey);
    },
    getSafeDownloadName(storageKey) {
      return storageKey.split("/").at(-1) || "download";
    }
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

function normalizeS3Endpoint(
  value: string,
  options: { allowInsecureHttp: boolean }
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("kiss_pm_storage_s3_endpoint_invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("kiss_pm_storage_s3_endpoint_invalid");
  }
  if (url.protocol === "http:" && !options.allowInsecureHttp) {
    throw new Error("kiss_pm_storage_s3_endpoint_insecure");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("kiss_pm_storage_s3_endpoint_invalid");
  }
  return url.origin;
}

function normalizeS3Bucket(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(trimmed)) {
    throw new Error("kiss_pm_storage_s3_bucket_invalid");
  }
  return trimmed;
}

function parseBoundedIntegerEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const value = env[key];
  if (value === undefined || value.trim() === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key.toLowerCase()}_invalid`);
  }
  return parsed;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signV4(input: {
  accessKeyId: string;
  dateStamp: string;
  headers: Record<string, string>;
  method: string;
  payloadHash: string;
  region: string;
  secretAccessKey: string;
  service: string;
  url: URL;
}): string {
  const signedHeaders = Object.keys(input.headers).sort().join(";");
  const canonicalHeaders = Object.keys(input.headers)
    .sort()
    .map((key) => `${key}:${(input.headers[key] ?? "").trim()}\n`)
    .join("");
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash
  ].join("\n");
  const credentialScope = `${input.dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.headers["x-amz-date"] ?? "",
    credentialScope,
    sha256(new TextEncoder().encode(canonicalRequest))
  ].join("\n");
  const dateKey = hmac(`AWS4${input.secretAccessKey}`, input.dateStamp);
  const dateRegionKey = hmac(dateKey, input.region);
  const dateRegionServiceKey = hmac(dateRegionKey, input.service);
  const signingKey = hmac(dateRegionServiceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");
  return [
    "AWS4-HMAC-SHA256",
    `Credential=${input.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
