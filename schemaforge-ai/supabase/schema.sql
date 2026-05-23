-- SchemaForge AI Supabase schema
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schemas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  dialect text not null,
  current_version integer not null default 1,
  naming_convention text not null default 'snake_case',
  share_token text unique,
  branch text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schema_versions (
  id uuid primary key default gen_random_uuid(),
  schema_id uuid not null references public.schemas(id) on delete cascade,
  version integer not null,
  schema_json jsonb not null,
  ddl text not null,
  prompt text,
  label text,
  branch text not null default 'main',
  created_at timestamptz not null default now(),
  unique (schema_id, version)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  prompt text,
  schema_id uuid references public.schemas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  schema_id uuid not null references public.schemas(id) on delete cascade,
  table_name text,
  column_name text,
  author text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  name text,
  email text,
  subject text,
  message text not null,
  page_url text,
  user_agent text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_schemas_user_id on public.schemas(user_id);
create index if not exists idx_schema_versions_schema_id on public.schema_versions(schema_id);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_comments_schema_id on public.comments(schema_id);
create index if not exists idx_feedback_created_at on public.feedback(created_at);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_usage_log_user_id on public.usage_log(user_id);

alter table public.profiles enable row level security;
alter table public.schemas enable row level security;
alter table public.schema_versions enable row level security;
alter table public.projects enable row level security;
alter table public.comments enable row level security;
alter table public.feedback enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_log enable row level security;

create policy "Profiles are readable by owner"
on public.profiles for select
using (auth.uid() = id);

create policy "Profiles are editable by owner"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Schemas are readable by owner"
on public.schemas for select
using (auth.uid() = user_id);

create policy "Schemas are insertable by owner"
on public.schemas for insert
with check (auth.uid() = user_id);

create policy "Schemas are editable by owner"
on public.schemas for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Schema versions are readable by schema owner"
on public.schema_versions for select
using (
  exists (
    select 1 from public.schemas
    where public.schemas.id = public.schema_versions.schema_id
    and public.schemas.user_id = auth.uid()
  )
);

create policy "Schema versions are insertable by schema owner"
on public.schema_versions for insert
with check (
  exists (
    select 1 from public.schemas
    where public.schemas.id = public.schema_versions.schema_id
    and public.schemas.user_id = auth.uid()
  )
);

create policy "Projects are readable by owner"
on public.projects for select
using (auth.uid() = user_id);

create policy "Projects are insertable by owner"
on public.projects for insert
with check (auth.uid() = user_id);

create policy "Comments are readable by owner"
on public.comments for select
using (auth.uid() = user_id);

create policy "Comments are insertable by owner"
on public.comments for insert
with check (auth.uid() = user_id);

create policy "Feedback is readable by owner"
on public.feedback for select
using (auth.uid() = user_id);

create policy "Feedback is insertable by owner"
on public.feedback for insert
with check (auth.uid() = user_id);

create policy "Billing customers are readable by owner"
on public.billing_customers for select
using (auth.uid() = user_id);

create policy "Subscriptions are readable by owner"
on public.subscriptions for select
using (auth.uid() = user_id);

create policy "Usage is readable by owner"
on public.usage_log for select
using (auth.uid() = user_id);
