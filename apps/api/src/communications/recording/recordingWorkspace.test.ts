import { describe, expect, it } from "vitest";

import type { CallRecording, CallRoom, CallSession, TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../../apiTypes";
import type { CommunicationCallAccess } from "../callWorkspace";
import type { LiveKitEgressProvider } from "./livekitEgressProvider";
import {
  createCommunicationRecordingWorkspace,
  type CommunicationRecordingDataSource
} from "./recordingWorkspace";

type CreateRecordingInput = Parameters<
  NonNullable<CommunicationRecordingDataSource["createCallRecording"]>
>[0];

describe("createCommunicationRecordingWorkspace", () => {
  it("waits for transaction rollback before inserting orphan compensation", async () => {
    let transactionOpen = false;
    const compensationTransactionStates: boolean[] = [];
    const compensationRows: CreateRecordingInput[] = [];

    const asRecording = (input: CreateRecordingInput) => input as unknown as CallRecording;
    const transactionDataSource = {
      async lockCallRecordingStart() {},
      async listCallRecordings() {
        return [];
      },
      async createCallRecording(input: CreateRecordingInput) {
        return asRecording(input);
      },
      async createCallEvent() {
        return {} as never;
      },
      async appendAuditEvent() {}
    } as unknown as ApiTenantDataSource;

    const dataSource = {
      async lockCallRecordingStart() {},
      async listCallRecordings() {
        return [];
      },
      async createCallEvent() {
        return {} as never;
      },
      async appendAuditEvent() {},
      async createCallRecording(input: CreateRecordingInput) {
        compensationTransactionStates.push(transactionOpen);
        if (transactionOpen) {
          throw new Error("compensation_before_rollback");
        }
        compensationRows.push(input);
        return asRecording(input);
      },
      async withTransaction<T>(
        callback: (transactionDataSource: ApiTenantDataSource) => Promise<T>
      ): Promise<T> {
        transactionOpen = true;
        try {
          return await callback(transactionDataSource);
        } finally {
          transactionOpen = false;
        }
      }
    } as unknown as CommunicationRecordingDataSource;

    const egressProvider: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [{ trackId: "track-1", kind: "video", participantIdentity: "user-1" }];
      },
      async startTrackEgress() {
        return "egress-1";
      },
      async stopEgress() {
        throw new Error("provider_unavailable");
      },
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    const workspace = createCommunicationRecordingWorkspace({
      dataSource,
      egressProvider,
      async appendManagementAuditEvent() {
        throw new Error("audit_write_failed");
      }
    });

    await expect(
      workspace.startRecording({
        access: {
          manageDecision: { allowed: true },
          sourceEntity: { type: "CallRoom", id: "room-1" }
        } as unknown as CommunicationCallAccess,
        actor: { id: "user-1", tenantId: "tenant-1" } as TenantUser,
        room: {
          id: "room-1",
          tenantId: "tenant-1",
          provider: "livekit",
          providerRoomId: "provider-room-1"
        } as CallRoom,
        session: {
          id: "session-1",
          tenantId: "tenant-1",
          roomId: "room-1",
          status: "active"
        } as CallSession
      })
    ).rejects.toThrow("audit_write_failed");

    expect(compensationTransactionStates).toEqual([false]);
    expect(compensationRows).toHaveLength(1);
    expect(compensationRows[0]).toMatchObject({
      tenantId: "tenant-1",
      roomId: "room-1",
      sessionId: "session-1",
      egressId: "egress-1",
      trackId: "track-1",
      status: "recording"
    });
  });
});