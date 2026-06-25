/**
 * Единый язык цветов нерабочих дней для всех плотных таблиц Project Delivery
 * (матрица ресурсов, календари): выходной — серый, праздник — янтарный (текст затемнён
 * для контраста ≥4.5:1), отпуск/отсутствие — фиолетовый. Один источник правды, чтобы
 * рендер ячейки и легенда не расходились и значения совпадали между поверхностями.
 *
 * Значения как inline-стили (bg/fg/border): подходят и для матрицы (style={{background}}),
 * и для календарей (Tailwind arbitrary-классы нельзя собрать динамически — JIT их не увидит).
 */
export type NonWorkingTone = { bg: string; fg: string; border: string };

export const NON_WORKING_TONE: {
  weekend: NonWorkingTone;
  holiday: NonWorkingTone;
  absence: NonWorkingTone;
} = {
  weekend: { bg: "color-mix(in oklab, var(--muted-soft) 24%, var(--panel))", fg: "var(--muted-strong)", border: "var(--border-subtle)" },
  holiday: { bg: "color-mix(in oklab, var(--warning) 32%, var(--panel))", fg: "color-mix(in oklab, var(--warning-text) 80%, #000)", border: "var(--warning)" },
  absence: { bg: "color-mix(in oklab, var(--violet) 30%, var(--panel))", fg: "var(--violet)", border: "var(--violet)" }
};
