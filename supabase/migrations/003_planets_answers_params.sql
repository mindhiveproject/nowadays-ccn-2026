-- Collapse answer1–3 into answers jsonb (open-ended shape), and rename
-- star_params → params with the fixed StarParams check.

alter table public.planets
  add column if not exists answers jsonb not null default '{}'::jsonb;

update public.planets
set answers = jsonb_build_object(
  'answer1', answer1,
  'answer2', answer2,
  'answer3', answer3
);

alter table public.planets
  drop column if exists answer1,
  drop column if exists answer2,
  drop column if exists answer3;

alter table public.planets
  drop constraint if exists planets_star_params_shape;

alter table public.planets
  rename column star_params to params;

-- Ensure legacy rows (pre-size) get the default size key before the check.
update public.planets
set params = jsonb_set(params, '{size}', '120'::jsonb, true)
where jsonb_typeof(params -> 'size') is distinct from 'number';

alter table public.planets
  drop constraint if exists planets_params_shape;

alter table public.planets
  add constraint planets_params_shape check (
    jsonb_typeof(params -> 'size')  = 'number' and
    jsonb_typeof(params -> 'freq')  = 'number' and
    jsonb_typeof(params -> 'noise') = 'number' and
    jsonb_typeof(params -> 'core')  = 'number' and
    jsonb_typeof(params -> 'hue')   = 'number' and
    jsonb_typeof(params -> 'hue2')  = 'number'
  );
