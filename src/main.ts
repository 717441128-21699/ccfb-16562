// ============================================================
// 入口:hash 路由
//   #/levels      关卡选择
//   #/edit/{id}   挑花结本
//   #/loom/{id}   织机
//   #/result/{id} 织物成品
// ============================================================
import { mountLevels } from './levelsPage.js';
import { mountEditor } from './editor.js';
import { mountLoom } from './loom.js';
import { mountResult } from './result.js';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  if (cleanup) { cleanup(); cleanup = null; }
  const hash = location.hash || '#/levels';
  const parts = hash.slice(2).split('/');
  const page = parts[0] || 'levels';
  const id = parts[1] || '';
  try {
    if (page === 'edit') cleanup = mountEditor(app, id);
    else if (page === 'loom') cleanup = mountLoom(app, id);
    else if (page === 'result') cleanup = mountResult(app, id);
    else cleanup = mountLevels(app);
  } catch (err) {
    console.error(err);
    location.hash = '#/levels';
  }
}

window.addEventListener('hashchange', route);
route();
