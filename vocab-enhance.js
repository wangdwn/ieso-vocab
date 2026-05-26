/**
 * 增强功能：卡片学习模式 + 进度追踪 + 收藏
 * 注入到现有网站中，不破坏原有功能
 */

// ===== localStorage 工具 =====
const DB = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem('vocab_'+key)) || def; }
    catch { return def; }
  },
  set(key, val) {
    localStorage.setItem('vocab_'+key, JSON.stringify(val));
  },
  // 今日进度
  getToday() {
    const d = new Date().toDateString();
    const data = this.get('days', {});
    if (!data[d]) data[d] = { learned: [], quizzed: [], correct: 0, wrong: 0, streak: 0 };
    return data[d];
  },
  saveToday(today) {
    const d = new Date().toDateString();
    const data = this.get('days', {});
    data[d] = today;
    // 计算连续打卡
    const streak = this.calcStreak(data);
    today.streak = streak;
    this.set('days', data);
    this.set('streak', streak);
  },
  calcStreak(data) {
    let streak = 0;
    let d = new Date();
    while (true) {
      const key = d.toDateString();
      const day = data[key];
      if (day && day.learned && day.learned.length >= 5) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  },
  // 收藏
  getFavorites() { return this.get('favs', []); },
  toggleFavorite(word) {
    let favs = this.getFavorites();
    const idx = favs.indexOf(word);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(word);
    this.set('favs', favs);
    return favs;
  },
  isFavorite(word) { return this.getFavorites().includes(word); }
};

// ===== 学习模式界面 =====
function enterStudyMode(rootKey) {
  const root = vocabData.roots[rootKey];
  if (!root || !root.words || root.words.length === 0) return;
  
  const words = [...root.words];
  currentStudyRoot = rootKey;
  studyWords = shuffleArray(words);
  studyIndex = 0;
  
  // 渲染学习界面
  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('detail-panel');
  overlay.classList.add('show');
  panel.classList.remove('open');
  
  // 创建学习面板
  let studyEl = document.getElementById('study-panel');
  if (!studyEl) {
    studyEl = document.createElement('div');
    studyEl.id = 'study-panel';
    studyEl.className = 'study-panel';
    document.body.appendChild(studyEl);
  }
  studyEl.classList.add('open');
  
  renderStudyCard();
}

function closeStudy() {
  const el = document.getElementById('study-panel');
  if (el) el.classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

let studyWords = [];
let studyIndex = 0;
let currentStudyRoot = null;
let studyFlipped = false;

function renderStudyCard() {
  const el = document.getElementById('study-panel');
  if (!el || studyWords.length === 0) return;
  
  const w = studyWords[studyIndex];
  const total = studyWords.length;
  const progress = ((studyIndex + 1) / total * 100).toFixed(0);
  const today = DB.getToday();
  const isFav = DB.isFavorite(w.word);
  
  // 收集已学单词
  if (!today.learned.includes(w.word)) {
    today.learned.push(w.word);
    DB.saveToday(today);
  }
  
  el.innerHTML = `
    <div class="study-header">
      <div class="study-header-left">
        <button class="study-btn" onclick="closeStudy()">← 返回</button>
        <span class="study-title">📖 ${currentStudyRoot}</span>
      </div>
      <div class="study-header-right">
        <span class="study-progress-text">${studyIndex+1}/${total}</span>
        <div class="study-streak">🔥 ${today.streak || DB.get('streak', 0)}天</div>
      </div>
    </div>
    <div class="study-progress-bar">
      <div class="study-progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="study-card" onclick="flipStudyCard()">
      <div class="study-card-inner ${studyFlipped ? 'flipped' : ''}">
        <div class="study-card-front">
          <div class="study-word">${w.word}</div>
          ${w.phonetic ? `<div class="study-phonetic">${w.phonetic}</div>` : ''}
          <div class="study-tap-hint">👆 点击翻转查看释义</div>
        </div>
        <div class="study-card-back">
          <div class="study-word">${w.word}</div>
          <div class="study-phonetic">${w.phonetic || ''}</div>
          <div class="study-meaning">${w.meaning}</div>
          ${w.example ? `<div class="study-example">${w.example}</div>` : ''}
          <div class="study-freq-tag">${freqMap[w.freq] || '中频'}</div>
        </div>
      </div>
    </div>
    <div class="study-actions">
      <button class="study-btn study-btn-fav ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleStudyFav('${w.word}')">
        ${isFav ? '⭐' : '☆'} 收藏
      </button>
      <div class="study-nav">
        ${studyIndex > 0 ? `<button class="study-btn study-btn-nav" onclick="event.stopPropagation();prevStudyCard()">← 上一个</button>` : ''}
        <button class="study-btn study-btn-primary" onclick="event.stopPropagation();nextStudyCard()">知道了 →</button>
      </div>
    </div>
  `;
}

function flipStudyCard() {
  studyFlipped = !studyFlipped;
  renderStudyCard();
}

function nextStudyCard() {
  if (studyIndex < studyWords.length - 1) {
    studyIndex++;
    studyFlipped = false;
    renderStudyCard();
  } else {
    // 学习完成！
    const el = document.getElementById('study-panel');
    const today = DB.getToday();
    today.correct += studyWords.length;
    DB.saveToday(today);
    el.innerHTML = `
      <div class="study-header">
        <div class="study-header-left">
          <button class="study-btn" onclick="closeStudy()">← 返回</button>
          <span class="study-title">🎉 完成！</span>
        </div>
        <div class="study-header-right">
          <span class="study-streak">🔥 ${today.streak || DB.get('streak', 0)}天连击</span>
        </div>
      </div>
      <div class="study-complete">
        <div class="study-complete-icon">🎉</div>
        <div class="study-complete-title">${currentStudyRoot} 学习完成！</div>
        <div class="study-complete-stats">
          <span>📚 学习了 ${studyWords.length} 个单词</span>
          <span>🔥 连续打卡 ${today.streak || DB.get('streak', 0)} 天</span>
        </div>
        <button class="study-btn study-btn-primary" onclick="closeStudy()">返回词根</button>
      </div>
    `;
  }
}

function prevStudyCard() {
  if (studyIndex > 0) {
    studyIndex--;
    studyFlipped = false;
    renderStudyCard();
  }
}

function toggleStudyFav(word) {
  DB.toggleFavorite(word);
  renderStudyCard();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== 在词根详情卡片里加"开始学习"按钮 =====
// 修改 showRoot 函数
const originalShowRoot = window.showRoot;
window.showRoot = function(key) {
  originalShowRoot(key);
  // 等详情面板渲染后，在头部添加"开始学习"按钮
  setTimeout(() => {
    const header = document.getElementById('panel-header');
    if (header && !header.querySelector('.study-start-btn')) {
      const btn = document.createElement('button');
      btn.className = 'study-start-btn';
      btn.textContent = '🎯 开始学习';
      btn.onclick = function(e) {
        e.stopPropagation();
        enterStudyMode(key);
      };
      header.appendChild(btn);
    }
  }, 50);
};

// ===== 在导航栏添加收藏和进度入口 =====
function addNavButtons() {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;
  
  const favBtn = document.createElement('a');
  favBtn.textContent = '⭐ 收藏';
  favBtn.onclick = showFavorites;
  nav.insertBefore(favBtn, nav.lastElementChild);
  
  const progBtn = document.createElement('a');
  progBtn.textContent = '📊 进度';
  progBtn.onclick = showProgress;
  nav.insertBefore(progBtn, nav.lastElementChild);
}

// ===== 收藏页面 =====
function showFavorites() {
  const favs = DB.getFavorites();
  const roots = vocabData.roots;
  
  // 从所有词根中找到收藏的单词
  let favWords = [];
  Object.keys(roots).forEach(key => {
    roots[key].words.forEach(w => {
      if (favs.includes(w.word)) {
        favWords.push({...w, root: key, rootMeaning: roots[key].meaning});
      }
    });
  });
  
  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('detail-panel');
  
  // 临时复用详情面板
  document.getElementById('panel-header').innerHTML = `
    <span class="emoji">⭐</span>
    <div class="root-name">我的收藏</div>
    <div class="root-meaning">共 ${favWords.length} 个单词</div>
  `;
  
  const freqMap = {high:'高频', mid:'中频', low:'低频'};
  if (favWords.length === 0) {
    document.getElementById('word-list').innerHTML = '<div class="empty-state"><div class="icon">⭐</div>还没有收藏单词<br>在卡片学习中点击 ☆ 收藏</div>';
  } else {
    document.getElementById('word-list').innerHTML = favWords.map((w, idx) => `
      <div class="word-item">
        <div><span class="word">${w.word}</span>
        <span class="phonetic">${w.phonetic||''}</span>
        <span class="freq-badge freq-${w.freq}">${freqMap[w.freq]||'中频'}</span></div>
        <div class="meaning">${w.meaning} <span style="font-size:11px;color:var(--text-tertiary);">· ${w.root}: ${w.rootMeaning}</span></div>
      </div>
    `).join('');
  }
  
  panel.classList.add('open');
  overlay.classList.add('show');
}

// ===== 进度页面 =====
function showProgress() {
  const days = DB.get('days', {});
  const streak = DB.get('streak', 0);
  const favs = DB.getFavorites();
  
  const today = DB.getToday();
  const totalLearned = Object.values(days).reduce((sum, d) => sum + (d.learned?.length || 0), 0);
  
  // 最近7天
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const day = days[key];
    weekDays.push({
      label: d.toLocaleDateString('zh-CN', {weekday:'short'}),
      count: day?.learned?.length || 0,
      active: !!day
    });
  }
  
  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('detail-panel');
  
  document.getElementById('panel-header').innerHTML = `
    <span class="emoji">📊</span>
    <div class="root-name">学习进度</div>
    <div class="root-meaning">🔥 连续打卡 ${streak} 天</div>
  `;
  
  document.getElementById('word-list').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num">${totalLearned}</div><div class="stat-label">累计学习</div></div>
      <div class="stat-card"><div class="stat-num">${favs.length}</div><div class="stat-label">收藏单词</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(days).length}</div><div class="stat-label">学习天数</div></div>
      <div class="stat-card"><div class="stat-num">${streak}</div><div class="stat-label">最长连击</div></div>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">本周打卡</div>
    <div style="display:flex;gap:8px;justify-content:space-between;">
      ${weekDays.map(d => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
            background:${d.active ? 'var(--accent)' : 'rgba(0,0,0,0.05)'};
            color:${d.active ? '#fff' : 'var(--text-tertiary)'};
            font-size:12px;font-weight:600;">
            ${d.count > 0 ? d.count : (d.active ? '✓' : '')}
          </div>
          <span style="font-size:10px;color:var(--text-tertiary);">${d.label}</span>
        </div>
      `).join('')}
    </div>
    ${streak >= 3 ? '<div style="margin-top:16px;padding:12px;background:rgba(255,159,10,0.1);border-radius:12px;font-size:13px;color:#ff9f0a;text-align:center;">🔥 已连续打卡 ' + streak + ' 天，继续保持！</div>' : ''}
  `;
  
  panel.classList.add('open');
  overlay.classList.add('show');
}

// ===== 注入CSS =====
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
/* ===== 学习面板 ===== */
.study-panel {
  position: fixed; top: var(--nav-height); left: 0; right: 0; bottom: 0;
  background: var(--bg); z-index: 60;
  transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.25,0.1,0.25,1);
  overflow-y: auto; padding: 20px 24px 40px;
}
.study-panel.open { transform: translateY(0); }

.study-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; max-width: 520px; margin-left: auto; margin-right: auto;
}
.study-header-left { display: flex; align-items: center; gap: 12px; }
.study-header-right { display: flex; align-items: center; gap: 12px; }
.study-title { font-size: 16px; font-weight: 700; }
.study-progress-text { font-size: 13px; color: var(--text-secondary); }
.study-streak { font-size: 12px; color: #ff9f0a; font-weight: 600; }

.study-progress-bar {
  height: 4px; background: rgba(0,0,0,0.06); border-radius: 2px;
  max-width: 520px; margin: 0 auto 24px; overflow: hidden;
}
.study-progress-fill {
  height: 100%; background: var(--accent); border-radius: 2px;
  transition: width 0.3s ease;
}

/* 卡片 */
.study-card {
  perspective: 1000px; cursor: pointer;
  max-width: 400px; margin: 0 auto 24px;
  min-height: 280px;
}
.study-card-inner {
  position: relative; width: 100%; min-height: 280px;
  transition: transform 0.5s cubic-bezier(0.25,0.1,0.25,1);
  transform-style: preserve-3d;
}
.study-card-inner.flipped { transform: rotateY(180deg); }

.study-card-front, .study-card-back {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 40px 32px;
  border-radius: 20px;
  backface-visibility: hidden;
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-hover);
  min-height: 280px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.study-card-back { transform: rotateY(180deg); }

.study-word { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
.study-phonetic { font-size: 16px; color: var(--text-tertiary); font-family: 'Inter','Menlo',monospace; margin-bottom: 16px; }
.study-meaning { font-size: 22px; font-weight: 500; color: var(--text-secondary); margin-bottom: 12px; text-align: center; }
.study-example { font-size: 13px; color: var(--text-tertiary); font-style: italic; text-align: center; padding: 8px 12px; background: rgba(0,113,227,0.04); border-radius: 8px; }
.study-tap-hint { font-size: 12px; color: var(--text-tertiary); margin-top: 24px; animation: pulse 2s infinite; }
.study-freq-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: rgba(0,113,227,0.1); color: var(--accent); margin-top: 8px; }
@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

/* 操作按钮 */
.study-actions {
  max-width: 400px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 12px;
}
.study-nav {
  display: flex; gap: 12px; justify-content: center;
}
.study-btn {
  padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.06);
  background: var(--card-bg); backdrop-filter: blur(10px);
  font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text);
  transition: all 0.2s; font-family: inherit;
}
.study-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
.study-btn-primary {
  background: var(--accent); color: #fff; border-color: var(--accent);
  padding: 10px 28px; font-size: 15px;
}
.study-btn-primary:hover { background: var(--accent-hover); }
.study-btn-fav.active { color: #ff9f0a; border-color: #ff9f0a; }
.study-btn-nav { font-size: 13px; }

/* 完成页 */
.study-complete {
  text-align: center; padding: 60px 24px;
}
.study-complete-icon { font-size: 64px; margin-bottom: 16px; }
.study-complete-title { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
.study-complete-stats {
  display: flex; flex-direction: column; gap: 8px;
  font-size: 15px; color: var(--text-secondary); margin-bottom: 32px;
}

/* 进度统计卡片 */
.stat-card {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 12px; padding: 16px; text-align: center;
  backdrop-filter: blur(10px);
}
.stat-num { font-size: 28px; font-weight: 800; background: linear-gradient(135deg,#0071e3,#40a9ff); -webkit-background-clip:text; -webkit-text-fill-color: transparent; background-clip: text; }
.stat-label { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

/* 词根详情里的学习按钮 */
.study-start-btn {
  display: inline-block; margin-top: 12px; padding: 8px 20px;
  background: var(--accent); color: #fff; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.study-start-btn:hover { background: var(--accent-hover); transform: translateY(-1px); }

@media(max-width:768px) {
  .study-word { font-size: 28px; }
  .study-meaning { font-size: 18px; }
  .study-card-front, .study-card-back { padding: 28px 20px; min-height: 240px; }
  .study-panel { padding: 16px; }
}
`;
  document.head.appendChild(style);
}

// ===== 启动 =====
function enhanceVocabApp() {
  // 等待原数据加载完成
  const check = setInterval(() => {
    if (window.vocabData && vocabData) {
      clearInterval(check);
      injectStyles();
      addNavButtons();
    }
  }, 200);
  
  // 定义全局函数
  window.enterStudyMode = enterStudyMode;
  window.closeStudy = closeStudy;
  window.flipStudyCard = flipStudyCard;
  window.nextStudyCard = nextStudyCard;
  window.prevStudyCard = prevStudyCard;
  window.toggleStudyFav = toggleStudyFav;
  window.showFavorites = showFavorites;
  window.showProgress = showProgress;
  window.freqMap = {high:'高频', mid:'中频', low:'低频'};
}

// 在页面加载完成后执行
if (document.readyState === 'complete') {
  enhanceVocabApp();
} else {
  window.addEventListener('load', enhanceVocabApp);
}
