export type OpportunityFeasibilityStatus = "ok" | "warning" | "conflict" | "blocked";

export type OpportunityFeasibilityBlocker =
  | "invalid_dates"
  | "invalid_contract_terms"
  | "demand_required"
  | "demand_exceeds_planned_hours"
  | "missing_position_capacity";

export type OpportunityFeasibilityWarning = "unallocated_planned_hours";

export type OpportunityFeasibilityDemandLine = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityFeasibilityPosition = {
  id: string;
  name: string;
  activeUsers: number;
};

export type OpportunityFeasibilityReservation = {
  projectId: string;
  positionId: string;
  requiredHours: number;
  plannedStart: Date;
  plannedFinish: Date;
};

export type OpportunityFeasibilityRow = {
  positionId: string;
  positionName: string;
  requiredHours: number;
  availableHours: number;
  reservedHours: number;
  shortageHours: number;
  status: Exclude<OpportunityFeasibilityStatus, "blocked">;
};

export type OpportunityFeasibilityAssessment = {
  opportunityId: string;
  plannedHours: number;
  totalRequiredHours: number;
  workingDays: number;
  status: OpportunityFeasibilityStatus;
  blockers: OpportunityFeasibilityBlocker[];
  warnings: OpportunityFeasibilityWarning[];
  rows: OpportunityFeasibilityRow[];
};

const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5] as const; // ISO Пн..Пт

/** Производственный календарь для оценки реализуемости. workingWeekdays — ISO 1..7 (Пн..Вс). */
export type FeasibilityCalendar = {
  workingWeekdays: readonly number[];
  workingMinutesPerDay: number;
  /** Нерабочие даты (праздники/переносы), ISO YYYY-MM-DD. */
  holidays: ReadonlySet<string>;
};

function hoursPerDayOf(calendar?: FeasibilityCalendar): number {
  if (!calendar || !Number.isFinite(calendar.workingMinutesPerDay) || calendar.workingMinutesPerDay <= 0) {
    return DEFAULT_HOURS_PER_DAY;
  }
  return calendar.workingMinutesPerDay / 60;
}

export function calculatePlannedHours(
  contractValue: number,
  plannedHourlyRate: number
): number {
  if (!Number.isFinite(contractValue) || !Number.isFinite(plannedHourlyRate)) {
    return 0;
  }
  if (contractValue <= 0 || plannedHourlyRate <= 0) return 0;

  return Math.floor(contractValue / plannedHourlyRate);
}

export function countWorkingDays(start: Date, finish: Date, calendar?: FeasibilityCalendar): number {
  if (finish.getTime() < start.getTime()) return 0;

  const workingSet = new Set<number>(calendar?.workingWeekdays ?? DEFAULT_WORKING_WEEKDAYS);
  let count = 0;
  const cursor = startOfUtcDay(start);
  const end = startOfUtcDay(finish);

  while (cursor.getTime() <= end.getTime()) {
    const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay(); // 1..7 (Пн..Вс)
    const dateIso = cursor.toISOString().slice(0, 10);
    const isHoliday = calendar?.holidays.has(dateIso) ?? false;
    if (workingSet.has(isoWeekday) && !isHoliday) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

export function assessOpportunityFeasibility(input: {
  opportunity: {
    id: string;
    plannedStart: Date;
    plannedFinish: Date;
    contractValue: number;
    plannedHourlyRate: number;
  };
  demand: readonly OpportunityFeasibilityDemandLine[];
  positions: readonly OpportunityFeasibilityPosition[];
  activeProjectReservations: readonly OpportunityFeasibilityReservation[];
  /** Произв. календарь тенанта. Без него — Пн-Пт по 8ч (обратная совместимость). */
  calendar?: FeasibilityCalendar;
}): OpportunityFeasibilityAssessment {
  const plannedHours = calculatePlannedHours(
    input.opportunity.contractValue,
    input.opportunity.plannedHourlyRate
  );
  const workingDays = countWorkingDays(
    input.opportunity.plannedStart,
    input.opportunity.plannedFinish,
    input.calendar
  );
  const hoursPerDay = hoursPerDayOf(input.calendar);
  // Number.isFinite-гард: NaN/Infinity в requiredHours иначе обходит все проверки (сравнения с NaN
  // всегда false) и инфизибл-возможность репортится "ok" с NaN-итогами. Не-конечный спрос = 0.
  const requiredHoursOf = (hours: number) => (Number.isFinite(hours) ? hours : 0);
  const totalRequiredHours = input.demand.reduce(
    (sum, line) => sum + requiredHoursOf(line.requiredHours),
    0
  );
  const blockers = new Set<OpportunityFeasibilityBlocker>();
  const warnings = new Set<OpportunityFeasibilityWarning>();

  if (workingDays <= 0) blockers.add("invalid_dates");
  if (plannedHours <= 0) blockers.add("invalid_contract_terms");
  if (totalRequiredHours <= 0) blockers.add("demand_required");
  if (plannedHours > 0 && totalRequiredHours > plannedHours) {
    blockers.add("demand_exceeds_planned_hours");
  }
  if (plannedHours > 0 && totalRequiredHours > 0 && totalRequiredHours < plannedHours) {
    warnings.add("unallocated_planned_hours");
  }

  const rows = input.demand.map<OpportunityFeasibilityRow>((line) => {
    const required = requiredHoursOf(line.requiredHours);
    const position = input.positions.find((item) => item.id === line.positionId);
    const reservedHours = calculateReservedHours({
      reservations: input.activeProjectReservations.filter(
        (reservation) => reservation.positionId === line.positionId
      ),
      requestedStart: input.opportunity.plannedStart,
      requestedFinish: input.opportunity.plannedFinish,
      ...(input.calendar ? { calendar: input.calendar } : {})
    });
    const grossHours = (position?.activeUsers ?? 0) * workingDays * hoursPerDay;
    const availableHours = Math.max(0, grossHours - reservedHours);
    const shortageHours = Math.max(0, required - availableHours);

    if (!position || position.activeUsers <= 0) {
      blockers.add("missing_position_capacity");
    }

    return {
      positionId: line.positionId,
      positionName: position?.name ?? "Должность не найдена",
      requiredHours: required,
      availableHours,
      reservedHours,
      shortageHours,
      status: shortageHours > 0 ? "conflict" : "ok"
    };
  });

  const hasShortage = rows.some((row) => row.shortageHours > 0);
  const status = resolveAssessmentStatus({
    hasBlockers: blockers.size > 0,
    hasShortage,
    hasWarnings: warnings.size > 0
  });

  return {
    opportunityId: input.opportunity.id,
    plannedHours,
    totalRequiredHours,
    workingDays,
    status,
    blockers: [...blockers],
    warnings: [...warnings],
    rows
  };
}

function calculateReservedHours(input: {
  reservations: readonly OpportunityFeasibilityReservation[];
  requestedStart: Date;
  requestedFinish: Date;
  calendar?: FeasibilityCalendar;
}): number {
  return input.reservations.reduce((sum, reservation) => {
    const reservationDays = countWorkingDays(
      reservation.plannedStart,
      reservation.plannedFinish,
      input.calendar
    );
    const overlapDays = countWorkingDays(
      maxDate(input.requestedStart, reservation.plannedStart),
      minDate(input.requestedFinish, reservation.plannedFinish),
      input.calendar
    );

    if (reservationDays <= 0 || overlapDays <= 0) return sum;

    return sum + Math.ceil(reservation.requiredHours * (overlapDays / reservationDays));
  }, 0);
}

function resolveAssessmentStatus(input: {
  hasBlockers: boolean;
  hasShortage: boolean;
  hasWarnings: boolean;
}): OpportunityFeasibilityStatus {
  if (input.hasBlockers) return "blocked";
  if (input.hasShortage) return "conflict";
  if (input.hasWarnings) return "warning";
  return "ok";
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}
