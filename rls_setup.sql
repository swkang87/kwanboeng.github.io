-- ================================================================
-- RLS (Row Level Security) 설정 스크립트
-- ================================================================
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 전체 복사 후 Run
--
-- 작동 원리:
--   프론트엔드에서 모든 요청 헤더에 x-user-id, x-user-role을 포함.
--   RLS 정책이 이 헤더를 읽어 접근 권한을 판단합니다.
--
-- ⚠️  주의: 비밀번호 해싱 작업(묶음 B) 완료 전까지
--   users 테이블 SELECT는 전체 허용 상태 유지 (로그인에 필요)
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- STEP 1. 헬퍼 함수 등록
--   요청 헤더에서 현재 사용자 정보를 읽는 공통 함수
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_request_user_id()
RETURNS text AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-user-id',
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_request_user_role()
RETURNS text AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-user-role',
    ''
  );
$$ LANGUAGE sql STABLE;


-- ──────────────────────────────────────────────────────────────
-- STEP 2. users 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all"    ON users;
DROP POLICY IF EXISTS "users_update_own"    ON users;
DROP POLICY IF EXISTS "users_insert_admin"  ON users;
DROP POLICY IF EXISTS "users_delete_admin"  ON users;

-- 로그인 시 phone+password 조회가 필요하므로 SELECT는 전체 허용
-- (추후 비밀번호 해싱 + 별도 login 함수 구현 후 제한 가능)
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

-- 본인 정보 또는 admin만 수정 가능
-- 단, 본인이 자기 role/team_id/total_days를 임의로 변경하는 것은 차단
-- (이런 필드들은 admin만 변경 가능, 본인은 password/name 정도만 변경 가능)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (
    id::text = get_request_user_id()
    OR get_request_user_role() = 'admin'
  )
  WITH CHECK (
    -- admin은 무엇이든 변경 가능
    get_request_user_role() = 'admin'
    OR (
      -- 본인은 변경 가능하되, 민감 필드(role, team_id, total_days)는
      -- 기존 값과 동일해야 함 → 본인이 자기를 admin으로 승격 불가
      id::text = get_request_user_id()
      AND role        = (SELECT role        FROM users WHERE id::text = get_request_user_id())
      AND team_id IS NOT DISTINCT FROM (SELECT team_id FROM users WHERE id::text = get_request_user_id())
      AND total_days  = (SELECT total_days  FROM users WHERE id::text = get_request_user_id())
    )
  );

-- admin만 직원 등록
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (
    get_request_user_role() = 'admin'
  );

-- admin만 직원 삭제
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (
    get_request_user_role() = 'admin'
  );


-- ──────────────────────────────────────────────────────────────
-- STEP 3. teams 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_all"  ON teams;
DROP POLICY IF EXISTS "teams_write_admin" ON teams;

-- 팀 목록은 전체 조회 허용
CREATE POLICY "teams_select_all" ON teams
  FOR SELECT USING (true);

-- admin만 팀 생성/수정/삭제
CREATE POLICY "teams_write_admin" ON teams
  FOR ALL
  USING (get_request_user_role() = 'admin')
  WITH CHECK (get_request_user_role() = 'admin');


-- ──────────────────────────────────────────────────────────────
-- STEP 4. leave_requests 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_select"               ON leave_requests;
DROP POLICY IF EXISTS "leave_insert_own"           ON leave_requests;
DROP POLICY IF EXISTS "leave_update_manager_admin" ON leave_requests;

-- 본인 신청 내역 + 팀장/admin은 전체 조회
CREATE POLICY "leave_select" ON leave_requests
  FOR SELECT USING (
    user_id::text = get_request_user_id()
    OR get_request_user_role() IN ('admin', 'manager')
  );

-- 본인만 연차 신청
CREATE POLICY "leave_insert_own" ON leave_requests
  FOR INSERT WITH CHECK (
    user_id::text = get_request_user_id()
  );

-- 팀장/admin은 승인·반려, 본인은 취소 상태 변경
CREATE POLICY "leave_update_manager_admin" ON leave_requests
  FOR UPDATE USING (
    user_id::text = get_request_user_id()
    OR get_request_user_role() IN ('admin', 'manager')
  );


-- ──────────────────────────────────────────────────────────────
-- STEP 5. audit_logs 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert_auth"  ON audit_logs;

-- 감사 로그는 admin만 조회
CREATE POLICY "audit_select_admin" ON audit_logs
  FOR SELECT USING (
    get_request_user_role() = 'admin'
  );

-- 로그인한 사용자만, 본인 user_id로만 기록 가능 (남의 이름으로 가짜 로그 작성 차단)
CREATE POLICY "audit_insert_auth" ON audit_logs
  FOR INSERT WITH CHECK (
    get_request_user_id() IS NOT NULL
    AND user_id::text = get_request_user_id()
  );


-- ──────────────────────────────────────────────────────────────
-- STEP 6. work_logs 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_logs_select"     ON work_logs;
DROP POLICY IF EXISTS "work_logs_insert_own" ON work_logs;
DROP POLICY IF EXISTS "work_logs_update_own" ON work_logs;

-- 본인 + 팀장/admin 조회
CREATE POLICY "work_logs_select" ON work_logs
  FOR SELECT USING (
    user_id::text = get_request_user_id()
    OR get_request_user_role() IN ('admin', 'manager')
  );

-- 본인만 작성
CREATE POLICY "work_logs_insert_own" ON work_logs
  FOR INSERT WITH CHECK (
    user_id::text = get_request_user_id()
  );

-- 본인만 수정
CREATE POLICY "work_logs_update_own" ON work_logs
  FOR UPDATE USING (
    user_id::text = get_request_user_id()
  );


-- ──────────────────────────────────────────────────────────────
-- STEP 7. salaries 테이블 (가장 민감)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salaries_select"      ON salaries;
DROP POLICY IF EXISTS "salaries_write_admin" ON salaries;

-- 본인 급여명세 + admin만 조회
CREATE POLICY "salaries_select" ON salaries
  FOR SELECT USING (
    user_id::text = get_request_user_id()
    OR get_request_user_role() = 'admin'
  );

-- admin만 급여 입력/수정/삭제
CREATE POLICY "salaries_write_admin" ON salaries
  FOR ALL
  USING (get_request_user_role() = 'admin')
  WITH CHECK (get_request_user_role() = 'admin');


-- ──────────────────────────────────────────────────────────────
-- STEP 8. performance 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_select_auth" ON performance;
DROP POLICY IF EXISTS "performance_write_admin" ON performance;

-- 로그인한 사용자면 실적 조회 가능
CREATE POLICY "performance_select_auth" ON performance
  FOR SELECT USING (
    get_request_user_id() IS NOT NULL
  );

-- admin만 실적 입력/수정
CREATE POLICY "performance_write_admin" ON performance
  FOR ALL
  USING (get_request_user_role() = 'admin')
  WITH CHECK (get_request_user_role() = 'admin');


-- ──────────────────────────────────────────────────────────────
-- STEP 9. projects / project_members / project_events 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_auth"        ON projects;
DROP POLICY IF EXISTS "projects_write_auth"         ON projects;
DROP POLICY IF EXISTS "project_members_select_auth" ON project_members;
DROP POLICY IF EXISTS "project_members_write_auth"  ON project_members;
DROP POLICY IF EXISTS "project_events_select_auth"  ON project_events;
DROP POLICY IF EXISTS "project_events_write_auth"   ON project_events;

-- 로그인한 사용자면 공정 전체 조회
CREATE POLICY "projects_select_auth" ON projects
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "projects_write_auth" ON projects
  FOR ALL
  USING (get_request_user_id() IS NOT NULL)
  WITH CHECK (get_request_user_id() IS NOT NULL);

CREATE POLICY "project_members_select_auth" ON project_members
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "project_members_write_auth" ON project_members
  FOR ALL
  USING (get_request_user_id() IS NOT NULL)
  WITH CHECK (get_request_user_id() IS NOT NULL);

CREATE POLICY "project_events_select_auth" ON project_events
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "project_events_write_auth" ON project_events
  FOR ALL
  USING (get_request_user_id() IS NOT NULL)
  WITH CHECK (get_request_user_id() IS NOT NULL);


-- ──────────────────────────────────────────────────────────────
-- STEP 10. weekly_reports / change_logs / collections 테이블
-- ──────────────────────────────────────────────────────────────

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_select_auth" ON weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_write_auth"  ON weekly_reports;
DROP POLICY IF EXISTS "change_logs_select_auth"    ON change_logs;
DROP POLICY IF EXISTS "change_logs_write_auth"     ON change_logs;
DROP POLICY IF EXISTS "collections_select_auth"    ON collections;
DROP POLICY IF EXISTS "collections_write_admin"    ON collections;

CREATE POLICY "weekly_reports_select_auth" ON weekly_reports
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "weekly_reports_write_auth" ON weekly_reports
  FOR ALL
  USING (get_request_user_id() IS NOT NULL)
  WITH CHECK (get_request_user_id() IS NOT NULL);

CREATE POLICY "change_logs_select_auth" ON change_logs
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "change_logs_write_auth" ON change_logs
  FOR ALL
  USING (get_request_user_id() IS NOT NULL)
  WITH CHECK (get_request_user_id() IS NOT NULL);

-- collections(수금현황)는 admin만 수정
CREATE POLICY "collections_select_auth" ON collections
  FOR SELECT USING (get_request_user_id() IS NOT NULL);

CREATE POLICY "collections_write_admin" ON collections
  FOR ALL
  USING (get_request_user_role() = 'admin')
  WITH CHECK (get_request_user_role() = 'admin');


-- ================================================================
-- 완료. 아래 쿼리로 적용 결과를 확인하세요:
--
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ================================================================
