import { describe, expect, it } from "vitest";

import { createVideoProvider, createVideoProviderFromEnv } from "./videoProvider";

describe("video provider", () => {
  it("returns disabled provider when env is not configured", async () => {
    const provider = createVideoProviderFromEnv({});
    expect(provider.kind).toBe("disabled");
    await expect(provider.issueJoinToken(joinInput())).rejects.toThrow("video_provider_disabled");
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
