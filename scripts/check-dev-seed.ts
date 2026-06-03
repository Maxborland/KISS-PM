import { createPostgresClient } from "@kiss-pm/persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const expected = {
  clientsMin: 3,
  dealsMin: 5,
  projectsMin: 4,
  tasksMin: 20,
  tasksMax: 40,
  usersMin: 5,
  usersMax: 8,
  taskAssignmentsMin: 20,
  auditEventsMin: 3
};

const client = createPostgresClient(databaseUrl);

try {
  const [counts] = await client<{
    clients: number;
    deals: number;
    projects: number;
    tasks: number;
    users: number;
    taskAssignments: number;
    overdueTasks: number;
    waitingTasks: number;
    auditEvents: number;
  }[]>`
    select
      (select count(*)::int from clients where tenant_id = 'tenant-alpha') as "clients",
      (select count(*)::int from opportunities where tenant_id = 'tenant-alpha') as "deals",
      (select count(*)::int from projects where tenant_id = 'tenant-alpha') as "projects",
      (select count(*)::int from tasks where tenant_id = 'tenant-alpha' and archived_at is null) as "tasks",
      (select count(*)::int from tenant_users where tenant_id = 'tenant-alpha') as "users",
      (select count(*)::int from task_assignments where tenant_id = 'tenant-alpha') as "taskAssignments",
      (
        select count(*)::int
        from tasks
        where tenant_id = 'tenant-alpha'
          and archived_at is null
          and planned_finish::date < date '2026-06-03'
          and status <> 'done'
      ) as "overdueTasks",
      (
        select count(*)::int
        from tasks
        where tenant_id = 'tenant-alpha'
          and archived_at is null
          and status = 'waiting'
      ) as "waitingTasks",
      (select count(*)::int from audit_events where tenant_id = 'tenant-alpha') as "auditEvents"
  `;

  const [missingRole] = await client<{ missingRoleDemandCount: number }[]>`
    select count(*)::int as "missingRoleDemandCount"
    from project_position_demands demand
    left join tenant_users users
      on users.tenant_id = demand.tenant_id
      and users.position_id = demand.position_id
    where demand.tenant_id = 'tenant-alpha'
      and users.id is null
  `;

  const [overload] = await client<{ overloadBuckets: number }[]>`
    select count(*)::int as "overloadBuckets"
    from (
      select assignment.resource_id, task.planned_start::date as day, sum(assignment.work_minutes) as work_minutes
      from task_assignments assignment
      inner join tasks task
        on task.tenant_id = assignment.tenant_id
        and task.id = assignment.task_id
      where assignment.tenant_id = 'tenant-alpha'
      group by assignment.resource_id, task.planned_start::date
      having sum(assignment.work_minutes) > 480
    ) overloaded
  `;

  const [dealNextAction] = await client<{
    nextActionFields: number;
    dealsWithNextAction: number;
  }[]>`
    select
      (
        select count(*)::int
        from custom_field_definitions
        where tenant_id = 'tenant-alpha'
          and id = 'next_action'
          and target_entity = 'opportunity'
          and status = 'active'
      ) as "nextActionFields",
      (
        select count(*)::int
        from opportunities
        where tenant_id = 'tenant-alpha'
          and coalesce(custom_field_values ->> 'next_action', '') <> ''
      ) as "dealsWithNextAction"
  `;

  assertRange("clients", counts.clients, expected.clientsMin);
  assertRange("deals", counts.deals, expected.dealsMin);
  assertRange("projects", counts.projects, expected.projectsMin);
  assertRange("tasks", counts.tasks, expected.tasksMin, expected.tasksMax);
  assertRange("users", counts.users, expected.usersMin, expected.usersMax);
  assertRange("taskAssignments", counts.taskAssignments, expected.taskAssignmentsMin);
  assertRange("auditEvents", counts.auditEvents, expected.auditEventsMin);
  assertRange("overdueTasks", counts.overdueTasks, 1);
  assertRange("waitingTasks", counts.waitingTasks, 1);
  assertRange("missingRoleDemandCount", missingRole.missingRoleDemandCount, 1);
  assertRange("overloadBuckets", overload.overloadBuckets, 1);
  assertRange("nextActionFields", dealNextAction.nextActionFields, 1, 1);
  assertRange("dealsWithNextAction", dealNextAction.dealsWithNextAction, 2);

  console.log("[db:seed:check] Beta seed OK", {
    ...counts,
    missingRoleDemandCount: missingRole.missingRoleDemandCount,
    overloadBuckets: overload.overloadBuckets,
    nextActionFields: dealNextAction.nextActionFields,
    dealsWithNextAction: dealNextAction.dealsWithNextAction
  });
} finally {
  await client.end();
}

function assertRange(name: string, actual: number, min: number, max = Number.POSITIVE_INFINITY): void {
  if (actual < min || actual > max) {
    throw new Error(`[db:seed:check] ${name} expected ${min}-${max}, got ${actual}`);
  }
}
