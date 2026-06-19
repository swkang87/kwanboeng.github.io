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

### slip.html XSS 방지 (escapeHtml 적용)
- `escapeHtml(s)` 유틸 추가 (&, <, >, ", ' 5종 이스케이프).
- slipCard 렌더링 6곳 적용: `userData.name`, `fmtDate(userData.birth_date)`,
  `fmtDate(payDate)`, `userData.position`, `makeRows` 내 `item.label`, tag의 `month`.
- 341/379행 에러 메시지는 하드코딩 문자열 — 변경 제외.

### project.html AUTH_DOMAIN 하드코딩 제거
- `ChangePasswordModal`(~3067행)·`ProfileView`(~3208행) 두 곳의 `'@kwanbo.internal'` →
  `'@' + (APP_CONFIG.AUTH_DOMAIN || 'kwanbo.internal')` 패턴으로 교체.

### 현재 세션 키 'kwanbo_session' 리터럴 → SESSION_PREFIX 기반 통일
- index.html 4곳 / home.html 2곳 / worklog.html 2곳 / project.html 2곳, 총 10곳 교체.
- 교체 패턴: `((window.APP_CONFIG && APP_CONFIG.SESSION_PREFIX) || 'kwanbo') + '_session'`
- 잔여 리터럴 0건 확인. 레거시 정리용 `removeItem('kwanbo_pm_user')` · `removeItem('kwanbo_uid')`는 리터럴 유지.

### admin-staff.html 신규 등록 create-user 전환 (auth_id=null 로그인 불가 버그 수정)
- 원인: `save()` 신규 분기가 `auth_id:null`로 raw insert만 하고 Auth 계정을 안 만듦 →
  관리포털로 등록된 직원은 로그인·비번 초기화 불가 (예: 서영우).
- 수정: leave.html과 동일하게 `sb.functions.invoke('create-user', {...})` 호출로 전환.
  - body: `name/phone(숫자)/role/team_id/join_date(=hire_date||today())/total_days:15/init_pw:genTempPw()`
  - admin-staff 고유 필드(email/position/hire_date/leave_date)는 create-user 성공 후
    `.eq('phone', ph)` 기준 별도 UPDATE로 보강 (create-user 스펙 무관, 필드 유실 방지).
  - `genTempPw`/`today` 헬퍼 leave.html에서 복사 추가 (today는 로컬 KST, toISOString 금지).
  - dead code 제거: `phoneDigits`/`emailLocal`/`authId=null`.
  - **editU(기존 수정) 분기는 Auth 미관여로 그대로 유지** — 건드리지 말 것.
- 검증: 브레이스/괄호 balance 0, Babel(preset-react+env) 트랜스파일 PASS.
- 한계: **이미 깨진 서영우(auth_id=null) 1건은 미복구.** 소급 복구(smooth-function Fix B)는
  Edge Function 소스가 레포에 없어 별도 처리 — 아래 미완료 항목 참조.

### admin-staff.html Edge Function 호출 JWT 명시 첨부 (invoke 401 해소)
- 원인: 세션은 유효(users 조회 정상, 18명 표시)하나 `functions.invoke`가 세션 자동첨부에
  의존 → 사용자 JWT 없이 호출되어 Edge Function `getUser()` 실패로 401
  ("사용자 정보를 확인할 수 없습니다"). leave.html과 클라이언트 코드는 동일했음 — 런타임 차이.
- 구조적 배경: 앱 "로그인됨" UI는 sessionStorage 프로필 기반, 실제 인증 JWT는 supabase
  localStorage 세션. 둘이 분리돼 invoke에 토큰이 안 실릴 수 있음.
- 수정: `invokeAuthed(fnName, body)` 헬퍼 추가 — `sb.auth.getSession()`으로 토큰 조회 후
  `headers:{Authorization:'Bearer '+access_token}` 명시 첨부. 세션 부재 시 재로그인 안내 error 반환.
- 적용 3곳: `create-user`(save) / `smooth-function`(savePwReset) / `update-user-phone`(savePhone).
  각 호출부 기존 에러 처리 유지 → 세션 만료 메시지가 동일 경로로 노출.
- 검증: 브레이스/괄호 balance 0, Babel PASS.
- **패턴 원칙:** JWT 검증 Edge Function 호출은 자동첨부에 의존하지 말고 토큰 명시 첨부할 것
  (다른 페이지에도 동일 위험 — 필요 시 같은 헬퍼 패턴 적용).

---

### WeeklyReport 완료 용역 과거 주 표시 버그 수정
`applyAppData`의 완료 제거 필터 + `loadAll`의 `.neq('status','완료')` + `sortedProjects`의 `if (p.status !== '완료')` 래핑 — 세 곳 제거.
- WeeklyReport는 완료 용역 포함 전체 데이터를 받아야 `completed_at` 기반 과거 주 표시가 동작함.
- 완료 용역의 표시/숨김은 `sortedProjects` 필터 하단 `p.status === '완료'` 분기에서 `completed_at >= selWeek` 조건으로 결정.

---

## ❕ 패턴·원칙

- **화이트라벨 키는 항상 config 참조**: 세션키·인증 도메인 등은 `APP_CONFIG.*` 참조로 작성.
  단, 레거시 정리용 `removeItem` 키(`kwanbo_pm_user`, `kwanbo_uid`)는 리터럴 유지 —
  과거 데이터가 해당 키로 저장되어 있으므로 prefix화하면 안 됨.
- **project.html 비밀번호 변경 로직은 두 벌이 정상 동작**:
  `ChangePasswordModal`(관리자 phone 기반 재인증)과 `ProfileView`(본인 username 우선
  자가변경, 별도 authClient 세션). 용도가 다른 독립 플로우 — 중복 아님, 삭제 금지.

---

## 🔲 미완료 — 대시보드 작업 필요

### auth_id=null 기존 직원 소급 복구 (smooth-function Fix B) + 서영우 1건
관리포털 신규 등록 버그(위 완료 항목)로 생긴 `auth_id=null` 직원들의 로그인·비번 초기화 복구.
- 대상 예: 서영우(01028641014, contractor, auth_id=null).
- 방법: `smooth-function`(비번 초기화) Edge Function에 caller `getUser()` UID 추출 →
  대상 user의 `auth_id`가 null이면 `auth.admin.createUser()` 소급 생성 → `users.auth_id` UPDATE → 비번 설정.
- ⚠️ **Edge Function 소스가 이 레포에 없음** (`supabase/functions/` 미존재, git 미추적).
  소스 확보 후 작업 → `supabase functions deploy smooth-function` 으로 배포(승우님 직접).
- 임시: 서영우 1건은 Supabase 대시보드/SQL로 Auth 계정 수동 생성 후 auth_id 연결 가능.

### salaries·salary_slips·users.birth_date RLS 봉쇄
`salaries`, `salary_slips`의 anon SELECT 차단 + `users.birth_date` anon 노출 차단이 남아있음.
- `slip.html`(미사용)이 anon으로 급여+생년월일 전체 조회 가능한 상태.
- `admin-salary.html`은 JWT(authenticated) 경로 — 봉쇄 후에도 정상 동작해야 함.
- 순서: 현황 조회 SQL 실행 → 확인 후 봉쇄 SQL 실행 (승우님이 SQL Editor에서 직접).

### SYS_MENUS 이중 관리 해소
`sysbar.js`의 `SYS_MENUS`가 `config.js`의 `MENUS`와 별개로 하드코딩됨.
화이트라벨 시 config에서 메뉴를 빼도 시스템바 드롭다운엔 여전히 남는 구조 — 미해결.

### index.html 회사명·연락처 하드코딩 config 주입 전환
title / footer / 연락처 등이 하드코딩된 상태.
`APP_CONFIG`에서 주입하도록 전환하면 납품 체크리스트 항목 단축 가능 — 미해결.
