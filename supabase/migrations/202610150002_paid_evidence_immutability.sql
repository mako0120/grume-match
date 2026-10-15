-- Keep final payout evidence immutable once a payment is marked paid.

create or replace function public.admin_record_payment_status(
  p_payment_id uuid,
  p_status public.payment_status,
  p_transfer_reference text default null,
  p_transfer_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'paid' then
    raise exception 'paid_payment_immutable' using errcode = 'P0001';
  end if;

  if p_status = 'paid'
     and nullif(trim(coalesce(p_transfer_reference, '')), '') is null then
    raise exception 'transfer_reference_required' using errcode = 'P0001';
  end if;

  perform public.admin_update_payment_status(p_payment_id, p_status);

  update public.payments
  set
    transfer_reference = case
      when p_status = 'paid'
        then trim(p_transfer_reference)
      else coalesce(nullif(trim(coalesce(p_transfer_reference, '')), ''), transfer_reference)
    end,
    transfer_note = coalesce(
      nullif(trim(coalesce(p_transfer_note, '')), ''),
      transfer_note
    ),
    transfer_recorded_at = case
      when p_status = 'paid' then now()
      else transfer_recorded_at
    end
  where id = p_payment_id;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  )
  values(
    auth.uid(),
    'admin',
    'payment.transfer_recorded',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'status', v_payment.status,
      'transfer_reference', v_payment.transfer_reference
    ),
    jsonb_build_object(
      'status', p_status,
      'transfer_reference', nullif(trim(coalesce(p_transfer_reference, '')), ''),
      'note', nullif(trim(coalesce(p_transfer_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.admin_record_payment_status(
  uuid,
  public.payment_status,
  text,
  text
) from public;

grant execute on function public.admin_record_payment_status(
  uuid,
  public.payment_status,
  text,
  text
) to authenticated;
