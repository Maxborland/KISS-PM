import { describe, expect, it } from "vitest";

import { replaceChannelInList } from "./use-comms";
import type { Channel } from "./comms-client";

const channel = (id: string, title: string): Channel => ({
  id,
  channelType: "team",
  title,
  description: "",
  scopeEntityType: "org_unit",
  scopeEntityId: "org-alpha",
  canManage: true,
  createdByUserId: "u-admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null
});

describe("communication channel list state", () => {
  it("replaces a renamed channel in the list without dropping other channels", () => {
    const first = channel("channel-a", "Alpha");
    const second = channel("channel-b", "Beta");
    const renamed = { ...second, title: "Beta edited", updatedAt: "2026-01-02T00:00:00.000Z" };

    expect(replaceChannelInList([first, second], renamed)).toEqual([first, renamed]);
  });

  it("keeps the list unchanged when the patched channel is not present", () => {
    const list = [channel("channel-a", "Alpha")];

    expect(replaceChannelInList(list, channel("channel-missing", "Missing"))).toBe(list);
  });
});
