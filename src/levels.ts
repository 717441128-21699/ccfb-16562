// ============================================================
// 关卡与传统纹样生成:菱格朵梅、万字不到头、祥云、缠枝莲、
// 宝相团花、八达晕、妆花云龙大缎
// ============================================================
import {
  Design, LevelDef, LoomSpec, GroundWeave,
  insertTieDowns, countEarThreads,
} from './weave.js';

// ------------------------------------------------------------
// 位图画笔
// ------------------------------------------------------------
class P {
  constructor(public a: Uint8Array, public W: number, public H: number) {}

  set(x: number, y: number, v = 1): void {
    x |= 0; y |= 0;
    if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.a[y * this.W + x] = v;
  }
  get(x: number, y: number): number {
    if (x < 0 || x >= this.W || y < 0 || y >= this.H) return 0;
    return this.a[(y | 0) * this.W + (x | 0)];
  }
  line(x0: number, y0: number, x1: number, y1: number, v = 1): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, t: number, v = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
      this.disc(x, y, t / 2, v);
    }
  }
  fillRect(x0: number, y0: number, x1: number, y1: number, v = 1): void {
    for (let y = Math.max(0, y0 | 0); y <= Math.min(this.H - 1, y1 | 0); y++)
      for (let x = Math.max(0, x0 | 0); x <= Math.min(this.W - 1, x1 | 0); x++)
        this.a[y * this.W + x] = v;
  }
  circle(cx: number, cy: number, r: number, v = 1): void {
    let x = r | 0, y = 0, err = 1 - x;
    while (x >= y) {
      for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]])
        this.set(cx + px, cy + py, v);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }
  disc(cx: number, cy: number, r: number, v = 1): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) this.set(x, y, v);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, v = 1): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, v);
      }
  }
  /** 螺旋(云头):从 r0 旋到 r1 */
  spiral(cx: number, cy: number, r0: number, r1: number, turns: number, thick: number, v = 1): void {
    const steps = Math.ceil(turns * 64);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const th = t * turns * 2 * Math.PI;
      const r = r0 + (r1 - r0) * t;
      this.disc(cx + r * Math.cos(th), cy + r * Math.sin(th), thick / 2, v);
    }
  }
  polygon(pts: number[][], v = 1, thick = 1): void {
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if (thick <= 1) this.line(x0, y0, x1, y1, v);
      else this.thickLine(x0, y0, x1, y1, thick, v);
    }
  }
  /** 左半镜像到右半(以垂直中轴) */
  mirrorH(): void {
    const { a, W, H } = this;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W >> 1; x++)
        a[y * W + (W - 1 - x)] = a[y * W + x];
  }
  /** 把 src 中 pw×ph 的底子平铺整个画面;alt=true 时隔块左右翻转 */
  tile(src: Uint8Array, pw: number, ph: number, alt = false): void {
    const { a, W, H } = this;
    for (let ty = 0; ty * ph < H; ty++)
      for (let tx = 0; tx * pw < W; tx++) {
        const flip = alt && ((tx + ty) & 1) === 1;
        for (let y = 0; y < ph && ty * ph + y < H; y++)
          for (let x = 0; x < pw && tx * pw + x < W; x++) {
            const sx = flip ? pw - 1 - x : x;
            a[(ty * ph + y) * W + (tx * pw + x)] = src[y * pw + sx];
          }
      }
  }
}

// ------------------------------------------------------------
// 关卡装配
// ------------------------------------------------------------
interface GenResult {
  knots: Uint8Array;
  weftSeq: Uint16Array;
  freeRows?: number[];   // 整行设为自由格(玩家自行打间丝)
}

function makeLevel(
  id: string, name: string, subtitle: string,
  ground: GroundWeave, floatLimit: number,
  palette: string[], shuttles: number[], shuttleEditable: boolean,
  W: number, H: number, gen: () => GenResult, tips: string[],
): LevelDef {
  const g = gen();
  const free = new Uint8Array(W * H);
  if (g.freeRows) for (const y of g.freeRows) {
    if (y >= 0 && y < H) free.fill(1, y * W, y * W + W);
  }
  insertTieDowns(g.knots, free, W, H, floatLimit);
  const spec: LoomSpec = {
    warps: W, picks: H, ground, floatLimit,
    palette, groundWeft: 1, shuttles, shuttleEditable,
  };
  const design: Design = { knots: g.knots, free, weftSeq: g.weftSeq };
  const par = countEarThreads(g.knots, W, H);
  return { id, name, subtitle, spec, design, par, tips };
}

const seq = (H: number, fn: (p: number) => number): Uint16Array => {
  const s = new Uint16Array(H);
  for (let p = 0; p < H; p++) s[p] = fn(p);
  return s;
};

// ------------------------------------------------------------
// 一、菱格朵梅(入门)
// ------------------------------------------------------------
function genLingGe(W: number, H: number): GenResult {
  const p = new P(new Uint8Array(W * H), W, H);
  const S = 24; // 菱格间距
  // 菱格斜线
  for (let k = -H; k < W + H; k += S) {
    p.line(k, 0, k + H, H);
    p.line(k, 0, k - H, H);
  }
  // 朵梅:菱格中心四瓣小花
  for (let cy = S / 2; cy < H; cy += S)
    for (let cx = S / 2; cx < W; cx += S) {
      p.disc(cx, cy - 3, 2.2);
      p.disc(cx, cy + 3, 2.2);
      p.disc(cx - 3, cy, 2.2);
      p.disc(cx + 3, cy, 2.2);
      p.set(cx | 0, cy | 0);
    }
  return { knots: p.a, weftSeq: seq(H, () => 0) };
}

// ------------------------------------------------------------
// 二、万字不到头
// ------------------------------------------------------------
function genWanZi(W: number, H: number): GenResult {
  const T = 12; // 卍单元
  const p = new P(new Uint8Array(T * T), T, T);
  // 卍:四臂左旋
  p.fillRect(5, 0, 6, 5);   // 上臂
  p.fillRect(5, 0, 10, 1);  // 上臂东折
  p.fillRect(6, 5, 11, 6);  // 右臂
  p.fillRect(10, 5, 11, 10);// 右臂南折
  p.fillRect(5, 6, 6, 11);  // 下臂
  p.fillRect(1, 10, 6, 11); // 下臂西折
  p.fillRect(0, 5, 5, 6);   // 左臂
  p.fillRect(0, 1, 1, 6);   // 左臂北折
  const q = new P(new Uint8Array(W * H), W, H);
  q.tile(p.a, T, T, false);
  return { knots: q.a, weftSeq: seq(H, () => 0) };
}

// ------------------------------------------------------------
// 三、祥云献瑞
// ------------------------------------------------------------
function genXiangYun(W: number, H: number): GenResult {
  const p = new P(new Uint8Array(W * H), W, H);
  const half = W >> 1;
  // 三朵祥云:大中小,云头螺旋 + 云尾飘逸
  const cloud = (cx: number, cy: number, s: number) => {
    p.spiral(cx, cy, 1.5, 9 * s, 2.2, 3);
    p.spiral(cx + 16 * s, cy - 4 * s, 1, 5.5 * s, 1.8, 2.5);
    // 云尾
    let x = cx + 20 * s, y = cy + 2 * s;
    for (let i = 0; i < 26 * s; i++) {
      p.disc(x, y, 1.6);
      x += 1.6; y += Math.sin(i / 5) * 1.2;
    }
  };
  cloud(half * 0.45, H * 0.30, 1.0);
  cloud(half * 0.60, H * 0.62, 1.25);
  cloud(half * 0.35, H * 0.82, 0.8);
  // 底部流云横带
  for (let x = 8; x < half - 8; x += 4) {
    const y = H * 0.52 + Math.sin(x / 14) * 3;
    p.disc(x, y, 1.4);
  }
  p.mirrorH();
  // 云带处换银梭,其余用蓝梭
  const weftSeq = seq(H, y => (y > H * 0.45 && y < H * 0.60) ? 1 : 0);
  return { knots: p.a, weftSeq };
}

// ------------------------------------------------------------
// 四、缠枝莲
// ------------------------------------------------------------
function genChanZhiLian(W: number, H: number): GenResult {
  const p = new P(new Uint8Array(W * H), W, H);
  const half = W >> 1;
  const bloomRows: boolean[] = new Array(H).fill(false);
  // 两条缠枝:正弦藤蔓
  for (const [baseY, amp, per, phase] of [[H * 0.30, 16, 96, 0], [H * 0.70, 18, 110, 2]] as const) {
    let px = 0, py = baseY;
    for (let x = 0; x < half; x += 1) {
      const y = baseY + amp * Math.sin(2 * Math.PI * x / per + phase);
      p.thickLine(px, py, x, y, 2.5);
      px = x; py = y;
      // 枝上小叶
      if (x % 18 === 9) {
        const dir = Math.cos(2 * Math.PI * x / per + phase) > 0 ? -1 : 1;
        p.ellipse(x, y + dir * 7, 3, 6);
      }
    }
    // 莲花:波峰处盛开
    for (let x = per / 4; x < half; x += per / 2) {
      const y = baseY + amp * Math.sin(2 * Math.PI * x / per + phase);
      const by = y - 14;
      for (let k = 0; k < 5; k++) {
        const th = -Math.PI / 2 + (k - 2) * 0.5;
        p.ellipse(x + 9 * Math.cos(th), by + 9 * Math.sin(th), 3.5, 6);
      }
      p.disc(x, by, 3);
      const yy = Math.max(0, Math.min(H - 1, Math.round(by)));
      bloomRows[yy] = true;
    }
  }
  p.mirrorH();
  // 含莲花的纬用红梭,其余金梭
  const weftSeq = seq(H, y => bloomRows[y] ? 1 : 0);
  return { knots: p.a, weftSeq };
}

// ------------------------------------------------------------
// 五、宝相团花(八出放射,左右上下皆对称)
// ------------------------------------------------------------
function genTuanHua(W: number, H: number): GenResult {
  const p = new P(new Uint8Array(W * H), W, H);
  const cx = W / 2, cy = H / 2;
  // 中心花蕊
  p.disc(cx, cy, 6);
  p.circle(cx, cy, 10);
  // 八出花瓣环
  for (const [R, pr, n] of [[22, 7, 8], [44, 9, 8], [70, 6, 16]] as const) {
    for (let k = 0; k < n; k++) {
      const th = 2 * Math.PI * k / n + (n === 16 ? Math.PI / 16 : 0);
      p.ellipse(cx + R * Math.cos(th), cy + R * Math.sin(th), pr, pr * 0.62);
    }
  }
  // 外层联珠纹
  for (let k = 0; k < 32; k++) {
    const th = 2 * Math.PI * k / 32;
    p.disc(cx + 88 * Math.cos(th), cy + 88 * Math.sin(th), 1.8);
  }
  p.circle(cx, cy, 96);
  p.circle(cx, cy, 100);
  // 四角角花
  for (const [ax, ay] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]] as const) {
    p.disc(ax, ay, 5);
    for (let k = 0; k < 8; k++) {
      const th = 2 * Math.PI * k / 8;
      p.disc(ax + 11 * Math.cos(th), ay + 11 * Math.sin(th), 2.5);
    }
  }
  // 三色纬分区:外环金、中环红、内心金
  const weftSeq = seq(H, y => {
    const d = Math.abs(y - cy);
    return (d >= 30 && d < 75) ? 1 : 0;
  });
  return { knots: p.a, weftSeq };
}

// ------------------------------------------------------------
// 六、八达晕锦(几何八达,四色彩纬,含自由间丝带)
// ------------------------------------------------------------
function genBaDaYun(W: number, H: number): GenResult {
  const p = new P(new Uint8Array(W * H), W, H);
  const oct = (cx: number, cy: number, r: number, thick: number) => {
    const pts: number[][] = [];
    for (let k = 0; k < 8; k++) {
      const th = Math.PI / 8 + Math.PI / 4 * k;
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    p.polygon(pts, 1, thick);
  };
  // 中心重环八达
  const cx = W / 2, cy = H / 2;
  for (const r of [26, 44, 62, 80]) oct(cx, cy, r, 2);
  p.disc(cx, cy, 8);
  // 八路辐射线
  for (let k = 0; k < 8; k++) {
    const th = Math.PI / 4 * k;
    p.thickLine(cx + 84 * Math.cos(th), cy + 84 * Math.sin(th),
                cx + 190 * Math.cos(th), cy + 190 * Math.sin(th), 2);
  }
  // 四隅八达
  for (const [qx, qy] of [[0, 0], [W, 0], [0, H], [W, H]] as const)
    for (const r of [30, 52, 74]) oct(qx, qy, r, 2);
  // 边中八达
  for (const [qx, qy] of [[cx, 0], [cx, H], [0, cy], [W, cy]] as const)
    for (const r of [24, 42]) oct(qx, qy, r, 2);
  // 两条横向彩带(整行结满,设为自由行,由玩家自打间丝)
  const freeRows: number[] = [];
  for (const y0 of [H * 0.25 | 0, H * 0.75 | 0]) {
    for (let y = y0 - 2; y <= y0 + 2; y++) {
      p.fillRect(0, y, W - 1, y);
      freeRows.push(y);
    }
  }
  // 四色彩纬横条
  const weftSeq = seq(H, y => (y / (H / 8) | 0) % 4);
  return { knots: p.a, weftSeq, freeRows };
}

// ------------------------------------------------------------
// 七、妆花云龙大缎(2000×1000,大花楼)
// ------------------------------------------------------------
function genYunLong(W: number, H: number): GenResult {
  const T = 250; // 花本循环单元
  const t = new P(new Uint8Array(T * T), T, T);
  // 行龙:正弦龙身(周期恰为一花本,平铺后首尾相衔)
  const bodyY = (x: number) => T / 2 + 62 * Math.sin(2 * Math.PI * x / T);
  for (let x = 0; x < T; x++) {
    const y = bodyY(x);
    t.disc(x, y, 6.5);
    // 龙鳍
    if (x % 12 === 0) {
      const d = Math.cos(2 * Math.PI * x / T) > 0 ? 1 : -1;
      t.thickLine(x, y, x + 4, y + d * 14, 2);
    }
  }
  // 龙首(右端上扬处)
  const hx = T * 0.22, hy = bodyY(T * 0.22);
  t.disc(hx, hy - 4, 11);
  t.thickLine(hx + 4, hy - 12, hx + 14, hy - 24, 2.5); // 角
  t.thickLine(hx - 2, hy - 13, hx - 10, hy - 26, 2.5);
  t.disc(hx + 12, hy + 2, 4); // 鼻
  // 火焰珠
  const px = T * 0.40, py = bodyY(T * 0.40) - 34;
  t.disc(px, py, 7);
  t.thickLine(px - 4, py - 7, px - 8, py - 16, 2);
  t.thickLine(px, py - 8, px, py - 19, 2);
  t.thickLine(px + 4, py - 7, px + 8, py - 16, 2);
  // 龙爪
  for (const fx of [T * 0.32, T * 0.55, T * 0.72, T * 0.90]) {
    const fy = bodyY(fx);
    const dir = Math.cos(2 * Math.PI * fx / T) > 0 ? 1 : -1;
    t.thickLine(fx, fy, fx + 6, fy + dir * 16, 3);
    t.disc(fx + 8, fy + dir * 18, 2.5);
    t.disc(fx + 4, fy + dir * 20, 2);
  }
  // 祥云环绕
  t.spiral(T * 0.12, T * 0.22, 1.5, 8, 2, 2.5);
  t.spiral(T * 0.62, T * 0.80, 1.5, 9, 2.2, 2.5);
  t.spiral(T * 0.85, T * 0.30, 1, 6, 1.8, 2);
  t.spiral(T * 0.38, T * 0.85, 1, 5, 1.6, 2);
  // 铺地冰梅点
  for (let y = 10; y < T; y += 26)
    for (let x = (y % 52 === 10 ? 8 : 21); x < T; x += 26)
      t.set(x, y);
  // 平铺 8×4,隔块翻转
  const q = new P(new Uint8Array(W * H), W, H);
  q.tile(t.a, T, T, true);
  // 三条金线界栏(自由行,玩家自打间丝)
  const freeRows: number[] = [];
  for (const y0 of [250, 500, 750]) {
    q.fillRect(0, y0 - 1, W - 1, y0);
    freeRows.push(y0 - 1, y0);
  }
  // 四色彩纬,每花一换
  const weftSeq = seq(H, y => (y / 250 | 0) % 4);
  return { knots: q.a, weftSeq, freeRows };
}

// ------------------------------------------------------------
// 关卡表
// 色板约定:[0]=经线色 [1]=地纬色(与经相近) [2..]=彩梭
// ------------------------------------------------------------
export function buildLevels(): LevelDef[] {
  return [
    makeLevel(
      'lv1', '菱格朵梅', '入门·识花本',
      'plain', 5,
      ['#e8dcc0', '#d9c9a6', '#2c4a8c'], [2], false,
      96, 96, () => genLingGe(96, 96),
      [
        '意匠图上的蓝点就是要结耳子线的位置,一格一结。',
        '花本上一结,织出来那一格彩纬就浮到面上显花。',
        '菱格斜线上下左右皆循环,善用「左右循环」「上下循环」可少挑许多。',
        '连续结子超过 5 格彩纬浮太长会勾丝——意匠图上已开好间丝点,照点即可。',
      ],
    ),
    makeLevel(
      'lv2', '万字不到头', '几何·循环之美',
      'plain', 5,
      ['#7a1f1f', '#661919', '#d4a017'], [2], false,
      132, 132, () => genWanZi(132, 132),
      [
        '卍字十二格一循环,是天然的「一花本多用」。',
        '先挑好一个卍字,再用「左右循环」铺满全行,「上下循环」铺满全幅。',
        '挑完看看耳子线数:循环越整,线数越省。',
      ],
    ),
    makeLevel(
      'lv3', '祥云献瑞', '曲线·换色纬',
      'twill21', 6,
      ['#7fa8c9', '#6b92b2', '#f0ead8', '#2f4b7c'], [2, 3], false,
      192, 144, () => genXiangYun(192, 144),
      [
        '地组织换成斜纹,地子纹理与平纹不同,但花本的结法不变。',
        '此幅左右对称:挑左半幅,用「镜像笔」或整行镜像复用,可省一半功夫。',
        '云带处换了银梭,意匠图上颜色不同的纬,织出来云色也不同。',
      ],
    ),
    makeLevel(
      'lv4', '缠枝莲', '长卷·藤蔓连绵',
      'twill21', 4,
      ['#2e4a3a', '#26402f', '#c9a227', '#c25e7a'], [2, 3], false,
      256, 192, () => genChanZhiLian(256, 192),
      [
        '纬浮上限只有 4,藤蔓长条处的间丝点一处都不能漏。',
        '莲花开在红纬行,金纬行是藤蔓——换梭之处意匠图已标好。',
        '缠枝左右对称,镜像复用能省近半耳子线。',
      ],
    ),
    makeLevel(
      'lv5', '宝相团花', '放射·八面玲珑',
      'twill31', 5,
      ['#1f3a6e', '#1a3159', '#d4a017', '#b03a2e'], [2, 3], false,
      256, 256, () => genTuanHua(256, 256),
      [
        '团花八出放射,上下左右皆对称,循环行极多。',
        '两色纬分区:外环与内心金、中环红,意匠图分色即梭色。',
        '耳子线基准数很低——看出哪些纬完全相同,就是省线的关键。',
      ],
    ),
    makeLevel(
      'lv6', '八达晕锦', '换梭·自打间丝',
      'twill31', 6,
      ['#4a2c5a', '#3d2449', '#d4a017', '#b03a2e', '#3a7a8c', '#e8e0d0'], [2, 3, 4, 5], true,
      384, 384, () => genBaDaYun(384, 384),
      [
        '此关可换梭:左侧梭道条按意匠图配色,拖过一段纬即整段换梭。',
        '两条横向彩带是「自由行」:意匠图只画满色,间丝点要你自己开。',
        '在自由行上每隔至多 6 格留一个空结,彩带才不会勾丝。',
      ],
    ),
    makeLevel(
      'lv7', '妆花云龙大缎', '大花楼·两千经',
      'twill21', 7,
      ['#caa64b', '#b8963f', '#e0c060', '#b03a2e', '#2e5aa8', '#3a7a4a'], [2, 3, 4, 5], true,
      2000, 1000, () => genYunLong(2000, 1000),
      [
        '两千经、一千纬的大花楼:一花本 250 经一循环,八花四色。',
        '务必先用「左右循环」铺行、「上下循环」铺幅,否则挑到猴年马月。',
        '四把梭子按 250 纬一换;金线界栏是自由行,间丝自己开。',
        '隔块翻转的花本左右镜像相同,镜像行与正行算同一根耳子线。',
      ],
    ),
  ];
}
