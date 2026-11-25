// ============================================================
// 织机页:花楼机示意 + 逐纬织造动画
// 上:花本帘、耳子线、综丝、经面、梭子;下:织成的布面
// ============================================================
import { weavePick, weaveAll, GROUND_NAMES } from './weave.js';
import { Work, getWork } from './state.js';
import { makeFaceCanvas, writePickPixels, flushPicks, flushAll, fillFace, FaceCanvas } from './render.js';

export function mountLoom(root: HTMLElement, levelId: string): () => void {
  const work = getWork(levelId);
  const { spec } = work.level;
  const W = spec.warps, P = spec.picks;

  root.innerHTML = `
  <div class="page loom">
    <header class="bar">
      <button class="btn" data-nav="#/edit/${work.level.id}">‹ 回挑花</button>
      <div class="bar-title"><b>${work.level.name}</b><span class="dim">${W}经 × ${P}纬 · ${GROUND_NAMES[spec.ground]}</span></div>
      <label class="lbl">速度</label>
      <select id="loomSpeed" class="sel">
        <option value="1">1 纬/帧</option>
        <option value="4">4 纬/帧</option>
        <option value="16" selected>16 纬/帧</option>
        <option value="64">64 纬/帧</option>
        <option value="256">256 纬/帧</option>
      </select>
      <button class="btn primary" id="loomRun">开织</button>
      <button class="btn" id="loomInstant">瞬织</button>
      <button class="btn" id="loomDone" data-nav="#/result/${work.level.id}" disabled>织成 ›</button>
    </header>
    <div class="loom-top"><canvas id="loomScheme"></canvas></div>
    <div class="loom-fabric" id="loomFabWrap"><canvas id="loomFabric"></canvas></div>
    <div class="loom-progress"><div id="loomBar"></div><span id="loomPct" class="mono"></span></div>
  </div>`;

  const scheme = root.querySelector<HTMLCanvasElement>('#loomScheme')!;
  const sctx = scheme.getContext('2d')!;
  const fabWrap = root.querySelector<HTMLDivElement>('#loomFabWrap')!;
  const fabCanvas = root.querySelector<HTMLCanvasElement>('#loomFabric')!;
  const fctx = fabCanvas.getContext('2d')!;
  const runBtn = root.querySelector<HTMLButtonElement>('#loomRun')!;
  const doneBtn = root.querySelector<HTMLButtonElement>('#loomDone')!;
  const bar = root.querySelector<HTMLDivElement>('#loomBar')!;
  const pct = root.querySelector<HTMLSpanElement>('#loomPct')!;
  const speedSel = root.querySelector<HTMLSelectElement>('#loomSpeed')!;

  // 重新上机:清空布面从头织
  const fc: FaceCanvas = makeFaceCanvas(spec);
  work.face = new Uint8Array(W * P);
  work.wovenPicks = 0;
  work.mismatch = null;
  work.floats = null;

  let running = false;
  let raf = 0;
  let shuttleX = 0; // 梭子动画位置 0..1

  function updateDone(): void {
    const done = work.wovenPicks >= P;
    doneBtn.disabled = !done;
    if (done) { running = false; runBtn.textContent = '开织'; }
  }

  // ---------------- 花楼机示意 ----------------
  function drawScheme(): void {
    const w = scheme.width, h = scheme.height;
    if (w === 0) return;
    const p = Math.min(work.wovenPicks, P - 1);
    sctx.clearRect(0, 0, w, h);
    // 楼与花本帘
    sctx.fillStyle = '#2a2118';
    sctx.fillRect(0, 0, w, 10);
    sctx.fillStyle = '#241c12';
    sctx.fillRect(0, 10, w, 46);
    // 抽样经线
    const N = Math.min(W, 160);
    const step = W / N;
    const x0 = 30, x1 = w - 30;
    const kx = (i: number) => x0 + (x1 - x0) * i / (N - 1);
    // 花本上的结(当前纬)
    sctx.fillStyle = '#d8c9a8';
    sctx.font = '10px sans-serif';
    sctx.fillText(`花本·第 ${p + 1} 纬`, 6, 20);
    for (let i = 0; i < N; i++) {
      const wi = Math.min(W - 1, Math.floor(i * step));
      const knot = work.knots[p * W + wi] === 1;
      const x = kx(i);
      // 耳子线
      sctx.strokeStyle = knot ? '#e0b040' : 'rgba(200,180,140,0.35)';
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(x, 14);
      sctx.lineTo(x, 56);
      sctx.stroke();
      if (knot) {
        sctx.fillStyle = '#e0b040';
        sctx.beginPath();
        sctx.arc(x, 34, 2.5, 0, 7);
        sctx.fill();
      }
    }
    // 综丝与经面:结者下沉开口
    const shedY = 96, fabY = h - 26;
    for (let i = 0; i < N; i++) {
      const wi = Math.min(W - 1, Math.floor(i * step));
      const knot = work.knots[p * W + wi] === 1;
      const x = kx(i);
      const dip = knot ? 16 : 0;
      sctx.strokeStyle = knot ? '#c9a86a' : '#8a7a5c';
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(x, 56);          // 综眼
      sctx.lineTo(x, shedY + dip); // 经面(开口)
      sctx.lineTo(x, fabY);        // 到织口
      sctx.stroke();
    }
    // 梭子(来回)
    const dir = p % 2 === 0 ? 1 : -1;
    const sx = dir > 0 ? x0 + (x1 - x0) * shuttleX : x1 - (x1 - x0) * shuttleX;
    const weftColor = spec.palette[spec.shuttles[work.weftSeq[p] % spec.shuttles.length]];
    sctx.fillStyle = weftColor;
    sctx.beginPath();
    sctx.ellipse(sx, shedY + 8, 12, 4, 0, 0, 7);
    sctx.fill();
    sctx.strokeStyle = '#3a2c1a';
    sctx.stroke();
    // 织口与卷布
    sctx.strokeStyle = '#d8c9a8';
    sctx.beginPath(); sctx.moveTo(x0 - 8, fabY); sctx.lineTo(x1 + 8, fabY); sctx.stroke();
    sctx.fillStyle = '#3a2c1a';
    sctx.fillRect(x0 - 14, h - 18, x1 - x0 + 28, 10);
    sctx.fillStyle = '#d8c9a8';
    sctx.fillText('织口', 6, fabY + 4);
  }

  // ---------------- 布面显示 ----------------
  function drawFabric(): void {
    const r = fabWrap.getBoundingClientRect();
    if (fabCanvas.width !== (r.width | 0)) { fabCanvas.width = r.width | 0; fabCanvas.height = r.height | 0; }
    const cw = fabCanvas.width, ch = fabCanvas.height;
    fctx.fillStyle = '#100d09';
    fctx.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / W, ch / P);
    const dw = W * s, dh = P * s;
    fctx.imageSmoothingEnabled = false;
    fctx.drawImage(fc.canvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    // 织到哪儿了
    const y = (ch - dh) / 2 + work.wovenPicks * s;
    fctx.strokeStyle = 'rgba(255,90,60,0.9)';
    fctx.beginPath();
    fctx.moveTo((cw - dw) / 2, y);
    fctx.lineTo((cw + dw) / 2, y);
    fctx.stroke();
  }

  function updateProgress(): void {
    const pc = work.wovenPicks / P * 100;
    bar.style.width = pc + '%';
    pct.textContent = `${work.wovenPicks} / ${P} 纬`;
  }

  // ---------------- 主循环 ----------------
  function frame(): void {
    if (!running) return;
    const speed = parseInt(speedSel.value) || 1;
    const p0 = work.wovenPicks;
    const n = Math.min(speed, P - p0);
    for (let i = 0; i < n; i++) {
      const p = p0 + i;
      weavePick(spec, work.knots, work.weftSeq, p, work.face!);
      writePickPixels(fc, work.face!, W, p);
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

  runBtn.addEventListener('click', () => {
    if (work.wovenPicks >= P) { // 重织
      work.wovenPicks = 0;
      fc.u32.fill(0);
      fc.ctx.putImageData(fc.img, 0, 0);
    }
    running = !running;
    runBtn.textContent = running ? '停' : '开织';
    if (running) raf = requestAnimationFrame(frame);
  });
  root.querySelector('#loomInstant')!.addEventListener('click', () => {
    running = false;
    weaveAll(spec, work.knots, work.weftSeq, work.face!);
    fillFace(fc, work.face!);
    flushAll(fc);
    work.wovenPicks = P;
    drawScheme(); drawFabric(); updateProgress(); updateDone();
  });
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-nav]'))
    b.addEventListener('click', () => { location.hash = b.dataset.nav!; });

  const ro = new ResizeObserver(() => {
    const r = (root.querySelector('.loom-top') as HTMLElement).getBoundingClientRect();
    scheme.width = r.width | 0; scheme.height = r.height | 0;
    drawScheme(); drawFabric();
  });
  ro.observe(root.querySelector('.loom-top')!);
  ro.observe(fabWrap);

  drawScheme(); drawFabric(); updateProgress();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
