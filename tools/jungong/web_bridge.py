"""준공사진 생성기 — 웹 화면(docs.html#jungong) ↔ engine.py 연결 (2026-11-09).

브라우저 안 파이썬(Pyodide, Web Worker)에서 돈다. jungong-worker.js 가 불러 쓴다.
- 엔진 로직은 여기에 다시 쓰지 않는다. engine.py 는 원본 그대로(파일목록 SHA256 과 같아야 한다).
- 순서는 app.py(Tk 입력창)가 하던 그대로: 입력값 → State(검증) → Renderer → 미리보기·저장.
- 파일은 브라우저 저장소가 아니라 Pyodide 메모리 파일시스템의 임시 폴더에 만들고 ZIP 바이트로 돌려준 뒤 지운다.
- 상태(state)는 State.to_dict() 와 같은 모양의 JSON 문자열로 주고받는다.
"""
from __future__ import annotations
import copy
import io
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

import engine as E


def _png(im: Image.Image, level: int = 1) -> bytes:
    b = io.BytesIO()
    im.save(b, format='PNG', compress_level=level)
    return b.getvalue()


def _state(state_json: str, validate: bool = True) -> E.State:
    """app.py get_state() 와 같은 일: 화면 값 → State. 수량 글자는 정수로(같은 오류 문구)."""
    d = json.loads(state_json)
    items = []
    for it in d.get('items', []):
        it = dict(it)
        try:
            it['count'] = int(str(it.get('count', '')).strip())
        except ValueError:
            raise ValueError('수량은 0~60의 정수로 입력하세요.')
        items.append(it)
    d['items'] = items
    st = E.State.from_dict(d)
    # 「자동 생성」이 켜져 있으면 표지 공사명은 State.title() 이 용역명에서 만든다(cover_title 값은 쓰이지 않음).
    # 화면은 자동 공사명을 보여 주기만 하고, 끌 때 그 값을 칸에 넣는다(app.py auto_change 와 같은 결과).
    if validate:
        st.validate()
    return st


def meta() -> dict:
    """화면 선택 목록 · 기본값(엔진 상수 그대로)."""
    st = E.State()
    return {
        'version': E.VERSION,
        'kinds': list(E.KINDS),
        'default_names': dict(E.DEFAULT_NAMES),
        'units': dict(E.UNITS),
        'layouts': list(E.LAYOUTS),
        'backgrounds': [b['name'] for b in E.BG_LIST],
        'logos': [l['name'] for l in E.LOGOS],
        'knot_options': [[k, v] for k, v in E.KNOT_OPTIONS.items()],
        'stack_options': [[k, v] for k, v in E.STACK_OPTIONS.items()],
        'default_state': st.to_dict(),
        'font_regular': E.find_font(st.font, False),
        'font_bold': E.find_font(st.font, True),
    }


def check(state_json: str) -> dict:
    """미리보기 전 확인(app.py request_preview 앞부분): 검증 · 수량 문구 · 로고 · 장수 확인창 판단 값."""
    try:
        st = _state(state_json, True)
    except Exception as e:  # app.py 도 상태줄에 오류 문구만 보여 준다
        d = json.loads(state_json)
        auto = E.construction_title(' '.join(str(d.get('service_title', '')).split()))
        return {'ok': False, 'error': str(e), 'auto_title': auto}
    out = {
        'ok': True,
        'error': '',
        'auto_title': E.construction_title(st.service_title),
        'summary': E.summary(st),
        'sig': json.dumps(list(E.pagination_signature(st)), ensure_ascii=False),
        'rec': int(E.recommended_page_count(st)),
        'total': int(sum(i.count for i in st.items if i.selected)),
        'logo': None,
        'logo_status': '',
    }
    try:
        im = E.resolve_logo(st)
        if im:
            im.thumbnail((110, 38))
            out['logo'] = _png(im, 6)
            out['logo_status'] = '사용자 로고 적용' if st.custom_logo else '제공된 PDF의 기관 로고 자동 적용'
        else:
            out['logo_status'] = '연결된 로고가 없어 기관명만 표시됩니다.'
    except Exception:
        out['logo_status'] = '로고를 확인하세요.'
    return out


def preview(state_json: str, page: int = 0, width: int = 1200, tab: str = 'photo') -> dict:
    """미리보기(app.py request_preview 의 job). 합성사진은 항상(끌어 옮기기용 히트박스 포함), 다른 탭은 고른 것만."""
    st = _state(state_json, True)
    r = E.Renderer(st)
    pages = len(r.pages())
    actual = min(max(0, int(page)), pages - 1)
    photo, hits, H = r.render_photo(actual, int(width), True)
    out = {
        'pages': pages,
        'page': actual,
        'warnings': r.warnings(),
        'photo': _png(photo),
        'photo_size': [photo.width, photo.height],
        'H': np.asarray(H, dtype=float).tolist(),
        'Hinv': np.linalg.inv(np.asarray(H, dtype=float)).tolist(),
        'hits': [{'id': p['id'], 'stack_id': p.get('stack_id'), 'name': p['item'].name, 'quad': quad} for p, quad in hits],
        'state': st.to_dict(),
        'image': None,
    }
    if tab == 'page':
        out['image'] = _png(r.page_image(actual, 950, photo))
    elif tab in ('cover', 'binder', 'cd'):
        kinds = ['design', 'waste'] if tab == 'binder' else ['drawing' if tab == 'cover' else 'cd']
        it = next((i for i in st.items if i.kind in kinds and i.selected and i.count), None)
        if it:
            if tab == 'cover':
                im = r.cover(it, False).convert('RGB')
            elif tab == 'binder':
                im = r.binder_label(it, 1250, 190, False).convert('RGB')
            else:
                im = r.cd_insert(it, 800, 800, False).convert('RGB')
        else:
            im = Image.new('RGB', (800, 450), 'white')
        out['image'] = _png(im)
    return out


def reassign_knots(state_json: str) -> dict:
    """[매듭 다시 배정] = app.py new_knots: 자동(실물 4종)으로 두고 배정 번호만 +1. 배치·수량·문구는 그대로."""
    d = json.loads(state_json)
    try:
        seed = int(d.get('knot_seed') or 7)
    except (TypeError, ValueError):
        seed = 7
    return {'knot_mode': 'varied', 'knot_seed': (seed + 1) % 2147483648}


def export_check(state_json: str, mode: str) -> dict:
    """저장 전 확인(app.py _export_job): 로고 없음 · (PDF 가 아니면) 보드 밖 경고만 모아 묻는다."""
    st = _state(state_json, True)
    r = E.Renderer(st)
    warnings = [w for w in r.warnings() if '로고' in w or (mode != 'pdf' and '보드 밖' in w)]
    return {'warnings': warnings, 'title': st.title()}


def _zip_dir(folder: Path) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file():
                z.write(p, Path(folder.name) / p.relative_to(folder))
    return b.getvalue()


def _run(state_json: str, mode: str, progress=None) -> dict:
    """app.py _export_job 의 job 부분. 폴더 이름도 같게(준공사진_공사명[_인쇄용|_배치비교])."""
    st = _state(state_json, True)
    name = '준공사진_' + E.safe_filename(st.title()) + ('_인쇄용' if mode == 'pdf' else '_배치비교' if mode == 'layouts' else '')
    root = Path(tempfile.mkdtemp(prefix='jungong_'))
    out = root / name
    try:
        out.mkdir(parents=True, exist_ok=True)
        if mode == 'pdf':
            paths = E.export_print_pdfs(st, out)
            note = f'인쇄용 PDF {len(paths)}개 저장. 인쇄할 때 실제 크기(100%)를 선택하세요.'
        elif mode == 'layouts':
            paths = []
            for lay in range(3):
                st2 = copy.deepcopy(st); st2.layout = lay; st2.offsets = {}; rr = E.Renderer(st2)
                for pg in range(len(rr.pages())):
                    if progress: progress(f'배치 {lay + 1}/3 · {pg + 1}쪽 생성 중')
                    pp = out / f'배치{lay + 1}_{pg + 1:02}.png'; rr.render_photo(pg).save(pp); paths.append(pp)
            E.atomic_json(out / '입력값.json', st.to_dict())
            note = f'실제 프로그램으로 만든 배치 비교 PNG {len(paths)}개 저장.'
        else:
            paths = E.Renderer(st).export_bundle(out, progress)
            note = '합성사진 PNG, 준공사진 페이지 PNG, 편집 가능한 상단 제목의 PPTX, 설정 JSON을 저장했습니다.'
        if progress: progress('ZIP 묶는 중')
        data = _zip_dir(out)
        files = sorted(p.name for p in out.rglob('*') if p.is_file())
        return {'name': name + '.zip', 'zip': data, 'files': files, 'note': note, 'state': st.to_dict()}
    finally:
        shutil.rmtree(root, ignore_errors=True)


def export_bundle(state_json: str, progress=None) -> dict:
    """PNG · PPTX 저장: 합성사진 PNG · 준공사진 페이지 PNG · PPTX · 설정 JSON · 성과품수량 TXT · 배치정보 JSON → ZIP."""
    return _run(state_json, 'bundle', progress)


def export_print_pdfs(state_json: str, progress=None) -> dict:
    """인쇄용 PDF(A3 표지 · A4 가로 바인더 라벨 · 책자 표지 · CD 라벨) → ZIP."""
    return _run(state_json, 'pdf', progress)


def export_layouts(state_json: str, progress=None) -> dict:
    """배치 3종 비교 저장 → ZIP."""
    return _run(state_json, 'layouts', progress)


def import_logo(data: bytes, filename: str = 'logo.png') -> str:
    """[다른 로고 선택] = engine.import_logo(경로). 받은 바이트를 임시 파일에 써서 그대로 넘긴다 → custom_logo(base64 PNG)."""
    suffix = Path(filename).suffix.lower() or '.png'
    root = Path(tempfile.mkdtemp(prefix='jungong_logo_'))
    try:
        p = root / ('logo' + suffix)
        p.write_bytes(data.to_bytes() if hasattr(data, 'to_bytes') else bytes(data))   # 브라우저 Uint8Array(JsProxy) 또는 bytes
        return E.import_logo(str(p))
    finally:
        shutil.rmtree(root, ignore_errors=True)


def load_project(text: str) -> dict:
    """프로젝트 열기: State.from_dict 그대로(v2.0·v2.1 형식도 — 이전 겹침·이동 좌표 유지)."""
    return E.State.from_dict(json.loads(text)).to_dict()


def save_project(state_json: str) -> dict:
    """프로젝트 저장(app.py save_project): 검증 없이 State → JSON(atomic_json 과 같은 모양) + 파일 이름."""
    st = _state(state_json, False)
    return {'name': E.safe_filename(st.title()) + '.json',
            'text': json.dumps(st.to_dict(), ensure_ascii=False, indent=2)}
