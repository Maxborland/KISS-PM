import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export function AgentStatusMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 -ml-2 rounded-md transition-colors outline-none">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs shrink-0">
            ГГ
          </div>
          <span className="font-medium text-gray-900">Генри Гантт</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          className="w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50 text-[13px]"
          sideOffset={8}
          align="start"
        >
          <div className="px-2 py-1.5 border-b border-gray-100 mb-1 pb-2">
            <div className="font-medium text-gray-900">Генри Гантт</div>
            <div className="text-gray-500 text-xs mt-0.5">Агент аккаунта</div>
          </div>
          
          <div className="px-2 py-1.5">
            <div className="text-gray-400 text-[11px] font-medium uppercase tracking-wider mb-1">Память</div>
            <div className="text-gray-700">Контекст демо-проектов</div>
            <div className="text-gray-700">История решений в примере</div>
          </div>

          <div className="px-2 py-1.5 mt-1">
            <div className="text-gray-400 text-[11px] font-medium uppercase tracking-wider mb-1">Доступ</div>
            <div className="text-gray-700">Проекты, задачи, сроки, ресурсы</div>
          </div>

          <div className="px-2 py-1.5 mt-1 border-b border-gray-100 pb-2 mb-1">
            <div className="text-gray-400 text-[11px] font-medium uppercase tracking-wider mb-1">Поведение</div>
            <div className="text-gray-700">Спрашивает перед применением</div>
          </div>
          
          <DropdownMenu.Item className="px-2 py-1.5 flex items-center justify-between text-blue-600 hover:bg-blue-50 cursor-pointer rounded-md outline-none transition-colors">
            Настроить в аккаунте
            <Settings className="w-3.5 h-3.5" />
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
