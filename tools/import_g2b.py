#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_g2b.py — 나라장터 '계약체결관리 목록' xlsx → site-content/public-works.json

사용: python tools/import_g2b.py <xlsx> [출력경로]
      출력경로 기본값: site-content/public-works.json

- 표준 라이브러리만 사용(xlsx 를 zip + xml 로 직접 읽는다).
- 헤더 행은 '순번' 셀로 찾는다. 읽는 열: 계약번호, 계약명, 처리상태, 계약기관명, 초안송신일자.
  계약담당자·금액 열은 읽지 않는다.
- 제외: 처리상태가 EXCLUDE_STATUS 에 있는 행, 계약번호 중복(먼저 나온 행만 유지).
- 분류: CATEGORY_RULES 를 위에서부터 검사해 먼저 맞는 것.
- 출력: [{year, name, agency, category}] — 연도 내림차순 → 이름 오름차순. 계약번호는 넣지 않는다.
  저장은 CRLF, UTF-8 BOM 없음.
"""

import collections
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "site-content", "public-works.json")

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

COLS = {"no": "계약번호", "name": "계약명", "status": "처리상태",
        "agency": "계약기관명", "date": "초안송신일자"}
EXCLUDE_STATUS = {"해지·해제", "응답작성중", "응답완료"}

# 위에서부터 먼저 맞는 규칙을 쓴다.
# utility 는 '설계'가 들어 있으면 건너뛴다(예: "세척 및 탑코팅 … 실시설계" → design).
CATEGORY_RULES = [
    ("cm",       r"건설사업관리|감리"),
    ("geotech",  r"지하안전"),
    ("safety",   r"안전점검|정밀점검|안전진단"),
    ("utility",  r"^(?!.*설[계게]).*(상수도관.*세척|공업용수관.*세척|세척용역|누수)"),
    ("survey",   r"측량|UIS|DB ?구축"),
    ("planning", r"도시관리계획|지구단위계획 결정|도시계획시설|실시계획|도로구역 결정"),
    ("study",    r"조사용역|기본조사|공급방안|사용검토|구조검토"),
    ("design",   r"설계|설게"),
]
CATEGORY_RULES = [(c, re.compile(p)) for c, p in CATEGORY_RULES]


def classify(name):
    for cat, rx in CATEGORY_RULES:
        if rx.search(name):
            return cat
    return "etc"


# ---------------------------------------------------------------- xlsx 읽기

def col_letters(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def first_sheet_path(z):
    """workbook.xml 의 첫 시트 → rels 로 실제 파일 경로."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    sheet = wb.find(NS + "sheets").find(NS + "sheet")
    rid = sheet.get(RNS + "id")
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    for r in rels:
        if r.get("Id") == rid:
            target = r.get("Target").lstrip("/")
            return target if target.startswith("xl/") else "xl/" + target
    return "xl/worksheets/sheet1.xml"


def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    root = ET.fromstring(z.read(first_sheet_path(z)))
    rows = []
    for r in root.iter(NS + "row"):
        row = {}
        for c in r.findall(NS + "c"):
            t = c.get("t")
            v = c.find(NS + "v")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else:
                val = v.text if v is not None else ""
            row[col_letters(c.get("r"))] = (val or "").strip()
        rows.append(row)
    return rows


def find_header(rows):
    for i, r in enumerate(rows):
        if "순번" in r.values():
            return i, {v: k for k, v in r.items() if v}
    raise SystemExit("헤더 행('순번')을 찾지 못했습니다.")


# ---------------------------------------------------------------- 변환

def year_of(s):
    m = re.match(r"\s*(\d{4})", s or "")
    return int(m.group(1)) if m else None


def convert(xlsx):
    rows = read_rows(xlsx)
    hi, hdr = find_header(rows)
    missing = [v for v in COLS.values() if v not in hdr]
    if missing:
        raise SystemExit("필요한 열이 없습니다: %s" % ", ".join(missing))
    col = {k: hdr[v] for k, v in COLS.items()}

    stats = collections.Counter()
    seen = set()
    out = []
    for r in rows[hi + 1:]:
        name = r.get(col["name"], "")
        no = r.get(col["no"], "")
        if not name and not no:
            continue
        stats["읽은 행"] += 1
        status = r.get(col["status"], "")
        if status in EXCLUDE_STATUS:
            stats["제외: " + status] += 1
            continue
        if no in seen:
            stats["제외: 계약번호 중복"] += 1
            continue
        seen.add(no)
        year = year_of(r.get(col["date"], ""))
        if year is None:
            stats["제외: 날짜 없음"] += 1
            continue
        out.append({"year": year, "name": re.sub(r"\s+", " ", name),
                    "agency": r.get(col["agency"], ""), "category": classify(name)})
    out.sort(key=lambda x: (-x["year"], x["name"]))
    return out, stats


def dump(items):
    lines = ["["]
    for i, it in enumerate(items):
        lines.append("  " + json.dumps(it, ensure_ascii=False) + ("," if i < len(items) - 1 else ""))
    lines.append("]")
    return "\r\n".join(lines) + "\r\n"


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용: python tools/import_g2b.py <xlsx> [출력경로]")
    xlsx = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    items, stats = convert(xlsx)
    data = dump(items).encode("utf-8")
    old = open(out_path, "rb").read() if os.path.exists(out_path) else None
    if old != data:
        with open(out_path, "wb") as f:
            f.write(data)
    print("=== import_g2b.py ===")
    for k, v in stats.items():
        print("  %s: %d" % (k, v))
    print("  출력: %d건 → %s (%s)" % (len(items), os.path.relpath(out_path, ROOT),
                                    "변경됨" if old != data else "변경 없음"))
    cats = collections.Counter(it["category"] for it in items)
    print("  분류: " + ", ".join("%s %d" % (c, n) for c, n in cats.most_common()))
    years = [it["year"] for it in items]
    if years:
        print("  연도: %d ~ %d" % (min(years), max(years)))


if __name__ == "__main__":
    main()
