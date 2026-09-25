import { getChurchHealth, getCountry, type Dataset } from "@/lib/data/analytics";
import { ChurchHealthPager, type HealthItem } from "./church-health-pager";

type HealthRow = ReturnType<typeof getChurchHealth>[number];

// Reduces the rows to plain data on the server so only a small list — not the
// whole dataset — is sent to the paging component in the browser.
export function ChurchHealthList({ rows, ds }: { rows: HealthRow[]; ds: Dataset }) {
  const items: HealthItem[] = rows.map(({ church, memberCount, status }) => {
    const country = getCountry(ds, church.countryId);
    return {
      id: church.id,
      name: church.name,
      flag: country?.flag ?? "",
      country: country?.name ?? "",
      memberCount,
      status,
    };
  });
  return <ChurchHealthPager items={items} />;
}
