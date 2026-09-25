import { ListChecks, IdCard } from "lucide-react";
import type { HandbookPage } from "@/lib/handbook/types";

export const proceduresPage: HandbookPage = {
  slug: "procedures",
  title: "Procedures",
  summary: "Step by step: starting or splitting a chapter, and appointing or removing Governors and Directors.",
  icon: ListChecks,
  sections: [
    {
      id: "inaugurate-chapter",
      title: "How to inaugurate a Haven chapter",
      sourcePages: "19–20",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Inaugurate the chapter",
              detail: "The Pastor of a CE Church shall inaugurate a new Haven chapter in the church in conjunction with the Zonal Director.",
              actor: "CE Church Pastor + Zonal Director",
            },
            {
              title: "Start as a Haven cell, led by a Coordinator",
              detail:
                "The new Haven group in the church shall be known as a Haven cell, headed by a Coordinator, and follows the standard cell structure of Christ Embassy. A cell is made up of a minimum of fifteen (15) registered members; a minimum of 15 registered members shall form a Haven chapter.",
              actor: "Coordinator",
            },
            {
              title: "Notify the International Secretariat",
              detail: "The newly inaugurated Haven chapter, leadership and details of membership must be communicated to the International Secretariat of The Haven.",
              actor: "Zonal Director",
              deadline: "Within 2 weeks",
            },
          ],
        },
      ],
    },
    {
      id: "split-chapter",
      title: "How to split an existing chapter",
      sourcePages: "20",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Qualify",
              detail:
                "The existing Haven Chapter must have a provable record of giving in the previous years (minimum of two years) in global ministry targets, and a minimum of four Senior Cells.",
            },
            {
              title: "Get the Zonal Director’s concurrence",
              detail: "The proposed split shall have the concurrence of the Zonal Director to become effective.",
              actor: "Zonal Director",
            },
            {
              title: "Notify the International Secretariat",
              detail:
                "Details of the split, including the names of members and leadership of the newly constituted chapters, shall be communicated to The Haven International Secretariat.",
              deadline: "Within 2 weeks",
            },
          ],
        },
      ],
    },
    {
      id: "appoint-governor",
      title: "How to appoint a Chapter Governor",
      sourcePages: "21",
      blocks: [
        {
          type: "paragraph",
          text: "The nominee shall have prior leadership experience of three to five (3–5) years at senior cell or cell leadership level, and a proven record of consistent financial commitment to The Haven (or the ministry if not an existing member of The Haven).",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Nomination",
              detail: "A Haven Chapter Governor shall be nominated by the Pastor of a CE Church with the concurrence of the Haven Zonal Director (or by voting).",
              actor: "CE Church Pastor + Zonal Director",
            },
            {
              title: "Known as Coordinator",
              detail: "After nomination the nominee is referred to as Coordinator. Their details are communicated to The Haven International Secretariat.",
              deadline: "Within 2 weeks of nomination",
            },
            {
              title: "Forwarded to the CEC for approval",
              detail: "Details of the newly nominated Coordinator shall be forwarded to the CEC BLW by the IEC for approval.",
              actor: "IEC",
              deadline: "Within 1 month of nomination",
            },
            {
              title: "Acting Haven Governor",
              detail:
                "Upon CEC approval, the Coordinator is referred to as Acting Haven Governor and proceeds for a compulsory Haven Leadership Training Programme, scheduled by The Haven International Secretariat.",
              actor: "CEC BLW",
            },
            {
              title: "Commissioned as Haven Governor",
              detail:
                "The Ag Haven Governor is commissioned/ordained by the CEC BLW at the annual International Haven Convention, and becomes a full fledged Haven Governor if they meet the Governor’s financial criterion. Otherwise they lead under another chapter-leadership title (see Categories).",
              actor: "CEC BLW",
            },
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Re-election",
          text: "Upon completion of tenure a Governor may be returned via voting, based on performance, at the last GEA meeting of the chapter before IPPC, under the supervision of the Zonal Director. The CE church Pastor should be aware of this meeting and the candidates. A Governor has a maximum of two terms of one year in office and may contest again after the fourth year.",
        },
      ],
    },
    {
      id: "remove-governor",
      title: "How to remove or change a Chapter Governor",
      sourcePages: "21",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Pastor raises the request",
              detail: "The request for removal/change must be communicated by the CE church Pastor to the Zonal Director.",
              actor: "CE Church Pastor",
            },
            {
              title: "Zonal Director confers with the IEC",
              detail: "The Zonal Director confers with the IEC for a recommendation to the CEC BLW.",
              actor: "Zonal Director + IEC",
            },
            {
              title: "CEC reviews and ratifies",
              detail: "The request is sent to the CEC for review and approval; the CEC shall ratify the removal/change before it can become effective.",
              actor: "CEC BLW",
            },
          ],
        },
        { type: "callout", tone: "warning", text: "The Church Pastor cannot remove a Chapter Governor." },
      ],
    },
    {
      id: "appoint-zonal-director",
      title: "Zonal Director appointment",
      sourcePages: "22",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Election or appointment",
              detail:
                "By voting at the National Executive Assembly (NEA) of The Haven, or by appointment by the Regional Pastor. Must have been a Haven Governor with a track record of chapter performance and financial commitment through The Haven.",
              actor: "NEA or Regional Pastor",
            },
            {
              title: "Submitted for approval",
              detail: "Submitted to the President, BLW Nation for approval by The Haven International President.",
              actor: "International President",
            },
            { title: "Ag Zonal Director", detail: "Referred to as Ag Zonal Director after approval by the Man of God." },
            {
              title: "Commissioned",
              detail: "Becomes a full fledged Zonal Director after being commissioned/ordained by the CEC at the International Haven Convention, IPPC or any meeting held by the President of the ministry.",
              actor: "CEC",
            },
          ],
        },
      ],
    },
    {
      id: "appoint-international-director",
      title: "International Director appointment",
      sourcePages: "22",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Appointment",
              detail:
                "Appointed by the President, BLW Nation. Must have a proven record of Zonal Directorship for a minimum of three to five (3–5) years, and proofs of sustained financial commitment to The Haven.",
              actor: "President, BLW Nation",
            },
            { title: "Ag International Director", detail: "Referred to as Ag International Director after approval by the President, BLW Nation." },
            {
              title: "Commissioned",
              detail: "Becomes a full fledged International Director after being commissioned/ordained at the International Haven Convention, IPPC or any meeting held by the President of the ministry.",
            },
          ],
        },
      ],
    },
    {
      id: "affiliation",
      title: "Conditions for chapter affiliation",
      sourcePages: "20–21",
      blocks: [
        {
          type: "list",
          items: [
            "Haven members are members of their local assembly and as such give their tithe to the local church; they help, give and minister in their local church",
            "Therefore, all Haven members are expected to participate in whatever local projects and partnership their local churches undertake as individual members of their local assembly",
            "Haven members pay dues to their Haven chapters and these dues belong to The Haven primarily, The Haven International",
            "They give globally for ministry objectives; members and chapters contribute to The Haven International accounts",
            "No Chapter of the Haven is autonomous. All Haven Chapters are responsible to the International body, The Haven International",
            "All Haven chapters must give through the financial structure approved by the President, BLW Nation, and must directly participate in the global ministry projects as approved by the President, BLW Nation",
            "Funds given centrally to The Haven International from all Chapters of The Haven worldwide are deployed by the Ministry as approved by The President, BLW Inc",
            "Haven funds at the chapter level are not under the jurisdiction of the Haven Governor or the local Church Pastor therefore shall not be administered, controlled or used by the local Church Pastor",
            "The Haven Chapter accounts shall be administered by the Governor, the Haven Zonal Director and Regional/Zonal Pastor. A Haven Chapter shall operate two accounts, one for local projects and the other for global ministry projects",
            "A Haven chapter which does not operate based on approved guidelines by the IEC shall not be regarded or accepted as a Haven Chapter",
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Local partnership seeds",
          text: "As members of their local assembly, Haven members give toward local partnership as individual members of the church. The chapter helps coordinate and collate these seeds into a designated account operated in agreement with the local church Pastor, and transfers the total at the Pastor’s instance. These are purely local church funds — not Haven funds.",
        },
        {
          type: "paragraph",
          text: "As registered bona fide members, members give dues for global ministry projects in two groups: (1) The Haven International projects; and (2) global ministry projects as defined by the Regional/Zonal Pastors — such as ROR Missions (Taking the Nations), Reach Out, Healing School Autumn and Summer Sessions, Regional Conferences, Programmes hosted for or by the President, BLW Nation, and Bible for the Nations. Funds for the second group are raised through The Haven Global Account but repatriated to the churches for final deployment to the relevant Ministry Arms; the churches recognise the Haven chapter for giving towards those projects.",
        },
      ],
    },
  ],
};

export const membershipPage: HandbookPage = {
  slug: "membership",
  title: "Membership",
  summary: "How to become a member, what it takes to keep membership, and how the colour-coded membership card is earned.",
  icon: IdCard,
  sections: [
    {
      id: "about-membership",
      title: "Being a member",
      sourcePages: "22",
      blocks: [
        {
          type: "paragraph",
          text: "The membership of the Haven is defined; one is required to register to become a member, which involves paying a stipulated registration fee. Members of the Haven are members of their local assembly; as such they give their tithes, offerings and special seeds in their local church. They help, they give and they minister in their local church. As members of the Haven, they are required to pay dues to their Haven Chapter.",
        },
        { type: "live", widget: "myTier" },
      ],
    },
    {
      id: "become-a-member",
      title: "How to become a Haven member",
      sourcePages: "23",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "Introduction", detail: "Introduced by an old member of The Haven or through referral from the CE Church office." },
            {
              title: "Attend four cell meetings",
              detail: "Attend a minimum of four (4) Haven cell meetings, during which the vision of The Haven is explicitly communicated by the cell leader.",
              actor: "Cell Leader",
            },
            { title: "Apply", detail: "During that period, formally apply by obtaining The Haven membership registration form." },
            {
              title: "Submit the form",
              detail: "The filled form is submitted through the Cell Leader to the Deputy Governor, Administration for review.",
              actor: "Cell Leader → Deputy Governor, Administration",
            },
            {
              title: "Interview",
              detail: "The Chapter Haven Governor personally interviews the intending member to determine their suitability.",
              actor: "Chapter Governor",
            },
            {
              title: "Pay the registration fee",
              detail:
                "Upon approval by The Haven Governor, the intending member pays the statutory registration fee and their details are forwarded to the International Secretariat for documentation in the central database.",
            },
            {
              title: "Full member",
              detail: "A member only becomes a full fledged member after all formal registration processes have been completed and the registration fully paid.",
            },
          ],
        },
        {
          type: "callout",
          tone: "info",
          text: "If an application is rejected, the applicant shall be referred to PFCC for reassignment to another PCF.",
        },
      ],
    },
    {
      id: "retain-membership",
      title: "How to retain membership",
      sourcePages: "23",
      blocks: [
        {
          type: "list",
          items: [
            "A Haven member shall demonstrate consistent and sustained financial commitment to The Haven",
            "A minimum membership financial commitment of $4,000 shall be made annually to qualify to become a full member. However, this amount is subject to upward review from period to period by the leadership of The Haven. Trainee level membership enables new members to grow their faith financially",
            "Each Haven member shall be required to comply with the stipulated minimum membership financial commitment for each period",
            "A member shall forfeit his/her membership of The Haven when he/she fails to comply with the stipulated minimum financial commitment for each period/year",
          ],
        },
      ],
    },
    {
      id: "termination",
      title: "Termination of membership",
      sourcePages: "23–24",
      blocks: [
        { type: "paragraph", text: "A member of The Haven shall have his or her membership terminated if any of the following circumstances occur:" },
        {
          type: "list",
          items: [
            "If a member consistently defaults from financial participation through The Haven for one full ministry year",
            "If a member is found of financial misconduct which may include inappropriate handling of Haven finances, theft, abuse of trust, etc",
            "If a member ceases to be a member of BLW",
            "If a member chooses to leave The Haven out of personal decision due to marriage, etc",
          ],
        },
      ],
    },
    {
      id: "membership-card",
      title: "Membership card colours",
      sourcePages: "24",
      blocks: [
        {
          type: "paragraph",
          text: "Each member of The Haven will be a card carrying member. The card is colour coded, and its colour is determined by the member’s financial participation in The Haven within stipulated periods.",
        },
        { type: "ladder", ladder: "member" },
      ],
    },
  ],
};
