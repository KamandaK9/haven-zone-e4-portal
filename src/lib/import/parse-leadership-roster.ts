import { readAllExcelSheets } from "./read-table-file";

// The source workbook is a hand-maintained org chart, not a flat export:
// one sheet per sub-zone (SZ1, SZ2, ...) plus three zone-level leadership
// summary sheets (ZONAL DIRECTOR, ZONAL SECRETARIES, GOVERNORS). Every
// Governor/Secretary appears twice — once in their own sub-zone sheet
// (with a church/chapter attached) and again in a summary sheet (without
// one) — so people are deduplicated by email (falling back to phone) and
// merged, preferring whichever occurrence has real chapter/role data.
const HEADER = {
  title: "title",
  firstName: "firstname",
  lastName: "surname",
  designation: "designation",
  chapter: "chapter",
  churchZone: "church zone",
  email: "email address",
  kcHandle: "kc handle",
  phone: "phone number",
  profession: "profession",
  spouse: "name of spouse",
  birthday: "birthday",
  anniversary: "wedding anniversary",
} as const;

function col(headers: string[], label: string): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === label);
}

function clean(v: string | undefined): string | undefined {
  const t = v?.trim().replace(/\s+/g, " ");
  return t ? t : undefined;
}

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  // Compare by the local subscriber number — country-code/leading-zero
  // formatting is inconsistent across sheets for the same real number.
  return digits.length >= 9 ? digits.slice(-9) : digits || undefined;
}

// Higher-ranking designations win when the same person's row is merged
// from multiple sheets, and decide portal-role elevation.
const LEADERSHIP_KEYWORDS = ["director", "secretary", "governor", "dg "];

function isLeadershipTitle(title: string | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return LEADERSHIP_KEYWORDS.some((k) => t.includes(k));
}

function churchRoleFor(title: string | undefined): "Member" | "Pastor" | "Cell Leader" {
  if (!title) return "Member";
  const t = title.toLowerCase();
  if (t.includes("director") || t.includes("pastor")) return "Pastor";
  if (t.includes("governor") || t.includes("secretary")) return "Cell Leader";
  return "Member";
}

// Best-effort suggestions only — every one of these ships to the wizard's
// review table as an editable, pre-filled guess, never applied silently.
const COUNTRY_GUESSES: [string, string[]][] = [
  ["Zimbabwe", ["belvedere","borrowdale","chinhoyi","eastlea","glen norah","glen view","harare","hatfield","amakhosi","beitbridge","bulawayo","byo","chiredzi","gwanda","gweru","hwange","kuwadzana","kwekwe","marondera","masvingo","mpopoma","msasa park","mukakose","highfield","highffield","norton","pumula","ruwa","shurugwi","sunningdale","tynwald","victoria falls","waterfalls","zvishavane","quantum grace","new bulawayo","new byo"]],
  ["Botswana", ["gaborone","francistown","jwaneng","kanye","kasane","letlhakane","lobatse","maun","mmadinare","mochudi","mogoditshane","molepolole","orapa","palapye","phikwe","ramotswa","serowe"]],
  ["South Africa", ["sandton","midrand","east london","mthatha","queenstown","qtwn","port elizabeth"]],
  ["Namibia", ["windhoek","swakopmund","walvisbay","katutura","oshakati"]],
  ["Zambia", ["kitwe","lusaka","ndola","makeni","solwezi","uptown","millenials zambia"]],
  ["Eswatini", ["ezulwini","manzini","matsapha","mbabane"]],
  ["Malawi", ["malawi"]],
];

function guessCountry(chapter: string): string {
  const c = chapter.toLowerCase();
  for (const [country, keywords] of COUNTRY_GUESSES) {
    if (keywords.some((k) => c.includes(k))) return country;
  }
  return "";
}

// Collapses spelling variants that come from the leadership-summary sheets
// prefixing with "Haven"/"CE"/"Christ Embassy" while a person's own
// sub-zone sheet uses the bare local name (e.g. "Haven Belvedere" vs
// "Belvedere" are the same church).
export function normalizeChapterKey(chapter: string): string {
  return chapter
    .toLowerCase()
    .trim()
    .replace(/^(the\s+)?(christ embassy|ce|haven)\s*-?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type RosterPerson = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  kcHandle?: string;
  profession?: string;
  spouseName?: string;
  birthday?: string;
  weddingAnniversary?: string;
  chapterRaw: string;
  elevateToAdmin: boolean;
  churchRole: "Member" | "Pastor" | "Cell Leader";
};

export type ChapterGroup = {
  key: string; // normalizeChapterKey() output — stable id for this group
  suggestedName: string; // longest/most descriptive raw spelling seen
  suggestedCountry: string; // "" if no confident guess
  variants: string[]; // every raw spelling that collapsed into this group
  memberCount: number;
};

export type RosterParseResult = {
  people: RosterPerson[]; // deduplicated across all 11 sheets
  chapterGroups: ChapterGroup[];
  duplicatesMerged: number;
  skipped: { sheet: string; reason: string }[];
};

export async function parseLeadershipRoster(file: File): Promise<RosterParseResult> {
  const sheets = await readAllExcelSheets(file);
  const skipped: { sheet: string; reason: string }[] = [];

  // key: normalized email, or "phone:<digits>" fallback, or a synthetic
  // per-row key when neither is present (can't be deduplicated, but still
  // imported).
  const byKey = new Map<string, RosterPerson>();
  let duplicatesMerged = 0;
  let anonCounter = 0;

  for (const sheet of sheets) {
    const idx = {
      title: col(sheet.headers, HEADER.title),
      firstName: col(sheet.headers, HEADER.firstName),
      lastName: col(sheet.headers, HEADER.lastName),
      designation: col(sheet.headers, HEADER.designation),
      chapter: col(sheet.headers, HEADER.chapter),
      email: col(sheet.headers, HEADER.email),
      kcHandle: col(sheet.headers, HEADER.kcHandle),
      phone: col(sheet.headers, HEADER.phone),
      profession: col(sheet.headers, HEADER.profession),
      spouse: col(sheet.headers, HEADER.spouse),
      birthday: col(sheet.headers, HEADER.birthday),
      anniversary: col(sheet.headers, HEADER.anniversary),
    };
    if (idx.firstName === -1 || idx.lastName === -1) {
      skipped.push({ sheet: sheet.sheetName, reason: "No FIRSTNAME/SURNAME columns found" });
      continue;
    }

    // Row 1 (first data row) is sometimes a bare section label — a single
    // value in column A (e.g. "Sandton") with every other cell blank —
    // used as the fallback chapter name for rows that leave CHAPTER empty.
    let sectionLabel: string | undefined;
    const first = sheet.rows[0];
    if (first && first[0]?.trim() && first.slice(1).every((c) => !c?.trim())) {
      sectionLabel = first[0].trim();
    }

    for (const row of sheet.rows) {
      const firstName = clean(row[idx.firstName]);
      const lastName = clean(row[idx.lastName]);
      if (!firstName || !lastName) continue; // header/blank/section-label row

      const chapterRaw =
        (idx.chapter !== -1 ? clean(row[idx.chapter]) : undefined) ?? sectionLabel;
      if (!chapterRaw) {
        skipped.push({ sheet: sheet.sheetName, reason: `${firstName} ${lastName}: no chapter/church identified` });
        continue;
      }

      const email = clean(idx.email !== -1 ? row[idx.email] : undefined)?.toLowerCase();
      const phone = clean(idx.phone !== -1 ? row[idx.phone] : undefined);
      const title = clean(idx.designation !== -1 ? row[idx.designation] : undefined);

      const person: RosterPerson = {
        firstName,
        lastName,
        email,
        phone,
        title,
        kcHandle: clean(idx.kcHandle !== -1 ? row[idx.kcHandle] : undefined),
        profession: clean(idx.profession !== -1 ? row[idx.profession] : undefined),
        spouseName: clean(idx.spouse !== -1 ? row[idx.spouse] : undefined),
        birthday: clean(idx.birthday !== -1 ? row[idx.birthday] : undefined),
        weddingAnniversary: clean(idx.anniversary !== -1 ? row[idx.anniversary] : undefined),
        chapterRaw,
        elevateToAdmin: isLeadershipTitle(title),
        churchRole: churchRoleFor(title),
      };

      const normPhone = normalizePhone(phone);
      const key = email ?? (normPhone ? `phone:${normPhone}` : `row:${anonCounter++}`);

      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, person);
        continue;
      }

      duplicatesMerged++;
      // Prefer whichever occurrence carries a real chapter (the sub-zone
      // sheet), but union in any field the other occurrence has that this
      // one is missing, and keep the more senior title/role found.
      const preferNew = !existing.chapterRaw && !!chapterRaw;
      const base = preferNew ? person : existing;
      const other = preferNew ? existing : person;
      byKey.set(key, {
        ...base,
        kcHandle: base.kcHandle ?? other.kcHandle,
        profession: base.profession ?? other.profession,
        spouseName: base.spouseName ?? other.spouseName,
        birthday: base.birthday ?? other.birthday,
        weddingAnniversary: base.weddingAnniversary ?? other.weddingAnniversary,
        title: base.title ?? other.title,
        elevateToAdmin: base.elevateToAdmin || other.elevateToAdmin,
        churchRole: base.churchRole !== "Member" ? base.churchRole : other.churchRole,
      });
    }
  }

  const people = [...byKey.values()];

  // Group raw chapter spellings for the wizard's review table.
  const groups = new Map<string, ChapterGroup>();
  for (const p of people) {
    const key = normalizeChapterKey(p.chapterRaw);
    let group = groups.get(key);
    if (!group) {
      group = { key, suggestedName: p.chapterRaw, suggestedCountry: guessCountry(p.chapterRaw), variants: [], memberCount: 0 };
      groups.set(key, group);
    }
    if (!group.variants.includes(p.chapterRaw)) group.variants.push(p.chapterRaw);
    if (p.chapterRaw.length > group.suggestedName.length) group.suggestedName = p.chapterRaw;
    group.memberCount++;
  }

  return {
    people,
    chapterGroups: [...groups.values()].sort((a, b) => a.suggestedName.localeCompare(b.suggestedName)),
    duplicatesMerged,
    skipped,
  };
}
