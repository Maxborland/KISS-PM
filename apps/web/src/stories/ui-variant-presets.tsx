import type { ReactNode } from "react";
import { toast } from "sonner";
import { Calendar, MoreHorizontal } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Badge } from "@/components/ui/badge";
import { BannerInline } from "@/components/ui/banner-inline";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { IconButton } from "@/components/ui/icon-button";
import { IconPill } from "@/components/ui/icon-pill";
import { IlluState } from "@/components/ui/illu-state";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { NumericValue } from "@/components/ui/numeric-value";
import { PageIntro } from "@/components/ui/page-intro";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import { Sparkline } from "@/components/ui/sparkline";
import { StatusDot } from "@/components/ui/status-dot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TrendArrow } from "@/components/ui/trend-arrow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VariantMatrixItem } from "@/stories/variant-matrix";

function items(...rows: VariantMatrixItem[]): VariantMatrixItem[] {
  return rows;
}

export const UI_VARIANT_ITEMS = {
  alert: items(
    { label: "По умолчанию", node: <Alert><AlertTitle>Заголовок</AlertTitle><AlertDescription>Текст оповещения.</AlertDescription></Alert> },
    { label: "Информация", node: <Alert variant="info"><AlertTitle>Инфо</AlertTitle><AlertDescription>Справка по полю.</AlertDescription></Alert> },
    { label: "Предупреждение", node: <Alert variant="warning"><AlertTitle>Внимание</AlertTitle><AlertDescription>Проверьте сроки.</AlertDescription></Alert> },
    { label: "Опасность", node: <Alert variant="danger"><AlertTitle>Риск</AlertTitle><AlertDescription>Требуется действие.</AlertDescription></Alert> }
  ),
  avatar: items(
    { label: "Инициалы", node: <Avatar><AvatarFallback>ИП</AvatarFallback></Avatar> },
    { label: "Второй цвет", node: <Avatar><AvatarFallback className="bg-[var(--violet-soft)] text-[#6d28d9]">АП</AvatarFallback></Avatar> }
  ),
  "avatar-group": items({
    label: "Группа",
    node: (
      <AvatarGroup
        items={[
          { id: "1", initials: "ИП" },
          { id: "2", initials: "АК" },
          { id: "3", initials: "МС" },
          { id: "4", initials: "ДВ" },
          { id: "5", initials: "ЕН" }
        ]}
        max={3}
      />
    )
  }),
  badge: items(
    { label: "По умолчанию", node: <Badge>По умолчанию</Badge> },
    { label: "Успех", node: <Badge variant="success">Успех</Badge> },
    { label: "Предупреждение", node: <Badge variant="warning">Предупреждение</Badge> },
    { label: "Опасность", node: <Badge variant="danger">Опасность</Badge> },
    { label: "Контур", node: <Badge variant="outline">Контур</Badge> }
  ),
  "banner-inline": items(
    { label: "Информация", node: <BannerInline variant="info">Информационный баннер.</BannerInline> },
    { label: "Предупреждение", node: <BannerInline variant="warn">Предупреждение по срокам.</BannerInline> },
    { label: "Опасность", node: <BannerInline variant="danger">Критическое отклонение.</BannerInline> }
  ),
  breadcrumb: items({
    label: "Цепочка",
    node: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="#">Проекты</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Альфа</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }),
  button: items(
    { label: "По умолчанию", node: <Button>По умолчанию</Button> },
    { label: "Основная", node: <Button variant="primary">Основная</Button> },
    { label: "Вторичная", node: <Button variant="secondary">Вторичная</Button> },
    { label: "Контур", node: <Button variant="outline">Контур</Button> },
    { label: "Прозрачная", node: <Button variant="ghost">Прозрачная</Button> },
    { label: "Опасная", node: <Button variant="destructive">Опасная</Button> },
    { label: "Малая", node: <Button size="sm">Малая</Button> }
  ),
  card: items({
    label: "Карточка",
    node: (
      <Card className="w-72">
        <CardHeader><CardTitle>KPI</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-semibold text-[var(--accent)]">87%</p></CardContent>
      </Card>
    )
  }),
  checkbox: items(
    { label: "Выкл.", node: <Checkbox id="v-cb-off" /> },
    { label: "Вкл.", node: <Checkbox id="v-cb-on" defaultChecked /> }
  ),
  chip: items(
    { label: "Инфо", node: <Chip variant="info">В работе</Chip> },
    { label: "Успех", node: <Chip variant="success">Готово</Chip> },
    { label: "Предупреждение", node: <Chip variant="warning">Риск</Chip> },
    { label: "Опасность", node: <Chip variant="danger">Блокер</Chip> },
    { label: "Фиолетовый", node: <Chip variant="violet">Черновик</Chip> }
  ),
  combobox: items({
    label: "Роли",
    node: (
      <Combobox
        className="w-64"
        options={[
          { value: "pm", label: "Менеджер проекта" },
          { value: "dev", label: "Разработчик" }
        ]}
        value="pm"
        onValueChange={() => undefined}
      />
    )
  }),
  command: items({
    label: "Палитра (заглушка)",
    node: <p className="text-[var(--text-sm)] text-[var(--muted)]">Полная палитра — в «Диалог команд» и витрине.</p>
  }),
  "command-dialog": items({
    label: "Триггер",
    node: <Button variant="outline">Палитра команд (витрина)</Button>
  }),
  "context-menu": items({
    label: "Контекстное меню",
    node: (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button variant="outline">ПКМ по строке</Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Открыть</ContextMenuItem>
          <ContextMenuItem>Дублировать</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }),
  "date-picker": items(
    { label: "Пустое", node: <DatePicker placeholder="Выберите дату" /> },
    { label: "С датой", node: <DatePicker value={new Date(2026, 4, 24)} onChange={() => undefined} /> }
  ),
  dialog: items({
    label: "Модалка",
    node: (
      <Dialog>
        <DialogTrigger asChild><Button variant="outline">Открыть</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Подтверждение</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }),
  "dropdown-menu": items({
    label: "Меню",
    node: (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline">Действия</Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Редактировать</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }),
  "empty-state": items(
    { label: "Пусто", node: <EmptyState title="Нет проектов" description="Создайте первый проект." /> },
    { label: "С действием", node: <EmptyState title="Нет задач" description="Добавьте задачу." action={<Button size="sm">Создать</Button>} /> }
  ),
  "error-state": items(
    { label: "Ошибка", node: <ErrorState title="Ошибка загрузки" description="Повторите позже." /> }
  ),
  "forbidden-state": items(
    { label: "Нет доступа", node: <ForbiddenState title="Доступ запрещён" description="Недостаточно прав." /> }
  ),
  form: items({
    label: "Поле в форме",
    node: (
      <div className="flex w-72 flex-col gap-2">
        <Label htmlFor="vf">Название</Label>
        <Input id="vf" placeholder="Проект Альфа" />
      </div>
    )
  }),
  "icon-button": items(
    { label: "По умолчанию", node: <IconButton label="Меню"><MoreHorizontal className="size-4" /></IconButton> },
    { label: "Контур", node: <IconButton label="Меню" variant="outline"><MoreHorizontal className="size-4" /></IconButton> }
  ),
  "illu-state": items({
    label: "Иллюстрация",
    node: <IlluState title="Портфель пуст" description="Подключите CRM или импортируйте шаблон." />
  }),
  input: items(
    { label: "Обычное", node: <Input placeholder="Название проекта" className="w-64" /> },
    { label: "Отключено", node: <Input placeholder="Недоступно" disabled className="w-64" /> },
    { label: "Ошибка", node: <Input placeholder="Обязательное" aria-invalid className="w-64" /> }
  ),
  kbd: items(
    { label: "Сочетание", node: <span className="flex gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span> }
  ),
  label: items({ label: "Подпись", node: <Label htmlFor="vl">Название задачи</Label> }),
  "loading-state": items({ label: "Загрузка", node: <LoadingState label="Загрузка портфеля…" /> }),
  "page-intro": items({
    label: "Вступление",
    node: <PageIntro title="Список проектов" lead="Активные и архивные проекты арендатора." />
  }),
  pagination: items({
    label: "Страницы",
    node: (
      <Pagination>
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
          <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
          <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
          <PaginationItem><PaginationNext href="#" /></PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }),
  popover: items({
    label: "Всплывающее",
    node: (
      <Popover>
        <PopoverTrigger asChild><Button variant="outline">Фильтры</Button></PopoverTrigger>
        <PopoverContent>Быстрые фильтры</PopoverContent>
      </Popover>
    )
  }),
  "radio-group": items({
    label: "Группа",
    node: (
      <RadioGroup defaultValue="a" className="flex gap-4">
        <div className="flex items-center gap-2"><RadioGroupItem value="a" id="vr-a" /><Label htmlFor="vr-a">Список</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="b" id="vr-b" /><Label htmlFor="vr-b">Доска</Label></div>
      </RadioGroup>
    )
  }),
  "scroll-area": items({
    label: "Прокрутка",
    node: (
      <ScrollArea className="h-24 w-64 rounded-[var(--radius-md)] border border-[var(--border)] p-2">
        <p className="text-[var(--text-sm)]">Длинный список элементов для демонстрации вертикальной прокрутки в компактной области.</p>
      </ScrollArea>
    )
  }),
  "search-pill": items({ label: "Поиск", node: <SearchPill placeholder="Поиск задач…" className="w-64" /> }),
  segmented: items({
    label: "Режим",
    node: (
      <Segmented
        name="demo"
        options={[
          { value: "list", label: "Список" },
          { value: "board", label: "Доска" }
        ]}
        value="list"
        onChange={() => undefined}
      />
    )
  }),
  select: items({
    label: "Выбор",
    node: (
      <Select defaultValue="open">
        <SelectTrigger className="w-48"><SelectValue placeholder="Статус" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Открыт</SelectItem>
          <SelectItem value="done">Закрыт</SelectItem>
        </SelectContent>
      </Select>
    )
  }),
  separator: items({ label: "Разделитель", node: <Separator className="w-48" /> }),
  sheet: items({
    label: "Панель",
    node: (
      <Sheet>
        <SheetTrigger asChild><Button variant="outline">Инспектор</Button></SheetTrigger>
        <SheetContent><SheetHeader><SheetTitle>Задача</SheetTitle></SheetHeader></SheetContent>
      </Sheet>
    )
  }),
  skeleton: items(
    { label: "Строка", node: <Skeleton variant="row" className="w-64" /> },
    { label: "Аватар", node: <Skeleton variant="avatar" /> },
    { label: "Текст", node: <Skeleton className="h-4 w-48" /> }
  ),
  sonner: items(
    { label: "Успех", node: <Button variant="secondary" onClick={() => toast.success("Сохранено")}>Показать тост</Button> },
    { label: "Ошибка", node: <Button variant="outline" onClick={() => toast.error("Не удалось сохранить")}>Ошибка</Button> }
  ),
  switch: items(
    { label: "Выкл.", node: <Switch id="v-sw-off" /> },
    { label: "Вкл.", node: <Switch id="v-sw-on" defaultChecked /> }
  ),
  table: items({
    label: "Таблица",
    node: (
      <Table>
        <TableHeader>
          <TableRow><TableHead>Проект</TableHead><TableHead>Статус</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>Альфа</TableCell><TableCell><Badge variant="success">В срок</Badge></TableCell></TableRow>
        </TableBody>
      </Table>
    )
  }),
  tabs: items({
    label: "Вкладки",
    node: (
      <Tabs defaultValue="a" className="w-72">
        <TabsList variant="line">
          <TabsTrigger value="a">Активные</TabsTrigger>
          <TabsTrigger value="b">Архив</TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="pt-2 text-[var(--text-sm)] text-[var(--muted)]">Контент</TabsContent>
      </Tabs>
    )
  }),
  textarea: items(
    { label: "2 строки", node: <Textarea rows={2} placeholder="Описание" className="w-64" /> },
    { label: "Отключено", node: <Textarea rows={2} disabled placeholder="Недоступно" className="w-64" /> }
  ),
  tooltip: items({
    label: "Подсказка",
    node: (
      <Tooltip>
        <TooltipTrigger asChild><Button variant="ghost">Наведите</Button></TooltipTrigger>
        <TooltipContent>Краткая подсказка</TooltipContent>
      </Tooltip>
    )
  }),
  "status-dot": items(
    { label: "Успех", node: <StatusDot tone="success" label="В срок" /> },
    { label: "Риск", node: <StatusDot tone="warning" label="Риск" /> },
    { label: "Просрочка", node: <StatusDot tone="danger" label="Просрочено" /> }
  ),
  "progress-bar": items(
    { label: "65%", node: <ProgressBar value={65} label="Выполнение" className="w-56" /> },
    { label: "Без подписи", node: <ProgressBar value={40} className="w-48" /> }
  ),
  "progress-ring": items(
    { label: "72%", node: <ProgressRing value={72} /> },
    { label: "Малый", node: <ProgressRing value={45} size={32} /> }
  ),
  "trend-arrow": items(
    { label: "Рост", node: <TrendArrow direction="up" value="+12%" /> },
    { label: "Падение", node: <TrendArrow direction="down" value="-4%" /> },
    { label: "Без изменений", node: <TrendArrow direction="flat" /> }
  ),
  sparkline: items({
    label: "Тренд",
    node: <Sparkline points={[2, 4, 3, 6, 5, 8, 7]} />
  }),
  "kbd-shortcut": items({
    label: "Поиск",
    node: <KbdShortcut keys={["⌘", "K"]} description="Глобальный поиск" />
  }),
  "numeric-value": items(
    { label: "Часы", node: <NumericValue value="128" unit="ч" /> },
    { label: "Процент", node: <NumericValue value="94" unit="%" /> }
  ),
  "icon-pill": items(
    { label: "Средний", node: <IconPill icon={Calendar} label="Календарь" size="md" /> },
    { label: "Малый", node: <IconPill icon={Calendar} label="Календарь" size="sm" /> }
  )
} as const satisfies Record<string, VariantMatrixItem[]>;

export type UiVariantKey = keyof typeof UI_VARIANT_ITEMS;
