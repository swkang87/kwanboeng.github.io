-- 13 적용 — 급여명세서 모듈 신규 DB (payroll_*)
-- 작성 2026-09-29 · 급여명세서 모듈 재구축 2단계
--
-- 영향 범위 (신규 생성만, 기존 테이블 무변경):
--   · 테이블 6개: payroll_items / payroll_employees / payroll_runs /
--                 payroll_slips / payroll_slip_lines / payroll_mail_logs
--   · 함수 4개 (SECURITY DEFINER, search_path 고정):
--       payroll_is_admin / payroll_my_employee_ids / payroll_run_is_published / payroll_run_is_draft
--   · RLS 정책, 권한(GRANT/REVOKE), 초기 항목 20건(지급 13 / 공제 7)
-- 권한 원칙: 급여는 admin 전용. 직원(admin 외, contractor 제외)은
--   본인 + 지급용(pay) + 확정(confirmed) 명세서만 조회. 쓰기 불가.
-- 되돌리기: 14_payroll_rollback.sql (테이블은 DROP 하지 않고 backup 스키마로 이동)

begin;

-- ── 1. 테이블 ───────────────────────────────────────────────

create table public.payroll_items (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('earning','deduction')),
  name            text not null check (length(btrim(name)) > 0),
  sort_order      integer not null default 0,
  default_method  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (kind, name)
);

-- 계정 연결(user_id) 대상자는 이름·생년월일·입사일을 users 에서 읽는다(중복 저장 금지).
-- 계정 없는 대상자만 여기에 이름·생년월일·입사일을 직접 저장한다.
create table public.payroll_employees (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references public.users(id) on delete restrict,
  name            text,
  birth_date      date,
  hire_date       date,
  dept_label      text,
  position_label  text,
  employee_no     text,
  notify_email    text,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payroll_employees_identity_chk check (
       (user_id is null     and name is not null and length(btrim(name)) > 0)
    or (user_id is not null and name is null and birth_date is null and hire_date is null)
  )
);

-- revision: 확정할 때마다 +1 (화면에서 증가). 메일 로그의 revision 과 비교해
--           "이미 발송된 확정본인지 / 재확정본인지"를 판별한다.
create table public.payroll_runs (
  id              uuid primary key default gen_random_uuid(),
  period          text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  run_type        text not null check (run_type in ('report','pay')),
  pay_date        date,
  status          text not null default 'draft' check (status in ('draft','confirmed')),
  confirmed_at    timestamptz,
  confirmed_by    uuid references public.users(id) on delete set null,
  revision        integer not null default 0 check (revision >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (period, run_type),
  constraint payroll_runs_confirm_chk check (status = 'draft' or confirmed_at is not null)
);

-- *_snap: 명세서 발행 시점 기록(이후 부서·직급 변경과 무관하게 과거 명세서 유지)
create table public.payroll_slips (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id        uuid not null references public.payroll_employees(id) on delete restrict,
  name_snap          text,
  birth_date_snap    date,
  hire_date_snap     date,
  dept_snap          text,
  position_snap      text,
  employee_no_snap   text,
  total_earning      bigint not null default 0,
  total_deduction    bigint not null default 0,
  net_pay            bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (run_id, employee_id),
  constraint payroll_slips_net_chk check (net_pay = total_earning - total_deduction)
);
create index payroll_slips_employee_idx on public.payroll_slips(employee_id);

create table public.payroll_slip_lines (
  id           uuid primary key default gen_random_uuid(),
  slip_id      uuid not null references public.payroll_slips(id) on delete cascade,
  item_id      uuid references public.payroll_items(id) on delete set null,
  item_name    text not null,
  item_kind    text not null check (item_kind in ('earning','deduction')),
  sort_order   integer not null default 0,
  amount       bigint not null default 0,
  method       text,
  created_at   timestamptz not null default now(),
  unique (slip_id, item_id)
);

-- 발송 1회 = 1행 (이력 누적). kind: initial 최초 / revised 수정본 재발송.
-- run 삭제는 restrict — 발송 이력이 있는 묶음은 지울 수 없다.
create table public.payroll_mail_logs (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.payroll_runs(id) on delete restrict,
  employee_id         uuid not null references public.payroll_employees(id) on delete restrict,
  email               text not null,
  kind                text not null default 'initial' check (kind in ('initial','revised')),
  revision            integer not null default 0,
  status              text not null check (status in ('sent','failed')),
  error               text,
  provider_message_id text,
  sent_by             uuid references public.users(id) on delete set null,
  sent_at             timestamptz not null default now()
);
create index payroll_mail_logs_run_idx on public.payroll_mail_logs(run_id, employee_id, sent_at desc);

-- ── 2. 보조 함수 (RLS 상호참조 재귀 방지 + contractor 차단) ─────────

create function public.payroll_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.get_my_role() = 'admin', false)
$$;

create function public.payroll_my_employee_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id
    from public.payroll_employees e
    join public.users u on u.id = e.user_id
   where u.auth_id = auth.uid()
     and u.role <> 'contractor'
$$;

create function public.payroll_run_is_published(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payroll_runs r
                  where r.id = p_run and r.run_type = 'pay' and r.status = 'confirmed')
$$;

create function public.payroll_run_is_draft(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payroll_runs r where r.id = p_run and r.status = 'draft')
$$;

revoke all on function public.payroll_is_admin()               from public, anon;
revoke all on function public.payroll_my_employee_ids()        from public, anon;
revoke all on function public.payroll_run_is_published(uuid)   from public, anon;
revoke all on function public.payroll_run_is_draft(uuid)       from public, anon;
grant execute on function public.payroll_is_admin()             to authenticated;
grant execute on function public.payroll_my_employee_ids()      to authenticated;
grant execute on function public.payroll_run_is_published(uuid) to authenticated;
grant execute on function public.payroll_run_is_draft(uuid)     to authenticated;

-- ── 3. 권한 (anon 전면 회수, authenticated 는 RLS 로 제한) ───────────

revoke all on public.payroll_items, public.payroll_employees, public.payroll_runs,
              public.payroll_slips, public.payroll_slip_lines, public.payroll_mail_logs
  from anon, authenticated;
grant select, insert, update, delete on public.payroll_items, public.payroll_employees,
  public.payroll_runs, public.payroll_slips, public.payroll_slip_lines to authenticated;
grant select on public.payroll_mail_logs to authenticated;   -- 쓰기는 Edge Function(service_role) 전용

alter table public.payroll_items      enable row level security;
alter table public.payroll_employees  enable row level security;
alter table public.payroll_runs       enable row level security;
alter table public.payroll_slips      enable row level security;
alter table public.payroll_slip_lines enable row level security;
alter table public.payroll_mail_logs  enable row level security;

-- ── 4. RLS 정책 ────────────────────────────────────────────

-- 항목·대상자: admin 전용
create policy payroll_items_admin on public.payroll_items
  for all to authenticated using (public.payroll_is_admin()) with check (public.payroll_is_admin());
create policy payroll_employees_admin on public.payroll_employees
  for all to authenticated using (public.payroll_is_admin()) with check (public.payroll_is_admin());

-- 묶음: admin 조회·생성·수정, 삭제는 작성중만 / 직원은 본인 명세서가 있는 공개 묶음만 조회
create policy payroll_runs_admin_select on public.payroll_runs
  for select to authenticated using (public.payroll_is_admin());
create policy payroll_runs_admin_insert on public.payroll_runs
  for insert to authenticated with check (public.payroll_is_admin());
create policy payroll_runs_admin_update on public.payroll_runs
  for update to authenticated using (public.payroll_is_admin()) with check (public.payroll_is_admin());
create policy payroll_runs_admin_delete on public.payroll_runs
  for delete to authenticated using (public.payroll_is_admin() and status = 'draft');
create policy payroll_runs_employee_select on public.payroll_runs
  for select to authenticated using (
    run_type = 'pay' and status = 'confirmed'
    and exists (select 1 from public.payroll_slips s
                 where s.run_id = payroll_runs.id
                   and s.employee_id in (select public.payroll_my_employee_ids()))
  );

-- 명세서: admin 조회, 쓰기는 작성중 묶음만 / 직원은 본인 + 공개 묶음만 조회
create policy payroll_slips_admin_select on public.payroll_slips
  for select to authenticated using (public.payroll_is_admin());
create policy payroll_slips_admin_insert on public.payroll_slips
  for insert to authenticated with check (public.payroll_is_admin() and public.payroll_run_is_draft(run_id));
create policy payroll_slips_admin_update on public.payroll_slips
  for update to authenticated
  using      (public.payroll_is_admin() and public.payroll_run_is_draft(run_id))
  with check (public.payroll_is_admin() and public.payroll_run_is_draft(run_id));
create policy payroll_slips_admin_delete on public.payroll_slips
  for delete to authenticated using (public.payroll_is_admin() and public.payroll_run_is_draft(run_id));
create policy payroll_slips_employee_select on public.payroll_slips
  for select to authenticated using (
    employee_id in (select public.payroll_my_employee_ids())
    and public.payroll_run_is_published(run_id)
  );

-- 항목별 금액: 명세서 조회 권한을 그대로 따름(slips RLS 경유) / 쓰기는 admin + 작성중 묶음만
create policy payroll_lines_select on public.payroll_slip_lines
  for select to authenticated using (
    exists (select 1 from public.payroll_slips s where s.id = payroll_slip_lines.slip_id)
  );
create policy payroll_lines_admin_insert on public.payroll_slip_lines
  for insert to authenticated with check (
    public.payroll_is_admin()
    and exists (select 1 from public.payroll_slips s
                 where s.id = payroll_slip_lines.slip_id and public.payroll_run_is_draft(s.run_id))
  );
create policy payroll_lines_admin_update on public.payroll_slip_lines
  for update to authenticated
  using (
    public.payroll_is_admin()
    and exists (select 1 from public.payroll_slips s
                 where s.id = payroll_slip_lines.slip_id and public.payroll_run_is_draft(s.run_id))
  )
  with check (
    public.payroll_is_admin()
    and exists (select 1 from public.payroll_slips s
                 where s.id = payroll_slip_lines.slip_id and public.payroll_run_is_draft(s.run_id))
  );
create policy payroll_lines_admin_delete on public.payroll_slip_lines
  for delete to authenticated using (
    public.payroll_is_admin()
    and exists (select 1 from public.payroll_slips s
                 where s.id = payroll_slip_lines.slip_id and public.payroll_run_is_draft(s.run_id))
  );

-- 발송 로그: admin 조회만
create policy payroll_mail_logs_admin_select on public.payroll_mail_logs
  for select to authenticated using (public.payroll_is_admin());

-- ── 5. 초기 항목 ────────────────────────────────────────────

insert into public.payroll_items (kind, name, sort_order) values
  ('earning','기본급',1), ('earning','차량유지비',2), ('earning','차량지원비',3), ('earning','판공비',4),
  ('earning','가족수당',5), ('earning','임원수당',6), ('earning','연장근로수당',7), ('earning','토목기사수당',8),
  ('earning','기술수당',9), ('earning','보고회수당',10), ('earning','자격수당',11), ('earning','업무추진비',12),
  ('earning','측량수당',13),
  ('deduction','소득세',1), ('deduction','지방소득세',2), ('deduction','건강보험',3), ('deduction','장기요양보험',4),
  ('deduction','국민연금',5), ('deduction','고용보험',6), ('deduction','퇴직금',7);

commit;
