-- Allow users to mark only their own notifications as read.

create policy "notifications update own"
on public.notifications for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
