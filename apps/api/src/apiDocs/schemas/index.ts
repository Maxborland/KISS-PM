import { coreSchemas } from "./core";
import { workspaceSchemas } from "./workspace";
import { crmProjectSchemas } from "./crmProjects";
import { storageSearchKnowledgeSchemas } from "./storageSearchKnowledge";
import { capacityCalendarSchemas } from "./capacityCalendars";
import { controlClosureSchemas } from "./controlClosure";
import { collaborationSchemas } from "./collaboration";
import { backgroundJobSchemas } from "./backgroundJobs";
import { planningSchemas } from "./planning";
import { agentSchemas } from "./agent";

export const openApiSchemas = {
  ...coreSchemas,
  ...workspaceSchemas,
  ...crmProjectSchemas,
  ...storageSearchKnowledgeSchemas,
  ...capacityCalendarSchemas,
  ...controlClosureSchemas,
  ...collaborationSchemas,
  ...backgroundJobSchemas,
  ...planningSchemas,
  ...agentSchemas
};
