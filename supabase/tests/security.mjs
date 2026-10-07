import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Applies every migration in supabase/migrations to an in-process Postgres
// (PGlite) with stand-ins for Supabase's auth/storage/realtime schemas, then
// checks the row-level security and guard triggers hold: each case below is
// something a signed-in browser could otherwise do with the public anon key.
// Run: npm run test:db
const MIG = process.argv[2] ?? fileURLToPath(new URL("../migrations", import.meta.url)); // decodes spaces in the path
const db = new PGlite({ extensions: { pgcrypto } });

// ── Supabase stand-ins ────────────────────────────────────────────────
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, realtime to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

// ── Migration versions must be unique ─────────────────────────────────
// Supabase records a migration by the number before the "_"; two files with
// the same number (easy when two branches add one the same day) means one is
// silently skipped on a real database.
{
  const versions = readdirSync(MIG).filter((f) => f.endsWith(".sql")).map((f) => f.split("_")[0]);
  const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
  if (dupes.length) {
    console.log("DUPLICATE MIGRATION VERSION", [...new Set(dupes)].join(", "), "— renumber one of them");
    process.exit(1);
  }
}

// ── Migrations, in order ──────────────────────────────────────────────
for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(`${MIG}/${f}`, "utf8"));
    console.log("migrated", f);
  } catch (e) {
    console.log("MIGRATION FAILED", f, e.message);
    process.exit(1);
  }
}
// A second run proves they're idempotent.
for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(`${MIG}/${f}`, "utf8"));
  } catch (e) {
    console.log("RE-RUN FAILED", f, e.message);
    process.exit(1);
  }
}
console.log("re-run ok");

// ── Fixture (as superuser) ────────────────────────────────────────────
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const Z = id(1), CO = id(2), C1 = id(3), C2 = id(4), SZ = id(5);
const D = id(10), G = id(11), M = id(12), M2 = id(13);
const MD = id(20), MG = id(21), MM = id(22), MM2 = id(23);
const P = id(30), L1 = id(31), LQ = id(32), T = id(33), REC = id(34), STREAM = id(35);
const ALL = "{view_members,view_contact_details,manage_members,view_giving_totals,view_giving_individual,import_giving,manage_ledger,manage_training,manage_calendar,send_newsletter,view_reports,manage_access,manage_events,manage_records,manage_livestreams}";
await db.exec(`
  insert into zones (id, name, setup_complete) values ('${Z}', 'Z', true);
  insert into countries (id, zone_id, name) values ('${CO}', '${Z}', 'X');
  insert into sub_zones (id, zone_id, name) values ('${SZ}', '${Z}', 'SZ1');
  insert into churches (id, zone_id, country_id, name, sub_zone_id) values ('${C1}', '${Z}', '${CO}', 'One', '${SZ}'), ('${C2}', '${Z}', '${CO}', 'Two', null);
  insert into auth.users (id) values ('${D}'), ('${G}'), ('${M}'), ('${M2}');
  insert into profiles (id, zone_id, role, full_name, email, position, scope, church_id, caps) values
    ('${D}', '${Z}', 'super_admin', 'Director', 'd@x', 'zonal_director', 'zone', null, '${ALL}'),
    ('${G}', '${Z}', 'admin', 'Governor', 'g@x', 'governor', 'chapter', '${C1}', '{view_members,view_contact_details,view_giving_totals,manage_records,manage_members}'),
    ('${M}', '${Z}', 'member', 'Real Member', 'm@x', 'member', 'self', null, '{}'),
    ('${M2}', '${Z}', 'member', 'Other Member', 'm2@x', 'member', 'self', null, '{}');
  insert into members (id, zone_id, church_id, country_id, first_name, last_name, email, position, profile_id) values
    ('${MD}', '${Z}', '${C1}', '${CO}', 'Dir', 'Ector', 'd@x', 'zonal_director', '${D}'),
    ('${MG}', '${Z}', '${C1}', '${CO}', 'Gov', 'Ernor', 'g@x', 'governor', '${G}'),
    ('${MM}', '${Z}', '${C1}', '${CO}', 'Mem', 'Ber', 'm@x', 'member', '${M}'),
    ('${MM2}', '${Z}', '${C2}', '${CO}', 'Oth', 'Er', 'm2@x', 'member', '${M2}');
  insert into training_programs (id, zone_id, name, icon, points) values ('${P}', '${Z}', 'Course', 'book', 10);
  insert into training_lessons (id, program_id, zone_id, kind, title, sort_order) values ('${L1}', '${P}', '${Z}', 'video', 'Watch', 0), ('${LQ}', '${P}', '${Z}', 'quiz', 'Quiz', 1);
  insert into trainings (id, member_id, zone_id, program_id, status) values ('${T}', '${MM}', '${Z}', '${P}', 'not_started');
  insert into chapter_records (id, zone_id, church_id, kind, title, record_date) values ('${REC}', '${Z}', '${C1}', 'minutes', 'Mins', '2026-01-01');
  insert into live_streams (id, zone_id, title, scheduled_at, status) values ('${STREAM}', '${Z}', 'Live', now(), 'live');
`);

// ── Helpers ───────────────────────────────────────────────────────────
let pass = 0, fail = 0;
async function as(user, role, sql) {
  const claims = user ? JSON.stringify({ role, sub: user }) : JSON.stringify({ role });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${role};`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, affected: r.affectedRows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec("reset role;");
  }
}
function expect(name, cond, detail) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  →  ${JSON.stringify(detail)}`}`);
}
const denied = (r) => !r.ok;
const changed = (r) => r.ok && r.affected === 1;

// ── Members ───────────────────────────────────────────────────────────
let r = await as(M, "authenticated", `update members set email = 'new@x', phone = '123' where id = '${MM}'`);
expect("member can change own email/phone", changed(r), r);
r = await as(M, "authenticated", `update members set position = 'zonal_director' where id = '${MM}'`);
expect("member can't change own position", denied(r), r);
r = await as(M, "authenticated", `update members set church_id = '${C2}' where id = '${MM}'`);
expect("member can't move themselves to another chapter", denied(r), r);
r = await as(M, "authenticated", `update members set photo_path = '${Z}/${MM2}/x.jpg', photo_url = 'x' where id = '${MM}'`);
expect("member can't set their own photo path directly", denied(r), r);
r = await as(M, "authenticated", `update members set first_name = 'Hacked' where id = '${MM2}'`);
expect("member can't edit someone else (RLS)", r.ok && r.affected === 0, r);
r = await as(G, "authenticated", `update members set first_name = 'Renamed', cell_id = null where id = '${MM}'`);
expect("governor can edit a member in their chapter", changed(r), r);
r = await as(G, "authenticated", `update members set position = 'zonal_director' where id = '${MG}'`);
expect("governor can't change their own position", denied(r), r);
r = await as(G, "authenticated", `update members set position = 'governor' where id = '${MM}'`);
expect("governor can't change a member's position directly", denied(r), r);
r = await as(null, "service_role", `update members set position = 'deputy_governor' where id = '${MM}'`);
expect("server (service role) can change positions", changed(r), r);
r = await as(null, "service_role", `update members set photo_path = '${Z}/${MM2}/x.jpg' where id = '${MM}'`);
expect("photo path must be in the member's own folder (even for the server)", denied(r), r);
r = await as(null, "service_role", `update members set photo_path = '${Z}/${MM}/ok.jpg' where id = '${MM}'`);
expect("photo path in own folder is accepted", changed(r), r);

// ── Training ──────────────────────────────────────────────────────────
r = await as(M, "authenticated", `update trainings set status = 'completed' where id = '${T}'`);
expect("member can't mark a course complete without its lessons", denied(r), r);
r = await as(M, "authenticated", `update trainings set program_id = program_id, member_id = '${MM2}' where id = '${T}'`);
expect("member can't move a training to someone else", denied(r), r);
r = await as(M, "authenticated", `insert into training_lesson_progress (member_id, lesson_id, zone_id, completed, quiz_score) values ('${MM}', '${LQ}', '${Z}', true, 99)`);
expect("member can't write their own quiz result", denied(r), r);
r = await as(M, "authenticated", `insert into training_lesson_progress (member_id, lesson_id, zone_id, completed) values ('${MM}', '${L1}', '${Z}', true)`);
expect("member can complete a (link) video lesson", r.ok, r);
r = await as(M, "authenticated", `update training_lesson_progress set lesson_id = '${LQ}' where member_id = '${MM}' and lesson_id = '${L1}'`);
expect("member can't move progress onto another lesson", denied(r), r);
r = await as(null, "service_role", `insert into training_lesson_progress (member_id, lesson_id, zone_id, completed, quiz_score) values ('${MM}', '${LQ}', '${Z}', true, 3)`);
expect("server can record a graded quiz", r.ok, r);
r = await as(M, "authenticated", `update trainings set status = 'completed', completed_at = now() where id = '${T}'`);
expect("member's course completes once every lesson is done", changed(r), r);

// ── Zone, chapters, profiles, audit ──────────────────────────────────
r = await as(D, "authenticated", `update zones set setup_complete = false where id = '${Z}'`);
expect("director can't flip setup_complete", denied(r), r);
r = await as(D, "authenticated", `update zones set display_currency = 'ZAR' where id = '${Z}'`);
expect("director can change display currency (zones_update policy)", changed(r), r);
r = await as(G, "authenticated", `update churches set sub_zone_id = null where id = '${C1}'`);
expect("governor can't move their chapter out of its sub-zone", denied(r), r);
r = await as(G, "authenticated", `update churches set name = 'One Renamed' where id = '${C1}'`);
expect("governor can rename their chapter", changed(r), r);
r = await as(M, "authenticated", `select id from profiles`);
expect("member sees only their own profile", r.ok && r.rows.length === 1 && r.rows[0].id === M, r);
r = await as(G, "authenticated", `select id from profiles`);
expect("leader sees the zone's profiles", r.ok && r.rows.length === 4, r);
r = await as(G, "authenticated", `insert into audit_log (zone_id, actor_id, actor_name, action, summary) values ('${Z}', '${D}', 'Director', 'x', 'forged')`);
expect("can't write audit entries as someone else", denied(r), r);
r = await as(G, "authenticated", `insert into audit_log (zone_id, actor_id, actor_name, action, summary) values ('${Z}', '${G}', 'Governor', 'x', 'real')`);
expect("can write audit entries as yourself", r.ok, r);

// ── Records, live chat, rate limit, anon ─────────────────────────────
r = await as(G, "authenticated", `insert into chapter_record_files (record_id, zone_id, storage_path, file_name, mime_type, size_bytes) values ('${REC}', '${Z}', '${Z}/${C2}/secret.pdf', 'x.pdf', 'application/pdf', 1)`);
expect("record file can't point into another chapter's folder", denied(r), r);
r = await as(G, "authenticated", `insert into chapter_record_files (record_id, zone_id, storage_path, file_name, mime_type, size_bytes) values ('${REC}', '${Z}', '${Z}/${C1}/mins.pdf', 'x.pdf', 'application/pdf', 1)`);
expect("record file in its own chapter folder is accepted", r.ok, r);
r = await as(M, "authenticated", `insert into live_stream_messages (stream_id, zone_id, profile_id, author_name, body) values ('${STREAM}', '${Z}', '${M}', 'The Director', 'hi') returning author_name`);
expect("chat name comes from the login, not the request", r.ok && r.rows[0]?.author_name === "Real Member", r);
r = await as(M, "authenticated", `select public.take_rate_limit('x', 1, 60)`);
expect("browsers can't call the rate limiter", denied(r), r);
r = await as(null, "service_role", `select public.take_rate_limit('k', 2, 60) a, public.take_rate_limit('k', 2, 60) b, public.take_rate_limit('k', 2, 60) c`);
expect("rate limiter allows 2 then refuses", r.ok && r.rows[0].a && r.rows[0].b && r.rows[0].c === false, r);
r = await as(null, "anon", `select public.current_user_can('manage_access')`);
expect("anonymous can't call helper functions", denied(r), r);
r = await as(null, "anon", `select count(*) from members`);
expect("anonymous sees no members", (r.ok && Number(r.rows[0].count) === 0) || denied(r), r);

// ── Privacy requests ─────────────────────────────────────────────────
r = await as(M, "authenticated", `insert into data_requests (zone_id, profile_id, requester_name, requester_email, kind, details) values ('${Z}', '${M}', 'Real Member', 'm@x', 'access', 'Please send my data') returning id, due_at > now() + interval '29 days' as due_ok`);
expect("member can make a privacy request with a 30-day deadline", r.ok && r.rows[0]?.due_ok === true, r);
const REQ = r.rows?.[0]?.id;
r = await as(M, "authenticated", `insert into data_requests (zone_id, profile_id, requester_name, requester_email, kind, details, status, response) values ('${Z}', '${M}', 'x', 'x', 'access', 'x', 'completed', 'done')`);
expect("member can't file a request already marked done", denied(r), r);
r = await as(M, "authenticated", `insert into data_requests (zone_id, profile_id, requester_name, requester_email, kind, details) values ('${Z}', '${M2}', 'x', 'x', 'deletion', 'as someone else')`);
expect("member can't file a request as someone else", denied(r), r);
r = await as(M2, "authenticated", `select id from data_requests`);
expect("members can't see each other's requests", r.ok && r.rows.length === 0, r);
r = await as(M, "authenticated", `update data_requests set status = 'completed', response = 'self-approved' where id = '${REQ}'`);
expect("member can't answer their own request", r.ok && r.affected === 0, r);
r = await as(D, "authenticated", `update data_requests set status = 'completed', response = 'Sent by email' where id = '${REQ}'`);
expect("Information Officer (manage_access) can answer a request", changed(r), r);
r = await as(D, "authenticated", `update data_requests set due_at = now() + interval '1 year' where id = '${REQ}'`);
expect("nobody can move a request's deadline", denied(r), r);
r = await as(M, "authenticated", `update profiles set privacy_accepted_version = 'x' where id = '${M}'`);
expect("consent is recorded only by the server", r.ok && r.affected === 0, r);

// ── Attendance & check-in ─────────────────────────────────────────────
const V = id(40), TT = id(41), TT2 = id(42), SVC = id(43), CRS = id(44), CL1 = id(45), COH = id(46);
await db.exec(`
  insert into auth.users (id) values ('${V}'), ('${TT}'), ('${TT2}');
  insert into profiles (id, zone_id, role, full_name, email, position, scope, church_id, caps) values
    ('${V}', '${Z}', 'admin', 'Volunteer', 'v@x', 'member', 'chapter', '${C1}', '{check_in}'),
    ('${TT}', '${Z}', 'admin', 'Teacher', 't@x', 'member', 'self', null, '{teach_courses}'),
    ('${TT2}', '${Z}', 'admin', 'Other Teacher', 't2@x', 'member', 'self', null, '{teach_courses}');
`);
r = await as(V, "authenticated", `select id from members`);
expect("check-in volunteer can't read the members table", r.ok && r.rows.length === 0, r);
r = await as(V, "authenticated", `select * from checkin_roster('${C1}')`);
expect(
  "check-in roster gives names but no contact details",
  r.ok && r.rows.length > 0 && !("email" in r.rows[0]) && !("phone" in r.rows[0]),
  r
);
r = await as(V, "authenticated", `select * from checkin_roster('${C2}')`);
expect("check-in roster is limited to the volunteer's own chapter", r.ok && r.rows.length === 0, r);
r = await as(null, "anon", `select * from checkin_roster('${C1}')`);
expect("anonymous can't read the check-in roster", denied(r) || r.rows.length === 0, r);
r = await as(V, "authenticated", `insert into services (id, zone_id, church_id, service_date, kind) values ('${SVC}', '${Z}', '${C1}', '2026-01-04', 'sunday')`);
expect("volunteer can open a service in their chapter", r.ok, r);
r = await as(V, "authenticated", `insert into attendance (id, zone_id, service_id, member_id) values (gen_random_uuid(), '${Z}', '${SVC}', '${MM}')`);
expect("volunteer can check a member in", r.ok, r);
r = await as(V, "authenticated", `insert into attendance (id, zone_id, service_id, member_id) values (gen_random_uuid(), '${Z}', '${SVC}', '${MM}')`);
expect("a member can't be checked in to a service twice", denied(r), r);
r = await as(V, "authenticated", `insert into attendance (id, zone_id, service_id, member_id) values (gen_random_uuid(), '${Z}', '${SVC}', '${MM2}')`);
expect("volunteer can't check in someone from another chapter", denied(r), r);
r = await as(V, "authenticated", `insert into follow_ups (zone_id, member_id) values ('${Z}', '${MM}')`);
expect("volunteer can't record follow-ups", denied(r), r);
r = await as(M, "authenticated", `select id from attendance`);
expect("a member sees only their own attendance", r.ok && r.rows.length === 1, r);

// ── Courses ───────────────────────────────────────────────────────────
await db.exec(`
  insert into courses (id, zone_id, name, required_classes) values ('${CRS}', '${Z}', 'Course', 2);
  insert into course_classes (id, course_id, zone_id, number) values ('${CL1}', '${CRS}', '${Z}', 1);
  insert into cohorts (id, zone_id, course_id, church_id, name, teacher_profile_id) values ('${COH}', '${Z}', '${CRS}', '${C1}', 'A', '${TT}');
  insert into cohort_students (cohort_id, member_id, zone_id) values ('${COH}', '${MM}', '${Z}');
`);
r = await as(TT, "authenticated", `select id from cohorts`);
expect("teacher sees their own class group", r.ok && r.rows.length === 1, r);
r = await as(TT2, "authenticated", `select id from cohorts`);
expect("another teacher doesn't see it", r.ok && r.rows.length === 0, r);
r = await as(TT, "authenticated", `select * from cohort_roster('${COH}')`);
expect("teacher's roster has names but no contact details", r.ok && r.rows.length === 1 && !("email" in r.rows[0]), r);
r = await as(TT, "authenticated", `insert into class_attendance (zone_id, class_id, cohort_id, member_id) values ('${Z}', '${CL1}', '${COH}', '${MM}')`);
expect("teacher can tick their own student's class", r.ok, r);
r = await as(TT, "authenticated", `insert into class_attendance (zone_id, class_id, cohort_id, member_id) values ('${Z}', '${CL1}', '${COH}', '${MM2}')`);
expect("teacher can't tick someone who isn't in the group", denied(r), r);
r = await as(TT2, "authenticated", `delete from class_attendance where cohort_id = '${COH}'`);
expect("another teacher can't change the register", r.ok && r.affected === 0, r);
r = await as(M, "authenticated", `select id from resources`);
expect("members can't see the leaders' resources", r.ok && r.rows.length === 0, r);

// ── Privacy details (zones.legal_settings) ───────────────────────────
r = await as(M, "authenticated", `update zones set legal_settings = '{"organisationName":"Hijacked"}' where id = '${Z}'`);
expect("member can't change the privacy details", r.ok && r.affected === 0, r);
r = await as(G, "authenticated", `update zones set legal_settings = '{"organisationName":"Hijacked"}' where id = '${Z}'`);
expect("leader without manage_access can't change the privacy details", r.ok && r.affected === 0, r);
r = await as(D, "authenticated", `update zones set legal_settings = '{"organisationName":"Grace NPC"}' where id = '${Z}'`);
expect("whoever manages access can change the privacy details", changed(r), r);

// ── Self check-in screen ──────────────────────────────────────────────
r = await as(D, "authenticated", `insert into check_in_screen (zone_id, title, background_path) values ('${Z}', 'Welcome', '${Z}/bg.jpg')`);
expect("an admin can set the check-in screen", r.ok, r);
r = await as(D, "authenticated", `update check_in_screen set background_path = '${id(99)}/bg.jpg' where zone_id = '${Z}'`);
expect("the background must be in the zone's own folder", denied(r), r);
r = await as(G, "authenticated", `update check_in_screen set title = 'Hijacked' where zone_id = '${Z}'`);
expect("a leader without manage_access can't change it", r.ok && r.affected === 0, r);
r = await as(V, "authenticated", `select title from check_in_screen`);
expect("the check-in volunteer can read it (they run the kiosk)", r.ok && r.rows.length === 1, r);
r = await as(M, "authenticated", `select title from check_in_screen`);
expect("members can't read it", r.ok && r.rows.length === 0, r);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
