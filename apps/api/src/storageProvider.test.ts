import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { createLocalStorageProvider } from "./storageProvider";

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
