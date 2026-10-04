// Xuất biên bản BM01 từ file mẫu + bảng tổng hợp
const COLPX = w => Math.floor(w * 7 + 5);
function fitBox(w, h, bw, bh) { const k = Math.min(bw / w, bh / h); return { width: Math.round(w * k), height: Math.round(h * k) }; }

async function buildBM01(ExcelJS, templateBuf, s, loadImg) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuf);
  const ws = wb.worksheets[0];
  const colW = c => COLPX(ws.getColumn(c).width || 8.43);
  const rowH = r => Math.round((ws.getRow(r).height || 15) * 96 / 72);

  // Dòng 82: dung lượng pin lưu trữ (chỉ thêm khi có giá trị), định dạng giống dòng 81
  if (s.v && s.v.pin_de_xuat !== '' && s.v.pin_de_xuat != null) {
    const r81 = ws.getRow(81), r82 = ws.getRow(82);
    r82.height = r81.height || 20;
    for (let c = 2; c <= 6; c++) r82.getCell(c).style = JSON.parse(JSON.stringify(r81.getCell(c).style || {}));
    try { ws.mergeCells('B82:D82'); } catch (e) {}
    try { ws.mergeCells('E82:F82'); } catch (e) {}
    ws.getCell('B82').value = '   Dung lượng pin lưu trữ (kWh)';
  }
  for (const it of ALL_ITEMS) {
    if (it.r === 82 && !(s.v && s.v.pin_de_xuat !== '' && s.v.pin_de_xuat != null)) continue;
    const addr = (it.col || 'E') + it.r;
    const cell = ws.getCell(addr);
    if (it.o) { cell.value = checkText(String(cell.value || ''), it, s); continue; }
    const v = s.v && s.v[it.k];
    if (v == null || v === '') continue;
    if (it.t === 'num' || it.t === 'money') { const n = Number(v); cell.value = isNaN(n) ? v : n; if (it.t === 'money') cell.numFmt = '#,##0" đ"'; }
    else cell.value = itemDisplay(it, s);
    cell.alignment = Object.assign({}, cell.alignment, { wrapText: true, vertical: 'middle', horizontal: 'left' });
  }

  const place = async (sheet, ref, col0, row0, bw, bh) => {
    const img = await loadImg(ref.id); if (!img) return false;
    const id = wb.addImage({ base64: img.base64, extension: img.ext });
    const ext = fitBox(img.w, img.h, bw - 8, bh - 8);
    sheet.addImage(id, { tl: { col: col0 + 0.08, row: row0 + 0.03 }, ext, editAs: 'oneCell' });
    return true;
  };

  // Phần 2 + Phần 3
  for (const sl of SLOTS) {
    const ref = s.slots && s.slots[sl.k]; if (!ref) continue;
    const c = ws.getCell(sl.cell); const r = c.row, col = c.col;
    const bw = sl.wide ? [2, 3, 4, 5, 6].reduce((a, i) => a + colW(i), 0) : (col === 2 ? [2, 3, 4, 5].reduce((a, i) => a + colW(i), 0) : colW(6));
    if (await place(ws, ref, col - 1, r - 1, bw, rowH(r))) c.value = null;
  }
  // Chữ ký: nới 4 dòng ký để ảnh chữ ký rõ
  for (let r = 98; r <= 101; r++) ws.getRow(r).height = 24;
  const sig = s.sig || {};
  const sigH = 4 * rowH(98);
  if (sig.ks) await place(ws, sig.ks, 1, 97, 300, sigH);
  if (sig.kh) await place(ws, sig.kh, 5, 97, 300, sigH);
  if (s.v && s.v.vi_mode === 'auto') ws.getCell('B76').value = 'VI.  TÓM TẮT ĐỀ XUẤT KỸ THUẬT  (tự động tính từ điện năng tiêu thụ · hệ ' + sysType(s) + ')';
  const nm = s.names || {};
  if (nm.ks || (s.v && s.v.ks_chinh)) ws.getCell('B102').value = 'Họ tên: ' + (nm.ks || s.v.ks_chinh);
  if (nm.kh || (s.v && s.v.dai_dien)) { const c = ws.getCell('F102'); c.value = 'Họ tên: ' + (nm.kh || s.v.dai_dien); c.font = ws.getCell('B102').font; c.alignment = ws.getCell('B102').alignment; }
  const d = s.v && s.v.ngay_ks;
  if (d) { const [y, m, dd] = d.split('-'); const t = `Ngày:  ${dd} / ${m} / ${y}`; if (sig.ks) ws.getCell('B103').value = t; if (sig.kh) ws.getCell('F103').value = t; }

  // Sheet ảnh theo từng mục
  const photoItems = ALL_ITEMS.filter(it => s.ph && s.ph[it.k] && s.ph[it.k].length);
  if (photoItems.length) {
    const ps = wb.addWorksheet('Ảnh theo mục', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ps.columns = [{ width: 10 }, { width: 34 }, { width: 30 }, { width: 62 }];
    const hdr = ps.addRow(['Số ảnh', 'Mục khảo sát', 'Giá trị ghi nhận', 'Hình ảnh']);
    hdr.font = { name: 'Times New Roman', bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    hdr.height = 22;
    for (const it of photoItems) {
      for (let i = 0; i < s.ph[it.k].length; i++) {
        const p = s.ph[it.k][i];
        const row = ps.addRow([it.code + '-' + (i + 1), it.l + (p.note ? '\n' + p.note : ''), itemDisplay(it, s)]);
        row.height = 170;
        row.font = { name: 'Times New Roman', size: 11 };
        row.eachCell({ includeEmpty: true }, c => { c.alignment = { vertical: 'top', wrapText: true }; c.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } } }; });
        await place(ps, p, 3, row.number - 1, COLPX(62), Math.round(170 * 96 / 72));
      }
    }
  }
  return wb.xlsx.writeBuffer();
}

async function buildSummary(ExcelJS, list) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tổng hợp khảo sát', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });
  const cols = [{ h: 'Mã khảo sát', g: '', w: 16 }, { h: 'Cập nhật', g: '', w: 16 }]
    .concat(ALL_ITEMS.map(it => ({ h: it.code + ' ' + it.l, g: it.sec, w: it.t === 'area' ? 40 : 22, it })))
    .concat([{ h: 'Số ảnh', g: '', w: 9 }, { h: 'Hoàn thành', g: '', w: 11 }]);
  ws.columns = cols.map(c => ({ width: c.w }));
  const secTitle = Object.fromEntries(SECTIONS.map(s => [s.id, s.id + '. ' + s.title.toUpperCase()]));
  const r1 = ws.addRow(cols.map(c => c.g ? secTitle[c.g] : ''));
  const r2 = ws.addRow(cols.map(c => c.h));
  // gộp ô nhóm mục
  let start = 0;
  for (let i = 1; i <= cols.length; i++) {
    if (i === cols.length || cols[i].g !== cols[start].g) { if (cols[start].g && i - 1 > start) ws.mergeCells(1, start + 1, 1, i); start = i; }
  }
  [r1, r2].forEach((r, idx) => { r.height = idx ? 48 : 20; r.eachCell({ includeEmpty: true }, c => { c.font = { name: 'Times New Roman', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx ? 'FF2E75B6' : 'FF1F4E79' } }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; }); });
  for (const s of list) {
    const vals = [s.code, s.updatedAt ? new Date(s.updatedAt).toLocaleString('vi-VN') : '']
      .concat(ALL_ITEMS.map(it => { const v = s.v && s.v[it.k]; if (!it.o && (it.t === 'num' || it.t === 'money') && v !== '' && v != null && !isNaN(Number(v))) return Number(v); return itemDisplay(it, s); }))
      .concat([photoCount(s), completion(s) / 100]);
    const row = ws.addRow(vals);
    row.font = { name: 'Times New Roman', size: 10 };
    row.eachCell({ includeEmpty: true }, (c, i) => { c.alignment = { vertical: 'top', wrapText: true }; c.border = { bottom: { style: 'hair', color: { argb: 'FFBFBFBF' } } }; const it = cols[i - 1].it; if (it && it.t === 'money') c.numFmt = '#,##0'; });
    row.getCell(cols.length).numFmt = '0%';
  }
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };
  return wb.xlsx.writeBuffer();
}

function photoCount(s) {
  let n = 0; for (const k in (s.ph || {})) n += s.ph[k].length;
  for (const k in (s.slots || {})) if (s.slots[k]) n++;
  return n;
}
function completion(s) {
  const f = ALL_ITEMS.filter(it => isFilled(it, s)).length;
  return Math.round(f / ALL_ITEMS.length * 100);
}
