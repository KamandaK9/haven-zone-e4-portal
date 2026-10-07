"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { renameClass } from "@/lib/actions/courses";
import { ClassMaterials, type MaterialView } from "./class-materials";

// The course's classes and their materials; whoever manages courses can
// name them and add materials.
export function ClassTitles({
  classes,
  editable,
  materials = [],
}: {
  classes: { id: string; number: number; title: string }[];
  editable: boolean;
  materials?: MaterialView[];
}) {
  const router = useRouter();
  const [titles, setTitles] = useState(Object.fromEntries(classes.map((c) => [c.id, c.title])));
  return (
    <ol className="divide-y">
      {classes.map((c) => (
        <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-muted-foreground">Class {c.number}</span>
          {editable ? (
            <Input
              className="h-8"
              placeholder="Add a title"
              value={titles[c.id] ?? ""}
              onChange={(e) => setTitles({ ...titles, [c.id]: e.target.value })}
              onBlur={async () => {
                if ((titles[c.id] ?? "") === c.title) return;
                await renameClass(c.id, titles[c.id] ?? "");
                router.refresh();
              }}
            />
          ) : (
            <span>{c.title || "—"}</span>
          )}
          </div>
          <div className="pl-[76px]">
            <ClassMaterials
              classId={c.id}
              className={c.title ? `Class ${c.number}: ${c.title}` : `Class ${c.number}`}
              materials={materials.filter((m) => m.classId === c.id)}
              canEdit={editable}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
