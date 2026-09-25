import { readAllExcelSheets } from "./read-table-file";
import { parseDesignation, positionRank, type Portfolio, type Position } from "@/lib/access";
import { namesAgree, nameKey, normalizePhone } from "@/lib/name-match";
import { tenant } from "@/tenant";

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

function churchRoleFor(title: string | undefined): "Member" | "Pastor" | "Cell Leader" {
  if (!title) return "Member";
  const t = title.toLowerCase();
  if (t.includes("director") || t.includes("pastor")) return "Pastor";
  if (t.includes("governor") || t.includes("secretary")) return "Cell Leader";
  return "Member";
}

// Best-effort suggestions only — every one of these ships to the wizard's
// review table as an editable, pre-filled guess, never applied silently.
const COUNTRY_GUESSES = tenant.roster.countryGuesses;

function guessCountry(chapter: string): string {
  const c = chapter.toLowerCase();
  for (const [country, keywords] of COUNTRY_GUESSES) {
    if (keywords.some((k) => c.includes(k))) return country;
  }
  return "";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Leading "(the) <prefix>" on a chapter name, built from the tenant's
// chapterPrefixes. Null when the tenant has none, so nothing is stripped.
const CHAPTER_PREFIX_RE = tenant.roster.chapterPrefixes.length
  ? new RegExp(`^(the\\s+)?(${tenant.roster.chapterPrefixes.map(escapeRegExp).join("|")})\\s*-?\\s*`, "i")
  : null;

// Collapses spelling variants that come from the leadership-summary sheets
// prefixing chapters with an org name (see tenant.roster.chapterPrefixes)
// while a person's own sub-zone sheet uses the bare local name (e.g.
// "<Prefix> Belvedere" vs "Belvedere" are the same church).
export function normalizeChapterKey(chapter: string): string {
  const key = chapter.toLowerCase().trim();
  return (CHAPTER_PREFIX_RE ? key.replace(CHAPTER_PREFIX_RE, "") : key)
    .replace(/\s+/g, " ")
    .trim();
}

// "Zonal Office" is where zone-level leaders sit — a home row, not a chapter.
export function isZonalOffice(chapter: string): boolean {
  return normalizeChapterKey(chapter) === "zonal office";
}

// Sheet tabs are the sub-zones ("SZ1", "SZ10"); the DESIGNATION text of sub
// zone governors also carries it ("Sub Zone Governor - SZ3").
function subZoneFrom(sheetName: string, designation: string | undefined): string | undefined {
  const fromSheet = /^SZ\s*(\d+)$/i.exec(sheetName.trim());
  if (fromSheet) return `SZ${fromSheet[1]}`;
  const fromDesignation = /\bSZ\s*(\d+)\b/i.exec(designation ?? "");
  return fromDesignation ? `SZ${fromDesignation[1]}` : undefined;
}

// A CHAPTER cell that just says "Subzone 2" names the sub-zone, not a chapter.
function looksLikeSubZoneLabel(chapter: string): boolean {
  return /^sub\s*-?\s*zone\s*\d*$/i.test(chapter.trim());
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
  subZone?: string;
  position: Position;
  portfolio: Portfolio | null;
  // Set when the DESIGNATION text wasn't a role we know — kept as a plain
  // Member and surfaced for review rather than silently promoted.
  unrecognisedDesignation?: string;
  churchRole: "Member" | "Pastor" | "Cell Leader";
};

export type ChapterGroup = {
  key: string; // normalizeChapterKey() output — stable id for this group
  suggestedName: string; // longest/most descriptive raw spelling seen
  suggestedCountry: string; // "" if no confident guess
  suggestedSubZone: string; // "" if the roster doesn't say
  isOffice: boolean;
  variants: string[]; // every raw spelling that collapsed into this group
  memberCount: number;
};

export type RosterParseResult = {
  people: RosterPerson[]; // deduplicated across all 11 sheets
  chapterGroups: ChapterGroup[];
  duplicatesMerged: number;
  skipped: { sheet: string; reason: string }[];
  positionCounts: Partial<Record<Position, number>>;
  unrecognised: { name: string; designation: string }[];
};

export async function parseLeadershipRoster(file: File): Promise<RosterParseResult> {
  const sheets = await readAllExcelSheets(file);
  const skipped: { sheet: string; reason: string }[] = [];

  // key: normalized email, or "phone:<digits>" fallback, or a synthetic
  // per-row key when neither is present (can't be deduplicated, but still
  // imported).
  // The same person is listed on a summary sheet and again on their sub-zone
  // sheet, often with a different email, a typo'd number, or an email on one
  // row and none on the other. So a row is a duplicate if it shares ANY of:
  // an email, a phone number, or the same name in the same chapter.
  const list: RosterPerson[] = [];
  const indexByIdentity = new Map<string, number>();
  let duplicatesMerged = 0;

  const identitiesOf = (p: RosterPerson): string[] => {
    const ids: string[] = [];
    if (p.email) ids.push(`email:${p.email}`);
    const phone = normalizePhone(p.phone);
    if (phone) ids.push(`phone:${phone}`);
    ids.push(`name:${nameKey(p)}|${normalizeChapterKey(p.chapterRaw)}`);
    return ids;
  };

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

    // Sub-zone sheets are broken into chapters by bare section-label rows — a
    // single value in column A ("Sandton") with every other cell blank — and
    // every person beneath one belongs to that chapter, until the next label.
    let sectionLabel: string | undefined;

    for (const row of sheet.rows) {
      if (row[0]?.trim() && row.slice(1).every((c) => !c?.trim())) {
        sectionLabel = row[0].trim();
        continue;
      }

      const firstName = clean(row[idx.firstName]);
      const lastName = clean(row[idx.lastName]);
      if (!firstName || !lastName) continue; // header/blank row

      const chapterCell = idx.chapter !== -1 ? clean(row[idx.chapter]) : undefined;
      const usableChapterCell = chapterCell && !looksLikeSubZoneLabel(chapterCell) ? chapterCell : undefined;
      // The section label is the bare local name; prefer it over a CHAPTER
      // cell that may carry an org-name prefix or a sub-zone label.
      const chapterRaw = sectionLabel ?? usableChapterCell;
      if (!chapterRaw) {
        skipped.push({ sheet: sheet.sheetName, reason: `${firstName} ${lastName}: no chapter/church identified` });
        continue;
      }

      const email = clean(idx.email !== -1 ? row[idx.email] : undefined)?.toLowerCase();
      const phone = clean(idx.phone !== -1 ? row[idx.phone] : undefined);
      const title = clean(idx.designation !== -1 ? row[idx.designation] : undefined);

      const designation = parseDesignation(title);
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
        subZone: subZoneFrom(sheet.sheetName, title),
        position: designation.position,
        portfolio: designation.portfolio,
        unrecognisedDesignation: designation.unrecognised ? title : undefined,
        churchRole: churchRoleFor(title),
      };

      const identities = identitiesOf(person);
      const existingIndex = identities
        .map((id) => indexByIdentity.get(id))
        .find((idx) => idx !== undefined && namesAgree(list[idx], person));
      if (existingIndex === undefined) {
        list.push(person);
        for (const id of identities) indexByIdentity.set(id, list.length - 1);
        continue;
      }

      duplicatesMerged++;
      // Keep the first-seen row as the base, but union in any field the other
      // occurrence has that this one is missing, and keep the more senior
      // position found.
      const base = list[existingIndex];
      const other = person;
      const otherSenior = positionRank(other.position) < positionRank(base.position);
      const merged: RosterPerson = {
        ...base,
        email: base.email ?? other.email,
        phone: base.phone ?? other.phone,
        kcHandle: base.kcHandle ?? other.kcHandle,
        profession: base.profession ?? other.profession,
        spouseName: base.spouseName ?? other.spouseName,
        birthday: base.birthday ?? other.birthday,
        weddingAnniversary: base.weddingAnniversary ?? other.weddingAnniversary,
        title: base.title ?? other.title,
        subZone: base.subZone ?? other.subZone,
        position: otherSenior ? other.position : base.position,
        portfolio: otherSenior ? other.portfolio : base.portfolio,
        unrecognisedDesignation:
          base.unrecognisedDesignation && other.unrecognisedDesignation ? base.unrecognisedDesignation : undefined,
        churchRole: base.churchRole !== "Member" ? base.churchRole : other.churchRole,
      };
      list[existingIndex] = merged;
      // Everything either row is known by now points at the merged person.
      for (const id of [...identities, ...identitiesOf(merged)]) indexByIdentity.set(id, existingIndex);
    }
  }

  const people = list;

  // Group raw chapter spellings for the wizard's review table.
  const groups = new Map<string, ChapterGroup>();
  const subZoneVotes = new Map<string, Map<string, number>>();
  for (const p of people) {
    const key = normalizeChapterKey(p.chapterRaw);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        suggestedName: p.chapterRaw,
        suggestedCountry: guessCountry(p.chapterRaw),
        suggestedSubZone: "",
        isOffice: isZonalOffice(p.chapterRaw),
        variants: [],
        memberCount: 0,
      };
      groups.set(key, group);
    }
    if (p.subZone) {
      const votes = subZoneVotes.get(key) ?? new Map<string, number>();
      votes.set(p.subZone, (votes.get(p.subZone) ?? 0) + 1);
      subZoneVotes.set(key, votes);
    }
    if (!group.variants.includes(p.chapterRaw)) group.variants.push(p.chapterRaw);
    if (p.chapterRaw.length > group.suggestedName.length) group.suggestedName = p.chapterRaw;
    group.memberCount++;
  }

  // A chapter belongs to whichever sub-zone most of its people are listed under.
  for (const [key, votes] of subZoneVotes) {
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) groups.get(key)!.suggestedSubZone = top[0];
  }

  const positionCounts: Partial<Record<Position, number>> = {};
  for (const p of people) positionCounts[p.position] = (positionCounts[p.position] ?? 0) + 1;

  return {
    people,
    positionCounts,
    unrecognised: people
      .filter((p) => p.unrecognisedDesignation)
      .map((p) => ({ name: `${p.firstName} ${p.lastName}`, designation: p.unrecognisedDesignation! })),
    chapterGroups: [...groups.values()].sort((a, b) => a.suggestedName.localeCompare(b.suggestedName)),
    duplicatesMerged,
    skipped,
  };
}
