import type { ApiTenantDataSource } from "../apiTypes";

export type CommunicationCallDataSource = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "createCallEvent"
  | "createCallRecording"
  | "createCallRoom"
  | "createCallSession"
  | "endCallSession"
  | "findActiveCallSessionForUpdate"
  | "findAttachmentById"
  | "findCallSession"
  | "listUsersByTenantId"
  | "updateCallRoomStatus"
  | "upsertCallParticipantState"
  | "withTransaction"
>;
