-- Username-first CMS access.
-- Supabase Auth still owns password hashing and session persistence; the
-- internal email is never shown in the CMS UI.

alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

update public.profiles
set username = lower(regexp_replace(split_part(coalesce(email, ''), '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
where username is null and email is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username, full_name)
  values (
    new.id,
    new.email,
    lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9._-]', '', 'g')),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

create or replace function public.claim_first_admin(p_username text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  clean_username text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  clean_username := lower(regexp_replace(trim(p_username), '[^a-zA-Z0-9._-]', '', 'g'));
  if clean_username = '' then
    raise exception 'Username is required';
  end if;

  if exists (select 1 from public.profiles where role = 'admin' or username = clean_username) then
    raise exception 'First admin is already claimed';
  end if;

  update public.profiles
  set username = clean_username,
      full_name = coalesce(nullif(full_name, ''), clean_username),
      role = 'admin',
      updated_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Profile was not created yet; try again';
  end if;
  return true;
end;
$$;

revoke execute on function public.claim_first_admin(text) from public;
grant execute on function public.claim_first_admin(text) to authenticated;