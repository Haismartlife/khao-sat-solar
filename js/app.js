const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};
const SUN = '<svg class="sunmark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="8" fill="var(--sun)"/><g stroke="var(--sun)" stroke-width="2.4" stroke-linecap="round">' +
  Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${20 + Math.cos(a) * 12.5}" y1="${20 + Math.sin(a) * 12.5}" x2="${20 + Math.cos(a) * 17}" y2="${20 + Math.sin(a) * 17}"/>`; }).join('') + '</g></svg>';

const S = {
  ready: false, list: [], view: 'list', listMode: 'cards', q: '',
  cur: null, curId: null, dirty: false, saving: false, saveErr: '', lastSaved: 0,
  pending: {}, confirmDelete: false, busy: '',
};
const SESSION = Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const imgSrc = id => Store.url(id);

function newSurvey() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  const code = `KS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return { code, createdAt: Date.now(), updatedAt: Date.now(), v: { ngay_ks: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, vi_mode: 'manual' }, c: {}, x: {}, ph: {}, slots: {}, sig: {}, names: {}, calc: {}, ov: {} };
}
function allImageIds(s) {
  return [].concat(...Object.values(s.ph || {}).map(l => l.map(p => p.id)), Object.values(s.slots || {}).filter(Boolean).map(p => p.id), Object.values(s.sig || {}).filter(Boolean).map(p => p.id));
}

// ---------- khởi động ----------
(async function boot() {
  render();
  try { S.listMode = localStorage.getItem('ks_mode') || 'cards'; } catch (e) {}
  const ok = await Store.init(list => {
    S.list = list; S.ready = true;
    if (S.view === 'form' && S.curId && !S.dirty && !S.saving && Store.kind === 'artifact') {
      const remote = list.find(x => x._id === S.curId);
      if (remote && remote.updatedAt > (S.cur.updatedAt || 0) && remote._by !== SESSION) {
        S.cur = normalize(clone(remote));
        if (!document.activeElement || !document.activeElement.closest('#app input,#app textarea')) render();
        return;
      }
    }
    if (S.view === 'list') render();
  }, msg => { S.saveErr = msg; renderBar(); }).catch(() => false);
  S.ready = true; if (!ok) render();
})();
function normalize(s) { delete s._id; delete s._by; ['v', 'c', 'x', 'ph', 'slots', 'sig', 'names', 'calc', 'ov'].forEach(k => s[k] = s[k] || {}); if (!s.v.vi_mode) s.v.vi_mode = 'manual'; return s; }

// ---------- lưu ----------
let saveTimer = null;
function markDirty(rerenderBar = true) {
  S.dirty = true; S.cur.updatedAt = Date.now();
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 700);
  if (Store.kind === 'artifact') { try { localStorage.setItem('ks_draft_' + S.curId, JSON.stringify(S.cur)); } catch (e) {} }
  if (rerenderBar) renderBar();
}
async function save() {
  if (!Store.ok || !Store.canWrite || !S.cur) return;
  if (S.saving) { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); return; }
  S.saving = true; S.dirty = false; S.saveErr = ''; renderBar();
  const body = clone(S.cur); body._by = SESSION;
  try {
    await Store.save(S.curId, body); S.lastSaved = Date.now();
    try { localStorage.removeItem('ks_draft_' + S.curId); } catch (e) {}
  } catch (e) {
    S.dirty = true;
    if (e && e.code === 'readonly') S.saveErr = 'Bạn chỉ có quyền xem, không thể lưu.';
    else if (e && e.code === 'quota_exceeded' || e && e.name === 'QuotaExceededError') S.saveErr = 'Bộ nhớ đã đầy — xoá bớt hồ sơ cũ rồi thử lại.';
    else S.saveErr = 'Chưa lưu được — bấm "Lưu lại".';
  }
  S.saving = false; renderBar();
}
async function flush() { clearTimeout(saveTimer); if (S.dirty) await save(); while (S.saving) await new Promise(r => setTimeout(r, 150)); }

// ---------- ảnh ----------
let pickCtx = null;
// Chọn nguồn ảnh: chụp mới bằng camera hoặc lấy từ thư viện ảnh trên máy
function pick(ctx) {
  pickCtx = ctx;
  document.querySelector('.sheet')?.remove();
  const it = ctx.kind === 'item' ? ALL_ITEMS.find(i => i.k === ctx.k) : SLOTS.find(s => s.k === ctx.k);
  const title = ctx.kind === 'item' ? `${it.code}  ${it.l}` : `${it.n}  ${it.l}`;
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Thêm ảnh');
  sh.innerHTML = `<div class="sheet-in"><div class="sheet-t">Thêm ảnh · ${esc(title)}</div>
    <button type="button" class="sheet-b" data-src="cam">${ICON.cam}<span><b>Chụp ảnh</b><small>Mở camera sau của điện thoại</small></span></button>
    <button type="button" class="sheet-b" data-src="lib">${ICON.img}<span><b>Chọn từ thư viện</b><small>${ctx.kind === 'item' ? 'Chọn được nhiều ảnh một lần' : 'Chọn 1 ảnh có sẵn trên máy'}</small></span></button>
    <button type="button" class="btn" data-src="x" style="width:100%">Huỷ</button></div>`;
  document.body.appendChild(sh);
  sh.onclick = e => {
    const b = e.target.closest('[data-src]');
    if (!b) { if (e.target === sh) sh.remove(); return; }
    sh.remove();
    if (b.dataset.src === 'x') { pickCtx = null; return; }
    const el = b.dataset.src === 'cam' ? $('#filePick') : $('#fileLib');
    el.multiple = b.dataset.src === 'lib' && ctx.kind === 'item';
    el.value = ''; el.click();
  };
}
$('#filePick').addEventListener('change', e => handleFiles([...e.target.files], 'cam'));
$('#fileLib').addEventListener('change', e => handleFiles([...e.target.files], 'lib'));

async function processImage(file, stamp) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const max = 1600; const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
  if (stamp) {
    const fs = Math.max(14, Math.round(w / 48));
    g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
    const lines = stamp.split('\n'); const tw = Math.max(...lines.map(l => g.measureText(l).width));
    const pad = fs * .5, lh = fs * 1.3;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, h - lines.length * lh - pad * 2, tw + pad * 2, lines.length * lh + pad * 2);
    lines.forEach((l, i) => { g.fillStyle = i ? '#fff' : '#ffc94d'; g.fillText(l, pad, h - pad - (lines.length - 1 - i) * lh - fs * .25); });
  }
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .82));
  return { blob, w, h };
}
function stampFor(label, when) {
  const d = when ? new Date(when) : new Date(); const p = n => String(n).padStart(2, '0');
  const who = S.cur.v.ten_cty || S.cur.v.dai_dien || '';
  return `${label}\n${S.cur.code}${who ? ' · ' + who : ''} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function handleFiles(files, src) {
  if (!files.length || !pickCtx) return;
  const ctx = pickCtx; pickCtx = null;
  if (ctx.kind !== 'item') files = files.slice(0, 1);
  if (!Store.canUpload) { toast('Bạn cần quyền chỉnh sửa để tải ảnh lên.'); return; }
  for (const f of files) {
    const key = ctx.kind === 'item' ? ctx.k : ctx.kind + ':' + ctx.k;
    const tmp = { tmpId: Math.random().toString(36).slice(2), url: URL.createObjectURL(f), status: 'Đang xử lý…', file: f, ctx, src };
    (S.pending[key] = S.pending[key] || []).push(tmp); renderKey(ctx);
    await uploadOne(tmp, key);
  }
}
async function uploadOne(tmp, key) {
  const ctx = tmp.ctx;
  try {
    let label;
    if (ctx.kind === 'item') { const it = ALL_ITEMS.find(i => i.k === ctx.k); label = `${it.code}-${(S.cur.ph[ctx.k] || []).length + 1}  ${it.l}`; }
    else { const sl = SLOTS.find(s => s.k === ctx.k); label = `${sl.n}  ${sl.l}`; }
    const when = tmp.src === 'lib' && tmp.file.lastModified ? tmp.file.lastModified : null;
    const { blob, w, h } = await processImage(tmp.file, stampFor(label, when));
    tmp.status = 'Đang lưu ảnh…'; renderKey(ctx);
    const id = await Store.upload(blob, 'image/jpeg');
    const ref = { id, w, h, at: Date.now(), src: tmp.src || 'cam' };
    if (ctx.kind === 'item') (S.cur.ph[ctx.k] = S.cur.ph[ctx.k] || []).push(ref);
    else { const old = S.cur.slots[ctx.k]; S.cur.slots[ctx.k] = ref; if (old) Store.delImage(old.id); }
    S.pending[key] = (S.pending[key] || []).filter(p => p !== tmp);
    URL.revokeObjectURL(tmp.url); markDirty(); renderKey(ctx);
  } catch (e) {
    tmp.status = e && e.code === 'quota_or_state' ? 'Hết dung lượng' : e && e.code === 'too_large' ? 'Ảnh quá lớn' : 'Lỗi — chạm để thử lại';
    tmp.failed = true; renderKey(ctx);
  }
}
function removePhoto(k, i) { const ref = S.cur.ph[k][i]; S.cur.ph[k].splice(i, 1); markDirty(); renderKey({ kind: 'item', k }); if (ref) Store.delImage(ref.id); }
function removeSlot(k) { const ref = S.cur.slots[k]; delete S.cur.slots[k]; markDirty(); renderKey({ kind: 'slot', k }); if (ref) Store.delImage(ref.id); }

// ---------- xuất file ----------
function b64ToBuf(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function bufToB64(blob) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); }); }
async function loadImg(id) {
  try {
    const blob = await Store.getBlob(id); const bmp = await createImageBitmap(blob);
    return { base64: await bufToB64(blob), ext: /png/.test(blob.type) ? 'png' : 'jpeg', w: bmp.width, h: bmp.height };
  } catch (e) { return null; }
}
async function saveFile(filename, blob) {
  try { await Store.download(filename, blob); toast('Đã xuất ' + filename); }
  catch (e) { if (!e || e.code !== 'declined') toast(e && e.code === 'unavailable' ? 'Trình xem này không cho tải file.' : 'Không xuất được file.'); }
}
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const fileBase = () => `BM01_${S.cur.code}${S.cur.v.ten_cty ? '_' + slug(S.cur.v.ten_cty) : ''}`;
async function prepExport() { await commitPendingSigs(); await flush(); }
async function exportExcel() {
  setBusy('Đang tạo Excel…');
  try {
    await prepExport();
    const X = await Store.excel();
    const buf = await buildBM01(X, b64ToBuf(TEMPLATE_B64), S.cur, loadImg);
    setBusy(''); await saveFile(fileBase() + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (e) { toast('Không tạo được file Excel. ' + (Store.kind === 'artifact' ? 'Kiểm tra mạng rồi thử lại.' : '')); }
  setBusy('');
}
async function exportPDF() {
  setBusy('Đang tạo PDF…');
  try {
    await prepExport();
    const libs = await Store.pdfLibs();
    await Store.preload(allImageIds(S.cur));
    // dùng data: URL cho ảnh để html2canvas vẽ chắc chắn
    const urls = {};
    for (const id of allImageIds(S.cur)) { try { const b = await Store.getBlob(id); urls[id] = 'data:' + (b.type || 'image/jpeg') + ';base64,' + await bufToB64(b); } catch (e) {} }
    const blob = await buildPDF(S.cur, { src: id => urls[id] || imgSrc(id), logo: 'data:image/png;base64,' + LOGO_B64, html2canvas: libs.html2canvas, jsPDF: libs.jsPDF, onProgress: (i, n) => setBusy(`Đang tạo PDF… trang ${i}/${n}`) });
    setBusy(''); await saveFile(fileBase() + '.pdf', blob);
  } catch (e) { console.error(e); toast('Không tạo được PDF. ' + (Store.kind === 'artifact' ? 'Kiểm tra mạng rồi thử lại.' : '')); }
  setBusy('');
}
async function exportSummary() {
  try {
    const X = await Store.excel(); const buf = await buildSummary(X, S.list);
    const d = new Date(); await saveFile(`TongHop_KhaoSat_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.xlsx`, new Blob([buf]));
  } catch (e) { toast('Không tạo được bảng tổng hợp.'); }
}
function setBusy(t) { S.busy = t; renderBar(); }

// ---------- render chung ----------
function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 3200); }
function ring(p) { const r = 19, c = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 46 46" aria-label="Hoàn thành ${p}%"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--chip)" stroke-width="4"/><circle cx="23" cy="23" r="${r}" fill="none" stroke="${p >= 80 ? 'var(--ok)' : 'var(--sun)'}" stroke-width="4" stroke-dasharray="${c * p / 100} ${c}" transform="rotate(-90 23 23)" stroke-linecap="round"/><text x="23" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)" font-family="Archivo,sans-serif">${p}%</text></svg>`; }
function render() {
  const app = $('#app');
  if (S.view === 'form' && S.cur) { app.innerHTML = renderForm(); bindForm(); renderBar(); return; }
  $('.bar')?.remove(); app.innerHTML = renderList(); bindList();
}

// ---------- danh sách ----------
function renderList() {
  const q = S.q.trim().toLowerCase();
  const rows = S.list.filter(s => !q || [s.code, s.v?.ten_cty, s.v?.dai_dien, s.v?.dia_chi, s.v?.ks_chinh].join(' ').toLowerCase().includes(q));
  const now = new Date(); const mKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const thisMonth = S.list.filter(s => (s.v?.ngay_ks || '').startsWith(mKey)).length;
  const totalKwp = S.list.reduce((a, s) => a + (Number(s.v?.cs_de_xuat) || Number(s.v?.cs_mong_muon) || 0), 0);
  const ngay = ALL_ITEMS.find(i => i.k === 'ngay_ks');
  let body;
  if (!S.ready) body = `<div class="empty"><p class="note">Đang tải danh sách khảo sát…</p></div>`;
  else if (!Store.ok) body = `<div class="empty"><h2>Chưa mở được kho dữ liệu</h2><p class="note">${esc(Store.note)}</p></div>`;
  else if (!S.list.length) body = `<div class="empty"><h2>Chưa có hồ sơ khảo sát</h2><p class="note">Bấm <b>Khảo sát mới</b> khi tới công trình. Mỗi mục trong biên bản BM01 có nút chụp ảnh — ảnh tự đánh số theo mục (VD: III.8-1) và mọi thông tin được lưu vào bảng tổng hợp.</p>${Store.canWrite ? `<p style="margin-top:12px"><button class="btn primary" data-act="new">${ICON.plus}Khảo sát mới</button></p>` : ''}</div>`;
  else if (S.listMode === 'table') {
    const cols = [['Mã', s => s.code], ['Khách hàng', s => s.v?.ten_cty || s.v?.dai_dien || '—'], ['Địa chỉ', s => s.v?.dia_chi || ''], ['Ngày KS', s => itemDisplay(ngay, s)], ['Người KS', s => s.v?.ks_chinh || ''], ['kWh/tháng', s => s.v?.kwh_thang ? Number(s.v.kwh_thang).toLocaleString('vi-VN') : '', 1], ['Vật liệu mái', s => itemDisplay(ALL_ITEMS.find(i => i.k === 'vl_mai'), s)], ['DT lắp (m²)', s => s.v?.dt_lap || '', 1], ['CS đề xuất (kWp)', s => s.v?.cs_de_xuat || '', 1], ['Ảnh', s => photoCount(s), 1], ['Hoàn thành', s => completion(s) + '%', 1]];
    body = `<div class="tablewrap"><table class="sum"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(s => `<tr data-open="${esc(s._id)}">${cols.map(c => `<td class="${c[2] ? 'num' : ''}">${esc(c[1](s))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else body = `<div class="cards">${rows.map(s => `<button class="card" data-open="${esc(s._id)}"><span class="code">${esc(s.code)} · ${esc(itemDisplay(ngay, s))}</span>${ring(completion(s))}<span class="name">${esc(s.v?.ten_cty || s.v?.dai_dien || 'Chưa nhập tên khách hàng')}</span><span class="meta"><span>${esc(s.v?.dia_chi || 'Chưa có địa chỉ')}</span><span>${photoCount(s)} ảnh</span>${s.v?.ks_chinh ? `<span>KS: ${esc(s.v.ks_chinh)}</span>` : ''}</span></button>`).join('')}${!rows.length ? '<p class="note">Không có hồ sơ khớp tìm kiếm.</p>' : ''}</div>`;
  const local = Store.kind === 'local' && Store.ok;
  return `
  <header class="top">${SUN}<div class="brand"><div class="eyebrow">GITT · Biểu mẫu BM01</div><h1>Khảo sát điện mặt trời</h1></div>
  ${Store.canWrite && Store.ok ? `<button class="btn primary" data-act="new">${ICON.plus}<span>Khảo sát mới</span></button>` : ''}</header>
  ${local ? `<div class="banner ${navigator.onLine ? '' : 'off'}" id="netBanner">${navigator.onLine ? 'Dữ liệu được lưu ngay trên máy này và dùng được cả khi không có mạng. Nhớ <b>Sao lưu</b> định kỳ.' : 'Đang ngoại tuyến — vẫn khảo sát, chụp ảnh và xuất file bình thường.'}</div>` : ''}
  ${S.list.length ? `<div class="stats"><div class="stat"><b>${S.list.length}</b><span>Hồ sơ khảo sát</span></div><div class="stat"><b>${thisMonth}</b><span>Trong tháng này</span></div><div class="stat"><b>${totalKwp.toLocaleString('vi-VN')}</b><span>kWp dự kiến</span></div></div>
  <div class="toolbar"><input class="search" id="q" type="search" placeholder="Tìm theo khách hàng, địa chỉ, mã…" value="${esc(S.q)}">
  <div class="seg" role="group" aria-label="Kiểu xem"><button data-mode="cards" aria-pressed="${S.listMode === 'cards'}">Thẻ</button><button data-mode="table" aria-pressed="${S.listMode === 'table'}">Bảng</button></div>
  <button class="btn" data-act="sum">${ICON.dl}<span>Xuất bảng tổng hợp</span></button></div>` : ''}
  ${body}
  ${local ? `<div class="toolbar" style="margin-top:22px"><button class="btn" data-act="backup">Sao lưu dữ liệu</button><button class="btn" data-act="restore">Khôi phục / nhập hồ sơ</button><input type="file" id="restoreFile" accept=".json,application/json" hidden></div><p class="note">Sao lưu tạo một file .json gồm mọi hồ sơ và ảnh. Gửi file này cho đồng nghiệp rồi bấm "Khôi phục" để gộp hồ sơ vào máy của họ.</p>` : ''}`;
}
function bindList() {
  const app = $('#app');
  app.onclick = async e => {
    const t = e.target.closest('[data-act],[data-open],[data-mode]'); if (!t) return;
    if (t.dataset.mode) { S.listMode = t.dataset.mode; try { localStorage.setItem('ks_mode', S.listMode); } catch (e) {} render(); return; }
    if (t.dataset.open) { openSurvey(t.dataset.open); return; }
    const a = t.dataset.act;
    if (a === 'new') { S.curId = 'ks' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); S.cur = newSurvey(); S.view = 'form'; S.confirmDelete = false; S.pending = {}; render(); window.scrollTo(0, 0); markDirty(); }
    if (a === 'sum') exportSummary();
    if (a === 'backup') { t.disabled = true; t.textContent = 'Đang sao lưu…'; try { const b = await Store.backup(); const d = new Date(); await saveFile(`SaoLuu_KhaoSat_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`, b); } catch (e) { toast('Sao lưu không thành công.'); } t.disabled = false; t.textContent = 'Sao lưu dữ liệu'; }
    if (a === 'restore') $('#restoreFile').click();
  };
  const rf = $('#restoreFile'); if (rf) rf.onchange = async () => { const f = rf.files[0]; if (!f) return; try { const r = await Store.restore(f); toast(`Đã nhập ${r.n} hồ sơ${r.skip ? `, bỏ qua ${r.skip} hồ sơ đã có bản mới hơn` : ''}.`); } catch (e) { toast(e.message || 'File không hợp lệ.'); } };
  const q = $('#q'); if (q) q.oninput = () => { S.q = q.value; const pos = q.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
}
window.addEventListener('online', () => { if (S.view === 'list') render(); });
window.addEventListener('offline', () => { if (S.view === 'list') render(); });

async function openSurvey(id) {
  const s = S.list.find(x => x._id === id); if (!s) return;
  S.cur = normalize(clone(s));
  try { const d = JSON.parse(localStorage.getItem('ks_draft_' + id) || 'null'); if (d && d.updatedAt > s.updatedAt) S.cur = normalize(d); } catch (e) {}
  S.curId = id; S.view = 'form'; S.confirmDelete = false; S.pending = {};
  await Store.preload(allImageIds(S.cur));
  render(); window.scrollTo(0, 0);
}

// ---------- form ----------
function inputHTML(it, opts = {}) {
  const s = S.cur, ro = !Store.canWrite || opts.readonly ? 'disabled' : '';
  const v = s.v[it.k] ?? '';
  const type = it.t === 'date' ? 'date' : it.t === 'tel' ? 'tel' : it.t === 'email' ? 'email' : 'text';
  const im = it.t === 'num' ? 'decimal' : it.t === 'money' ? 'numeric' : it.t === 'tel' ? 'tel' : '';
  const shown = it.t === 'money' && v !== '' ? Number(v).toLocaleString('vi-VN') : (it.t === 'num' && v !== '' ? String(v) : v);
  const unit = it.t === 'money' ? 'đ' : it.u || '';
  if (it.t === 'area') return `<div class="field"><textarea id="f_${it.k}" data-f="${esc(it.k)}" ${ro}>${esc(v)}</textarea></div>`;
  return `<div class="field"><input id="f_${it.k}" data-f="${esc(it.k)}" type="${type}" ${im ? `inputmode="${im}"` : ''} value="${esc(shown)}" placeholder="${esc(it.ph || '')}" class="${unit ? 'hasunit' : ''}" ${ro}>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>`;
}
function itemHTML(it) {
  const s = S.cur, ro = !Store.canWrite ? 'disabled' : '';
  const auto = it.sec === 'VI' && s.v.vi_mode === 'auto';
  const isOv = auto && s.ov[it.k];
  let ctl;
  if (it.o) {
    const sel = s.c[it.k] || [];
    const opts = it.o.map(optInfo);
    const otherOn = opts.some(o => o.other && sel.includes(o.label));
    ctl = `<div class="chips" role="group" aria-label="${esc(it.l)}">${opts.map(o => `<button type="button" class="chipbtn" data-chip="${esc(it.k)}" data-v="${esc(o.label)}" aria-pressed="${sel.includes(o.label)}" ${ro}><span class="box">${sel.includes(o.label) ? '✓' : ''}</span>${esc(o.label)}</button>`).join('')}</div>`;
    if (otherOn) {
      const ol = opts.find(o => o.other && sel.includes(o.label)).label;
      ctl += it.ou
        ? `</div><div class="other field"><input id="x_${it.k}" data-other="${esc(it.k)}" inputmode="decimal" class="hasunit" value="${esc(s.x[it.k] || '')}" placeholder="Nhập số" ${ro}><span class="unit">${esc(it.ou)}</span>`
        : `</div><div class="other"><input id="x_${it.k}" data-other="${esc(it.k)}" value="${esc(s.x[it.k] || '')}" placeholder="Ghi rõ ${esc(ol.toLowerCase())}…" ${ro}>`;
    }
  } else ctl = inputHTML(it);
  const nph = (s.ph[it.k] || []).length + (S.pending[it.k] || []).length;
  const tag = auto ? `<span id="tag_${it.k}">${tagHTML(it.k)}</span>` : '';
  const geo = it.gps && s.geo && s.geo.lat ? `<a class="maplink" href="https://www.google.com/maps?q=${s.geo.lat},${s.geo.lng}" target="_blank" rel="noopener">Xem vị trí trên Google Maps ↗</a>` : '';
  return `<div class="item ${it.sub ? 'sub' : ''} ${isFilled(it, s) ? 'filled' : ''} ${auto ? 'auto' : ''} ${isOv ? 'ov' : ''}" id="it_${it.k}">
    <div class="num">${esc(it.n)}</div>
    <div class="ibody"><div class="lbl">${esc(it.l)}${it.req ? '<span class="req">*</span>' : ''}${tag}</div>
    <div class="row">${ctl}${it.gps && Store.canWrite ? `<button type="button" class="cam" data-gps="${esc(it.k)}" aria-label="Lấy toạ độ vị trí hiện tại">${ICON.pin}</button>` : ''}${Store.canUpload ? `<button type="button" class="cam" data-cam="${esc(it.k)}" aria-label="Chụp ảnh mục ${esc(it.code)}">${ICON.cam}${nph ? `<span class="badge">${nph}</span>` : ''}</button>` : ''}</div>
    ${geo}<div class="thumbs" id="th_${it.k}">${thumbsHTML(it)}</div></div></div>`;
}
function tagHTML(k) {
  if (S.cur.ov[k]) return `<button type="button" class="tag edit" data-reset="${k}" title="Bỏ giá trị đã sửa, dùng lại số tự tính">đã sửa · ↺ tính lại</button>`;
  return '<span class="tag">tự tính</span>';
}
function thumbsHTML(it) {
  const list = S.cur.ph[it.k] || [], pend = S.pending[it.k] || [];
  return list.map((p, i) => `<div class="thumb"><img src="${imgSrc(p.id)}" alt="Ảnh ${esc(it.code)}-${i + 1}" data-view="${esc(it.k)}" data-i="${i}" loading="lazy"><div class="cap">${esc(it.code)}-${i + 1}${p.note ? ' · ' + esc(p.note) : ''}</div>${Store.canWrite ? `<button class="x" data-rm="${esc(it.k)}" data-i="${i}" aria-label="Xoá ảnh">✕</button>` : ''}</div>`).join('')
    + pend.map(p => `<div class="thumb"><img src="${p.url}" alt=""><div class="st" ${p.failed ? `data-retry="${p.tmpId}"` : ''}>${esc(p.status)}</div><div class="cap">${esc(it.code)}-…</div></div>`).join('');
}
function slotHTML(sl) {
  const ref = S.cur.slots[sl.k]; const pend = (S.pending['slot:' + sl.k] || [])[0];
  let inner;
  if (pend) inner = `<img src="${pend.url}" alt=""><span class="slotst" ${pend.failed ? `data-retry="${pend.tmpId}"` : ''}>${esc(pend.status)}</span>`;
  else if (ref) inner = `<img src="${imgSrc(ref.id)}" alt="${esc(sl.l)}">`;
  else inner = `<span class="ph">${sl.wide ? ICON.img : ICON.cam}${Store.canUpload ? (sl.wide ? 'Chụp hoặc chọn ảnh bản vẽ' : 'Chạm để chụp / chọn ảnh') : 'Chưa có ảnh'}</span>`;
  return `<div class="slot ${sl.wide ? 'wide' : ''}" id="sl_${sl.k}"><div class="sh"><b>${esc(sl.n)}</b>${esc(sl.l)}</div>
  <button type="button" class="sb" data-slot="${esc(sl.k)}" ${!Store.canUpload && !ref ? 'disabled' : ''} aria-label="${ref ? 'Xem' : 'Chụp'} ảnh ${esc(sl.l)}">${inner}</button>
  ${ref && Store.canUpload ? `<div class="acts"><button class="btn ghost" data-slotnew="${esc(sl.k)}">Đổi ảnh</button><button class="btn ghost" data-slotrm="${esc(sl.k)}">Xoá</button></div>` : ''}</div>`;
}
function secCount(sec) { const f = sec.items.filter(it => isFilled(it, S.cur)).length; return [f, sec.items.length]; }

function calcHTML() {
  const s = S.cur, ro = !Store.canWrite ? 'disabled' : '';
  const mode = s.v.vi_mode === 'auto' ? 'auto' : 'manual';
  let box = '';
  if (mode === 'auto') {
    const P = calcParams(s); const r = autoPropose(s);
    const lh = ((s.c.loai_he) || [])[0];
    const sysChips = `<div class="sysrow"><span class="note">Loại hệ tính toán:</span>${['On-grid (hòa lưới)', 'Hybrid', 'Off-grid'].map(o => `<button type="button" class="chipbtn" data-chip="loai_he" data-v="${o}" aria-pressed="${lh === o}" ${ro}><span class="box">${lh === o ? '✓' : ''}</span>${o.replace(' (hòa lưới)', '')}</button>`).join('')}</div>`;
    box = `<div class="calcbox">${sysChips}
      ${r.ok ? `<ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<p class="warn">${esc(r.msg)}</p>`}
      ${Object.keys(s.ov || {}).some(k => s.ov[k]) ? '<button type="button" class="btn ghost" data-resetall style="align-self:flex-start">↺ Tính lại tất cả theo số liệu</button>' : ''}
      <details ${s.calc && Object.keys(s.calc).length ? 'open' : ''}><summary>Giả định tính toán (chỉnh được)</summary>
      <div class="pgrid">${CALC_FIELDS.filter(f => (!f.hyb || P.type !== 'On-grid') && (!f.tou || P.tt !== 'sh')).map(f => f.opts
        ? `<label class="pf"><span>${esc(f.l)}<small>Mặc định theo toạ độ GPS (II.1), nếu có</small></span><span class="field"><select data-calc="${f.k}" ${ro}><option value="">Tự động: ${esc(REGIONS[P.vungAuto].l)}</option>${f.opts.map(([k, l]) => `<option value="${k}" ${s.calc[f.k] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></span></label>`
        : `<label class="pf"><span>${esc(f.l)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</span><span class="field"><input data-calc="${f.k}" inputmode="decimal" value="${esc(s.calc[f.k] ?? '')}" placeholder="${esc(f.money ? fmtN(P._def[f.k]) : String(P._def[f.k]).replace('.', ','))}" class="hasunit" ${ro}><span class="unit">${esc(f.u)}</span></span></label>`).join('')}</div>
      <p class="note">Để trống là dùng giá trị mặc định (chữ mờ). Giá điện theo QĐ 1279/QĐ-BCT (10/5/2025), cấp điện áp dưới 6 kV, chưa gồm VAT; khung giờ theo QĐ 963/QĐ-BCT (22/4/2026). Khách hàng cấp điện áp cao hơn hoặc khi EVN điều chỉnh giá, hãy nhập lại giá.</p></details></div>`;
  }
  return `<div class="modebox"><div class="seg wide" role="radiogroup" aria-label="Cách lập đề xuất kỹ thuật">
    <button type="button" role="radio" data-vimode="manual" aria-checked="${mode === 'manual'}" aria-pressed="${mode === 'manual'}" ${ro}><span class="radio"></span>Tự điền</button>
    <button type="button" role="radio" data-vimode="auto" aria-checked="${mode === 'auto'}" aria-pressed="${mode === 'auto'}" ${ro}><span class="radio"></span>Tự động đề xuất</button></div>
    <p class="note">${mode === 'auto' ? 'Thông số được tính từ điện năng (II.9) hoặc tiền điện (II.10) hàng tháng. Bạn sửa trực tiếp ô nào thì ô đó giữ số của bạn, các ô còn lại tính lại theo.' : 'Kỹ sư tự nhập các thông số đề xuất bên dưới.'}</p>${box}</div>`;
}

function renderForm() {
  const s = S.cur;
  applyAuto(s);
  const tabs = SECTIONS.map(sec => { const [f, n] = secCount(sec); return `<a href="#sec_${sec.id}" class="tab ${f === n ? 'full' : ''}" data-jump="sec_${sec.id}">${sec.id}<span class="cnt">${f}/${n}</span></a>`; }).join('')
    + `<a class="tab" data-jump="sec_P2">Ảnh<span class="cnt">${SLOTS.filter(x => s.slots[x.k]).length}/7</span></a><a class="tab" data-jump="sec_KY">Ký<span class="cnt">${['ks', 'kh'].filter(w => s.sig[w]).length}/2</span></a>`;
  const secs = SECTIONS.map(sec => `<section class="sec" id="sec_${sec.id}"><div class="sechead"><span class="roman">${sec.id}</span><h2>${esc(sec.title)}</h2></div>${sec.id === 'VI' ? `<div id="calcwrap">${calcHTML()}</div>` : ''}${sec.items.map(it => itemHTML(ALL_ITEMS.find(x => x.k === it.k))).join('')}</section>`).join('');
  return `
  <div class="formhead"><button class="btn ghost" data-act="back" aria-label="Về danh sách">${ICON.back}</button>
  <div class="t"><div class="eyebrow">${esc(s.code)} · Biên bản khảo sát BM01</div><h1>${esc(s.v.ten_cty || s.v.dai_dien || 'Hồ sơ khảo sát mới')}</h1>
  <div class="prog" aria-hidden="true"><i style="width:${completion(s)}%"></i></div></div></div>
  ${!Store.canWrite ? '<div class="banner">Bạn đang xem ở chế độ chỉ đọc.</div>' : ''}
  <nav class="tabs" aria-label="Các phần biên bản">${tabs}</nav>
  ${secs}
  <section class="sec" id="sec_P2"><div class="sechead"><span class="roman">P2</span><h2>Hình ảnh khảo sát</h2></div>
  <p class="note">6 ảnh chính in vào Phần 2 của biên bản, ảnh sketch in vào Phần 3. Ảnh chụp ở từng mục phía trên được in ở phần "Ảnh theo mục".</p>
  <div class="slots">${SLOTS.map(slotHTML).join('')}</div></section>
  <section class="sec" id="sec_KY"><div class="sechead"><span class="roman">✍</span><h2>Xác nhận</h2></div>
  <div class="sigs">${sigBox('ks', 'Người khảo sát')}${sigBox('kh', 'Đại diện khách hàng')}</div>
  ${Store.canWrite ? `<div style="margin-top:28px" class="confirm">${S.confirmDelete ? `<span class="note">Xoá hồ sơ này và toàn bộ ảnh? Không thể hoàn tác.</span><button class="btn danger" data-act="delyes">Xoá hẳn</button><button class="btn" data-act="delno">Giữ lại</button>` : `<button class="btn ghost" style="color:var(--bad)" data-act="del">Xoá hồ sơ</button>`}</div>` : ''}
  </section>`;
}
function sigBox(who, title) {
  const s = S.cur, ref = s.sig[who];
  const name = s.names[who] || (who === 'ks' ? s.v.ks_chinh : s.v.dai_dien) || '';
  return `<div class="sigbox" id="sig_${who}"><h3>${title}</h3>
    ${ref ? `<img class="sigimg" src="${imgSrc(ref.id)}" alt="Chữ ký ${title}">` : (Store.canUpload ? `<canvas class="sigpad" id="pad_${who}" aria-label="Ô ký tên ${title}"></canvas>` : '<p class="note">Chưa ký</p>')}
    <div class="field"><input id="n_${who}" data-name="${who}" value="${esc(name)}" placeholder="Họ tên" ${!Store.canWrite ? 'disabled' : ''}></div>
    ${Store.canUpload ? (ref ? `<div class="confirm"><span class="note sigok">✓ Đã lưu chữ ký</span><button class="btn ghost" data-sigclear="${who}">Ký lại</button></div>` : `<div class="confirm"><span class="note" id="sigst_${who}">Ký bằng ngón tay — tự lưu khi nhấc tay</span><button class="btn ghost" data-sigclr="${who}">Xoá nét</button></div>`) : ''}</div>`;
}

function renderBar() {
  if (S.view !== 'form') return;
  let bar = $('.bar');
  if (!bar) { bar = document.createElement('div'); bar.className = 'bar'; document.body.appendChild(bar);
    bar.onclick = e => { const t = e.target.closest('[data-bar]'); if (!t || S.busy) return; if (t.dataset.bar === 'xlsx') exportExcel(); if (t.dataset.bar === 'pdf') exportPDF(); if (t.dataset.bar === 'retry') save(); }; }
  const pendingN = Object.values(S.pending).reduce((a, l) => a + l.filter(p => !p.failed).length, 0);
  let dot = '', txt;
  if (S.busy) { dot = 'saving'; txt = esc(S.busy); }
  else if (S.saveErr) { dot = 'err'; txt = esc(S.saveErr); }
  else if (S.saving || S.dirty || pendingN) { dot = 'saving'; txt = pendingN ? `Đang lưu ${pendingN} ảnh…` : 'Đang lưu…'; }
  else txt = S.lastSaved ? 'Đã lưu ' + new Date(S.lastSaved).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Đã lưu';
  bar.innerHTML = `<div class="in"><div class="status"><span class="dot ${dot}"></span><span>${txt}</span></div>
  ${S.saveErr && Store.canWrite ? '<button class="btn" data-bar="retry">Lưu lại</button>' : ''}
  <button class="btn navy" data-bar="pdf" ${S.busy ? 'disabled' : ''}>${ICON.dl}PDF</button>
  <button class="btn primary" data-bar="xlsx" ${S.busy ? 'disabled' : ''}>${ICON.dl}Excel</button></div>`;
}
function renderKey(ctx) {
  if (S.view !== 'form') return;
  if (ctx.kind === 'item') {
    const it = ALL_ITEMS.find(i => i.k === ctx.k); const el = $('#it_' + ctx.k);
    if (el) { $('#th_' + ctx.k).innerHTML = thumbsHTML(it); const b = el.querySelector('.cam'); if (b) { const n = (S.cur.ph[it.k] || []).length + (S.pending[it.k] || []).length; b.innerHTML = ICON.cam + (n ? `<span class="badge">${n}</span>` : ''); } }
  } else if (ctx.kind === 'slot') { const el = $('#sl_' + ctx.k); if (el) el.outerHTML = slotHTML(SLOTS.find(s => s.k === ctx.k)); }
  renderBar();
}
function refreshItem(k) {
  const it = ALL_ITEMS.find(i => i.k === k); const el = $('#it_' + k); if (!el) return;
  el.classList.toggle('filled', isFilled(it, S.cur));
  const sec = SECTIONS.find(s => s.id === it.sec); const [f, n] = secCount(sec);
  const tab = document.querySelector(`[data-jump="sec_${sec.id}"]`); if (tab) { tab.classList.toggle('full', f === n); tab.querySelector('.cnt').textContent = `${f}/${n}`; }
  const pr = $('.prog i'); if (pr) pr.style.width = completion(S.cur) + '%';
  if (k === 'ten_cty' || k === 'dai_dien') $('.formhead h1').textContent = S.cur.v.ten_cty || S.cur.v.dai_dien || 'Hồ sơ khảo sát mới';
}
// Tính lại mục VI khi số liệu đầu vào thay đổi (chế độ tự động)
const CALC_INPUTS = new Set(['kwh_thang', 'tien_dien', 'dau_tu', 'dt_lap', 'gia_dien', 'tg_dung_dien', 'nguon_dien', 'loai_he', 'luu_tru', 'huong_mai', 'do_doc']);
function refreshAuto() {
  if (S.cur.v.vi_mode !== 'auto') return;
  applyAuto(S.cur);
  const w = $('#calcwrap'); if (w) { const open = w.querySelector('details')?.open; const act = document.activeElement; const ak = act && act.dataset && act.dataset.calc; const pos = act && act.selectionStart;
    w.innerHTML = calcHTML(); if (open) w.querySelector('details').open = true; if (ak) { const n = w.querySelector(`[data-calc="${ak}"]`); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  SECTIONS.find(s => s.id === 'VI').items.forEach(it => {
    const inp = $('#f_' + it.k);
    if (inp && inp !== document.activeElement) inp.value = S.cur.v[it.k] != null ? String(S.cur.v[it.k]) : '';
    const tg = $('#tag_' + it.k); if (tg) tg.innerHTML = tagHTML(it.k);
    const el = $('#it_' + it.k); if (el) el.classList.toggle('ov', !!S.cur.ov[it.k]);
    refreshItem(it.k);
  });
  const lh = $('#it_loai_he'); if (lh) { const tmp = document.createElement('div'); tmp.innerHTML = itemHTML(ALL_ITEMS.find(i => i.k === 'loai_he')); lh.replaceWith(tmp.firstElementChild); }
}

function bindForm() {
  const app = $('#app');
  app.oninput = e => {
    const t = e.target;
    if (t.dataset.f) {
      const it = ALL_ITEMS.find(i => i.k === t.dataset.f); let v = t.value;
      if (it.t === 'money') { const digits = v.replace(/\D/g, ''); v = digits; const f = digits ? Number(digits).toLocaleString('vi-VN') : ''; if (t.value !== f) t.value = f; }
      if (it.t === 'num') v = v.replace(',', '.');
      S.cur.v[it.k] = v; refreshItem(it.k);
      if (it.sec === 'VI' && S.cur.v.vi_mode === 'auto') { S.cur.ov[it.k] = v !== ''; markDirty(); refreshAuto(); return; }
      markDirty();
      if (CALC_INPUTS.has(it.k)) refreshAuto();
    } else if (t.dataset.other) {
      const it = ALL_ITEMS.find(i => i.k === t.dataset.other);
      if (it && it.ou) { const c = t.value.replace(/[^\d.,]/g, ''); if (c !== t.value) t.value = c; }
      S.cur.x[t.dataset.other] = t.value.replace(',', '.'); markDirty();
      if (CALC_INPUTS.has(t.dataset.other)) refreshAuto();
    }
    else if (t.dataset.name) { S.cur.names[t.dataset.name] = t.value; markDirty(); }
    else if (t.dataset.calc) { const v = t.tagName === 'SELECT' ? t.value : t.value.replace(/[^\d.,]/g, '').replace(',', '.'); S.cur.calc[t.dataset.calc] = v; markDirty(); refreshAuto(); }
  };
  app.onclick = e => {
    const t = e.target.closest('button,[data-jump],[data-view],[data-retry]'); if (!t) return;
    const d = t.dataset;
    if (d.jump) { e.preventDefault(); $('#' + d.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.act === 'back') { t.disabled = true; commitPendingSigs().then(flush).finally(() => { S.view = 'list'; S.cur = null; render(); window.scrollTo(0, 0); }); return; }
    if (d.act === 'del') { S.confirmDelete = true; rerenderKeep('#sec_KY'); return; }
    if (d.act === 'delno') { S.confirmDelete = false; rerenderKeep('#sec_KY'); return; }
    if (d.act === 'delyes') { deleteSurvey(); return; }
    if (d.vimode) { S.cur.v.vi_mode = d.vimode; markDirty(); rerenderKeep('#sec_VI'); return; }
    if (d.chip) {
      const it = ALL_ITEMS.find(i => i.k === d.chip); let sel = S.cur.c[it.k] || [];
      if (sel.includes(d.v)) sel = sel.filter(x => x !== d.v); else sel = it.m ? sel.concat(d.v) : [d.v];
      S.cur.c[it.k] = sel; markDirty();
      const el = $('#it_' + it.k); const tmp = document.createElement('div'); tmp.innerHTML = itemHTML(it); el.replaceWith(tmp.firstElementChild); refreshItem(it.k);
      if (CALC_INPUTS.has(it.k)) refreshAuto();
      const o = it.o.map(optInfo).find(o => o.label === d.v); if (o && o.other && sel.includes(d.v)) $('#x_' + it.k)?.focus();
      return;
    }
    if (d.cam) { pick({ kind: 'item', k: d.cam }); return; }
    if (d.reset) { delete S.cur.ov[d.reset]; markDirty(); refreshAuto(); return; }
    if (t.hasAttribute('data-resetall')) { S.cur.ov = {}; markDirty(); refreshAuto(); return; }
    if (d.gps) { getLocation(d.gps, t); return; }
    if (d.retry) { for (const key in S.pending) { const p = S.pending[key].find(x => x.tmpId === d.retry); if (p) { p.failed = false; p.status = 'Đang thử lại…'; renderKey(p.ctx); uploadOne(p, key); } } return; }
    if (d.view != null && t.tagName === 'IMG') { openViewer(d.view, +d.i); return; }
    if (d.rm) { removePhoto(d.rm, +d.i); return; }
    if (d.slot) { const ref = S.cur.slots[d.slot]; if (ref) openViewer(null, 0, ref); else pick({ kind: 'slot', k: d.slot }); return; }
    if (d.slotnew) { pick({ kind: 'slot', k: d.slotnew }); return; }
    if (d.slotrm) { removeSlot(d.slotrm); return; }
    if (d.sigclr) { const c = $('#pad_' + d.sigclr); c.getContext('2d').clearRect(0, 0, c.width, c.height); c._ink = false; clearTimeout(c._t); return; }
    if (d.sigclear) { const ref = S.cur.sig[d.sigclear]; delete S.cur.sig[d.sigclear]; markDirty(); replaceSig(d.sigclear); if (ref) Store.delImage(ref.id); return; }
  };
  document.querySelectorAll('.sigpad').forEach(setupPad);
}
function rerenderKeep(sel) { const el = $(sel); const top = el ? el.getBoundingClientRect().top : 0; render(); const n = $(sel); if (n) window.scrollBy(0, n.getBoundingClientRect().top - top); }

// ---------- chữ ký: tự lưu khi nhấc tay ----------
function setupPad(c) {
  const dpr = window.devicePixelRatio || 1; const r = c.getBoundingClientRect();
  c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0b2a6b';
  let down = false;
  const who = c.id.replace('pad_', '');
  const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.onpointerdown = e => { down = true; clearTimeout(c._t); c.setPointerCapture(e.pointerId); const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + .1, y + .1); g.stroke(); c._ink = true; };
  c.onpointermove = e => { if (!down) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); };
  c.onpointerup = c.onpointercancel = () => { if (!down) return; down = false; const st = $('#sigst_' + who); if (st) st.textContent = 'Đang chờ ký xong…'; clearTimeout(c._t); c._t = setTimeout(() => saveSig(who), 1500); };
}
async function saveSig(who) {
  const c = $('#pad_' + who); if (!c || !c._ink || c._saving) return;
  c._saving = true; clearTimeout(c._t);
  const st = $('#sigst_' + who); if (st) st.textContent = 'Đang lưu chữ ký…';
  // cắt sát nét ký trên nền trắng
  const g0 = c.getContext('2d'); const data = g0.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (data[(y * c.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const pad = 12; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width, x1 + pad); y1 = Math.min(c.height, y1 + pad);
  const w = Math.max(10, x1 - x0), h = Math.max(10, y1 - y0);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  try {
    const id = await Store.upload(blob, 'image/png');
    S.cur.sig[who] = { id, w, h };
    if (!S.cur.names[who]) S.cur.names[who] = $('#n_' + who)?.value || '';
    markDirty(); replaceSig(who);
  } catch (e) { c._saving = false; if (st) st.textContent = 'Chưa lưu được chữ ký — ký thêm một nét để thử lại.'; }
}
function replaceSig(who) {
  const el = $('#sig_' + who); if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = sigBox(who, who === 'ks' ? 'Người khảo sát' : 'Đại diện khách hàng');
  el.replaceWith(tmp.firstElementChild); const pad = $('#pad_' + who); if (pad) setupPad(pad);
  const tab = document.querySelector('[data-jump="sec_KY"] .cnt'); if (tab) tab.textContent = ['ks', 'kh'].filter(w => S.cur.sig[w]).length + '/2';
}
async function commitPendingSigs() { for (const who of ['ks', 'kh']) { const c = $('#pad_' + who); if (c && c._ink && !S.cur.sig[who]) await saveSig(who); } }

async function deleteSurvey() {
  const s = S.cur, id = S.curId;
  clearTimeout(saveTimer); S.dirty = false;
  try {
    await Store.remove(id);
    for (const a of allImageIds(s)) Store.delImage(a);
    try { localStorage.removeItem('ks_draft_' + id); } catch (e) {}
    S.view = 'list'; S.cur = null; render(); toast('Đã xoá hồ sơ ' + s.code);
  } catch (e) { toast('Không xoá được — thử lại.'); }
}
function openViewer(k, i, refOverride) {
  const ref = refOverride || S.cur.ph[k][i];
  const it = k ? ALL_ITEMS.find(x => x.k === k) : null;
  const v = document.createElement('div'); v.className = 'viewer'; v.setAttribute('role', 'dialog');
  v.innerHTML = `<div class="vbar"><b style="flex:1">${it ? esc(it.code + '-' + (i + 1) + '  ' + it.l) : ''}</b><button class="btn" data-close>Đóng</button></div><img src="${imgSrc(ref.id)}" alt="">
  ${it && Store.canWrite ? `<div class="vbar"><input id="vnote" placeholder="Ghi chú cho ảnh (VD: công tơ tổng, CB 100A)" value="${esc(ref.note || '')}"><button class="btn" data-savenote>Lưu ghi chú</button></div>` : ''}`;
  document.body.appendChild(v);
  v.onclick = e => {
    if (e.target.closest('[data-close]')) v.remove();
    if (e.target.closest('[data-savenote]')) { ref.note = $('#vnote', v).value.trim(); markDirty(); renderKey({ kind: 'item', k }); v.remove(); }
  };
}
window.addEventListener('beforeunload', () => { if (S.dirty) save(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.cur) { commitPendingSigs(); if (S.dirty) save(); } });

// ---------- toạ độ GPS ----------
function getLocation(k, btn) {
  if (!navigator.geolocation) { toast('Thiết bị không hỗ trợ lấy vị trí.'); return; }
  btn.disabled = true; btn.classList.add('busy'); toast('Đang lấy vị trí… (đứng ngoài trời sẽ chính xác hơn)');
  navigator.geolocation.getCurrentPosition(pos => {
    btn.disabled = false; btn.classList.remove('busy');
    const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
    const la = lat.toFixed(6), ln = lng.toFixed(6);
    S.cur.geo = { lat: la, lng: ln, acc: Math.round(acc), at: Date.now() };
    const base = String(S.cur.v[k] || '').replace(/\s*[—-]?\s*GPS:[^\n]*$/, '').trim();
    S.cur.v[k] = (base ? base + ' — ' : '') + `GPS: ${la}, ${ln} (±${Math.round(acc)} m)`;
    markDirty();
    const el = $('#it_' + k); const tmp = document.createElement('div'); tmp.innerHTML = itemHTML(ALL_ITEMS.find(i => i.k === k)); el.replaceWith(tmp.firstElementChild); refreshItem(k);
    toast(`Đã ghi toạ độ (sai số ±${Math.round(acc)} m)`); refreshAuto();
  }, err => {
    btn.disabled = false; btn.classList.remove('busy');
    if (Store.kind === 'artifact') toast('Trang trong Claude không được phép lấy vị trí. Dùng bản app trên Vercel, hoặc dán toạ độ từ Google Maps.');
    else if (err.code === 1) toast('Bạn chưa cho phép truy cập vị trí. Bật quyền Vị trí cho trình duyệt trong Cài đặt rồi thử lại.');
    else toast('Chưa lấy được vị trí — thử lại ở chỗ thoáng hoặc bật GPS.');
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}
