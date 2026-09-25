import { Landmark, Trophy } from "lucide-react";
import type { HandbookPage } from "@/lib/handbook/types";

export const financePage: HandbookPage = {
  slug: "finance",
  title: "Finance & records",
  summary: "Fees, dues and project seeds, where the money goes, who signs, what records a chapter keeps and how reports flow upward.",
  icon: Landmark,
  sections: [
    {
      id: "fees-and-dues",
      title: "Fees, dues and levies",
      sourcePages: "24–25",
      blocks: [
        {
          type: "paragraph",
          text: "Registration forms are purchased for a fee set from time to time by the IEC, and submitted with a membership registration fee fixed by the IEC. Every member pays dues monthly toward the funding of the activities, programs and projects of The Haven, through the chapter.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Dues belong to The Haven International",
          text: "No Chapter of the Haven is autonomous. All dues belong to The Haven — primarily to the International Body Account — and are not under the jurisdiction of the local Church Pastors or of The Haven Chapter Governors. They are not to be used by the local church for local projects.",
        },
        {
          type: "list",
          items: [
            {
              text: "Membership dues",
              items: [
                "Paid by every member annually through their local chapter; the amount is fixed from time to time by the IEC subject to approval by the President of BLW",
                "Applied towards administration overheads of The Haven offices, and represents each member’s continued identification with the vision and ministry of The Haven",
                "Prolonged default in payment will lead to membership being terminated",
              ],
            },
            {
              text: "Project seeds",
              items: [
                "The chapter participates in global ministry projects through annual Project Dues, at a minimum threshold defined from time to time by the IEC subject to approval by the President of BLW",
                "In practice a minimum level of giving per month — the size of projects usually requires that the saints give by the Spirit and by faith far beyond the project dues",
                "Dues are a veritable means of training members in the discipline of consistent, scheduled giving",
              ],
            },
            {
              text: "Chapter annual registration",
              items: [
                "Every chapter pays an annual registration fee at the beginning of the Ministry year, depending on its classification, into the designated Haven International account",
                "Failure to pay in any year leads to the “Chapter” status of the affected chapter being withdrawn",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "money-flow",
      title: "Where the money goes",
      sourcePages: "20–21, 27–28",
      blocks: [
        {
          type: "flow",
          title: "Collection and banking",
          stages: [
            { nodes: [{ label: "Member", detail: "Dues, fees, levies, seeds" }] },
            { via: "receipted", nodes: [{ label: "Financial Secretary", detail: "Issues receipts; banks promptly" }] },
            {
              via: "banked",
              nodes: [
                { label: "Local Project Account", detail: "Signatories: Chapter Governor, Zonal Director, Regional Pastor" },
                { label: "Global Ministry Account", detail: "Signatories: Zonal Director, Regional Pastor" },
              ],
            },
            { via: "global giving", nodes: [{ label: "The Haven International", detail: "Deployed by the Ministry as approved by the President, BLW Inc" }] },
          ],
        },
        {
          type: "list",
          items: [
            "Due diligence shall be exercised in appointing Financial Secretaries at all levels",
            "Every chapter of The Haven shall maintain two current accounts in a reputable bank approved by CEC or CE Pastor at the chapter level",
            "All monies collected from members shall be promptly paid into The Haven accounts so designated",
            "All monies received from members for different purposes – dues, fees, levies or seeds shall be duly receipted by the Financial Secretaries",
            "The Assistant Governor, Finance shall be custodian of all printed receipts and shall disburse same to the Financial Secretaries at the chapter level",
            "On no account shall monies collected by the chapter or any organ/sub unit thereof be converted, or diverted to any personal or other unauthorized use",
            "Both accounts operated by the chapter shall be proved monthly and proofs sent to the International Director, Finance through the Zonal Director",
          ],
        },
      ],
    },
    {
      id: "reporting",
      title: "Reports and reporting",
      sourcePages: "29",
      blocks: [
        {
          type: "flow",
          title: "Monthly financial report",
          stages: [
            { nodes: [{ label: "Chapter", detail: "Monthly Financial Report (FR), on the Secretariat's template" }] },
            { via: "monthly", nodes: [{ label: "Zonal Director", detail: "Compiles the monthly Zonal Financial Report" }] },
            { via: "monthly", nodes: [{ label: "International Director, Finance", detail: "Compiles the global Financial Report" }] },
            { via: "monthly", nodes: [{ label: "International President" }] },
            { via: "quarterly", nodes: [{ label: "CEC", detail: "The Haven Ministry Financial Report" }] },
          ],
        },
        {
          type: "list",
          items: [
            "Each Governor/Zonal Director of The Haven has the overall responsibility for rendering financial reports as at when due",
            "All Haven Chapters shall continually, regularly prepare and remit various operational and financial reports as stipulated by the IEC",
          ],
        },
      ],
    },
    {
      id: "records",
      title: "Records a chapter keeps",
      sourcePages: "28",
      blocks: [
        {
          type: "paragraph",
          text: "The peculiar nature of The Haven operations makes it mandatory that accurate records are kept and timely reports rendered always. The Financial Secretaries produce a monthly statement of account for every financially committed member as acknowledgement of their commitment.",
        },
        {
          type: "checklist",
          items: [
            { text: "Up-to-date roll and directory of duly registered members", portal: "members" },
            { text: "Up-to-date directory of all cells and PCUs thereof", portal: "cells" },
            { text: "Ledger for all offerings at Cell, PCU, and Chapter levels", portal: "ledger" },
            { text: "Ledger for all monthly membership dues collected and collectable", portal: "ledger" },
            { text: "Ledger for all monthly project dues and seeds collected and collectable", portal: "ledger" },
            { text: "Ledger for all special levies and donations collected", portal: "ledger" },
            { text: "Ledger for all payments made for all causes", portal: "ledger" },
            { text: "Minutes of all Executive Meetings held", portal: "minutes" },
            { text: "File containing all bank allocation advices", portal: "bankAdvices" },
            { text: "Cheque book stubs", portal: "cheques" },
            { text: "File for correspondences", portal: "correspondence" },
            { text: "File for retained copies of reports", portal: "reports" },
          ],
        },
      ],
    },
  ],
};

export const categoriesPage: HandbookPage = {
  slug: "categories",
  title: "Categories",
  summary: "How zones, chapters, chapter leaders and members are ranked each year — and where yours stands today.",
  icon: Trophy,
  sections: [
    {
      id: "chapters",
      title: "Chapter categories",
      sourcePages: "21",
      blocks: [
        {
          type: "paragraph",
          text: "Haven chapters shall be categorized annually based on a combination of chapter financial participation and membership strength in each financial year. A chapter can be ranked either upward or downward at the beginning of a new financial year based on its performance in the concluding year.",
        },
        { type: "ladder", ladder: "chapter" },
        { type: "live", widget: "chapterStandings" },
      ],
    },
    {
      id: "zones",
      title: "Zone categories",
      sourcePages: "10",
      blocks: [
        {
          type: "paragraph",
          text: "Haven Zones shall be categorized annually based on a combination of financial performance and membership strength. A Zone can be categorized upward or downward at the beginning of a new ministry/financial year based on financial performance and numerical growth in the concluding year.",
        },
        { type: "ladder", ladder: "zone" },
        { type: "live", widget: "zoneStanding" },
      ],
    },
    {
      id: "chapter-leadership",
      title: "Categories of chapter leadership",
      sourcePages: "12–14",
      blocks: [
        {
          type: "paragraph",
          text: "The one appointed to lead a chapter must have a proven record of incremental financial commitment to The Haven vision and a clear demonstration of faith and loyalty to the vision of BLW Inc. The title they hold depends on their own annual giving:",
        },
        { type: "ladder", ladder: "governorship" },
        {
          type: "callout",
          tone: "info",
          text: "The term Governor is no longer used for the leader of a chapter if the criteria for that office are not met. A chapter may have an Assistant Governor, Deputy Governor or even a Coordinator as its head.",
        },
      ],
    },
    {
      id: "members",
      title: "Membership categories",
      sourcePages: "24",
      blocks: [
        {
          type: "list",
          items: [
            "Members are categorized based on their financial participation for each financial/ministry year",
            "Every member with incremental and higher financial participation in the current year than the previous year shall have his or her membership categorization ranked upward",
            "A member whose financial participation in the current year is equal to or less than the previous year’s participation shall keep his or her current membership categorization",
            "If a member’s financial participation in the third (3rd) year is lower than the previous two years, then the member’s categorization will be ranked downward",
          ],
        },
        { type: "ladder", ladder: "member" },
        { type: "live", widget: "myTier" },
        { type: "live", widget: "tierDistribution" },
      ],
    },
  ],
};
