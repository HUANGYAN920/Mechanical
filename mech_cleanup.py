# -*- coding: utf-8 -*-
import os, io

# 1) 删除一次性注入脚本
tmp = r'D:\我的文档\Documents\Loomy Workspace\机械机构示例科技风网页\apply_i18n.py'
if os.path.exists(tmp):
    os.remove(tmp)
    print('removed', tmp)
else:
    print('already gone', tmp)

# 2) 写工作日志
mem_dir = r'C:\Users\Administrator\WorkBuddy\机械引擎网站\.workbuddy\memory'
os.makedirs(mem_dir, exist_ok=True)
mem_path = os.path.join(mem_dir, '2026-09-11.md')
content = """# 2026-09-11 工作日志

## 机械机构示例网页 index.html — Task #6 完成
- **README 计数自动生成**：`gen_readme.js`（项目根目录）解析 index.html 的 `MECHANISMS`，自动重写 README 计数文案（257 种 · 11 大分类）与「机构库一览」表，避免手工同步。运行：`python gen_readme.js`。
- **中英多语言 (i18n)**：注入顶栏 `中/EN` 切换、静态文案 `data-i18n`、动态文案（`renderGrid`/`openModal`/`renderFilters`/`renderMarquee` 用 `_()`），机构名/英文名/分类随语言切换，localStorage 记忆语言。
- **速度/受力着色**：弹窗「速度着色」按钮，按每帧各运动图元位移速度映射热力色（青→琥珀→玫红），静止地/轨迹不计色；关闭清除内联样式恢复类配色。
- **SVG 拖拽反解 (IK)**：为 `robot-2r`/`robot-scara`/`robot-delta`/`robot-redundant` 增加 `drag` 描述符 + 逆解（`ikArm2`/`ikArm3`/`ikDelta`/`ccInt`）；弹窗 SVG 支持指针拖拽末端实时反解并定格（暂停）。
- **校验**：`validate.js`（DOM 桩）抽取 `<script>` 运行，全 257 机构 default/min/max + 4 机构 pose 跑更新闭包，检测 NaN/越界；结果 RUN_OK 771 / POSE_OK 4 / 0 异常。修复 `ikArm3` 返回字段命名 bug（原返回 `a1,a2`，build 的 `solve` 期望 `th2,th3` 导致 NaN）。
- **遗留**：`peaucellier` 机构 y 最大 ~419，超出 200×150 viewBox，属历史遗留（本次未改动，非 #6 回归）。

## 待办（用户既定优先级）
- 方向②（最后）：性能曲线（位移/速度/加速度图）+ 约束校验（四连杆 Grashof、死点预警、齿轮根切/干涉）。
"""
io.open(mem_path, 'w', encoding='utf-8').write(content)
print('mem written', mem_path)
