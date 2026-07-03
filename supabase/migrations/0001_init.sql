-- Phase 11 T3 — initial schema. Run via `supabase db push` or the SQL editor.
-- Philosophy: RLS ON EVERYTHING; clients only ever touch their own rows.
-- Entitlements and webhook_events are written ONLY by the service role.

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "own profile read"  on public.profiles for select using (auth.uid() = id);
create policy "own profile write" on public.profiles for update using (auth.uid() = id);

-- auto-create a profile on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.entitlements (user_id, tier, source) values (new.id, 'free', 'manual');
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ── entitlements (service-role writes only) ────────────────────────────────
create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'lifetime')),
  source text not null default 'manual' check (source in ('stripe', 'paddle', 'lemonsqueezy', 'manual', 'beta')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "own entitlement read" on public.entitlements for select using (auth.uid() = user_id);
-- NO insert/update/delete policies: only the service role (webhook) writes.

-- ── libraries (sync unit = whole blob per kind) ─────────────────────────────
create table public.libraries (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tool', 'machine', 'job')),
  payload jsonb not null,
  device_updated_at bigint not null,           -- client ms epoch, drives LWW
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.libraries enable row level security;
create policy "own libraries all" on public.libraries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Free-tier integrity backstop (client enforces UX; this enforces truth):
-- free users may store at most 25 items per kind.
create function public.enforce_free_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  user_tier text;
  item_count int;
begin
  select tier into user_tier from public.entitlements where user_id = new.user_id;
  if coalesce(user_tier, 'free') = 'free' then
    item_count := coalesce(jsonb_array_length(new.payload), 0);
    if item_count > 25 then
      raise exception 'free tier limit: % items per % (max 25)', item_count, new.kind;
    end if;
  end if;
  return new;
end $$;
create trigger libraries_free_limit
  before insert or update on public.libraries
  for each row execute function public.enforce_free_limits();

-- ── shared_recipes (F6, community content — published are world-readable) ──
create table public.shared_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  payload jsonb not null,
  material_group text check (material_group in ('P','M','K','N','S','H')),
  votes int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.shared_recipes enable row level security;
create policy "read published or own" on public.shared_recipes for select
  using (published or auth.uid() = user_id);
create policy "write own recipes" on public.shared_recipes for insert
  with check (auth.uid() = user_id);
create policy "update own recipes" on public.shared_recipes for update
  using (auth.uid() = user_id);
create policy "delete own recipes" on public.shared_recipes for delete
  using (auth.uid() = user_id);

-- ── webhook_events (Phase 12 idempotency; service role only) ───────────────
create table public.webhook_events (
  id text primary key,                          -- provider's event id
  provider text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false
);
alter table public.webhook_events enable row level security;
-- no policies: clients can never touch this table.

-- ── GDPR: deleting auth.users cascades everything above (AC) ───────────────
-- Account deletion runbook: supabase.auth.admin.deleteUser(id) — FKs cascade.
