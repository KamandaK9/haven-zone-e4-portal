"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChapterPicker({ chapters, value, tab }: { chapters: { id: string; name: string }[]; value: string; tab: string }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(chapter) => router.push(`/records?${new URLSearchParams({ tab, chapter })}`)}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Chapter">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chapters.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
