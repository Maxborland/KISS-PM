import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectContacts } from "@/crm/contacts/contacts-surface";

// Прод-route «Контакты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/contacts).
export default function CrmContactsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectContacts />
    </CrmRuntimeProvider>
  );
}
