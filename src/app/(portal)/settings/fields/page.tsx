import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ImportTemplateSummary } from "@/components/settings/import-template-summary";
import { MemberFieldsManager } from "@/components/settings/member-fields-manager";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getImportTemplate, getMemberFields } from "@/lib/data/member-fields";
import { BUILTIN_TARGETS } from "@/lib/import/column-mapping";
import { tenant } from "@/tenant";

// The organisation's own member fields, and the spreadsheet column choices
// saved from the last import.
export default async function MemberFieldsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_settings")) redirect("/settings");

  const [fields, template] = await Promise.all([getMemberFields(profile.zoneId), getImportTemplate(profile.zoneId)]);

  const describe = (target: string): string => {
    if (target === "skip") return "Not imported";
    const [kind, name] = target.split(":");
    if (kind === "builtin") {
      if (name === "cellName") return tenant.labels.cell;
      return BUILTIN_TARGETS.find((b) => b.field === name)?.label ?? name;
    }
    return fields.find((f) => f.key === name)?.label ?? `${name} (deleted field)`;
  };
  const templateRows = Object.entries(template ?? {}).map(([column, target]) => ({ column, target: describe(target) }));

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Member fields" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Member fields</h1>
        <p className="text-sm text-muted-foreground">
          Extra details your organisation keeps about people — a baptism date, a department, a T-shirt size. Each one
          shows on member pages for the leaders you choose, and can be filled from a spreadsheet when importing.
        </p>
      </div>

      <MemberFieldsManager fields={fields} />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Import columns</h2>
          <p className="text-sm text-muted-foreground">
            {templateRows.length > 0
              ? "How your spreadsheet's columns are matched when importing members. Change them in the import itself — tick “Remember these choices”."
              : "Nothing saved yet. When importing members, match the columns and tick “Remember these choices for next time”."}
          </p>
        </div>
        {templateRows.length > 0 && <ImportTemplateSummary rows={templateRows} />}
      </section>
    </div>
  );
}
