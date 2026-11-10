/* 준공사진 생성기 — Pyodide 작업자(Web Worker) (2026-11-09)
 *
 * docs.html#jungong 이 new Worker('tools/jungong/jungong-worker.js?v=…') 로 띄운다. 화면이 멈추지 않게 파이썬은 여기서만 돈다.
 *  - Pyodide 본체: jsDelivr 고정 버전. 핵심 파일 5개는 SRI(sha384, npm 원본과 같은 값)로 검사한다
 *    · pyodide.js / pyodide.asm.js 는 fetch(integrity) → Blob → importScripts (작업자의 importScripts 는 SRI 를 못 건다)
 *    · pyodide.asm.wasm / python_stdlib.zip / pyodide-lock.json 은 fetch 를 감싸 integrity 를 붙인다
 *    · 패키지(numpy · pillow · opencv-python · lxml …)는 Pyodide 가 잠금 파일의 sha256 으로 SRI 검사(잠금 파일이 위에서 검사됨)
 *  - 엔진·자산·글꼴·휠: 같은 사이트의 tools/jungong/ (files.json 의 SHA256 과 다르면 멈춤). 실행 중 PyPI 접속 없음 —
 *    순수 파이썬 휠(python-pptx · XlsxWriter · reportlab)은 SHA256 확인 뒤 site-packages 에 바로 푼다.
 *  - 글꼴: 나눔고딕을 /usr/share/fonts/truetype/nanum/ 에 둔다 → engine.find_font 가 고치지 않은 그대로 찾는다.
 *
 * 메시지: 화면 → {id, cmd, args}   작업자 → {type:'progress'|'ready'|'result'|'failed', …}
 */
'use strict';

var PYODIDE_VERSION = '0.27.7';
var PYO = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';
var SRI = {
  'pyodide.js':        'sha384-90so5tCKvl0xs9agU29IMKlAVzhfzFX7QO//YxQkRhJG58bBZrFN+2ZTRB026X5X',
  'pyodide.asm.js':    'sha384-J3SxzZJh4tkb2bgoUc72zArF45FJ+ngsbiqNsmxqkkecNVpZ/bUHAM0JMp+YPVpx',
  'pyodide.asm.wasm':  'sha384-wDap6JvXxf3C8g5beY3kd1xMIjAtw/oTKjTqGltdxc+B9VXnYyYBoM7hveNKilxM',
  'python_stdlib.zip': 'sha384-VLeJs79hxVEBNt1hRU5Wo7VmBcyb4sdW564EJAvEWDin3Aa3QXLHm3E5mOg2GiFH',
  'pyodide-lock.json': 'sha384-1cFE0bj3+mm1a83kcqiWxoaBhrf6jPPJJORlx1TComnZ0WaHwE4znlohwPXL5tUL'
};
// Pyodide 안에 들어 있는 패키지(잠금 파일 sha256 검사). typing-extensions · charset-normalizer = python-pptx · reportlab 의존
var PACKAGES = ['numpy', 'pillow', 'opencv-python', 'lxml', 'typing-extensions', 'charset-normalizer'];
var HERE = new URL('./', self.location.href).href;          // …/tools/jungong/
var FILES_V = new URL(self.location.href).searchParams.get('v') || '';
var APP_DIR = '/home/pyodide/jungong';
var FONT_DIR = '/usr/share/fonts/truetype/nanum';

// ── SRI 를 붙이는 fetch (Pyodide 가 부르는 fetch 도 이것을 거친다) ──
var _fetch = self.fetch.bind(self);
self.fetch = function(input, init) {
  var url = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (url.indexOf(PYO) === 0) {
    var name = url.slice(PYO.length).split('?')[0];
    if (SRI[name]) init = Object.assign({}, init || {}, { integrity: SRI[name] });
  }
  return _fetch(input, init);
};

function post(msg, transfer) { self.postMessage(msg, transfer || []); }
function progress(step, text, pct) { post({ type: 'progress', step: step, text: text, pct: pct }); }

function fetchBytes(url, label) {
  return self.fetch(url).then(function(r) {
    if (!r.ok) throw new Error(label + ' 받기 실패 (' + r.status + ')');
    return r.arrayBuffer();
  });
}
function importWithSri(name) {
  return fetchBytes(PYO + name, name).then(function(buf) {
    var u = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
    try { importScripts(u); } finally { URL.revokeObjectURL(u); }
  });
}
function hex(buf) {
  var b = new Uint8Array(buf), s = '';
  for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  return s;
}
function verified(entry) {
  var url = HERE + entry.path.split('/').map(encodeURIComponent).join('/') + '?v=' + entry.sha256.slice(0, 12);
  return fetchBytes(url, entry.path).then(function(buf) {
    return crypto.subtle.digest('SHA-256', buf).then(function(d) {
      if (hex(d) !== entry.sha256) throw new Error(entry.path + ' 파일이 목록(SHA256)과 다릅니다. 새로고침해 주세요.');
      return new Uint8Array(buf);
    });
  });
}
function mkdirs(FS, path) {
  var parts = path.split('/'), cur = '';
  for (var i = 1; i < parts.length; i++) {
    cur += '/' + parts[i];
    try { FS.mkdir(cur); } catch (e) { /* 이미 있음 */ }
  }
}

var py = null, bridge = null;
var t0 = Date.now();

function boot() {
  progress('core', '파이썬 실행기 받는 중…', 5);
  return importWithSri('pyodide.asm.js')
    .then(function() { return importWithSri('pyodide.js'); })
    .then(function() { return self.loadPyodide({ indexURL: PYO, stdout: function() {}, stderr: function(s) { console.warn(s); } }); })
    .then(function(p) {
      py = p;
      progress('pkgs', '그림·문서 라이브러리 받는 중…', 35);
      return py.loadPackage(PACKAGES, { messageCallback: function() {}, errorCallback: function(s) { console.warn(s); } });
    })
    .then(function() {
      progress('files', '엔진·자산·글꼴 받는 중…', 70);
      return self.fetch(HERE + 'files.json?v=' + encodeURIComponent(FILES_V), { cache: 'no-cache' }).then(function(r) {
        if (!r.ok) throw new Error('files.json 받기 실패 (' + r.status + ')');
        return r.json();
      });
    })
    .then(function(manifest) {
      var done = 0, n = manifest.files.length;
      var FS = py.FS;
      mkdirs(FS, APP_DIR); mkdirs(FS, FONT_DIR); mkdirs(FS, '/tmp/jungong_wheels');
      var wheels = [];
      // 동시에 6개씩 받는다
      var queue = manifest.files.slice();
      function worker() {
        var e = queue.shift();
        if (!e) return Promise.resolve();
        return verified(e).then(function(bytes) {
          var dest;
          if (e.path.indexOf('fonts/') === 0) dest = FONT_DIR + '/' + e.path.slice(6);
          else if (e.path.indexOf('wheels/') === 0) { dest = '/tmp/jungong_wheels/' + e.path.slice(7); wheels.push(dest); }
          else dest = APP_DIR + '/' + e.path;
          mkdirs(FS, dest.slice(0, dest.lastIndexOf('/')));
          FS.writeFile(dest, bytes);
          done++;
          progress('files', '엔진·자산·글꼴 받는 중… (' + done + '/' + n + ')', 70 + Math.round(done / n * 22));
          return worker();
        });
      }
      var runners = [];
      for (var i = 0; i < 6; i++) runners.push(worker());
      return Promise.all(runners).then(function() { return { manifest: manifest, wheels: wheels }; });
    })
    .then(function(r) {
      progress('init', '생성기 시작 중…', 94);
      py.globals.set('_jg_wheels', py.toPy(r.wheels));
      py.runPython([
        'import sys, zipfile, sysconfig, importlib',
        '_sp = sysconfig.get_paths()["purelib"]',
        'for _w in sorted(_jg_wheels):',
        '    with zipfile.ZipFile(_w) as _z:',
        '        if any(n.endswith((".so", ".pyd")) for n in _z.namelist()): raise RuntimeError("순수 파이썬 휠만 쓸 수 있습니다: " + _w)',
        '        _z.extractall(_sp)',
        'importlib.invalidate_caches()',
        'sys.path.insert(0, "' + APP_DIR + '")',
        'import web_bridge'
      ].join('\n'));
      py.globals.delete('_jg_wheels');
      bridge = py.pyimport('web_bridge');
      var meta = toJs(bridge.meta());
      meta.files_version = r.manifest.version;
      meta.pyodide = PYODIDE_VERSION;
      meta.boot_ms = Date.now() - t0;
      post({ type: 'ready', meta: meta });
    });
}

function toJs(proxy) {
  if (proxy == null || typeof proxy !== 'object' || !proxy.toJs) return proxy;
  try { return proxy.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false }); }
  finally { proxy.destroy(); }
}
// 결과 안의 Uint8Array 를 넘겨 줄 목록(복사 없이 보냄)
function transfers(v, out) {
  out = out || [];
  if (v instanceof Uint8Array) { out.push(v.buffer); return out; }
  if (v && typeof v === 'object') for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) transfers(v[k], out);
  return out;
}

var CMDS = {
  check:             function(a) { return bridge.check(a.state); },
  preview:           function(a) { return bridge.preview(a.state, a.page || 0, a.width || 1200, a.tab || 'photo'); },
  reassign_knots:    function(a) { return bridge.reassign_knots(a.state); },
  export_check:      function(a) { return bridge.export_check(a.state, a.mode); },
  export_bundle:     function(a, id) { return bridge.export_bundle(a.state, function(s) { post({ type: 'progress', id: id, text: String(s) }); }); },
  export_print_pdfs: function(a, id) { return bridge.export_print_pdfs(a.state, function(s) { post({ type: 'progress', id: id, text: String(s) }); }); },
  export_layouts:    function(a, id) { return bridge.export_layouts(a.state, function(s) { post({ type: 'progress', id: id, text: String(s) }); }); },
  import_logo:       function(a) { return bridge.import_logo(a.bytes, a.name || 'logo.png'); },
  load_project:      function(a) { return bridge.load_project(a.text); },
  save_project:      function(a) { return bridge.save_project(a.state); }
};

var booting = null;
self.onmessage = function(ev) {
  var m = ev.data || {};
  if (m.cmd === 'boot') {
    if (!booting) booting = boot().catch(function(e) {
      post({ type: 'failed', message: (e && e.message) || String(e) });
    });
    return;
  }
  if (!bridge || !CMDS[m.cmd]) { post({ type: 'result', id: m.id, ok: false, error: '생성기가 아직 준비되지 않았습니다.' }); return; }
  var t = Date.now();
  try {
    var res = toJs(CMDS[m.cmd](m.args || {}, m.id));
    post({ type: 'result', id: m.id, ok: true, result: res, ms: Date.now() - t }, transfers(res));
  } catch (e) {
    var msg = (e && e.message) || String(e);
    // 파이썬 오류는 마지막 줄(예: ValueError: 용역명을 입력하세요.)만 보여 준다
    var lines = msg.trim().split('\n');
    var last = lines[lines.length - 1].replace(/^[A-Za-z_.]+(Error|Exception): /, '');
    post({ type: 'result', id: m.id, ok: false, error: last, detail: msg, ms: Date.now() - t });
  }
};
