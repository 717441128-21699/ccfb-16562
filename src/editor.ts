// ============================================================
// 挑花结本页:在 W×P 的花本格子上结耳子线
// 图层:意匠图底色 / 自由行 / 玩家结子 / 校对错位 / 当前纬
// ============================================================
import {
  detectFloats, countEarThreads, paletteU32, GROUND_NAMES, weaveAll,
} from './weave.js';
import { Work, getWork, saveWork } from './state.js';

const KNOT_COLOR = 0xff201408;   // 结子色(ABGR)
const FREE_COLOR = 0x30ffffff;   // 自由行标记
const MISS_COLOR = 0xff00c8ff;   // 错位标记(橙)

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  u32: Uint32Array;
}

function makeLayer(W: number, P: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = P;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, P);
  return { canvas, ctx, img, u32: new Uint32Array(img.data.buffer) };
}

export function mountEditor(root: HTMLElement, levelId: string): () => void {
  const work = getWork(levelId);
  const level = work.level;
  const { spec, design } = level;
  const W = spec.warps, P = spec.picks;
  const pal = paletteU32(spec.palette);

  // ---------------- DOM ----------------
  root.innerHTML = `
  <div class="page ed">
    <header class="bar">
      <button class="btn" data-nav="#/levels">‹ 选关</button>
      <div class="bar-title">
        <b>${level.name}</b><span class="dim">${level.subtitle} · ${W}经 × ${P}纬 · ${GROUND_NAMES[spec.ground]} · 纬浮≤${spec.floatLimit}</span>
      </div>
      <label class="chk"><input type="checkbox" id="edOverlay" checked> 意匠图</label>
      <label class="chk"><input type="checkbox" id="edCheck" ${work.mismatch ? '' : 'disabled'}> 校对错位</label>
      <button class="btn primary" data-nav="#/loom/${level.id}">上机织造 ›</button>
    </header>
    <div class="ed-main">
      <aside class="ed-side">
        <div class="grp">
          <div class="grp-t">挑花</div>
          <div class="row">
            <button class="btn tool on" data-tool="knot">结</button>
            <button class="btn tool" data-tool="erase">拆</button>
            <label class="chk"><input type="checkbox" id="edMirror"> 镜像笔</label>
          </div>
          <div class="row">
            <button class="btn" id="edUndo">撤销</button>
            <button class="btn" id="edClearRow">清此纬</button>
          </div>
        </div>
        <div class="grp">
          <div class="grp-t">当前纬 <span id="edPick" class="mono"></span></div>
          <div class="row">
            <button class="btn" id="edPrev">▲上一纬</button>
            <button class="btn" id="edNext">▼下一纬</button>
          </div>
          <div class="row">
            <button class="btn" id="edCopyDown">复到下一纬</button>
            <button class="btn" id="edMirrorDown">镜像复到下一纬</button>
          </div>
        </div>
        <div class="grp">
          <div class="grp-t">循环(省耳子线)</div>
          <div class="row"><span class="lbl">左右循环 周期</span><input id="edTileN" type="number" value="24" min="1" class="num"><button class="btn" id="edTile">铺此行</button></div>
          <div class="row"><span class="lbl">上下循环 起</span><input id="edLoopFrom" type="number" value="0" min="0" class="num"><span class="lbl">步</span><input id="edLoopStep" type="number" value="12" min="1" class="num"><button class="btn" id="edLoop">铺全幅</button></div>
        </div>
        <div class="grp" id="edShuttleGrp" hidden>
          <div class="grp-t">梭道(点右侧色条换梭)</div>
          <div class="row" id="edShuttles"></div>
        </div>
        <div class="grp">
          <div class="grp-t">花本</div>
          <div class="stat">耳子线 <b id="edEar">–</b> / 基准 ${level.par}</div>
          <div class="stat">纬浮超标 <b id="edFloat">–</b> 段</div>
          <div class="stat dim" id="edHover"></div>
        </div>
        <div class="grp tips">
          <div class="grp-t">匠人口诀</div>
          ${level.tips.map(t => `<div class="tip">· ${t}</div>`).join('')}
        </div>
      </aside>
      <div class="ed-strip-wrap" id="edStripWrap" title="纬向梭色:左=意匠 右=现行">
        <canvas id="edStrip"></canvas>
      </div>
      <div class="ed-canvas-wrap" id="edWrap"><canvas id="edCanvas"></canvas></div>
    </div>
  </div>`;

  const wrap = root.querySelector<HTMLDivElement>('#edWrap')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#edCanvas')!;
  const ctx = canvas.getContext('2d')!;
  const stripCanvas = root.querySelector<HTMLCanvasElement>('#edStrip')!;
  const stripWrap = root.querySelector<HTMLDivElement>('#edStripWrap')!;
  const sctx = stripCanvas.getContext('2d')!;

  // ---------------- 图层 ----------------
  const targetLayer = makeLayer(W, P);
  const knotLayer = makeLayer(W, P);
  const freeLayer = makeLayer(W, P);
  const missLayer = makeLayer(W, P);

  // 意匠图面色(直接用织机逻辑织出目标布面)
  {
    const tFace = new Uint8Array(W * P);
    weaveAll(spec, design.knots, design.weftSeq, tFace);
    for (let i = 0; i < W * P; i++) targetLayer.u32[i] = pal[tFace[i]];
    targetLayer.ctx.putImageData(targetLayer.img, 0, 0);
  }
  // 自由行
  {
    for (let i = 0; i < W * P; i++) if (design.free[i]) freeLayer.u32[i] = FREE_COLOR;
    freeLayer.ctx.putImageData(freeLayer.img, 0, 0);
  }

  function refreshKnotRows(p0: number, p1: number): void {
    for (let p = p0; p <= p1; p++) {
      const off = p * W;
      for (let w = 0; w < W; w++)
        knotLayer.u32[off + w] = work.knots[off + w] ? KNOT_COLOR : 0;
    }
    knotLayer.ctx.putImageData(knotLayer.img, 0, p0, 0, p0, W, p1 - p0 + 1);
  }
  function refreshMissLayer(): void {
    missLayer.u32.fill(0);
    if (work.mismatch)
      for (let i = 0; i < W * P; i++) if (work.mismatch[i]) missLayer.u32[i] = MISS_COLOR;
    missLayer.ctx.putImageData(missLayer.img, 0, 0);
  }
  refreshKnotRows(0, P - 1);
  if (work.mismatch) refreshMissLayer();

  // ---------------- 视图变换 ----------------
  let z = 4, ox = 0, oy = 0; // z: 每格像素; ox,oy: 左上角格子坐标
  let cw = 0, ch = 0;

  function clampView(): void {
    z = Math.min(40, Math.max(0.2, z));
    ox = Math.min(W - 1, Math.max(-W * 0.2, ox));
    oy = Math.min(P - 1, Math.max(-P * 0.2, oy));
  }
  function fitView(): void {
    z = Math.max(0.2, Math.min(cw / W, ch / P));
    ox = (W - cw / z) / 2;
    oy = (P - ch / z) / 2;
    clampView();
  }

  // ---------------- 渲染 ----------------
  const overlayChk = root.querySelector<HTMLInputElement>('#edOverlay')!;
  const checkChk = root.querySelector<HTMLInputElement>('#edCheck')!;
  let hoverW = -1, hoverP = -1;

  function render(): void {
    if (cw === 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#17130e';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(z, 0, 0, z, -ox * z, -oy * z);
    ctx.imageSmoothingEnabled = false;
    if (overlayChk.checked) { ctx.globalAlpha = 0.5; ctx.drawImage(targetLayer.canvas, 0, 0); }
    ctx.globalAlpha = 1;
    ctx.drawImage(freeLayer.canvas, 0, 0);
    ctx.drawImage(knotLayer.canvas, 0, 0);
    if (checkChk.checked && work.mismatch) { ctx.globalAlpha = 0.85; ctx.drawImage(missLayer.canvas, 0, 0); ctx.globalAlpha = 1; }
    // 网格线
    if (z >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      const x0 = Math.max(0, ox | 0), x1 = Math.min(W, ox + cw / z + 1);
      const y0 = Math.max(0, oy | 0), y1 = Math.min(P, oy + ch / z + 1);
      for (let x = x0; x <= x1; x++) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = y0; y <= y1; y++) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
    // 当前纬
    ctx.fillStyle = 'rgba(255,80,60,0.18)';
    ctx.fillRect(0, work.currentPick, W, 1);
    ctx.strokeStyle = 'rgba(255,80,60,0.8)';
    ctx.lineWidth = 1.5 / z;
    ctx.strokeRect(-0.5 / z, work.currentPick, W + 1 / z, 1);
    // 悬停
    if (hoverW >= 0 && hoverP >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1 / z;
      ctx.strokeRect(hoverW, hoverP, 1, 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------------- 梭色条 ----------------
  let curShuttle = 0;
  function drawStrip(): void {
    const h = stripCanvas.height, w = stripCanvas.width;
    if (h === 0) return;
    const half = w / 2;
    const img = sctx.createImageData(w, h);
    const u = new Uint32Array(img.data.buffer);
    for (let y = 0; y < h; y++) {
      const p = Math.min(P - 1, (y / h * P) | 0);
      const tc = pal[spec.shuttles[design.weftSeq[p] % spec.shuttles.length]];
      const ac = pal[spec.shuttles[work.weftSeq[p] % spec.shuttles.length]];
      for (let x = 0; x < w; x++) u[y * w + x] = x < half ? tc : ac;
    }
    sctx.putImageData(img, 0, 0);
    // 当前纬指示
    sctx.fillStyle = 'rgba(255,80,60,0.9)';
    sctx.fillRect(0, work.currentPick / P * h, w, 2);
  }

  // ---------------- 统计 ----------------
  const floatScratch = new Uint8Array(W * P);
  let statTimer = 0;
  function scheduleStats(): void {
    clearTimeout(statTimer);
    statTimer = window.setTimeout(() => {
      work.earThreads = countEarThreads(work.knots, W, P);
      const f = detectFloats(spec, work.knots, floatScratch);
      root.querySelector('#edEar')!.textContent = String(work.earThreads);
      const fe = root.querySelector('#edFloat')!;
      fe.textContent = String(f);
      fe.parentElement!.classList.toggle('bad', f > 0);
    }, 200);
  }

  let saveTimer = 0;
  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveWork(work), 500);
  }

  // 花本一动,上次织出的校对结果即作废——改了就得重织才知道对错
  function noteEdited(): void {
    if (work.mismatch) {
      work.mismatch = null;
      checkChk.checked = false;
      checkChk.disabled = true;
    }
    scheduleStats();
    scheduleSave();
  }

  function updatePickLabel(): void {
    root.querySelector('#edPick')!.textContent = `第 ${work.currentPick + 1} / ${P} 纬`;
    drawStrip();
  }

  // ---------------- 撤销 ----------------
  const undoStack: Map<number, Uint8Array>[] = [];
  let strokeRows: Map<number, Uint8Array> | null = null;
  function snapshotRow(p: number): void {
    if (strokeRows && !strokeRows.has(p))
      strokeRows.set(p, work.knots.slice(p * W, p * W + W));
  }
  function pushUndo(m: Map<number, Uint8Array>): void {
    undoStack.push(m);
    if (undoStack.length > 60) undoStack.shift();
  }
  function undo(): void {
    const m = undoStack.pop();
    if (!m) return;
    let p0 = P, p1 = 0;
    for (const [p, row] of m) {
      work.knots.set(row, p * W);
      p0 = Math.min(p0, p); p1 = Math.max(p1, p);
    }
    refreshKnotRows(p0, p1);
    noteEdited(); render();
  }

  // ---------------- 结/拆 ----------------
  let tool: 'knot' | 'erase' = 'knot';
  const mirrorChk = root.querySelector<HTMLInputElement>('#edMirror')!;

  function setKnot(w: number, p: number): void {
    if (w < 0 || w >= W || p < 0 || p >= P) return;
    snapshotRow(p);
    const v = tool === 'knot' ? 1 : 0;
    work.knots[p * W + w] = v;
    if (mirrorChk.checked) work.knots[p * W + (W - 1 - w)] = v;
    work.currentPick = p;
  }
  function paintLine(w0: number, p0: number, w1: number, p1: number): void {
    const dw = Math.abs(w1 - w0), dp = Math.abs(p1 - p0);
    const n = Math.max(dw, dp, 1);
    const rows = new Set<number>();
    for (let i = 0; i <= n; i++) {
      const w = Math.round(w0 + (w1 - w0) * i / n);
      const p = Math.round(p0 + (p1 - p0) * i / n);
      setKnot(w, p);
      rows.add(p);
    }
    let lo = P, hi = 0;
    for (const p of rows) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
    refreshKnotRows(lo, hi);
  }

  // ---------------- 行操作 ----------------
  function modifyRows(touched: number[], apply: () => void): void {
    const m = new Map<number, Uint8Array>();
    for (const p of touched) if (!m.has(p)) m.set(p, work.knots.slice(p * W, p * W + W));
    apply();
    pushUndo(m);
    let lo = P, hi = 0;
    for (const p of touched) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
    refreshKnotRows(lo, hi);
    noteEdited(); render();
  }

  root.querySelector('#edUndo')!.addEventListener('click', undo);
  root.querySelector('#edClearRow')!.addEventListener('click', () => {
    const p = work.currentPick;
    modifyRows([p], () => work.knots.fill(0, p * W, p * W + W));
  });
  root.querySelector('#edCopyDown')!.addEventListener('click', () => {
    const p = work.currentPick;
    if (p + 1 >= P) return;
    modifyRows([p + 1], () => work.knots.copyWithin((p + 1) * W, p * W, p * W + W));
    work.currentPick = p + 1; updatePickLabel();
  });
  root.querySelector('#edMirrorDown')!.addEventListener('click', () => {
    const p = work.currentPick;
    if (p + 1 >= P) return;
    modifyRows([p + 1], () => {
      for (let w = 0; w < W; w++) work.knots[(p + 1) * W + w] = work.knots[p * W + (W - 1 - w)];
    });
    work.currentPick = p + 1; updatePickLabel();
  });
  root.querySelector('#edTile')!.addEventListener('click', () => {
    const p = work.currentPick;
    const n = Math.max(1, parseInt((root.querySelector('#edTileN') as HTMLInputElement).value) || 1);
    modifyRows([p], () => {
      const off = p * W;
      for (let w = n; w < W; w++) work.knots[off + w] = work.knots[off + (w % n)];
    });
  });
  root.querySelector('#edLoop')!.addEventListener('click', () => {
    const p = work.currentPick;
    const from = Math.max(0, parseInt((root.querySelector('#edLoopFrom') as HTMLInputElement).value) || 0);
    const step = Math.max(1, parseInt((root.querySelector('#edLoopStep') as HTMLInputElement).value) || 1);
    const touched: number[] = [];
    for (let q = from; q < P; q += step) if (q !== p) touched.push(q);
    modifyRows(touched, () => {
      for (const q of touched) work.knots.copyWithin(q * W, p * W, p * W + W);
    });
  });
  root.querySelector('#edPrev')!.addEventListener('click', () => {
    work.currentPick = Math.max(0, work.currentPick - 1); updatePickLabel(); render();
  });
  root.querySelector('#edNext')!.addEventListener('click', () => {
    work.currentPick = Math.min(P - 1, work.currentPick + 1); updatePickLabel(); render();
  });

  // 工具切换
  for (const b of root.querySelectorAll<HTMLButtonElement>('.tool')) {
    b.addEventListener('click', () => {
      tool = b.dataset.tool as 'knot' | 'erase';
      for (const x of root.querySelectorAll('.tool')) x.classList.toggle('on', x === b);
    });
  }

  // ---------------- 梭道 ----------------
  if (spec.shuttleEditable) {
    root.querySelector('#edShuttleGrp')!.removeAttribute('hidden');
    const box = root.querySelector('#edShuttles')!;
    spec.shuttles.forEach((ci, i) => {
      const b = document.createElement('button');
      b.className = 'btn shuttle' + (i === 0 ? ' on' : '');
      b.style.background = spec.palette[ci];
      b.title = `梭 ${i + 1}`;
      b.addEventListener('click', () => {
        curShuttle = i;
        for (const [j, x] of [...box.children].entries()) x.classList.toggle('on', j === i);
      });
      box.appendChild(b);
    });
  }

  // ---------------- 画布交互 ----------------
  function cellAt(e: MouseEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / z + ox), Math.floor((e.clientY - r.top) / z + oy)];
  }
  let painting = false, panning = false;
  let lastW = 0, lastP = 0, panX = 0, panY = 0;

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1 || e.button === 2) {
      panning = true; panX = e.clientX; panY = e.clientY;
      e.preventDefault();
      return;
    }
    painting = true;
    strokeRows = new Map();
    const [w, p] = cellAt(e);
    lastW = w; lastP = p;
    setKnot(w, p);
    refreshKnotRows(p, p);
    updatePickLabel();
    render();
  });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  function onMove(e: MouseEvent): void {
    if (panning) {
      ox -= (e.clientX - panX) / z;
      oy -= (e.clientY - panY) / z;
      panX = e.clientX; panY = e.clientY;
      clampView(); render();
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
      lastW = w; lastP = p;
      updatePickLabel();
      render();
    } else {
      hoverW = w >= 0 && w < W ? w : -1;
      hoverP = p >= 0 && p < P ? p : -1;
      root.querySelector('#edHover')!.textContent =
        hoverW >= 0 ? `经 ${hoverW + 1} · 纬 ${hoverP + 1}` : '';
      render();
    }
  }
  function onUp(): void {
    if (painting && strokeRows) {
      if (strokeRows.size) pushUndo(strokeRows);
      strokeRows = null;
      noteEdited();
    }
    painting = false; panning = false;
  }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const gx = mx / z + ox, gy = my / z + oy;
    z *= e.deltaY < 0 ? 1.2 : 1 / 1.2;
    clampView();
    ox = gx - mx / z; oy = gy - my / z;
    clampView(); render();
  }, { passive: false });

  // 梭色条交互
  let stripDown = false;
  function stripPick(e: MouseEvent): void {
    const r = stripCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const p = Math.min(P - 1, Math.max(0, Math.floor(y / r.height * P)));
    work.currentPick = p;
    if (spec.shuttleEditable && x > r.width / 2) {
      work.weftSeq[p] = curShuttle;
      noteEdited();
    }
    updatePickLabel(); render();
  }
  stripCanvas.addEventListener('mousedown', e => { stripDown = true; stripPick(e); });
  window.addEventListener('mousemove', stripMove);
  function stripMove(e: MouseEvent): void { if (stripDown) stripPick(e); }
  window.addEventListener('mouseup', () => { stripDown = false; });
  stripCanvas.addEventListener('contextmenu', e => e.preventDefault());

  // 键盘
  function onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'ArrowUp') { work.currentPick = Math.max(0, work.currentPick - 1); updatePickLabel(); render(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { work.currentPick = Math.min(P - 1, work.currentPick + 1); updatePickLabel(); render(); e.preventDefault(); }
    else if (e.key === 'z' || e.key === 'Z') undo();
    else if (e.key === ' ') { overlayChk.checked = !overlayChk.checked; render(); e.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);

  // 导航
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-nav]'))
    b.addEventListener('click', () => { location.hash = b.dataset.nav!; });

  overlayChk.addEventListener('change', render);
  checkChk.addEventListener('change', render);

  // ---------------- 尺寸 ----------------
  let sized = false;
  const ro = new ResizeObserver(() => {
    const r = wrap.getBoundingClientRect();
    cw = Math.max(50, r.width | 0); ch = Math.max(50, r.height | 0);
    canvas.width = cw; canvas.height = ch;
    const sr = stripWrap.getBoundingClientRect();
    stripCanvas.width = Math.max(24, sr.width | 0);
    stripCanvas.height = Math.max(50, sr.height | 0);
    if (!sized) { sized = true; fitView(); }
    clampView(); render(); drawStrip();
  });
  ro.observe(wrap);
  ro.observe(stripWrap);

  fitView();
  updatePickLabel();
  scheduleStats();
  render();

  return () => {
    ro.disconnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mousemove', stripMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey);
    clearTimeout(statTimer); clearTimeout(saveTimer);
    saveWork(work);
  };
}
