"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GIVING_FILTER_OPTIONS, type GivingFilter } from "@/lib/giving";

// Drives every giving figure on the page through a ?giving= search param so
// the choice survives a refresh and the numbers stay server-rendered.
export function GivingCategorySelect({ value }: { value: GivingFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    startTransition(() => {
      router.replace(next === "all" ? pathname : `${pathname}?giving=${next}`, { scroll: false });
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-48 h-9 px-3 font-medium" aria-label="Giving category">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-48">
        {GIVING_FILTER_OPTIONS.map((o) => (
          <SelectItem key={o.id} value={o.id} className="py-2.5">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
