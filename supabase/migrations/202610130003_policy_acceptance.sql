-- Versioned policy acceptance required before using the commercial alpha.

create table if not exists public.user_policy_acceptances (
  user_id uuid not null references public.users(id) on delete cascade,
  policy text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy, version),
  check (policy in ('terms', 'privacy', 'pr_guidelines'))
);

alter table public.user_policy_acceptances enable row level security;

create policy "users read own policy acceptances"
on public.user_policy_acceptances for select
using (user_id = auth.uid() or public.is_admin());


create policy "users create own policy acceptances"
on public.user_policy_acceptances for insert
with check (user_id = auth.uid());
