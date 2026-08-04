create extension if not exists pgcrypto;

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists products (
  id text primary key,
  permalink text not null unique,
  name text not null,
  description text not null default '',
  meta_title text,
  meta_description text,
  brand_id uuid references brands(id),
  category_id text not null references categories(id),
  status text not null default 'available',
  sku text,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  featured boolean not null default false,
  weight numeric(10, 2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  size text not null,
  stock integer not null default 0 check (stock >= 0),
  sku text,
  price integer check (price is null or price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rut text,
  email text not null unique,
  phone text,
  last_region text,
  last_commune text,
  last_shipping_address text,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  customer_id uuid references customers(id),
  customer_name text,
  customer_rut text,
  customer_email text not null,
  customer_phone text,
  shipping_region text,
  shipping_commune text,
  shipping_method text,
  shipping_address text,
  notes text,
  subtotal integer not null check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  shipping_total integer not null default 0 check (shipping_total >= 0),
  total integer not null check (total >= 0),
  payment_provider text not null default 'flow',
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'received',
  flow_token text,
  flow_order_number text,
  payment_url text,
  inventory_deducted boolean not null default false,
  paid_email_sent boolean not null default false,
  promotion_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists customer_id uuid references customers(id);
alter table orders add column if not exists payment_url text;
alter table orders add column if not exists inventory_deducted boolean not null default false;
alter table orders add column if not exists paid_email_sent boolean not null default false;
alter table orders add column if not exists promotion_code text;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  variant_id uuid references product_variants(id),
  product_name text not null,
  image_url text,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0)
);

alter table order_items add column if not exists image_url text;

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promotions add column if not exists description text;
alter table promotions add column if not exists discount_type text;
alter table promotions add column if not exists discount_value integer;
alter table promotions add column if not exists active boolean not null default true;
alter table promotions add column if not exists created_at timestamptz not null default now();
alter table promotions add column if not exists updated_at timestamptz not null default now();

create table if not exists site_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on products(category_id);
create index if not exists products_featured_idx on products(featured);
create index if not exists product_variants_product_idx on product_variants(product_id);
create index if not exists customers_last_order_idx on customers(last_order_at desc);
create index if not exists orders_payment_status_idx on orders(payment_status);
create index if not exists orders_created_at_idx on orders(created_at desc);
create unique index if not exists orders_flow_token_idx on orders(flow_token) where flow_token is not null;
create index if not exists promotions_active_idx on promotions(active);
create index if not exists site_visits_created_at_idx on site_visits(created_at desc);

insert into categories (id, name, sort_order) values
  ('poleras', 'Poleras', 10),
  ('polerones', 'Polerones', 20),
  ('chaquetas', 'Chaquetas', 30),
  ('accesorios', 'Accesorios', 40),
  ('conjuntos', 'Conjuntos', 50)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;
