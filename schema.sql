-- Supabase SQL Editor: execute este arquivo no seu projeto novo.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'new' check (status in ('new','reviewing','accepted','declined')),
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','fulfilled','refunded')),
  total numeric(12,2) not null default 0 check (total >= 0),
  payment_provider text,
  payment_reference text,
  checkout_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.news enable row level security;
alter table public.ideas enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into public.profiles(id,email,role) values(new.id,new.email,'user')
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create policy "profiles read own or admin" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "products public active" on public.products for select to anon,authenticated using (active or public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "news public published" on public.news for select to anon,authenticated using (published or public.is_admin());
create policy "admins manage news" on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users create own ideas" on public.ideas for insert to authenticated with check (user_id=auth.uid());
create policy "users read own ideas admins all" on public.ideas for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "admins update ideas" on public.ideas for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own orders admins all" on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "users read own order items admins all" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
-- Orders/items must be created by trusted Edge Functions, not direct client inserts.
