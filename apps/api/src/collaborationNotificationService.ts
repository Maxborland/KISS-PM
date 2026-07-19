import { randomUUID } from "node:crypto";

import {
  deriveControlSignalNotifications,
  derivePlanningNotifications,
  type ControlSignal,
  type PlanningCommand,
  type PlanSnapshot
} from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "./apiTypes";
import { emitNotificationCreated } from "./workspaceEventBus";

type NotificationDataPort = Pick<ApiTenantDataSource, "createUserNotification">;

// P8 realtime: паритет с mention-путём collaborationRoutes — каждое персистентное
// уведомление сопровождается notification.created в user-канал получателя (SSE →
// бейдж/лента обновляются push'ем). Событие — только сигнал инвалидации (userId+type,
// без тела): даже если вызывающая транзакция откатится, клиент сделает лишний
// refetch и не увидит ничего нового — фантомных данных не возникает.

export async function persistPlanningNotifications(input: {
  dataSource: NotificationDataPort;
  tenantId: string;
  actorUserId: string;
  beforeSnapshot: PlanSnapshot;
  afterSnapshot: PlanSnapshot;
  commands: PlanningCommand[];
}): Promise<void> {
  if (!input.dataSource.createUserNotification) return;
  const notifications = derivePlanningNotifications({
    actorUserId: input.actorUserId,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    commands: input.commands
  });
  for (const notification of notifications) {
    await input.dataSource.createUserNotification({
      id: `notification-${randomUUID()}`,
      tenantId: input.tenantId,
      ...notification
    });
    emitNotificationCreated(notification.userId, notification.notificationType);
  }
}

export async function persistControlSignalNotifications(input: {
  dataSource: NotificationDataPort;
  tenantId: string;
  actorUserId: string;
  snapshot: PlanSnapshot;
  signals: ControlSignal[];
  previousSignals?: ControlSignal[];
}): Promise<void> {
  if (!input.dataSource.createUserNotification) return;
  const notificationInput: Parameters<typeof deriveControlSignalNotifications>[0] = {
    actorUserId: input.actorUserId,
    snapshot: input.snapshot,
    signals: input.signals
  };
  if (input.previousSignals) notificationInput.previousSignals = input.previousSignals;
  const notifications = deriveControlSignalNotifications(notificationInput);
  for (const notification of notifications) {
    await input.dataSource.createUserNotification({
      id: `notification-${randomUUID()}`,
      tenantId: input.tenantId,
      ...notification
    });
    emitNotificationCreated(notification.userId, notification.notificationType);
  }
}
