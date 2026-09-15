// -*- coding: utf-8 -*-
/* validate2.js — 方向②专项校验：在带真实 getBBox / 选择器 / canvas 的 DOM 桩中
 * 打开代表性机构弹窗，验证 性能曲线绘制 + 约束校验（Grashof / 齿轮根切 / 死点）。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const s = html.indexOf('<script>');
const e = html.lastIndexOf('</script>');
if (s < 0 || e < 0) { console.error('未找到 <script>'); process.exit(1); }
let script = html.slice(s + 8, e);

function bboxOf(el) {
  const a = el._attrs || {}; const t = (el.tagName || '').toLowerCase();
  if (t === 'circle') { const cx = +a.cx || 0, cy = +a.cy || 0, r = +a.r || 0; return { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }; }
  if (t === 'rect') { return { x: +a.x || 0, y: +a.y || 0, width: +a.width || 0, height: +a.height || 0 }; }
  if (t === 'line') { const x1 = +a.x1 || 0, y1 = +a.y1 || 0, x2 = +a.x2 || 0, y2 = +a.y2 || 0; const x = Math.min(x1, x2), y = Math.min(y1, y2); return { x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }; }
  if (t === 'ellipse') { const cx = +a.cx || 0, cy = +a.cy || 0, rx = +a.rx || 0, ry = +a.ry || 0; return { x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry }; }
  if (t === 'polygon' || t === 'polyline') {
    const nums = (a.points || '').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    let xs = [], ys = []; for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
    if (!xs.length) return { x: 0, y: 0, width: 0, height: 0 };
    const x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
    return { x, y, width: Math.max.apply(null, xs) - x, height: Math.max.apply(null, ys) - y };
  }
  if (t === 'g' || t === 'svg') {
    let bx = Infinity, by = Infinity, bX = -Infinity, bY = -Infinity, done = false;
    for (const c of el._children) { const b = bboxOf(c); if (b.width === 0 && b.height === 0) continue; done = true; bx = Math.min(bx, b.x); by = Math.min(by, b.y); bX = Math.max(bX, b.x + b.width); bY = Math.max(bY, b.y + b.height); }
    if (!done) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: bx, y: by, width: bX - bx, height: bY - by };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}
function matchSel(el, sel) {
  let s = sel.trim(); const am = s.match(/\[([\w-]+)\]/); let attr = null; if (am) { attr = am[1]; s = s.replace(am[0], ''); }
  const cls = (s.match(/\.([\w-]+)/g) || []).map(x => x.slice(1)); s = s.replace(/\.[\w-]+/g, '');
  const tag = s.trim().toLowerCase();
  if (tag && el.tagName.toLowerCase() !== tag) return false;
  if (attr && el.getAttribute(attr) == null) return false;
  const c = (el.getAttribute('class') || '').split(/\s+/);
  for (const cl of cls) if (!c.includes(cl)) return false;
  return true;
}
function qsa(root, sel) { const out = []; const sim = sel.split(',').map(x => x.trim()); (function rec(n) { for (const ch of n._children) { for (const sm of sim) if (matchSel(ch, sm)) out.push(ch); rec(ch); } })(root); return out; }

let lineToCount = 0;
function makeCanvas() {
  const ctx = { strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', clearRect() {}, beginPath() {}, moveTo() {}, lineTo() { lineToCount++; }, stroke() {}, fillText() {} };
  return { tagName: 'CANVAS', _attrs: { width: 520, height: 240 }, width: 520, height: 240, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, getContext() { return ctx; }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; }, getBBox() { return bboxOf(this); }, querySelectorAll() { return []; }, appendChild() {}, addEventListener() {} };
}
function makeEl(tag) {
  tag = tag || 'div';
  return {
    tagName: tag.toUpperCase(), _attrs: {}, _children: [],
    style: new Proxy({}, { set() { return true; }, get() { return ''; } }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, textContent: '', innerHTML: '',
    appendChild(c) { this._children.push(c); return c; },
    setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    querySelector() { return makeEl('div'); }, querySelectorAll(sel) { return qsa(this, sel); },
    addEventListener() {}, removeEventListener() {},
    getScreenCTM() { return null; }, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0 }; },
    createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } }; },
    focus() {}, click() {}, remove() {}, getBBox() { return bboxOf(this); }
  };
}
const idCache = {};
const document = {
  getElementById(id) {
    if (idCache[id]) return idCache[id];
    if (id === 'perfCanvas') { idCache[id] = makeCanvas(); return idCache[id]; }
    return idCache[id] = makeEl('div');
  },
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
  location: { hash: '', origin: '', pathname: '' }
};
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);

script += '\n;globalThis.__openModal=openModal; globalThis.__getUpd=()=>modalUpdRaw; globalThis.__M=MECHANISMS; globalThis.__pinInfo=()=>(typeof modalG!=="undefined"&&modalG)?{pin:Array.prototype.slice.call(modalG.querySelectorAll("circle.pin")).map(c=>[+(+c.getAttribute("cx")).toFixed(1),+(+c.getAttribute("cy")).toFixed(1)]),pinB:Array.prototype.slice.call(modalG.querySelectorAll("circle.pinB")).map(c=>[+(+c.getAttribute("cx")).toFixed(1),+(+c.getAttribute("cy")).toFixed(1)])}:null; globalThis.__teeth=()=>(typeof modalG!=="undefined"&&modalG)?modalG.querySelectorAll("[data-teeth]").map(g=>g.getAttribute("data-teeth")):null; globalThis.__pins=()=>(typeof modalG!=="undefined"&&modalG)?[modalG.querySelectorAll("circle.pin").length, modalG.querySelectorAll("circle.pinB").length]:null;';
try { vm.runInContext(script, sandbox, { filename: 'mech.js', timeout: 30000 }); }
catch (err) { console.error('RUNTIME ERROR:', err.message, '\n', err.stack); process.exit(1); }
const M = sandbox.__M;
if (!M) { console.error('MECHANISMS 未导出'); process.exit(1); }

const samples = ['four-bar', 'crank-rocker', 'gear', 'slider-crank', 'cam', 'robot-2r', 'klann-linkage', 'bionic-flapping'];
let fail = 0;
for (const k of samples) {
  if (!M[k]) { console.log('!! 缺失机构', k); fail++; continue; }
  lineToCount = 0;
  try { sandbox.__openModal(k, M[k]); }
  catch (err) { console.log('OPENFAIL', k, err.message); fail++; continue; }
  if (k === 'four-bar' || k === 'robot-2r') {
    const upd = sandbox.__getUpd && sandbox.__getUpd();
    if (upd) { for (const tt of [0, 0.5, 1.0, 1.5, 2.0]) { upd(tt); const p = sandbox.__pinInfo(); console.log('   DBG ' + k + ' t=' + tt.toFixed(1) + ' pinB=' + JSON.stringify(p.pinB)); } }
  }
  const pi = sandbox.__pinInfo && sandbox.__pinInfo();
  const kin = sandbox.__kin;
  const S = sandbox.__lastS;
  let minima = -1;
  if (S && S.deadV) { const dv = S.deadV, n = dv.length, w = 2, sm = dv.slice(); for (let p = 0; p < 1; p++) { const cur = sm.slice(); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let jk = -w; jk <= w; jk++) { const j = (i + jk + n) % n; s += cur[j]; c++; } sm[i] = s / c; } } const vmax = Math.max.apply(null, sm) || 1, thr = vmax * 0.06; for (let i = 0; i < n; i++) { const a = sm[(i - 1 + n) % n], b = sm[i], c = sm[(i + 1 + n) % n]; if (b < thr && b <= a && b <= c) minima++; } }
  console.log('\n=== ' + k + ' ===');
  console.log('  pins:', pi ? JSON.stringify(pi) : 'n/a');
  console.log('  kin: ci=' + (kin ? kin.ci : '?') + ' di=' + (kin ? kin.di : '?') + ' maxAmp=' + (kin ? kin.maxAmp : '?') + ' period=' + (kin ? kin.period : '?') + ' amps=' + (kin ? JSON.stringify(kin.amps) : '?'));
  console.log('  deadV: len=' + (S && S.deadV ? S.deadV.length : 0) + ' minima(复算)=' + minima);
  const box = (idCache['constraintBox'] && idCache['constraintBox'].innerHTML) || '';
  const drew = lineToCount > 0;
  const pureRot = sandbox.__kin && sandbox.__kin.pureRot;
  console.log('  perf曲线绘制(lineTo次数):', lineToCount, drew ? 'OK' : (pureRot ? 'NONE(纯回转·正常)' : 'NONE'));
  const cb = box.replace(/\s+/g, ' ');
  const dm = cb.match(/检测到 (\d+) 处/);
  console.log('  约束面板死点条目:', dm ? dm[1] + ' 处' : (cb.indexOf('无死点') >= 0 || cb.indexOf('未检出') >= 0 ? '0 处(OK)' : '?'));
  if (!drew && !pureRot) { console.log('  !! 未绘制性能曲线'); fail++; }
}
console.log('\nSAMPLE_FAIL', fail);
console.log(fail ? 'RESULT: FAIL' : 'RESULT: PASS');
