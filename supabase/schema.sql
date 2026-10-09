-- Run once in the Supabase SQL Editor for this website.
-- Public visitors can submit project requests and read published content only.
-- Authenticated users must also be listed in admin_users to manage private data.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 5 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  project_city text check (project_city is null or char_length(project_city) <= 120),
  service_type text check (service_type is null or char_length(service_type) <= 80),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  consent boolean not null check (consent is true),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  location text check (location is null or char_length(location) <= 120),
  category text not null check (char_length(trim(category)) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  storage_path text not null unique,
  client_permission boolean not null default false check (client_permission is true),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(trim(author_name)) between 1 and 100),
  location text check (location is null or char_length(location) <= 120),
  quote text not null check (char_length(trim(quote)) between 5 and 1200),
  rating smallint not null check (rating between 1 and 5),
  source_platform text check (source_platform is null or char_length(source_platform) <= 80),
  source_url text check (source_url is null or source_url ~ '^https://'),
  permission_to_publish boolean not null default false check (permission_to_publish is true),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.inquiries enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Visitors can submit consented inquiries" on public.inquiries;
create policy "Visitors can submit consented inquiries" on public.inquiries
  for insert to anon, authenticated with check (consent is true);
drop policy if exists "Admins can manage inquiries" on public.inquiries;
create policy "Admins can manage inquiries" on public.inquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read published portfolio" on public.portfolio_items;
create policy "Anyone can read published portfolio" on public.portfolio_items
  for select to anon, authenticated using (is_published is true);
drop policy if exists "Admins can manage portfolio" on public.portfolio_items;
create policy "Admins can manage portfolio" on public.portfolio_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read published reviews" on public.reviews;
create policy "Anyone can read published reviews" on public.reviews
  for select to anon, authenticated using (is_published is true);
drop policy if exists "Admins can manage reviews" on public.reviews;
create policy "Admins can manage reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.admin_users to authenticated;
grant insert on public.inquiries to anon, authenticated;
grant select, update on public.inquiries to authenticated;
grant select on public.portfolio_items to anon, authenticated;
grant insert, update on public.portfolio_items to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update on public.reviews to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view portfolio images" on storage.objects;
create policy "Anyone can view portfolio images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'portfolio');
drop policy if exists "Admins can upload portfolio images" on storage.objects;
create policy "Admins can upload portfolio images" on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "Admins can update portfolio images" on storage.objects;
create policy "Admins can update portfolio images" on storage.objects
  for update to authenticated using (bucket_id = 'portfolio' and public.is_admin())
  with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "Admins can remove portfolio images" on storage.objects;
create policy "Admins can remove portfolio images" on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio' and public.is_admin());

