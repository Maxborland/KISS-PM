import { CheckSquare, Database, FileText, CheckCircle2, Bot } from "lucide-react";

export function LandingDemoCloseups() {
  return (
    <div className="w-full max-w-[1000px] mt-32 flex flex-col gap-32 pb-24 text-[14px]">
      
      {/* 1. Сверка как review изменений */}
      <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto md:mx-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Сверка как review изменений</h3>
          <p className="text-gray-500 leading-relaxed">
            Агент не меняет проект вслепую. Все предложенные изменения собираются в Сверку. Вы можете просмотреть каждое, отредактировать даты или исполнителей, и применить только нужное.
          </p>
        </div>
        <div className="flex-1 w-full max-w-[400px]">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/40 p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-gray-900">Срок задачи</span>
              <span className="text-[10px] uppercase font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Изменено</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
              <div className="text-gray-400 text-right">Было:</div>
              <div className="text-gray-500 line-through">12 июня</div>
              <div className="text-gray-400 text-right pt-1">Стало:</div>
              <div className="flex items-center gap-2">
                <div className="border border-blue-200 bg-white rounded-md px-2 py-1 text-gray-900 shadow-sm ring-2 ring-blue-50">15 июня</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              Требует прав менеджера
            </div>
          </div>
        </div>
      </div>

      {/* 2. Контекст проекта */}
      <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-24">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto md:mx-0">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Контекст проекта</h3>
          <p className="text-gray-500 leading-relaxed">
            Агент не просто генерирует текст, он читает проектные поверхности: задачи, сроки, зависимости, загрузку ресурсов и риски. Ответы основаны на реальном состоянии проекта.
          </p>
        </div>
        <div className="flex-1 w-full max-w-[400px]">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/40 p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-[13px] text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-gray-400" /> Читает задачи
            </div>
            <div className="flex items-center gap-3 text-[13px] text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-gray-400" /> Проверяет сроки
            </div>
            <div className="flex items-center gap-3 text-[13px] text-blue-600 font-medium">
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /> 
              Смотрит зависимости
            </div>
            <div className="flex items-center gap-3 text-[13px] text-gray-400">
              <div className="w-4 h-4 rounded-full border-2 border-gray-200" /> Сверяет загрузку
            </div>
          </div>
        </div>
      </div>

      {/* 3. Журнал решений */}
      <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mx-auto md:mx-0">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Журнал решений</h3>
          <p className="text-gray-500 leading-relaxed">
            Решения остаются проверяемыми. Применение Сверки оставляет четкий след в журнале: кто применил, что изменилось, почему и когда.
          </p>
        </div>
        <div className="flex-1 w-full max-w-[400px]">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/40 p-5 text-[13px]">
            <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">Вы</div>
                <span className="font-medium text-gray-900">Вы применили 4 изменения</span>
              </div>
              <span className="text-gray-400 text-xs">Только что</span>
            </div>
            
            <div className="space-y-2 text-gray-500 text-xs mb-3">
              <div className="flex justify-between">
                <span>Срок задачи: Подготовить макеты</span>
                <span className="text-gray-900">12 июня → 15 июня</span>
              </div>
              <div className="flex justify-between">
                <span>Статус</span>
                <span className="text-gray-900">В работе → На проверке</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-gray-500 text-xs flex items-start gap-2">
              <Bot className="w-4 h-4 shrink-0 text-gray-400" />
              <span>Источник: Генри Гантт по запросу "проверь задержку по дизайну"</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
