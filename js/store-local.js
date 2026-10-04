// Lưu trữ ngay trên điện thoại (IndexedDB) — chạy được khi không có mạng
function loadScript(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(sc); }); }
const Store = {
  kind: 'local', ok: false, canWrite: true, canUpload: true, note: '',
  _idb: null, _cache: new Map(), _onList: null,
  _open() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open('ks_solar_bm01', 1);
      rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('surveys', { keyPath: '_id' }); d.createObjectStore('images'); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  },
  _tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this._idb.transaction(store, mode); const st = tx.objectStore(store);
      let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  },
  async _emit() { const all = await this._tx('surveys', 'readonly', st => st.getAll()); all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); this._onList(all); },
  async init(onList) {
    this._onList = onList;
    try { this._idb = await this._open(); } catch (e) { this.note = 'Trình duyệt này không cho lưu dữ liệu (có thể đang ở chế độ ẩn danh).'; return false; }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    this.ok = true; await this._emit(); return true;
  },
  async save(id, doc) { await this._tx('surveys', 'readwrite', st => st.put(Object.assign({}, doc, { _id: id }))); await this._emit(); },
  async remove(id) { await this._tx('surveys', 'readwrite', st => st.delete(id)); await this._emit(); },
  async upload(blob, type) {
    const id = 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await this._tx('images', 'readwrite', st => st.put({ blob, type }, id));
    this._cache.set(id, URL.createObjectURL(blob)); return id;
  },
  url(id) { return this._cache.get(id) || ''; },
  async preload(ids) {
    for (const id of ids) {
      if (this._cache.has(id)) continue;
      const rec = await this._tx('images', 'readonly', st => st.get(id));
      if (rec) this._cache.set(id, URL.createObjectURL(rec.blob));
    }
  },
  async getBlob(id) { const rec = await this._tx('images', 'readonly', st => st.get(id)); if (!rec) throw new Error('404'); return rec.blob; },
  async delImage(id) { await this._tx('images', 'readwrite', st => st.delete(id)); const u = this._cache.get(id); if (u) URL.revokeObjectURL(u); this._cache.delete(id); },
  async download(filename, blob) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e && e.name === 'AbortError') throw Object.assign(e, { code: 'declined' }); }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  },
  async excel() { if (!window.ExcelJS) await loadScript('vendor/exceljs.min.js'); return window.ExcelJS; },
  async pdfLibs() {
    if (!window.html2canvas) await loadScript('vendor/html2canvas.min.js');
    if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
    return { html2canvas: window.html2canvas, jsPDF: window.jspdf.jsPDF };
  },
  // Sao lưu / khôi phục toàn bộ hồ sơ kèm ảnh (một file .json)
  async backup() {
    const surveys = await this._tx('surveys', 'readonly', st => st.getAll());
    const keys = await this._tx('images', 'readonly', st => st.getAllKeys());
    const images = {};
    for (const k of keys) { const rec = await this._tx('images', 'readonly', st => st.get(k)); images[k] = { type: rec.type, data: await blobToB64(rec.blob) }; }
    return new Blob([JSON.stringify({ app: 'ks-solar-bm01', version: 1, exportedAt: new Date().toISOString(), surveys, images })], { type: 'application/json' });
  },
  async restore(file) {
    const data = JSON.parse(await file.text());
    if (data.app !== 'ks-solar-bm01') throw new Error('Không phải file sao lưu của app khảo sát.');
    let n = 0, skip = 0;
    for (const [k, im] of Object.entries(data.images || {})) {
      const bin = atob(im.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      await this._tx('images', 'readwrite', st => st.put({ blob: new Blob([u], { type: im.type }), type: im.type }, k));
    }
    const cur = await this._tx('surveys', 'readonly', st => st.getAll());
    const byId = Object.fromEntries(cur.map(s => [s._id, s]));
    for (const s of data.surveys || []) {
      if (byId[s._id] && (byId[s._id].updatedAt || 0) >= (s.updatedAt || 0)) { skip++; continue; }
      await this._tx('surveys', 'readwrite', st => st.put(s)); n++;
    }
    await this._emit(); return { n, skip };
  },
};
function blobToB64(blob) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); }); }
