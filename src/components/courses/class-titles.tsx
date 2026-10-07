"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { renameClass } from "@/lib/actions/courses";

// The course's classes; whoever manages courses can name them.
export function ClassTitles({ classes, editable }: { classes: { id: string; number: number; title: string }[]; editable: boolean }) {
  const router = useRouter();
  const [titles, setTitles] = useState(Object.fromEntries(classes.map((c) => [c.id, c.title])));
  return (
    <ol className="space-y-2">
      {classes.map((c) => (
        <li key={c.id} className="flex items-center gap-3 text-sm">
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
        </li>
      ))}
    </ol>
  );
}
