# Operator register — The Haven Zone E4

> Draft. POPIA calls service providers who process personal information on our
> behalf **operators** (s20–21): they may process it only with our knowledge
> and authorisation, must keep it confidential, and must have security
> measures under a written contract. Keep this register current and match it
> to `tenant.legal.operators` (which feeds the privacy notice).

| Operator | What they do for us | Data involved | Where processed | Agreement in place? | Reviewed |
|---|---|---|---|---|---|
| Supabase | Database, sign-in, file storage | All portal data | [Project region] | [DPA accepted on … / link] | [date] |
| Vercel | Hosting the portal | Data passing through requests; logs | [Region] | [DPA accepted on …] | [date] |
| Mux | Lesson videos, livestreams | Video, viewer analytics | United States | [DPA accepted on …] | [date] |
| Resend | Email delivery | Names, email addresses, message content | United States | [DPA accepted on …] | [date] |
| [Other] | | | | | |

**Transborder transfers (s72):** for each operator outside South Africa,
record why the transfer is allowed — e.g. the operator's agreement binds it to
protection substantially similar to POPIA, or the data subject consented.

**Adding an operator:** before a new provider receives personal information,
add it here, put an agreement in place, add it to `tenant.legal.operators`,
and bump `privacyNoticeVersion` so everyone is shown the updated notice.
