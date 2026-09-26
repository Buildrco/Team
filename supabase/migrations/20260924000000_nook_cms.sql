-- Nook Studios CMS
-- Run with Supabase migrations. The public site reads published rows only.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.page_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'viewer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  favicon_url text,
  primary_color text not null default '#101522',
  secondary_color text not null default '#c7f36b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  slug text not null,
  page_type text not null default 'standard',
  status public.page_status not null default 'draft',
  seo_title text,
  seo_description text,
  og_image_url text,
  is_homepage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique(site_id, slug)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  section_type text not null,
  title text,
  subtitle text,
  content text,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, sort_order)
);

create table if not exists public.section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  item_type text not null default 'card',
  title text,
  subtitle text,
  body text,
  image_url text,
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, sort_order)
);

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  parent_id uuid references public.navigation_items(id) on delete cascade,
  label text not null,
  url text not null default '/',
  page_id uuid references public.pages(id) on delete set null,
  icon text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  open_in_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  public_url text not null,
  alt_text text,
  width integer,
  height integer,
  mime_type text,
  file_size integer,
  folder text not null default 'uploads',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  revision_data jsonb not null,
  created_at timestamptz not null default now(),
  description text
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  setting_key text not null,
  setting_value text,
  updated_at timestamptz not null default now(),
  unique(site_id, setting_key)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
alter function public.set_updated_at() set search_path = public;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at before update on public.sites for each row execute function public.set_updated_at();
drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at before update on public.pages for each row execute function public.set_updated_at();
drop trigger if exists sections_set_updated_at on public.sections;
create trigger sections_set_updated_at before update on public.sections for each row execute function public.set_updated_at();
drop trigger if exists section_items_set_updated_at on public.section_items;
create trigger section_items_set_updated_at before update on public.section_items for each row execute function public.set_updated_at();
drop trigger if exists navigation_items_set_updated_at on public.navigation_items;
create trigger navigation_items_set_updated_at before update on public.navigation_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.section_items enable row level security;
alter table public.navigation_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.revisions enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sites_public_read on public.sites;
create policy sites_public_read on public.sites for select using (true);
drop policy if exists sites_staff_write on public.sites;
create policy sites_staff_write on public.sites for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages for select using (status = 'published');
drop policy if exists pages_staff_read on public.pages;
create policy pages_staff_read on public.pages for select using (public.is_staff());
drop policy if exists pages_editor_write on public.pages;
create policy pages_editor_write on public.pages for insert with check (public.is_staff());
drop policy if exists pages_editor_update on public.pages;
create policy pages_editor_update on public.pages for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists pages_admin_delete on public.pages;
create policy pages_admin_delete on public.pages for delete using (public.is_admin());

drop policy if exists sections_public_read on public.sections;
create policy sections_public_read on public.sections for select using (exists (select 1 from public.pages p where p.id = page_id and p.status = 'published'));
drop policy if exists sections_staff_read on public.sections;
create policy sections_staff_read on public.sections for select using (public.is_staff());
drop policy if exists sections_editor_write on public.sections;
create policy sections_editor_write on public.sections for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists section_items_public_read on public.section_items;
create policy section_items_public_read on public.section_items for select using (exists (select 1 from public.sections s join public.pages p on p.id = s.page_id where s.id = section_id and p.status = 'published'));
drop policy if exists section_items_staff_read on public.section_items;
create policy section_items_staff_read on public.section_items for select using (public.is_staff());
drop policy if exists section_items_editor_write on public.section_items;
create policy section_items_editor_write on public.section_items for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists navigation_public_read on public.navigation_items;
create policy navigation_public_read on public.navigation_items for select using (is_visible = true and parent_id is null);
drop policy if exists navigation_admin_write on public.navigation_items;
create policy navigation_admin_write on public.navigation_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists media_staff_read on public.media_assets;
create policy media_staff_read on public.media_assets for select using (public.is_staff());
drop policy if exists media_staff_write on public.media_assets;
create policy media_staff_write on public.media_assets for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists revisions_staff_read on public.revisions;
create policy revisions_staff_read on public.revisions for select using (public.is_staff());
drop policy if exists revisions_staff_write on public.revisions;
create policy revisions_staff_write on public.revisions for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select using (true);
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select using (bucket_id = 'site-assets');
drop policy if exists site_assets_staff_insert on storage.objects;
create policy site_assets_staff_insert on storage.objects for insert with check (bucket_id = 'site-assets' and public.is_staff());
drop policy if exists site_assets_staff_update on storage.objects;
create policy site_assets_staff_update on storage.objects for update using (bucket_id = 'site-assets' and public.is_staff()) with check (bucket_id = 'site-assets' and public.is_staff());
drop policy if exists site_assets_staff_delete on storage.objects;
create policy site_assets_staff_delete on storage.objects for delete using (bucket_id = 'site-assets' and public.is_staff());

do $seed$
declare
  v_site_id uuid;
  home_id uuid;
  about_id uuid;
  works_id uuid;
  services_id uuid;
  contact_id uuid;
begin
  insert into public.sites (name, slug, logo_url, primary_color, secondary_color)
  values ('Nook Studios', 'nook-studios', '/nook-studios-logo.png', '#101522', '#c7f36b')
  on conflict (slug) do update set name = excluded.name
  returning id into v_site_id;

  insert into public.pages (site_id, title, slug, page_type, status, seo_title, seo_description, is_homepage, published_at)
  values (v_site_id, 'Nook Studios', 'home', 'homepage', 'published', 'Nook Studios — Creative digital studio', 'Nook Studios helps ambitious businesses grow through strategy, branding, content, SEO, and digital experiences.', true, now())
  on conflict (site_id, slug) do update set title = excluded.title, is_homepage = excluded.is_homepage
  returning id into home_id;
  insert into public.pages (site_id, title, slug, page_type, status, seo_title, seo_description)
  values (v_site_id, 'About Nook Studios', 'about', 'about', 'published', 'About Nook Studios — Creative digital studio', 'Meet the people and point of view behind Nook Studios.')
  on conflict (site_id, slug) do update set title = excluded.title
  returning id into about_id;
  insert into public.pages (site_id, title, slug, page_type, status, seo_title, seo_description)
  values (v_site_id, 'Selected works', 'works', 'portfolio', 'published', 'Selected work — Nook Studios', 'A selection of brand, content, and digital work from Nook Studios.')
  on conflict (site_id, slug) do update set title = excluded.title
  returning id into works_id;
  insert into public.pages (site_id, title, slug, page_type, status, seo_title, seo_description)
  values (v_site_id, 'Services', 'services', 'services', 'published', 'Services — Nook Studios', 'Brand, content, SEO, and digital services designed to move businesses forward.')
  on conflict (site_id, slug) do update set title = excluded.title
  returning id into services_id;
  insert into public.pages (site_id, title, slug, page_type, status, seo_title, seo_description)
  values (v_site_id, 'Contact Nook Studios', 'contact', 'contact', 'published', 'Contact Nook Studios', 'Start a conversation with the Nook Studios team.')
  on conflict (site_id, slug) do update set title = excluded.title
  returning id into contact_id;

  insert into public.sections (page_id, section_type, title, subtitle, content, settings, sort_order)
  values
    (home_id, 'hero', 'With a combined years of experience, our team is passionate about helping businesses grow.', '#1 popular digital marketing agency', 'We believe the best user experiences are intuitive, beautiful, and a joy to use. Those principles shape every brand, campaign, and digital experience we make.', jsonb_build_object('background_image','/team-home-banner.jpg','button_label','Book a call','button_url','/contact'), 0),
    (home_id, 'text_image', 'Bold ideas meet thoughtful design.', 'A community of creative night owls', 'We build brands that win. From the first conversation to the final launch, we bring clear thinking, warm collaboration, and a sharp point of view.', jsonb_build_object('image_url','/founder-desmond.jpg','image_alt','Nook Studios founder'), 1),
    (home_id, 'portfolio_grid', 'Featured works', 'Selected work', 'A few projects where strategy, identity, and execution came together.', '{}'::jsonb, 2),
    (home_id, 'services_grid', 'Trusted service that delivers every time.', 'Our services', 'Position your brand at the forefront, leading trends, captivating audiences, and creating lasting market impressions.', '{}'::jsonb, 3),
    (home_id, 'large_service', 'From strategy to success', 'Our process', 'Here is how we turn ideas into impactful marketing campaigns.', '{}'::jsonb, 4),
    (home_id, 'testimonial', 'What our customers say', 'Testimonials', 'Setting up a business can be complex. Every decision you make impacts your journey and long-term success.', '{}'::jsonb, 5),
    (home_id, 'cta', 'Let’s build something that matters.', 'Ready when you are', 'Tell us where you want to go. We will help you find the clearest route there.', jsonb_build_object('button_label','Start a conversation','button_url','/contact'), 6),
    (about_id, 'hero', 'The people and point of view behind the work.', 'About Nook Studios', 'We are a creative studio for businesses ready to be seen, remembered, and chosen.', jsonb_build_object('background_image','/about-team-1.jpg','button_label','Work with us','button_url','/contact'), 0),
    (about_id, 'text_image', 'We make the complex feel clear.', 'Our mission', 'Good design is not decoration. It is the clarity people feel when a brand knows what it stands for and makes it easy to take the next step.', jsonb_build_object('image_url','/about-team-2.jpg'), 1),
    (about_id, 'logo_marquee', 'Trusted by leaders', 'Collaborations', '', '{}'::jsonb, 2),
    (about_id, 'team_grid', 'Our Creative Team', 'The people behind the work', 'Explore the services our clients love most, designed to deliver exceptional results.', '{}'::jsonb, 3),
    (about_id, 'cta', 'Make your next move a confident one.', 'Let’s collaborate', 'Bring us the challenge. We will bring a point of view.', jsonb_build_object('button_label','Let’s talk','button_url','/contact'), 4),
    (works_id, 'hero', 'Work that moves people and business.', 'Selected work', 'A selection of brand identities, campaigns, content, and digital experiences.', jsonb_build_object('background_image','/team-home-banner.jpg'), 0),
    (works_id, 'portfolio_grid', 'Selected projects', 'What we have been making', 'Every project starts with a question and ends with something useful in the world.', '{}'::jsonb, 1),
    (services_id, 'hero', 'Strategy, design, and growth in one focused team.', 'Our services', 'We help ambitious teams turn good ideas into brands and experiences people choose.', jsonb_build_object('background_image','/team-home-banner.jpg','button_label','Start a project','button_url','/contact'), 0),
    (services_id, 'services_grid', 'Build a brand that wins attention.', 'What we do', 'From the first insight to the final interaction, our services work better together.', '{}'::jsonb, 1),
    (services_id, 'large_service', 'A clear process keeps great work moving.', 'How we work', 'Discover, strategize, create, and launch with a team that stays close to the outcome.', '{}'::jsonb, 2),
    (contact_id, 'hero', 'Let’s talk about what comes next.', 'Contact Nook Studios', 'Have a brief, a problem, or only the first spark of an idea? That is enough to start.', jsonb_build_object('background_image','/team-home-banner.jpg'), 0),
    (contact_id, 'contact', 'Tell us what you are building.', 'Start a conversation', 'Share a little context and the Nook team will get back to you with a thoughtful next step.', '{}'::jsonb, 1);

  insert into public.section_items (section_id, item_type, title, subtitle, body, image_url, sort_order)
  select id, 'card', 'Brand identity', 'Branding & design', 'Create memorable brands and engaging visuals that connect with your audience.', null, 0 from public.sections where page_id = home_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'SEO & analytics', 'SEO & analytics', 'Optimize visibility, track performance, and gain insights to drive measurable growth.', 1 from public.sections where page_id = home_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'Content writing', 'Content', 'Find the voice, stories, and messages that make your brand useful and memorable.', 2 from public.sections where page_id = home_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'UI/UX design', 'Digital experiences', 'We design responsive, engaging websites tailored for seamless user experiences.', 3 from public.sections where page_id = home_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'step', 'Discover', 'Step 01', 'Uncover new opportunities, explore insights, and unlock growth with endless possibilities.', 0 from public.sections where page_id = home_id and sort_order = 4
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'step', 'Strategize', 'Step 02', 'Plan smarter, align goals, and execute strategies that ensure sustainable business success.', 1 from public.sections where page_id = home_id and sort_order = 4
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'step', 'Create', 'Step 03', 'Bring ideas to life, design with purpose, and craft experiences that inspire growth.', 2 from public.sections where page_id = home_id and sort_order = 4
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'step', 'Launch', 'Step 04', 'Execute across selected platforms, optimized for reach, engagement, and conversions.', 3 from public.sections where page_id = home_id and sort_order = 4
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'quote', 'Kenneth', 'CTO', 'I felt 10x smarter and more confident after Day 1. Nook does not just teach — they translate knowledge into actionable clarity.', 0 from public.sections where page_id = home_id and sort_order = 5
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'quote', 'K. Cronin', 'Founder', 'I walked away with incredible clarity after just one session. They turn complicated ideas into straightforward, actionable strategies.', 1 from public.sections where page_id = home_id and sort_order = 5
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'quote', 'Jeffrey', 'Business consultant', 'The clarity I got from a single session was transformative. Nook breaks down complex concepts into simple, useful steps.', 2 from public.sections where page_id = home_id and sort_order = 5
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'team', 'Desmond Grace', 'Founder & Creative Director', '/founder-desmond.jpg', 0 from public.sections where page_id = about_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'team', 'Fiifi Abew', 'Founder & Technical Director', '/founder-fiifi.jpg', 1 from public.sections where page_id = about_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'team', 'Jennifer Wilson', 'Social Media Strategist Lead', '/team-jennifer.jpg', 2 from public.sections where page_id = about_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'team', 'Johnetta', 'Lead Content Creator', '/team-johnetta.jpg', 3 from public.sections where page_id = about_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'team', 'Aaron Adonteng', 'Lead Architect and Chief of Staff (C.O.S)', '/team-aaron.jpg', 4 from public.sections where page_id = about_id and sort_order = 3
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'logo', 'Branding', 'Nook Studios', null, 0 from public.sections where page_id = about_id and sort_order = 2
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, sort_order)
  select id, 'logo', 'SEO', 'Nook Studios', 1 from public.sections where page_id = about_id and sort_order = 2
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, sort_order)
  select id, 'logo', 'Content', 'Nook Studios', 2 from public.sections where page_id = about_id and sort_order = 2
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, sort_order)
  select id, 'logo', 'Digital reach', 'Nook Studios', 3 from public.sections where page_id = about_id and sort_order = 2
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, sort_order)
  select id, 'logo', 'Web design', 'Nook Studios', 4 from public.sections where page_id = about_id and sort_order = 2
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'work', 'Nook brand system', 'Brand identity', '/about-team-3.jpg', 0 from public.sections where page_id = works_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'work', 'Digital growth campaign', 'Digital reach', '/about-team-4.jpg', 1 from public.sections where page_id = works_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, image_url, sort_order)
  select id, 'work', 'Content that connects', 'Content strategy', '/team-home-banner.jpg', 2 from public.sections where page_id = works_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;

  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'Brand identity', 'Branding & design', 'Create memorable brands and engaging visuals that connect with your audience.', 0 from public.sections where page_id = services_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'SEO & analytics', 'SEO & analytics', 'Optimize visibility, track performance, and gain insights to drive measurable business growth.', 1 from public.sections where page_id = services_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'Content writing', 'Content', 'The discovery phase involves understanding the brand voice, target audience, and content goals.', 2 from public.sections where page_id = services_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;
  insert into public.section_items (section_id, item_type, title, subtitle, body, sort_order)
  select id, 'card', 'UI/UX design', 'Digital experiences', 'We design responsive, engaging websites tailored for seamless user experiences.', 3 from public.sections where page_id = services_id and sort_order = 1
  on conflict (section_id, sort_order) do nothing;

  insert into public.navigation_items (site_id, label, url, page_id, sort_order)
  values
    (v_site_id, 'Home', '/', home_id, 0),
    (v_site_id, 'About', '/about', about_id, 1),
    (v_site_id, 'Works', '/works', works_id, 2),
    (v_site_id, 'Services', '/services', services_id, 3),
    (v_site_id, 'Contact', '/contact', contact_id, 4)
  on conflict do nothing;

  insert into public.site_settings (site_id, setting_key, setting_value)
  values
    (v_site_id, 'contact_email', 'nookstudiosofficial@gmail.com'),
    (v_site_id, 'contact_phone', '+233 55 769 6771'),
    (v_site_id, 'location', 'Osu, Accra'),
    (v_site_id, 'footer_note', 'Bold ideas meet thoughtful design and measurable growth.')
  on conflict (site_id, setting_key) do nothing;
end $seed$;