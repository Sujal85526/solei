-- A signed-in staff member can always read their own role (needed before MFA is completed,
-- so the app knows whether to ask for TOTP). Other roles stay hidden until is_staff().
create policy "read own role" on public.roles
  for select to authenticated
  using (id in (select sp.role_id from public.staff_profiles sp where sp.user_id = auth.uid()));
