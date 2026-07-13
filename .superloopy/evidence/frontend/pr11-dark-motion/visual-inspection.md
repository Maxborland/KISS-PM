# PR11 — visual inspection

Проверено 2026-07-13 после зелёного live E2E на `/agent`.

- `390`: мобильный shell без горизонтального overflow; demo-баннер переносится, composer и кнопки остаются в viewport.
- `768`: боковая навигация, header, пустое состояние и composer не перекрываются.
- `1280`: canvas и панели используют согласованную surface ladder; светлых островов в dark-варианте нет.
- Light/dark: semantic status, priority и shadow tokens различаются по computed styles; ключевые text/background пары проходят AA-гейт.
- Normal/reduced: статичный кадр не прыгает; live Popover в normal имеет анимацию, в reduced — lifecycle-safe `0.01ms` без zoom/slide transform.
- Focus: Escape закрывает Popover и возвращает фокус на «Сведения об агенте».

Текущая матрица находится в `current/`: 390/768/1280 × light/dark × normal/reduced, ровно 12 PNG.
