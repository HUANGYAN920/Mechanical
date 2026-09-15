/* gen_readme.js
 * 从 index.html 自动解析 MECHANISMS，重算机构总数 / 分类数 / 机构库一览表，
 * 回写 README.md 的计数文案与表格，避免手工同步 "257 种 · 11 大分类" 等硬编码。
 * 用法：node gen_readme.js
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlPath = path.join(dir, 'index.html');
const mdPath = path.join(dir, 'README.md');

const html = fs.readFileSync(htmlPath, 'utf8');

/* ---- 1. 抽取 MECHANISMS 对象字面量 ---- */
const startMarker = 'const MECHANISMS = {';
const si = html.indexOf(startMarker);
if (si < 0) throw new Error('未找到 const MECHANISMS');
const objStart = si + startMarker.length - 1; // 指向第一个 {
const endMarker = '};\nfunction drawGear';
const ei = html.indexOf(endMarker, objStart);
if (ei < 0) throw new Error('未找到 MECHANISMS 结束标记 };\\nfunction drawGear');
const objText = html.slice(objStart, ei + 1); // 含结尾 }

/* ---- 2. 在沙箱中求值（build 体不执行，仅读取数据字段） ---- */
const sandbox = {
  Math, JSON, console,
  el: () => null, setAttr: () => {}, easeInOut: k => k,
  drawGear: () => {}, document: {}, window: {},
};
const vm = require('vm');
const ctx = vm.createContext(sandbox);
const MECH = vm.runInContext('(' + objText + ')', ctx, { timeout: 5000 });

const keys = Object.keys(MECH);
const N = keys.length;

/* ---- 3. 分类顺序（取自 CATS 数组） ---- */
const catsMatch = html.match(/const CATS\s*=\s*\[([\s\S]*?)\];/);
if (!catsMatch) throw new Error('未找到 CATS 数组');
const CATS = catsMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
const C = CATS.length;

/* 校验：每个机构 cat 都应在 CATS 中 */
const badCat = [];
for (const k of keys) {
  if (!CATS.includes(MECH[k].cat)) badCat.push(k + ' -> ' + MECH[k].cat);
}
if (badCat.length) console.warn('⚠ 分类不在 CATS 中：', badCat.join('; '));

/* ---- 4. 按分类聚合机构中文名 ---- */
const byCat = {};
for (const c of CATS) byCat[c] = [];
for (const k of keys) byCat[MECH[k].cat].push(MECH[k].name);

/* 带英文名的分类映射（README 仍用中文分类名，这里仅用于自检） */
const catEn = {
  '连杆机构': 'LINKAGE', '凸轮机构': 'CAM', '齿轮机构': 'GEAR',
  '间歇机构': 'INTERMITTENT', '螺旋机构': 'SCREW', '夹紧机构': 'CLAMP',
  '液压机构': 'HYDRAULIC', '万向传动': 'UNIVERSAL', '挠性传动': 'FLEXIBLE',
  '机器人机构': 'ROBOT', '仿生机构': 'BIONIC'
};

/* ---- 5. 回写 README ---- */
let md = fs.readFileSync(mdPath, 'utf8');

function replaceOnce(text, re, repl, label) {
  const m = text.match(re);
  if (!m) { console.warn('⚠ 未匹配到：', label); return text; }
  if ((text.match(re) || []).length !== 1) console.warn('⚠ 多处匹配：', label);
  return text.replace(re, repl);
}

/* 5.1 计数文案（4 处） */
md = replaceOnce(md, /257 种经典机械机构/, `${N} 种经典机械机构`, 'intro count');
md = replaceOnce(md, /全 257 种/, `全 ${N} 种`, 'param count');
md = replaceOnce(md, /257 种机构 · 11 大分类/, `${N} 种机构 · ${C} 大分类`, 'feature count');
md = replaceOnce(md, /全部 257 种机构均支持参数化实时仿真/, `全部 ${N} 种机构均支持参数化实时仿真`, 'table note count');

/* 5.2 机构库一览表（替换从表头到末行，保留 > 📌 注释） */
const tableRe = /(\| 分类\s+[|\s\S]*?)(> 📌)/;
if (!tableRe.test(md)) {
  console.warn('⚠ 未匹配到机构库一览表区域');
} else {
  let rows = '| 分类   | 机构 |\n| ---- | ---- |\n';
  for (const c of CATS) {
    const names = (byCat[c] || []).join(' · ');
    rows += `| ${c} | ${names} |\n`;
  }
  md = md.replace(tableRe, rows + '\n> 📌');
}

fs.writeFileSync(mdPath, md, 'utf8');

/* ---- 6. 汇报 ---- */
console.log('MECH_COUNT', N);
console.log('CAT_COUNT', C);
console.log('CATS', CATS.join(' / '));
console.log('BY_CAT', CATS.map(c => c + '=' + (byCat[c] || []).length).join('  '));
console.log('CAT_NOT_IN_CATS', badCat.length);
console.log('OK: README.md 已更新');
