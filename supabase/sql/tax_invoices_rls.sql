-- ============================================================
-- tax_invoices / tax_invoice_items RLS — admin + manager 전용
-- Supabase SQL Editor에서 직접 실행 (승우님). 이 파일은 실행되지 않은 초안임.
--
-- 배경:
--  · 최초 정책이 current_setting('request.headers')->>'x-user-role' 방식(옛 커스텀
--    헤더)이어서 Auth 세션 기반인 이 앱에서는 전부 차단됨 → 임시로
--    authenticated 전체 허용(using(true)/with check(true))으로 풀어둔 상태.
--  · 이 SQL은 임시 정책을 전부 걷어내고 admin+manager 만
--    select/insert/update/delete 가능하게 재설정한다.
--
-- 권한 판정 패턴: supply_records.sql 선택 블록과 동일 —
--   exists (select 1 from public.users where auth_id = auth.uid()
--           and role in ('admin','manager'))
--
-- ※ 전제 1: public.users 에 authenticated SELECT 정책이 있어야 함.
--   (RLS 정책 내 서브쿼리에도 users 테이블 RLS가 적용됨. 현재 앱이
--    authenticated 세션으로 users 를 정상 조회 중이므로 충족된 상태.)
-- ※ 전제 2: users.auth_id 가 auth.users.id(uuid)와 연결돼 있어야 함.
--   auth_id=null 인 계정(예: 서영우)은 admin/manager 여도 접근 불가 —
--   소급 복구(미완료 항목)와 별개로 이 정책은 정상 계정 기준으로 동작.
-- ============================================================


-- ── ① 기존 정책 일괄 제거 ─────────────────────────────────────
-- 임시 전체허용 정책 + 남아있을 수 있는 옛 x-user-role 헤더 정책을
-- 이름과 무관하게 두 테이블에서 전부 drop.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('tax_invoices', 'tax_invoice_items')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;


-- ── ② RLS 활성화 (이미 켜져 있어도 무해) ─────────────────────
alter table public.tax_invoices       enable row level security;
alter table public.tax_invoice_items  enable row level security;


-- ── ③ tax_invoices: admin+manager 전용 ───────────────────────
-- anon 은 정책 미부여로 자동 차단. authenticated 라도 admin/manager 가
-- 아니면 using/with check 이 false 라 차단됨.
create policy tax_invoices_select on public.tax_invoices
  for select to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoices_insert on public.tax_invoices
  for insert to authenticated
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoices_update on public.tax_invoices
  for update to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  )
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoices_delete on public.tax_invoices
  for delete to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );


-- ── ④ tax_invoice_items: admin+manager 전용 ──────────────────
create policy tax_invoice_items_select on public.tax_invoice_items
  for select to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoice_items_insert on public.tax_invoice_items
  for insert to authenticated
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoice_items_update on public.tax_invoice_items
  for update to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  )
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy tax_invoice_items_delete on public.tax_invoice_items
  for delete to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );


-- ── ⑤ 실행 후 검증 ───────────────────────────────────────────
-- 두 테이블에 각 4개(select/insert/update/delete), 총 8개 정책만 남아야 함.
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('tax_invoices', 'tax_invoice_items')
 order by tablename, cmd;

-- (선택) 동작 검증:
--  · admin/manager 계정으로 admin-perf 세금계산서 탭 → 목록 조회·업로드·삭제 정상
--  · staff/contractor 계정으로 같은 쿼리 → 0건 조회, insert/delete 에러(42501)
