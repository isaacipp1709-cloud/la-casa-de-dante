-- Migracion LOCAL. NO ejecutada contra Supabase remoto.
-- Crea la tabla de credenciales BYOK. No altera ni elimina objetos existentes.

create table if not exists public.user_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_id text not null,
  credential_id text not null unique,
  algorithm text not null,
  iv text not null,
  auth_tag text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_provider_credentials_owner_idx
  on public.user_provider_credentials (owner_id);

alter table public.user_provider_credentials
  enable row level security;

create policy "owners can manage own credentials"
  on public.user_provider_credentials
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
