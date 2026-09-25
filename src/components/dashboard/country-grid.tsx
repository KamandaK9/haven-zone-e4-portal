import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getChurchesByCountry, getCountryStats, type Dataset } from "@/lib/data/analytics";
import type { Country } from "@/lib/data/types";
import { pluralize } from "@/lib/utils";

export function CountryGrid({ countries, ds }: { countries: Country[]; ds: Dataset }) {
  if (countries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        No countries yet. Add some from Zone Setup.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {countries.map((country) => {
        const stats = getCountryStats(ds, country.id);
        const churches = getChurchesByCountry(ds, country.id);
        return (
          <Link
            key={country.id}
            href={`/countries/${country.id}`}
            className="group flex items-center justify-between rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl leading-none">{country.flag}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {country.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pluralize(stats.memberCount, "member")} &middot; {pluralize(churches.length, "chapter")}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        );
      })}
    </div>
  );
}
