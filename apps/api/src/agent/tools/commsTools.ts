import { canManageCommunications, canReadCommunications } from "@kiss-pm/access-control";

import { reTool, type AgentTool } from "../toolKit";

const fields = (hint: string) => ({ fields: { type: "object", description: hint } });
const passFields = (i: Record<string, unknown>) => (i.fields && typeof i.fields === "object" ? i.fields : {});

/**
 * Инструменты коммуникаций — тонкие обёртки над governed-роутами каналов/звонков.
 * Гейтнуты canReadCommunications / canManageCommunications; исполняются generic-редиспатчем.
 */
export const COMMS_TOOLS: AgentTool[] = [
  reTool({ name: "list_communication_channels", title: "Каналы связи", description: "Список каналов коммуникаций (только чтение).", kind: "analyze", canX: canReadCommunications, method: "GET", path: () => "/api/workspace/communication-channels" }),
  reTool({ name: "read_communication_channel", title: "Открыть канал", description: "Прочитать канал и его беседу/участников по channelId (только чтение).", kind: "analyze", canX: canReadCommunications, method: "GET", path: (i) => `/api/workspace/communication-channels/${i.channelId}`, properties: { channelId: { type: "string" } }, required: ["channelId"] }),
  reTool({ name: "create_communication_channel", title: "Создать канал", description: "Создать канал. fields: channelType (обяз.), title (обяз.), description, scopeEntityType, scopeEntityId.", kind: "mutation", canX: canManageCommunications, method: "POST", path: () => "/api/workspace/communication-channels", properties: fields("поля канала (channelType, title обязательны)"), required: ["fields"], body: passFields }),
  reTool({ name: "update_communication_channel", title: "Изменить канал", description: "Изменить канал по channelId. fields: title, description.", kind: "mutation", canX: canManageCommunications, method: "PATCH", path: (i) => `/api/workspace/communication-channels/${i.channelId}`, properties: { channelId: { type: "string" }, ...fields("изменяемые поля канала") }, required: ["channelId", "fields"], body: passFields }),
  reTool({ name: "add_channel_member", title: "Добавить участника канала", description: "Добавить участника в канал. userId — кто, role — роль участника.", kind: "mutation", canX: canManageCommunications, method: "POST", path: (i) => `/api/workspace/communication-channels/${i.channelId}/members`, properties: { channelId: { type: "string" }, userId: { type: "string" }, role: { type: "string" } }, required: ["channelId", "userId", "role"], body: (i) => ({ userId: i.userId, role: i.role }) }),
  reTool({ name: "remove_channel_member", title: "Убрать участника канала", description: "Удалить участника из канала по userId.", kind: "mutation", canX: canManageCommunications, method: "DELETE", path: (i) => `/api/workspace/communication-channels/${i.channelId}/members/${i.userId}`, properties: { channelId: { type: "string" }, userId: { type: "string" } }, required: ["channelId", "userId"] }),
  reTool({ name: "create_call_room", title: "Создать комнату звонка", description: "Создать комнату звонка, привязанную к сущности. entityType/entityId — к чему привязать звонок.", kind: "mutation", canX: canManageCommunications, method: "POST", path: () => "/api/workspace/call-rooms", properties: { entityType: { type: "string" }, entityId: { type: "string" } }, required: ["entityType", "entityId"], body: (i) => ({ entityType: i.entityType, entityId: i.entityId }) })
];
