"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteResource } from "@/lib/actions/resources";

export function DeleteResourceButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`Remove ${title}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={async () => {
        if (!confirm(`Remove "${title}" from resources?`)) return;
        await deleteResource(id);
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
