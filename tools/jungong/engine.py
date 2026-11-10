"""준공사진 생성기 v2.2 — 로컬 사진 자산 + 정확한 문자 조판.

Runtime: Pillow, NumPy, OpenCV, python-pptx, ReportLab. No network/API calls.
Assets are prepared from the user's photographs and logo PDF, not AI calls.
Nominal document faces use A3 420x297 mm, A4 297x210 or 210x297 mm.
Perspective is calibrated on a 900x600 mm board; thickness/shadows are approximations.
"""
from __future__ import annotations
import base64
import copy
import hashlib
import io
import json
import math
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field, asdict
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from pptx import Presentation
from pptx.util import Cm, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor
from pptx.oxml.xmlchemy import OxmlElement
from pptx.opc.constants import RELATIONSHIP_TYPE as RT

BASE = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
ASSETS = BASE / 'assets'
VERSION = '2.2.0'
PROJECT = '중앙대로1134번길 일원 도로정비공사 외 3개소 실시설계용역'
FONT_CHOICES = ['맑은 고딕','HY견고딕','HY헤드라인M','돋움','굴림','나눔고딕']
KINDS = ['drawing','design','waste','report','spec','cd','usb']
DEFAULT_NAMES = dict(zip(KINDS,['설계도','설계서','폐기물처리용역설계서','보고서','공사시방서','CD','USB']))
UNITS = {'drawing':'부','design':'부','waste':'부','report':'부','spec':'부','cd':'매','usb':'개'}
# Soft thresholds used only to suggest a choice in the GUI; NEVER automatic caps.
SUGGESTED_CAPS = {'drawing':3,'design':2,'waste':2,'report':1,'spec':1,'cd':2,'usb':5}
LAYOUTS = ['1 · 기본 정렬형','2 · 좌우 교차형','3 · 전체 성과품형']
BG_LIST = json.loads((ASSETS / 'backgrounds.json').read_text(encoding='utf8'))
LOGOS = json.loads((ASSETS / 'logos.json').read_text(encoding='utf8'))
BINDER_META = json.loads((ASSETS / 'binders' / 'metadata.json').read_text(encoding='utf8'))
KNOT_OPTIONS = {
    'varied': '자동 · 실물 매듭 4종',
    '1': '매듭 1 · 넓은 고리',
    '2': '매듭 2 · 세로 고리',
    '3': '매듭 3 · 좌측 고리',
    '4': '매듭 4 · 작은 매듭',
    'legacy': '기존 v2.1 바인더',
}
STACK_OPTIONS = {'triple': '3부씩 묶어 겹침 (추천)', 'shingle': '연속 겹침 (기존 배치)'}


# Only a design-service suffix at the end is removed; document names are untouched.
_SUFFIX = re.compile(r'\s*(?:기본\s*(?:및|[·ㆍ･&+])\s*실시\s*설계\s*용역|기본\s*및\s*실시설계\s*용역|실시\s*설계\s*용역|기본\s*설계\s*용역|설계\s*용역)\s*$')
def construction_title(service_title: str) -> str:
    text = ' '.join(service_title.split())
    return _SUFFIX.sub('', text).strip()

def safe_filename(text: str, limit: int = 95) -> str:
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', text).strip().rstrip('. ')
    return (text[:limit].rstrip('. ') or '준공사진')

@dataclass
class Item:
    kind: str
    name: str = ''
    count: int = 1
    selected: bool = True
    construction_name: str = ''
    def __post_init__(self):
        if self.kind not in KINDS: raise ValueError(f'알 수 없는 성과품: {self.kind}')
        if not self.name: self.name = DEFAULT_NAMES[self.kind]
        if not isinstance(self.count, int) or not 0 <= self.count <= 60:
            raise ValueError('성과품 수량은 0~60의 정수로 입력하세요.')

@dataclass
class State:
    service_title: str = PROJECT
    cover_title: str = ''
    auto_cover_title: bool = True
    authority: str = '부산광역시 연제구'
    binder_authority: str = ''
    date: str = '2026. 10.'
    font: str = '맑은 고딕'
    cover_color: str = '하늘색'
    background: int = 0
    layout: int = 2
    seed: int = 7
    natural_angles: bool = True
    custom_logo: str = ''  # base64 PNG, no external path dependency
    items: list[Item] = field(default_factory=lambda: [
        Item('drawing', count=3), Item('design'), Item('waste'), Item('report'),
        Item('spec'), Item('cd'), Item('usb',count=3)])
    offsets: dict[str,list[float]] = field(default_factory=dict)
    page_policy: str = 'single'  # 'split' only after a user's explicit selection
    split_pages: int = 1
    knot_mode: str = 'varied'
    knot_seed: int = 7
    binder_stack_mode: str = 'triple'
    group_drag: bool = True
    def title(self, item: Item | None = None) -> str:
        if item and item.construction_name.strip(): return item.construction_name.strip()
        if self.auto_cover_title: return construction_title(self.service_title)
        return self.cover_title.strip() or construction_title(self.service_title)
    def validate(self):
        if not self.service_title.strip(): raise ValueError('용역명을 입력하세요.')
        if not self.title(): raise ValueError('표지 공사명을 입력하세요.')
        if len(self.service_title)>300: raise ValueError('용역명은 300자 이내로 입력하세요.')
        if not any(i.selected and i.count>0 for i in self.items):
            raise ValueError('성과품을 하나 이상 선택하고 수량을 입력하세요.')
        if not 0<=self.background<len(BG_LIST): raise ValueError('배경 선택이 올바르지 않습니다.')
        if not 0<=self.layout<3: raise ValueError('배치 선택이 올바르지 않습니다.')
        if self.page_policy not in ('single', 'split'):
            raise ValueError('사진 장수 설정이 올바르지 않습니다.')
        if not isinstance(self.split_pages, int) or not 1 <= self.split_pages <= 999:
            raise ValueError('분할 장수는 1~999의 정수로 입력하세요.')
        if self.page_policy == 'split' and self.split_pages < 2:
            raise ValueError('분할할 때는 2장 이상을 선택하세요.')
        if self.knot_mode not in KNOT_OPTIONS:
            raise ValueError('매듭 모양 선택이 올바르지 않습니다.')
        if not isinstance(self.knot_seed, int) or not 0 <= self.knot_seed <= 2147483647:
            raise ValueError('매듭 배정 번호는 0~2147483647 범위의 정수여야 합니다.')
        if self.binder_stack_mode not in STACK_OPTIONS:
            raise ValueError('바인더 겹침 방식 선택이 올바르지 않습니다.')
        for i in self.items:
            if i.kind not in KINDS or not 0<=int(i.count)<=60: raise ValueError('성과품 종류 또는 수량을 확인하세요.')
    def to_dict(self) -> dict:
        d=asdict(self);d['version']=VERSION;return d
    @classmethod
    def from_dict(cls,data:dict) -> 'State':
        d=copy.deepcopy(data);d.pop('version',None)
        accepted=set(cls.__dataclass_fields__)
        d={k:v for k,v in d.items() if k in accepted}
        if 'items' in d: d['items']=[Item(**i) for i in d['items']]
        # v2.0 configurations have no pagination choice: migrate to ONE photo.
        d.setdefault('page_policy', 'single')
        d.setdefault('split_pages', 1)
        # Old saved projects retain their prior layout and manual offsets.
        # New projects default to triple grouping; the GUI can switch old ones.
        d.setdefault('binder_stack_mode', 'shingle')
        d.setdefault('knot_mode', 'varied')
        d.setdefault('knot_seed', 7)
        return cls(**d)

def data_dir() -> Path:
    root=Path(os.environ.get('LOCALAPPDATA',Path.home()/'.local'/'share'))/'GwanboCompletionPhoto'
    root.mkdir(parents=True,exist_ok=True);return root

def atomic_json(path: Path, data: dict):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name(path.name+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8');os.replace(tmp,path)

def load_recent() -> State:
    p=data_dir()/'recent.json'
    if p.exists():
        try: return State.from_dict(json.loads(p.read_text(encoding='utf8')))
        except (ValueError,TypeError,KeyError,OSError): pass
    return State()

def save_recent(state: State): atomic_json(data_dir()/'recent.json',state.to_dict())

def summary(state:State, items:list[Item]|None=None) -> str:
    totals={}
    for it in items if items is not None else state.items:
        if it.selected and it.count>0:
            k=(it.name,UNITS[it.kind]);totals[k]=totals.get(k,0)+it.count
    return ', '.join(f'{n} {c}{u}' for (n,u),c in totals.items())

@lru_cache(maxsize=30)
def find_font(name:str='맑은 고딕', bold:bool=False) -> str:
    if Path(name).is_file(): return str(Path(name))
    candidates=[]
    if os.name=='nt':
        wd=Path(os.environ.get('WINDIR',r'C:\Windows'))/'Fonts'
        # Read installed font file names rather than redistributing any font.
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,r'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts') as key:
                idx=0;entries=[]
                while True:
                    try:
                        label,fn,_=winreg.EnumValue(key,idx);idx+=1
                        entries.append((label,fn))
                    except OSError: break
                aliases={'맑은 고딕':['맑은 고딕','Malgun Gothic'], '돋움':['돋움','Dotum'],
                         '굴림':['굴림','Gulim'],'나눔고딕':['나눔고딕','NanumGothic']}.get(name,[name])
                hits=[(l,f) for l,f in entries if any(a.lower() in l.lower() for a in aliases)]
                hits.sort(key=lambda x: (('bold' in x[0].lower())!=bold))
                candidates.extend([Path(f) if Path(f).is_absolute() else wd/f for _,f in hits])
        except (ImportError,OSError): pass
        candidates += [wd/('malgunbd.ttf' if bold else 'malgun.ttf'),wd/'gulim.ttc']
    candidates += [Path('/usr/share/fonts/truetype/nanum')/('NanumGothicBold.ttf' if bold else 'NanumGothic.ttf'),
                   Path('/usr/share/fonts/opentype/noto')/('NotoSansCJK-Bold.ttc' if bold else 'NotoSansCJK-Regular.ttc'),
                   Path('/System/Library/Fonts/AppleSDGothicNeo.ttc')]
    for p in candidates:
        if p.exists(): return str(p)
    raise RuntimeError('한글 글꼴을 찾지 못했습니다. 맑은 고딕 또는 나눔고딕을 설치하세요.')

@lru_cache(maxsize=600)
def font(size:int, family:str='맑은 고딕', bold:bool=False):
    return ImageFont.truetype(find_font(family,bold),max(1,int(size)))

def wrap_lines(text:str, f, max_width:float, max_lines:int=2) -> list[str]:
    text=text.strip()
    if not text:return ['']
    if '\n' in text:
        lines=text.splitlines()
        return lines if len(lines)<=max_lines else lines[:max_lines-1]+[' '.join(lines[max_lines-1:])]
    if f.getlength(text)<=max_width:return [text]
    # balanced natural break, with character fallback if one long word
    splits=[i for i,c in enumerate(text) if c.isspace()]
    if not splits:splits=list(range(1,len(text)))
    options=[]
    for i in splits:
        a,b=text[:i].strip(),text[i:].strip()
        if not a or not b:continue
        la,lb=f.getlength(a),f.getlength(b)
        options.append((max(la,lb)+abs(la-lb)*.12,[a,b]))
    return min(options,key=lambda x:x[0])[1] if options else [text]

def _clean_line(text: str) -> str:
    # Preserve word spaces; normalize Korean combining characters before spacing.
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(text))).strip()

def glyph_ink_box(f, ch: str) -> tuple[float, float, float, float]:
    """Actual ink box relative to a left-baseline origin (spaces contain no ink)."""
    box = f.getbbox(ch, anchor='ls')
    ink = f.getmask(ch).getbbox()
    if ink is None:
        return (0.0, 0.0, 0.0, 0.0)
    return (box[0]+ink[0], box[1]+ink[1], box[0]+ink[2], box[1]+ink[3])

def distributed_positions(text: str, f, width: float):
    """Uniform added character spacing, from the first to the last ink edge.

    Unlike the previous 'tracking' implementation there is no 2.5em spacing cap.
    Both short document names and long construction names reach exactly the
    same two margins without stretching the glyph shapes. Spaces keep their
    normal advances. The caller fits the font before using this function.
    """
    text = _clean_line(text)
    if not text:
        return [], 0.0, 0.0
    advances = [float(f.getlength(c)) for c in text]
    boxes = [glyph_ink_box(f, c) for c in text]
    tops = [b[1] for c,b in zip(text,boxes) if not c.isspace()]
    bottoms = [b[3] for c,b in zip(text,boxes) if not c.isspace()]
    top, bottom = min(tops), max(bottoms)
    if len(text) == 1:
        return [(text, (width-(boxes[0][2]-boxes[0][0]))/2-boxes[0][0])], top, bottom
    natural = sum(advances[:-1])+boxes[-1][2]-boxes[0][0]
    gap = (width-natural)/(len(text)-1)
    xx = -boxes[0][0]
    positions = []
    for c, advance in zip(text, advances):
        positions.append((c, xx))
        xx += advance+gap
    return positions, top, bottom

def line_ink_width(text: str, f) -> float:
    text = _clean_line(text)
    if not text:
        return 0.0
    return sum(float(f.getlength(c)) for c in text[:-1])+glyph_ink_box(f,text[-1])[2]-glyph_ink_box(f,text[0])[0]

def draw_text_box(image:Image.Image, text:str, box:tuple, size:int, family:str='맑은 고딕',
                  bold:bool=False, color=(20,22,24,255), lines:int=1, tracking:bool=False,
                  align:str='center'):
    """Typeset into a box; distributed alignment is shared by photos and PDFs."""
    x,y,w,h=map(float,box)
    text=unicodedata.normalize('NFC',str(text)).strip()
    if not text or w <= 0 or h <= 0:
        return
    distribute = tracking or align == 'distributed'
    for s in range(max(4,int(size)),3,-1):
        f=font(s,family,bold)
        txt=wrap_lines(text,f,w,lines) if lines>1 else [text.replace('\n',' ')]
        txt=[_clean_line(t) for t in txt]
        measure=line_ink_width if distribute else lambda t,ff: ff.getlength(t)
        if max(measure(t,f) for t in txt)<=w and len(txt)*s*1.32<=h:
            break
    d=ImageDraw.Draw(image)
    step=s*1.32
    first_center=y+(h-len(txt)*step)/2+step/2
    for j,t in enumerate(txt):
        yy=first_center+j*step
        if not t:
            continue
        if distribute:
            # In an extreme small box use a fitted strip instead of overlapping
            # glyphs or silently dropping the end of the title.
            natural=line_ink_width(t,f)
            if natural>w+1:
                strip=Image.new('RGBA',(int(math.ceil(natural))+4,max(8,int(step)+8)),(0,0,0,0))
                draw_text_box(strip,t,(1,1,natural,strip.height-2),s,family,bold,color,1,align='distributed')
                strip=strip.resize((max(1,round(w)),max(1,round(step))),Image.Resampling.LANCZOS)
                image.paste(strip,(round(x),round(yy-step/2)),strip)
                continue
            positions,top,bottom=distributed_positions(t,f,w)
            baseline=yy-(top+bottom)/2
            for c,xx in positions:
                d.text((x+xx,baseline),c,font=f,fill=color,anchor='ls')
        else:
            d.text((x+w/2,yy),t,font=f,fill=color,anchor='mm')

# Same left/right margins for the construction title and the document title.
# The actual delivery photograph places this block well below the top border.
def cover_title_boxes(w:int=1260,h:int=891):
    left=w*.11; width=w*.78
    return (left,h*.15,width,h*.075),(left,h*.225,width,h*.07)

def binder_title_boxes(w:int,h:int):
    left=w*.045; width=w*.91
    return (left,h*.095,width,h*.35),(left,h*.47,width,h*.43)

def pagination_signature(state:State) -> tuple:
    return (state.layout, state.binder_stack_mode, tuple((index,it.kind,it.count) for index,it in enumerate(state.items) if it.selected and it.count>0))

def recommended_page_count(state:State) -> int:
    """A readability suggestion only. pages() never calls this to split."""
    totals={k:sum(it.count for it in state.items if it.selected and it.kind==k) for k in KINDS}
    return max([1]+[math.ceil(totals[k]/SUGGESTED_CAPS[k]) for k in KINDS])

@lru_cache(maxsize=64)
def read_asset(name:str) -> Image.Image:
    return Image.open(ASSETS/name).convert('RGBA')

def resolve_logo(state:State) -> Image.Image|None:
    if state.custom_logo:
        try: return Image.open(io.BytesIO(base64.b64decode(state.custom_logo))).convert('RGBA')
        except Exception as e: raise ValueError('저장된 사용자 로고를 읽지 못했습니다.') from e
    normalized=re.sub(r'\s+','',state.authority).removesuffix('청')
    for entry in LOGOS:
        name=re.sub(r'\s+','',entry['name']).removesuffix('청')
        if normalized==name or normalized==name.replace('부산광역시',''):
            return read_asset('logos/'+entry['file']).copy()
    return None

def import_logo(path:str) -> str:
    with Image.open(path) as im:
        im=ImageOps.exif_transpose(im).convert('RGBA');im.thumbnail((1400,1400))
        b=io.BytesIO();im.save(b,format='PNG');return base64.b64encode(b.getvalue()).decode('ascii')

def issuer(image:Image.Image, state:State, box:tuple, binder:bool=False, size:int=30):
    x,y,w,h=box;name=state.binder_authority.strip() if binder and state.binder_authority.strip() else state.authority.strip()
    if not name:return
    lg=resolve_logo(state);d=ImageDraw.Draw(image)
    f=font(size,state.font,True)
    lw=0
    if lg:
        lg.thumbnail((int(h*1.9),int(h*.85)),Image.Resampling.LANCZOS);lw=lg.width+max(5,h*.20)
    while f.getlength(name)+lw>w and size>5:
        size-=1;f=font(size,state.font,True)
    total=f.getlength(name)+lw;xx=x+(w-total)/2
    if lg:
        image.alpha_composite(lg,(int(xx),int(y+(h-lg.height)/2)));xx+=lw
    d.text((xx+f.getlength(name)/2,y+h/2),name,font=f,fill=(25,27,29,255),anchor='mm')

def textured_paper(size:tuple, color=(194,226,231), photo:bool=True) -> Image.Image:
    w,h=size
    if not photo:return Image.new('RGBA',size,tuple(color)+(255,))
    t=np.asarray(read_asset('paper_texture.jpg').convert('L').resize(size,Image.Resampling.BICUBIC),np.float32)
    t=(t-cv2.GaussianBlur(t,(0,0),40))*0.33
    # preserve real texture plus a low-frequency paper lighting field
    yy,xx=np.mgrid[:h,:w];shade=-2.5*(xx/w)+2*np.sin(yy/h*np.pi)
    c=np.array(color,np.float32)[None,None,:]+t[:,:,None]+shade[:,:,None]
    return Image.fromarray(np.uint8(np.clip(c,0,255))).convert('RGBA')

def ornate_border(im:Image.Image,margin:int=46,photo:bool=True):
    d=ImageDraw.Draw(im);w,h=im.size;col=(62,73,75,255) if photo else (0,0,0,255)
    r=26
    for off in [0,4]:
        x=margin+off;y=margin+off;xx=w-margin-off;yy=h-margin-off
        d.line([(x+r,y),(xx-r,y)],fill=col,width=2)
        d.line([(x+r,yy),(xx-r,yy)],fill=col,width=2)
        d.line([(x,y+r),(x,yy-r)],fill=col,width=2)
        d.line([(xx,y+r),(xx,yy-r)],fill=col,width=2)
        d.arc((x-r,y-r,x+r,y+r),0,90,fill=col,width=2)
        d.arc((xx-r,y-r,xx+r,y+r),90,180,fill=col,width=2)
        d.arc((x-r,yy-r,x+r,yy+r),270,360,fill=col,width=2)
        d.arc((xx-r,yy-r,xx+r,yy+r),180,270,fill=col,width=2)
    for x,y,sx,sy in [(margin,margin,-1,-1),(w-margin,margin,1,-1),(margin,h-margin,-1,1),(w-margin,h-margin,1,1)]:
        pts=[]
        for t in np.linspace(0,2*np.pi,64):
            a=18*np.cos(t);b=6*np.sin(t)
            pts.append((x+sx*(a+b)*.72,y+sy*(a-b)*.72))
        d.line(pts+[pts[0]],fill=col,width=2)

class Renderer:
    def __init__(self,state:State):
        self.state=copy.deepcopy(state);self.state.validate();self._sprite_cache={};self._binder_choices=self.binder_choices()
    def binder_choices(self) -> dict[str,int]:
        """Assign photographic templates per physical copy, never per document name.

        Four real samples, used in shuffled decks. 1st/2nd/3rd copies differ;
        after four copies a sample must be reused. Adjacent repeats are avoided.
        Seed is stored in the project and independent of geometry/cover text.
        """
        ids=[f'{i}:{no}' for i,it in enumerate(self.state.items)
             if it.selected and it.kind in ('design','waste') for no in range(it.count)]
        mode=self.state.knot_mode
        if mode!='varied':
            fixed=-1 if mode=='legacy' else int(mode)-1
            return dict.fromkeys(ids,fixed)
        rng=np.random.default_rng(self.state.knot_seed)
        deck=[]
        while len(deck)<len(ids):
            cycle=list(map(int,rng.permutation(len(BINDER_META['variants']))))
            if not deck:
                at=cycle.index(self.state.knot_seed%len(cycle));cycle[0],cycle[at]=cycle[at],cycle[0]
            elif cycle[0]==deck[-1]:cycle[0],cycle[1]=cycle[1],cycle[0]
            deck.extend(cycle)
        # Make all per-row 3-copy groups distinct, including a group that crosses
        # the boundary of two shuffled decks.
        for start in range(len(ids)):
            row,copy_no=map(int,ids[start].split(':'))
            prev=[deck[j] for j in range(max(0,start-2),start)
                  if int(ids[j].split(':')[0])==row and int(ids[j].split(':')[1])//3==copy_no//3]
            avoid=set(prev)
            if start:avoid.add(deck[start-1])
            if deck[start] in avoid:
                candidates=[v for v in range(len(BINDER_META['variants'])) if v not in avoid]
                deck[start]=candidates[int(rng.integers(len(candidates)))]
        return dict(zip(ids,deck))

    def cover(self,it:Item,photo=True) -> Image.Image:
        w,h=1260,891
        col=(197,229,233) if self.state.cover_color=='하늘색' and photo else (247,247,244) if photo else (255,255,255)
        im=textured_paper((w,h),col,photo);d=ImageDraw.Draw(im)
        ornate_border(im,50,photo)
        if photo:
            for xx in range(32):
                shade=int(29+9*np.sin(xx/32*np.pi));d.line((xx,0,xx,h),fill=(shade,shade+1,shade+2),width=1)
            d.line((33,0,33,h),fill=(90,91,91),width=2)
        title_box, document_box = cover_title_boxes(w,h)
        draw_text_box(im,self.state.title(it),title_box,34,self.state.font,True,lines=1,align='distributed')
        draw_text_box(im,it.name,document_box,47,self.state.font,True,align='distributed')
        # geometric centre (including y) of the cover
        draw_text_box(im,self.state.date,(w*.25,h*.5-24,w*.50,48),29,self.state.font)
        issuer(im,self.state,(w*.19,h-123,w*.64,54),size=34)
        return im
    def binder_label(self,it:Item,w=1200,h=174,photo=True):
        im=textured_paper((w,h),(241,241,238) if photo else (255,255,255),photo)
        d=ImageDraw.Draw(im)
        d.rectangle((2,2,w-3,h-3),outline=(120,120,117),width=2)
        d.rectangle((8,8,w-9,h-9),outline=(145,145,142),width=1)
        title_box, document_box = binder_title_boxes(w,h)
        draw_text_box(im,self.state.title(it),title_box,int(h*.22),self.state.font,False,lines=1,align='distributed')
        draw_text_box(im,it.name,document_box,int(h*.33),self.state.font,True,align='distributed')
        return im
    def binder(self,it:Item,variant:int=0):
        legacy=variant<0
        im=read_asset('binder.png' if legacy else 'binders/'+BINDER_META['variants'][variant%4]['file']).copy()
        # Labels are kept clear of the photographed knot/eyelet band.
        lx,lw=(166,710) if legacy else (246,655)
        im.alpha_composite(self.binder_label(it,lw,125),(lx,75))
        date=textured_paper((196,66),(241,241,238));ImageDraw.Draw(date).rectangle((2,2,193,63),outline=(145,145,142),width=1)
        draw_text_box(date,self.state.date,(7,6,182,54),25,self.state.font)
        im.alpha_composite(date,(425,340))
        lab=textured_paper((388,63),(241,241,238));ImageDraw.Draw(lab).rectangle((2,2,385,60),outline=(145,145,142),width=1)
        issuer(lab,self.state,(10,5,368,52),binder=True,size=27)
        im.alpha_composite(lab,(326,567))
        return im
    def book(self,it:Item,photo=True):
        w,h=650,905
        if photo:im=read_asset(('report' if it.kind=='report' else 'spec')+'.png').copy()
        else:
            im=textured_paper((w,h),(255,255,255),False)
            ImageDraw.Draw(im).rectangle((24,24,w-24,h-24),outline=(90,90,90),width=1)
        if it.kind=='report':
            box=(43,219,558,122);datebox=(155,445,340,61);issuerbox=(120,716,414,61)
        else:
            box=(47,161,552,172);datebox=(155,433,340,61);issuerbox=(120,716,414,61)
        # Printed content is typeset, not left to an image model.
        x,y,bw,bh=box
        draw_text_box(im,self.state.title(it),(x,y,bw,bh*.42),22,self.state.font,False,lines=2,align='distributed')
        draw_text_box(im,it.name,(x,y+bh*.46,bw,bh*.5),38,self.state.font,True,tracking=True)
        draw_text_box(im,self.state.date,datebox,22,self.state.font)
        issuer(im,self.state,issuerbox,size=25)
        return im
    def cd_insert(self,it:Item,w=720,h=720,photo=True):
        im=textured_paper((w,h),(244,245,244) if photo else (255,255,255),photo)
        draw_text_box(im,self.state.title(it),(w*.1,h*.17,w*.8,h*.20),34,self.state.font,True,lines=2,align='distributed')
        draw_text_box(im,self.state.date,(w*.2,h*.54,w*.6,h*.08),30,self.state.font)
        issuer(im,self.state,(w*.12,h*.80,w*.76,h*.09),size=29)
        return im
    def cd(self,it:Item):
        im=read_asset('cd.png').copy()
        ins=self.cd_insert(it,493,489,True)
        im.alpha_composite(ins,(42,35))
        # Thin plastic edge / glare retained from source photograph; don't redraw case.
        d=ImageDraw.Draw(im);d.line((40,34,534,34),fill=(245,246,245,150),width=2)
        return im
    def sprite(self,it:Item,variant=0):
        key=(it.kind,it.name,self.state.title(it),variant if it.kind in ('usb','design','waste') else 0)
        if key in self._sprite_cache:return self._sprite_cache[key]
        if it.kind=='drawing': im=self.cover(it)
        elif it.kind in ['design','waste']:im=self.binder(it,variant)
        elif it.kind in ['report','spec']:im=self.book(it)
        elif it.kind=='cd':im=self.cd(it)
        else:im=read_asset(f'usb_{variant%3+1}.png').copy()
        self._sprite_cache[key]=im;return im
    def pages(self) -> list[list[tuple[int,Item,int]]]:
        entries=[]
        for idx,it in enumerate(self.state.items):
            if it.selected:
                entries.extend((idx,it,no) for no in range(it.count))
        if self.state.page_policy != 'split':
            # This is the default for new and v2.0 projects, regardless of count.
            return [entries]
        n=min(self.state.split_pages,len(entries))
        pages=[[] for _ in range(n)]
        for kind in KINDS:
            group=[entry for entry in entries if entry[1].kind==kind]
            # Start at the lightest page. Preserve all copy IDs and balance types.
            start=min(range(n),key=lambda i:len(pages[i]))
            for j,entry in enumerate(group):
                pages[(start+j)%n].append(entry)
        return [page for page in pages if page]

    def placements(self,page:int=0) -> list[dict]:
        pages=self.pages()
        if not 0 <= page < len(pages):
            raise IndexError('사진 페이지 번호가 범위를 벗어났습니다.')
        entries=pages[page]
        groups={kind:[entry for entry in entries if entry[1].kind==kind] for kind in KINDS}
        pos=[]
        rng=np.random.default_rng(self.state.seed+page*137)
        def stack(group,x,y,w,h,span_h,preferred=90,max_dx=6):
            """Shingle copies within a board band; never resize faces or omit copies."""
            n=len(group)
            if not n:return
            if group[0][1].kind in ('design','waste') and self.state.binder_stack_mode=='triple':
                # Keep each row/site separate; never invent or round up a copy.
                chunks=[]
                for entry in group:
                    if not chunks or chunks[-1][0][0]!=entry[0] or len(chunks[-1])>=3 or chunks[-1][0][2]//3!=entry[2]//3:
                        chunks.append([])
                    chunks[-1].append(entry)
                inner_step=min(64.0,float(preferred))
                between_step=max(inner_step+18,82.0)
                travel=sum((len(c)-1)*inner_step for c in chunks)+(len(chunks)-1)*between_step
                compression=min(1.0,max(0.0,span_h-h)/travel) if travel else 1.0
                cy=float(y)
                for g,chunk in enumerate(chunks):
                    gid=f'{page}:{chunk[0][0]}:{chunk[0][2]}'
                    for j,(idx,it,no) in enumerate(chunk):
                        # Reference 28721: one copy shifts slightly left/down from
                        # the previous. Front order is adjusted to show title bands.
                        dx=18.0*(len(chunk)-1-j)
                        ang=float(rng.uniform(-.38,.38)) if self.state.natural_angles else 0.0
                        pos.append({'id':f'{idx}:{no}','item_index':idx,'copy':no,'item':it,
                                    'x':float(x+dx),'y':cy,'w':w,'h':h,'angle':ang,'stack_id':gid})
                        if j<len(chunk)-1:cy+=inner_step*compression
                    if g<len(chunks)-1:cy+=between_step*compression
                return
            step=0 if n==1 else min(preferred,max(0.0,span_h-h)/(n-1))
            drift=0 if n==1 else min(2,max_dx/(n-1))
            for j,(idx,it,no) in enumerate(group):
                ang=float(rng.uniform(-.38,.38)) if self.state.natural_angles else 0.0
                if it.kind in ['report','spec']:ang=0.0
                pos.append({'id':f'{idx}:{no}','item_index':idx,'copy':no,'item':it,
                            'x':float(x+j*drift),'y':float(y+j*step),'w':w,'h':h,'angle':ang})
        has_books=bool(groups['report'] or groups['spec'])
        has_drawings=bool(groups['drawing'])
        binders=groups['design']+groups['waste']
        if self.state.layout==0 and has_books and binders:
            # Alternate photographed layout: booklets behind, binders in front.
            stack(groups['drawing'],20,18,420,297,491,96)
            stack(groups['report'],457,18,210,297,319,75,max_dx=3)
            stack(groups['spec'],677,18,210,297,319,75,max_dx=3)
            for kind,xx in [('design',20),('waste',334)]:
                n=len(groups[kind]); travel=min(180,max(0,n-1)*60)
                stack(groups[kind],xx,378-travel,297,210,210+travel,60)
            n=len(groups['cd']);travel=min(160,max(0,n-1)*75)
            stack(groups['cd'],657,462-travel,124,124,124+travel,75,max_dx=5)
            stack(groups['usb'],813,345,60,22,240,45,max_dx=0)
        else:
            # Main layout: full A3 on the left, ONE shingled A4 column on the right.
            # Combining design+waste into one column prevents inter-group covering
            # of title labels when e.g. 3 drawing + 3 design + 3 waste are selected.
            stack(groups['drawing'],20,20,420,297,477 if has_books else 562,96)
            stack(binders,466,20,297,210,562,265,max_dx=8)
            for kind,xx in [('report',20),('spec',237)]:
                n=len(groups[kind]); travel=min(105,max(0,n-1)*70)
                yy=(287-travel) if has_drawings else (155-travel/2)
                stack(groups[kind],xx,yy,210,297,297+travel,70,max_dx=3)
            n=len(groups['cd']);travel=min(270,max(0,n-1)*88)
            stack(groups['cd'],767,462-travel,124,124,124+travel,88,max_dx=4)
            cd_top=462-travel if n else 580
            stack(groups['usb'],805,55,60,22,max(22,min(455,cd_top-75)),49,max_dx=0)
            if self.state.layout==1:
                for p in pos:p['x']=900-p['x']-p['w']
        order={'drawing':0,'report':1,'spec':1,'design':2,'waste':2,'cd':3,'usb':3}
        pos.sort(key=lambda p:order[p['item'].kind])
        for p in pos:
            p.setdefault('stack_id',None)
            p['binder_variant']=self._binder_choices.get(p['id'],-1)
        # Centre the actual composition, retaining full millimetre sizes.
        if pos:
            corners=np.concatenate([object_points(p) for p in pos])
            x0,y0=corners.min(axis=0);x1,y1=corners.max(axis=0)
            dx=float((900-(x1-x0))/2-x0);dy=float((600-(y1-y0))/2-y0)
            for p in pos:
                p['x']+=dx;p['y']+=dy
                ox,oy=self.state.offsets.get(p['id'],[0,0])
                p['x']+=float(ox);p['y']+=float(oy)
        return pos

    def board_matrix(self,width:int):
        bg=BG_LIST[self.state.background];base=read_asset(bg['file']).convert('RGB');height=round(width*base.height/base.width)
        ratio=width/base.width
        dst=np.float32(bg['corners'])*ratio
        H=cv2.getPerspectiveTransform(np.float32([[0,0],[900,0],[900,600],[0,600]]),dst)
        return base.resize((width,height),Image.Resampling.LANCZOS),H
    def render_photo(self,page:int=0,width:int=2200,hitboxes:bool=False):
        im,H=self.board_matrix(width);base=im.convert('RGBA');hits=[]
        for p in self.placements(page):
            pts=object_points(p);dst=cv2.perspectiveTransform(pts[None].astype(np.float32),H)[0]
            variant=p['binder_variant'] if p['item'].kind in ('design','waste') else p['copy']
            sp=self.sprite(p['item'],variant)
            if p['item'].kind in ('design','waste') and variant>=0:
                # Geometry represents the A4 cover face. Extra transparent padding
                # contains real loose cords, not additional paper size.
                expanded=binder_sprite_points(p,variant)
                sprite_dst=cv2.perspectiveTransform(expanded[None].astype(np.float32),H)[0]
            else:sprite_dst=dst
            paste_quad(base,sp,sprite_dst,shadow=True,shadow_scale=width/1800)
            hits.append((p,dst.tolist()))
        return (base.convert('RGB'),hits,H) if hitboxes else base.convert('RGB')
    def page_image(self,page:int=0,width:int=1429,photo:Image.Image|None=None):
        # Original template's banner and page positions, not a new slide design.
        bg=read_asset('page_base.png').convert('RGB');height=round(width*25.4/19.05);im=bg.resize((width,height),Image.Resampling.LANCZOS).convert('RGBA')
        scale=width/19.05
        box=(.983*scale,7.477*scale,17.167*scale,1.961*scale)
        draw_text_box(im,self.state.service_title,box,int(18/72*2.54*scale),'돋움',True,lines=2)
        area=(int(1.325*scale),int(10.5*scale),int(16.4*scale),int(12.3*scale))
        ph=photo if photo is not None else self.render_photo(page,width=1800)
        ph=ImageOps.contain(ph,(area[2],area[3]),Image.Resampling.LANCZOS)
        im.alpha_composite(ph.convert('RGBA'),(area[0]+(area[2]-ph.width)//2,area[1]+(area[3]-ph.height)//2))
        lw=max(1,round(3/72*2.54*scale));ImageDraw.Draw(im).rectangle((area[0],area[1],area[0]+area[2],area[1]+area[3]),outline='black',width=lw)
        return im.convert('RGB')
    def warnings(self):
        out=[]
        if resolve_logo(self.state) is None:
            out.append('해당 발주처의 자동 연결 로고가 없습니다. 글자만 표시됩니다.')
        if self.state.page_policy=='split':
            out.append(f'사용자가 선택한 분할 배치: {len(self.pages())}장. 전체 수량은 보존됩니다.')
        elif recommended_page_count(self.state)>1:
            out.append('한 장에 전체 수량을 겹쳐 배치했습니다. 제목 가림은 미리보기에서 확인하세요. 자동 분할하지 않습니다.')
        for i in range(len(self.pages())):
            for p in self.placements(i):
                pts=object_points(p)
                if pts[:,0].min()<0 or pts[:,1].min()<0 or pts[:,0].max()>900 or pts[:,1].max()>600:
                    out.append(f'{i+1}쪽 {p["item"].name}: 보드 밖으로 이동했습니다. 배치 초기화를 권장합니다.')
        return list(dict.fromkeys(out))
    def export_pptx(self,path:Path,photos:list[Image.Image]|None=None):
        pages=self.pages();photos=photos or [self.render_photo(i) for i in range(len(pages))]
        prs=Presentation(ASSETS/'photo_template.pptx')
        proto=prs.slides[0]
        shapes=[copy.deepcopy(s._element) for s in proto.shapes]
        # Some supplied legacy templates have only one layout, not layout[6].
        # Preserve template images and relationship IDs on explicitly split pages.
        template_rels=[rel for rel in proto.part.rels.values() if rel.reltype not in (RT.SLIDE_LAYOUT,RT.NOTES_SLIDE)]
        for i,ph in enumerate(photos):
            sl=proto if i==0 else prs.slides.add_slide(proto.slide_layout)
            if i>0:
                for shape in list(sl.shapes):
                    element=shape._element;element.getparent().remove(element)
                mapping={}
                for rel in template_rels:
                    target=rel.target_ref if rel.is_external else rel.target_part
                    mapping[rel.rId]=sl.part.relate_to(target,rel.reltype,is_external=rel.is_external)
                for e in shapes:
                    element=copy.deepcopy(e)
                    for node in element.iter():
                        for key,value in list(node.attrib.items()):
                            if key.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}') and value in mapping:
                                node.set(key,mapping[value])
                    sl.shapes._spTree.insert_element_before(element,'p:extLst')
            title=next(s for s in sl.shapes if s.has_text_frame and s.name=='Text Box 5')
            tf=title.text_frame;tf.clear();tf.word_wrap=False;tf.auto_size=MSO_AUTO_SIZE.NONE;tf.vertical_anchor=MSO_ANCHOR.MIDDLE
            tf.margin_top=tf.margin_bottom=0;tf.margin_left=tf.margin_right=Cm(.1)
            f=font(72,'돋움',True)
            lines=wrap_lines(self.state.service_title,f,17.167/2.54*72*4,2)
            # 72px metrics represent 18 pt at 288 dpi; shrink only if two lines still exceed bounds.
            point=18
            while max(f.getlength(t) for t in lines)>17.167/2.54*72*4 and point>11:
                point-=1;f=font(point*4,'돋움',True);lines=wrap_lines(self.state.service_title,f,17.167/2.54*72*4,2)
            for j,line in enumerate(lines):
                par=tf.paragraphs[0] if j==0 else tf.add_paragraph();par.alignment=PP_ALIGN.CENTER;par.space_before=par.space_after=Pt(0)
                run=par.add_run();run.text=line;run.font.name='돋움';run.font.bold=True;run.font.size=Pt(point);run.font.color.rgb=RGBColor(0,0,0)
                rp=run._r.get_or_add_rPr();ea=OxmlElement('a:ea');ea.set('typeface','돋움');rp.append(ea)
            b=io.BytesIO();ph.save(b,format='PNG');b.seek(0)
            xx,yy,ww,hh=1.325,10.5,16.4,12.3
            ratio=min(ww/ph.width,hh/ph.height);pw,phh=ph.width*ratio,ph.height*ratio
            sl.shapes.add_picture(b,Cm(xx+(ww-pw)/2),Cm(yy+(hh-phh)/2),width=Cm(pw),height=Cm(phh))
            rect=sl.shapes.add_shape(MSO_SHAPE.RECTANGLE,Cm(xx),Cm(yy),Cm(ww),Cm(hh));rect.fill.background();rect.line.color.rgb=RGBColor(0,0,0);rect.line.width=Pt(3)
            sl.notes_slide.notes_text_frame.text='성과품 구성 이미지(합성). 입력 정보: '+summary(self.state)+f'\n사진 장수: {len(photos)}장. 분할은 사용자가 선택한 경우에만 적용됩니다.'
        prs.core_properties.title='준공사진_'+self.state.title();prs.core_properties.subject='성과품 구성 이미지(합성)';prs.core_properties.author='관보종합기술단'
        prs.save(str(path))
    def export_bundle(self,directory:Path,progress=None):
        directory=Path(directory);directory.mkdir(exist_ok=True,parents=True)
        stem=safe_filename(self.state.title());photos=[];paths=[]
        for i in range(len(self.pages())):
            if progress:progress(f'사진 {i+1}/{len(self.pages())} 생성 중')
            ph=self.render_photo(i);photos.append(ph)
            for kind,img in [('합성사진',ph),('준공사진페이지',self.page_image(i,photo=ph))]:
                p=directory/f'{kind}_{stem}_{i+1:02}.png';img.save(p,dpi=(200,200));paths.append(p)
        p=directory/f'준공사진_{stem}.pptx';self.export_pptx(p,photos);paths.append(p)
        p=directory/f'설정_{stem}.json';atomic_json(p,self.state.to_dict());paths.append(p)
        audit={'version':VERSION,'board_mm':[900,600],'knot_mode':self.state.knot_mode,
               'knot_seed':self.state.knot_seed,'binder_stack_mode':self.state.binder_stack_mode,
               'pages':[]}
        for page in range(len(self.pages())):
            entries=[]
            for placed in self.placements(page):
                entry={k:v for k,v in placed.items() if k!='item'}
                entry['document_name']=placed['item'].name
                entry['construction_title']=self.state.title(placed['item'])
                entry['binder_asset']=('binder_legacy' if placed['binder_variant']<0 else f"binder_{placed['binder_variant']+1}") if placed['item'].kind in ('design','waste') else None
                entries.append(entry)
            audit['pages'].append(entries)
        atomic_json(directory/f'배치정보_{stem}.json',audit)
        (directory/f'성과품수량_{stem}.txt').write_text(summary(self.state),encoding='utf8')
        current_pages=len(self.pages())
        for prefix in ['합성사진','준공사진페이지']:
            for previous in directory.glob(f'{prefix}_{stem}_*.png'):
                suffix=previous.stem.rsplit('_',1)[-1]
                if suffix.isdigit() and int(suffix)>current_pages:previous.unlink()
        if progress:progress('완료')
        return paths

def object_points(p:dict):
    x,y,w,h=p['x'],p['y'],p['w'],p['h'];pts=np.array([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],np.float32)
    theta=p['angle']*math.pi/180;c=np.array([x+w/2,y+h/2]);R=np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
    return ((pts-c)@R.T+c).astype(np.float32)

def binder_sprite_points(p:dict,variant:int):
    """Outer sprite corners on the board; physical A4 face is unchanged."""
    meta=BINDER_META['variants'][variant%4]
    x0,y0,x1,y1=meta['face_box'];sw,sh=meta['canvas']
    ax=p['w']/(x1-x0);ay=p['h']/(y1-y0)
    corners=np.array([[-x0*ax,-y0*ay],[(sw-x0)*ax,-y0*ay],
                      [(sw-x0)*ax,(sh-y0)*ay],[-x0*ax,(sh-y0)*ay]],np.float32)
    corners+=np.array([p['x'],p['y']])
    centre=np.array([p['x']+p['w']/2,p['y']+p['h']/2])
    theta=p['angle']*math.pi/180
    R=np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
    return ((corners-centre)@R.T+centre).astype(np.float32)


def paste_quad(canvas:Image.Image,sprite:Image.Image,dst:np.ndarray,shadow=True,shadow_scale=1.0):
    # Work in a bounded local tile, rather than allocating a full canvas per object.
    pad=int(25*shadow_scale)+3
    x0=max(0,int(np.floor(dst[:,0].min()))-pad);y0=max(0,int(np.floor(dst[:,1].min()))-pad)
    x1=min(canvas.width,int(np.ceil(dst[:,0].max()))+pad);y1=min(canvas.height,int(np.ceil(dst[:,1].max()))+pad)
    if x1<=x0 or y1<=y0:return
    ww,hh=x1-x0,y1-y0;dest=dst-np.float32([x0,y0])
    src=np.float32([[0,0],[sprite.width-1,0],[sprite.width-1,sprite.height-1],[0,sprite.height-1]])
    H=cv2.getPerspectiveTransform(src,dest.astype(np.float32))
    a=np.array(sprite.convert('RGBA'));alpha=a[:,:,3:4].astype(np.float32)/255
    premul=np.concatenate([a[:,:,:3].astype(np.float32)*alpha,a[:,:,3:4].astype(np.float32)],axis=2)
    # Supersample the warp before reducing: thin double borders and label text
    # otherwise alias into broken/dashed lines at oblique camera angles.
    sampling=np.diag([2.0,2.0,1.0])
    high=cv2.warpPerspective(premul,sampling@H,(ww*2,hh*2),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    v=cv2.resize(high,(ww,hh),interpolation=cv2.INTER_AREA)
    tile=canvas.crop((x0,y0,x1,y1))
    if shadow:
        m=np.uint8(np.clip(v[:,:,3],0,255));shift=np.float32([[1,0,3*shadow_scale],[0,1,5*shadow_scale]])
        ma=cv2.warpAffine(m,shift,(ww,hh));ma=cv2.GaussianBlur(ma,(0,0),4*shadow_scale)
        mb=cv2.GaussianBlur(m,(0,0),max(.8,shadow_scale))
        opacity=np.uint8(np.clip(ma*.24+mb*.10,0,130))
        sh=np.zeros((hh,ww,4),np.uint8);sh[:,:,:3]=30;sh[:,:,3]=opacity;tile.alpha_composite(Image.fromarray(sh))
    va=v[:,:,3:4]/255
    rgb=np.divide(v[:,:,:3],va,out=np.zeros_like(v[:,:,:3]),where=va>.002)
    rgba=np.uint8(np.clip(np.concatenate([rgb,v[:,:,3:4]],axis=2),0,255))
    tile.alpha_composite(Image.fromarray(rgba));canvas.paste(tile,(x0,y0))

# Print-ready PDFs are separate from perspective photographs.
def export_print_pdfs(state:State,directory:Path) -> list[Path]:
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    r=Renderer(state);directory=Path(directory);directory.mkdir(exist_ok=True,parents=True);out=[]
    stem=safe_filename(state.title())
    def addimg(c,img,x,y,w,h,ph):
        c.drawImage(ImageReader(img.convert('RGB')),x*mm,(ph-y-h)*mm,w*mm,h*mm)
    def cuts(c,x,y,w,h,ph):
        c.setDash(2,2);c.setStrokeColorRGB(.55,.55,.55);c.setLineWidth(.35);c.rect(x*mm,(ph-y-h)*mm,w*mm,h*mm,stroke=1,fill=0);c.setDash()
    drawings=[i for i in state.items if i.selected and i.count and i.kind=='drawing']
    if drawings:
        p=directory/f'A3_표지_{stem}.pdf';c=canvas.Canvas(str(p),pagesize=(420*mm,297*mm))
        for it in drawings:
            for _ in range(it.count):addimg(c,r.cover(it,False),0,0,420,297,297);c.showPage()
        c.save();out.append(p)
    binders=[i for i in state.items if i.selected and i.count and i.kind in ['design','waste']]
    if binders:
        p=directory/f'A4가로_바인더라벨_{stem}.pdf';c=canvas.Canvas(str(p),pagesize=(297*mm,210*mm));n=0
        for it in binders:
            for _ in range(it.count):
                if n and n%3==0:c.showPage()
                yy=12+(n%3)*64
                addimg(c,r.binder_label(it,1500,240,False),10,yy,185,29.6,210);cuts(c,10,yy,185,29.6,210)
                d=Image.new('RGBA',(430,115),'white');draw_text_box(d,state.date,(8,5,414,105),55,state.font)
                addimg(c,d,209,yy,35,9.4,210);cuts(c,209,yy,35,9.4,210)
                d=Image.new('RGBA',(800,154),'white');issuer(d,state,(14,12,770,129),True,60)
                addimg(c,d,209,yy+17,75,14.4,210);cuts(c,209,yy+17,75,14.4,210);n+=1
        c.save();out.append(p)
    books=[i for i in state.items if i.selected and i.count and i.kind in ['report','spec']]
    if books:
        p=directory/f'A4_책자표지_{stem}.pdf';c=canvas.Canvas(str(p),pagesize=(210*mm,297*mm))
        for it in books:
            for _ in range(it.count):addimg(c,r.book(it,False),0,0,210,297,297);c.showPage()
        c.save();out.append(p)
    cds=[i for i in state.items if i.selected and i.count and i.kind=='cd']
    if cds:
        p=directory/f'A4_CD라벨_{stem}.pdf';c=canvas.Canvas(str(p),pagesize=(210*mm,297*mm))
        for it in cds:
            for _ in range(it.count):
                addimg(c,r.cd_insert(it,1000,1000,False),45,12,120,120,297);cuts(c,45,12,120,120,297)
                cx,cy=105,212;radius=58.5
                c.saveState();pa=c.beginPath();pa.circle(cx*mm,(297-cy)*mm,radius*mm);c.clipPath(pa,stroke=0,fill=0)
                disc=Image.new('RGBA',(900,900),'white')
                draw_text_box(disc,state.title(it),(170,108,560,180),34,state.font,True,lines=2,align='distributed')
                draw_text_box(disc,state.date,(235,634,430,65),31,state.font)
                issuer(disc,state,(180,741,540,78),size=29)
                addimg(c,disc,cx-radius,cy-radius,117,117,297);c.restoreState()
                c.setFillColorRGB(1,1,1);c.circle(cx*mm,(297-cy)*mm,20.5*mm,stroke=0,fill=1)
                c.setDash(2,2);c.setLineWidth(.35);c.setStrokeColorRGB(.55,.55,.55)
                c.circle(cx*mm,(297-cy)*mm,58.5*mm,stroke=1,fill=0);c.circle(cx*mm,(297-cy)*mm,20.5*mm,stroke=1,fill=0);c.setDash();c.showPage()
        c.save();out.append(p)
    return out

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--demo',action='store_true');p.add_argument('--config');p.add_argument('--out',default=str(BASE/'output'));p.add_argument('--print-pdf',action='store_true');p.add_argument('--split-pages',type=int,default=None,help='명시한 경우에만 여러 사진으로 분할 (2장 이상)')
    p.add_argument('--knots',choices=list(KNOT_OPTIONS),default=None);p.add_argument('--knot-seed',type=int,default=None);p.add_argument('--binder-stack',choices=list(STACK_OPTIONS),default=None)
    args=p.parse_args();st=State.from_dict(json.loads(Path(args.config).read_text(encoding='utf8'))) if args.config else State()
    if args.knots is not None:st.knot_mode=args.knots
    if args.knot_seed is not None:st.knot_seed=args.knot_seed
    if args.binder_stack is not None:st.binder_stack_mode=args.binder_stack
    if args.split_pages is not None:
        st.page_policy='split';st.split_pages=args.split_pages
    files=Renderer(st).export_bundle(Path(args.out),print)
    if args.print_pdf:files+=export_print_pdfs(st,Path(args.out))
    for path in files:print(path)
