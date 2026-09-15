import { readFileSync } from 'fs';
import { transformSync } from './_btmp/node_modules/@babel/core/lib/index.js';

// B-5 에서 건드린 파일 + sysbar/config
const files = [
  'project.html', 'admin-account.html', 'admin-salary.html',
  'admin-staff.html', 'worklog.html', 'admin-worklog.html',
  'home.html', 'leave.html', 'admin-perf.html',
];
const plainJs = ['sysbar.js', 'config.js'];

let fail = 0;

for (const fname of plainJs) {
  const code = readFileSync(fname, 'utf8');
  try {
    transformSync(code, { presets: ['./_btmp/node_modules/@babel/preset-env'], filename: fname });
    console.log(`${fname.padEnd(22)} PASS (preset-env)`);
  } catch (e) {
    fail++;
    console.log(`${fname.padEnd(22)} FAIL => ${e.message.split('\n').slice(0, 3).join(' | ')}`);
  }
}

for (const fname of files) {
  const html = readFileSync(fname, 'utf8');
  const babelRe = /<script[^>]+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsRe = /<script(?![^>]*type=["']text\/babel["'])(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;

  const blocks = [];
  let m;
  while ((m = babelRe.exec(html)) !== null) blocks.push({ type: 'babel', code: m[1] });
  while ((m = jsRe.exec(html)) !== null) blocks.push({ type: 'js', code: m[1] });

  let pass = true, errMsg = '';
  for (const block of blocks) {
    const presets = block.type === 'babel'
      ? ['./_btmp/node_modules/@babel/preset-react', './_btmp/node_modules/@babel/preset-env']
      : ['./_btmp/node_modules/@babel/preset-env'];
    try {
      transformSync(block.code, { presets, filename: fname });
    } catch (e) {
      pass = false;
      errMsg = e.message.split('\n').slice(0, 3).join(' | ');
      break;
    }
  }
  if (!pass) fail++;
  console.log(`${fname.padEnd(22)} ${pass ? 'PASS' : 'FAIL'} (${blocks.length} blocks)${pass ? '' : ' => ' + errMsg}`);
}

// 태그/중괄호 균형 (문자 단위)
console.log('\n--- balance ---');
for (const fname of [...files, ...plainJs]) {
  const src = readFileSync(fname, 'utf8');
  let ob = 0, cb = 0, op = 0, cp = 0;
  for (const ch of src) {
    if (ch === '{') ob++; else if (ch === '}') cb++;
    else if (ch === '(') op++; else if (ch === ')') cp++;
  }
  const bd = ob - cb, pd = op - cp;
  if (bd !== 0 || pd !== 0) fail++;
  console.log(`${fname.padEnd(22)} { ${ob}/${cb} ${bd === 0 ? 'OK' : 'DIFF ' + bd}   ( ${op}/${cp} ${pd === 0 ? 'OK' : 'DIFF ' + pd}`);
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
