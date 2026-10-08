# Messaging setup

Messaging (Settings → Features → Messaging) sends texts and email, with a
pastor's approval, a monthly text cap and a usage meter.

## Keys

Set these in the deployment's environment (see `.env.example`):

| For | Variables |
|---|---|
| Texts (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and a sender: `TWILIO_FROM` (a number the organisation owns, so people can reply STOP) or `TWILIO_MESSAGING_SERVICE_SID` |
| Email | `SENDGRID_API_KEY` + `EMAIL_FROM` (`Church Name <hello@example.org>`, a verified sender) — or `RESEND_API_KEY` + `RESEND_FROM_EMAIL` |
| Automatic messages | `CRON_SECRET` — any long random string |

Until the keys are added, messages can still be written and approved; they
wait and send once the keys are there.

## STOP replies

In Twilio, set the number's **"A message comes in"** webhook to
`https://<your site>/api/messaging/twilio-inbound` (HTTP POST). A reply of
STOP then opts that number out of every message; START opts it back in.

## The daily schedule

Birthdays, first-timer welcomes, "we missed you" notes, the Monday pastor
summary, and retrying held messages run from `GET /api/cron/daily`, which
only accepts `Authorization: Bearer <CRON_SECRET>`. On Vercel, add to
`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }] }
```

(05:00 UTC is 07:00 in South Africa.) Vercel sends the `CRON_SECRET`
variable as the bearer token by itself. Elsewhere, call the route once a day
with that header. Each automatic message is off until it's switched on in
Settings → Messaging.

## Under-18s and opt-outs

Anyone in `tenant.messaging.minorAgeGroups` is only ever reached through a
guardian (their guardian's number, set on their record or imported from
"Guardian name" / "Guardian phone" columns); with no guardian number they
are skipped. Anyone marked opted-out receives nothing.
