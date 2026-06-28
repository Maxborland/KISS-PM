import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectClients } from "@/crm/clients/clients-surface";

// Прод-route «Клиенты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/clients).
export default function CrmClientsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectClients />
    </CrmRuntimeProvider>
  );
}
