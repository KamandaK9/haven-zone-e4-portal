-- The Haven Zone E4: eight countries and nine sub-zones, as set out by the
-- Zonal Director.
--
--   Sub-zone 1  South Africa            Sub-zone 6  Zambia
--   Sub-zone 2  Botswana                Sub-zone 7  Botswana
--   Sub-zone 3  Zimbabwe                Sub-zone 8  Mozambique
--   Sub-zone 4  Namibia                 Sub-zone 9  Eswatini
--   Sub-zone 5  South Africa (East London)
--
-- Idempotent, and it never moves a chapter out of a sub-zone that is
-- already correct. Countries shared by two sub-zones (South Africa 1/5,
-- Botswana 2/7) are only auto-placed where unambiguous (East London →
-- sub-zone 5); other chapters there keep the sub-zone they already have.

-- 1. Countries: add Mozambique and Angola; drop Malawi — but only if it has
-- no chapters (deleting a country would delete its chapters).
insert into countries (zone_id, name, flag)
select z.id, v.name, v.flag
from zones z
cross join (values ('Mozambique', '🇲🇿'), ('Angola', '🇦🇴')) as v(name, flag)
where not exists (select 1 from countries c where c.zone_id = z.id and lower(c.name) = lower(v.name));

delete from countries c
where lower(c.name) = 'malawi'
  and not exists (select 1 from churches ch where ch.country_id = c.id);

-- 2. Sub-zones 1–9. Match the existing ones by their number ("SZ3",
-- "Sub-zone 3"); create what's missing in the same style.
do $$
declare
  z record;
  n int;
  style text;
begin
  for z in select id from zones loop
    select case when exists (select 1 from sub_zones s where s.zone_id = z.id and s.name ~* '^sub') then 'Sub-zone ' else 'SZ' end
      into style;
    for n in 1..9 loop
      if not exists (
        select 1 from sub_zones s where s.zone_id = z.id and substring(s.name from '(\d+)\s*$')::int = n
      ) then
        insert into sub_zones (zone_id, name) values (z.id, style || n);
      end if;
    end loop;
  end loop;
end $$;

-- 3. Chapters. Countries with one sub-zone: every chapter belongs to it.
with target(country, sz) as (
  values ('zimbabwe', 3), ('namibia', 4), ('zambia', 6), ('mozambique', 8), ('eswatini', 9)
)
update churches ch
set sub_zone_id = s.id
from countries c, target t, sub_zones s
where ch.country_id = c.id
  and lower(c.name) = t.country
  and s.zone_id = ch.zone_id
  and substring(s.name from '(\d+)\s*$')::int = t.sz
  and not ch.is_office
  and ch.sub_zone_id is distinct from s.id;

-- East London chapters are sub-zone 5.
update churches ch
set sub_zone_id = s.id
from countries c, sub_zones s
where ch.country_id = c.id
  and lower(c.name) = 'south africa'
  and ch.name ilike '%east london%'
  and s.zone_id = ch.zone_id
  and substring(s.name from '(\d+)\s*$')::int = 5
  and not ch.is_office
  and ch.sub_zone_id is distinct from s.id;

-- Other South African chapters not yet in a sub-zone go to sub-zone 1.
update churches ch
set sub_zone_id = s.id
from countries c, sub_zones s
where ch.country_id = c.id
  and lower(c.name) = 'south africa'
  and ch.sub_zone_id is null
  and s.zone_id = ch.zone_id
  and substring(s.name from '(\d+)\s*$')::int = 1
  and not ch.is_office;
