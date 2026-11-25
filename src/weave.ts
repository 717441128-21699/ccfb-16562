// ============================================================
// 织锦核心:地组织、花本、提综与交织计算
// 规则设定(下压式花综):
//   花本上某纬某经结了耳子线(knot=1)→ 该经此纬沉于纬下,彩纬浮于面上显花
//   未结(knot=0)→ 由地综按地组织(平纹/斜纹)起落
// ============================================================

export type GroundWeave = 'plain' | 'twill21' | 'twill31';

export const GROUND_NAMES: Record<GroundWeave, string> = {
  plain: '平纹',
  twill21: '二一下斜纹',
  twill31: '三一下斜纹',
};

export interface LoomSpec {
  warps: number;          // 经线数
  picks: number;          // 纬线数
  ground: GroundWeave;    // 地组织
  floatLimit: number;     // 纬浮上限(超过即勾丝)
  palette: string[];      // 色板:0=经线色, 1=地纬色, 其余为彩梭色
  groundWeft: number;     // 地纬色(色板索引,地部交织用,与经色相近)
  shuttles: number[];     // 每把梭子用色板中哪一色(彩纬)
  shuttleEditable: boolean; // 是否允许玩家换梭配彩纬
}

/** 地综提沉:返回 1=经在纬上, 0=纬在经上 */
export function groundLift(g: GroundWeave, w: number, p: number): number {
  if (g === 'plain') return (w + p) & 1;
  if (g === 'twill21') return ((w + 2 * p) % 3 + 3) % 3 !== 2 ? 1 : 0;
  return ((w + p) & 3) !== 3 ? 1 : 0; // twill31
}

/** 某点的最终提沉:花本结则沉(显花),否则随地综 */
export function warpUp(spec: LoomSpec, knots: Uint8Array, w: number, p: number): number {
  return knots[p * spec.warps + w] ? 0 : groundLift(spec.ground, w, p);
}

// ------------------------------------------------------------
// 意匠图(关卡给出的目标)
// ------------------------------------------------------------
export interface Design {
  knots: Uint8Array;      // W*P 理想花本(1=显花处)
  free: Uint8Array;       // W*P 自由格(可结可不结,用于玩家自行打间丝)
  weftSeq: Uint16Array;   // P 每纬目标用梭
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  spec: LoomSpec;
  design: Design;
  par: number;            // 耳子线基准数(理想花本去重后)
  tips: string[];
}

// ------------------------------------------------------------
// 织造:逐纬计算布面色
// face 输出为色板索引,W*P
// ------------------------------------------------------------
export function weavePick(
  spec: LoomSpec, knots: Uint8Array, weftSeq: Uint16Array,
  p: number, face: Uint8Array,
): void {
  const W = spec.warps;
  const off = p * W;
  const weftColor = spec.shuttles[weftSeq[p] % spec.shuttles.length];
  const g = spec.ground;
  const gw = spec.groundWeft;
  for (let w = 0; w < W; w++) {
    if (knots[off + w]) face[off + w] = weftColor;          // 花本结处:彩纬浮面显花
    else face[off + w] = groundLift(g, w, p) ? 0 : gw;      // 地部:经与地纬交织
  }
}

export function weaveAll(
  spec: LoomSpec, knots: Uint8Array, weftSeq: Uint16Array, face: Uint8Array,
): void {
  for (let p = 0; p < spec.picks; p++) weavePick(spec, knots, weftSeq, p, face);
}

// ------------------------------------------------------------
// 纬浮检测(妆花机制):彩纬只在花本结子处浮于面上,
// 连续结子数即彩纬浮长;超过上限 → 勾丝。
// 间丝点(结子中留空)可打断浮长。
// out: W*P 标记数组(1=超标浮长覆盖的格子),返回超标段数
// ------------------------------------------------------------
export function detectFloats(spec: LoomSpec, knots: Uint8Array, out: Uint8Array): number {
  const W = spec.warps, P = spec.picks, L = spec.floatLimit;
  out.fill(0);
  let segments = 0;
  for (let p = 0; p < P; p++) {
    const off = p * W;
    let runStart = -1, run = 0;
    for (let w = 0; w <= W; w++) {
      const isKnot = w < W && knots[off + w] === 1;
      if (isKnot) {
        if (run === 0) runStart = w;
        run++;
      } else {
        if (run > L) {
          segments++;
          for (let x = runStart; x < runStart + run; x++) out[off + x] = 1;
        }
        run = 0;
      }
    }
  }
  return segments;
}

// ------------------------------------------------------------
// 对照:玩家织物 vs 意匠图
// mismatch: W*P 标记(1=不一致)。
// 普通格:面色须与意匠一致。
// 自由行:意匠画满色,玩家须结满、只许留少量空结作间丝;
//   每行空结超过 容许数(≈打间丝所需) 即算错位。
// ------------------------------------------------------------
export function compareWithDesign(
  spec: LoomSpec, design: Design, knots: Uint8Array, weftSeq: Uint16Array,
  mismatch: Uint8Array,
): { total: number; errors: number } {
  const W = spec.warps, P = spec.picks;
  const g = spec.ground;
  mismatch.fill(0);
  let total = 0, errors = 0;
  const tol = Math.ceil(W / spec.floatLimit) + 2; // 每行容许的间丝空结数
  for (let p = 0; p < P; p++) {
    const off = p * W;
    const targetWeft = spec.shuttles[design.weftSeq[p] % spec.shuttles.length];
    const actualWeft = spec.shuttles[weftSeq[p] % spec.shuttles.length];
    let freeZero = 0;
    for (let w = 0; w < W; w++) {
      const i = off + w;
      if (design.free[i]) {
        if (design.knots[i] === 1 && knots[i] === 0) freeZero++;
        continue;
      }
      total++;
      const ground = groundLift(g, w, p);
      // 期望面色
      const tColor = design.knots[i] ? targetWeft : (ground ? 0 : spec.groundWeft);
      // 实际面色
      const aColor = knots[i] ? actualWeft : (ground ? 0 : spec.groundWeft);
      if (tColor !== aColor) { mismatch[i] = 1; errors++; }
    }
    if (freeZero > 0) {
      total += freeZero;
      const excess = freeZero - tol;
      if (excess > 0) {
        errors += excess;
        for (let w = 0; w < W; w++) {
          const i = off + w;
          if (design.free[i] && design.knots[i] === 1 && knots[i] === 0) mismatch[i] = 1;
        }
      }
    }
  }
  return { total, errors };
}

// ------------------------------------------------------------
// 耳子线计数:内容相同(或左右镜像相同)的花本行算同一根耳子线
// ------------------------------------------------------------
function fnv1a(buf: Uint8Array, start: number, len: number, reverse: boolean): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < len; k++) {
    const v = buf[start + (reverse ? len - 1 - k : k)];
    h ^= v;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function countEarThreads(knots: Uint8Array, W: number, P: number): number {
  const seen = new Set<number>();
  for (let p = 0; p < P; p++) {
    const off = p * W;
    const h1 = fnv1a(knots, off, W, false);
    const h2 = fnv1a(knots, off, W, true);
    seen.add(Math.min(h1, h2)); // 镜像同根耳子线:正反向哈希取小者
  }
  return seen.size;
}

// ------------------------------------------------------------
// 间丝:把过长的连续显花段打断(在理想花本上开间丝点)
// 对每行扫描连续 1,长度超过 limit 时,每隔 limit 个开一个 0
// skipFree: free=1 的区域不动(留给玩家处理)
// ------------------------------------------------------------
export function insertTieDowns(knots: Uint8Array, free: Uint8Array, W: number, P: number, limit: number): void {
  for (let p = 0; p < P; p++) {
    const off = p * W;
    let run = 0;
    for (let w = 0; w <= W; w++) {
      const isOne = w < W && knots[off + w] === 1 && free[off + w] === 0;
      if (isOne) {
        run++;
        if (run > limit) { knots[off + w] = 0; run = 0; }
      } else {
        run = 0;
      }
    }
  }
}

// ------------------------------------------------------------
// 调色板工具
// ------------------------------------------------------------
export function hexToU32(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0xff << 24 | b << 16 | g << 8 | r) >>> 0; // ABGR for little-endian canvas
}

export function paletteU32(palette: string[]): Uint32Array {
  const u = new Uint32Array(palette.length);
  for (let i = 0; i < palette.length; i++) u[i] = hexToU32(palette[i]);
  return u;
}
