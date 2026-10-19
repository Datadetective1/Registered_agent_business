import Link from "next/link";
import { SiteSettingsForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/ui/layout";
import { LEGAL_DOCS } from "@/config/legal";
import { flattenToFormValues } from "@/lib/forms";
import { getSettings } from "@/server/settings";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const values = flattenToFormValues({ ...s, operations: { ...s.operations, renewalReminderDays: s.operations.renewalReminderDays.join(", ") } });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={
          <>
            Brand and business details. Defaults live in <code>src/config/site.ts</code>; values saved here override them.{" "}
            <Link href="/admin/settings/services" className="text-brand hover:underline">
              Edit services & pricing →
            </Link>
          </>
        }
      />
      <SiteSettingsForm values={values} legalDocs={LEGAL_DOCS.map((d) => ({ slug: d.slug, title: d.title }))} />
    </div>
  );
}
