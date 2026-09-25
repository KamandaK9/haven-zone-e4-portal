import { Landmark, Globe2, Users, Tent, Sparkles } from "lucide-react";
import type { TenantConfig } from "@/lib/tenant";

// The Haven Zone E4. Everything that makes this deployment The Haven rather
// than a generic Stratum portal lives in this folder; see src/lib/tenant.ts.
export const tenant: TenantConfig = {
  name: "The Haven",
  portalName: "The Haven Zone Portal",
  description: "Member management and analytics for The Haven Zone E4",
  defaultOrgName: "The Haven Zone E4",
  emailPlaceholder: "you@havenzonee4.org",
  // public/logo-mark.png is cropped from the real Haven logo — mark only,
  // the baked-in text removed.
  logo: { src: "/logo-mark.png", alt: "The Haven", width: 345, height: 414 },
  chartPrimary: "#7c3aed",

  // The nine countries The Haven Zone E4 covers.
  countries: [
    { name: "South Africa", flag: "🇿🇦" },
    { name: "Botswana", flag: "🇧🇼" },
    { name: "Zimbabwe", flag: "🇿🇼" },
    { name: "Namibia", flag: "🇳🇦" },
    { name: "Zambia", flag: "🇿🇲" },
    { name: "Malawi", flag: "🇲🇼" },
    { name: "Eswatini", flag: "🇸🇿" },
    { name: "Mozambique", flag: "🇲🇿" },
    { name: "Angola", flag: "🇦🇴" },
  ],

  // The five annual flagship events.
  eventSeries: [
    { slug: "national-executive-assembly", name: "National Executive Assembly", shortName: "Executive Assembly", icon: Landmark },
    { slug: "international-convention", name: "The Haven International Convention", shortName: "International Convention", icon: Globe2 },
    { slug: "zonal-convention", name: "The Haven Zonal Convention", shortName: "Zonal Convention", icon: Users },
    { slug: "camp-meeting", name: "The Haven Camp Meeting", shortName: "Camp Meeting", icon: Tent },
    { slug: "special-programmes", name: "Special Programmes", shortName: "Special Programmes", icon: Sparkles },
  ],

  lessonExamples: { video: "e.g. Welcome to Haven Zone E4", quiz: "e.g. Haven Orientation quiz" },

  roster: {
    // Leadership-summary sheets prefix chapters with "Haven"/"CE"/"Christ
    // Embassy" while each sub-zone sheet uses the bare local name.
    chapterPrefixes: ["christ embassy", "ce", "haven"],
    countryGuesses: [
      ["Zimbabwe", ["belvedere","borrowdale","chinhoyi","eastlea","glen norah","glen view","harare","hatfield","amakhosi","beitbridge","bulawayo","byo","chiredzi","gwanda","gweru","hwange","kuwadzana","kwekwe","marondera","masvingo","mpopoma","msasa park","mukakose","highfield","highffield","norton","pumula","ruwa","shurugwi","sunningdale","tynwald","victoria falls","waterfalls","zvishavane","quantum grace","new bulawayo","new byo"]],
      ["Botswana", ["gaborone","francistown","jwaneng","kanye","kasane","letlhakane","lobatse","maun","mmadinare","mochudi","mogoditshane","molepolole","orapa","palapye","phikwe","ramotswa","serowe"]],
      ["South Africa", ["sandton","midrand","east london","mthatha","queenstown","qtwn","port elizabeth"]],
      ["Namibia", ["windhoek","swakopmund","walvisbay","katutura","oshakati"]],
      ["Zambia", ["kitwe","lusaka","ndola","makeni","solwezi","uptown","millenials zambia"]],
      ["Eswatini", ["ezulwini","manzini","matsapha","mbabane"]],
      ["Malawi", ["malawi"]],
    ],
  },
};
