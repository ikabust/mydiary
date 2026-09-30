// 日付の初期設定
let currentDate = new Date();
let selectedDateStr = formatDate(new Date());
let currentImages = []; // 圧縮済み Base64 文字列配列

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

// "YYYY-MM-DD" から安全に Date オブジェクトを生成（タイムゾーンずれ防止）
function parseDateStr(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// イベントリスナー設定
function setupEventListeners() {
  // 月移動のバグを防ぐため、1日をセットしてから移動
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setDate(1);
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
  if (!container) return;
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

  // 保存済みのキー一覧を取得
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
      // スムーズスクロールでフォームへ移動
      const formSection = document.getElementById('form-section');
      if (formSection) formSection.scrollIntoView({ behavior: 'smooth' });
    });

    grid.appendChild(dayEl);
  }
}

// 写真の圧縮＆読み込み処理（Promise化して正確に完了を待機）
async function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  try {
    const uploadPromises = files.map(file => compressImage(file, 800, 0.75));
    const newBase64Images = await Promise.all(uploadPromises);
    
    currentImages.push(...newBase64Images);
    renderImagePreviews();
  } catch (err) {
    console.error('画像処理エラー:', err);
    alert('画像の処理中にエラーが発生しました。');
  } finally {
    e.target.value = ''; // 次回同じファイルを選べるようにリセット
  }
}

// Canvasを使った画像リサイズ・圧縮関数（Promise形式・向き自動補正対応）
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEGフォーマットで指定品質にて圧縮
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.src = e.target.result;
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

    const img = document.createElement('img');
    img.src = src;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-img';
    removeBtn.innerText = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      removeImage(index);
    });

    item.appendChild(img);
    item.appendChild(removeBtn);
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
    setEmojiValue('mood-selector', entry.mood || '');
    setEmojiValue('weather-selector', entry.weather || '');
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

  try {
    await localforage.setItem(selectedDateStr, data);
    alert('日記を保存しました！');
    await renderCalendar();
    await renderEntryList();
  } catch (err) {
    alert('保存に失敗しました。容量を超えている可能性があります。');
    console.error(err);
  }
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
  // 日付文字列 (YYYY-MM-DD) は文字コードソートで降順（新しい順）
  keys.sort().reverse();

  if (keys.length === 0) {
    container.innerHTML = '<p style="color: var(--muted, #888); font-size: 0.85rem;">まだ日記がありません。</p>';
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
      ${imgsHtml ? `<div class="entry-images">${imgsHtml}</div>` : ''}
    `;

    card.addEventListener('click', () => {
      selectedDateStr = entry.date;
      currentDate = parseDateStr(entry.date);
      renderCalendar();
      loadEntryForm(selectedDateStr);
      const formSection = document.getElementById('form-section');
      if (formSection) formSection.scrollIntoView({ behavior: 'smooth' });
    });

    container.appendChild(card);
  }
}

function escapeHtml(str) {
  return str
    .replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
    .replace(/\n/g, '<br>');
}