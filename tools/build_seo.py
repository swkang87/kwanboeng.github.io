#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_seo.py — kwanboeng.com 공개 홈페이지 SEO/GEO 생성기

입력:
  - site-profile.json          (회사 정보 단일 원천, null 값은 미출력)
  - site-content/lead.json      (페이지별 정의 문장)
  - site-content/faq.json       (페이지별 FAQ)

하는 일:
  1) pages의 각 HTML에서 표시 블록 안만 다시 쓴다.
     <!-- SEO:START --> ~ <!-- SEO:END -->
     <!-- LEAD:START --> ~ <!-- LEAD:END -->
     <!-- FAQ:START --> ~ <!-- FAQ:END -->
     <!-- COUNTERS:START --> ~ <!-- COUNTERS:END -->  (index.html만)
     블록 밖은 절대 건드리지 않는다. 블록이 없으면 경고만 하고 삽입하지 않는다.
  2) 루트에 robots.txt, sitemap.xml, llms.txt 생성.
  3) 같은 입력이면 같은 출력(멱등). 저장은 CRLF, UTF-8 BOM 없음.
  4) pages에 있어도 HTML 파일이 아직 없는 페이지는 sitemap/llms/JSON-LD 목록에서
     건너뛰고 경고만 출력한다.

실행: python tools/build_seo.py   (저장소 루트에서)
표준 라이브러리만 사용.
"""

import datetime
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE_PATH = os.path.join(ROOT, "site-profile.json")
CONTENT_DIR = os.path.join(ROOT, "site-content")

WARNINGS = []
OMITTED = []    # null이라 생략된 항목
CHANGED = []    # 변경된 파일


def warn(msg):
    WARNINGS.append(msg)


def omit(msg):
    OMITTED.append(msg)


# ---------------------------------------------------------------- 파일 I/O

def read_json(path):
    with open(path, "rb") as f:
        raw = f.read()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return json.loads(raw.decode("utf-8"))


def read_text(path):
    """바이트로 읽어 \\r\\n 을 그대로 보존한다. BOM 은 제거해 돌려준다."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return raw.decode("utf-8")


def write_if_changed(path, text):
    """text 는 \\r\\n 개행을 포함한 완성본. 바뀐 경우에만 BOM 없이 utf-8 로 쓴다."""
    data = text.encode("utf-8")
    old = None
    if os.path.exists(path):
        with open(path, "rb") as f:
            old = f.read()
    if old == data:
        return False
    with open(path, "wb") as f:
        f.write(data)
    CHANGED.append(os.path.relpath(path, ROOT).replace("\\", "/"))
    return True


def to_crlf(text):
    """'\\n' 기준으로 작성한 문자열을 CRLF 로 정규화."""
    return text.replace("\r\n", "\n").replace("\n", "\r\n")


# ---------------------------------------------------------------- 블록 치환

def has_block(text, name):
    return ("<!-- %s:START -->" % name) in text and ("<!-- %s:END -->" % name) in text


def replace_block(text, name, inner):
    """
    <!-- name:START --> ... <!-- name:END --> 사이를 inner 로 교체.
    START 앞의 들여쓰기를 보존하고 각 줄에 같은 들여쓰기를 붙인다(멱등).
    inner 는 '\\n' 구분 문자열.
    """
    start = "<!-- %s:START -->" % name
    end = "<!-- %s:END -->" % name
    pat = re.compile(r"([ \t]*)" + re.escape(start) + r".*?" + re.escape(end), re.DOTALL)

    def repl(m):
        indent = m.group(1)
        lines = inner.split("\n")
        body = "\n".join((indent + ln) if ln.strip() else "" for ln in lines)
        return "%s%s\n%s\n%s%s" % (indent, start, body, indent, end)

    new_text, n = pat.subn(repl, text, count=1)
    return new_text, n


# ---------------------------------------------------------------- 이스케이프

def esc_text(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def esc_attr(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


# ---------------------------------------------------------------- URL 헬퍼

def page_url(base, path):
    if path == "/":
        return base + "/"
    return base + path


# ---------------------------------------------------------------- JSON-LD

def json_ld_script(obj):
    body = json.dumps(obj, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + body + "\n</script>"


def area_served(profile):
    return [{"@type": "AdministrativeArea", "name": a} for a in profile["areaServed"]]


def org_node(profile):
    site = profile["site"]
    co = profile["company"]
    ct = profile["contact"]
    base = site["baseUrl"]
    addr = ct["address"]

    node = {
        "@type": "ProfessionalService",
        "@id": base + "/#org",
        "name": co["name"],
        "alternateName": co["alternateName"],
        "legalName": co["legalName"],
        "url": base + "/",
        "logo": base + site["logo"],
        "image": base + site["ogImage"],
        "telephone": ct["telephone"],
        "faxNumber": ct["fax"],
        "email": ct["emails"][0]["address"],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": addr["streetAddress"],
            "addressLocality": addr["addressLocality"],
            "addressRegion": addr["addressRegion"],
            "postalCode": addr["postalCode"],
            "addressCountry": addr["addressCountry"],
        },
        "foundingDate": str(co["foundedYear"]),
        "areaServed": area_served(profile),
        "description": co["description"],
    }
    geo = ct.get("geo")
    if geo and geo.get("latitude") is not None and geo.get("longitude") is not None:
        node["geo"] = {
            "@type": "GeoCoordinates",
            "latitude": geo["latitude"],
            "longitude": geo["longitude"],
        }

    services = existing_service_pages(profile)
    node["hasOfferCatalog"] = {
        "@type": "OfferCatalog",
        "name": "서비스",
        "itemListElement": [
            {
                "@type": "Offer",
                "itemOffered": {
                    "@type": "Service",
                    "name": p["serviceName"],
                    "url": page_url(base, p["path"]),
                },
            }
            for p in services
        ],
    }

    same = [v for v in profile["sameAs"].values() if v]
    if same:
        node["sameAs"] = same
    node["knowsAbout"] = [p["serviceName"] for p in services]
    return node


def website_node(profile):
    site = profile["site"]
    base = site["baseUrl"]
    return {
        "@type": "WebSite",
        "@id": base + "/#website",
        "url": base + "/",
        "name": profile["company"]["name"],
        "inLanguage": site["language"],
        "publisher": {"@id": base + "/#org"},
    }


def faqpage_node(faqs):
    return {
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f["q"],
                "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
            }
            for f in faqs
        ],
    }


def service_node(profile, page):
    base = profile["site"]["baseUrl"]
    return {
        "@type": "Service",
        "@id": page_url(base, page["path"]) + "#service",
        "name": page["serviceName"],
        "serviceType": page["serviceType"],
        "url": page_url(base, page["path"]),
        "description": page["description"],
        "provider": {"@id": base + "/#org"},
        "areaServed": area_served(profile),
    }


def breadcrumb_node(profile, page):
    base = profile["site"]["baseUrl"]
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": base + "/"},
            {"@type": "ListItem", "position": 2, "name": "사업분야", "item": base + "/#services"},
            {"@type": "ListItem", "position": 3, "name": page["serviceName"],
             "item": page_url(base, page["path"])},
        ],
    }


# ---------------------------------------------------------------- SEO 블록

def build_seo(profile, page, faq_map):
    site = profile["site"]
    co = profile["company"]
    base = site["baseUrl"]
    url = page_url(base, page["path"])
    title = page["title"]
    desc = page["description"]
    locale = site["language"].replace("-", "_")
    is_home = page["type"] == "home"

    lines = []
    lines.append("<title>%s</title>" % esc_text(title))
    lines.append('<meta name="description" content="%s">' % esc_attr(desc))
    lines.append('<link rel="canonical" href="%s">' % esc_attr(url))

    # Open Graph
    lines.append('<meta property="og:type" content="website">')
    lines.append('<meta property="og:site_name" content="%s">' % esc_attr(co["name"]))
    lines.append('<meta property="og:locale" content="%s">' % esc_attr(locale))
    lines.append('<meta property="og:title" content="%s">' % esc_attr(title))
    lines.append('<meta property="og:description" content="%s">' % esc_attr(desc))
    lines.append('<meta property="og:url" content="%s">' % esc_attr(url))
    lines.append('<meta property="og:image" content="%s">' % esc_attr(base + site["ogImage"]))
    # Twitter
    lines.append('<meta name="twitter:card" content="summary_large_image">')
    lines.append('<meta name="twitter:title" content="%s">' % esc_attr(title))
    lines.append('<meta name="twitter:description" content="%s">' % esc_attr(desc))
    lines.append('<meta name="twitter:image" content="%s">' % esc_attr(base + site["ogImage"]))

    # 네이버 소유확인 (index 만, 값 있을 때만)
    if is_home:
        nv = site.get("naverSiteVerification")
        if nv:
            lines.append('<meta name="naver-site-verification" content="%s">' % esc_attr(nv))
        else:
            omit("index.html: 네이버 소유확인 meta (naverSiteVerification=null)")

    # JSON-LD
    graph = []
    if is_home:
        graph.append(org_node(profile))
        graph.append(website_node(profile))
        faqs = faq_map.get(page["file"])
        if faqs:
            graph.append(faqpage_node(faqs))
    else:
        graph.append(service_node(profile, page))
        graph.append(breadcrumb_node(profile, page))
        faqs = faq_map.get(page["file"])
        if faqs:
            graph.append(faqpage_node(faqs))
    ld = {"@context": "https://schema.org", "@graph": graph}
    lines.append(json_ld_script(ld))

    # GA4
    ga = site.get("ga4MeasurementId")
    if ga:
        lines.append('<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>' % ga)
        lines.append("<script>")
        lines.append("  window.dataLayer = window.dataLayer || [];")
        lines.append("  function gtag(){dataLayer.push(arguments);}")
        lines.append("  gtag('js', new Date());")
        lines.append("  gtag('config', '%s');" % ga)
        lines.append("</script>")
    else:
        omit("%s: GA4 gtag (ga4MeasurementId=null)" % page["file"])

    return "\n".join(lines)


# ---------------------------------------------------------------- LEAD 블록

def build_lead(lead_map, page):
    txt = lead_map.get(page["file"])
    if not txt:
        return None
    # 커스텀 클래스 없이 평범한 <p> — 기존 문단 스타일을 상속한다.
    return "<p>%s</p>" % esc_text(txt)


# ---------------------------------------------------------------- FAQ 블록

def build_faq(faqs):
    lines = ['<section class="faq-sec" aria-label="자주 묻는 질문">',
             '  <div class="faq-wrap">',
             '    <h2 class="faq-title">자주 묻는 질문</h2>',
             '    <div class="faq">']
    for f in faqs:
        lines.append('      <details class="faq-item">')
        lines.append('        <summary>%s</summary>' % esc_text(f["q"]))
        lines.append('        <div class="faq-a">%s</div>' % esc_text(f["a"]))
        lines.append('      </details>')
    lines.append('    </div>')
    lines.append('  </div>')
    lines.append('</section>')
    return "\n".join(lines)


# ---------------------------------------------------------------- COUNTERS 블록

def build_counters(profile):
    """
    #stats 의 기존 .stat-col / .stat-num / .stat-label 구조 그대로 생성.
    숫자는 텍스트로 직접 출력(JS 꺼져도 실제 숫자 노출), 단위는 <em>.
    숫자가 아닌 값/null 은 data 숫자가 없어 JS 애니메이션이 적용되지 않는다.
    """
    counters = profile["heroCounters"]
    year_now = datetime.date.today().year
    founded = profile["company"]["foundedYear"]
    lines = []
    for i, c in enumerate(counters):
        label = esc_text(c["label"])
        unit = esc_text(c.get("unit") or "")
        val = c["value"]
        if val is None:
            warn("index.html 카운터 '%s': value=null — 숫자 미출력(수동 확인 필요)" % c["id"])
            num_text = ""
        elif val == "auto":
            num_text = str(year_now - founded + 1)
        elif isinstance(val, (int, float)):
            num_text = str(int(val))
        else:
            # 숫자가 아닌 글자(예: "수백") — 그대로 표시, 애니메이션 미적용
            num_text = esc_text(str(val))
        delay = "" if i == 0 else ' style="transition-delay:.%ds"' % i
        em = ("<em>%s</em>" % unit) if unit else ""
        lines.append('<div class="stat-col sr"%s>' % delay)
        lines.append('  <div class="stat-num">%s%s</div>' % (num_text, em))
        lines.append('  <div class="stat-label">%s</div>' % label)
        lines.append('</div>')
    return "\n".join(lines)


def build_copyright(profile):
    year = datetime.date.today().year
    return "&copy; %d %s. All rights reserved." % (year, esc_text(profile["company"]["legalName"]))


# ---------------------------------------------------------------- 페이지 존재 판정

def page_file_path(page):
    return os.path.join(ROOT, page["file"])


def page_exists(page):
    return os.path.exists(page_file_path(page))


def existing_pages(profile):
    return [p for p in profile["pages"] if page_exists(p)]


def existing_service_pages(profile):
    return [p for p in profile["pages"] if p["type"] == "service" and page_exists(p)]


# ---------------------------------------------------------------- 생성 파일: robots

def build_robots(profile):
    base = profile["site"]["baseUrl"]
    lines = ["User-agent: *", "Allow: /"]
    for p in profile["privatePaths"]:
        lines.append("Disallow: %s" % p)
    lines.append("")
    lines.append("Sitemap: %s/sitemap.xml" % base)
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- 생성 파일: sitemap

def git_lastmod(fpath):
    """커밋 이후 수정됨(git에서 변경/미추적)이면 오늘, 아니면 마지막 커밋 날짜."""
    try:
        st = subprocess.run(
            ["git", "status", "--porcelain", "--", fpath],
            cwd=ROOT, capture_output=True, text=True,
        )
        if st.stdout.strip():
            return datetime.date.today().isoformat()
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", fpath],
            cwd=ROOT, capture_output=True, text=True,
        )
        d = out.stdout.strip()
        if d:
            return d
    except Exception:
        pass
    ts = os.path.getmtime(fpath)
    return datetime.date.fromtimestamp(ts).isoformat()


def build_sitemap(profile):
    base = profile["site"]["baseUrl"]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in profile["pages"]:
        if not page_exists(p):
            continue
        loc = page_url(base, p["path"])
        lastmod = git_lastmod(page_file_path(p))
        prio = p.get("priority")
        lines.append("  <url>")
        lines.append("    <loc>%s</loc>" % loc)
        lines.append("    <lastmod>%s</lastmod>" % lastmod)
        if prio is not None:
            lines.append("    <priority>%.1f</priority>" % float(prio))
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- 생성 파일: llms.txt

def build_llms(profile):
    site = profile["site"]
    co = profile["company"]
    ct = profile["contact"]
    base = site["baseUrl"]
    addr = ct["address"]

    emails = ", ".join("%s (%s)" % (e["address"], e["label"]) for e in ct["emails"])
    addr_line = "%s %s %s (우 %s)" % (
        addr["addressRegion"], addr["addressLocality"],
        addr["streetAddress"], addr["postalCode"])

    lines = []
    lines.append("# %s (%s)" % (co["name"], co["alternateName"]))
    lines.append("")
    lines.append("> %s" % co["description"])
    lines.append("")
    lines.append("## 연락처")
    lines.append("- 전화: %s" % ct["telephone"])
    lines.append("- 팩스: %s" % ct["fax"])
    lines.append("- 이메일: %s" % emails)
    lines.append("- 주소: %s" % addr_line)
    lines.append("")
    lines.append("## 서비스 지역")
    lines.append(", ".join(profile["areaServed"]))
    lines.append("")
    lines.append("## 서비스")
    for p in existing_service_pages(profile):
        lines.append("- [%s](%s): %s" % (
            p["serviceName"], page_url(base, p["path"]), p["description"]))
    lines.append("")
    lines.append("## 보유 등록·신고")
    for r in profile["registrations"]:
        if r.get("number"):
            lines.append("- %s (%s, %s)" % (r["name"], r["law"], r["number"]))
        else:
            lines.append("- %s (%s)" % (r["name"], r["law"]))
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- 페이지 처리

def process_pages(profile, lead_map, faq_map):
    for page in profile["pages"]:
        fpath = page_file_path(page)
        if not page_exists(page):
            warn("HTML 파일 없음 — 건너뜀(sitemap·llms·JSON-LD 목록 제외): %s" % page["file"])
            continue

        text = read_text(fpath)
        orig = text

        # SEO
        if has_block(text, "SEO"):
            text, _ = replace_block(text, "SEO", build_seo(profile, page, faq_map))
        else:
            warn("%s: SEO 블록 없음 — 삽입하지 않음" % page["file"])

        # LEAD
        if has_block(text, "LEAD"):
            lead = build_lead(lead_map, page)
            if lead is not None:
                text, _ = replace_block(text, "LEAD", lead)
            else:
                warn("%s: LEAD 데이터 없음(lead.json)" % page["file"])
        else:
            warn("%s: LEAD 블록 없음 — 삽입하지 않음" % page["file"])

        # FAQ
        if has_block(text, "FAQ"):
            faqs = faq_map.get(page["file"])
            if faqs:
                text, _ = replace_block(text, "FAQ", build_faq(faqs))
            else:
                warn("%s: FAQ 데이터 없음(faq.json)" % page["file"])
        else:
            warn("%s: FAQ 블록 없음 — 삽입하지 않음" % page["file"])

        # COUNTERS / COPYRIGHT (index 만)
        if page["type"] == "home":
            if has_block(text, "COUNTERS"):
                text, _ = replace_block(text, "COUNTERS", build_counters(profile))
            else:
                warn("%s: COUNTERS 블록 없음 — 삽입하지 않음" % page["file"])
            if has_block(text, "COPYRIGHT"):
                text, _ = replace_block(text, "COPYRIGHT", build_copyright(profile))
            else:
                warn("%s: COPYRIGHT 블록 없음 — 삽입하지 않음" % page["file"])

        if text != orig:
            write_if_changed(fpath, to_crlf(text))


# ---------------------------------------------------------------- 생성 파일 처리

def process_generated(profile):
    outputs = {
        os.path.join(ROOT, "robots.txt"): build_robots(profile),
        os.path.join(ROOT, "sitemap.xml"): build_sitemap(profile),
        os.path.join(ROOT, "llms.txt"): build_llms(profile),
    }
    for path, body in outputs.items():
        write_if_changed(path, to_crlf(body))


# ---------------------------------------------------------------- main

def report_null_omissions(profile):
    """site-profile.json 의 null 옵션 항목을 기록."""
    co = profile["company"]
    if co.get("businessRegistrationNo") is None:
        omit("company.businessRegistrationNo=null (사업자등록번호 미표기)")
    same = profile["sameAs"]
    for k, v in same.items():
        if v is None:
            omit("sameAs.%s=null" % k)
    for r in profile["registrations"]:
        if not r.get("number"):
            omit("등록번호 없음: %s" % r["name"])


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    profile = read_json(PROFILE_PATH)
    lead_map = read_json(os.path.join(CONTENT_DIR, "lead.json"))
    faq_map = read_json(os.path.join(CONTENT_DIR, "faq.json"))

    report_null_omissions(profile)
    process_pages(profile, lead_map, faq_map)
    process_generated(profile)

    print("=== build_seo.py ===")
    print("[변경된 파일] %d개" % len(CHANGED))
    for f in CHANGED:
        print("  - %s" % f)
    print("[null 생략 항목] %d개" % len(OMITTED))
    for o in OMITTED:
        print("  - %s" % o)
    print("[경고] %d개" % len(WARNINGS))
    for w in WARNINGS:
        print("  ! %s" % w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
