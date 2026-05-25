"use client";

import { useState } from "react";
import {
  Archive,
  Briefcase,
  Copy,
  Download,
  Folder,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2
} from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Field, FormActions, FormGrid, FormSection, TagsInput } from "@/components/domain/form-layout";
import { PriorityFlag } from "@/components/domain/priority-flag";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BannerInline } from "@/components/ui/banner-inline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchPill } from "@/components/ui/search-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton, SkeletonRow, SkeletonText } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppShell } from "@/shell/app-shell";
import { AppSidebar } from "@/shell/app-sidebar";
import { AppTopbar } from "@/shell/app-topbar";
import { TopbarBreadcrumbs } from "@/shell/topbar-breadcrumbs";
import { Kanban, TaskKanbanCard, type KanbanColumnDef, type TaskKanbanItem } from "@/widgets/kanban";

import { MOCK_PROJECT_CRM, mockTaskProjectRef } from "@/views/catalog";

import { ShowcaseFrame } from "./ShowcaseFrame";

export function ButtonShowcase() {
  return (
    <ShowcaseFrame
      title="Кнопки"
      hint="По умолчанию · основная · мягкая · вторичная · контур · прозрачная · опасная · мягкая опасная · ссылка"
    >
      <section className="ds-demo__row">
        <Button variant="default">
          <Plus className="size-4" aria-hidden />
          Создать задачу
        </Button>
        <Button variant="primary">
          <Plus className="size-4" aria-hidden />
          Применить
        </Button>
        <Button variant="soft">
          <Star className="size-4" aria-hidden />
          В избранное
        </Button>
        <Button variant="secondary">
          <Download className="size-4" aria-hidden />
          Экспорт
        </Button>
        <Button variant="outline">Контур</Button>
        <Button variant="ghost">Отмена</Button>
        <Button variant="destructive">
          <Trash2 className="size-4" aria-hidden />
          Удалить
        </Button>
        <Button variant="destructive-soft">
          <Trash2 className="size-4" aria-hidden />
          Архивировать
        </Button>
        <Button variant="link">Подробнее</Button>
        <Button variant="primary" disabled>
          Недоступно
        </Button>
      </section>
      <section className="ds-demo__row u-mt-3">
        <Button variant="primary" size="lg">
          Большая кнопка
        </Button>
        <Button variant="secondary">Стандарт</Button>
        <Button variant="secondary" size="sm">
          Маленькая
        </Button>
        <Button variant="ghost" size="xs">
          XS
        </Button>
        <Button variant="ghost" size="icon" aria-label="Ещё">
          <MoreHorizontal className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Ещё">
          <MoreHorizontal className="size-4" />
        </Button>
      </section>
    </ShowcaseFrame>
  );
}

export function IconButtonShowcase() {
  return (
    <ShowcaseFrame title="Кнопка-иконка" hint="прозрачная · мягкая · заливка · контур · опасная · sm/md/lg">
      <section className="ds-demo__row">
        <IconButton label="Редактировать" variant="ghost">
          <Pencil />
        </IconButton>
        <IconButton label="Скопировать" variant="soft">
          <Copy />
        </IconButton>
        <IconButton label="Создать" variant="solid">
          <Plus />
        </IconButton>
        <IconButton label="В архив" variant="outline">
          <Archive />
        </IconButton>
        <IconButton label="Удалить" variant="destructive">
          <Trash2 />
        </IconButton>
      </section>
      <section className="ds-demo__row u-mt-3">
        <IconButton label="Маленький" size="sm" variant="ghost">
          <Star />
        </IconButton>
        <IconButton label="Средний" size="md" variant="ghost">
          <Star />
        </IconButton>
        <IconButton label="Большой" size="lg" variant="ghost">
          <Star />
        </IconButton>
      </section>
    </ShowcaseFrame>
  );
}

export function AvatarShowcase() {
  return (
    <ShowcaseFrame title="Аватар">
      <div className="ds-demo__row">
        <BemAvatar initials="ИИ" color="c1" size="sm" />
        <BemAvatar initials="АП" color="c2" />
        <BemAvatar initials="КБ" color="c3" size="md" />
        <BemAvatar initials="ВВ" color="c4" size="lg" />
        <BemAvatar initials="МД" color="c5" size="xl" />
      </div>
      <div className="ds-demo__row u-mt-3">
        <BemAvatarStack more="+3">
          <BemAvatar initials="ИИ" color="c1" />
          <BemAvatar initials="АП" color="c2" />
          <BemAvatar initials="КБ" color="c3" />
        </BemAvatarStack>
      </div>
    </ShowcaseFrame>
  );
}

export function BadgeShowcase() {
  return (
    <ShowcaseFrame title="Бейдж и приоритет" hint="бейдж 12px · приоритеты 12px · кнопки 12px (по умолчанию)">
      <div className="ds-demo__row">
        <Badge>24</Badge>
        <Badge variant="primary">Новый</Badge>
        <Badge variant="success">Успех</Badge>
        <Badge variant="warning">Внимание</Badge>
        <Badge variant="outline">Контур</Badge>
        <PriorityFlag level="urgent" label="Срочный" />
        <PriorityFlag level="normal" label="Обычный" />
        <PriorityFlag level="low" label="Низкий" />
      </div>
    </ShowcaseFrame>
  );
}

export function TableShowcase() {
  return (
    <ShowcaseFrame title="Таблица" wide>
      <DataTable>
        <thead>
          <tr>
            <th>Название</th>
            <th>Клиент</th>
            <th>Ответственный</th>
            <th>Статус</th>
            <th>Срок</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr className="is-selected">
            <td>
              <CellStack title={MOCK_PROJECT_CRM} subtitle="PRJ-2026-014" icon={<Briefcase className="size-4" />} />
            </td>
            <td>ООО «Ромашка»</td>
            <td>
              <BemAvatar initials="ИИ" color="c1" /> Иванова М.
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">27.05.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия">
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <CellStack title="DataHub KPI" subtitle="PRJ-2026-009" icon={<Folder className="size-4" />} />
            </td>
            <td>АО «Техно»</td>
            <td>
              <BemAvatar initials="АП" color="c2" /> Петров А.
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">12.06.2026</td>
            <td className="cell-actions">
              <Button variant="ghost" size="icon-sm" aria-label="Действия">
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </DataTable>
    </ShowcaseFrame>
  );
}

export function EntityRowShowcase() {
  return (
    <ShowcaseFrame title="Строка сущности" wide>
      <DataTable>
        <tbody>
          <tr>
            <td>
              <CellStack title="Подготовить КП" subtitle="Сделка «Ромашка»" icon={<Briefcase className="size-4" />} />
            </td>
            <td>
              <Chip variant="info">В работе</Chip>
            </td>
            <td className="mono cell-muted">23.05</td>
            <td>
              <BemAvatar initials="ИИ" color="c1" />
            </td>
            <td className="cell-actions">
              <Button variant="ghost" size="sm" aria-label="Действия">
                <MoreHorizontal className="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </DataTable>
    </ShowcaseFrame>
  );
}

type ShowcaseColumnId = "backlog" | "in-progress";

const KANBAN_SHOWCASE_COLUMNS: KanbanColumnDef<ShowcaseColumnId>[] = [
  { id: "backlog", title: "Бэклог" },
  { id: "in-progress", title: "В работе" }
];

const KANBAN_SHOWCASE_ITEMS: TaskKanbanItem<ShowcaseColumnId>[] = [
  {
    id: "MDS-39",
    columnId: "backlog",
    title: "Новая страница продукта",
    priority: "urgent",
    priorityLabel: "Срочный",
    meta: [{ label: "Новая Homepage" }, { label: "Срок: 29 июля" }],
    assignees: [{ initials: "ИИ", color: "c1" }],
    comments: 13,
    date: "30.05.2024"
  },
  {
    id: "MDS-2",
    columnId: "in-progress",
    title: "Презентация для клиента",
    priority: "low",
    priorityLabel: "Низкий",
    highlight: true,
    assignees: [
      { initials: "КБ", color: "c4" },
      { initials: "МД", color: "c5" }
    ],
    comments: 7,
    date: "31.05.2024"
  }
];

export function KanbanShowcase() {
  return (
    <ShowcaseFrame title="Канбан" wide>
      <Kanban<TaskKanbanItem<ShowcaseColumnId>, ShowcaseColumnId>
        columns={KANBAN_SHOWCASE_COLUMNS}
        items={KANBAN_SHOWCASE_ITEMS}
        renderCard={(item, ctx) => (
          <TaskKanbanCard
            item={item}
            draggable={ctx.draggable}
            isDragging={ctx.isDragging}
            visibleFields={ctx.visibleFields}
          />
        )}
      />
    </ShowcaseFrame>
  );
}

export function KanbanCardShowcase() {
  const item = KANBAN_SHOWCASE_ITEMS[0]!;
  return (
    <ShowcaseFrame title="Карточка канбана">
      <TaskKanbanCard item={item} draggable={false} isDragging={false} />
    </ShowcaseFrame>
  );
}

export function FormShowcase() {
  return (
    <ShowcaseFrame title="Форма — создание сделки" wide>
      <CardPanel flush>
        <FormSection
          title="Основная информация"
          lead="Эти поля видны всей команде рабочей области."
          actions={
            <Button variant="ghost" size="sm">
              Сбросить
            </Button>
          }
        >
          <FormGrid>
            <Field label="Название сделки" full required htmlFor="deal-name">
              <Input id="deal-name" defaultValue="Внедрение CRM — этап аудита" />
            </Field>
            <Field label="Клиент" required htmlFor="deal-client">
              <Select defaultValue="romashka">
                <SelectTrigger id="deal-client" className="w-full">
                  <SelectValue placeholder="Выбрать клиента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="romashka">ООО «Ромашка»</SelectItem>
                  <SelectItem value="tekhno">АО «Техно»</SelectItem>
                  <SelectItem value="acme">ACME Studio</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Сумма" hint="Валюта: ₽" htmlFor="deal-amount">
              <Input id="deal-amount" className="mono" defaultValue="890 000" inputMode="numeric" />
            </Field>
            <Field label="Срок" htmlFor="deal-due">
              <DatePicker placeholder="Выберите дату" />
            </Field>
            <Field
              label="Почта — уведомления"
              error="Введите корректный email"
              htmlFor="deal-email"
              full
            >
              <Input id="deal-email" type="email" aria-invalid placeholder="example@acme.studio" />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Метки и связи" lead="Теги и привязки к продуктовому контуру.">
          <FormGrid columns={1}>
            <Field label="Теги" full>
              <TagsInput tags={["CRM", "Q3 · 2026"]} />
            </Field>
            <Field label="Описание" full htmlFor="deal-desc">
              <Textarea id="deal-desc" rows={3} placeholder="Краткое описание сделки" />
            </Field>
          </FormGrid>
        </FormSection>
      </CardPanel>
    </ShowcaseFrame>
  );
}

export function CardShowcase() {
  return (
    <ShowcaseFrame title="Карточка">
      <CardPanel title="Активные проекты" subtitle="За последние 30 дней" actions={<Button variant="ghost" size="sm">Все</Button>}>
        <p className="u-text-sm u-text-muted">Контент карточки с метриками и списком.</p>
      </CardPanel>
    </ShowcaseFrame>
  );
}

export function InputShowcase() {
  return (
    <ShowcaseFrame title="Поле ввода">
      <FormGrid columns={1}>
        <Field label="Название" required htmlFor="in-name">
          <Input id="in-name" placeholder="Введите название" />
        </Field>
        <Field label="Эл. почта" hint="Используется для уведомлений" htmlFor="in-email">
          <Input id="in-email" type="email" placeholder="user@example.com" />
        </Field>
        <Field label="С ошибкой" error="Поле обязательно" htmlFor="in-err">
          <Input id="in-err" aria-invalid placeholder="Что-то пошло не так" />
        </Field>
        <Field label="Недоступно" htmlFor="in-disabled">
          <Input id="in-disabled" disabled defaultValue="Только чтение" />
        </Field>
      </FormGrid>
    </ShowcaseFrame>
  );
}

export function ShellShowcase() {
  return (
    <div style={{ minHeight: 640 }}>
      <AppShell
        sidebar={
          <AppSidebar
            groups={[
              {
                title: "Обзор",
                items: [
                  { label: "Дашборд" },
                  { label: "Задачи", active: true },
                  { label: "Бэклог", nested: true, badge: "24" }
                ]
              }
            ]}
            user={{ initials: "КБ", name: "Козлова Е.", email: "e@acme.studio", color: "c4" }}
          />
        }
        topbar={
          <AppTopbar
            breadcrumbs={
              <TopbarBreadcrumbs items={[{ label: "Проекты" }, { label: MOCK_PROJECT_CRM, current: true }]} />
            }
          />
        }
      >
        <p className="u-text-sm u-text-muted">Контент рабочей области</p>
      </AppShell>
    </div>
  );
}

export function CommandPaletteShowcase() {
  return (
    <ShowcaseFrame title="Командная палитра">
      <Command className="max-w-md border border-[var(--border)] rounded-[var(--radius-md)]">
        <CommandInput placeholder="Поиск…" />
        <CommandList>
          <CommandEmpty>Ничего не найдено</CommandEmpty>
          <CommandGroup heading="Навигация">
            <CommandItem>Дашборд</CommandItem>
            <CommandItem>Проекты</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </ShowcaseFrame>
  );
}

export function EmptyShowcase() {
  return (
    <ShowcaseFrame title="Пустое состояние">
      <EmptyState title="Нет проектов" description="Создайте первый проект из CRM." action={<Button size="sm">Создать</Button>} />
    </ShowcaseFrame>
  );
}

export function LoadingSkeletonShowcase() {
  return (
    <ShowcaseFrame title="Скелетон загрузки" hint="Текст · заголовок · аватар · строка · блок · чип">
      <LoadingState label="Загрузка портфеля…" />
      <div className="u-mt-4 grid grid-cols-2 gap-[var(--space-4)]">
        <CardPanel title="Список задач" flush>
          <div className="p-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </CardPanel>
        <CardPanel title="Заголовок + текст" flush>
          <div className="p-[var(--space-3)]">
            <SkeletonText lines={4} />
          </div>
        </CardPanel>
        <CardPanel title="Чипы" flush>
          <div className="p-[var(--space-3)] flex gap-[var(--space-2)]">
            <Skeleton variant="chip" />
            <Skeleton variant="chip" />
            <Skeleton variant="chip" />
          </div>
        </CardPanel>
        <CardPanel title="Блок-плейсхолдер" flush>
          <div className="p-[var(--space-3)]">
            <Skeleton variant="block" />
          </div>
        </CardPanel>
      </div>
    </ShowcaseFrame>
  );
}

export function ErrorStateShowcase() {
  return (
    <ShowcaseFrame title="Состояние ошибки">
      <ErrorState
        title="Не удалось загрузить данные"
        description="Сервер вернул 503. Подождите 30 секунд и повторите."
        hint="Если ошибка повторится, проверьте статус адаптера интеграции в админке арендатора."
        onRetry={() => {
          /* demo retry */
        }}
      />
    </ShowcaseFrame>
  );
}

export function ForbiddenStateShowcase() {
  return (
    <ShowcaseFrame title="Нет доступа">
      <ForbiddenState title="Нет доступа" description="Обратитесь к администратору." />
    </ShowcaseFrame>
  );
}

export function BreadcrumbsShowcase() {
  return (
    <ShowcaseFrame title="Хлебные крошки">
      <TopbarBreadcrumbs items={[{ label: "Проекты" }, { label: MOCK_PROJECT_CRM, current: true }]} />
    </ShowcaseFrame>
  );
}

export function ChipShowcase() {
  return (
    <ShowcaseFrame title="Чип">
      <div className="ds-demo__row">
        <Chip variant="info">В работе</Chip>
        <Chip variant="violet">CRM</Chip>
        <Chip variant="success">Готово</Chip>
      </div>
    </ShowcaseFrame>
  );
}

export function CheckboxShowcase() {
  return (
    <ShowcaseFrame title="Флажок">
      <div className="flex items-center gap-2">
        <Checkbox id="sc1" defaultChecked />
        <Label htmlFor="sc1">Согласен с политикой</Label>
      </div>
    </ShowcaseFrame>
  );
}

export function SwitchShowcase() {
  return (
    <ShowcaseFrame title="Переключатель">
      <div className="flex items-center gap-2">
        <Switch id="sw1" defaultChecked />
        <Label htmlFor="sw1">Уведомления</Label>
      </div>
    </ShowcaseFrame>
  );
}

export function DialogShowcase() {
  return (
    <ShowcaseFrame title="Диалог">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Открыть диалог</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </ShowcaseFrame>
  );
}

export function SheetShowcase() {
  return (
    <ShowcaseFrame title="Боковая панель · правый инспектор">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Открыть инспектор</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Инспектор задачи</SheetTitle>
            <p className="u-text-xs u-text-muted">{mockTaskProjectRef("MDS-39")}</p>
          </SheetHeader>
          <SheetBody>
            <FormSection title="Назначения" lead="Роли и ответственный.">
              <FormGrid columns={1}>
                <Field label="Ответственный">
                  <Combobox
                    options={[
                      { value: "iv", label: "Иванова М." },
                      { value: "pe", label: "Петров А." }
                    ]}
                    placeholder="Выбрать сотрудника"
                  />
                </Field>
                <Field label="Срок">
                  <DatePicker placeholder="Выберите дату" />
                </Field>
              </FormGrid>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost">Отмена</Button>
            <Button variant="primary">Сохранить</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ShowcaseFrame>
  );
}

export function PopoverShowcase() {
  return (
    <ShowcaseFrame title="Поповер">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Фильтры</Button>
        </PopoverTrigger>
        <PopoverContent>Быстрые фильтры</PopoverContent>
      </Popover>
    </ShowcaseFrame>
  );
}

export function DropdownShowcase() {
  return (
    <ShowcaseFrame title="Выпадающее меню">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Меню</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Редактировать</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ShowcaseFrame>
  );
}

export function TooltipShowcase() {
  return (
    <ShowcaseFrame title="Подсказка">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Подсказка">
            <Archive className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Архивировать</TooltipContent>
      </Tooltip>
    </ShowcaseFrame>
  );
}

export function TabsShowcase() {
  const [tab, setTab] = useState<"a" | "b">("a");
  return (
    <ShowcaseFrame title="Вкладки">
      <Segmented
        name="demo-tabs"
        options={[
          { value: "a", label: "Активные" },
          { value: "b", label: "Черновики" }
        ]}
        value={tab}
        onChange={setTab}
      />
    </ShowcaseFrame>
  );
}

export function ComboboxShowcase() {
  return (
    <ShowcaseFrame title="Комбобокс">
      <Combobox
        className="max-w-xs"
        options={[
          { value: "pm", label: "Project Manager" },
          { value: "dev", label: "Developer" }
        ]}
      />
    </ShowcaseFrame>
  );
}

export function DatePickerShowcase() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <ShowcaseFrame title="Выбор даты · поповер и календарь">
      <FormGrid columns={2}>
        <Field label="Дата релиза" required htmlFor="dp-1">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Дедлайн (недоступно)" htmlFor="dp-2">
          <DatePicker placeholder="Не задано" disabled />
        </Field>
      </FormGrid>
      <p className="u-text-xs u-text-muted">
        Выбрано: <strong className="u-text-strong">{date ? date.toLocaleDateString("ru-RU") : "не выбрано"}</strong>
      </p>
    </ShowcaseFrame>
  );
}

export function SelectShowcase() {
  return (
    <ShowcaseFrame title="Список" hint="Select с токенами design-v3">
      <FormGrid columns={1}>
        <Field label="Статус" required htmlFor="sel-status">
          <Select defaultValue="in-progress">
            <SelectTrigger id="sel-status" className="w-full">
              <SelectValue placeholder="Выбрать статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">К выполнению</SelectItem>
              <SelectItem value="in-progress">В работе</SelectItem>
              <SelectItem value="review">На ревью</SelectItem>
              <SelectItem value="done">Готово</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Размер компании" htmlFor="sel-size">
          <Select>
            <SelectTrigger id="sel-size" size="sm" className="w-full">
              <SelectValue placeholder="Не выбрано" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s">1-10</SelectItem>
              <SelectItem value="m">11-50</SelectItem>
              <SelectItem value="l">51-200</SelectItem>
              <SelectItem value="xl">200+</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormGrid>
    </ShowcaseFrame>
  );
}

export function RadioShowcase() {
  return (
    <ShowcaseFrame title="Radio · режим развертывания">
      <RadioGroup defaultValue="saas" name="deployment">
        <RadioGroupItem value="saas" id="r-saas">
          SaaS · cloud-managed
        </RadioGroupItem>
        <RadioGroupItem value="self" id="r-self">
          Self-hosted (Docker)
        </RadioGroupItem>
        <RadioGroupItem value="hybrid" id="r-hybrid" disabled>
          Гибрид (скоро)
        </RadioGroupItem>
      </RadioGroup>
    </ShowcaseFrame>
  );
}

export function TextareaShowcase() {
  return (
    <ShowcaseFrame title="Многострочное поле">
      <Textarea placeholder="Описание задачи" rows={3} />
    </ShowcaseFrame>
  );
}

export function AlertShowcase() {
  return (
    <ShowcaseFrame title="Предупреждение">
      <Alert variant="warning">
        <AlertTitle>Внимание</AlertTitle>
        <AlertDescription>Перегруз ресурса на следующей неделе.</AlertDescription>
      </Alert>
      <BannerInline variant="info" className="u-mt-3">
        Информационный баннер inline
      </BannerInline>
    </ShowcaseFrame>
  );
}

export function ToastShowcase() {
  return (
    <ShowcaseFrame title="Уведомления" hint="Используйте UI/Sonner → интерактивное демо">
      <p className="u-text-sm">Sonner с токенами design-v3</p>
    </ShowcaseFrame>
  );
}

export function ContextMenuShowcase() {
  return DropdownShowcase();
}

export function PaginationShowcase() {
  return (
    <ShowcaseFrame title="Пагинация">
      <div className="btn-group">
        <Button variant="ghost" size="sm">
          Назад
        </Button>
        <Button variant="accent" size="sm">
          1
        </Button>
        <Button variant="ghost" size="sm">
          2
        </Button>
        <Button variant="ghost" size="sm">
          Вперёд
        </Button>
      </div>
    </ShowcaseFrame>
  );
}

export function KbdShowcase() {
  return (
    <ShowcaseFrame title="Клавиши · подсказки">
      <div className="ds-demo__row">
        <Kbd>Esc</Kbd>
        <Kbd>↩</Kbd>
        <Kbd>Tab</Kbd>
        <Kbd>?</Kbd>
      </div>
      <div className="ds-demo__row u-mt-3 items-center gap-3">
        <span className="u-text-sm u-text-muted">Открыть командную строку:</span>
        <KbdGroup keys={["⌘", "K"]} />
        <span className="u-text-sm u-text-muted">· Создать задачу:</span>
        <KbdGroup keys={["Shift", "N"]} />
      </div>
      <div className="ds-demo__row u-mt-3 items-center gap-3">
        <span className="u-text-sm u-text-muted">Inline (sm):</span>
        <KbdGroup keys={["⌘", "Shift", "P"]} size="sm" />
      </div>
    </ShowcaseFrame>
  );
}

export function LabelShowcase() {
  return (
    <ShowcaseFrame title="Подпись поля">
      <div className="flex flex-col gap-[var(--space-3)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <Label htmlFor="lab-1">Обычный label</Label>
          <Input id="lab-1" placeholder="Связь по htmlFor" />
        </div>
        <div className="flex flex-col gap-[var(--space-1)]">
          <Label htmlFor="lab-2" required>
            Обязательное
          </Label>
          <Input id="lab-2" placeholder="С красной звёздочкой" />
        </div>
        <div className="flex flex-col gap-[var(--space-1)]">
          <Label htmlFor="lab-3" srOnly>
            Скрытый label
          </Label>
          <Input id="lab-3" placeholder="Только для скринридеров" aria-label="Скрытая подпись" />
        </div>
      </div>
    </ShowcaseFrame>
  );
}

export function SearchPillShowcase() {
  return (
    <ShowcaseFrame title="Поисковая строка" hint="md/sm · фокус · загрузка · недоступно · с шорткатом">
      <div className="flex flex-col gap-[var(--space-3)] max-w-md">
        <SearchPill placeholder="Поиск задач, проектов, людей…" shortcut={["⌘", "K"]} />
        <SearchPill placeholder="Без шортката" />
        <SearchPill placeholder="Маленький" size="sm" shortcut="/" />
        <SearchPill placeholder="Загрузка" loading />
        <SearchPill placeholder="Отключено" disabled defaultValue="..." />
      </div>
    </ShowcaseFrame>
  );
}

/** Registry: design-v2 catalog component id → showcase */
export const DESIGN_V2_SHOWCASES: Record<string, () => React.JSX.Element> = {
  avatar: AvatarShowcase,
  badge: BadgeShowcase,
  breadcrumbs: BreadcrumbsShowcase,
  button: ButtonShowcase,
  card: CardShowcase,
  checkbox: CheckboxShowcase,
  chip: ChipShowcase,
  combobox: ComboboxShowcase,
  "command-palette": CommandPaletteShowcase,
  "context-menu": ContextMenuShowcase,
  "date-picker": DatePickerShowcase,
  dialog: DialogShowcase,
  dropdown: DropdownShowcase,
  empty: EmptyShowcase,
  "entity-row": EntityRowShowcase,
  "error-state": ErrorStateShowcase,
  "forbidden-state": ForbiddenStateShowcase,
  form: FormShowcase,
  "icon-button": IconButtonShowcase,
  input: InputShowcase,
  kanban: KanbanShowcase,
  "kanban-card": KanbanCardShowcase,
  kbd: KbdShowcase,
  label: LabelShowcase,
  "loading-skeleton": LoadingSkeletonShowcase,
  pagination: PaginationShowcase,
  popover: PopoverShowcase,
  radio: RadioShowcase,
  "search-pill": SearchPillShowcase,
  select: SelectShowcase,
  sheet: SheetShowcase,
  skeleton: LoadingSkeletonShowcase,
  switch: SwitchShowcase,
  table: TableShowcase,
  tabs: TabsShowcase,
  toast: ToastShowcase,
  tooltip: TooltipShowcase
};

export const SHELL_SHOWCASE = ShellShowcase;
