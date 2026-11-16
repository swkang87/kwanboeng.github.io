#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_pwa.py — 휴대폰 앱(PWA) manifest·아이콘 생성기 (2026-11-16)

입력:
  - config.js 의 APP_CONFIG.PWA (이름 · 짧은 이름 · 색 · 시작 주소 · 아이콘 경로) — node 로 읽는다
  - 아이콘 원본 PNG (기본 = 저장소 옆 desktop-app/branding/icon.png, 1024px 정사각형 · 투명 배경)

하는 일:
  1) 루트에 manifest.webmanifest (CRLF, UTF-8 BOM 없음, 같은 입력이면 같은 출력)
  2) 아이콘 4개: 192 · 512 (any) · maskable 512 (안전 원 80% 안) · apple-touch 180
     배경 = PWA.BACKGROUND_COLOR (원본의 투명 부분을 채운다 — 아이폰은 투명을 검게 칠함)

실행: python tools/build_pwa.py [아이콘 원본 경로]   (저장소 루트에서)
필요: node, Pillow
회사 값은 이 파일에 없다 — 모두 config.js 에서 읽는다.
"""
import json, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(os.path.dirname(ROOT), 'desktop-app', 'branding', 'icon.png')

JS = r"""
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8') + ';this.__c = APP_CONFIG;', ctx);
process.stdout.write(JSON.stringify(ctx.__c));
"""


def load_config():
    out = subprocess.run(['node', '-e', JS, os.path.join(ROOT, 'config.js')],
                         capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def icon(src, size, bg, frac, circle=False):
    """원본 로고(투명 여백을 잘라 낸 것)를 size 정사각형 가운데에 놓는다.
    frac = 로고가 차지할 최대 비율. circle=True 면 로고 상자의 대각선이 지름 frac 원 안에 들어가게(maskable 안전 영역)."""
    logo = src.crop(src.getchannel('A').getbbox())
    w, h = logo.size
    if circle:
        s = (frac * size) / ((w * w + h * h) ** 0.5)
    else:
        s = (frac * size) / max(w, h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    logo = logo.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg + (255,))
    canvas.alpha_composite(logo, ((size - nw) // 2, (size - nh) // 2))
    return canvas.convert('RGB')


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    cfg = load_config()
    p = cfg.get('PWA') or {}
    if not p:
        sys.exit('config.js 에 PWA 가 없습니다')
    icons = p['ICONS']
    bg = hex_rgb(p.get('BACKGROUND_COLOR') or '#ffffff')
    theme = p.get('THEME_COLOR') or cfg.get('COLOR_PRIMARY') or '#0f172a'

    src = Image.open(src_path).convert('RGBA')
    plan = [
        (icons['ICON_192'], 192, 0.86, False),
        (icons['ICON_512'], 512, 0.86, False),
        (icons['MASKABLE_512'], 512, 0.78, True),   # 안전 원 = 지름 80% — 조금 더 안쪽
        (icons['APPLE_TOUCH'], 180, 0.80, False),
    ]
    for rel, size, frac, circ in plan:
        dst = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        icon(src, size, bg, frac, circ).save(dst, 'PNG', optimize=True)
        print('아이콘', rel, size)

    manifest = {
        'name': p['NAME'],
        'short_name': p['SHORT_NAME'],
        'lang': 'ko',
        'dir': 'ltr',
        'start_url': p.get('START_URL') or 'home.html',
        'scope': './',
        'id': p.get('START_URL') or 'home.html',
        'display': p.get('DISPLAY') or 'standalone',
        'orientation': 'any',
        'theme_color': theme,
        'background_color': p.get('BACKGROUND_COLOR') or '#ffffff',
        'icons': [
            {'src': icons['ICON_192'], 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': icons['ICON_512'], 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': icons['MASKABLE_512'], 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    out = os.path.join(ROOT, p.get('MANIFEST') or 'manifest.webmanifest')
    with open(out, 'wb') as f:
        f.write(text.replace('\n', '\r\n').encode('utf-8'))
    print('manifest', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
