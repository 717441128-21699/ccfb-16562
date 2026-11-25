// ============================================================
// 织物成品页:布面展示、纬浮与错位标记、评分定星
// ============================================================
import {
  weaveAll, detectFloats, compareWithDesign, countEarThreads, GROUND_NAMES,
} from './weave.js';
import { Work, getWork, setStars, LEVELS } from './state.js';
import { makeFaceCanvas, fillFace, flushAll } from './render.js';

export function mountResult(root: HTMLElement, levelId: string): () => void {
  const work = getWork(levelId);
  const level = work.level;
  const { spec, design } = level;
  const W = spec.warps, P = spec.picks;

  // 未织或没织完 → 立即织完
  if (!work.face || work.wovenPicks < P) {
    if (!work.face) work.face = new Uint8Array(W * P);
    weaveAll(spec, work.knots, work.weftSeq, work.face);
    work.wovenPicks = P;
  }
  // 评判
  work.floats = new Uint8Array(W * P);
  work.floatSegments = detectFloats(spec, work.knots, work.floats);
  work.mismatch = new Uint8Array(W * P);
  const cmp = compareWithDesign(spec, design, work.knots, work.weftSeq, work.mismatch);
  work.errors = cmp.errors;
  work.matchTotal = cmp.total;
  work.earThreads = countEarThreads(work.knots, W, P);

  const matchPct = (1 - work.errors / Math.max(1, work.matchTotal)) * 100;
  const passed = work.errors === 0;
  const stars = !passed ? 0 : work.floatSegments > 0 ? 1 : work.earThreads > level.par ? 2 : 3;
  setStars(level.id, stars);

  const next = LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];

  root.innerHTML = `
  <div class="page result">
    <header class="bar">
      <button class="btn" data-nav="#/edit/${level.id}">‹ 回挑花修改</button>
      <div class="bar-title"><b>${level.name}</b><span class="dim">织物成品 · ${W}经 × ${P}纬 · ${GROUND_NAMES[spec.ground]}</span></div>
      <label class="chk"><input type="checkbox" id="rsFloat" checked> 纬浮超标</label>
      <label class="chk"><input type="checkbox" id="rsMiss" checked> 错位</label>
      <button class="btn" data-nav="#/loom/${level.id}">重新上机</button>
      ${next ? `<button class="btn primary" data-nav="#/edit/${next.id}">下一关:${next.name} ›</button>` : ''}
      <button class="btn" data-nav="#/levels">选关</button>
    </header>
    <div class="rs-main">
      <div class="rs-canvas-wrap" id="rsWrap"><canvas id="rsCanvas"></canvas></div>
      <aside class="rs-side">
        <div class="verdict ${passed ? 'pass' : 'fail'}">${passed ? '织成!' : '纹样未合'}</div>
        <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="grp">
          <div class="stat">纹样一致度 <b>${matchPct.toFixed(2)}%</b></div>
          <div class="stat ${work.errors ? 'bad' : ''}">错位点 <b>${work.errors}</b></div>
          <div class="stat ${work.floatSegments ? 'bad' : ''}">纬浮超标 <b>${work.floatSegments}</b> 段${work.floatSegments ? '(勾丝)' : ''}</div>
          <div class="stat ${work.earThreads > level.par ? 'warn' : ''}">耳子线 <b>${work.earThreads}</b> / 基准 ${level.par}</div>
        </div>
        <div class="grp">
          <div class="grp-t">定等</div>
          <div class="tip">★ 纹样全对(无一错位)</div>
          <div class="tip">★★ 且无纬浮勾丝</div>
          <div class="tip">★★★ 且耳子线不超基准</div>
        </div>
        <div class="grp" id="rsErrGrp">
          <div class="grp-t">错位所在纬(点击去修)</div>
          <div id="rsErrList" class="err-list"></div>
        </div>
      </aside>
    </div>
  </div>`;

  // ---------------- 布面与标记 ----------------
  const fc = makeFaceCanvas(spec);
  fillFace(fc, work.face);
  flushAll(fc);
  // 标记层(纬浮 / 错位 各一层,独立开关)
  const floatCanvas = document.createElement('canvas');
  floatCanvas.width = W; floatCanvas.height = P;
  const flctx = floatCanvas.getContext('2d')!;
  const flimg = flctx.createImageData(W, P);
  const flu = new Uint32Array(flimg.data.buffer);
  for (let i = 0; i < W * P; i++) if (work.floats[i]) flu[i] = 0xb000e0ff;
  flctx.putImageData(flimg, 0, 0);
  const missCanvas = document.createElement('canvas');
  missCanvas.width = W; missCanvas.height = P;
  const msctx = missCanvas.getContext('2d')!;
  const msimg = msctx.createImageData(W, P);
  const msu = new Uint32Array(msimg.data.buffer);
  for (let i = 0; i < W * P; i++) if (work.mismatch![i]) msu[i] = 0xff00c8ff;
  msctx.putImageData(msimg, 0, 0);

  const wrap = root.querySelector<HTMLDivElement>('#rsWrap')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#rsCanvas')!;
  const ctx = canvas.getContext('2d')!;
  const floatChk = root.querySelector<HTMLInputElement>('#rsFloat')!;
  const missChk = root.querySelector<HTMLInputElement>('#rsMiss')!;

  let z = 1, ox = 0, oy = 0, cw = 0, ch = 0;
  function fit(): void {
    z = Math.max(0.2, Math.min(cw / W, ch / P));
    ox = (W - cw / z) / 2;
    oy = (P - ch / z) / 2;
  }
  function render(): void {
    if (!cw) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#100d09';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(z, 0, 0, z, -ox * z, -oy * z);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fc.canvas, 0, 0);
    if (floatChk.checked) ctx.drawImage(floatCanvas, 0, 0);
    if (missChk.checked) ctx.drawImage(missCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  floatChk.addEventListener('change', render);
  missChk.addEventListener('change', render);

  let panning = false, px = 0, py = 0;
  canvas.addEventListener('mousedown', e => { panning = true; px = e.clientX; py = e.clientY; });
  const onMove = (e: MouseEvent): void => {
    if (!panning) return;
    ox -= (e.clientX - px) / z; oy -= (e.clientY - py) / z;
    px = e.clientX; py = e.clientY;
    ox = Math.min(W, Math.max(-W * 0.3, ox));
    oy = Math.min(P, Math.max(-P * 0.3, oy));
    render();
  };
  const onUp = (): void => { panning = false; };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const gx = mx / z + ox, gy = my / z + oy;
    z = Math.min(40, Math.max(0.2, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    ox = gx - mx / z; oy = gy - my / z;
    render();
  }, { passive: false });

  // ---------------- 错位列表 ----------------
  const errList = root.querySelector<HTMLDivElement>('#rsErrList')!;
  if (work.errors === 0) {
    root.querySelector('#rsErrGrp')!.remove();
  } else {
    const perPick = new Map<number, number>();
    for (let p = 0; p < P; p++) {
      let c = 0;
      const off = p * W;
      for (let w = 0; w < W; w++) if (work.mismatch![off + w]) c++;
      if (c) perPick.set(p, c);
    }
    let shown = 0;
    for (const [p, c] of perPick) {
      if (shown++ >= 40) {
        const more = document.createElement('div');
        more.className = 'dim';
        more.textContent = `…共 ${perPick.size} 纬有错位`;
        errList.appendChild(more);
        break;
      }
      const b = document.createElement('button');
      b.className = 'btn err-item';
      b.textContent = `第 ${p + 1} 纬 · ${c} 处`;
      b.addEventListener('click', () => {
        work.currentPick = p;
        location.hash = `#/edit/${level.id}`;
      });
      errList.appendChild(b);
    }
  }

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-nav]'))
    b.addEventListener('click', () => { location.hash = b.dataset.nav!; });

  let sized = false;
  const ro = new ResizeObserver(() => {
    const r = wrap.getBoundingClientRect();
    cw = Math.max(50, r.width | 0); ch = Math.max(50, r.height | 0);
    canvas.width = cw; canvas.height = ch;
    if (!sized) { sized = true; fit(); }
    render();
  });
  ro.observe(wrap);
  fit();
  render();

  return () => {
    ro.disconnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
}
