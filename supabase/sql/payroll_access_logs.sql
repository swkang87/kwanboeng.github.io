-- 128 급여 열람 기록(감사 로그) — 적용 (2026-10-27)
-- 영향 범위(새로 만드는 것만 — 기존 표·정책·함수는 건드리지 않는다):
--   표   public.payroll_access_logs        : 급여 열람·내려받기·메일 일괄 발송·직원 본인 명세서 열람 기록
--   함수 public.payroll_access_log_fill()  : BEFORE INSERT 트리거. 행위자·이름·일시를 DB 가 채운다(클라이언트 값 무시),
--                                            대상 이름을 채우고, 행동별로 할 수 있는 사람인지 확인한다.
--   함수 public.payroll_access_log_list(..): 열람 기록 화면용. admin 전용. 아래 세 곳을 합쳐 돌려준다.
--          ① payroll_access_logs
--          ② payroll_audit_logs  의 payroll_runs 상태 변경(확정 / 확정 취소) — 이미 트리거로 남는 기록이라 다시 쓰지 않는다
--          ③ payroll_transfer_exports(송금내역 내려받기)               — 이미 함수가 남기는 기록이라 다시 쓰지 않는다
--   트리거 수정·삭제·비우기 금지(기존 payroll_audit_block 재사용).
-- 권한: 추가 = 로그인 사용자 본인 명의(트리거가 강제), 조회 = admin(활성), 수정·삭제 = 없음(정책 없음 + 권한 회수 + 트리거).
-- 팀명 리터럴 없음. SECURITY DEFINER 함수는 search_path 고정.
begin;

create table public.payroll_access_logs (
  id                 bigint generated always as identity primary key,
  at                 timestamptz not null default now(),
  actor_user_id      uuid not null,
  actor_name         text,
  action             text not null
                     check (action in ('run_view', 'slip_view', 'excel_download', 'mail_send', 'self_slip_view')),
  target_employee_id uuid,
  target_name        text,
  period             text check (period is null or period ~ '^[0-9]{4}(-[0-9]{2})?$'),
  run_type           text check (run_type is null or run_type in ('pay', 'report')),
  detail             jsonb not null default '{}'::jsonb
                     check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 2000)
);
comment on table public.payroll_access_logs is
  '급여 열람 기록(감사 로그). 행위자·일시는 트리거가 채운다. 조회 admin 전용, 수정·삭제 불가, 자동 삭제 없음.';
create index payroll_access_logs_at_idx on public.payroll_access_logs (at desc, id desc);

create or replace function public.payroll_access_log_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  select u.id, u.name into v_id, v_name from public.users u where u.auth_id = auth.uid() limit 1;
  if v_id is null then
    raise exception '로그인 사용자만 기록할 수 있습니다.' using errcode = '42501';
  end if;
  -- 클라이언트가 보낸 값은 버리고 DB 값으로 채운다(다른 사람 이름·다른 시각으로 기록 위조 불가)
  new.actor_user_id := v_id;
  new.actor_name    := v_name;
  new.at            := now();

  if new.action = 'self_slip_view' then
    if new.target_employee_id is null
       or new.target_employee_id not in (select public.payroll_my_employee_ids()) then
      raise exception '본인 명세서만 기록할 수 있습니다.' using errcode = '42501';
    end if;
  elsif not coalesce(public.payroll_is_admin(), false) then
    raise exception '급여 관리 권한이 필요합니다.' using errcode = '42501';
  end if;

  if new.target_employee_id is not null then
    select coalesce(e.name, u.name) into new.target_name
      from public.payroll_employees e left join public.users u on u.id = e.user_id
     where e.id = new.target_employee_id;
    if not found then
      raise exception '없는 대상자입니다.' using errcode = '22023';
    end if;
  else
    new.target_name := null;
  end if;
  return new;
end
$$;
revoke all on function public.payroll_access_log_fill() from public, anon, authenticated;

create trigger payroll_access_logs_fill
  before insert on public.payroll_access_logs
  for each row execute function public.payroll_access_log_fill();
create trigger payroll_access_logs_no_update_delete
  before update or delete on public.payroll_access_logs
  for each row execute function public.payroll_audit_block();
create trigger payroll_access_logs_no_truncate
  before truncate on public.payroll_access_logs
  for each statement execute function public.payroll_audit_block();

alter table public.payroll_access_logs enable row level security;

create policy payroll_access_logs_insert on public.payroll_access_logs
  for insert to authenticated
  with check (actor_user_id = (select public.get_my_user_id()));
create policy payroll_access_logs_select on public.payroll_access_logs
  for select to authenticated
  using ((select public.is_active_user()) and (select public.get_my_role()) = 'admin');

revoke all on table public.payroll_access_logs from public, anon, authenticated;
grant select, insert on table public.payroll_access_logs to authenticated;

-- 열람 기록 화면: 세 곳을 합쳐 최신순. 필터는 모두 선택(null = 전체). admin(활성) 외 42501.
create or replace function public.payroll_access_log_list(
  p_from   timestamptz default null,
  p_to     timestamptz default null,
  p_actor  uuid        default null,
  p_target uuid        default null,
  p_action text        default null)
returns table (
  src text, id bigint, at timestamptz, actor_user_id uuid, actor_name text, action text,
  target_employee_id uuid, target_name text, period text, run_type text, detail jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (coalesce(public.is_active_user(), false) and public.get_my_role() = 'admin') then
    raise exception '관리자만 볼 수 있습니다.' using errcode = '42501';
  end if;
  return query
  select * from (
    select 'access'::text, l.id, l.at, l.actor_user_id, l.actor_name, l.action,
           l.target_employee_id, l.target_name, l.period, l.run_type, l.detail
      from public.payroll_access_logs l
    union all
    select 'audit'::text, a.id, a.changed_at, a.actor_user_id, a.actor_name,
           case when a.new_data->>'status' = 'confirmed' then 'confirm' else 'unconfirm' end,
           null::uuid, null::text, a.period, a.run_type,
           jsonb_strip_nulls(jsonb_build_object('revision', a.new_data->'revision'))
      from public.payroll_audit_logs a
     where a.table_name = 'payroll_runs' and a.op = 'UPDATE' and a.new_data ? 'status'
    union all
    select 'transfer'::text, t.id, t.exported_at, t.actor_user_id, t.actor_name, 'excel_download',
           null::uuid, null::text, t.period, 'pay'::text,
           jsonb_build_object('kind', 'transfer', 'format', t.format, 'rows', t.row_count)
      from public.payroll_transfer_exports t
  ) x (src, id, at, actor_user_id, actor_name, action, target_employee_id, target_name, period, run_type, detail)
  where (p_from is null or x.at >= p_from)
    and (p_to is null or x.at < p_to)
    and (p_actor is null or x.actor_user_id = p_actor)
    and (p_target is null or x.target_employee_id = p_target)
    and (p_action is null or x.action = p_action)
  order by x.at desc, x.src, x.id desc;
end
$$;
revoke all on function public.payroll_access_log_list(timestamptz, timestamptz, uuid, uuid, text) from public, anon;
grant execute on function public.payroll_access_log_list(timestamptz, timestamptz, uuid, uuid, text) to authenticated;

commit;
