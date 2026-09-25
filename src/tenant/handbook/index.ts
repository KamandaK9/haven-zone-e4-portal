import type { HandbookContent } from "@/lib/handbook/types";
import { roles } from "./roles";
import { rules } from "./rules";
import { structurePage, meetingsPage } from "./structure";
import { proceduresPage, membershipPage } from "./procedures";
import { financePage, categoriesPage } from "./finance";

// The Haven Standard Operating Procedure (SOP), amended 2015, transcribed.
// Rules, responsibilities and lists keep the source wording — people are
// held to them, so paraphrasing would change them. Procedures are split into
// steps and the intro is lightly trimmed, without changing any requirement;
// headings and step titles are ours. Not transcribed: the document control
// sheet, and the appendices (logo meaning, anthems, sample forms), which
// aren't in the source file.
export const handbook: HandbookContent = {
  title: "Handbook",
  source: "The Haven Standard Operating Procedure (SOP), amended 2015",
  sourceShort: "SOP",
  intro: {
    about: [
      "The Haven Nation is an evangelistic organization, created and driven with the mandate to facilitate the evangelization of the world according to the unique gospel of our Man of God, Rev Chris Oyakhilome, PhD with uncommon financial ability. It is a ministry arm of Believers LoveWorld Nation, a.k.a Christ Embassy, concerned with the recruitment, development and deployment of kingdom financiers of the gospel.",
      "The name, The Haven, is aptly evocative of a rest for the Prophet and Apostle of the BLW vision, that he may give himself continually to prayers and the ministry of the word. The Haven was not set up to sponsor the ministry, but is a platform to provide the opportunity for members to express their God given ability of being involved in God’s No 1 business of soul winning around the world.",
      "The Haven began in 1992 as a pastoral care fellowship (PCF) for professionals and businessmen in Christ Embassy. As the ministry grew and spread across the world, so The Haven grew and evolved, with more chapters springing up in Christ Embassy churches.",
    ],
    vision: "To take the divine presence of God to the nations and peoples of the earth and to demonstrate the character of the Spirit.",
    mission: [
      "To create the solid platform for mobilizing and raising Kingdom Finance Ministers whose sole purpose is to ensure by strong continuous and consistent financial participation that the vision of our beloved BLW Ministry and the mandate given to our Man of God, Rev Chris Oyakhilome PhD is accomplished to the glory of God’s name.",
      "This we do through an uncommon demonstration of our faith, and financial commitment to global ministry projects, programmes and activities in BLW Nation.",
    ],
    objectives: [
      "We give globally for ministry objectives",
      "We are not a group to support the ministry",
      "We are about driving, growing, and changing lives",
      "We push the ministry forward as the ministry takes the nations changing lives",
      "We are created for major things and big things",
    ],
  },
  roles,
  pages: [structurePage, categoriesPage, meetingsPage, proceduresPage, membershipPage, financePage],
  rules,
};
