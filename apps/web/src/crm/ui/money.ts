export const rub = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;

export const money = (v: number) =>
  v < 1000
    ? rub(v)
    : v >= 1_000_000
      ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
      : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`;
