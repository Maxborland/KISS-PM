export type ChangeStatus = 'selected' | 'modified' | 'rejected' | 'permission_required' | 'outdated' | 'applied';

export interface ChangeHunk {
  id: string;
  field: string;
  before: string;
  after: string;
  status: ChangeStatus;
  selected: boolean;
  type: 'date' | 'select' | 'text' | 'string';
  options?: string[];
}

export const INITIAL_CHANGES: ChangeHunk[] = [
  {
    id: 'c1',
    field: 'Срок задачи',
    before: '12 июня',
    after: '15 июня',
    status: 'selected',
    selected: true,
    type: 'date'
  },
  {
    id: 'c2',
    field: 'Владелец',
    before: 'не назначен',
    after: 'Анна Морозова',
    status: 'selected',
    selected: true,
    type: 'select',
    options: ['Анна Морозова', 'Иван Петров', 'Мария К.']
  },
  {
    id: 'c3',
    field: 'Задача',
    before: 'Подготовить макеты',
    after: 'Подготовить макеты v2',
    status: 'selected',
    selected: true,
    type: 'text'
  },
  {
    id: 'c4',
    field: 'Статус',
    before: 'В работе',
    after: 'На проверке',
    status: 'selected',
    selected: true,
    type: 'select',
    options: ['В работе', 'На проверке', 'Готово', 'Отложено']
  },
  {
    id: 'c5',
    field: 'Встреча',
    before: 'Демо для клиента, 13 июня',
    after: 'Демо для клиента, 16 июня',
    status: 'selected',
    selected: true,
    type: 'string' // generic string input
  }
];

export const THINKING_STEPS = [
  "Читает задачи",
  "Проверяет сроки",
  "Смотрит зависимости",
  "Сверяет загрузку",
  "Готовит сверку"
];
