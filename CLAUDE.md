# 보안·버그 수정 작업계획 (2026-06)

> 이 문서는 CLAUDE.md에 이어붙여 클로드코드 세션 컨텍스트로 사용한다.
> 작업 묶음은 A(즉시) / B(2단계) / C(보류)로 나뉜다.
> **C는 이번 세션에서 건드리지 않는다.**

---

## 묶음 A — 즉시 작업 (클로드코드 단독, 함수 본체 불필요)

### A-1. 날짜 타임존 버그 6곳 수정

증상: `new Date(...)`(로컬 자정 Date)에 `.toISOString().split('T')[0]`를 적용하면
KST(UTC+9) 기준 **오전 9시 이전 접속 시 날짜가 하루 전으로 밀린다.**

대상 (정확히 이 6곳만):
- `leave.html` 536행  — `getWeekDays` 내부
- `project.html` 362행 — `weekLabel` 내부 (s, e 두 군데)
- `project.html` 777행 — `twoWeeksLater`
- `project.html` 1382행 — `weekDates` 배열
- `project.html` 2324행 — `completed_at` 기록
- `project.html` 2834행 — `completed_at` 기록

**건드리지 말 것 (이미 안전하거나 정오 기준):**
- `leave.html` 127행 (`countWD`) — `T12:00:00` 기준이라 안전
- `project.html` 326·329·330·344·676·812행 — 이미 `getFullYear/getMonth/getDate` 패턴

수정 방법: 각 파일에 로컬 날짜 헬퍼를 하나 정의하고, 위 6곳의
`X.toISOString().split('T')[0]` 를 `localDateStr(X)` 로 교체한다.

```js
// 각 파일 상단(다른 날짜 헬퍼 옆)에 추가. Babel standalone 호환: function 키워드 사용.
function localDateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}
```

- project.html 2324·2834는 `new Date().toISOString().split('T')[0]` 형태 →
  `localDateStr(new Date())` 로 교체.
- project.html은 이미 `today()`가 동일 로직이므로 `today()` 재사용도 가능
  (스코프 확인 후 택일). leave.html은 `today()`가 인자를 안 받으므로
  `localDateStr` 신규 추가가 안전.

검증: 수정 후 두 파일 **Babel 컴파일 통과 필수**. 중괄호 균형 Python으로 확인.

### A-2. index.html 로그아웃 시 auth.signOut() 누락 보완

`renderLoginSection`의 로그아웃 핸들러가 sessionStorage만 지우고
Supabase Auth 세션을 안 닫는다 (1464행 부근).
`sessionStorage.removeItem('kwanbo_session')` 직후에 Supabase signOut 호출 추가.

```js
// 기존: sessionStorage/localStorage 제거만
// 추가: getSb() 또는 동일 클라이언트로
try { sb.auth.signOut(); } catch(e) {}
```
index.html의 supabase 클라이언트 변수명을 먼저 grep으로 확인하고
(1435행 부근 createClient) 그 변수로 signOut 호출.

---

## 묶음 B — 2단계 작업 (현황 조회 → 확정 → 실행)

### B-1. 급여 테이블 RLS 봉쇄

목표: `salaries`, `salary_details`, `salary_items`, `salary_members`,
`salary_slips`의 **anon SELECT 차단, authenticated 허용.**
+ `users.birth_date`의 anon 노출 차단.

배경:
- slip.html(미사용)이 anon으로 급여+생년월일 전체를 읽을 수 있는 상태.
- admin-salary.html은 signInWithPassword → JWT로 접근 (authenticated).
- import_weekly.html은 x-user-role 헤더 기반 (salary 안 읽음 → 무관).

**먼저 현황 조회 SQL(RLS_step1_inspect.sql) 실행 → 결과 확인 후 봉쇄 SQL 확정.**
현재 정책이 `USING(true)`인지, RLS가 켜져 있는지 모르는 상태에서
봉쇄 SQL을 바로 실행하면 admin-salary가 깨질 수 있음.

이 작업은 **대시보드 SQL Editor에서 승우님이 실행** (클로드코드는 SQL 파일만 작성).

---

## 묶음 C — 보류 (함수 본체 확보 후, 호출부와 동시 진행)

### C-1. Edge Function JWT 전환

`reset-user-password`, `update-user-phone` 두 함수.
- 현재 호출부(admin-staff.html 533·570행)는 `x-user-role` 헤더 의존.
- `functions.invoke()`로 바꾸면 헤더가 안 가서 함수가 깨짐.
- 따라서 **함수 본체 코드를 Supabase 대시보드에서 가져온 뒤**,
  본체(JWT 검증 ON)와 호출부(invoke 전환)를 한 커밋에 동시 수정.
- import_weekly.html의 `_makeSb` 헤더 방식도 이 묶음에서 함께 정리.

**이번 세션에서 절대 건드리지 않는다.**
