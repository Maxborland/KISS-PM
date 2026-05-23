export type RfHolidayException = {
  date: string;
  reason: string;
};

export const rfHolidays2026: RfHolidayException[] = [
  { date: "2026-01-01", reason: "Новогодние каникулы" },
  { date: "2026-01-02", reason: "Новогодние каникулы" },
  { date: "2026-01-05", reason: "Новогодние каникулы" },
  { date: "2026-01-06", reason: "Новогодние каникулы" },
  { date: "2026-01-07", reason: "Рождество Христово" },
  { date: "2026-01-08", reason: "Новогодние каникулы" },
  { date: "2026-02-23", reason: "День защитника Отечества" },
  { date: "2026-03-09", reason: "Перенос с 8 марта" },
  { date: "2026-05-01", reason: "Праздник Весны и Труда" },
  { date: "2026-05-11", reason: "Перенос с 9 мая" },
  { date: "2026-06-12", reason: "День России" },
  { date: "2026-11-04", reason: "День народного единства" }
];

export const RF_HOLIDAYS_2026_PRESET_ID = "rf-2026";
