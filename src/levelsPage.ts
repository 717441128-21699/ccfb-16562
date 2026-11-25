// ============================================================
// 关卡选择页:纹样缩略图 + 规格 + 星级
// ============================================================
import { GROUND_NAMES, weaveAll } from './weave.js';
import { LEVELS, getStars } from './state.js';
import { makeFaceCanvas, fillFace, flushAll } from './render.js';

export function mountLevels(root: HTMLElement): () => void {
  const stars = getStars();
  root.innerHTML = `
  <div class="page levels">
    <header class="hero">
      <h1>花楼织锦</h1>
      <p>你是花楼机上的挑花匠。把意匠图上的纹样,一纬一纬挑成花本上的耳子线——
      织机照花本提综,织错一根,整幅花纹就错位。</p>
    </header>
    <div class="cards" id="lvCards"></div>
    <footer class="dim foot">
      规则:花本结到之处,彩纬浮于面上显花;未结处由地综织出${GROUND_NAMES.plain}/${GROUND_NAMES.twill21}地组织。
      连续结子过长 → 纬浮勾丝;同样的纬(含左右镜像)只算一根耳子线。
    </footer>
  </div>`;

  const box = root.querySelector('#lvCards')!;
  LEVELS.forEach((lv, idx) => {
    const { spec } = lv;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <canvas class="thumb" width="240" height="150"></canvas>
      <div class="card-body">
        <div class="card-name">${lv.name} <span class="stars-sm">${'★'.repeat(stars[lv.id] || 0)}</span></div>
        <div class="dim">${lv.subtitle}</div>
        <div class="dim spec">${spec.warps}经 × ${spec.picks}纬 · ${GROUND_NAMES[spec.ground]} · 纬浮≤${spec.floatLimit} · ${spec.shuttles.length}梭${spec.shuttleEditable ? '(可换)' : ''}</div>
        <div class="dim">耳子线基准 ${lv.par}</div>
      </div>`;
    card.addEventListener('click', () => { location.hash = `#/edit/${lv.id}`; });
    box.appendChild(card);
    // 缩略图(异步,避免大卡阻塞)
    const thumb = card.querySelector<HTMLCanvasElement>('canvas')!;
    setTimeout(() => {
      const fc = makeFaceCanvas(spec);
      const face = new Uint8Array(spec.warps * spec.picks);
      weaveAll(spec, lv.design.knots, lv.design.weftSeq, face);
      fillFace(fc, face);
      flushAll(fc);
      const tctx = thumb.getContext('2d')!;
      tctx.imageSmoothingEnabled = false;
      tctx.fillStyle = '#100d09';
      tctx.fillRect(0, 0, thumb.width, thumb.height);
      const s = Math.min(thumb.width / spec.warps, thumb.height / spec.picks);
      tctx.drawImage(fc.canvas,
        (thumb.width - spec.warps * s) / 2, (thumb.height - spec.picks * s) / 2,
        spec.warps * s, spec.picks * s);
    }, idx * 30);
  });

  return () => { /* 无监听需清理 */ };
}
