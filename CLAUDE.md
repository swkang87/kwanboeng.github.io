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

### admin-perf.html 계약/잔금·예상수금 개편 (worklog 비품관리 탭과 별개)
- **잔금 공식 = 순 현금 기준**: `잔금 = 계약 − 기수금(prior_collected) − 누적수금 − 예상외주(expected_outsource) + 실지급외주누적`.
  외주잔여(예상−실지급) 음수 허용(클램프 없음). row·총합 동일 공식, `totalRemain = Σ r.remain`이라 1행 총잔금 = row 합 자동 일치.
- **전 기간 누적 통일**: 계약/잔금 탭 `getTotalCol`·`getTotalOut`가 `yCols`(선택 연도) → `cols`(전 기간)로 변경됨.
  → 계약/기수금/수금/외주 4개 항이 모두 전 기간 누적. **부수효과(의도)**: 계약/잔금 탭 수금·외주·잔금·수금률이 **연도 선택과 무관**(계약 잔액 성격). 연도 선택은 수금/연도집계 탭에만 영향.
- **요약 박스 2행**: 1행(수금) 총계약/누적수금/총잔금, 2행(외주) 총외주계약(Σ expected_outsource)/누적지급(Σ outsource_cost)/외주잔금.
  `SummaryBox` 컴포넌트 + 톤 상수(`TONE_CONTRACT/COLLECT/REMAIN`) 신설 — 6박스가 단일 컴포넌트·동일 톤 재사용(신규 색상 하드코딩 없음).
- **row 금액열 보조 소자**(회색, 0이면 숨김, `subLabel` 상수 재사용): 계약금액↓ `외주 {expected_outsource}`, 수금액↓ `외주지급 {실지급}`, 잔금↓ `기수금 …원 제외`(>0만).
  거짓 라벨 `예상외주 …원 제외` 제거.
- **예상수금(autoExpected) 음수 표시**: `remain <= 0` → `remain === 0`(완납만 제외, 음수 행 표시). 음수 잔금 빨강(`r.remain<0?'#dc2626'` 기존 패턴 재사용).
- **예상수금 누락 원인**: 진단 결과 누락은 전부 **종료일(end_date) 미입력 16건**(계약없음·완납 0건). 종료일 미입력 건은 표시 안 됨이 의도된 동작 — 추가 처리 안 함.

### admin-perf.html 세금계산서 탭 추가 (홈택스 전자세금계산서 .xls 파싱)
- **config.js**: `COMPANY_BIZ_NO: '604-81-29017'` 추가(회사정보 섹션). 매입/매출 판별·화이트라벨 기준값.
- **SheetJS**: `xlsx@0.18.5` CDN 스크립트 태그 추가(supabase 다음). import_weekly.html과 동일 버전.
- **모듈 헬퍼**(fmtShort 아래): `parseXlDate`(엑셀 시리얼/문자 날짜 → YYYY-MM-DD), `parseXlNum`(콤마제거 Number), `xlStr`(트림), `normBizNo`(숫자만).
- **탭 권한**: `canTax = user.role==='admin'||'manager'` — 탭 버튼/업로드/삭제 모두 canTax 게이팅. RLS로도 이미 봉쇄됨.
- **파싱**: 헤더 6행(index 5), 데이터 index 6부터. 승인번호(col1) 없는 행 스킵.
  매입/매출 = 공급받는자사업자번호(col9)===COMPANY_BIZ_NO → '매입', 공급자(col4)===COMPANY_BIZ_NO → '매출'(둘 다 아니면 스킵).
  counterpart_name = 매입이면 공급자상호(col6), 매출이면 공급받는자상호(col11).
  같은 승인번호 여러 줄 → 헤더 1건(첫 줄) + 품목명(col26) 있는 줄마다 item.
- **저장**: 헤더는 `upsert(onConflict:'approval_no')`, 품목은 invoice_id 기존 삭제 후 재삽입.
  다중 파일·다중 승인번호 **순차 처리**(await 루프). 신규/업데이트는 upsert 전 `maybeSingle` 조회로 판별.
  결과 토스트: "N건 저장(신규 M / 업데이트 K · 실패 E)".
- **UI**: 매입/매출 토글 + 월 필터(작성일자 기준). 목록=발급일자/거래처/합계금액/품목명("○○ 외 N건"), 발급일자 최신순.
  행 클릭·"자세히" → 상세 모달(일자 4종·공급자/공급받는자 전체·합계/공급가액/세액 SummaryBox 재사용·구분/기타·이메일 3종·품목 테이블·삭제).
- **DB 컬럼명 계약 (실제 스키마 확정, 2026-07 전수 대조 완료)**:
  `tax_invoices`: approval_no(UNIQUE 제약 필수)·invoice_type·counterpart_name·write_date·issue_date·send_date·
  supplier_{biz_no,name,ceo,address}·buyer_{biz_no,name,ceo,address}·total_amount·supply_amount·tax_amount·
  invoice_class·invoice_kind·issue_type·note·receipt_type·supplier_email·buyer_email1·buyer_email2.
  `tax_invoice_items`: invoice_id(FK)·item_date·item_name·item_spec·item_qty·item_unit_price·item_supply_amount·item_tax_amount·item_note.
  ⚠️ 주소는 `_address`(축약 `_addr` 아님). **종사업장번호(sub_biz_no) 컬럼은 테이블에 없음** —
  .xls col5/col10은 파싱하지 않고 버림(payload에 넣으면 PGRST204 전 건 실패).
- 검증: Babel(preset-react+env) 트랜스파일 PASS.

### admin-perf.html 세금계산서 탭 드래그앤드롭 + 업로드 미반영 수정
- **드롭존**: 기존 안내 텍스트 div를 드롭존으로 교체(파일 input·업로드 버튼 유지, 클릭해도 파일 선택 열림).
  `taxDrag` 상태로 드래그 오버 시 보라 점선 하이라이트 + "여기에 파일을 놓으세요". 처리 중엔 pointerEvents:none.
- **확장자 검증**: `handleTaxFiles` 입구에서 `/\.(xls|xlsx)$/i` 필터 — input/드롭 공통.
  전부 비엑셀이면 ❌ 토스트 후 중단, 혼합이면 진행 후 "엑셀 외 파일 N개 제외" 병기.
- **에러 무시 4곳 수정**: upsert 실패 시 `error.message (code)` 수집(`pushErr`, 중복 제거, 토스트에 최대 3건 표시),
  maybeSingle/품목 delete/품목 insert 에러도 수집. loadTax 조회 에러도 토스트 표시.
  결과 포맷: "성공 N건 (신규/업데이트) · 실패 M건 — 에러상세".
- **업로드 후 미반영 원인**: `loadTax()` refetch·'전체' 월필터 기본값은 원래 있었음. 실제 원인은
  ① 에러 무증상(approval_no UNIQUE 제약 부재 시 42P10도 숫자로만 집계) ② 매입 탭 보며 매출 파일 업로드 시 안 보이는 UX.
  → 저장 성공 시 `setTaxMonth('전체')` + 저장된 invoice_type 탭으로 자동 전환(`savedKinds`).
- **x-user-id 헤더 확인 결과**: 이 파일은 plain `createClient`(182행) 하나로 모든 테이블 저장 — 커스텀 헤더 자체가 없고
  다른 테이블(collections 등)과 동일 경로. 헤더 불일치 아님. RLS는 authenticated 세션 기반.
- 검증: Babel(preset-react+env) 트랜스파일 PASS.

### admin-perf.html 매칭확인 서브탭 (수금↔매출 세금계산서 자동 대사)
- **스키마 근거(REST 프로브로 확정)**: 두 테이블 간 직접 FK 없음 → 휴리스틱 매칭이 유일.
  collections엔 발주처명 컬럼 없음 → `projects.client` 조인, 감리(supervision)는 `parseSupvMemo(memo).client`.
- **매칭 조건(2조건 AND, 2026-07 개정)**: ① `collections.amount === tax_invoices.total_amount` 완전일치
  ② `issue_date` ±`MATCH_WINDOW_DAYS`(30일) 내 `collected_at`. **거래처명은 조건에서 제외** — 화면 참고 표시만(오매칭 육안 확인용,
  `normCoName` 정규화는 검색 필터에서 계속 사용).
- **greedy 1:1**: 후보쌍을 날짜차 오름차순 정렬 후 미사용 쌍만 확정. 대상: 매출 계산서만, `entry_type='outsource_only'`(amount=0) 수금 제외.
- **수동매칭 + 확인완료(2026-07 추가)**: 자동매칭은 매번 재계산(DB 저장 안 함), 수동매칭은 `invoice_collection_matches`에
  insert(match_type='manual', created_by=user.id), 확인완료는 `invoice_collection_reviews`에 upsert(onConflict:'item_type,item_id',
  status='confirmed_ok', reviewed_by=user.id). 두 테이블 기록은 미수금/미발행 후보 풀에서 사전 제외. 낙관적 업데이트 + 실패 시 롤백·에러 토스트.
  수동매칭 모달 후보는 **연도 필터 무관 전체 미매칭 건**(unpaidAll/unissuedAll), 금액차→날짜차 순 정렬, 상위 50건.
  매칭된 건 보기에 자동(badge bg)/수동(badge bp) 구분 배지. `user.id`는 sysbar 세션의 users.id(uuid) — created_by/reviewed_by FK용.
- **DB 반영 완료(2026-07)**: `invoice_collection_matches.sql` 승우님이 SQL Editor에서 실행 — 테이블 2개 생성 +
  RLS 정책 8개(테이블당 select/insert/update/delete, admin+manager 전용) 검증 쿼리로 확인 완료.
  matches FK는 `on delete cascade`(계산서 삭제와 충돌 방지), reviews.item_id는 polymorphic(FK 없음).
- **UI**: 실적관리 서브탭 '매칭확인'(canTax 게이팅, 세금계산서 탭 옆). 연도는 상단 공통 선택 재사용,
  거래처명 검색 + "매칭된 건 보기" 토글. 미수금 의심(badge br)/미발행 의심(badge ba)/매칭됨(badge bg) — 기존 badge 클래스 재사용.
  미수금 테이블의 프로젝트명은 계산서에 연결정보가 없어 항상 '-'.
- 헬퍼: `normCoName`/`dayDiffAbs`/`MATCH_WINDOW_DAYS` 모듈 레벨 신설(normBizNo 아래).
- 검증: Python 중괄호 balance 일치(1758/1758), Babel 트랜스파일 PASS. outputs/admin-perf.html 사본 저장.

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

### tax_invoices·tax_invoice_items RLS admin+manager 제한 (SQL 작성 완료, 실행 대기중)
- **현재 상태: authenticated 전체 허용(임시)** — 최초 정책이 `x-user-role` 커스텀 헤더 방식이라
  Auth 세션 기반인 이 앱에서 전부 차단됨(업로드해도 안 보이는 버그 원인) → 임시로
  `using(true)/with check(true)` 전체 허용으로 풀어 동작 확인한 상태. 로그인한 전 직원이
  세금계산서 조회/업로드/삭제 가능해 위험.
- **`supabase/sql/tax_invoices_rls.sql` 작성 완료** — 승우님이 SQL Editor에서 검토 후 직접 실행.
  - 두 테이블의 기존 정책을 이름 무관 일괄 drop(DO 블록, pg_policies 순회) 후
    select/insert/update/delete 전부 admin+manager 전용으로 재생성.
  - 권한 판정: supply_records.sql 선택 블록과 동일 패턴 —
    `exists (select 1 from public.users where auth_id = auth.uid() and role in ('admin','manager'))`.
  - 전제: users에 authenticated SELECT 정책 존재(충족 확인됨), auth_id=null 계정은 접근 불가.
  - 실행 후 검증 쿼리 포함(테이블당 4개, 총 8개 정책 확인).

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
