"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/weave.ts
  function groundLift(g, w, p) {
    if (g === "plain") return w + p & 1;
    if (g === "twill21") return ((w + 2 * p) % 3 + 3) % 3 !== 2 ? 1 : 0;
    return (w + p & 3) !== 3 ? 1 : 0;
  }
  function weavePick(spec, knots, weftSeq, p, face) {
    const W = spec.warps;
    const off = p * W;
    const weftColor = spec.shuttles[weftSeq[p] % spec.shuttles.length];
    const g = spec.ground;
    const gw = spec.groundWeft;
    for (let w = 0; w < W; w++) {
      if (knots[off + w]) face[off + w] = weftColor;
      else face[off + w] = groundLift(g, w, p) ? 0 : gw;
    }
  }
  function weaveAll(spec, knots, weftSeq, face) {
    for (let p = 0; p < spec.picks; p++) weavePick(spec, knots, weftSeq, p, face);
  }
  function detectFloats(spec, knots, out) {
    const W = spec.warps, P2 = spec.picks, L = spec.floatLimit;
    out.fill(0);
    let segments = 0;
    for (let p = 0; p < P2; p++) {
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
  function compareWithDesign(spec, design, knots, weftSeq, mismatch) {
    const W = spec.warps, P2 = spec.picks;
    const g = spec.ground;
    mismatch.fill(0);
    let total = 0, errors = 0;
    const tol = Math.ceil(W / spec.floatLimit) + 2;
    for (let p = 0; p < P2; p++) {
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
        const tColor = design.knots[i] ? targetWeft : ground ? 0 : spec.groundWeft;
        const aColor = knots[i] ? actualWeft : ground ? 0 : spec.groundWeft;
        if (tColor !== aColor) {
          mismatch[i] = 1;
          errors++;
        }
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
  function fnv1a(buf, start, len, reverse) {
    let h = 2166136261;
    for (let k = 0; k < len; k++) {
      const v = buf[start + (reverse ? len - 1 - k : k)];
      h ^= v;
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function countEarThreads(knots, W, P2) {
    const seen = /* @__PURE__ */ new Set();
    for (let p = 0; p < P2; p++) {
      const off = p * W;
      const h1 = fnv1a(knots, off, W, false);
      const h2 = fnv1a(knots, off, W, true);
      seen.add(Math.min(h1, h2));
    }
    return seen.size;
  }
  function insertTieDowns(knots, free, W, P2, limit) {
    for (let p = 0; p < P2; p++) {
      const off = p * W;
      let run = 0;
      for (let w = 0; w <= W; w++) {
        const isOne = w < W && knots[off + w] === 1 && free[off + w] === 0;
        if (isOne) {
          run++;
          if (run > limit) {
            knots[off + w] = 0;
            run = 0;
          }
        } else {
          run = 0;
        }
      }
    }
  }
  function hexToU32(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (255 << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  function paletteU32(palette) {
    const u = new Uint32Array(palette.length);
    for (let i = 0; i < palette.length; i++) u[i] = hexToU32(palette[i]);
    return u;
  }
  var GROUND_NAMES;
  var init_weave = __esm({
    "src/weave.ts"() {
      "use strict";
      GROUND_NAMES = {
        plain: "\u5E73\u7EB9",
        twill21: "\u4E8C\u4E00\u4E0B\u659C\u7EB9",
        twill31: "\u4E09\u4E00\u4E0B\u659C\u7EB9"
      };
    }
  });

  // src/levels.ts
  function makeLevel(id, name, subtitle, ground, floatLimit, palette, shuttles, shuttleEditable, W, H, gen, tips) {
    const g = gen();
    const free = new Uint8Array(W * H);
    if (g.freeRows) for (const y of g.freeRows) {
      if (y >= 0 && y < H) free.fill(1, y * W, y * W + W);
    }
    insertTieDowns(g.knots, free, W, H, floatLimit);
    const spec = {
      warps: W,
      picks: H,
      ground,
      floatLimit,
      palette,
      groundWeft: 1,
      shuttles,
      shuttleEditable
    };
    const design = { knots: g.knots, free, weftSeq: g.weftSeq };
    const par = countEarThreads(g.knots, W, H);
    return { id, name, subtitle, spec, design, par, tips };
  }
  function genLingGe(W, H) {
    const p = new P(new Uint8Array(W * H), W, H);
    const S = 24;
    for (let k = -H; k < W + H; k += S) {
      p.line(k, 0, k + H, H);
      p.line(k, 0, k - H, H);
    }
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
  function genWanZi(W, H) {
    const T = 12;
    const p = new P(new Uint8Array(T * T), T, T);
    p.fillRect(5, 0, 6, 5);
    p.fillRect(5, 0, 10, 1);
    p.fillRect(6, 5, 11, 6);
    p.fillRect(10, 5, 11, 10);
    p.fillRect(5, 6, 6, 11);
    p.fillRect(1, 10, 6, 11);
    p.fillRect(0, 5, 5, 6);
    p.fillRect(0, 1, 1, 6);
    const q = new P(new Uint8Array(W * H), W, H);
    q.tile(p.a, T, T, false);
    return { knots: q.a, weftSeq: seq(H, () => 0) };
  }
  function genXiangYun(W, H) {
    const p = new P(new Uint8Array(W * H), W, H);
    const half = W >> 1;
    const cloud = (cx, cy, s) => {
      p.spiral(cx, cy, 1.5, 9 * s, 2.2, 3);
      p.spiral(cx + 16 * s, cy - 4 * s, 1, 5.5 * s, 1.8, 2.5);
      let x = cx + 20 * s, y = cy + 2 * s;
      for (let i = 0; i < 26 * s; i++) {
        p.disc(x, y, 1.6);
        x += 1.6;
        y += Math.sin(i / 5) * 1.2;
      }
    };
    cloud(half * 0.45, H * 0.3, 1);
    cloud(half * 0.6, H * 0.62, 1.25);
    cloud(half * 0.35, H * 0.82, 0.8);
    for (let x = 8; x < half - 8; x += 4) {
      const y = H * 0.52 + Math.sin(x / 14) * 3;
      p.disc(x, y, 1.4);
    }
    p.mirrorH();
    const weftSeq = seq(H, (y) => y > H * 0.45 && y < H * 0.6 ? 1 : 0);
    return { knots: p.a, weftSeq };
  }
  function genChanZhiLian(W, H) {
    const p = new P(new Uint8Array(W * H), W, H);
    const half = W >> 1;
    const bloomRows = new Array(H).fill(false);
    for (const [baseY, amp, per, phase] of [[H * 0.3, 16, 96, 0], [H * 0.7, 18, 110, 2]]) {
      let px = 0, py = baseY;
      for (let x = 0; x < half; x += 1) {
        const y = baseY + amp * Math.sin(2 * Math.PI * x / per + phase);
        p.thickLine(px, py, x, y, 2.5);
        px = x;
        py = y;
        if (x % 18 === 9) {
          const dir = Math.cos(2 * Math.PI * x / per + phase) > 0 ? -1 : 1;
          p.ellipse(x, y + dir * 7, 3, 6);
        }
      }
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
    const weftSeq = seq(H, (y) => bloomRows[y] ? 1 : 0);
    return { knots: p.a, weftSeq };
  }
  function genTuanHua(W, H) {
    const p = new P(new Uint8Array(W * H), W, H);
    const cx = W / 2, cy = H / 2;
    p.disc(cx, cy, 6);
    p.circle(cx, cy, 10);
    for (const [R, pr, n] of [[22, 7, 8], [44, 9, 8], [70, 6, 16]]) {
      for (let k = 0; k < n; k++) {
        const th = 2 * Math.PI * k / n + (n === 16 ? Math.PI / 16 : 0);
        p.ellipse(cx + R * Math.cos(th), cy + R * Math.sin(th), pr, pr * 0.62);
      }
    }
    for (let k = 0; k < 32; k++) {
      const th = 2 * Math.PI * k / 32;
      p.disc(cx + 88 * Math.cos(th), cy + 88 * Math.sin(th), 1.8);
    }
    p.circle(cx, cy, 96);
    p.circle(cx, cy, 100);
    for (const [ax, ay] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]]) {
      p.disc(ax, ay, 5);
      for (let k = 0; k < 8; k++) {
        const th = 2 * Math.PI * k / 8;
        p.disc(ax + 11 * Math.cos(th), ay + 11 * Math.sin(th), 2.5);
      }
    }
    const weftSeq = seq(H, (y) => {
      const d = Math.abs(y - cy);
      return d >= 30 && d < 75 ? 1 : 0;
    });
    return { knots: p.a, weftSeq };
  }
  function genBaDaYun(W, H) {
    const p = new P(new Uint8Array(W * H), W, H);
    const oct = (cx2, cy2, r, thick) => {
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const th = Math.PI / 8 + Math.PI / 4 * k;
        pts.push([cx2 + r * Math.cos(th), cy2 + r * Math.sin(th)]);
      }
      p.polygon(pts, 1, thick);
    };
    const cx = W / 2, cy = H / 2;
    for (const r of [26, 44, 62, 80]) oct(cx, cy, r, 2);
    p.disc(cx, cy, 8);
    for (let k = 0; k < 8; k++) {
      const th = Math.PI / 4 * k;
      p.thickLine(
        cx + 84 * Math.cos(th),
        cy + 84 * Math.sin(th),
        cx + 190 * Math.cos(th),
        cy + 190 * Math.sin(th),
        2
      );
    }
    for (const [qx, qy] of [[0, 0], [W, 0], [0, H], [W, H]])
      for (const r of [30, 52, 74]) oct(qx, qy, r, 2);
    for (const [qx, qy] of [[cx, 0], [cx, H], [0, cy], [W, cy]])
      for (const r of [24, 42]) oct(qx, qy, r, 2);
    const freeRows = [];
    for (const y0 of [H * 0.25 | 0, H * 0.75 | 0]) {
      for (let y = y0 - 2; y <= y0 + 2; y++) {
        p.fillRect(0, y, W - 1, y);
        freeRows.push(y);
      }
    }
    const weftSeq = seq(H, (y) => (y / (H / 8) | 0) % 4);
    return { knots: p.a, weftSeq, freeRows };
  }
  function genYunLong(W, H) {
    const T = 250;
    const t = new P(new Uint8Array(T * T), T, T);
    const bodyY = (x) => T / 2 + 62 * Math.sin(2 * Math.PI * x / T);
    for (let x = 0; x < T; x++) {
      const y = bodyY(x);
      t.disc(x, y, 6.5);
      if (x % 12 === 0) {
        const d = Math.cos(2 * Math.PI * x / T) > 0 ? 1 : -1;
        t.thickLine(x, y, x + 4, y + d * 14, 2);
      }
    }
    const hx = T * 0.22, hy = bodyY(T * 0.22);
    t.disc(hx, hy - 4, 11);
    t.thickLine(hx + 4, hy - 12, hx + 14, hy - 24, 2.5);
    t.thickLine(hx - 2, hy - 13, hx - 10, hy - 26, 2.5);
    t.disc(hx + 12, hy + 2, 4);
    const px = T * 0.4, py = bodyY(T * 0.4) - 34;
    t.disc(px, py, 7);
    t.thickLine(px - 4, py - 7, px - 8, py - 16, 2);
    t.thickLine(px, py - 8, px, py - 19, 2);
    t.thickLine(px + 4, py - 7, px + 8, py - 16, 2);
    for (const fx of [T * 0.32, T * 0.55, T * 0.72, T * 0.9]) {
      const fy = bodyY(fx);
      const dir = Math.cos(2 * Math.PI * fx / T) > 0 ? 1 : -1;
      t.thickLine(fx, fy, fx + 6, fy + dir * 16, 3);
      t.disc(fx + 8, fy + dir * 18, 2.5);
      t.disc(fx + 4, fy + dir * 20, 2);
    }
    t.spiral(T * 0.12, T * 0.22, 1.5, 8, 2, 2.5);
    t.spiral(T * 0.62, T * 0.8, 1.5, 9, 2.2, 2.5);
    t.spiral(T * 0.85, T * 0.3, 1, 6, 1.8, 2);
    t.spiral(T * 0.38, T * 0.85, 1, 5, 1.6, 2);
    for (let y = 10; y < T; y += 26)
      for (let x = y % 52 === 10 ? 8 : 21; x < T; x += 26)
        t.set(x, y);
    const q = new P(new Uint8Array(W * H), W, H);
    q.tile(t.a, T, T, true);
    const freeRows = [];
    for (const y0 of [250, 500, 750]) {
      q.fillRect(0, y0 - 1, W - 1, y0);
      freeRows.push(y0 - 1, y0);
    }
    const weftSeq = seq(H, (y) => (y / 250 | 0) % 4);
    return { knots: q.a, weftSeq, freeRows };
  }
  function buildLevels() {
    return [
      makeLevel(
        "lv1",
        "\u83F1\u683C\u6735\u6885",
        "\u5165\u95E8\xB7\u8BC6\u82B1\u672C",
        "plain",
        5,
        ["#e8dcc0", "#d9c9a6", "#2c4a8c"],
        [2],
        false,
        96,
        96,
        () => genLingGe(96, 96),
        [
          "\u610F\u5320\u56FE\u4E0A\u7684\u84DD\u70B9\u5C31\u662F\u8981\u7ED3\u8033\u5B50\u7EBF\u7684\u4F4D\u7F6E,\u4E00\u683C\u4E00\u7ED3\u3002",
          "\u82B1\u672C\u4E0A\u4E00\u7ED3,\u7EC7\u51FA\u6765\u90A3\u4E00\u683C\u5F69\u7EAC\u5C31\u6D6E\u5230\u9762\u4E0A\u663E\u82B1\u3002",
          "\u83F1\u683C\u659C\u7EBF\u4E0A\u4E0B\u5DE6\u53F3\u7686\u5FAA\u73AF,\u5584\u7528\u300C\u5DE6\u53F3\u5FAA\u73AF\u300D\u300C\u4E0A\u4E0B\u5FAA\u73AF\u300D\u53EF\u5C11\u6311\u8BB8\u591A\u3002",
          "\u8FDE\u7EED\u7ED3\u5B50\u8D85\u8FC7 5 \u683C\u5F69\u7EAC\u6D6E\u592A\u957F\u4F1A\u52FE\u4E1D\u2014\u2014\u610F\u5320\u56FE\u4E0A\u5DF2\u5F00\u597D\u95F4\u4E1D\u70B9,\u7167\u70B9\u5373\u53EF\u3002"
        ]
      ),
      makeLevel(
        "lv2",
        "\u4E07\u5B57\u4E0D\u5230\u5934",
        "\u51E0\u4F55\xB7\u5FAA\u73AF\u4E4B\u7F8E",
        "plain",
        5,
        ["#7a1f1f", "#661919", "#d4a017"],
        [2],
        false,
        132,
        132,
        () => genWanZi(132, 132),
        [
          "\u534D\u5B57\u5341\u4E8C\u683C\u4E00\u5FAA\u73AF,\u662F\u5929\u7136\u7684\u300C\u4E00\u82B1\u672C\u591A\u7528\u300D\u3002",
          "\u5148\u6311\u597D\u4E00\u4E2A\u534D\u5B57,\u518D\u7528\u300C\u5DE6\u53F3\u5FAA\u73AF\u300D\u94FA\u6EE1\u5168\u884C,\u300C\u4E0A\u4E0B\u5FAA\u73AF\u300D\u94FA\u6EE1\u5168\u5E45\u3002",
          "\u6311\u5B8C\u770B\u770B\u8033\u5B50\u7EBF\u6570:\u5FAA\u73AF\u8D8A\u6574,\u7EBF\u6570\u8D8A\u7701\u3002"
        ]
      ),
      makeLevel(
        "lv3",
        "\u7965\u4E91\u732E\u745E",
        "\u66F2\u7EBF\xB7\u6362\u8272\u7EAC",
        "twill21",
        6,
        ["#7fa8c9", "#6b92b2", "#f0ead8", "#2f4b7c"],
        [2, 3],
        false,
        192,
        144,
        () => genXiangYun(192, 144),
        [
          "\u5730\u7EC4\u7EC7\u6362\u6210\u659C\u7EB9,\u5730\u5B50\u7EB9\u7406\u4E0E\u5E73\u7EB9\u4E0D\u540C,\u4F46\u82B1\u672C\u7684\u7ED3\u6CD5\u4E0D\u53D8\u3002",
          "\u6B64\u5E45\u5DE6\u53F3\u5BF9\u79F0:\u6311\u5DE6\u534A\u5E45,\u7528\u300C\u955C\u50CF\u7B14\u300D\u6216\u6574\u884C\u955C\u50CF\u590D\u7528,\u53EF\u7701\u4E00\u534A\u529F\u592B\u3002",
          "\u4E91\u5E26\u5904\u6362\u4E86\u94F6\u68AD,\u610F\u5320\u56FE\u4E0A\u989C\u8272\u4E0D\u540C\u7684\u7EAC,\u7EC7\u51FA\u6765\u4E91\u8272\u4E5F\u4E0D\u540C\u3002"
        ]
      ),
      makeLevel(
        "lv4",
        "\u7F20\u679D\u83B2",
        "\u957F\u5377\xB7\u85E4\u8513\u8FDE\u7EF5",
        "twill21",
        4,
        ["#2e4a3a", "#26402f", "#c9a227", "#c25e7a"],
        [2, 3],
        false,
        256,
        192,
        () => genChanZhiLian(256, 192),
        [
          "\u7EAC\u6D6E\u4E0A\u9650\u53EA\u6709 4,\u85E4\u8513\u957F\u6761\u5904\u7684\u95F4\u4E1D\u70B9\u4E00\u5904\u90FD\u4E0D\u80FD\u6F0F\u3002",
          "\u83B2\u82B1\u5F00\u5728\u7EA2\u7EAC\u884C,\u91D1\u7EAC\u884C\u662F\u85E4\u8513\u2014\u2014\u6362\u68AD\u4E4B\u5904\u610F\u5320\u56FE\u5DF2\u6807\u597D\u3002",
          "\u7F20\u679D\u5DE6\u53F3\u5BF9\u79F0,\u955C\u50CF\u590D\u7528\u80FD\u7701\u8FD1\u534A\u8033\u5B50\u7EBF\u3002"
        ]
      ),
      makeLevel(
        "lv5",
        "\u5B9D\u76F8\u56E2\u82B1",
        "\u653E\u5C04\xB7\u516B\u9762\u73B2\u73D1",
        "twill31",
        5,
        ["#1f3a6e", "#1a3159", "#d4a017", "#b03a2e"],
        [2, 3],
        false,
        256,
        256,
        () => genTuanHua(256, 256),
        [
          "\u56E2\u82B1\u516B\u51FA\u653E\u5C04,\u4E0A\u4E0B\u5DE6\u53F3\u7686\u5BF9\u79F0,\u5FAA\u73AF\u884C\u6781\u591A\u3002",
          "\u4E24\u8272\u7EAC\u5206\u533A:\u5916\u73AF\u4E0E\u5185\u5FC3\u91D1\u3001\u4E2D\u73AF\u7EA2,\u610F\u5320\u56FE\u5206\u8272\u5373\u68AD\u8272\u3002",
          "\u8033\u5B50\u7EBF\u57FA\u51C6\u6570\u5F88\u4F4E\u2014\u2014\u770B\u51FA\u54EA\u4E9B\u7EAC\u5B8C\u5168\u76F8\u540C,\u5C31\u662F\u7701\u7EBF\u7684\u5173\u952E\u3002"
        ]
      ),
      makeLevel(
        "lv6",
        "\u516B\u8FBE\u6655\u9526",
        "\u6362\u68AD\xB7\u81EA\u6253\u95F4\u4E1D",
        "twill31",
        6,
        ["#4a2c5a", "#3d2449", "#d4a017", "#b03a2e", "#3a7a8c", "#e8e0d0"],
        [2, 3, 4, 5],
        true,
        384,
        384,
        () => genBaDaYun(384, 384),
        [
          "\u6B64\u5173\u53EF\u6362\u68AD:\u5DE6\u4FA7\u68AD\u9053\u6761\u6309\u610F\u5320\u56FE\u914D\u8272,\u62D6\u8FC7\u4E00\u6BB5\u7EAC\u5373\u6574\u6BB5\u6362\u68AD\u3002",
          "\u4E24\u6761\u6A2A\u5411\u5F69\u5E26\u662F\u300C\u81EA\u7531\u884C\u300D:\u610F\u5320\u56FE\u53EA\u753B\u6EE1\u8272,\u95F4\u4E1D\u70B9\u8981\u4F60\u81EA\u5DF1\u5F00\u3002",
          "\u5728\u81EA\u7531\u884C\u4E0A\u6BCF\u9694\u81F3\u591A 6 \u683C\u7559\u4E00\u4E2A\u7A7A\u7ED3,\u5F69\u5E26\u624D\u4E0D\u4F1A\u52FE\u4E1D\u3002"
        ]
      ),
      makeLevel(
        "lv7",
        "\u5986\u82B1\u4E91\u9F99\u5927\u7F0E",
        "\u5927\u82B1\u697C\xB7\u4E24\u5343\u7ECF",
        "twill21",
        7,
        ["#caa64b", "#b8963f", "#e0c060", "#b03a2e", "#2e5aa8", "#3a7a4a"],
        [2, 3, 4, 5],
        true,
        2e3,
        1e3,
        () => genYunLong(2e3, 1e3),
        [
          "\u4E24\u5343\u7ECF\u3001\u4E00\u5343\u7EAC\u7684\u5927\u82B1\u697C:\u4E00\u82B1\u672C 250 \u7ECF\u4E00\u5FAA\u73AF,\u516B\u82B1\u56DB\u8272\u3002",
          "\u52A1\u5FC5\u5148\u7528\u300C\u5DE6\u53F3\u5FAA\u73AF\u300D\u94FA\u884C\u3001\u300C\u4E0A\u4E0B\u5FAA\u73AF\u300D\u94FA\u5E45,\u5426\u5219\u6311\u5230\u7334\u5E74\u9A6C\u6708\u3002",
          "\u56DB\u628A\u68AD\u5B50\u6309 250 \u7EAC\u4E00\u6362;\u91D1\u7EBF\u754C\u680F\u662F\u81EA\u7531\u884C,\u95F4\u4E1D\u81EA\u5DF1\u5F00\u3002",
          "\u9694\u5757\u7FFB\u8F6C\u7684\u82B1\u672C\u5DE6\u53F3\u955C\u50CF\u76F8\u540C,\u955C\u50CF\u884C\u4E0E\u6B63\u884C\u7B97\u540C\u4E00\u6839\u8033\u5B50\u7EBF\u3002"
        ]
      )
    ];
  }
  var P, seq;
  var init_levels = __esm({
    "src/levels.ts"() {
      "use strict";
      init_weave();
      P = class {
        constructor(a, W, H) {
          this.a = a;
          this.W = W;
          this.H = H;
        }
        set(x, y, v = 1) {
          x |= 0;
          y |= 0;
          if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.a[y * this.W + x] = v;
        }
        get(x, y) {
          if (x < 0 || x >= this.W || y < 0 || y >= this.H) return 0;
          return this.a[(y | 0) * this.W + (x | 0)];
        }
        line(x0, y0, x1, y1, v = 1) {
          x0 |= 0;
          y0 |= 0;
          x1 |= 0;
          y1 |= 0;
          const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
          const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
          let err = dx - dy;
          for (; ; ) {
            this.set(x0, y0, v);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
              err -= dy;
              x0 += sx;
            }
            if (e2 < dx) {
              err += dx;
              y0 += sy;
            }
          }
        }
        thickLine(x0, y0, x1, y1, t, v = 1) {
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
          for (let i = 0; i <= steps; i++) {
            const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
            this.disc(x, y, t / 2, v);
          }
        }
        fillRect(x0, y0, x1, y1, v = 1) {
          for (let y = Math.max(0, y0 | 0); y <= Math.min(this.H - 1, y1 | 0); y++)
            for (let x = Math.max(0, x0 | 0); x <= Math.min(this.W - 1, x1 | 0); x++)
              this.a[y * this.W + x] = v;
        }
        circle(cx, cy, r, v = 1) {
          let x = r | 0, y = 0, err = 1 - x;
          while (x >= y) {
            for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]])
              this.set(cx + px, cy + py, v);
            y++;
            if (err < 0) err += 2 * y + 1;
            else {
              x--;
              err += 2 * (y - x) + 1;
            }
          }
        }
        disc(cx, cy, r, v = 1) {
          const r2 = r * r;
          for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
              if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) this.set(x, y, v);
        }
        ellipse(cx, cy, rx, ry, v = 1) {
          for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
              const dx = (x - cx) / rx, dy = (y - cy) / ry;
              if (dx * dx + dy * dy <= 1) this.set(x, y, v);
            }
        }
        /** 螺旋(云头):从 r0 旋到 r1 */
        spiral(cx, cy, r0, r1, turns, thick, v = 1) {
          const steps = Math.ceil(turns * 64);
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const th = t * turns * 2 * Math.PI;
            const r = r0 + (r1 - r0) * t;
            this.disc(cx + r * Math.cos(th), cy + r * Math.sin(th), thick / 2, v);
          }
        }
        polygon(pts, v = 1, thick = 1) {
          for (let i = 0; i < pts.length; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
            if (thick <= 1) this.line(x0, y0, x1, y1, v);
            else this.thickLine(x0, y0, x1, y1, thick, v);
          }
        }
        /** 左半镜像到右半(以垂直中轴) */
        mirrorH() {
          const { a, W, H } = this;
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W >> 1; x++)
              a[y * W + (W - 1 - x)] = a[y * W + x];
        }
        /** 把 src 中 pw×ph 的底子平铺整个画面;alt=true 时隔块左右翻转 */
        tile(src, pw, ph, alt = false) {
          const { a, W, H } = this;
          for (let ty = 0; ty * ph < H; ty++)
            for (let tx = 0; tx * pw < W; tx++) {
              const flip = alt && (tx + ty & 1) === 1;
              for (let y = 0; y < ph && ty * ph + y < H; y++)
                for (let x = 0; x < pw && tx * pw + x < W; x++) {
                  const sx = flip ? pw - 1 - x : x;
                  a[(ty * ph + y) * W + (tx * pw + x)] = src[y * pw + sx];
                }
            }
        }
      };
      seq = (H, fn) => {
        const s = new Uint16Array(H);
        for (let p = 0; p < H; p++) s[p] = fn(p);
        return s;
      };
    }
  });

  // src/state.ts
  function saveKey(id) {
    return `jin.save.${id}`;
  }
  function getWork(levelId) {
    let w = works.get(levelId);
    if (w) return w;
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) throw new Error("no level " + levelId);
    const { warps: W, picks: P2 } = level.spec;
    w = {
      level,
      knots: new Uint8Array(W * P2),
      weftSeq: new Uint16Array(P2),
      face: null,
      wovenPicks: 0,
      floats: null,
      floatSegments: 0,
      mismatch: null,
      errors: 0,
      matchTotal: 1,
      earThreads: 1,
      currentPick: 0
    };
    if (!level.spec.shuttleEditable) w.weftSeq.set(level.design.weftSeq);
    loadWork(w);
    works.set(levelId, w);
    return w;
  }
  function u8ToB64(a) {
    let s = "";
    for (let i = 0; i < a.length; i += 8192)
      s += String.fromCharCode(...a.subarray(i, i + 8192));
    return btoa(s);
  }
  function b64ToU8(s, n) {
    try {
      const bin = atob(s);
      if (bin.length !== n) return null;
      const a = new Uint8Array(n);
      for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
      return a;
    } catch {
      return null;
    }
  }
  function u16ToB64(a) {
    return u8ToB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  }
  function b64ToU16(s, n) {
    const u = b64ToU8(s, n * 2);
    if (!u) return null;
    return new Uint16Array(u.buffer, 0, n);
  }
  function saveWork(w) {
    const { warps: W, picks: P2 } = w.level.spec;
    if (W * P2 > SAVE_LIMIT) return;
    try {
      localStorage.setItem(saveKey(w.level.id), JSON.stringify({
        knots: u8ToB64(w.knots),
        weft: u16ToB64(w.weftSeq)
      }));
    } catch {
    }
  }
  function loadWork(w) {
    const { warps: W, picks: P2 } = w.level.spec;
    if (W * P2 > SAVE_LIMIT) return;
    try {
      const raw = localStorage.getItem(saveKey(w.level.id));
      if (!raw) return;
      const d = JSON.parse(raw);
      const k = b64ToU8(d.knots, W * P2);
      const s = b64ToU16(d.weft, P2);
      if (k) w.knots.set(k);
      if (s && w.level.spec.shuttleEditable) w.weftSeq.set(s);
    } catch {
    }
  }
  function getStars() {
    try {
      return JSON.parse(localStorage.getItem(STAR_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function setStars(levelId, stars) {
    const s = getStars();
    if ((s[levelId] || 0) >= stars) return;
    s[levelId] = stars;
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify(s));
    } catch {
    }
  }
  var LEVELS, works, SAVE_LIMIT, STAR_KEY;
  var init_state = __esm({
    "src/state.ts"() {
      "use strict";
      init_levels();
      LEVELS = buildLevels();
      works = /* @__PURE__ */ new Map();
      SAVE_LIMIT = 6e5;
      STAR_KEY = "jin.stars";
    }
  });

  // src/render.ts
  function makeFaceCanvas(spec) {
    const canvas = document.createElement("canvas");
    canvas.width = spec.warps;
    canvas.height = spec.picks;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(spec.warps, spec.picks);
    const u32 = new Uint32Array(img.data.buffer);
    return { canvas, ctx, img, u32, pal: paletteU32(spec.palette) };
  }
  function writePickPixels(fc, face, W, p) {
    const off = p * W;
    const { u32, pal } = fc;
    for (let w = 0; w < W; w++) u32[off + w] = pal[face[off + w]];
  }
  function flushPicks(fc, p0, count) {
    fc.ctx.putImageData(fc.img, 0, 0, 0, p0, fc.canvas.width, count);
  }
  function flushAll(fc) {
    fc.ctx.putImageData(fc.img, 0, 0);
  }
  function fillFace(fc, face) {
    const { u32, pal } = fc;
    for (let i = 0; i < face.length; i++) u32[i] = pal[face[i]];
  }
  var init_render = __esm({
    "src/render.ts"() {
      "use strict";
      init_weave();
    }
  });

  // src/levelsPage.ts
  function mountLevels(root) {
    const stars = getStars();
    root.innerHTML = `
  <div class="page levels">
    <header class="hero">
      <h1>\u82B1\u697C\u7EC7\u9526</h1>
      <p>\u4F60\u662F\u82B1\u697C\u673A\u4E0A\u7684\u6311\u82B1\u5320\u3002\u628A\u610F\u5320\u56FE\u4E0A\u7684\u7EB9\u6837,\u4E00\u7EAC\u4E00\u7EAC\u6311\u6210\u82B1\u672C\u4E0A\u7684\u8033\u5B50\u7EBF\u2014\u2014
      \u7EC7\u673A\u7167\u82B1\u672C\u63D0\u7EFC,\u7EC7\u9519\u4E00\u6839,\u6574\u5E45\u82B1\u7EB9\u5C31\u9519\u4F4D\u3002</p>
    </header>
    <div class="cards" id="lvCards"></div>
    <footer class="dim foot">
      \u89C4\u5219:\u82B1\u672C\u7ED3\u5230\u4E4B\u5904,\u5F69\u7EAC\u6D6E\u4E8E\u9762\u4E0A\u663E\u82B1;\u672A\u7ED3\u5904\u7531\u5730\u7EFC\u7EC7\u51FA${GROUND_NAMES.plain}/${GROUND_NAMES.twill21}\u5730\u7EC4\u7EC7\u3002
      \u8FDE\u7EED\u7ED3\u5B50\u8FC7\u957F \u2192 \u7EAC\u6D6E\u52FE\u4E1D;\u540C\u6837\u7684\u7EAC(\u542B\u5DE6\u53F3\u955C\u50CF)\u53EA\u7B97\u4E00\u6839\u8033\u5B50\u7EBF\u3002
    </footer>
  </div>`;
    const box = root.querySelector("#lvCards");
    LEVELS.forEach((lv, idx) => {
      const { spec } = lv;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
      <canvas class="thumb" width="240" height="150"></canvas>
      <div class="card-body">
        <div class="card-name">${lv.name} <span class="stars-sm">${"\u2605".repeat(stars[lv.id] || 0)}</span></div>
        <div class="dim">${lv.subtitle}</div>
        <div class="dim spec">${spec.warps}\u7ECF \xD7 ${spec.picks}\u7EAC \xB7 ${GROUND_NAMES[spec.ground]} \xB7 \u7EAC\u6D6E\u2264${spec.floatLimit} \xB7 ${spec.shuttles.length}\u68AD${spec.shuttleEditable ? "(\u53EF\u6362)" : ""}</div>
        <div class="dim">\u8033\u5B50\u7EBF\u57FA\u51C6 ${lv.par}</div>
      </div>`;
      card.addEventListener("click", () => {
        location.hash = `#/edit/${lv.id}`;
      });
      box.appendChild(card);
      const thumb = card.querySelector("canvas");
      setTimeout(() => {
        const fc = makeFaceCanvas(spec);
        const face = new Uint8Array(spec.warps * spec.picks);
        weaveAll(spec, lv.design.knots, lv.design.weftSeq, face);
        fillFace(fc, face);
        flushAll(fc);
        const tctx = thumb.getContext("2d");
        tctx.imageSmoothingEnabled = false;
        tctx.fillStyle = "#100d09";
        tctx.fillRect(0, 0, thumb.width, thumb.height);
        const s = Math.min(thumb.width / spec.warps, thumb.height / spec.picks);
        tctx.drawImage(
          fc.canvas,
          (thumb.width - spec.warps * s) / 2,
          (thumb.height - spec.picks * s) / 2,
          spec.warps * s,
          spec.picks * s
        );
      }, idx * 30);
    });
    return () => {
    };
  }
  var init_levelsPage = __esm({
    "src/levelsPage.ts"() {
      "use strict";
      init_weave();
      init_state();
      init_render();
    }
  });

  // src/editor.ts
  function makeLayer(W, P2) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = P2;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, P2);
    return { canvas, ctx, img, u32: new Uint32Array(img.data.buffer) };
  }
  function mountEditor(root, levelId) {
    const work = getWork(levelId);
    const level = work.level;
    const { spec, design } = level;
    const W = spec.warps, P2 = spec.picks;
    const pal = paletteU32(spec.palette);
    root.innerHTML = `
  <div class="page ed">
    <header class="bar">
      <button class="btn" data-nav="#/levels">\u2039 \u9009\u5173</button>
      <div class="bar-title">
        <b>${level.name}</b><span class="dim">${level.subtitle} \xB7 ${W}\u7ECF \xD7 ${P2}\u7EAC \xB7 ${GROUND_NAMES[spec.ground]} \xB7 \u7EAC\u6D6E\u2264${spec.floatLimit}</span>
      </div>
      <label class="chk"><input type="checkbox" id="edOverlay" checked> \u610F\u5320\u56FE</label>
      <label class="chk"><input type="checkbox" id="edCheck" ${work.mismatch ? "" : "disabled"}> \u6821\u5BF9\u9519\u4F4D</label>
      <button class="btn primary" data-nav="#/loom/${level.id}">\u4E0A\u673A\u7EC7\u9020 \u203A</button>
    </header>
    <div class="ed-main">
      <aside class="ed-side">
        <div class="grp">
          <div class="grp-t">\u6311\u82B1</div>
          <div class="row">
            <button class="btn tool on" data-tool="knot">\u7ED3</button>
            <button class="btn tool" data-tool="erase">\u62C6</button>
            <label class="chk"><input type="checkbox" id="edMirror"> \u955C\u50CF\u7B14</label>
          </div>
          <div class="row">
            <button class="btn" id="edUndo">\u64A4\u9500</button>
            <button class="btn" id="edClearRow">\u6E05\u6B64\u7EAC</button>
          </div>
        </div>
        <div class="grp">
          <div class="grp-t">\u5F53\u524D\u7EAC <span id="edPick" class="mono"></span></div>
          <div class="row">
            <button class="btn" id="edPrev">\u25B2\u4E0A\u4E00\u7EAC</button>
            <button class="btn" id="edNext">\u25BC\u4E0B\u4E00\u7EAC</button>
          </div>
          <div class="row">
            <button class="btn" id="edCopyDown">\u590D\u5230\u4E0B\u4E00\u7EAC</button>
            <button class="btn" id="edMirrorDown">\u955C\u50CF\u590D\u5230\u4E0B\u4E00\u7EAC</button>
          </div>
        </div>
        <div class="grp">
          <div class="grp-t">\u5FAA\u73AF(\u7701\u8033\u5B50\u7EBF)</div>
          <div class="row"><span class="lbl">\u5DE6\u53F3\u5FAA\u73AF \u5468\u671F</span><input id="edTileN" type="number" value="24" min="1" class="num"><button class="btn" id="edTile">\u94FA\u6B64\u884C</button></div>
          <div class="row"><span class="lbl">\u4E0A\u4E0B\u5FAA\u73AF \u8D77</span><input id="edLoopFrom" type="number" value="0" min="0" class="num"><span class="lbl">\u6B65</span><input id="edLoopStep" type="number" value="12" min="1" class="num"><button class="btn" id="edLoop">\u94FA\u5168\u5E45</button></div>
        </div>
        <div class="grp" id="edShuttleGrp" hidden>
          <div class="grp-t">\u68AD\u9053(\u70B9\u53F3\u4FA7\u8272\u6761\u6362\u68AD)</div>
          <div class="row" id="edShuttles"></div>
        </div>
        <div class="grp">
          <div class="grp-t">\u82B1\u672C</div>
          <div class="stat">\u8033\u5B50\u7EBF <b id="edEar">\u2013</b> / \u57FA\u51C6 ${level.par}</div>
          <div class="stat">\u7EAC\u6D6E\u8D85\u6807 <b id="edFloat">\u2013</b> \u6BB5</div>
          <div class="stat dim" id="edHover"></div>
        </div>
        <div class="grp tips">
          <div class="grp-t">\u5320\u4EBA\u53E3\u8BC0</div>
          ${level.tips.map((t) => `<div class="tip">\xB7 ${t}</div>`).join("")}
        </div>
      </aside>
      <div class="ed-strip-wrap" id="edStripWrap" title="\u7EAC\u5411\u68AD\u8272:\u5DE6=\u610F\u5320 \u53F3=\u73B0\u884C">
        <canvas id="edStrip"></canvas>
      </div>
      <div class="ed-canvas-wrap" id="edWrap"><canvas id="edCanvas"></canvas></div>
    </div>
  </div>`;
    const wrap = root.querySelector("#edWrap");
    const canvas = root.querySelector("#edCanvas");
    const ctx = canvas.getContext("2d");
    const stripCanvas = root.querySelector("#edStrip");
    const stripWrap = root.querySelector("#edStripWrap");
    const sctx = stripCanvas.getContext("2d");
    const targetLayer = makeLayer(W, P2);
    const knotLayer = makeLayer(W, P2);
    const freeLayer = makeLayer(W, P2);
    const missLayer = makeLayer(W, P2);
    {
      const tFace = new Uint8Array(W * P2);
      weaveAll(spec, design.knots, design.weftSeq, tFace);
      for (let i = 0; i < W * P2; i++) targetLayer.u32[i] = pal[tFace[i]];
      targetLayer.ctx.putImageData(targetLayer.img, 0, 0);
    }
    {
      for (let i = 0; i < W * P2; i++) if (design.free[i]) freeLayer.u32[i] = FREE_COLOR;
      freeLayer.ctx.putImageData(freeLayer.img, 0, 0);
    }
    function refreshKnotRows(p0, p1) {
      for (let p = p0; p <= p1; p++) {
        const off = p * W;
        for (let w = 0; w < W; w++)
          knotLayer.u32[off + w] = work.knots[off + w] ? KNOT_COLOR : 0;
      }
      knotLayer.ctx.putImageData(knotLayer.img, 0, p0, 0, p0, W, p1 - p0 + 1);
    }
    function refreshMissLayer() {
      missLayer.u32.fill(0);
      if (work.mismatch) {
        for (let i = 0; i < W * P2; i++) if (work.mismatch[i]) missLayer.u32[i] = MISS_COLOR;
      }
      missLayer.ctx.putImageData(missLayer.img, 0, 0);
    }
    refreshKnotRows(0, P2 - 1);
    if (work.mismatch) refreshMissLayer();
    let z = 4, ox = 0, oy = 0;
    let cw = 0, ch = 0;
    function clampView() {
      z = Math.min(40, Math.max(0.2, z));
      ox = Math.min(W - 1, Math.max(-W * 0.2, ox));
      oy = Math.min(P2 - 1, Math.max(-P2 * 0.2, oy));
    }
    function fitView() {
      z = Math.max(0.2, Math.min(cw / W, ch / P2));
      ox = (W - cw / z) / 2;
      oy = (P2 - ch / z) / 2;
      clampView();
    }
    const overlayChk = root.querySelector("#edOverlay");
    const checkChk = root.querySelector("#edCheck");
    let hoverW = -1, hoverP = -1;
    function render() {
      if (cw === 0) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#17130e";
      ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(z, 0, 0, z, -ox * z, -oy * z);
      ctx.imageSmoothingEnabled = false;
      if (overlayChk.checked) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(targetLayer.canvas, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(freeLayer.canvas, 0, 0);
      ctx.drawImage(knotLayer.canvas, 0, 0);
      if (checkChk.checked && work.mismatch) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(missLayer.canvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      if (z >= 6) {
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1 / z;
        ctx.beginPath();
        const x0 = Math.max(0, ox | 0), x1 = Math.min(W, ox + cw / z + 1);
        const y0 = Math.max(0, oy | 0), y1 = Math.min(P2, oy + ch / z + 1);
        for (let x = x0; x <= x1; x++) {
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
        }
        for (let y = y0; y <= y1; y++) {
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,80,60,0.18)";
      ctx.fillRect(0, work.currentPick, W, 1);
      ctx.strokeStyle = "rgba(255,80,60,0.8)";
      ctx.lineWidth = 1.5 / z;
      ctx.strokeRect(-0.5 / z, work.currentPick, W + 1 / z, 1);
      if (hoverW >= 0 && hoverP >= 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1 / z;
        ctx.strokeRect(hoverW, hoverP, 1, 1);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    let curShuttle = 0;
    function drawStrip() {
      const h = stripCanvas.height, w = stripCanvas.width;
      if (h === 0) return;
      const half = w / 2;
      const img = sctx.createImageData(w, h);
      const u = new Uint32Array(img.data.buffer);
      for (let y = 0; y < h; y++) {
        const p = Math.min(P2 - 1, y / h * P2 | 0);
        const tc = pal[spec.shuttles[design.weftSeq[p] % spec.shuttles.length]];
        const ac = pal[spec.shuttles[work.weftSeq[p] % spec.shuttles.length]];
        for (let x = 0; x < w; x++) u[y * w + x] = x < half ? tc : ac;
      }
      sctx.putImageData(img, 0, 0);
      sctx.fillStyle = "rgba(255,80,60,0.9)";
      sctx.fillRect(0, work.currentPick / P2 * h, w, 2);
    }
    const floatScratch = new Uint8Array(W * P2);
    let statTimer = 0;
    function scheduleStats() {
      clearTimeout(statTimer);
      statTimer = window.setTimeout(() => {
        work.earThreads = countEarThreads(work.knots, W, P2);
        const f = detectFloats(spec, work.knots, floatScratch);
        root.querySelector("#edEar").textContent = String(work.earThreads);
        const fe = root.querySelector("#edFloat");
        fe.textContent = String(f);
        fe.parentElement.classList.toggle("bad", f > 0);
      }, 200);
    }
    let saveTimer = 0;
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveWork(work), 500);
    }
    function noteEdited() {
      if (work.mismatch) {
        work.mismatch = null;
        checkChk.checked = false;
        checkChk.disabled = true;
      }
      scheduleStats();
      scheduleSave();
    }
    function updatePickLabel() {
      root.querySelector("#edPick").textContent = `\u7B2C ${work.currentPick + 1} / ${P2} \u7EAC`;
      drawStrip();
    }
    const undoStack = [];
    let strokeRows = null;
    function snapshotRow(p) {
      if (strokeRows && !strokeRows.has(p))
        strokeRows.set(p, work.knots.slice(p * W, p * W + W));
    }
    function pushUndo(m) {
      undoStack.push(m);
      if (undoStack.length > 60) undoStack.shift();
    }
    function undo() {
      const m = undoStack.pop();
      if (!m) return;
      let p0 = P2, p1 = 0;
      for (const [p, row] of m) {
        work.knots.set(row, p * W);
        p0 = Math.min(p0, p);
        p1 = Math.max(p1, p);
      }
      refreshKnotRows(p0, p1);
      noteEdited();
      render();
    }
    let tool = "knot";
    const mirrorChk = root.querySelector("#edMirror");
    function setKnot(w, p) {
      if (w < 0 || w >= W || p < 0 || p >= P2) return;
      snapshotRow(p);
      const v = tool === "knot" ? 1 : 0;
      work.knots[p * W + w] = v;
      if (mirrorChk.checked) work.knots[p * W + (W - 1 - w)] = v;
      work.currentPick = p;
    }
    function paintLine(w0, p0, w1, p1) {
      const dw = Math.abs(w1 - w0), dp = Math.abs(p1 - p0);
      const n = Math.max(dw, dp, 1);
      const rows = /* @__PURE__ */ new Set();
      for (let i = 0; i <= n; i++) {
        const w = Math.round(w0 + (w1 - w0) * i / n);
        const p = Math.round(p0 + (p1 - p0) * i / n);
        setKnot(w, p);
        rows.add(p);
      }
      let lo = P2, hi = 0;
      for (const p of rows) {
        lo = Math.min(lo, p);
        hi = Math.max(hi, p);
      }
      refreshKnotRows(lo, hi);
    }
    function modifyRows(touched, apply) {
      const m = /* @__PURE__ */ new Map();
      for (const p of touched) if (!m.has(p)) m.set(p, work.knots.slice(p * W, p * W + W));
      apply();
      pushUndo(m);
      let lo = P2, hi = 0;
      for (const p of touched) {
        lo = Math.min(lo, p);
        hi = Math.max(hi, p);
      }
      refreshKnotRows(lo, hi);
      noteEdited();
      render();
    }
    root.querySelector("#edUndo").addEventListener("click", undo);
    root.querySelector("#edClearRow").addEventListener("click", () => {
      const p = work.currentPick;
      modifyRows([p], () => work.knots.fill(0, p * W, p * W + W));
    });
    root.querySelector("#edCopyDown").addEventListener("click", () => {
      const p = work.currentPick;
      if (p + 1 >= P2) return;
      modifyRows([p + 1], () => work.knots.copyWithin((p + 1) * W, p * W, p * W + W));
      work.currentPick = p + 1;
      updatePickLabel();
    });
    root.querySelector("#edMirrorDown").addEventListener("click", () => {
      const p = work.currentPick;
      if (p + 1 >= P2) return;
      modifyRows([p + 1], () => {
        for (let w = 0; w < W; w++) work.knots[(p + 1) * W + w] = work.knots[p * W + (W - 1 - w)];
      });
      work.currentPick = p + 1;
      updatePickLabel();
    });
    root.querySelector("#edTile").addEventListener("click", () => {
      const p = work.currentPick;
      const n = Math.max(1, parseInt(root.querySelector("#edTileN").value) || 1);
      modifyRows([p], () => {
        const off = p * W;
        for (let w = n; w < W; w++) work.knots[off + w] = work.knots[off + w % n];
      });
    });
    root.querySelector("#edLoop").addEventListener("click", () => {
      const p = work.currentPick;
      const from = Math.max(0, parseInt(root.querySelector("#edLoopFrom").value) || 0);
      const step = Math.max(1, parseInt(root.querySelector("#edLoopStep").value) || 1);
      const touched = [];
      for (let q = from; q < P2; q += step) if (q !== p) touched.push(q);
      modifyRows(touched, () => {
        for (const q of touched) work.knots.copyWithin(q * W, p * W, p * W + W);
      });
    });
    root.querySelector("#edPrev").addEventListener("click", () => {
      work.currentPick = Math.max(0, work.currentPick - 1);
      updatePickLabel();
      render();
    });
    root.querySelector("#edNext").addEventListener("click", () => {
      work.currentPick = Math.min(P2 - 1, work.currentPick + 1);
      updatePickLabel();
      render();
    });
    for (const b of root.querySelectorAll(".tool")) {
      b.addEventListener("click", () => {
        tool = b.dataset.tool;
        for (const x of root.querySelectorAll(".tool")) x.classList.toggle("on", x === b);
      });
    }
    if (spec.shuttleEditable) {
      root.querySelector("#edShuttleGrp").removeAttribute("hidden");
      const box = root.querySelector("#edShuttles");
      spec.shuttles.forEach((ci, i) => {
        const b = document.createElement("button");
        b.className = "btn shuttle" + (i === 0 ? " on" : "");
        b.style.background = spec.palette[ci];
        b.title = `\u68AD ${i + 1}`;
        b.addEventListener("click", () => {
          curShuttle = i;
          for (const [j, x] of [...box.children].entries()) x.classList.toggle("on", j === i);
        });
        box.appendChild(b);
      });
    }
    function cellAt(e) {
      const r = canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / z + ox), Math.floor((e.clientY - r.top) / z + oy)];
    }
    let painting = false, panning = false;
    let lastW = 0, lastP = 0, panX = 0, panY = 0;
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1 || e.button === 2) {
        panning = true;
        panX = e.clientX;
        panY = e.clientY;
        e.preventDefault();
        return;
      }
      painting = true;
      strokeRows = /* @__PURE__ */ new Map();
      const [w, p] = cellAt(e);
      lastW = w;
      lastP = p;
      setKnot(w, p);
      refreshKnotRows(p, p);
      updatePickLabel();
      render();
    });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    function onMove(e) {
      if (panning) {
        ox -= (e.clientX - panX) / z;
        oy -= (e.clientY - panY) / z;
        panX = e.clientX;
        panY = e.clientY;
        clampView();
        render();
        return;
      }
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        hoverW = hoverP = -1;
        if (!painting) return;
      }
      const [w, p] = cellAt(e);
      if (painting) {
        paintLine(lastW, lastP, w, p);
        lastW = w;
        lastP = p;
        updatePickLabel();
        render();
      } else {
        hoverW = w >= 0 && w < W ? w : -1;
        hoverP = p >= 0 && p < P2 ? p : -1;
        root.querySelector("#edHover").textContent = hoverW >= 0 ? `\u7ECF ${hoverW + 1} \xB7 \u7EAC ${hoverP + 1}` : "";
        render();
      }
    }
    function onUp() {
      if (painting && strokeRows) {
        if (strokeRows.size) pushUndo(strokeRows);
        strokeRows = null;
        noteEdited();
      }
      painting = false;
      panning = false;
    }
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const gx = mx / z + ox, gy = my / z + oy;
      z *= e.deltaY < 0 ? 1.2 : 1 / 1.2;
      clampView();
      ox = gx - mx / z;
      oy = gy - my / z;
      clampView();
      render();
    }, { passive: false });
    let stripDown = false;
    function stripPick(e) {
      const r = stripCanvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const p = Math.min(P2 - 1, Math.max(0, Math.floor(y / r.height * P2)));
      work.currentPick = p;
      if (spec.shuttleEditable && x > r.width / 2) {
        work.weftSeq[p] = curShuttle;
        noteEdited();
      }
      updatePickLabel();
      render();
    }
    stripCanvas.addEventListener("mousedown", (e) => {
      stripDown = true;
      stripPick(e);
    });
    window.addEventListener("mousemove", stripMove);
    function stripMove(e) {
      if (stripDown) stripPick(e);
    }
    window.addEventListener("mouseup", () => {
      stripDown = false;
    });
    stripCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
    function onKey(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowUp") {
        work.currentPick = Math.max(0, work.currentPick - 1);
        updatePickLabel();
        render();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        work.currentPick = Math.min(P2 - 1, work.currentPick + 1);
        updatePickLabel();
        render();
        e.preventDefault();
      } else if (e.key === "z" || e.key === "Z") undo();
      else if (e.key === " ") {
        overlayChk.checked = !overlayChk.checked;
        render();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    for (const b of root.querySelectorAll("[data-nav]"))
      b.addEventListener("click", () => {
        location.hash = b.dataset.nav;
      });
    overlayChk.addEventListener("change", render);
    checkChk.addEventListener("change", render);
    let sized = false;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      cw = Math.max(50, r.width | 0);
      ch = Math.max(50, r.height | 0);
      canvas.width = cw;
      canvas.height = ch;
      const sr = stripWrap.getBoundingClientRect();
      stripCanvas.width = Math.max(24, sr.width | 0);
      stripCanvas.height = Math.max(50, sr.height | 0);
      if (!sized) {
        sized = true;
        fitView();
      }
      clampView();
      render();
      drawStrip();
    });
    ro.observe(wrap);
    ro.observe(stripWrap);
    fitView();
    updatePickLabel();
    scheduleStats();
    render();
    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousemove", stripMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      clearTimeout(statTimer);
      clearTimeout(saveTimer);
      saveWork(work);
    };
  }
  var KNOT_COLOR, FREE_COLOR, MISS_COLOR;
  var init_editor = __esm({
    "src/editor.ts"() {
      "use strict";
      init_weave();
      init_state();
      KNOT_COLOR = 4280292360;
      FREE_COLOR = 822083583;
      MISS_COLOR = 4278241535;
    }
  });

  // src/loom.ts
  function mountLoom(root, levelId) {
    const work = getWork(levelId);
    const { spec } = work.level;
    const W = spec.warps, P2 = spec.picks;
    root.innerHTML = `
  <div class="page loom">
    <header class="bar">
      <button class="btn" data-nav="#/edit/${work.level.id}">\u2039 \u56DE\u6311\u82B1</button>
      <div class="bar-title"><b>${work.level.name}</b><span class="dim">${W}\u7ECF \xD7 ${P2}\u7EAC \xB7 ${GROUND_NAMES[spec.ground]}</span></div>
      <label class="lbl">\u901F\u5EA6</label>
      <select id="loomSpeed" class="sel">
        <option value="1">1 \u7EAC/\u5E27</option>
        <option value="4">4 \u7EAC/\u5E27</option>
        <option value="16" selected>16 \u7EAC/\u5E27</option>
        <option value="64">64 \u7EAC/\u5E27</option>
        <option value="256">256 \u7EAC/\u5E27</option>
      </select>
      <button class="btn primary" id="loomRun">\u5F00\u7EC7</button>
      <button class="btn" id="loomInstant">\u77AC\u7EC7</button>
      <button class="btn" id="loomDone" data-nav="#/result/${work.level.id}" disabled>\u7EC7\u6210 \u203A</button>
    </header>
    <div class="loom-top"><canvas id="loomScheme"></canvas></div>
    <div class="loom-fabric" id="loomFabWrap"><canvas id="loomFabric"></canvas></div>
    <div class="loom-progress"><div id="loomBar"></div><span id="loomPct" class="mono"></span></div>
  </div>`;
    const scheme = root.querySelector("#loomScheme");
    const sctx = scheme.getContext("2d");
    const fabWrap = root.querySelector("#loomFabWrap");
    const fabCanvas = root.querySelector("#loomFabric");
    const fctx = fabCanvas.getContext("2d");
    const runBtn = root.querySelector("#loomRun");
    const doneBtn = root.querySelector("#loomDone");
    const bar = root.querySelector("#loomBar");
    const pct = root.querySelector("#loomPct");
    const speedSel = root.querySelector("#loomSpeed");
    const fc = makeFaceCanvas(spec);
    work.face = new Uint8Array(W * P2);
    work.wovenPicks = 0;
    work.mismatch = null;
    work.floats = null;
    let running = false;
    let raf = 0;
    let shuttleX = 0;
    function updateDone() {
      const done = work.wovenPicks >= P2;
      doneBtn.disabled = !done;
      if (done) {
        running = false;
        runBtn.textContent = "\u5F00\u7EC7";
      }
    }
    function drawScheme() {
      const w = scheme.width, h = scheme.height;
      if (w === 0) return;
      const p = Math.min(work.wovenPicks, P2 - 1);
      sctx.clearRect(0, 0, w, h);
      sctx.fillStyle = "#2a2118";
      sctx.fillRect(0, 0, w, 10);
      sctx.fillStyle = "#241c12";
      sctx.fillRect(0, 10, w, 46);
      const N = Math.min(W, 160);
      const step = W / N;
      const x0 = 30, x1 = w - 30;
      const kx = (i) => x0 + (x1 - x0) * i / (N - 1);
      sctx.fillStyle = "#d8c9a8";
      sctx.font = "10px sans-serif";
      sctx.fillText(`\u82B1\u672C\xB7\u7B2C ${p + 1} \u7EAC`, 6, 20);
      for (let i = 0; i < N; i++) {
        const wi = Math.min(W - 1, Math.floor(i * step));
        const knot = work.knots[p * W + wi] === 1;
        const x = kx(i);
        sctx.strokeStyle = knot ? "#e0b040" : "rgba(200,180,140,0.35)";
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(x, 14);
        sctx.lineTo(x, 56);
        sctx.stroke();
        if (knot) {
          sctx.fillStyle = "#e0b040";
          sctx.beginPath();
          sctx.arc(x, 34, 2.5, 0, 7);
          sctx.fill();
        }
      }
      const shedY = 96, fabY = h - 26;
      for (let i = 0; i < N; i++) {
        const wi = Math.min(W - 1, Math.floor(i * step));
        const knot = work.knots[p * W + wi] === 1;
        const x = kx(i);
        const dip = knot ? 16 : 0;
        sctx.strokeStyle = knot ? "#c9a86a" : "#8a7a5c";
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(x, 56);
        sctx.lineTo(x, shedY + dip);
        sctx.lineTo(x, fabY);
        sctx.stroke();
      }
      const dir = p % 2 === 0 ? 1 : -1;
      const sx = dir > 0 ? x0 + (x1 - x0) * shuttleX : x1 - (x1 - x0) * shuttleX;
      const weftColor = spec.palette[spec.shuttles[work.weftSeq[p] % spec.shuttles.length]];
      sctx.fillStyle = weftColor;
      sctx.beginPath();
      sctx.ellipse(sx, shedY + 8, 12, 4, 0, 0, 7);
      sctx.fill();
      sctx.strokeStyle = "#3a2c1a";
      sctx.stroke();
      sctx.strokeStyle = "#d8c9a8";
      sctx.beginPath();
      sctx.moveTo(x0 - 8, fabY);
      sctx.lineTo(x1 + 8, fabY);
      sctx.stroke();
      sctx.fillStyle = "#3a2c1a";
      sctx.fillRect(x0 - 14, h - 18, x1 - x0 + 28, 10);
      sctx.fillStyle = "#d8c9a8";
      sctx.fillText("\u7EC7\u53E3", 6, fabY + 4);
    }
    function drawFabric() {
      const r = fabWrap.getBoundingClientRect();
      if (fabCanvas.width !== (r.width | 0)) {
        fabCanvas.width = r.width | 0;
        fabCanvas.height = r.height | 0;
      }
      const cw = fabCanvas.width, ch = fabCanvas.height;
      fctx.fillStyle = "#100d09";
      fctx.fillRect(0, 0, cw, ch);
      const s = Math.min(cw / W, ch / P2);
      const dw = W * s, dh = P2 * s;
      fctx.imageSmoothingEnabled = false;
      fctx.drawImage(fc.canvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      const y = (ch - dh) / 2 + work.wovenPicks * s;
      fctx.strokeStyle = "rgba(255,90,60,0.9)";
      fctx.beginPath();
      fctx.moveTo((cw - dw) / 2, y);
      fctx.lineTo((cw + dw) / 2, y);
      fctx.stroke();
    }
    function updateProgress() {
      const pc = work.wovenPicks / P2 * 100;
      bar.style.width = pc + "%";
      pct.textContent = `${work.wovenPicks} / ${P2} \u7EAC`;
    }
    function frame() {
      if (!running) return;
      const speed = parseInt(speedSel.value) || 1;
      const p0 = work.wovenPicks;
      const n = Math.min(speed, P2 - p0);
      for (let i = 0; i < n; i++) {
        const p = p0 + i;
        weavePick(spec, work.knots, work.weftSeq, p, work.face);
        writePickPixels(fc, work.face, W, p);
      }
      flushPicks(fc, p0, n);
      work.wovenPicks = p0 + n;
      shuttleX = (shuttleX + 0.12 * n) % 1;
      drawScheme();
      drawFabric();
      updateProgress();
      updateDone();
      if (running) raf = requestAnimationFrame(frame);
    }
    runBtn.addEventListener("click", () => {
      if (work.wovenPicks >= P2) {
        work.wovenPicks = 0;
        fc.u32.fill(0);
        fc.ctx.putImageData(fc.img, 0, 0);
      }
      running = !running;
      runBtn.textContent = running ? "\u505C" : "\u5F00\u7EC7";
      if (running) raf = requestAnimationFrame(frame);
    });
    root.querySelector("#loomInstant").addEventListener("click", () => {
      running = false;
      weaveAll(spec, work.knots, work.weftSeq, work.face);
      fillFace(fc, work.face);
      flushAll(fc);
      work.wovenPicks = P2;
      drawScheme();
      drawFabric();
      updateProgress();
      updateDone();
    });
    for (const b of root.querySelectorAll("[data-nav]"))
      b.addEventListener("click", () => {
        location.hash = b.dataset.nav;
      });
    const ro = new ResizeObserver(() => {
      const r = root.querySelector(".loom-top").getBoundingClientRect();
      scheme.width = r.width | 0;
      scheme.height = r.height | 0;
      drawScheme();
      drawFabric();
    });
    ro.observe(root.querySelector(".loom-top"));
    ro.observe(fabWrap);
    drawScheme();
    drawFabric();
    updateProgress();
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }
  var init_loom = __esm({
    "src/loom.ts"() {
      "use strict";
      init_weave();
      init_state();
      init_render();
    }
  });

  // src/result.ts
  function mountResult(root, levelId) {
    const work = getWork(levelId);
    const level = work.level;
    const { spec, design } = level;
    const W = spec.warps, P2 = spec.picks;
    if (!work.face || work.wovenPicks < P2) {
      if (!work.face) work.face = new Uint8Array(W * P2);
      weaveAll(spec, work.knots, work.weftSeq, work.face);
      work.wovenPicks = P2;
    }
    work.floats = new Uint8Array(W * P2);
    work.floatSegments = detectFloats(spec, work.knots, work.floats);
    work.mismatch = new Uint8Array(W * P2);
    const cmp = compareWithDesign(spec, design, work.knots, work.weftSeq, work.mismatch);
    work.errors = cmp.errors;
    work.matchTotal = cmp.total;
    work.earThreads = countEarThreads(work.knots, W, P2);
    const matchPct = (1 - work.errors / Math.max(1, work.matchTotal)) * 100;
    const passed = work.errors === 0;
    const stars = !passed ? 0 : work.floatSegments > 0 ? 1 : work.earThreads > level.par ? 2 : 3;
    setStars(level.id, stars);
    const next = LEVELS[LEVELS.findIndex((l) => l.id === level.id) + 1];
    root.innerHTML = `
  <div class="page result">
    <header class="bar">
      <button class="btn" data-nav="#/edit/${level.id}">\u2039 \u56DE\u6311\u82B1\u4FEE\u6539</button>
      <div class="bar-title"><b>${level.name}</b><span class="dim">\u7EC7\u7269\u6210\u54C1 \xB7 ${W}\u7ECF \xD7 ${P2}\u7EAC \xB7 ${GROUND_NAMES[spec.ground]}</span></div>
      <label class="chk"><input type="checkbox" id="rsFloat" checked> \u7EAC\u6D6E\u8D85\u6807</label>
      <label class="chk"><input type="checkbox" id="rsMiss" checked> \u9519\u4F4D</label>
      <button class="btn" data-nav="#/loom/${level.id}">\u91CD\u65B0\u4E0A\u673A</button>
      ${next ? `<button class="btn primary" data-nav="#/edit/${next.id}">\u4E0B\u4E00\u5173:${next.name} \u203A</button>` : ""}
      <button class="btn" data-nav="#/levels">\u9009\u5173</button>
    </header>
    <div class="rs-main">
      <div class="rs-canvas-wrap" id="rsWrap"><canvas id="rsCanvas"></canvas></div>
      <aside class="rs-side">
        <div class="verdict ${passed ? "pass" : "fail"}">${passed ? "\u7EC7\u6210!" : "\u7EB9\u6837\u672A\u5408"}</div>
        <div class="stars">${"\u2605".repeat(stars)}${"\u2606".repeat(3 - stars)}</div>
        <div class="grp">
          <div class="stat">\u7EB9\u6837\u4E00\u81F4\u5EA6 <b>${matchPct.toFixed(2)}%</b></div>
          <div class="stat ${work.errors ? "bad" : ""}">\u9519\u4F4D\u70B9 <b>${work.errors}</b></div>
          <div class="stat ${work.floatSegments ? "bad" : ""}">\u7EAC\u6D6E\u8D85\u6807 <b>${work.floatSegments}</b> \u6BB5${work.floatSegments ? "(\u52FE\u4E1D)" : ""}</div>
          <div class="stat ${work.earThreads > level.par ? "warn" : ""}">\u8033\u5B50\u7EBF <b>${work.earThreads}</b> / \u57FA\u51C6 ${level.par}</div>
        </div>
        <div class="grp">
          <div class="grp-t">\u5B9A\u7B49</div>
          <div class="tip">\u2605 \u7EB9\u6837\u5168\u5BF9(\u65E0\u4E00\u9519\u4F4D)</div>
          <div class="tip">\u2605\u2605 \u4E14\u65E0\u7EAC\u6D6E\u52FE\u4E1D</div>
          <div class="tip">\u2605\u2605\u2605 \u4E14\u8033\u5B50\u7EBF\u4E0D\u8D85\u57FA\u51C6</div>
        </div>
        <div class="grp" id="rsErrGrp">
          <div class="grp-t">\u9519\u4F4D\u6240\u5728\u7EAC(\u70B9\u51FB\u53BB\u4FEE)</div>
          <div id="rsErrList" class="err-list"></div>
        </div>
      </aside>
    </div>
  </div>`;
    const fc = makeFaceCanvas(spec);
    fillFace(fc, work.face);
    flushAll(fc);
    const floatCanvas = document.createElement("canvas");
    floatCanvas.width = W;
    floatCanvas.height = P2;
    const flctx = floatCanvas.getContext("2d");
    const flimg = flctx.createImageData(W, P2);
    const flu = new Uint32Array(flimg.data.buffer);
    for (let i = 0; i < W * P2; i++) if (work.floats[i]) flu[i] = 2952847615;
    flctx.putImageData(flimg, 0, 0);
    const missCanvas = document.createElement("canvas");
    missCanvas.width = W;
    missCanvas.height = P2;
    const msctx = missCanvas.getContext("2d");
    const msimg = msctx.createImageData(W, P2);
    const msu = new Uint32Array(msimg.data.buffer);
    for (let i = 0; i < W * P2; i++) if (work.mismatch[i]) msu[i] = 4278241535;
    msctx.putImageData(msimg, 0, 0);
    const wrap = root.querySelector("#rsWrap");
    const canvas = root.querySelector("#rsCanvas");
    const ctx = canvas.getContext("2d");
    const floatChk = root.querySelector("#rsFloat");
    const missChk = root.querySelector("#rsMiss");
    let z = 1, ox = 0, oy = 0, cw = 0, ch = 0;
    function fit() {
      z = Math.max(0.2, Math.min(cw / W, ch / P2));
      ox = (W - cw / z) / 2;
      oy = (P2 - ch / z) / 2;
    }
    function render() {
      if (!cw) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#100d09";
      ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(z, 0, 0, z, -ox * z, -oy * z);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fc.canvas, 0, 0);
      if (floatChk.checked) ctx.drawImage(floatCanvas, 0, 0);
      if (missChk.checked) ctx.drawImage(missCanvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    floatChk.addEventListener("change", render);
    missChk.addEventListener("change", render);
    let panning = false, px = 0, py = 0;
    canvas.addEventListener("mousedown", (e) => {
      panning = true;
      px = e.clientX;
      py = e.clientY;
    });
    const onMove = (e) => {
      if (!panning) return;
      ox -= (e.clientX - px) / z;
      oy -= (e.clientY - py) / z;
      px = e.clientX;
      py = e.clientY;
      ox = Math.min(W, Math.max(-W * 0.3, ox));
      oy = Math.min(P2, Math.max(-P2 * 0.3, oy));
      render();
    };
    const onUp = () => {
      panning = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const gx = mx / z + ox, gy = my / z + oy;
      z = Math.min(40, Math.max(0.2, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      ox = gx - mx / z;
      oy = gy - my / z;
      render();
    }, { passive: false });
    const errList = root.querySelector("#rsErrList");
    if (work.errors === 0) {
      root.querySelector("#rsErrGrp").remove();
    } else {
      const perPick = /* @__PURE__ */ new Map();
      for (let p = 0; p < P2; p++) {
        let c = 0;
        const off = p * W;
        for (let w = 0; w < W; w++) if (work.mismatch[off + w]) c++;
        if (c) perPick.set(p, c);
      }
      let shown = 0;
      for (const [p, c] of perPick) {
        if (shown++ >= 40) {
          const more = document.createElement("div");
          more.className = "dim";
          more.textContent = `\u2026\u5171 ${perPick.size} \u7EAC\u6709\u9519\u4F4D`;
          errList.appendChild(more);
          break;
        }
        const b = document.createElement("button");
        b.className = "btn err-item";
        b.textContent = `\u7B2C ${p + 1} \u7EAC \xB7 ${c} \u5904`;
        b.addEventListener("click", () => {
          work.currentPick = p;
          location.hash = `#/edit/${level.id}`;
        });
        errList.appendChild(b);
      }
    }
    for (const b of root.querySelectorAll("[data-nav]"))
      b.addEventListener("click", () => {
        location.hash = b.dataset.nav;
      });
    let sized = false;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      cw = Math.max(50, r.width | 0);
      ch = Math.max(50, r.height | 0);
      canvas.width = cw;
      canvas.height = ch;
      if (!sized) {
        sized = true;
        fit();
      }
      render();
    });
    ro.observe(wrap);
    fit();
    render();
    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }
  var init_result = __esm({
    "src/result.ts"() {
      "use strict";
      init_weave();
      init_state();
      init_render();
    }
  });

  // src/main.ts
  var require_main = __commonJS({
    "src/main.ts"() {
      init_levelsPage();
      init_editor();
      init_loom();
      init_result();
      var app = document.getElementById("app");
      var cleanup = null;
      function route() {
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
        const hash = location.hash || "#/levels";
        const parts = hash.slice(2).split("/");
        const page = parts[0] || "levels";
        const id = parts[1] || "";
        try {
          if (page === "edit") cleanup = mountEditor(app, id);
          else if (page === "loom") cleanup = mountLoom(app, id);
          else if (page === "result") cleanup = mountResult(app, id);
          else cleanup = mountLevels(app);
        } catch (err) {
          console.error(err);
          location.hash = "#/levels";
        }
      }
      window.addEventListener("hashchange", route);
      route();
    }
  });
  require_main();
})();
