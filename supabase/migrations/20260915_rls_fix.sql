-- ============================================================
-- 20260915_rls_fix.sql — RLS 보안 구멍 차단 (A 묶음)
--
-- ※ 이 파일은 자동 실행되지 않는다. Supabase SQL Editor에서
--   승우님이 섹션 순서대로 직접 실행한다 (0 → 1 → 2 → 3 → 4).
-- ※ 섹션 0 의 진단 쿼리를 먼저 눈으로 확인한 뒤 나머지를 실행할 것.
-- 권한 판정 패턴: supply_records.sql / tax_invoices_rls.sql 과 동일 계열.
--   기존 파일은 exists(select 1 from users where auth_id=auth.uid() ...) 인라인,
--   이 파일은 get_my_role() / get_my_user_id() / is_admin_team() 헬퍼 사용.
-- ============================================================


-- ============================================================
-- 섹션 0 — 사전 확인 + 헬퍼 생성
-- 위험도: 없음 (진단) / 낮음 (함수 생성)
-- 실행 후 확인할 화면: 없음. 쿼리 결과만 눈으로 확인.
-- ============================================================

-- 0-1. get_my_role / get_my_user_id / get_my_team_name 이 SECURITY DEFINER 인지 확인.
-- 아니면 users 정책에서 무한 재귀가 발생하므로 아래를 진행하기 전에 반드시 확인할 것.
-- security_definer 가 하나라도 false 면 여기서 멈추고 함수를 먼저 고칠 것.
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_my_role','get_my_user_id','get_my_team_name');

-- 0-2. get_my_user_id() 가 무엇을 반환하는지 확인.
-- 이 파일의 정책들은 get_my_user_id() = public.users.id (uuid) 를 전제로 한다.
-- auth.uid() 를 그대로 돌려주는 함수라면 아래 user_id 비교가 전부 false 가 되어
-- 본인 데이터까지 막힌다. 반환값이 users.id 가 맞는지 정의를 확인할 것.
select p.proname,
       pg_get_function_result(p.oid) as returns,
       pg_get_functiondef(p.oid)     as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_my_role','get_my_user_id');

-- 0-3. 이번에 건드릴 테이블들의 현재 정책 스냅샷 (변경 전 기록용).
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'account_book','project_members','admin_work_logs',
    'salary_details','salary_items','salary_members','salary_slips',
    'supply_records','projects','weekly_reports','project_events','change_logs','users'
  )
order by tablename, cmd, policyname;


-- 0-4. 관리팀 판별 헬퍼. 팀명 하드코딩을 한 곳으로 모으기 위함이다.
-- security definer 라 users/teams 의 RLS 를 타지 않는다 → 정책 안에서 써도 재귀 없음.
-- 팀명을 바꿀 때는 이 함수 하나만 고치면 된다 (config.js 의 ADMIN_TEAM_NAME 과 값 일치 유지).
create or replace function public.is_admin_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from users u join teams t on t.id = u.team_id
    where u.auth_id = auth.uid() and t.name = '관리팀'
  );
$fn$;


-- ============================================================
-- 섹션 1 — 🔴 긴급 (anon 노출)
-- 위험도: 높음. 무인증 공개 상태인 테이블을 닫는다.
-- 실행 후 확인할 화면:
--   · admin-account.html (관리포털 → 장부) — 목록 조회/등록/수정/삭제
--   · project.html 프로젝트 상세(팀원 목록 표시) / 관리 탭 → 인원배정
--   · admin-worklog.html 업무일지 저장
-- ============================================================

-- ── 1-1. account_book ────────────────────────────────────────
-- 현재: SELECT/INSERT/UPDATE/DELETE 전부 {public} + true.
--       평문 비밀번호가 담긴 테이블이 무인증 공개 상태다.
-- 변경: admin 또는 관리팀만. anon 은 정책 미부여로 자동 차단.
-- 화면 권한과 일치: admin-account.html 은 role='admin' 이거나
--   팀명 = ADMIN_TEAM_NAME 일 때만 hasAccess 를 준다(767·772행).

-- 이름을 알고 있는 4개를 먼저 drop.
drop policy if exists account_book_select on public.account_book;
drop policy if exists account_book_insert on public.account_book;
drop policy if exists account_book_update on public.account_book;
drop policy if exists account_book_delete on public.account_book;

-- 이름이 다른 잔여 정책이 하나라도 남으면(정책은 OR 로 합쳐진다) 봉쇄가 무효화된다.
-- account_book 은 최우선 위험 테이블이므로 남은 정책을 전부 제거한다.
do $blk$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'account_book'
  loop
    execute format('drop policy %I on public.account_book', p.policyname);
  end loop;
end $blk$;

alter table public.account_book enable row level security;

create policy account_book_admin_all on public.account_book
  for all to authenticated
  using      (get_my_role() = 'admin' or is_admin_team())
  with check (get_my_role() = 'admin' or is_admin_team());


-- ── 1-2. project_members ─────────────────────────────────────
-- 현재: SELECT 가 {public} + true. 쓰기 정책은 아예 없음
--       (RLS 가 켜져 있으면 쓰기는 지금도 전부 차단되고 있었다는 뜻).
-- 변경: 읽기는 로그인 사용자, 쓰기는 admin/manager/관리팀.
drop policy if exists project_members_select on public.project_members;
drop policy if exists project_members_insert on public.project_members;
drop policy if exists project_members_update on public.project_members;
drop policy if exists project_members_delete on public.project_members;

alter table public.project_members enable row level security;

create policy project_members_select on public.project_members
  for select to authenticated
  using (auth.uid() is not null);

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (
    get_my_role() in ('admin','manager') or is_admin_team()
    or exists (select 1 from projects p
                where p.id = project_members.project_id and p.pm_id = get_my_user_id())
  );

create policy project_members_update on public.project_members
  for update to authenticated
  using (
    get_my_role() in ('admin','manager') or is_admin_team()
    or exists (select 1 from projects p
                where p.id = project_members.project_id and p.pm_id = get_my_user_id())
  )
  with check (
    get_my_role() in ('admin','manager') or is_admin_team()
    or exists (select 1 from projects p
                where p.id = project_members.project_id and p.pm_id = get_my_user_id())
  );

create policy project_members_delete on public.project_members
  for delete to authenticated
  using (
    get_my_role() in ('admin','manager') or is_admin_team()
    or exists (select 1 from projects p
                where p.id = project_members.project_id and p.pm_id = get_my_user_id())
  );

-- pm_id 조건을 넣은 이유 — project.html EditProjectModal(2314·2321행 addMember/
--   removeMember)은 "관리자 또는 project.pm_id === 본인" 이면 열린다(1796행).
--   즉 users.role 이 'member' 인 PM 도 팀원 추가/삭제 UI 에 도달한다.
--   admin/manager 만 허용하면 이 경로가 조용히 실패하므로(호출부가 error 를
--   확인하지 않는다) 해당 프로젝트의 PM 본인에게는 쓰기를 허용한다.
--   ※ pm_id 판정은 projects 테이블을 탄다. projects 의 SELECT 정책(2-6)이
--     로그인 사용자 전체 허용이므로 서브쿼리는 정상 동작한다.
--   ※ 호출부 자체의 에러 미확인(조용한 실패)은 B 묶음에서 별도 수정한다.

-- ── 1-3. admin_work_logs ─────────────────────────────────────
-- 현재: SELECT 는 정상. INSERT 가 {public} + true, UPDATE 가 {public} + true.
-- 변경: 본인 행만 작성, 수정은 본인 또는 admin/관리팀.
-- ※ SELECT 정책은 건드리지 않는다 (정상이라는 진단 결과에 따름).
-- ※ admin-worklog.html 614행은 upsert(onConflict:'user_id,log_date') 이므로
--   INSERT with check 와 UPDATE using/with check 가 모두 필요하다. 아래 둘로 충족.
--   payload 의 user_id 는 세션 사용자(user.id)라 get_my_user_id() 와 일치한다.
drop policy if exists admin_work_logs_insert on public.admin_work_logs;
drop policy if exists admin_work_logs_update on public.admin_work_logs;

-- 이름이 다른 INSERT/UPDATE/ALL 정책이 남아 있으면 무효화되므로 함께 제거.
-- (SELECT 전용 정책은 보존한다.)
do $blk$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'admin_work_logs'
              and cmd in ('INSERT','UPDATE','ALL')
  loop
    execute format('drop policy %I on public.admin_work_logs', p.policyname);
  end loop;
end $blk$;

alter table public.admin_work_logs enable row level security;

create policy admin_work_logs_insert on public.admin_work_logs
  for insert to authenticated
  with check (user_id = get_my_user_id());

create policy admin_work_logs_update on public.admin_work_logs
  for update to authenticated
  using      (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team())
  with check (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team());

-- ※ 0-3 스냅샷 확인 결과 admin_work_logs 에 cmd='ALL' 정책은 없고 SELECT 전용
--   정책이 따로 있다. 위 do 블록은 INSERT/UPDATE 만 걷어내므로 조회는 영향 없다.


-- ============================================================
-- 섹션 2 — 🟡 로그인 사용자 전체 노출 (contractor 포함)
-- 위험도: 중간~높음. 기능 파손 가능성이 섹션 1 보다 크다.
-- 실행 후 확인할 화면:
--   · admin-salary.html (급여) — 목록/상세/저장
--   · worklog.html 비품관리 탭 — 목록/등록/수정/삭제
--   · project.html 전 화면 (조회·주간보고·주요공정·프로젝트 등록/수정/삭제)
--   · import_weekly.html 주간보고 일괄 등록
-- ============================================================

-- ── 2-1. salary_details ──────────────────────────────────────
-- 현재: authenticated 전원이 SELECT/INSERT/UPDATE/DELETE.
-- 변경: salary_id → salaries.user_id 조인으로 본인 것만. 쓰기는 admin/관리팀.
drop policy if exists salary_details_select on public.salary_details;
drop policy if exists salary_details_insert on public.salary_details;
drop policy if exists salary_details_update on public.salary_details;
drop policy if exists salary_details_delete on public.salary_details;

alter table public.salary_details enable row level security;

create policy salary_details_select on public.salary_details
  for select to authenticated
  using (
    get_my_role() = 'admin' or is_admin_team()
    or exists (select 1 from salaries s
                where s.id = salary_details.salary_id
                  and s.user_id = get_my_user_id())
  );

create policy salary_details_insert on public.salary_details
  for insert to authenticated
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_details_update on public.salary_details
  for update to authenticated
  using      (get_my_role() = 'admin' or is_admin_team())
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_details_delete on public.salary_details
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());

-- ※ 위 SELECT 서브쿼리는 salaries 테이블을 탄다. salaries 의 SELECT 정책이
--   본인 행을 막고 있으면 이 조건도 false 가 된다. salaries 정책은 이번
--   라운드 범위 밖이므로, 명세서 조회가 안 되면 salaries 부터 확인할 것.


-- ── 2-2. salary_items ────────────────────────────────────────
-- 급여 항목 마스터(type/label/order_no/active). 금액이 없으므로
-- SELECT 는 authenticated 유지, 쓰기만 제한.
drop policy if exists salary_items_select on public.salary_items;
drop policy if exists salary_items_insert on public.salary_items;
drop policy if exists salary_items_update on public.salary_items;
drop policy if exists salary_items_delete on public.salary_items;

alter table public.salary_items enable row level security;

create policy salary_items_select on public.salary_items
  for select to authenticated
  using (auth.uid() is not null);

create policy salary_items_insert on public.salary_items
  for insert to authenticated
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_items_update on public.salary_items
  for update to authenticated
  using      (get_my_role() = 'admin' or is_admin_team())
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_items_delete on public.salary_items
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());


-- ── 2-3. salary_members ──────────────────────────────────────
-- birth_date, hire_date 보유. 전 직원 생년월일이 열려 있다.
drop policy if exists salary_members_select on public.salary_members;
drop policy if exists salary_members_insert on public.salary_members;
drop policy if exists salary_members_update on public.salary_members;
drop policy if exists salary_members_delete on public.salary_members;
drop policy if exists salary_members_admin_all on public.salary_members;

alter table public.salary_members enable row level security;

create policy salary_members_admin_all on public.salary_members
  for all to authenticated
  using      (get_my_role() = 'admin' or is_admin_team())
  with check (get_my_role() = 'admin' or is_admin_team());


-- ── 2-4. salary_slips ────────────────────────────────────────
-- token 컬럼 보유. 토큰을 읽으면 slip.html 로 타인 명세서 열람이 가능하다.
--
-- slip.html 구조 확인 결과 — 적용해도 새로 깨지는 기능 없음:
--   · slip.html:250  supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
--     — 로그인/세션 없이 anon 키로만 만든 클라이언트다.
--   · slip.html:303~314  URL 쿼리스트링의 ?token= 값으로 salary_slips 를 조회하고,
--     이어서 salaries(326) / users(331, birth_date 포함) / salary_members(335) /
--     salary_items(341) / salary_details(343) 까지 전부 anon 으로 읽는다.
--   → 그러나 이 6개 테이블의 현재 SELECT 정책이 모두 auth.uid() is not null 이라
--     anon 토큰 링크는 이미 동작하지 않는 상태다. 아래로 좁혀도 새로 깨지는 기능은 없다.
--   ※ 토큰 링크 명세서를 되살리려면 RLS 완화가 아니라, Edge Function(service_role)
--     에서 토큰을 검증해 내려주는 방식으로 slip.html 을 고치는 것이 순서다.
--     anon 직접 조회로는 "토큰을 아는 사람만 열람"과 "RLS 봉쇄"를 동시에 만족시킬 수 없다.
drop policy if exists salary_slips_select on public.salary_slips;
drop policy if exists salary_slips_insert on public.salary_slips;
drop policy if exists salary_slips_update on public.salary_slips;
drop policy if exists salary_slips_delete on public.salary_slips;

alter table public.salary_slips enable row level security;

create policy salary_slips_select on public.salary_slips
  for select to authenticated
  using (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team());

create policy salary_slips_insert on public.salary_slips
  for insert to authenticated
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_slips_update on public.salary_slips
  for update to authenticated
  using      (get_my_role() = 'admin' or is_admin_team())
  with check (get_my_role() = 'admin' or is_admin_team());

create policy salary_slips_delete on public.salary_slips
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());

-- ── 2-5. supply_records ──────────────────────────────────────
-- 현재: {authenticated} 전부 true.
drop policy if exists supply_records_select on public.supply_records;
drop policy if exists supply_records_insert on public.supply_records;
drop policy if exists supply_records_update on public.supply_records;
drop policy if exists supply_records_delete on public.supply_records;

alter table public.supply_records enable row level security;

create policy supply_records_select on public.supply_records
  for select to authenticated
  using (auth.uid() is not null);

create policy supply_records_insert on public.supply_records
  for insert to authenticated
  with check (user_id = get_my_user_id());

create policy supply_records_update on public.supply_records
  for update to authenticated
  using      (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team())
  with check (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team());

create policy supply_records_delete on public.supply_records
  for delete to authenticated
  using (user_id = get_my_user_id() or get_my_role() = 'admin' or is_admin_team());

-- ※ SELECT 를 전원 공유로 둔 것은 supply_records.sql 의 원설계 그대로다
--   ("조회는 전체 허용, 수정/삭제만 행별 제어"). worklog.html SupplyView(1793행
--   loadRecords)가 사용자 필터 없이 전체 조회하므로 비품관리 목록 동작은 현행 유지된다.
--   이번 변경으로 닫히는 것은 ① anon 접근(to authenticated) ② 타인 user_id 로
--   등록하는 위장 INSERT ③ 타인 행 수정/삭제 세 가지다.

-- ── 2-6. projects / weekly_reports / project_events / change_logs ──
-- 현재: ALL + auth.uid() is not null → contractor 가 전체 삭제까지 가능.
-- 변경: DELETE 만 분리해 admin/관리팀으로 제한. SELECT/INSERT/UPDATE 는 현행 유지.
--       (기능 파손 위험을 줄이기 위한 최소 변경)

-- 이름을 알고 있는 *_write_auth (ALL) 정책 drop.
drop policy if exists projects_write_auth       on public.projects;
drop policy if exists weekly_reports_write_auth on public.weekly_reports;
drop policy if exists project_events_write_auth on public.project_events;
drop policy if exists change_logs_write_auth    on public.change_logs;

-- 이름이 다른 ALL 정책이 남으면 DELETE 제한이 무효화되므로 함께 제거.
-- (SELECT/INSERT/UPDATE 전용 정책은 보존 — 아래에서 새로 만드는 것과 OR 로 합쳐져 무해)
do $blk$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('projects','weekly_reports','project_events','change_logs')
              and cmd = 'ALL'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $blk$;

alter table public.projects       enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.project_events enable row level security;
alter table public.change_logs    enable row level security;

-- projects — INSERT/UPDATE 는 contractor 제외, DELETE 는 admin/관리팀.
-- ※ project.html 의 프로젝트 등록(CreateProjectForm)은 관리 탭(admin 전용)에 있고,
--   수정(EditProjectModal)은 admin 또는 PM 이 연다. PM 이 contractor 가 아닌 한 정상.
-- ※ import_weekly.html 의 projects insert/update(456·479행)도 로그인 사용자 기준이라
--   업로드 담당자가 contractor 만 아니면 영향 없음.
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;

create policy projects_select on public.projects
  for select to authenticated using (auth.uid() is not null);

create policy projects_insert on public.projects
  for insert to authenticated
  with check (auth.uid() is not null and get_my_role() <> 'contractor');

create policy projects_update on public.projects
  for update to authenticated
  using      (auth.uid() is not null and get_my_role() <> 'contractor')
  with check (auth.uid() is not null and get_my_role() <> 'contractor');

create policy projects_delete on public.projects
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());

-- weekly_reports — 주간보고 입력은 contractor 도 해야 하므로 쓰기 제한 없음.
drop policy if exists weekly_reports_select on public.weekly_reports;
drop policy if exists weekly_reports_insert on public.weekly_reports;
drop policy if exists weekly_reports_update on public.weekly_reports;
drop policy if exists weekly_reports_delete on public.weekly_reports;

create policy weekly_reports_select on public.weekly_reports
  for select to authenticated using (auth.uid() is not null);

create policy weekly_reports_insert on public.weekly_reports
  for insert to authenticated with check (auth.uid() is not null);

create policy weekly_reports_update on public.weekly_reports
  for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy weekly_reports_delete on public.weekly_reports
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());

-- project_events
drop policy if exists project_events_select on public.project_events;
drop policy if exists project_events_insert on public.project_events;
drop policy if exists project_events_update on public.project_events;
drop policy if exists project_events_delete on public.project_events;

create policy project_events_select on public.project_events
  for select to authenticated using (auth.uid() is not null);

create policy project_events_insert on public.project_events
  for insert to authenticated with check (auth.uid() is not null);

create policy project_events_update on public.project_events
  for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy project_events_delete on public.project_events
  for delete to authenticated
  using (
    get_my_role() = 'admin' or is_admin_team()
    or exists (select 1 from projects p
                where p.id = project_events.project_id and p.pm_id = get_my_user_id())
  );

-- change_logs
drop policy if exists change_logs_select on public.change_logs;
drop policy if exists change_logs_insert on public.change_logs;
drop policy if exists change_logs_update on public.change_logs;
drop policy if exists change_logs_delete on public.change_logs;

create policy change_logs_select on public.change_logs
  for select to authenticated using (auth.uid() is not null);

create policy change_logs_insert on public.change_logs
  for insert to authenticated with check (auth.uid() is not null);

create policy change_logs_update on public.change_logs
  for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy change_logs_delete on public.change_logs
  for delete to authenticated
  using (get_my_role() = 'admin' or is_admin_team());

-- ⚠️ project.html 3043~3047행(프로젝트 삭제)은 weekly_reports / project_events /
--   change_logs / projects 를 순서대로 delete 한다. 관리 탭(admin 전용) 경로라
--   위 DELETE 정책과 일치한다. 관리팀 계정으로도 동작하도록 is_admin_team() 을 포함했다.
-- ⚠️ project.html 2495행(오래된 change_logs 일괄 정리)도 같은 관리 탭 경로 — 동일.
-- ※ project_events_delete 에 pm_id 조건을 넣은 이유 — project.html 1728행
--   (주요공정 삭제)은 admin 또는 해당 프로젝트 PM 이 여는 화면이다(1793행).
--   admin/관리팀만 허용하면 PM 경로가 막히므로 projects.pm_id 보유자를 함께 허용한다.
--   project_events.project_id 컬럼 존재는 project.html 1742·2258·3044행에서 확인함.
--   ※ 3044행(프로젝트 일괄 삭제)도 project_id 로 delete 하므로 같은 조건을 통과한다.


-- ── 2-7. users — 이번 라운드에서는 변경하지 않음 ──────────────
-- SELECT 가 authenticated 전원이라 전 직원 전화번호가 노출된다.
-- 전화번호가 로그인 ID 이자 초기 비밀번호이므로 실질 위험이 크다.
-- 다만 앱 전반(project/leave/worklog/admin-*)이 이 테이블을 이름·역할 조회에
-- 쓰고, 위 정책들의 서브쿼리도 users 를 탄다. 지금 좁히면 광범위한 파손이
-- 예상되므로 B-4(최초 비밀번호 강제 변경)로 위험을 상쇄한다.
--
-- TODO(2단계): users 전체 SELECT → id/name/role/team_id/position 만 노출하는
-- users_public 뷰(security_invoker = on)로 이전하고, phone 조회는 admin 경로로 한정한다.


-- ============================================================
-- 섹션 3 — B 작업용 스키마 변경
-- 위험도: 낮음 (컬럼 추가, default false 라 기존 동작 무변경)
-- 실행 후 확인할 화면: 없음. B-4 구현 전까지는 어떤 화면도 이 값을 읽지 않는다.
-- ============================================================

alter table public.users add column if not exists must_change_pw boolean not null default false;

-- 전화번호를 초기 비밀번호로 쓴 계정을 일괄 플래그 (해시 비교 불가하므로 운영 판단으로 지정)
-- 사용자가 대상 범위를 확인한 뒤 주석을 해제하고 실행한다.
-- ※ 먼저 대상 건수를 확인할 것:
--   select role, count(*) from public.users group by role order by role;
-- update public.users set must_change_pw = true where role = 'contractor';


-- ============================================================
-- 섹션 4 — 적용 후 검증
-- 위험도: 없음 (조회)
-- 실행 후 확인할 화면: 없음. 결과 목록을 눈으로 확인.
-- ============================================================

-- 위험 정책 추출: anon/public 역할이거나 using/with check 가 true 인 정책.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
        roles::text[] && array['anon','public']
     or coalesce(qual, '')       = 'true'
     or coalesce(with_check, '') = 'true'
  )
order by tablename, cmd, policyname;

-- 기대값: 이 파일에서 닫은 12개 테이블이 결과에 없을 것.
--   · account_book / project_members / admin_work_logs
--   · salary_details / salary_items / salary_members / salary_slips / supply_records
--   · projects / weekly_reports / project_events / change_logs
-- 남아 있어도 정상인 것:
--   · users (2-7 — 이번 라운드 제외, 2단계에서 처리)
--   · 이 파일 범위 밖 테이블 (teams, shared_todos, salaries 등) — 별도 라운드에서 판단
-- ※ 'auth.uid() IS NOT NULL' 인 정책은 위 조건에 걸리지 않는다(문자열이 'true' 가 아님).
--   그래도 anon 차단은 to authenticated 로 이루어지므로 의도대로다.

-- RLS 자체가 꺼진 테이블이 없는지도 함께 확인.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
