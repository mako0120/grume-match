create or replace function public.has_current_policy_acceptance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and (
      select count(*)
      from public.user_policy_acceptances upa
      where upa.user_id = auth.uid()
        and upa.version = '2026-10-13-alpha1'
        and upa.policy in ('terms', 'privacy', 'pr_guidelines')
    ) = 3;
$$;

revoke all on function public.has_current_policy_acceptance() from public;
grant execute on function public.has_current_policy_acceptance() to authenticated;
