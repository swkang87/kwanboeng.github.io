"""준공사진 생성기(웹) 파일 목록 만들기 + 엔진 원본 대조 (2026-11-09).

사용:
  python tools/jungong/make_manifest.py                      → files.json 다시 만들기
  python tools/jungong/make_manifest.py --check <원본 폴더>   → 만들기 + 원본 파일목록_SHA256.json 과 대조 표

files.json = 작업자(jungong-worker.js)가 내려받을 파일과 SHA256. 작업자는 받은 바이트의 SHA256 이 다르면 멈춘다.
엔진을 바꿀 때(새 버전 engine.py · assets): 원본 폴더에서 engine.py 와 assets(source 제외)를 복사 → 이 스크립트를 --check 로 실행
→ 「다름」이 0 인지 확인 → docs.html 의 JUNGONG_V 를 출력된 값으로 바꾼다.
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
INCLUDE = ['engine.py', 'web_bridge.py']
DIRS = ['assets', 'fonts', 'wheels']


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def build() -> dict:
    files = []
    for name in INCLUDE:
        files.append(name)
    for d in DIRS:
        for p in sorted((HERE / d).rglob('*')):
            if p.is_file() and p.suffix.lower() not in ('.txt',):   # 라이선스 글은 내려받지 않는다
                files.append(p.relative_to(HERE).as_posix())
    entries = [{'path': f, 'sha256': sha(HERE / f), 'size': (HERE / f).stat().st_size} for f in files]
    # 버전 = 파일 목록 + 작업자 스크립트(jungong-worker.js — 목록에는 없지만 바뀌면 브라우저가 새로 받아야 한다)
    ver = hashlib.sha256((json.dumps(entries, sort_keys=True) + sha(HERE / 'jungong-worker.js')).encode()).hexdigest()[:12]
    return {'version': ver, 'files': entries}


def main():
    m = build()
    (HERE / 'files.json').write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
    total = sum(e['size'] for e in m['files'])
    print(f"files.json: {len(m['files'])}개 · {total / 1048576:.1f} MB · version {m['version']}  (docs.html JUNGONG_V)")
    if len(sys.argv) >= 3 and sys.argv[1] == '--check':
        src = Path(sys.argv[2])
        orig = json.loads((src / '파일목록_SHA256.json').read_text(encoding='utf-8'))
        rows, bad = [], 0
        for e in m['files']:
            p = e['path']
            if p == 'engine.py' or p.startswith('assets/'):
                o = orig.get(p)
                ok = o == e['sha256']
                bad += 0 if ok else 1
                rows.append((p, (o or '(목록에 없음)')[:16], e['sha256'][:16], '같음' if ok else '다름'))
        for k in orig:
            if (k == 'engine.py' or k.startswith('assets/')) and not k.startswith('assets/source/') and not any(r[0] == k for r in rows):
                bad += 1; rows.append((k, orig[k][:16], '(복사 안 됨)', '다름'))
        print('| 파일 | 원본 목록 SHA256 | 복사본 SHA256 | 결과 |')
        print('|---|---|---|---|')
        for r in rows:
            print('| ' + ' | '.join(r) + ' |')
        print(f'다름 {bad}건')
        sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
