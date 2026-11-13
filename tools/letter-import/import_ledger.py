# -*- coding: utf-8 -*-
"""공문 발송대장(예전 엑셀) → 공문 대장(official_letters) 가져오기 자료 만들기 — 1회용.

원본 엑셀은 읽기만 한다(xlrd 로 열기만, 저장하지 않음). 결과는 저장소 **밖** 폴더에 쓴다
(대장 내용 = 업무 자료라 공개 저장소에 두지 않는다). 이 스크립트에는 자료가 들어 있지 않다.

    python -I tools/letter-import/import_ledger.py <원본.xls> <저장소 밖 결과 폴더>

결과: rows.json — [연도, 대장 번호, 중복표시(1이면 seq 비움), 'YYMMDD', 수신처, 제목, 작성자, 비고] 배열
      log.json  — 규칙대로 고친 행 기록
DB 에 넣는 일은 rows.json 을 SQL(jsonb)로 넘겨 1회 실행했다(작업 기록은 저장소 밖 security-fix\163_*).

규칙(2026-11-13)
- 시트 「공문발송대장(YYYY)」 만(「공문접수대장」 등 그 밖의 시트는 무시). 1·2행 = 제목·머리글.
- 일자나 제목이 있는 행만(번호만 있는 빈 예약 행, 작성자만 있는 행은 버림).
- 번호 칸이 비면 대장 번호 없음(seq·doc_no 비움).
- 같은 해 같은 번호가 다시 나오면 뒤 행은 중복표시(대장 번호 글자는 남기고 seq 는 비움).
- 일자 칸이 'YY.MM.DD' 모양이 아니고 제목이 비어 있으면 그 글자를 제목으로 옮기고 일자는 비움.
- 글자 칸은 앞뒤 빈칸만 정리.
"""
import json, os, re, sys

import xlrd

SHEET = re.compile(r'^공문발송대장\((\d{4})\)$')
DATE = re.compile(r'^(\d{2})\.(\d{1,2})\.(\d{1,2})$')


def cell_text(v):
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    return str(v).strip()


def main(src, out_dir):
    src_abs = os.path.abspath(src)
    out_abs = os.path.abspath(out_dir)
    repo = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    if out_abs == repo or out_abs.startswith(repo + os.sep):
        sys.exit('결과 폴더는 저장소 밖이어야 해요: ' + out_abs)
    book = xlrd.open_workbook(src_abs, on_demand=True)
    rows, log = [], []
    for name in book.sheet_names():
        m = SHEET.match(name.strip())
        if not m:
            continue
        year = int(m.group(1))
        sh = book.sheet_by_name(name)
        seen = set()
        for r in range(2, sh.nrows):
            v = [sh.cell_value(r, c) if c < sh.ncols else '' for c in range(6)]
            no = v[0]
            seq = int(no) if isinstance(no, float) else (int(no) if str(no).strip().isdigit() else None)
            date, rcpt, title, author, note = (cell_text(x) for x in v[1:6])
            if date and not DATE.match(date) and not title:
                log.append([year, r + 1, 'date cell not a date -> title', seq, date])
                title, date = date, ''
            if not date and not title:
                continue
            ymd = ''
            if date:
                d = DATE.match(date)
                ymd = '%02d%02d%02d' % (int(d.group(1)), int(d.group(2)), int(d.group(3)))
            dup = 0
            if seq is not None:
                if seq in seen:
                    dup = 1
                    log.append([year, r + 1, 'dup seq -> seq null', seq, title])
                seen.add(seq)
            rows.append([year, seq, dup, ymd, rcpt, title, author, note])
    os.makedirs(out_abs, exist_ok=True)
    with open(os.path.join(out_abs, 'rows.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(out_abs, 'log.json'), 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False)
    by = {}
    for x in rows:
        by[x[0]] = by.get(x[0], 0) + 1
    print('행', len(rows), by, '번호 없음', sum(1 for x in rows if x[1] is None or x[2]), '기록', len(log))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
