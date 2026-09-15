// -*- coding: utf-8 -*-
/* validate.js — 抽取 index.html 的 <script>，在 DOM 桩中运行，
 * 对所有机构 default / min / max / pose 模式跑更新闭包，检测 NaN / 越界。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

// 1) 抽取主脚本
const s = html.indexOf('<script>');
const e = html.lastIndexOf('</script>');
if (s < 0 || e < 0) { console.error('未找到 <script>'); process.exit(1); }
let script = html.slice(s + 8, e);
// 2) 语法检查（vm.Script 在语法错误时抛错）
try { new vm.Script(script, { filename: 'mech.js' }); }
catch (err) { console.error('SYNTAX ERROR:', err.message); process.exit(1); }

// 3) DOM 桩
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: {}, _children: [],
    style: new Proxy({}, { set() { return true; }, get() { return ''; } }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    textContent: '', innerHTML: '',
    appendChild(c) { this._children.push(c); return c; },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    getScreenCTM() { return null; },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0 }; },
    createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } }; },
    focus() {}, click() {}, remove() {}
  };
  return el;
}
const idCache = {};
const document = {
  getElementById(id) { return idCache[id] || (idCache[id] = makeEl('div')); },
  createElement(t) { return makeEl(t); },
  createElementNS(ns, t) { return makeEl(t); },
  querySelector() { return makeEl('div'); },
  querySelectorAll() { return []; },
  documentElement: { setAttribute() {}, getAttribute() { return 'zh-CN'; } },
  addEventListener() {}, body: makeEl('body')
};
class IntersectionObserver { observe() {} unobserve() {} disconnect() {} }
function DOMPoint(x, y) { this.x = x; this.y = y; this.matrixTransform = () => ({ x: 0, y: 0 }); }
const localStorage = { getItem() { return null; }, setItem() {} };
const sandbox = {
  console, Math, JSON, Date, isFinite, parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Proxy, WeakMap, Set, Map,
  addEventListener() {}, removeEventListener() {},
  document, IntersectionObserver, DOMPoint, localStorage,
  performance: { now: () => Date.now() / 1000 },
  requestAnimationFrame: () => 0,
  getComputedStyle: () => ({ backgroundColor: '#000' }),
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  location: { hash: '', origin: '', pathname: '' },
  window: { prompt() {}, __rebuildModal: null }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox; // window===global 简化
vm.createContext(sandbox);

// 暴露内部对象
script += '\n;globalThis.__M=MECHANISMS; globalThis.__CATS=CATS; globalThis.__solveDrag=solveDrag; globalThis.__ik=ikArm2; globalThis.__openModal=openModal;';

try { vm.runInContext(script, sandbox, { filename: 'mech.js', timeout: 20000 }); }
catch (err) { console.error('RUNTIME ERROR:', err.message, '\n', err.stack); process.exit(1); }

const M = sandbox.__M, CATS = sandbox.__CATS, solveDrag = sandbox.__solveDrag;
if (!M) { console.error('MECHANISMS 未导出'); process.exit(1); }

// 4) 校验逻辑
const BAD = [];
let RUN_OK = 0, RUN_FAIL = 0, POSE_OK = 0, POSE_FAIL = 0;
function checkNums(tag, val, where) {
  if (val == null) return;
  const str = String(val);
  if (str.indexOf('NaN') >= 0 || str.indexOf('Infinity') >= 0) { BAD.push(where + ' NaN/Inf in ' + tag + '=' + str); return; }
  const m = str.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g);
  if (!m) return;
  for (const n of m) {
    const v = parseFloat(n);
    if (!isFinite(v)) { BAD.push(where + ' !finite ' + tag + '=' + n); }
    else if (tag !== 'transform' && tag !== 'style' && Math.abs(v) > 400) { BAD.push(where + ' OVERFLOW ' + tag + '=' + n); }
  }
}
function walk(el, where) {
  for (const k in el._attrs) checkNums(k, el._attrs[k], where);
  for (const c of el._children) walk(c, where);
}
function runMech(key, m, cp) {
  const svg = makeEl('g');
  let upd;
  try { upd = m.build(svg, cp); }
  catch (err) { BAD.push(key + ' BUILD ERR ' + err.message); RUN_FAIL++; return; }
  if (typeof upd !== 'function') { BAD.push(key + ' upd not fn'); RUN_FAIL++; return; }
  for (const t of [0, 0.7, 1.5, 3.2, 5.0, 8.0, 10.0]) {
    try { upd(t); } catch (err) { BAD.push(key + ' RUN ERR@' + t + ' ' + err.message); RUN_FAIL++; return; }
    walk(svg, key + '@' + t);
  }
  RUN_OK++;
}

const keys = Object.keys(M);
for (const key of keys) {
  const m = M[key];
  const cases = [{}];
  if (m.inputs && m.inputs.length) {
    const min = {}, max = {};
    m.inputs.forEach(i => { min[i.key] = i.min; max[i.key] = i.max; });
    cases.push(min, max);
  }
  for (const cp of cases) runMech(key, m, cp);
  // pose 模式（可拖拽反解机构）
  if (m.drag && m.inputs) {
    const st = {}; m.inputs.forEach(i => st[i.key] = i.value);
    let tx, ty;
    if (m.drag.type === 'delta') { tx = 100; ty = 60; }
    else { const O = m.drag.O; const L = st[m.drag.keys[0]] + st[m.drag.keys[1]]; const r = L * 0.6; tx = O[0] + r * Math.cos(0.9); ty = O[1] - r * Math.sin(0.9); }
    const pose = solveDrag(m.drag, { x: tx, y: ty }, st);
    if (pose) {
      const cp = Object.assign({}, st, { __pose: pose });
      const svg = makeEl('g');
      try {
        const upd = m.build(svg, cp);
        if (typeof upd === 'function') {
          for (const t of [0, 2, 5]) { upd(t); walk(svg, key + '[pose]@' + t); }
          POSE_OK++;
        } else POSE_FAIL++;
      } catch (err) { BAD.push(key + ' POSE BUILD ERR ' + err.message); POSE_FAIL++; }
    }
  }
}

// 5) 分类一致性
let catBad = 0;
for (const k of keys) if (!CATS.includes(M[k].cat)) { catBad++; BAD.push(k + ' cat not in CATS: ' + M[k].cat); }

console.log('MECH_COUNT', keys.length);
console.log('CAT_COUNT', CATS.length);
// 6) openModal 运行检查（覆盖 rebuild + 拖拽/着色 胶水代码）
if (sandbox.__openModal) {
  const openTests = ['slider-crank', 'robot-2r', 'robot-delta', 'bionic-flapping'];
  for (const k of openTests) {
    try { sandbox.__openModal(k, M[k]); }
    catch (err) { BAD.push('OPENMODAL ' + k + ' ' + err.message); }
  }
}
console.log('RUN_OK', RUN_OK, 'RUN_FAIL', RUN_FAIL);
console.log('POSE_OK', POSE_OK, 'POSE_FAIL', POSE_FAIL);
console.log('BAD_COUNT', BAD.length);
console.log('CAT_NOT_IN_CATS', catBad);
if (BAD.length) { console.log('--- BAD SAMPLE ---'); BAD.slice(0, 40).forEach(b => console.log(b)); }
console.log(BAD.length ? 'RESULT: FAIL' : 'RESULT: PASS');
