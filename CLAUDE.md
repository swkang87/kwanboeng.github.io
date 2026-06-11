# 보안·버그 수정 작업계획 (2026-06)

> 작업 묶음은 ✅ 완료 / 🔲 미완료로 표시한다.

---

## ✅ 완료된 작업

### 날짜 타임존 버그 6곳 수정
`new Date(...).toISOString().split('T')[0]` → `localDateStr()` / `today()` 교체.
- `leave.html` 537행 (`getWeekDays`) — `localDateStr(x)`
- `project.html` 363행 (`weekLabel`) — `localDateStr(s)`, `localDateStr(e)`
- `project.html` 778행 (`twoWeeksLater`) — `localDateStr(d)`
- `project.html` 1383행 (`weekDates`) — `localDateStr(d)`
- `project.html` 2325·2835행 (`completed_at`) — `today()`
- `localDateStr` 헬퍼: leave.html 117행, project.html 330행에 추가.
- 건드리지 않은 안전한 행: leave.html 127행, project.html 326·329·330·344·676·812행.

### index.html 로그아웃 signOut 추가
`renderLoginSection` 로그아웃 핸들러에 `try { getSb().auth.signOut(); } catch(e) {}` 추가.

### index.html 브루트포스 잠금 + AUTH_DOMAIN config화
로그인 5회 실패 시 5분 잠금. `_bfCheck` / `_bfFail` / `_bfClear` 함수 추가.
- BF_KEY: `SESSION_PREFIX + '_login_fail'`
- 이메일 도메인: `AUTH_DOMAIN` config 참조
- 세션 저장키: `SESSION_PREFIX + '_session'`

### config.js 화이트라벨 config화
`ADMIN_TEAM_NAME`, `SESSION_PREFIX`, `AUTH_DOMAIN` 3항목 추가 (MENUS 위).

### sysbar.js 하드코딩 5곳 config 참조로 교체
- `SESSION_KEY` / `ACTIVE_KEY` / `LOGIN_KEY` / `ORIGIN_KEY` / `BF_KEY` → `_prefix` 변수 기반
- `doLogin` 이메일 도메인 → `AUTH_DOMAIN` 참조
- `canAdmin` 팀명 조건 → `ADMIN_TEAM_NAME` 참조

### admin 5개 파일 관리팀 하드코딩 교체
admin-worklog / admin-perf / admin-salary / admin-staff / admin-account:
- `setHasAccess(name === '관리팀')` → `setHasAccess(name === (APP_CONFIG.ADMIN_TEAM_NAME || '관리팀'))`

### admin-staff.html 호출부 sb.functions.invoke()로 전환
- `savePwReset`: `fetch('/functions/v1/reset-user-password')` → `sb.functions.invoke('smooth-function')`
- `savePhone`: `fetch('/functions/v1/update-user-phone')` → `sb.functions.invoke('update-user-phone')`
- 헤더 블록(`apikey`, `Authorization`, `x-user-id`, `x-user-role`) 전체 제거.

### import_weekly.html _makeSb 제거 + sysbar 통합
- `_makeSb` 함수 및 RLS 헤더 블록 제거.
- `sb` 단순화: `supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_KEY)`
- 세션키: `'kwanbo_session'` → `Sysbar.SESSION_KEY`
- `kwanbo_pm_user` 레거시 fallback 제거.
- `sysbar.js` 스크립트 태그 추가 (config.js 다음).

### leave.html 직원 추가 create-user Edge Function으로 전환 (Auth 자동 생성)
- `addUser`: `sb.from('users').insert(...)` → `sb.functions.invoke('create-user', { body: {..., init_pw: genTempPw()} })`
  - 성공 시 초기 비밀번호를 `cuData.init_pw`로 알림.
- `processBulk`: 동일 전환. 실패 시 `continue`.

### Edge Function JWT 전환 (smooth-function, update-user-phone, dynamic-action)
- 세 함수 모두 `x-user-role` 헤더 방식 → JWT 검증 방식으로 전환 완료.
- 호출부(admin-staff.html)도 `sb.functions.invoke()` 방식으로 동시 전환.

### Edge Function AUTH_DOMAIN 환경변수화 (update-user-phone, dynamic-action)
- 이메일 도메인을 `AUTH_DOMAIN` 환경변수로 분리. 하드코딩 제거.

### create-user Edge Function 신규 배포
- Supabase Auth 계정 자동 생성 + users 테이블 insert를 서버사이드에서 처리.
- 초기 비밀번호(`init_pw`)를 응답으로 반환.

### salary_details·salary_items·salary_members·salary_slips anon RLS 봉쇄
- 4개 테이블 anon SELECT 차단, authenticated 허용 정책 적용 완료.

---

## 🔲 미완료 — 대시보드 작업 필요

### salaries·salary_slips·users.birth_date RLS 봉쇄
`salaries`, `salary_slips`의 anon SELECT 차단 + `users.birth_date` anon 노출 차단이 남아있음.
- `slip.html`(미사용)이 anon으로 급여+생년월일 전체 조회 가능한 상태.
- `admin-salary.html`은 JWT(authenticated) 경로 — 봉쇄 후에도 정상 동작해야 함.
- 순서: 현황 조회 SQL 실행 → 확인 후 봉쇄 SQL 실행 (승우님이 SQL Editor에서 직접).
