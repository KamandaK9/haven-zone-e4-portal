"use client";

import { useState } from "react";
import { ChevronDown, Download, Info } from "lucide-react";
import { downloadMemberTemplate } from "@/lib/import/member-template";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";
import { cn } from "@/lib/utils";

const l = (s: string) => s.toLowerCase();

// What a new organisation should have ready, and the few things worth
// knowing, before the first setup screen.
export function BeforeYouStart() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 p-4 text-left">
        <Info className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-medium">Before you start</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-4 px-4 pb-4 text-sm sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="font-medium">Have these ready</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Your member spreadsheet, as you already keep it — any layout.{" "}
                <button type="button" onClick={() => downloadMemberTemplate()} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Download className="h-3 w-3" /> No spreadsheet? Use the template
                </button>
              </li>
              <li>The names of your {l(labels.locations)}.</li>
              <li>Email addresses of anyone helping you run the portal.</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium">Good to know</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Setup runs once and makes you the main admin of {tenant.name}.</li>
              <li>
                {labels.cells} are set up from your spreadsheet — you&apos;ll confirm the list, spelling slips already grouped.
              </li>
              <li>Members can come in now or later; everyone else joins by invite, seeing only their part.</li>
              <li>If anything fails, nothing is kept — you can simply run setup again.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
