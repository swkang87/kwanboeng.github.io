-- 비품관리(worklog.html SupplyView)용 테이블
-- Supabase SQL Editor에서 직접 실행 (배포/실행은 승우님)
-- ※ user_id 는 public.users(id)(uuid) 참조 가정. users.id 가 uuid가 아니면 타입을 맞출 것.

create table if not exists public.supply_records (
  id             uuid primary key default gen_random_uuid(),
  record_date    date        not null,
  payment_method text        not null,
  item_name      text        not null,
  quantity       integer     not null default 1,
  total_amount   numeric     not null default 0,
  user_id        uuid        references public.users(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists supply_records_date_idx   on public.supply_records (record_date desc);
create index if not exists supply_records_method_idx on public.supply_records (payment_method);
create index if not exists supply_records_user_idx   on public.supply_records (user_id);

alter table public.supply_records enable row level security;

-- 앱은 클라이언트에서 role 기반으로 행별 수정/삭제를 제어합니다
-- (본인 행 + role=admin/manager 는 전체). 아래는 로그인(authenticated) 전체 허용 —
-- 기존 테이블(shared_todos 등) 패턴과 동일. anon 은 정책 미부여로 자동 차단.
drop policy if exists supply_records_select on public.supply_records;
create policy supply_records_select on public.supply_records
  for select to authenticated using (true);

drop policy if exists supply_records_insert on public.supply_records;
create policy supply_records_insert on public.supply_records
  for insert to authenticated with check (true);

drop policy if exists supply_records_update on public.supply_records;
create policy supply_records_update on public.supply_records
  for update to authenticated using (true) with check (true);

drop policy if exists supply_records_delete on public.supply_records;
create policy supply_records_delete on public.supply_records
  for delete to authenticated using (true);

-- ── (선택) DB 레벨에서도 행별 권한을 강제하려면 위 update/delete 대신 아래 사용 ──
-- 본인 행 또는 admin/manager 만 수정/삭제 허용:
--
-- drop policy if exists supply_records_update on public.supply_records;
-- create policy supply_records_update on public.supply_records
--   for update to authenticated
--   using (
--     user_id in (select id from public.users where auth_id = auth.uid())
--     or exists (select 1 from public.users where auth_id = auth.uid() and role in ('admin','manager'))
--   );
--
-- drop policy if exists supply_records_delete on public.supply_records;
-- create policy supply_records_delete on public.supply_records
--   for delete to authenticated
--   using (
--     user_id in (select id from public.users where auth_id = auth.uid())
--     or exists (select 1 from public.users where auth_id = auth.uid() and role in ('admin','manager'))
--   );
