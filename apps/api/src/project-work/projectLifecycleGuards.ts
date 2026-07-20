import type { ApiTenantDataSource } from "../apiTypes";

/* ============================================================
   Предзаписные проверки жизненного цикла проекта (Блок 5).

   1) Ссылочные id (тип / шаблон) проверяются ДО записи:
      - projectTypeId: FK есть (projects_project_type_fk), но 23503 нигде
        не распознавался и всплывал наружу как необработанный 500;
      - templateId: FK нет вообще — неизвестное значение молча
        сохранялось как висячая ссылка (200 + мусор в данных).
      Проверка tenant-scoped: чужой id тенанта неотличим от несуществующего.

   2) Дубликат клиентского id проекта (PK = (tenant_id, id)) — честный 409
      вместо необработанного 23505 → 500. Обход error.cause живёт в
      uniqueConstraintConflicts.ts — единственном владельце этой логики.

   3) projects.calendarId НЕ проверяется. Легальны не только производственный
      календарь тенанта: planningRepository.selectProjectCalendarId берёт
      project.calendarId ?? project_calendars[0].id ?? `${projectId}-default-calendar`,
      то есть валидны и id пер-проектных календарей (их id произвольны), и
      синтетический default-id, которому вообще нет строки в БД. Перечислить
      этот набор на уровне API нечем — метода «календари проекта» в data source
      нет. Проверка «валиден только baseMode.calendarId» отвергала законные
      значения (404 на PATCH, который planning-команда project.settings.update
      пишет успешно), а страж, режущий валидные данные, хуже отсутствия стража.

   Fail-soft к неполным источникам данных (in-memory dev-fallback, тестовые
   фикстуры): нет метода — нет проверки (house-паттерн `?.`-обогащения).
   ============================================================ */

export type ProjectReferenceFields = {
  projectTypeId?: string | null;
  templateId?: string | null;
  calendarId?: string | null;
};

export type ProjectReferenceError = "project_type_not_found" | "project_template_not_found";

/** Первая неизвестная ссылка или null. `null` в поле — снятие ссылки, проверять нечего. */
export async function findUnknownProjectReference(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  fields: ProjectReferenceFields
): Promise<ProjectReferenceError | null> {
  if (fields.projectTypeId && dataSource.findProjectTypeById) {
    const projectType = await dataSource.findProjectTypeById(tenantId, fields.projectTypeId);
    if (!projectType) return "project_type_not_found";
  }
  if (fields.templateId && dataSource.listProjectTemplates) {
    const templates = await dataSource.listProjectTemplates(tenantId);
    if (!templates.some((template) => template.id === fields.templateId)) {
      return "project_template_not_found";
    }
  }
  // projects.calendarId НЕ проверяем — см. комментарий к блоку 3 в шапке файла.
  return null;
}

export { isProjectIdConflict } from "../uniqueConstraintConflicts";
