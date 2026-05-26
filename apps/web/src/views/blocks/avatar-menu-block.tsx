import { Bell, ChevronDown, LogOut, Settings, ShieldCheck, Sun, User } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { PageIntro } from "@/views/layout/page-intro";

export function AvatarMenuBlock() {
  return (
    <>
      <PageIntro title="Профиль пользователя" lead="Меню аватара и быстрые действия." />
      <div className="grid-2">
        <CardPanel title="Раскрытое меню" subtitle="Превью dropdown · из topbar">
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <BemAvatar initials="КБ" color="c4" size="sm" />
                Камил Б.
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px]">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <strong className="u-text-sm u-text-strong">Камил Б.</strong>
                  <span className="u-text-xs u-text-muted">kamil@kiss.pm</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="size-4" aria-hidden />
                Профиль
                <KbdGroup keys={["⌘", "P"]} size="sm" className="ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-4" aria-hidden />
                Настройки
                <Kbd size="sm" className="ml-auto">,</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="size-4" aria-hidden />
                Уведомления
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Sun className="size-4" aria-hidden />
                Тема: светлая
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <ShieldCheck className="size-4" aria-hidden />
                Безопасность
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                <LogOut className="size-4" aria-hidden />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardPanel>
        <CardPanel title="Активные сессии" subtitle="3 устройства">
          <ul className="link-list">
            <li>
              <strong>MacBook Pro · Chrome</strong>
              <Chip variant="success" className="ml-auto">Сейчас</Chip>
            </li>
            <li>
              <strong>iPhone 15 · Safari</strong>
              <span className="u-text-xs u-text-muted ml-auto">2 часа назад</span>
            </li>
            <li>
              <strong>Windows · Firefox</strong>
              <span className="u-text-xs u-text-muted ml-auto">3 дня назад</span>
            </li>
          </ul>
        </CardPanel>
      </div>
    </>
  );
}
