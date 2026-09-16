import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getChurchesByCountry, getCountryStats } from "@/lib/data/analytics";
import type { Country } from "@/lib/data/types";

export function CountryGrid({ countries }: { countries: Country[] }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {countries.map((country) => {
        const stats = getCountryStats(country.id);
        const churches = getChurchesByCountry(country.id);
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
                  {stats.memberCount} members &middot; {churches.length} churches
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
