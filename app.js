// 日付の初期設定
let currentDate = new Date();
let selectedDateStr = formatDate(new Date());
let currentImages = []; // base64 strings

// PWA ServiceWorker登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await renderCalendar();
  await loadEntryForm(selectedDateStr);
  await renderEntryList();
});

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// イベントリスナー設定
function setupEventListeners() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  setupEmojiSelector('mood-selector');
  setupEmojiSelector('weather-selector');

  document.getElementById('image-input').addEventListener('change', handleImageUpload);
  document.getElementById('save-btn').addEventListener('click', saveEntry);
  document.getElementById('delete-btn').addEventListener('click', deleteEntry);
}

function setupEmojiSelector(id) {
  const container = document.getElementById(id);
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

function getEmojiValue(id) {
  const selected = document.querySelector(`#${id} button.selected`);
  return selected ? selected.dataset.val : '';
}

function setEmojiValue(id, val) {
  const buttons = document.querySelectorAll(`#${id} button`);
  buttons.forEach(b => {
    if (b.dataset.val === val) b.classList.add('selected');
    else b.classList.remove('selected');
  });
}

// カレンダー描画
async function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  document.getElementById('calendar-title').innerText = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const grid = document.getElementById('calendar-days');
  grid.innerHTML = '';

  // 全保存データを取得してマークを表示
  const keys = await localforage.keys();

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.innerText = d;

    if (dateStr === selectedDateStr) dayEl.classList.add('selected');
    if (keys.includes(dateStr)) dayEl.classList.add('has-entry');

    dayEl.addEventListener('click', () => {
      selectedDateStr = dateStr;
      renderCalendar();
      loadEntryForm(selectedDateStr);
    });

    grid.appendChild(dayEl);
  }
}

// 写真アップロード（Base64圧縮・保持）
function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImages.push(event.target.result);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreviews() {
  const container = document.getElementById('image-preview');
  container.innerHTML = '';
  currentImages.forEach((src, index) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    item.innerHTML = `
      <img src="${src}">
      <button class="remove-img" onclick="removeImage(${index})">✕</button>
    `;
    container.appendChild(item);
  });
}

function removeImage(index) {
  currentImages.splice(index, 1);
  renderImagePreviews();
}

// フォームの読み込み
async function loadEntryForm(dateStr) {
  document.getElementById('selected-date-text').innerText = `${dateStr.replace(/-/g, '/')} の日記`;
  const entry = await localforage.getItem(dateStr);

  if (entry) {
    setEmojiValue('mood-selector', entry.mood);
    setEmojiValue('weather-selector', entry.weather);
    document.getElementById('entry-text').value = entry.text || '';
    currentImages = entry.images || [];
    document.getElementById('delete-btn').style.display = 'block';
  } else {
    setEmojiValue('mood-selector', '');
    setEmojiValue('weather-selector', '');
    document.getElementById('entry-text').value = '';
    currentImages = [];
    document.getElementById('delete-btn').style.display = 'none';
  }
  renderImagePreviews();
}

// 保存処理
async function saveEntry() {
  const data = {
    date: selectedDateStr,
    mood: getEmojiValue('mood-selector'),
    weather: getEmojiValue('weather-selector'),
    text: document.getElementById('entry-text').value,
    images: currentImages,
    updatedAt: new Date().getTime()
  };

  await localforage.setItem(selectedDateStr, data);
  alert('日記を保存しました！');
  await renderCalendar();
  await renderEntryList();
}

// 削除処理
async function deleteEntry() {
  if (confirm('この日の日記を削除しますか？')) {
    await localforage.removeItem(selectedDateStr);
    await loadEntryForm(selectedDateStr);
    await renderCalendar();
    await renderEntryList();
  }
}

// 過去の日記一覧表示
async function renderEntryList() {
  const container = document.getElementById('entry-list');
  container.innerHTML = '';

  const keys = await localforage.keys();
  keys.sort().reverse(); // 新しい順

  if (keys.length === 0) {
    container.innerHTML = '<p style="color: var(--muted); font-size: 0.85rem;">まだ日記がありません。</p>';
    return;
  }

  for (const key of keys) {
    const entry = await localforage.getItem(key);
    if (!entry) continue;

    const card = document.createElement('div');
    card.className = 'entry-card';

    const imgsHtml = (entry.images || []).map(img => `<img src="${img}">`).join('');

    card.innerHTML = `
      <div class="entry-header">
        <span>${entry.date}</span>
        <span>${entry.mood || ''} ${entry.weather || ''}</span>
      </div>
      <div class="entry-body">${escapeHtml(entry.text || '')}</div>
      <div class="entry-images">${imgsHtml}</div>
    `;

    card.addEventListener('click', () => {
      selectedDateStr = entry.date;
      currentDate = new Date(entry.date);
      renderCalendar();
      loadEntryForm(selectedDateStr);
      document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
    });

    container.appendChild(card);
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}