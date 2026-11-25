// 冒烟测试:关卡生成、织造正确性、纬浮与耳子线、性能
import { buildLevels } from '../src/levels.js';
import {
  weaveAll, detectFloats, compareWithDesign, countEarThreads,
} from '../src/weave.js';

const levels = buildLevels();
console.log(`共 ${levels.length} 关`);
let fail = 0;

for (const lv of levels) {
  const { spec, design } = lv;
  const W = spec.warps, P = spec.picks;
  // 1) 照意匠图花本织 → 错位必须为 0
  const face = new Uint8Array(W * P);
  const t0 = performance.now();
  weaveAll(spec, design.knots, design.weftSeq, face);
  const tWeave = performance.now() - t0;
  const mm = new Uint8Array(W * P);
  const cmp = compareWithDesign(spec, design, design.knots, design.weftSeq, mm);
  // 2) 纬浮(自由行的关卡允许设计图上本身超标,由玩家开间丝)
  const fl = new Uint8Array(W * P);
  const t1 = performance.now();
  const floats = detectFloats(spec, design.knots, fl);
  const tFloat = performance.now() - t1;
  // 3) 耳子线
  const t2 = performance.now();
  const ear = countEarThreads(design.knots, W, P);
  const tEar = performance.now() - t2;
  const ok = cmp.errors === 0 && ear === lv.par;
  if (!ok) fail++;
  console.log(
    `${ok ? 'OK ' : 'BAD'} ${lv.id} ${lv.name} ${W}x${P} ` +
    `错位=${cmp.errors} 纬浮段=${floats} 耳子线=${ear}(基准${lv.par}) ` +
    `织=${tWeave.toFixed(1)}ms 浮检=${tFloat.toFixed(1)}ms 线数=${tEar.toFixed(1)}ms`,
  );
  // 4) 结子率合理性
  let ones = 0;
  for (let i = 0; i < W * P; i++) ones += design.knots[i];
  console.log(`    结子率 ${(ones / (W * P) * 100).toFixed(1)}%  自由行 ${design.free.reduce((a, b) => a + b, 0)} 格`);
}

// 5) 自由行规则:空花本应判错位;照图+自由行开间丝应全对且无纬浮
{
  const lv6 = levels[5];
  const { spec, design } = lv6;
  const W = spec.warps, P = spec.picks;
  const mm = new Uint8Array(W * P);
  const empty = new Uint8Array(W * P);
  const r1 = compareWithDesign(spec, design, empty, design.weftSeq, mm);
  const tied = design.knots.slice();
  for (let p = 0; p < P; p++)
    for (let w = 0; w < W; w++)
      if (design.free[p * W + w] && w % (spec.floatLimit + 1) === 0) tied[p * W + w] = 0;
  const r2 = compareWithDesign(spec, design, tied, design.weftSeq, mm);
  const fl = new Uint8Array(W * P);
  const f2 = detectFloats(spec, tied, fl);
  const ok = r1.errors > 0 && r2.errors === 0 && f2 === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'BAD'} 自由行: 空花本错位=${r1.errors}(应>0) 间丝后错位=${r2.errors}(应0) 纬浮=${f2}(应0)`);
}

// 6) 大关逐纬动画性能:每帧 16 纬的耗时
const lv7 = levels[levels.length - 1];
{
  const { spec, design } = lv7;
  const face = new Uint8Array(spec.warps * spec.picks);
  const t0 = performance.now();
  for (let p = 0; p < spec.picks; p += 16) {
    for (let q = p; q < Math.min(p + 16, spec.picks); q++)
      weaveAll(spec, design.knots, design.weftSeq, face); // 占位,真正逐纬在下面
    break;
  }
  // 真正逐纬:单纬耗时
  const { weavePick } = await import('../src/weave.js');
  const t1 = performance.now();
  for (let p = 0; p < spec.picks; p++) weavePick(spec, design.knots, design.weftSeq, p, face);
  const t2 = performance.now();
  console.log(`lv7 逐纬织 1000 纬共 ${(t2 - t1).toFixed(1)}ms(每帧16纬约 ${((t2 - t1) / 1000 * 16).toFixed(2)}ms/帧)`);
}

process.exit(fail ? 1 : 0);
