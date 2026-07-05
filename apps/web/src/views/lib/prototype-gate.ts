// Единая точка показа прототип-заметок ("Прототип", "contract-mock", "данные in-memory",
// демо-креды и т.п.). BUG-014: эти блоки протекали в прод, где данные РЕАЛЬНЫЕ из Postgres,
// и маркеры лгали. По умолчанию скрыты; включаются только явным флагом сборки для Storybook/демо.
//
// Включить в Storybook/демо: NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES=true.
// В прод-сборке переменная не задаётся → заметки не рендерятся.
export const prototypeNotesEnabled =
  process.env.NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES === "true";
