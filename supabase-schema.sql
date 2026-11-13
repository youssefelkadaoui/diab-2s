-- Supabase SQL Editor: run once to create the room table and enable realtime updates.
create table if not exists public.werewolf_rooms (
  id text primary key check (char_length(id) = 4),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.werewolf_rooms enable row level security;
grant select, insert, update on public.werewolf_rooms to anon, authenticated;
-- Prototype policy: anyone with the public anon key can read/write room states.
-- Do not use this open policy for a public production game where roles must be protected.
drop policy if exists "public room access" on public.werewolf_rooms;
create policy "public room access" on public.werewolf_rooms for all to anon, authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.werewolf_rooms;
exception when duplicate_object then null;
end $$;
