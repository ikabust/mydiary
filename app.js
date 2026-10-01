// 直近で削除した付箋のデータを一時保持する変数
let lastDeletedNote = null;
let lastDeletedPageIndex = null;
let toastTimer = null;

/* 付箋削除（元に戻す対応） */
function removeNote(id){
  const page = data.pages[currentPage];
  const targetNote = page.notes.find(n => n.id === id);
  if (!targetNote) return;

  // 削除前にバックアップを保持
  lastDeletedNote = JSON.parse(JSON.stringify(targetNote));
  lastDeletedPageIndex = currentPage;

  // データを削除
  page.notes = page.notes.filter(n => n.id !== id);
  save();
  render();

  // 「元に戻す」通知（トースト）を表示
  showUndoToast();
}

/* 削除した付箋を元に戻す */
function undoDelete(){
  if (!lastDeletedNote || lastDeletedPageIndex === null) return;
  
  // 対象のページが存在するか確認
  if (data.pages[lastDeletedPageIndex]) {
    data.pages[lastDeletedPageIndex].notes.push(lastDeletedNote);
    save();
    render();
  }

  // 変数をクリア
  lastDeletedNote = null;
  lastDeletedPageIndex = null;

  // トーストを非表示にする
  const toast = document.getElementById("undoToast");
  if (toast) toast.style.display = "none";
}

/* 「元に戻す」通知バーを表示 */
function showUndoToast(){
  let toast = document.getElementById("undoToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "undoToast";
    toast.style.cssText = `
      position: fixed;
      bottom: 75px;
      left: 50%;
      transform: translateX(-50%);
      background: #745247;
      color: #fff;
      padding: 10px 16px;
      border-radius: 20px;
      font-size: 13px;
      display: flex;
      gap: 12px;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 100;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <span>付箋を削除しました</span>
    <button type="button" onclick="undoDelete()" style="background:none; border:none; color:#f8d2bd; font-weight:bold; cursor:pointer; padding:0;">元に戻す ↩</button>
  `;
  toast.style.display = "flex";

  clearTimeout(toastTimer);
  // 5秒後に自動的に閉じる
  toastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
}

/* 付箋コピー（複製） */
function duplicateNote(noteData){
  const page = data.pages[currentPage];
  if (!page) return;

  const newId = generateUUID();
  const newNote = {
    ...JSON.parse(JSON.stringify(noteData)),
    id: newId,
    x: Math.min(pageElWidth() - 100, noteData.x + 15), // 少しずらして配置
    y: noteData.y + 15
  };

  page.notes.push(newNote);
  save();
  render();
}

// ページの幅を取得する補助関数
function pageElWidth() {
  const pageEl = pagesEl.children[currentPage] || pagesEl;
  return pageEl.getBoundingClientRect().width || 300;
}

/* 付箋を作る（コピーボタン追加版） */
function createNoteElement(pageEl, n){
  const el = document.createElement('div');
  el.className = 'sticky';
  el.dataset.id = n.id;
  el.style.background = n.color;
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';
  el.style.transform = `rotate(${n.rot}deg)`;
  el.innerHTML = `
    <button type="button" class="del" aria-label="削除">×</button>
    <textarea placeholder="ここに書く…"></textarea>
    <button type="button" class="copy" aria-label="コピー" title="複製">📋</button>
    <button type="button" class="rotate" aria-label="回転">↻</button>
  `;

  const ta = el.querySelector("textarea");
  ta.value = n.text;

  ta.addEventListener("input", () => {
    n.text = ta.value;
    save();
  });

  el.querySelector(".del").onclick = e => {
    e.stopPropagation();
    removeNote(n.id);
  };

  // コピーボタンの動作
  el.querySelector(".copy").onclick = e => {
    e.stopPropagation();
    duplicateNote(n);
  };

  el.querySelector(".rotate").onclick = e => {
    e.stopPropagation();
    n.rot = (Number(n.rot) + 2) % 8 - 4;
    save();
    render();
  };

  makeDraggable(el, n, pageEl);
  pageEl.appendChild(el);
}