-- CMS bridge repair: make imported frontend rows publicly readable after publish and add the missing publish RPC.

create table if not exists public.cms_elements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  page_path text not null default '/',
  element_key text not null,
  label text not null default '',
  element_type text not null default 'element',
  source_selector text not null,
  container_selector text,
  original_value jsonb not null default '{}'::jsonb,
  draft_value jsonb not null default '{}'::jsonb,
  published_value jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cms_elements_site_page_key on public.cms_elements(site_id, page_path, element_key);
alter table public.cms_elements enable row level security;

drop policy if exists cms_elements_public_read on public.cms_elements;
create policy cms_elements_public_read on public.cms_elements for select using (is_published = true);
drop policy if exists cms_elements_staff_read on public.cms_elements;
create policy cms_elements_staff_read on public.cms_elements for select using (public.is_staff());
drop policy if exists cms_elements_staff_write on public.cms_elements;
create policy cms_elements_staff_write on public.cms_elements for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.publish_cms_page(p_site_id uuid, p_page_path text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if not public.is_staff() then
    raise exception 'Only staff can publish CMS changes';
  end if;
  update public.cms_elements
     set published_value = draft_value,
         is_published = true,
         updated_at = now()
   where site_id = p_site_id and page_path = p_page_path;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.publish_cms_page(uuid, text) from public;
grant execute on function public.publish_cms_page(uuid, text) to authenticated;
