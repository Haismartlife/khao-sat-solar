// Xuất biên bản BM01 ra PDF: dựng các trang A4 bằng HTML, chụp bằng html2canvas, ghép bằng jsPDF.
const PDF_CSS = `
.pdfroot{position:absolute;left:-12000px;top:0;width:794px;font-family:"Tinos","Times New Roman",serif;color:#111;background:#fff}
.pdfroot *{box-sizing:border-box}
.pg{width:794px;height:1123px;padding:38px 42px 30px;background:#fff;position:relative;overflow:hidden;margin-bottom:10px}
.pg .ct{height:1025px;overflow:hidden}
.pg .ft{position:absolute;left:42px;right:42px;bottom:20px;font-size:10px;color:#666;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:4px}
.hd{display:flex;gap:14px;align-items:center;border-bottom:2px solid #1f4e79;padding-bottom:8px}
.hd img{width:64px;height:64px}
.hd .co{flex:1;font-size:11px;line-height:1.45}
.hd .co b{font-size:13px;color:#1f4e79}
.ttl{text-align:center;padding:12px 0 6px}
.ttl h1{font-size:21px;margin:0;color:#1f4e79;letter-spacing:.02em;line-height:1.3}
.ttl p{margin:4px 0 0;font-size:12px;font-style:italic;color:#444}
.meta{display:flex;justify-content:space-between;font-size:11.5px;margin:4px 0 8px}
.part{background:#1f4e79;color:#fff;font-weight:700;font-size:13px;padding:6px 10px;margin-top:10px}
.sh{background:#dbe7f3;color:#1f4e79;font-weight:700;font-size:12.5px;padding:5px 10px;border:1px solid #9fb8d3;margin-top:8px}
.r{display:grid;grid-template-columns:34px 250px 1fr;border:1px solid #c9d3dd;border-top:0;font-size:12px;line-height:1.35}
.r>div{padding:5px 7px;min-height:26px}
.r .n{text-align:center;border-right:1px solid #c9d3dd;color:#1f4e79;font-weight:700}
.r .l{border-right:1px solid #c9d3dd;font-weight:700}
.r.sub .l{font-weight:400;font-style:italic;padding-left:18px}
.r .v{white-space:pre-wrap;word-break:break-word}
.r.wide{grid-template-columns:200px 1fr}
.r.wide .l{border-right:1px solid #c9d3dd}
.opt{display:inline-flex;align-items:center;gap:4px;margin-right:12px;white-space:nowrap;line-height:1.6}
.cb{display:inline-block;width:11px;height:11px;border:1.2px solid #333;position:relative;vertical-align:middle}
.cb.on{border-color:#1f4e79;background:#1f4e79}
.cb.on i{position:absolute;left:3px;top:0px;width:3px;height:7px;border:solid #fff;border-width:0 1.6px 1.6px 0;transform:rotate(45deg)}
.mode{font-size:11px;font-style:italic;color:#555;padding:4px 2px}
.ph2{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #c9d3dd;border-top:0}
.ph2>div{border-right:1px solid #c9d3dd}
.ph2>div:last-child{border-right:0}
.pt{background:#f1f5f9;font-weight:700;font-size:11.5px;padding:4px 8px;border-bottom:1px solid #c9d3dd;color:#1f4e79}
.pb{display:flex;align-items:center;justify-content:center;background:#fafafa;color:#999;font-size:11px;font-style:italic}
.cap{font-size:10.5px;padding:3px 8px 5px;color:#333;line-height:1.35}
.sig{display:grid;grid-template-columns:1fr 1fr;margin-top:16px;text-align:center;font-size:12px}
.sig b{font-size:13px}
.sig .sb{height:96px;display:flex;align-items:center;justify-content:center}
.note{font-size:10.5px;font-style:italic;color:#555;text-align:center;margin-top:10px}
`;

function pdfFit(ref, bw, bh) { if (!ref || !ref.w) return { width: bw, height: bh }; const k = Math.min(bw / ref.w, bh / ref.h); return { width: Math.round(ref.w * k), height: Math.round(ref.h * k) }; }
function pdfImg(ref, bw, bh, src) {
  if (!ref) return `<div class="pb" style="height:${bh}px">[ Chưa có ảnh ]</div>`;
  const f = pdfFit(ref, bw - 8, bh - 8);
  return `<div class="pb" style="height:${bh}px"><img src="${src(ref.id)}" style="width:${f.width}px;height:${f.height}px"></div>`;
}
function pdfVal(it, s) {
  if (it.o) {
    const sel = (s.c && s.c[it.k]) || []; const extra = (s.x && s.x[it.k]) || '';
    return it.o.map(optInfo).map(o => { const on = sel.includes(o.label); let t = o.label; if (o.other) t += on && extra ? ': ' + extra + (it.ou ? ' ' + it.ou : '') : (o.token.includes('_') ? ': ______' : ''); return `<span class="opt"><span class="cb ${on ? 'on' : ''}"><i></i></span>${esc(t)}</span>`; }).join('');
  }
  const d = itemDisplay(it, s);
  return esc(d ? d + (it.t === 'money' ? ' đ' : '') : '');
}

function pdfBlocks(s, src, logo) {
  const B = [];
  const v = s.v || {};
  B.push(`<div class="hd"><img src="${logo}"><div class="co"><b>CÔNG TY TNHH ĐẦU TƯ CHUYỂN GIAO CÔNG NGHỆ TOÀN CẦU</b><br>16 Đường số 15, Khu đô thị An Phú An Khánh, Bình Trưng, Tp. Hồ Chí Minh<br>+84 76 947 8010 | hainq@gitt.vn | www.gitt.vn</div></div>
  <div class="ttl"><h1>BIÊN BẢN KHẢO SÁT<br>CÔNG TRÌNH ĐIỆN MẶT TRỜI</h1><p>Solar Rooftop Site Survey Report — BM01</p></div>
  <div class="meta"><span>Mã hồ sơ: <b>${esc(s.code)}</b></span><span>Ngày khảo sát: <b>${esc(itemDisplay(ALL_ITEMS.find(i => i.k === 'ngay_ks'), s) || '…………')}</b></span></div>
  <div class="part">◆ PHẦN 1: BẢNG THÔNG SỐ KHẢO SÁT</div>`);
  for (const sec of SECTIONS) {
    const head = `<div class="sh">${sec.id}. ${esc(sec.title.toUpperCase())}</div>`;
    const rows = sec.items.map(it => {
      if (sec.id === 'V') return `<div class="r wide"><div class="l">${esc(it.l)}</div><div class="v">${pdfVal(it, s)}</div></div>`;
      return `<div class="r ${it.sub ? 'sub' : ''}"><div class="n">${it.sub ? '' : esc(it.n)}</div><div class="l">${esc(it.l)}</div><div class="v">${pdfVal(it, s)}</div></div>`;
    });
    if (sec.id === 'VI') rows.unshift(`<div class="mode">Phương thức: ${v.vi_mode === 'auto' ? 'Tự động đề xuất theo điện năng tiêu thụ / tiền điện hàng tháng · hệ ' + sysType(s) : 'Kỹ sư tự điền'}</div>`);
    B.push(head + rows[0]); rows.slice(1).forEach(r => B.push(r));
  }
  const slot = k => SLOTS.find(x => x.k === k);
  const pair = (a, b, first) => `${first ? '<div class="part">◆ PHẦN 2: HÌNH ẢNH KHẢO SÁT</div><div style="height:8px"></div>' : ''}<div class="ph2" style="border-top:1px solid #c9d3dd">${[a, b].map(k => { const sl = slot(k); return `<div><div class="pt">${sl.n}  ${esc(sl.l)}</div>${pdfImg(s.slots && s.slots[k], 354, 220, src)}</div>`; }).join('')}</div>`;
  B.push(pair('s1', 's2', 1)); B.push(pair('s3', 's4')); B.push(pair('s5', 's6'));
  B.push(`<div class="part">◆ PHẦN 3: BẢN VẼ SƠ ĐỒ MẶT BẰNG MÁI</div><div class="mode" style="text-align:center">(Sketch / AutoCAD / Vẽ tay – kèm phương hướng, kích thước, vị trí vật cản)</div><div style="border:1px solid #c9d3dd">${pdfImg(s.slots && s.slots.sketch, 708, 300, src)}</div>`);
  const sig = s.sig || {}, nm = s.names || {};
  const d = itemDisplay(ALL_ITEMS.find(i => i.k === 'ngay_ks'), s) || '…… / …… / …………';
  const sb = (ref) => ref ? pdfImg(ref, 260, 96, src).replace('class="pb"', 'class="sb"').replace('background:#fafafa', '') : '<div class="sb"></div>';
  B.push(`<div class="sig"><div><b>NGƯỜI KHẢO SÁT</b><br><i>(Ký và ghi rõ họ tên)</i>${sb(sig.ks)}Họ tên: <b>${esc(nm.ks || v.ks_chinh || '………………………')}</b><br>Ngày: ${esc(d)}</div><div><b>ĐẠI DIỆN KHÁCH HÀNG</b><br><i>(Ký và ghi rõ họ tên)</i>${sb(sig.kh)}Họ tên: <b>${esc(nm.kh || v.dai_dien || '………………………')}</b><br>Ngày: ${esc(d)}</div></div>
  <div class="note">* Các trường đánh dấu (*) là bắt buộc điền · Hồ sơ lưu: Sales + Kỹ thuật + Kế toán · BM01 – Lưu hành nội bộ</div>`);
  // Ảnh theo từng mục
  const list = [];
  for (const it of ALL_ITEMS) (s.ph && s.ph[it.k] || []).forEach((p, i) => list.push({ it, p, i }));
  if (list.length) {
    B.push({ brk: 1 });
    for (let i = 0; i < list.length; i += 2) {
      const cell = x => x ? `<div><div class="pt">${esc(x.it.code)}-${x.i + 1}  ${esc(x.it.l)}</div>${pdfImg(x.p, 354, 250, src)}<div class="cap">${esc(itemDisplay(x.it, s))}${x.p.note ? (itemDisplay(x.it, s) ? ' · ' : '') + esc(x.p.note) : ''}</div></div>` : '<div></div>';
      B.push(`${i === 0 ? '<div class="part">◆ PHỤ LỤC: ẢNH THEO TỪNG MỤC KHẢO SÁT</div><div style="height:8px"></div>' : ''}<div class="ph2" style="border-top:1px solid #c9d3dd;margin-bottom:8px">${cell(list[i])}${cell(list[i + 1])}</div>`);
    }
  }
  return B;
}

async function buildPDF(s, opt) {
  const { src, logo, html2canvas, jsPDF } = opt;
  if (!document.getElementById('pdfcss')) { const st = document.createElement('style'); st.id = 'pdfcss'; st.textContent = PDF_CSS; document.head.appendChild(st); }
  try { await Promise.all(['400 12px Tinos', '700 12px Tinos', 'italic 400 12px Tinos'].map(f => document.fonts.load(f, 'Biên bản khảo sát'))); } catch (e) {}
  const root = document.createElement('div'); root.className = 'pdfroot'; document.body.appendChild(root);
  try {
    const pages = [];
    const newPage = () => { const pg = document.createElement('div'); pg.className = 'pg'; pg.innerHTML = '<div class="ct"></div><div class="ft"></div>'; root.appendChild(pg); pages.push(pg); return pg.firstChild; };
    let ct = newPage();
    for (const b of pdfBlocks(s, src, logo)) {
      if (b.brk) { if (ct.childElementCount) ct = newPage(); continue; }
      const w = document.createElement('div'); w.innerHTML = b; ct.appendChild(w);
      if (ct.scrollHeight > ct.clientHeight + 1 && ct.childElementCount > 1) { ct.removeChild(w); ct = newPage(); ct.appendChild(w); }
    }
    pages.forEach((pg, i) => { pg.lastChild.innerHTML = `<span>BM01 · ${esc(s.code)}${s.v && s.v.ten_cty ? ' · ' + esc(s.v.ten_cty) : ''}</span><span>Trang ${i + 1}/${pages.length}</span>`; });
    await Promise.all([...root.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < pages.length; i++) {
      const cv = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, 210, 297);
      if (opt.onProgress) opt.onProgress(i + 1, pages.length);
    }
    return pdf.output('blob');
  } finally { root.remove(); }
}
