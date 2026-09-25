import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { readFileSync } from "node:fs";

// The tenant's own names, which core code must never hard-code.
const { bannedCopy } = JSON.parse(readFileSync(new URL("./src/tenant/lint.json", import.meta.url), "utf8"));
const banned = new RegExp(bannedCopy.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Stratum/tenant boundary: core (everything outside src/tenant/) reads the
  // tenant only via `import { tenant } from "@/tenant"`, and never hard-codes
  // the organisation it happens to be deployed for.
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/tenant/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/tenant/*", "**/tenant/*"],
              message: 'Import the tenant via `import { tenant } from "@/tenant"`, not its internals.',
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...["Literal", "JSXText"].map((node) => ({
          selector: `${node}[value=${banned}]`,
          message: "Tenant-specific copy belongs in src/tenant/ — read it from `tenant`.",
        })),
        {
          selector: `Literal[regex.pattern=${banned}]`,
          message: "Tenant-specific copy belongs in src/tenant/ — read it from `tenant`.",
        },
        {
          selector: `TemplateElement[value.raw=${banned}]`,
          message: "Tenant-specific copy belongs in src/tenant/ — read it from `tenant`.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
