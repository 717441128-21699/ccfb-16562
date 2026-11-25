// ============================================================
// 会话状态:各关花本进度、织造结果、星级存档
// ============================================================
import { LevelDef } from './weave.js';
import { buildLevels } from './levels.js';

export interface Work {
  level: LevelDef;
  knots: Uint8Array;        // 玩家花本 W*P
  weftSeq: Uint16Array;     // 玩家配梭
  face: Uint8Array | null;  // 织出的布面(色板索引)
  wovenPicks: number;       // 已织纬数
  floats: Uint8Array | null;
  floatSegments: number;
  mismatch: Uint8Array | null;
  errors: number;
  matchTotal: number;
  earThreads: number;
  currentPick: number;      // 编辑器当前纬
}

export const LEVELS: LevelDef[] = buildLevels();
const works = new Map<string, Work>();

const SAVE_LIMIT = 600_000; // 超过此格数不写入 localStorage

function saveKey(id: string): string { return `jin.save.${id}`; }
const STAR_KEY = 'jin.stars';

export function getWork(levelId: string): Work {
  let w = works.get(levelId);
  if (w) return w;
  const level = LEVELS.find(l => l.id === levelId);
  if (!level) throw new Error('no level ' + levelId);
  const { warps: W, picks: P } = level.spec;
  w = {
    level,
    knots: new Uint8Array(W * P),
    weftSeq: new Uint16Array(P),
    face: null, wovenPicks: 0,
    floats: null, floatSegments: 0,
    mismatch: null, errors: 0, matchTotal: 1,
    earThreads: 1,
    currentPick: 0,
  };
  // 默认配梭:不可换梭的关卡直接照意匠图;可换梭的关卡全部 0 号梭
  if (!level.spec.shuttleEditable) w.weftSeq.set(level.design.weftSeq);
  loadWork(w);
  works.set(levelId, w);
  return w;
}

// ------------------------------------------------------------
// 存档
// ------------------------------------------------------------
function u8ToB64(a: Uint8Array): string {
  let s = '';
  for (let i = 0; i < a.length; i += 8192)
    s += String.fromCharCode(...a.subarray(i, i + 8192));
  return btoa(s);
}
function b64ToU8(s: string, n: number): Uint8Array | null {
  try {
    const bin = atob(s);
    if (bin.length !== n) return null;
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return a;
  } catch { return null; }
}
function u16ToB64(a: Uint16Array): string { return u8ToB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
function b64ToU16(s: string, n: number): Uint16Array | null {
  const u = b64ToU8(s, n * 2);
  if (!u) return null;
  return new Uint16Array(u.buffer, 0, n);
}

export function saveWork(w: Work): void {
  const { warps: W, picks: P } = w.level.spec;
  if (W * P > SAVE_LIMIT) return;
  try {
    localStorage.setItem(saveKey(w.level.id), JSON.stringify({
      knots: u8ToB64(w.knots),
      weft: u16ToB64(w.weftSeq),
    }));
  } catch { /* 存不下就算了 */ }
}

function loadWork(w: Work): void {
  const { warps: W, picks: P } = w.level.spec;
  if (W * P > SAVE_LIMIT) return;
  try {
    const raw = localStorage.getItem(saveKey(w.level.id));
    if (!raw) return;
    const d = JSON.parse(raw);
    const k = b64ToU8(d.knots, W * P);
    const s = b64ToU16(d.weft, P);
    if (k) w.knots.set(k);
    if (s && w.level.spec.shuttleEditable) w.weftSeq.set(s);
  } catch { /* 存档损坏则忽略 */ }
}

// ------------------------------------------------------------
// 星级
// ------------------------------------------------------------
export function getStars(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STAR_KEY) || '{}'); }
  catch { return {}; }
}
export function setStars(levelId: string, stars: number): void {
  const s = getStars();
  if ((s[levelId] || 0) >= stars) return;
  s[levelId] = stars;
  try { localStorage.setItem(STAR_KEY, JSON.stringify(s)); } catch { /* */ }
}
