import { Network, CalendarClock } from "lucide-react";
import type { HandbookPage } from "@/lib/handbook/types";

export const structurePage: HandbookPage = {
  slug: "structure",
  title: "Structure & offices",
  summary: "Who leads what — from the Central Executive Council down to the chapter secretaries, and what each office is responsible for.",
  icon: Network,
  sections: [
    {
      id: "org-chart",
      title: "Organisation chart",
      sourcePages: "6–16",
      blocks: [
        {
          type: "paragraph",
          text: "Globally coordinated but zonally and locally deployed for operational effectiveness, The Haven functions by operational guidelines established by the Central Executive Council of the Ministry. Select an office to see its responsibilities, who it reports to and how it is appointed.",
        },
        { type: "orgChart" },
      ],
    },
    {
      id: "zones",
      title: "Zones",
      sourcePages: "9–10",
      blocks: [
        {
          type: "list",
          items: [
            "The Haven shall be delineated into zones for effective supervision, coordination and control",
            "Delineation of zones shall be recommended by the IEC and approved by the President, BLW Nation",
            "A Zone can be intra country or cross borders (multiple countries)",
            "A zone shall be determined by the number of The Haven chapters existing in an area(s) – made up of a minimum of 10 Category E chapters consisting of a minimum of 150 bona fide registered Haven members",
            "Each Zone shall be headed by a Zonal Director",
          ],
        },
        { type: "paragraph", text: "However, a Zone does not qualify for a Zonal Director unless the zone meets the following criteria:" },
        {
          type: "list",
          items: [
            "The number of The Haven chapters existing in an area(s)",
            "The membership strength of the existing chapters – membership based on bona fide Haven membership which is determined by their financial contribution",
            "Sustained financial contribution of the chapters to Global Ministry Projects for at least two consecutive financial years",
            "A minimum financial contribution of at least $1 million annually (to Global ministry projects) for at least two consecutive years",
          ],
        },
        {
          type: "callout",
          tone: "info",
          text: "Where the zone does not meet these criteria, it will be part of another zone and be overseen by the Zonal Director of the zone it has been joined to. Zones are categorised every year — see Categories.",
        },
      ],
    },
    {
      id: "zonal-director-criteria",
      title: "Criteria for a Zonal Director",
      sourcePages: "10–11",
      blocks: [
        {
          type: "list",
          items: [
            "Should be a Governor/ former Governor based on the new criteria for Governorship",
            {
              text: "Should have displayed exceptional leadership abilities in positioning his/her chapter for superior performance which will be measured by:",
              items: [
                "Consistent, appreciable Financial Contribution to Global Projects",
                "Mobilization of leaders to the Strategic leadership conferences of the Haven",
                "Growth of the Chapter with bona fide members of The Haven",
              ],
            },
            "The appointment of a Zonal Director shall be made by the Regional Pastor but must be ratified by the President, BLW Nation for the appointment to come into effect",
            "Shall become a full fledged Zonal Director after being commissioned/ordained by the CEC at the annual International Haven Convention or the IPPC or at any International meeting convened by the President, BLW Incorporated",
            "The discipline of the Zonal Director shall be determined by the IEC of The Haven",
          ],
        },
        {
          type: "paragraph",
          text: "The tenure of the Zonal Director shall be two years. Upon completion of his/her tenure may be returned for another two years via voting, based on performance, at the National Executive Assembly (NEA) meeting of The Haven under the supervision of the IEC.",
        },
      ],
    },
    {
      id: "secretariat",
      title: "The Haven International Secretariat",
      sourcePages: "18",
      blocks: [
        {
          type: "list",
          items: [
            "The Haven International Secretariat shall be the seat of global leadership (government) of The Haven",
            "The Secretariat shall be located at the HQ or city of location of HQ of BLW",
            "The Secretariat shall be the hub of all Haven activities where the activities and affairs of The Haven shall be centrally coordinated",
            "The Secretariat shall be professionally organized into functional departments and coordinated by full time professionals employed for that purpose by The Haven",
            "The Secretariat shall be run as a world class suite of offices based on world class systems, processes, policies and driven by world class technology",
            "Only individuals with the best quality/competencies shall be recruited to the Secretariat",
          ],
        },
      ],
    },
    {
      id: "foundation",
      title: "The Haven Foundation",
      sourcePages: "18",
      blocks: [
        {
          type: "callout",
          tone: "warning",
          title: "Not yet defined in the SOP",
          text: "The 2015 SOP lists The Haven Foundation as an organ, but its description is unfinished (“The Haven Foundation is the organ ….”).",
        },
      ],
    },
  ],
};

export const meetingsPage: HandbookPage = {
  slug: "meetings",
  title: "Organs & meetings",
  summary: "The assemblies that govern The Haven, the meetings every member attends, and the units a chapter runs.",
  icon: CalendarClock,
  sections: [
    {
      id: "governing-organs",
      title: "Governing organs",
      sourcePages: "16–17",
      blocks: [
        {
          type: "meetings",
          meetings: [
            {
              name: "National Executive Assembly (NEA)",
              cadence: "At least once a year",
              attendance:
                "All Haven Chapter Governors, Zonal Directors, International Directors and The Haven International President. Mandatory training for all Deputy Governors, Governors, Zonal Secretaries, Zonal Directors and International Directors.",
              seriesSlug: "national-executive-assembly",
              points: [
                "The NEA is the ministry leadership council of the Haven",
                "Meets to determine goals/targets for The Haven and evaluate previous period performances",
                "The NEA shall hold in all the zones of The Haven",
                "The NEA is the highest leadership training programme in The Haven Nation",
                "The programme shall be planned and executed based on the goals, objectives, targets and the developmental requirements of The Haven Nation from period to period",
                "A detailed report of the programme shall be submitted to the President, BLW Nation by the International President of The Haven immediately after each NEA",
              ],
            },
            {
              name: "General Executive Assembly (GEA)",
              cadence: "Once a month",
              attendance:
                "The Governor, Assistant Governors Admin and Finance, General Secretary, Financial Secretary, Special Duties Secretary, Senior Cell Leaders and Cell Leaders",
              points: [
                "The GEA shall be the highest decision making body in The Haven Chapter",
                "Meets to review the activities and performances of the chapter, develop new strategies for better and future growth",
              ],
            },
            {
              name: "Monthly General Meeting",
              cadence: "Once a month, per chapter",
              attendance: "Compulsory for all members of The Haven in the chapter",
              points: [
                "Could be held during the day or as an all night programme",
                "Communication of the performance of the chapter in the concluding month",
                "Sharing of strategies on targets, goals and programmes to be achieved in the new month",
                "Celebration of Senior Cells, Cells, and individuals with remarkable performances in the concluding month",
                "Cascading of initiatives, projects, and programmes announced by the Ministry, the local church or the International Secretariat of The Haven",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "conventions",
      title: "Conventions",
      sourcePages: "18–19",
      blocks: [
        {
          type: "paragraph",
          text: "There are several and different kinds of meetings held in The Haven designed to develop, equip, nurture and sharpen members of The Haven in achieving God’s purpose and call upon our lives. All meetings of The Haven are important and compulsory.",
        },
        {
          type: "meetings",
          meetings: [
            {
              name: "The Haven International Convention",
              cadence: "Yearly, dates proposed by the IEC and approved by the President, BLW Inc",
              attendance: "Compulsory for all Haven members world wide",
              seriesSlug: "international-convention",
              points: [
                "The highest level of meetings in The Haven Ministry",
                "Holds at the HQ of BLW (usually Lagos) and/or in other Haven Zones as approved by the President, BLW Inc",
                "Members receive fresh word and direction from God through CEC members and the President, BLW Inc on the Haven vision, mission and modus operandi",
                "New Haven Governors and Directors shall be ordained at this Convention",
              ],
            },
            {
              name: "Zonal Convention",
              cadence: "One a year, per zone",
              deadline: "By end of June",
              attendance:
                "Compulsory for Haven members in the chapters under the zone, all Zonal Directors, International Directors and The Haven President",
              seriesSlug: "zonal-convention",
              points: [
                "Holds provided that the zone delivered on given financial goals/targets as set by the IEC for the period — a celebration of performance rather than an annual ritual",
                "Shall hold latest by the end of the month of June in each calendar year",
                "Dates are subject to approval by the Regional Pastor and the President, BLW Inc",
              ],
            },
            {
              name: "Chapter Convention",
              cadence: "At least one a year, per chapter",
              attendance: "Compulsory for all members in the Chapter and the Zonal Director of the Chapter’s Zone",
              points: ["The date shall be approved by the CE Church Pastor with concurrence of the Zonal Director"],
            },
          ],
        },
      ],
    },
    {
      id: "activity-units",
      title: "Strategic Activity Units (SAUs)",
      sourcePages: "17–18",
      blocks: [
        { type: "paragraph", text: "The following Activity Units shall be operated in the chapter of The Haven:" },
        {
          type: "list",
          items: [
            "The Haven Choir",
            "The Haven Drama Unit",
            "The Programs Unit",
            "The Haven Welfare Unit",
            "The Haven Research and Intelligence Unit",
          ],
        },
        {
          type: "paragraph",
          text: "These SAUs shall be veritable platforms for the spiritual, mental/attitude and physical growth opportunities for Haven members for the expression of their God given talent for the purpose of kingdom development and service to humanity.",
        },
      ],
    },
  ],
};
