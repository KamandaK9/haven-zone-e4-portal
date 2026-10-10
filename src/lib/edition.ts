import { editionFor } from "@/lib/editions";
import { tenant } from "@/tenant";

// This deployment's edition (see editions.ts).
export const edition = editionFor(tenant.edition);
