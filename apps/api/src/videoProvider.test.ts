import { describe, expect, it } from "vitest";

import { createVideoProvider, createVideoProviderFromEnv } from "./videoProvider";

describe("video provider", () => {
  it("returns disabled provider when env is not configured", async () => {
    const provider = createVideoProviderFromEnv({});
    expect(provider.kind).toBe("disabled");
    await expect(provider.issueJoinToken(joinInput())).rejects.toThrow("video_provider_disabled");
  });

  it("accepts explicit disabled provider env", async () => {
    const provider = createVideoProviderFromEnv({
      KISS_PM_VIDEO_PROVIDER: "disabled"
    } as NodeJS.ProcessEnv);

    expect(provider.kind).toBe("disabled");
    await expect(provider.issueJoinToken(joinInput())).rejects.toThrow("video_provider_disabled");
  });

  it("fails closed for malformed video provider env", () => {
    expect(() =>
      createVideoProviderFromEnv({
        KISS_PM_VIDEO_PROVIDER: "livekit-preview"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
    expect(() =>
      createVideoProviderFromEnv({
        KISS_PM_VIDEO_JITSI_BASE_URL: "https://meet.kiss.local",
        KISS_PM_VIDEO_PROVIDER: "jitsi "
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
  });

  it("requires strict bounded LiveKit token TTL env", () => {
    const baseEnv = {
      KISS_PM_VIDEO_LIVEKIT_API_KEY: "livekit-key",
      KISS_PM_VIDEO_LIVEKIT_API_SECRET: "livekit-secret",
      KISS_PM_VIDEO_LIVEKIT_URL: "https://livekit.kiss.local",
      KISS_PM_VIDEO_PROVIDER: "livekit"
    } as NodeJS.ProcessEnv;

    expect(() =>
      createVideoProviderFromEnv({
        ...baseEnv,
        KISS_PM_VIDEO_TOKEN_TTL_SECONDS: "120abc"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
    expect(() =>
      createVideoProviderFromEnv({
        ...baseEnv,
        KISS_PM_VIDEO_TOKEN_TTL_SECONDS: "59"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
    expect(() =>
      createVideoProviderFromEnv({
        ...baseEnv,
        KISS_PM_VIDEO_TOKEN_TTL_SECONDS: "3601"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
    expect(
      createVideoProviderFromEnv({
        ...baseEnv,
        KISS_PM_VIDEO_TOKEN_TTL_SECONDS: "120"
      } as NodeJS.ProcessEnv).kind
    ).toBe("livekit");
  });

  it("rejects LiveKit secrets with surrounding whitespace", () => {
    expect(() =>
      createVideoProviderFromEnv({
        KISS_PM_VIDEO_LIVEKIT_API_KEY: " livekit-key",
        KISS_PM_VIDEO_LIVEKIT_API_SECRET: "livekit-secret",
        KISS_PM_VIDEO_LIVEKIT_URL: "https://livekit.kiss.local",
        KISS_PM_VIDEO_PROVIDER: "livekit"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_misconfigured");
  });

  it("builds safe Jitsi join URLs without token", async () => {
    const provider = createVideoProvider({ kind: "jitsi", baseUrl: "https://meet.kiss.local/" });
    await expect(provider.issueJoinToken(joinInput())).resolves.toEqual({
      provider: "jitsi",
      joinUrl: "https://meet.kiss.local/project-alpha-room",
      token: null,
      expiresAt: null
    });
  });

  it("rejects provider URLs with embedded credentials", () => {
    expect(() =>
      createVideoProvider({ kind: "jitsi", baseUrl: "https://user:secret@meet.kiss.local" })
    ).toThrow("video_provider_misconfigured");
  });

  it("rejects insecure provider URLs from production env", () => {
    expect(() =>
      createVideoProviderFromEnv({
        NODE_ENV: "production",
        KISS_PM_VIDEO_JITSI_BASE_URL: "http://meet.kiss.local",
        KISS_PM_VIDEO_PROVIDER: "jitsi"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_insecure_url");
  });

  it("generates LiveKit-compatible short-lived JWT without leaking secret", async () => {
    const provider = createVideoProvider({
      kind: "livekit",
      url: "https://livekit.kiss.local",
      apiKey: "livekit-key",
      apiSecret: "livekit-secret",
      tokenTtlSeconds: 120
    });

    const result = await provider.issueJoinToken(joinInput());

    expect(result.provider).toBe("livekit");
    expect(result.joinUrl).toBe("https://livekit.kiss.local");
    expect(result.token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(result.token).not.toContain("livekit-secret");

    const [, payload] = result.token?.split(".") ?? [];
    const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")) as {
      video: { room: string; roomJoin: boolean };
      metadata: string;
    };
    expect(claims.video).toMatchObject({ room: "project-alpha-room", roomJoin: true });
    expect(JSON.parse(claims.metadata)).toMatchObject({
      kissPmRoomId: "call-room-alpha",
      tenantId: "tenant-alpha"
    });
  });

  it("accepts secure WebSocket (wss) LiveKit URLs", async () => {
    const provider = createVideoProvider({
      kind: "livekit",
      url: "wss://livekit.kiss.local",
      apiKey: "livekit-key",
      apiSecret: "livekit-secret",
      tokenTtlSeconds: 120
    });

    const result = await provider.issueJoinToken(joinInput());
    expect(result.provider).toBe("livekit");
    expect(result.joinUrl).toBe("wss://livekit.kiss.local");
  });

  it("accepts wss LiveKit URLs from env", () => {
    expect(
      createVideoProviderFromEnv({
        KISS_PM_VIDEO_LIVEKIT_API_KEY: "livekit-key",
        KISS_PM_VIDEO_LIVEKIT_API_SECRET: "livekit-secret",
        KISS_PM_VIDEO_LIVEKIT_URL: "wss://livekit.kiss.local",
        KISS_PM_VIDEO_PROVIDER: "livekit"
      } as NodeJS.ProcessEnv).kind
    ).toBe("livekit");
  });

  it("treats ws LiveKit URLs as insecure unless explicitly allowed", () => {
    expect(() =>
      createVideoProvider({
        kind: "livekit",
        url: "ws://livekit.kiss.local",
        apiKey: "livekit-key",
        apiSecret: "livekit-secret",
        allowInsecureHttp: false
      })
    ).toThrow("video_provider_insecure_url");

    expect(
      createVideoProvider({
        kind: "livekit",
        url: "ws://livekit.kiss.local",
        apiKey: "livekit-key",
        apiSecret: "livekit-secret",
        allowInsecureHttp: true
      }).kind
    ).toBe("livekit");
  });

  it("rejects insecure ws LiveKit URLs from production env", () => {
    expect(() =>
      createVideoProviderFromEnv({
        NODE_ENV: "production",
        KISS_PM_VIDEO_LIVEKIT_API_KEY: "livekit-key",
        KISS_PM_VIDEO_LIVEKIT_API_SECRET: "livekit-secret",
        KISS_PM_VIDEO_LIVEKIT_URL: "ws://livekit.kiss.local",
        KISS_PM_VIDEO_PROVIDER: "livekit"
      } as NodeJS.ProcessEnv)
    ).toThrow("video_provider_insecure_url");
  });

  it("still rejects WebSocket URLs for non-LiveKit providers", () => {
    expect(() =>
      createVideoProvider({ kind: "jitsi", baseUrl: "wss://meet.kiss.local" })
    ).toThrow("video_provider_misconfigured");
  });
});

function joinInput() {
  return {
    providerRoomId: "project-alpha-room",
    roomId: "call-room-alpha",
    tenantId: "tenant-alpha",
    userId: "user-alpha-admin",
    userName: "Анна"
  };
}
