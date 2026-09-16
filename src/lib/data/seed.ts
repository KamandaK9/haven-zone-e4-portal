import type {
  ActivityItem,
  CalendarEvent,
  Church,
  Country,
  GivingPoint,
  Member,
  MemberRole,
  Training,
} from "./types";

// Deterministic PRNG so seed data is stable across navigations/renders.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260916);
const rand = () => rng();
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const chance = (p: number) => rand() < p;

export const COUNTRIES: Country[] = [
  { id: "zambia", name: "Zambia", flag: "🇿🇲" },
  { id: "zimbabwe", name: "Zimbabwe", flag: "🇿🇼" },
  { id: "malawi", name: "Malawi", flag: "🇲🇼" },
  { id: "botswana", name: "Botswana", flag: "🇧🇼" },
  { id: "mozambique", name: "Mozambique", flag: "🇲🇿" },
];

export const CHURCHES: Church[] = [
  { id: "ce-lusaka-central", name: "CE Lusaka Central", countryId: "zambia", city: "Lusaka", foundedYear: 2004, pastor: "Pastor Mumba Chanda" },
  { id: "ce-ndola", name: "CE Ndola", countryId: "zambia", city: "Ndola", foundedYear: 2007, pastor: "Pastor Bwalya Mwansa" },
  { id: "ce-kitwe", name: "CE Kitwe", countryId: "zambia", city: "Kitwe", foundedYear: 2009, pastor: "Pastor Chileshe Banda" },
  { id: "ce-livingstone", name: "CE Livingstone", countryId: "zambia", city: "Livingstone", foundedYear: 2012, pastor: "Pastor Given Sata" },

  { id: "ce-harare", name: "CE Harare", countryId: "zimbabwe", city: "Harare", foundedYear: 2003, pastor: "Pastor Tapiwa Moyo" },
  { id: "ce-bulawayo", name: "CE Bulawayo", countryId: "zimbabwe", city: "Bulawayo", foundedYear: 2008, pastor: "Pastor Sibonokuhle Ncube" },
  { id: "ce-mutare", name: "CE Mutare", countryId: "zimbabwe", city: "Mutare", foundedYear: 2011, pastor: "Pastor Farai Mutasa" },

  { id: "ce-lilongwe", name: "CE Lilongwe", countryId: "malawi", city: "Lilongwe", foundedYear: 2006, pastor: "Pastor Chikondi Phiri" },
  { id: "ce-blantyre", name: "CE Blantyre", countryId: "malawi", city: "Blantyre", foundedYear: 2010, pastor: "Pastor Memory Chirwa" },

  { id: "ce-gaborone", name: "CE Gaborone", countryId: "botswana", city: "Gaborone", foundedYear: 2005, pastor: "Pastor Kelvin Dube" },
  { id: "ce-francistown", name: "CE Francistown", countryId: "botswana", city: "Francistown", foundedYear: 2013, pastor: "Pastor Nomsa Sibanda" },

  { id: "ce-maputo", name: "CE Maputo", countryId: "mozambique", city: "Maputo", foundedYear: 2009, pastor: "Pastor Ines Cossa" },
  { id: "ce-beira", name: "CE Beira", countryId: "mozambique", city: "Beira", foundedYear: 2014, pastor: "Pastor Joaquim Nhaca" },
];

const FIRST_NAMES = [
  "Mercy", "Grace", "Joseph", "David", "Ruth", "Faith", "Emmanuel", "Precious",
  "Blessing", "Prince", "Charity", "Patience", "Kelvin", "Thandiwe", "Tapiwa",
  "Chipo", "Nomsa", "Lloyd", "Given", "Memory", "Chanda", "Lweendo", "Mwape",
  "Natasha", "Brian", "Ester", "Innocent", "Loveness", "Tendai", "Rutendo",
  "Kuda", "Vimbai", "Takudzwa", "Thabo", "Boitumelo", "Kagiso", "Lesego",
  "Amos", "Naomi", "Samuel", "Esther", "Victor", "Gift", "Comfort", "Joyce",
  "Felix", "Angela",
];

const LAST_NAMES = [
  "Chanda", "Mwansa", "Bwalya", "Tembo", "Phiri", "Banda", "Mumba", "Chileshe",
  "Sata", "Ngoma", "Moyo", "Ncube", "Dube", "Sibanda", "Mutasa", "Chirwa",
  "Zulu", "Mabaso", "Kunda", "Zimba", "Mulenga", "Lungu", "Kabwe", "Sakala",
  "Nyoni", "Gumbo", "Chikwanha", "Mutale", "Simukonda", "Cossa", "Nhaca",
  "Machel", "Tembe",
];

const AVATAR_COLORS = [
  "#7c3aed", "#a21caf", "#9333ea", "#be185d", "#6d28d9", "#c026d3", "#8b5cf6",
];

const TRAINING_NAMES = [
  "New Believers Class",
  "Foundation School",
  "Leadership Development",
  "Water Baptism",
];

const ROLE_WEIGHTS: MemberRole[] = [
  "Member", "Member", "Member", "Member", "Member", "Member",
  "Worker", "Worker", "Worker",
  "Cell Leader", "Cell Leader",
  "Pastor",
];

function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date(2026, 8, 1); // September 2026
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export const LAST_12_MONTHS = last12Months();

function randomJoinDate(): string {
  // Weighted toward the last 3 years, with a tail out to 8 years.
  const yearsAgo = chance(0.55) ? rand() * 3 : 3 + rand() * 5;
  const now = new Date(2026, 8, 16);
  const d = new Date(now.getTime() - yearsAgo * 365.25 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function buildGivingHistory(baseAmount: number, joinDate: string): GivingPoint[] {
  const joinMonth = joinDate.slice(0, 7);
  const points: GivingPoint[] = [];
  for (const month of LAST_12_MONTHS) {
    if (month < joinMonth) continue;
    if (chance(0.12)) continue; // skipped month
    const seasonalBoost = month.endsWith("-12") || month.endsWith("-04") ? 1.4 : 1;
    const amount = Math.round(baseAmount * seasonalBoost * (0.6 + rand() * 0.9));
    points.push({ month, amount });
  }
  return points;
}

function buildTrainings(joinDate: string): Training[] {
  const monthsActive =
    (new Date(2026, 8, 16).getTime() - new Date(joinDate).getTime()) /
    (1000 * 60 * 60 * 24 * 30);
  return TRAINING_NAMES.map((name, i) => {
    const threshold = (i + 1) * 2; // later trainings need more tenure
    let status: Training["status"] = "not_started";
    if (monthsActive > threshold + randInt(-2, 4)) {
      status = chance(0.85) ? "completed" : "in_progress";
    } else if (monthsActive > threshold - 2 && chance(0.4)) {
      status = "in_progress";
    }
    return { name, status };
  });
}

function generateMembers(): Member[] {
  const members: Member[] = [];
  const churchSizeWeights: Record<string, number> = {
    "ce-lusaka-central": 6,
    "ce-ndola": 4,
    "ce-kitwe": 3,
    "ce-livingstone": 2,
    "ce-harare": 5,
    "ce-bulawayo": 3,
    "ce-mutare": 2,
    "ce-lilongwe": 3,
    "ce-blantyre": 2,
    "ce-gaborone": 3,
    "ce-francistown": 2,
    "ce-maputo": 3,
    "ce-beira": 2,
  };

  let idCounter = 1;
  for (const church of CHURCHES) {
    const count = churchSizeWeights[church.id] ?? 3;
    for (let i = 0; i < count; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const joinDate = randomJoinDate();
      const baseGiving = randInt(15, 120);
      const id = `mem-${String(idCounter).padStart(3, "0")}`;
      idCounter++;
      members.push({
        id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${idCounter}@havenmail.org`,
        phone: `+${randInt(260, 267)} ${randInt(70, 99)}${randInt(1000000, 9999999)}`,
        churchId: church.id,
        countryId: church.countryId,
        joinDate,
        role: pick(ROLE_WEIGHTS),
        avatarColor: pick(AVATAR_COLORS),
        giving: buildGivingHistory(baseGiving, joinDate),
        trainings: buildTrainings(joinDate),
      });
    }
  }
  return members;
}

export const MEMBERS: Member[] = generateMembers();

function generateActivity(): ActivityItem[] {
  const items: ActivityItem[] = [];
  const now = new Date(2026, 8, 16, 9, 0);
  const templates: { type: ActivityItem["type"]; text: (churchName: string) => string }[] = [
    { type: "new_member", text: (c) => `New member added at ${c}` },
    { type: "training_complete", text: (c) => `5 members completed New Believers Class at ${c}` },
    { type: "baptism", text: (c) => `3 members baptized in water at ${c}` },
    { type: "giving", text: (c) => `${c} recorded a strong giving week` },
    { type: "event", text: (c) => `Leadership meeting held at ${c}` },
    { type: "training_complete", text: (c) => `Foundation School graduation at ${c}` },
    { type: "new_member", text: (c) => `2 new members joined at ${c}` },
  ];
  for (let i = 0; i < 18; i++) {
    const church = pick(CHURCHES);
    const template = pick(templates);
    const hoursAgo = i * randInt(4, 14);
    items.push({
      id: `act-${i + 1}`,
      type: template.type,
      message: template.text(church.name),
      churchId: church.id,
      timestamp: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
    });
  }
  return items;
}

export const ACTIVITY: ActivityItem[] = generateActivity();

function generateEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const titles: { title: string; type: CalendarEvent["type"] }[] = [
    { title: "Zone Leaders Meeting", type: "meeting" },
    { title: "Foundation School Session", type: "training" },
    { title: "Cell Leaders Training", type: "training" },
    { title: "Sunday Impact Service", type: "service" },
    { title: "Midweek Communion Service", type: "service" },
    { title: "Community Outreach", type: "outreach" },
    { title: "New Believers Class", type: "training" },
    { title: "Zone E4 Ministers Conference", type: "meeting" },
    { title: "Prayer & Fasting Vigil", type: "service" },
    { title: "Leadership Development Workshop", type: "training" },
  ];
  let id = 1;
  for (let day = 1; day <= 30; day++) {
    if (!chance(0.35)) continue;
    const t = pick(titles);
    const church = chance(0.7) ? pick(CHURCHES) : undefined;
    events.push({
      id: `evt-${id++}`,
      title: t.title,
      type: t.type,
      date: `2026-09-${String(day).padStart(2, "0")}`,
      time: `${randInt(8, 18)}:${chance(0.5) ? "00" : "30"}`,
      churchId: church?.id,
      countryId: church?.countryId,
    });
  }
  return events;
}

export const EVENTS: CalendarEvent[] = generateEvents();
