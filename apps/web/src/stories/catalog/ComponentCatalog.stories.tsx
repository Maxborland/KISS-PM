import type { Meta, StoryObj } from "@storybook/react";
import { Bell, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BannerInline } from "@/components/ui/banner-inline";
import { CardPanel } from "@/components/domain/card-panel";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { IlluState } from "@/components/ui/illu-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { PageIntro } from "@/components/ui/page-intro";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="catalog-section">
      <h2 className="type-section-title">{title}</h2>
      <div className="catalog-section__body">{children}</div>
    </section>
  );
}

function CatalogPage() {
  const [segment, setSegment] = useState<"list" | "board">("list");
  const [combo, setCombo] = useState("pm");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-[var(--space-6)] pb-[var(--space-8)]">
      <PageIntro
        title="Design v3 — каталог компонентов"
        lead="React-примитивы (CVA). Эталонные макеты v2 — экраны, паттерны и компоненты."
      />

      <Section title="Кнопки и ввод">
        <div className="flex flex-wrap gap-[var(--space-2)]">
          <Button variant="primary">Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="outline">Контур</Button>
          <Button variant="ghost">Прозрачная</Button>
          <Button variant="destructive">Опасная</Button>
          <Button size="sm">Малая</Button>
          <Button size="lg">Большая</Button>
          <IconButton label="Уведомления">
            <Bell className="size-4" />
          </IconButton>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Название проекта" />
          <Textarea placeholder="Описание" rows={2} />
          <DatePicker placeholder="Выберите дату" />
          <SearchPill placeholder="Поиск задач…" />
        </div>
        <Segmented
          name="view"
          options={[
            { value: "list", label: "Список" },
            { value: "board", label: "Доска" }
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title="Чипы, бейджи, клавиши">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>По умолчанию</Badge>
          <Badge variant="success">Успех</Badge>
          <Badge variant="warning">Предупреждение</Badge>
          <Badge variant="danger">Опасность</Badge>
          <Chip variant="violet">В работе</Chip>
          <Chip variant="info">Черновик</Chip>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
      </Section>

      <Section title="Состояния и обратная связь">
        <BannerInline variant="info">Информационный баннер для согласования токенов.</BannerInline>
        <Alert variant="warning">
          <AlertTitle>Внимание</AlertTitle>
          <AlertDescription>Перегруз ресурса на следующей неделе.</AlertDescription>
        </Alert>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title="Нет проектов" description="Создайте первый проект из CRM." action={<Button size="sm"><Plus className="size-4" /> Создать</Button>} />
          <LoadingState label="Загрузка портфеля…" />
          <ErrorState title="Ошибка загрузки" description="Повторите позже." />
          <ForbiddenState title="Нет доступа" description="Обратитесь к администратору рабочей области." />
        </div>
        <IlluState title="Портфель пуст" description="Подключите CRM или импортируйте шаблон." />
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton variant="row" />
          <Skeleton variant="avatar" className="size-10" />
        </div>
      </Section>

      <Section title="Навигация и оверлеи">
        <Tabs defaultValue="active">
          <TabsList variant="line">
            <TabsTrigger value="active">Активные</TabsTrigger>
            <TabsTrigger value="draft">Черновики</TabsTrigger>
            <TabsTrigger value="closed">Закрытые</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="pt-3 text-[var(--text-sm)] text-[var(--muted)]">
            Контент вкладки
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Модалка</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Подтверждение</DialogTitle>
                <DialogDescription>Пример модального окна design-v3.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Панель</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Инспектор</SheetTitle>
                <SheetDescription>Правый drawer 380px.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Всплывающее</Button>
            </PopoverTrigger>
            <PopoverContent>Быстрые фильтры</PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Меню</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Редактировать</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Подсказка</TooltipContent>
          </Tooltip>
          <Button variant="secondary" onClick={() => toast.success("Сохранено")}>
            Тост
          </Button>
        </div>
        <Combobox
          className="max-w-xs"
          options={[
            { value: "pm", label: "Менеджер проекта" },
            { value: "dev", label: "Разработчик" }
          ]}
          value={combo}
          onValueChange={setCombo}
        />
      </Section>

      <Section title="Формы, CardPanel и DataTable">
        <div className="flex items-center gap-3">
          <Checkbox id="c1" defaultChecked />
          <Label htmlFor="c1">Согласен с политикой</Label>
          <Switch id="s1" defaultChecked />
          <Label htmlFor="s1">Уведомления</Label>
        </div>
        <Separator />
        <CardPanel
          className="max-w-md"
          title="Карточка KPI"
          subtitle="Метрика за период"
          actions={
            <Button size="sm" variant="ghost">
              Детали
            </Button>
          }
        >
          <p className="text-2xl font-semibold text-[var(--accent)]">87%</p>
        </CardPanel>
        <DataTable>
          <thead>
            <tr>
              <th>Проект</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Альфа</td>
              <td>
                <Badge variant="success">В срок</Badge>
              </td>
            </tr>
            <tr>
              <td>Бета</td>
              <td>
                <Badge variant="warning">Риск</Badge>
              </td>
            </tr>
          </tbody>
        </DataTable>
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>ИП</AvatarFallback>
          </Avatar>
          <span className="text-[var(--text-sm)]">Иван Петров</span>
        </div>
      </Section>

      <Toaster />
    </div>
  );
}

const meta: Meta = {
  title: "Catalog/All Components",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Единая страница для согласования design-v3 UI kit (Phase 2 / PR #21)."
      }
    }
  }
};

export default meta;
type Story = StoryObj;

export const ForApproval: Story = {
  name: "Для согласования",
  render: () => <CatalogPage />
};
