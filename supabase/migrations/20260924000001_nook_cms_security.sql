-- Security hardening for the CMS helper functions.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter function public.set_updated_at() set search_path = public;
revoke execute on function public.handle_new_user() from public;