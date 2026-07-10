CREATE UNIQUE INDEX IF NOT EXISTS planning_saved_views_project_name_uidx
  ON planning_saved_views (tenant_id, project_id, lower(name))
  WHERE scope = 'project';

CREATE UNIQUE INDEX IF NOT EXISTS planning_saved_views_user_name_uidx
  ON planning_saved_views (tenant_id, project_id, owner_user_id, lower(name))
  WHERE scope = 'user';
