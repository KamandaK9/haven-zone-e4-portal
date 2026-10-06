# Privacy & legal pack (POPIA / PAIA, South Africa)

> **Drafts, not legal advice.** These templates are a starting point written
> for a membership organisation running a Stratum portal. Have them reviewed by
> someone qualified for your organisation before relying on them.

Filled in for The Haven Zone E4 from Stratum's templates (docs/legal-templates).

## What the portal already does

| Requirement | Where |
|---|---|
| Privacy notice with everything POPIA s18 requires | `/privacy`, built from `tenant.legal` |
| Terms of use, incl. leader confidentiality | `/terms` |
| Consent recorded per person and per notice version; re-asked when the notice changes | `/privacy/accept`, `profiles.privacy_accepted_*` |
| Right of access — self-service download | `/my-data` → Download my data |
| Requests for access, correction, deletion, objection, with the 30-day clock | `/my-data` → request; `/settings/privacy` for the Information Officer |
| Security safeguards (s19) | Database-enforced access by role, private documents, encryption, MFA, idle sign-out, audit log — see the main README's Security section |
| Placeholders flagged before launch | Settings → Privacy & legal |

## What the organisation must do

1. **Information Officer.** By law this is the head of the organisation unless
   duty is delegated in writing — use `information-officer-appointment.md`.
   **Register** the Information Officer (and any deputy) with the Information
   Regulator through its online portal.
2. **Fill in `tenant.legal`** in `src/tenant/index.ts` (name, address,
   Information Officer, operators and their locations, retention). When you
   change the notice in substance, bump `privacyNoticeVersion`.
3. **PAIA manual.** Complete `paia-manual.md`, have it signed, and make it
   available (on the website and at the office).
4. **Operators.** List every service provider in `operator-register.md` and
   make sure each has a written agreement covering confidentiality and
   security (most providers publish a Data Processing Agreement — accept it in
   their dashboard and keep a copy).
5. **Retention.** Agree `retention-schedule.md` and match `tenant.legal.retention`.
6. **Breaches.** Adopt `breach-response.md` and make sure leaders know whom to
   tell.
7. **Leaders.** Brief leaders on confidentiality — they accept the terms of
   use at first sign-in, but a short conversation matters more.
8. **Review yearly**, and whenever a new feature collects new kinds of
   information.
