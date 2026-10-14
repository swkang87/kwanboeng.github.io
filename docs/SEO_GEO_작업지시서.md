# kwanboeng.com AI 검색 노출(SEO·GEO) 작업지시서

작성: 2026-10-14 · 대상: Claude Code (kwanboeng.github.io 저장소)
목표: ChatGPT·Claude·Perplexity 등 AI와 검색엔진이 홈페이지 내용을 정확히 읽고 인용하게 만든다. 특히 "부산·울산·경남 개발행위허가(임야·농지)"를 대표 서비스로 노출한다.

---

## 0. 작업 규칙 (반드시 지킬 것)

1. **브랜치**: `main`에서 `seo-geo` 브랜치를 만들어 작업한다. 사용자 확인 전 `main`에 병합하지 않는다.
2. **시작 전 확인**: 단계마다 변경할 파일과 내용을 사용자에게 보여주고 "시작해" 응답을 받은 뒤 진행한다.
3. **백업**: 기존 파일 수정 전 `backup/<basename>_YYYYMMDD.<ext>` (같은 날 반복 시 `_2`).
4. **파일 형식**: CRLF, UTF-8 BOM 없음. `.gitignore`만 LF.
5. **화이트라벨**: 회사 정보는 HTML에 직접 하드코딩하지 않는다. 모두 `site-profile.json`에서 읽어 `tools/build_seo.py`가 생성 블록에 써 넣는다.
6. **크롤러 전제**: AI 크롤러는 JavaScript를 실행하지 않는다고 가정한다. AI가 읽어야 할 정보(숫자, 회사정보, FAQ)는 반드시 HTML 원문에 있어야 한다.
7. **서비스 페이지 문체 규칙** (기존 규칙 유지)
   - "~합니다" 문체, 이모지·홍보성 표현 금지
   - 금지 표현: "자체 수행", "외주 없이", "일관 수행", "자체 인력"
   - 개별 사업명·발주처명·의뢰인명·지번·금액 표기 금지
   - 법령 용어: "착공후지하안전조사", "지하안전평가", 등록기관 "시·도지사" (국토교통부 등록 표현 금지)
8. **내부 시스템 파일은 건드리지 않는다**: `home.html`, `leave.html`, `project.html`, `worklog.html`, `admin-*.html`, `payslip.html`, `import_weekly.html`, `sysbar.js`, `config.js`, `*.js` 시스템 스크립트(`contract-parser.js`, `payroll-*.js`, `payslip-render.js`).
9. **로그인 모달 로직**은 `index.html`에만 둔다. `page-common.js`로 복사하지 않는다.

---

## 1단계: 기반 파일 추가

### 1-1. `site-profile.json` (저장소 루트)
- 함께 전달한 초안을 그대로 넣는다.
- `null` 값은 해당 항목을 출력하지 않는다는 뜻이다. 사용자가 나중에 채운다.

### 1-2. `site-content/` 폴더
- `faq.json`: 페이지별 FAQ (질문·답변). 확정본이 함께 전달된다. 이후 FAQ 수정은 이 파일만 고치고 빌드 스크립트를 다시 실행한다.
- `lead.json`: 페이지별 정의 문장. 확정본이 함께 전달된다.
- `permit-page.md`: 신규 개발행위허가 페이지 본문 문안과 03 페이지 안내 블록 문안 (빌드 대상 아님, 3단계에서 HTML 작성 시 참고).
- 형식 예:
```json
{
  "service-permit.html": [
    { "q": "개발행위허가는 언제 필요한가요?", "a": "건축물의 건축, 토지의 형질변경..." }
  ]
}
```

### 1-3. `tools/build_seo.py`
Python 3 표준 라이브러리만 사용한다. 실행: `python tools/build_seo.py` (저장소 루트에서)

하는 일:
1. `site-profile.json`, `site-content/*.json`을 읽는다.
2. `pages`의 각 HTML에서 아래 **표시 블록 안만** 다시 쓴다. 블록 밖은 절대 건드리지 않는다. 블록이 없으면 경고를 출력하고 그 페이지는 건너뛴다(자동 삽입하지 않음).

| 표시 블록 | 위치 | 내용 |
| --- | --- | --- |
| `<!-- SEO:START -->` ~ `<!-- SEO:END -->` | `<head>` 안, `page.css` 링크 앞 | `<title>`, meta description, canonical, OG/Twitter 태그, JSON-LD, GA4(ID 있을 때만), 네이버 소유확인 meta(`site.naverSiteVerification` 있을 때, index.html에만) |
| `<!-- LEAD:START -->` ~ `<!-- LEAD:END -->` | 각 페이지 본문 첫 소개 문단 위치 | 정의 문장 `<p>` |
| `<!-- FAQ:START -->` ~ `<!-- FAQ:END -->` | 각 페이지 문의(CTA) 섹션 바로 위 | 눈에 보이는 FAQ 섹션 HTML |
| `<!-- COUNTERS:START -->` ~ `<!-- COUNTERS:END -->` | `index.html` 히어로 카운터 | 실제 숫자가 들어간 카운터 HTML |

3. 루트에 `robots.txt`, `sitemap.xml`, `llms.txt`를 생성한다.
4. 같은 입력이면 같은 출력(두 번 실행해도 변화 없음)이어야 한다. 파일 저장은 CRLF, UTF-8 BOM 없음.
5. 실행 결과로 "변경된 파일 목록"과 "null이라 생략된 항목 목록"을 출력한다.

#### JSON-LD 구성
- **index.html**
  - `ProfessionalService` — `@id: https://kwanboeng.com/#org`, name, alternateName, legalName, url, logo, image(ogImage), telephone, faxNumber, email, address(PostalAddress), geo, foundingDate(1987), areaServed(AdministrativeArea × 3), description, `hasOfferCatalog`(pages 중 type=service 목록, 각 항목 url 포함), `sameAs`(null 아닌 값만), `knowsAbout`(서비스명 목록)
  - `WebSite` — url, name, inLanguage
  - `FAQPage` — index의 FAQ가 있을 때
- **service-*.html**
  - `Service` — name, serviceType, url, description, `provider: {"@id": "https://kwanboeng.com/#org"}`, areaServed
  - `BreadcrumbList` — 홈 › 사업분야 › 해당 페이지
  - `FAQPage` — 해당 페이지 FAQ가 있을 때 (화면에 보이는 FAQ와 문구가 정확히 같아야 함)

#### robots.txt
```
User-agent: *
Allow: /
Disallow: /home.html
Disallow: /leave.html
Disallow: /project.html
Disallow: /worklog.html
Disallow: /admin-
Disallow: /payslip.html
Disallow: /import_weekly.html

Sitemap: https://kwanboeng.com/sitemap.xml
```
- AI 크롤러(GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended)는 차단하지 않는다. `*` 규칙으로 허용되므로 별도 항목은 넣지 않아도 된다.
- 비공개 경로는 `site-profile.json`의 `privatePaths`에서 읽는다.

#### sitemap.xml
- `pages`의 공개 페이지만. `lastmod`는 각 HTML 파일의 git 마지막 커밋 날짜(없으면 파일 수정일), `priority`는 profile 값.

#### llms.txt
- 마크다운 형식: 회사 한 줄 소개, 연락처, 서비스 지역, 서비스 페이지 목록(제목·URL·한 줄 설명), 보유 등록 목록.

#### 업력 자동 계산
- `heroCounters`의 `years.value`가 `"auto"`면 `현재연도 - foundedYear + 1` (2026년 기준 40년차).

---

## 2단계: 기존 페이지 수정

### 2-1. index.html
1. `<head>`에 `<!-- SEO:START -->` / `<!-- SEO:END -->` 블록 자리를 만든다.
2. **히어로 카운터 수정**: 현재 HTML 원문에 `0`으로 들어 있고 JS가 숫자를 올린다. AI에게는 "업력 0년"으로 읽힌다.
   - 카운터 부분을 `<!-- COUNTERS:START/END -->`로 감싸고, 빌드 스크립트가 실제 숫자를 넣게 한다.
   - 애니메이션 JS는 "0에서 시작"이 아니라 "HTML에 있는 숫자를 읽어 그 숫자까지 올라가는" 방식으로 바꾼다. JS가 꺼져 있어도 실제 숫자가 보여야 한다.
   - `value`가 `null`인 카운터는 현재 표시값을 그대로 둔다(빌드 스크립트가 경고 출력).
   - `value`가 숫자가 아닌 글자(예: "수백")인 카운터는 그 글자를 그대로 표시하고 애니메이션을 적용하지 않는다.
3. 회사소개 첫 문단 위치에 LEAD 블록, 문의 섹션 위에 FAQ 블록 자리를 만든다.
4. 사업분야 섹션에 **개발행위허가 강조 카드**를 추가한다. 기존 6개 그리드 위에 가로 전체 폭 카드 1개로, `service-permit.html`로 연결한다. 기존 그리드(6개) 구성은 바꾸지 않는다.
5. 푸터 저작권 연도를 현재 연도로 자동 표시(정적 HTML에는 빌드 시 연도, JS로 덮어쓰기 불필요).

### 2-2. service-*.html 6개
1. `<head>`에 SEO 블록 자리 추가. 기존 meta description이 있으면 블록 안으로 옮긴다(중복 금지).
2. 본문 첫 소개 위치에 LEAD 블록, CTA 위에 FAQ 블록 자리 추가.
3. FAQ 섹션 스타일은 기존 `page.css` 체계를 따른다. 필요하면 `page.css`에 `.faq` 스타일만 추가한다(다른 스타일 변경 금지).

### 2-3. service-development.html (03)
- 개발행위허가 상세 내용은 신규 전용 페이지로 옮기고, 03에는 개발행위허가를 짧게 소개한 뒤 `service-permit.html`로 연결하는 안내 블록을 둔다.
- 03의 나머지(지구단위계획, 도시관리계획, 도시계획시설, APT 부대토목, 산업단지)는 유지한다.
- 안내 블록 문안은 `site-content/permit-page.md` 하단을 따른다.

---

## 3단계: 신규 페이지 `service-permit.html`

- 기존 서비스 페이지(`page.css`, `page-common.js`) 구조와 규칙을 그대로 따른다.
- 이전/다음(PREV/NEXT) 순환에는 넣지 않는다. 대신 index 강조 카드와 03 페이지에서 연결한다. 페이지 하단에는 "관련 서비스"로 03(민간개발사업), 01(측량), 02(지하안전·지반) 링크를 둔다.
- 히어로 색상은 기존 6개와 겹치지 않는 색으로 하되, `--h2`는 02 페이지 밝기 이하(`.pg-en`의 `--gold`와 대비 확보).
- 섹션 구성 (문안은 `site-content/permit-page.md`를 그대로 사용):
  1. 히어로 + 정의 문장(LEAD)
  2. 이런 경우 의뢰합니다 (5개 항목)
  3. 수행 범위 (개발행위허가 / 건축허가 연계 토목 / 도시관리계획)
  4. 진행 기간 (허가도서 계약일로부터 30~40일. 공정표는 넣지 않음)
  5. 수행 실적: **집계 문장만** 넣는다. 사례 표는 보류(넣지 않음).
  6. 비용 구성 (항목만, 금액 없음. 용역비 지급 방식은 넣지 않음)
  7. FAQ (FAQ 블록)
  8. 문의 CTA
- `.eval-grid` 4 또는 8개, `.num-grid` 짝수, `.item-grid` 6개, `.proc` 번호 2자리 등 기존 그리드 규칙 준수.

---

## 4단계: OG 이미지·GA4

- `og-image.jpg` (1200×630): 로고 + 회사명 + "부산·울산·경남 개발행위허가·토목 엔지니어링". 히어로 배경 톤 사용. 이미지는 별도로 전달되면 그것을 쓴다.
- GA4: `site.ga4MeasurementId`가 null이 아니면 SEO 블록 안에 gtag 스니펫을 넣는다. null이면 넣지 않는다. 내부 시스템 페이지에는 넣지 않는다.

---

## 5단계: 검증 (커밋 전 모두 통과해야 함)

1. `python tools/build_seo.py`를 두 번 실행해 두 번째 실행에서 변경 파일이 0개인지 확인.
2. 모든 JSON-LD 블록을 Python `json.loads`로 파싱해 오류가 없는지 확인.
3. 각 페이지 FAQPage JSON-LD의 질문·답변 문구가 화면 FAQ HTML과 정확히 같은지 비교.
4. `index.html` 원문(JS 실행 전)에서 히어로 카운터에 `0`이 남아 있지 않은지 확인(null 항목 제외).
5. 금지 표현 4개가 모든 서비스 페이지 원문에 없는지 확인.
6. HTML 태그 균형은 Python 문자 단위 파서로 확인(grep·줄 수 세기 금지 — 한글 때문에 틀림).
7. 파일 형식: CRLF, BOM 없음 확인.
8. 로컬에서 각 페이지를 열어 화면 깨짐, 카운터 애니메이션, 로그인 모달 동작 확인.
9. 변경 파일 목록과 확인 결과를 사용자에게 보고한 뒤 `seo-geo` 브랜치에 커밋. 병합은 사용자 지시 후.

### 배포 후 (사용자 작업, 절차서 별도)
- Google 리치 결과 테스트로 JSON-LD 확인
- 구글 서치콘솔·Bing 웹마스터 도구·네이버 서치어드바이저에 `sitemap.xml` 제출

---

## 확정 사항
- 히어로 카운터: 엔지니어링 등록 분야 9개, 전문 인증 11개, 수행 프로젝트 500건+, 업력 자동 계산(년차)
- 네이버 플레이스·구글 비즈니스 프로필: 없음 (sameAs에는 카카오맵만)
- 사업자등록번호: 홈페이지에 표기하지 않음
- GA4 측정 ID: G-9BQETFEDJJ

---

## 진행·보고 방식 (2026-10-14 추가, 2단계 완료 이후 적용)

1. **멈추지 말고 끝까지 진행**: 남은 2-3, 3단계, 4단계, 5단계는 이 지시서와 `site-content/permit-page.md`에 정해진 내용이면 사용자에게 다시 묻지 않고 이어서 진행한다. 2-3(03 안내 블록·상세 이관)은 3단계와 한 묶음으로 처리한다.
2. **멈추는 경우만**: ① 지시서·문안에 없는 결정이 필요할 때 ② 문체·금지 규칙과 충돌할 때 ③ 같은 오류로 2회 실패했을 때. 이때는 작업을 멈추고 보고서에 결정 사항을 적는다.
3. **보고서 파일**: 단계 완료·결정 필요 시 `C:\Users\kwanb\Desktop\kbsys\security-fix\report_latest.md`에 보고서를 쓴다. 기존 `report_latest.md`가 있으면 먼저 `report_YYYYMMDD_HHMM.md`로 이름을 바꿔 보관한다. 화면에는 "보고서 작성 완료" 한 줄만 남긴다.
4. **보고서 내용**: 변경 파일 목록, 적용 내역, 5단계 검증 표, 사용자가 브라우저로 확인할 화면 목록, 결정이 필요한 사항(있을 때만).
5. **4단계 OG 이미지**: Pillow가 설치되어 있으면 로고·회사명·"부산·울산·경남 개발행위허가·토목 엔지니어링" 문구로 `og-image.jpg`(1200×630)를 만든다. 없으면 설치하지 말고 건너뛴 뒤 보고서에 적는다.
6. **커밋·병합 금지**: 커밋, push, main 병합은 하지 않는다. 사용자가 브라우저 확인 후 GitHub Desktop으로 직접 한다.
