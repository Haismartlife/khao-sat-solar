// =====================================================================
// TỰ ĐỘNG ĐỀ XUẤT THÔNG SỐ KỸ THUẬT (mục VI)
// Mô hình theo bước 15 phút cho một ngày điển hình (3 kiểu ngày nắng),
// so khớp đường phát PV với đường phụ tải để ra điện tự dùng, điện dư,
// điện sạc/xả pin; tính tiền tiết kiệm theo biểu giá EVN thực tế
// (bậc thang cho sinh hoạt, 3 khung giờ cho kinh doanh/sản xuất);
// hoàn vốn theo dòng tiền từng năm.
// Mọi giả định chỉnh được trên form (s.calc). Ô kết quả kỹ sư sửa tay
// được đánh dấu s.ov[k] và giữ nguyên; các ô khác tính lại theo.
// =====================================================================

// Biểu giá bán lẻ điện theo QĐ 1279/QĐ-BCT (hiệu lực 10/5/2025), chưa gồm VAT
const TIERS_SH = [[50, 1984], [50, 2050], [100, 2380], [100, 2998], [100, 3350], [Infinity, 3460]];
const TOU = { // cấp điện áp dưới 6 kV
  kd: { bt: 3152, cd: 5422, td: 1918 },
  sx: { bt: 1987, cd: 3640, td: 1300 },
};
// Khung giờ theo QĐ 963/QĐ-BCT (hiệu lực 22/4/2026): cao điểm 17h30–22h30 (thứ 2–7),
// thấp điểm 0h–6h, còn lại bình thường; Chủ nhật không có cao điểm.
const REGIONS = {
  nam: { l: 'Miền Nam', psh: 4.8 },
  ntb: { l: 'Nam Trung Bộ – Tây Nguyên', psh: 5.2 },
  btb: { l: 'Bắc Trung Bộ', psh: 4.3 },
  bac: { l: 'Miền Bắc', psh: 3.6 },
};
const CALC_DEFAULTS = {
  pr: 80,            // % hiệu suất hệ thống (nhiệt độ, bụi, dây, inverter…)
  ty_le_ngay: 70, ty_le_ca: 50, ty_le_dem: 25, // % điện dùng 6h–18h
  wp: 625, m2_tam: 3.1, dc_ac: 1.2,
  scr_min: 75,       // % tự dùng tối thiểu khi không bán điện dư
  vat: 8,
  gia_ban_du: 0,     // đ/kWh nhận được cho điện dư phát lên lưới (0 = không phát lên lưới)
  suat_dt: 10000000, suat_dt_hyb: 12000000, // đ/kWp
  suat_pin: 6000000, // đ/kWh
  dod: 90, eta_pin: 96, module: 5.12,
  tang_gia: 3, suy_giam: 0.5, om: 0.5,       // %/năm
};
const CALC_FIELDS = [
  { k: 'vung', l: 'Vùng bức xạ', opts: Object.entries(REGIONS).map(([k, r]) => [k, `${r.l} (${r.psh})`]) },
  { k: 'psh', l: 'Bức xạ trung bình', u: 'kWh/m²/ngày', hint: 'Tra Global Solar Atlas để chính xác theo địa điểm' },
  { k: 'pr', l: 'Hiệu suất hệ thống (PR)', u: '%' },
  { k: 'f_huong', l: 'Hệ số hướng & độ nghiêng', u: '%', hint: 'Tự tính theo mục III.3, III.4' },
  { k: 'ty_le', l: 'Điện dùng ban ngày (6h–18h)', u: '%', hint: 'Mặc định theo mục II.12' },
  { k: 'wp', l: 'Công suất 1 tấm pin', u: 'Wp' },
  { k: 'dc_ac', l: 'Tỷ lệ DC/AC chọn inverter', u: 'lần' },
  { k: 'scr_min', l: 'Tỷ lệ tự dùng tối thiểu', u: '%', hint: 'Giới hạn công suất để không dư điện quá nhiều' },
  { k: 'gia_bt', l: 'Giá giờ bình thường', u: 'đ/kWh', money: 1, tou: 1 },
  { k: 'gia_cd', l: 'Giá giờ cao điểm', u: 'đ/kWh', money: 1, tou: 1 },
  { k: 'gia_td', l: 'Giá giờ thấp điểm', u: 'đ/kWh', money: 1, tou: 1 },
  { k: 'vat', l: 'Thuế VAT tiền điện', u: '%' },
  { k: 'gia_ban_du', l: 'Giá bán điện dư lên lưới', u: 'đ/kWh', money: 1, hint: '0 = hệ không phát lên lưới' },
  { k: 'suat_dt', l: 'Suất đầu tư PV + inverter', u: 'đ/kWp', money: 1 },
  { k: 'pin_cover', l: 'Điện ban đêm lấy từ pin', u: '%', hyb: 1, hint: 'Mặc định: phủ giờ cao điểm 17h30–22h30' },
  { k: 'suat_pin', l: 'Suất đầu tư pin lưu trữ', u: 'đ/kWh', money: 1, hyb: 1 },
  { k: 'tang_gia', l: 'Giá điện tăng mỗi năm', u: '%' },
  { k: 'suy_giam', l: 'Suy giảm tấm pin mỗi năm', u: '%' },
  { k: 'om', l: 'Chi phí vận hành bảo trì', u: '%/năm', hint: '% vốn đầu tư' },
];
const INV_SIZES = [3, 3.6, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 33, 36, 40, 50, 60, 75, 80, 100, 110, 125];
const AUTO_KEYS = ['tam_de_xuat', 'cs_de_xuat', 'inverter', 'pin_de_xuat', 'san_luong', 'hoan_von'];

function sysType(s) {
  const lh = ((s.c && s.c.loai_he) || [])[0] || '';
  if (/Hybrid/.test(lh)) return 'Hybrid';
  if (/Off-grid/.test(lh)) return 'Off-grid';
  return 'On-grid';
}
function tariffType(s) {
  const g = ((s.c && s.c.gia_dien) || [])[0];
  return g === 'Kinh doanh' ? 'kd' : g === 'Sản xuất' ? 'sx' : 'sh';
}
function userBattery(s) {
  const sel = (s.c && s.c.luu_tru) || [];
  if (!sel.includes('Có – Dung lượng')) return 0;
  const n = Number(String((s.x && s.x.luu_tru) || '').replace(',', '.'));
  return n > 0 ? n : 0;
}
function regionFromGeo(s) {
  const lat = Number(s.geo && s.geo.lat);
  if (!lat) return 'nam';
  return lat < 11.6 ? 'nam' : lat < 16 ? 'ntb' : lat < 19.8 ? 'btb' : 'bac';
}
// Hệ số hướng & độ nghiêng mái so với mái hướng Nam nghiêng 10–15° (vĩ độ Việt Nam)
function orientFactor(s) {
  const tiltSel = ((s.c && s.c.do_doc) || [])[0] || '';
  const dirSel = ((s.c && s.c.huong_mai) || [])[0] || '';
  const dirTxt = dirSel === 'Khác' ? String((s.x && s.x.huong_mai) || '') : dirSel;
  let dir = 'nam';
  if (/Bắc/i.test(dirTxt)) dir = 'bac';
  else if (/Đông Nam|Tây Nam/i.test(dirTxt)) dir = 'dn';
  else if (/Đông|Tây/i.test(dirTxt)) dir = 'dt';
  let tilt = 'm';
  if (/0°/.test(tiltSel)) tilt = 'flat';
  else if (/30/.test(tiltSel)) tilt = 'h';
  else if (tiltSel === 'Khác') { const t = Number(String((s.x && s.x.do_doc) || '').replace(/[^\d.]/g, '')); if (t <= 3) tilt = 'flat'; else if (t >= 25) tilt = 'h'; }
  const T = { flat: { nam: 96, dn: 96, dt: 96, bac: 96 }, m: { nam: 100, dn: 98, dt: 93, bac: 87 }, h: { nam: 97, dn: 95, dt: 87, bac: 75 } };
  const name = { nam: 'Nam', dn: 'Đông/Tây Nam', dt: 'Đông/Tây', bac: 'Bắc' }[dir];
  const tl = { flat: 'mái phẳng', m: 'nghiêng 10–15°', h: 'nghiêng ~30°' }[tilt];
  return { f: T[tilt][dir], label: tilt === 'flat' ? 'mái phẳng' : `hướng ${name}, ${tl}` };
}

function calcParams(s) {
  const c = s.calc || {};
  const D = CALC_DEFAULTS, tt = tariffType(s), type = sysType(s);
  const tg = ((s.c && s.c.tg_dung_dien) || [])[0];
  const vungAuto = regionFromGeo(s);
  const vung = REGIONS[c.vung] ? c.vung : vungAuto;
  const of = orientFactor(s);
  const def = {
    psh: REGIONS[vung].psh, pr: D.pr, f_huong: of.f,
    ty_le: tg === 'Ban đêm' ? D.ty_le_dem : tg === 'Cả ngày lẫn đêm' ? D.ty_le_ca : D.ty_le_ngay,
    wp: D.wp, dc_ac: D.dc_ac, scr_min: D.scr_min, vat: D.vat, gia_ban_du: D.gia_ban_du,
    gia_bt: (TOU[tt] || TOU.kd).bt, gia_cd: (TOU[tt] || TOU.kd).cd, gia_td: (TOU[tt] || TOU.kd).td,
    suat_dt: type === 'On-grid' ? D.suat_dt : D.suat_dt_hyb,
    pin_cover: type === 'Off-grid' ? 100 : 40, suat_pin: D.suat_pin,
    tang_gia: D.tang_gia, suy_giam: D.suy_giam, om: D.om,
  };
  const P = { _def: Object.assign({ vung: vungAuto }, def), vung, vungAuto, orient: of, tt, type };
  const zeroOk = { gia_ban_du: 1, tang_gia: 1, om: 1, suy_giam: 1, vat: 1 };
  for (const k in def) {
    const raw = c[k]; const n = Number(raw);
    P[k] = raw === '' || raw == null || isNaN(n) || (n <= 0 && !zeroOk[k]) || n < 0 ? def[k] : n;
  }
  return P;
}

// ---------- tiền điện ----------
function billSH(kwh, vat) { let rest = Math.max(0, kwh), sum = 0; for (const [q, p] of TIERS_SH) { const u = Math.min(rest, q); sum += u * p; rest -= u; if (rest <= 0) break; } return sum * (1 + vat / 100); }
function kwhFromBillSH(bill, vat) { let lo = 0, hi = 1e7; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (billSH(m, vat) < bill) lo = m; else hi = m; } return lo; }
// Giá theo thời điểm trong ngày (giờ thập phân), bình quân tuần (6 ngày có cao điểm / 7)
function touPrice(t, P) {
  if (t < 6) return P.gia_td;
  if (t >= 17.5 && t < 22.5) return (6 * P.gia_cd + P.gia_bt) / 7;
  return P.gia_bt;
}

// ---------- mô phỏng ----------
const DT = 0.25;
const DAY_TYPES = [{ w: 0.4, f: 1.3 }, { w: 0.35, f: 1.0 }, { w: 0.25, f: 0.52 }]; // nắng / trung bình / nhiều mây
const SHAPE = (() => { let a = 0; for (let t = 6; t < 18; t += DT) a += Math.pow(Math.sin(Math.PI * (t + DT / 2 - 6) / 12), 1.5) * DT; return a; })();
// Phụ tải: phần "ban ngày" rải đều 6h–18h, phần còn lại rải đều 18h–6h (bắt đầu từ 18h)
function simulate(o) {
  // o: kwp, acKw, Y (kWh/kWp/ngày), dayLoad, nightLoad (kWh/ngày), battUse (kWh xả được), P, tou(bool)
  const eta = CALC_DEFAULTS.eta_pin / 100;
  const pDay = o.dayLoad / 12, pNight = o.nightLoad / 12;
  const p0 = o.Y / SHAPE;
  const r = { pv: 0, dc: 0, self: 0, surplus: 0, charge: 0, dis: 0, exp: 0, saveTou: 0, disTou: 0 };
  for (const d of DAY_TYPES) {
    let pv = 0, dc = 0, self = 0, sur = 0, selfVal = 0;
    for (let t = 6; t < 18; t += DT) {
      const pdc = o.kwp * p0 * d.f * Math.pow(Math.sin(Math.PI * (t + DT / 2 - 6) / 12), 1.5);
      const pac = Math.min(pdc, o.acKw);
      dc += pdc * DT; pv += pac * DT;
      const u = Math.min(pac, pDay); self += u * DT; sur += (pac - u) * DT;
      selfVal += u * DT * touPrice(t + DT / 2, o.P);
    }
    const charge = Math.min(sur, o.battUse / eta);       // năng lượng từ PV vào pin
    let avail = charge * eta, dis = 0, disVal = 0;     // năng lượng pin xả ra
    for (let k = 0; k < 48 && avail > 1e-9; k++) {        // xả từ 18h đến 6h sáng
      const t = (18 + k * DT) % 24; const e = Math.min(avail, pNight * DT);
      avail -= e; dis += e; disVal += e * touPrice(t + DT / 2, o.P);
    }
    const w = d.w * 365;
    r.pv += w * pv; r.dc += w * dc; r.self += w * self; r.surplus += w * sur; r.charge += w * charge;
    r.dis += w * dis; r.exp += w * (sur - charge); r.saveTou += w * selfVal; r.disTou += w * disVal;
  }
  r.clip = r.dc > 0 ? (1 - r.pv / r.dc) * 100 : 0;
  r.scr = r.pv > 0 ? (r.self + r.charge) / r.pv * 100 : 0; // tỷ lệ tự dùng (kể cả sạc pin)
  return r;
}
function pickInverter(kwp, dcac) { const a = kwp / dcac; return INV_SIZES.find(x => x >= a) || Math.ceil(a); }
function parseKw(txt) { const m = String(txt || '').match(/([\d]+(?:[.,]\d+)?)\s*kW(?!p)/i); return m ? Number(m[1].replace(',', '.')) : 0; }
const n2 = x => String(Math.round(x * 100) / 100).replace('.', ',');
const n1 = x => String(Math.round(x * 10) / 10).replace('.', ',');
function fmtN(n) { return Number(n).toLocaleString('vi-VN'); }
const tr = x => fmtN(Math.round(x / 1e5) / 10) + ' tr';

function autoPropose(s) {
  const v = s.v || {}, ov = s.ov || {};
  const P = calcParams(s), D = CALC_DEFAULTS, tt = P.tt, type = P.type, hyb = type !== 'On-grid';
  const vatK = 1 + P.vat / 100;
  const kwh = Number(v.kwh_thang) || 0, tien = Number(v.tien_dien) || 0;
  const steps = [], notes = [];

  // 1. Nhu cầu
  let eMonth;
  if (kwh > 0) { eMonth = kwh; steps.push(`Nhu cầu: ${fmtN(kwh)} kWh/tháng (mục II.9).`); }
  else if (tien > 0) {
    if (tt === 'sh') { eMonth = kwhFromBillSH(tien, P.vat); steps.push(`Nhu cầu: hóa đơn ${fmtN(tien)} đ/tháng, quy đổi ngược theo 6 bậc giá sinh hoạt (gồm VAT ${P.vat}%) ≈ ${fmtN(Math.round(eMonth))} kWh/tháng.`); }
    else {
      const avg = (P.ty_le / 100) * P.gia_bt + ((100 - P.ty_le) / 100) * ((4.5 * (6 * P.gia_cd + P.gia_bt) / 7 + 1.5 * P.gia_bt + 6 * P.gia_td) / 12);
      eMonth = tien / (avg * vatK);
      steps.push(`Nhu cầu: hóa đơn ${fmtN(tien)} đ/tháng ÷ giá bình quân theo khung giờ ${fmtN(Math.round(avg * vatK))} đ/kWh (gồm VAT) ≈ ${fmtN(Math.round(eMonth))} kWh/tháng.`);
    }
  } else return { ok: false, msg: 'Nhập "Điện năng tiêu thụ hàng tháng" (II.9) hoặc "Tổng chi phí tiền điện" (II.10) để tự tính.' };

  const dayLoad = eMonth * 12 / 365 * P.ty_le / 100, nightLoad = eMonth * 12 / 365 * (100 - P.ty_le) / 100;
  steps.push(`Phụ tải: ban ngày 6h–18h ≈ ${fmtN(Math.round(dayLoad))} kWh/ngày (${P.ty_le}%), ban đêm ≈ ${fmtN(Math.round(nightLoad))} kWh/ngày.`);

  // 2. Sản lượng riêng
  const Y = P.psh * P.pr / 100 * P.f_huong / 100;
  steps.push(`Sản lượng riêng: bức xạ ${n1(P.psh)} kWh/m²/ngày (${REGIONS[P.vung].l}) × PR ${P.pr}% × hệ số ${P.orient.label} ${P.f_huong}% = ${n2(Y)} kWh/kWp/ngày ≈ ${fmtN(Math.round(Y * 365))} kWh/kWp/năm.`);

  // 3. Pin lưu trữ
  let batt = 0;
  if (hyb) {
    const ub = userBattery(s);
    if (ub) { batt = ub; steps.push(`Pin lưu trữ: ${n2(batt)} kWh theo mục IV.9.`); }
    else if (ov.pin_de_xuat && Number(v.pin_de_xuat) > 0) { batt = Number(v.pin_de_xuat); steps.push(`Pin lưu trữ (kỹ sư nhập): ${n2(batt)} kWh.`); }
    else {
      const need = nightLoad * P.pin_cover / 100 / (D.dod / 100);
      batt = Math.round(Math.max(1, Math.ceil(need / D.module)) * D.module * 100) / 100;
      steps.push(`Pin lưu trữ: ${fmtN(Math.round(nightLoad))} kWh đêm × ${P.pin_cover}% ÷ DoD ${D.dod}% ≈ ${n2(need)} kWh → ${Math.round(batt / D.module)} module × ${n2(D.module)} kWh = ${n2(batt)} kWh.`);
    }
  }
  const battUse = batt * D.dod / 100;
  const eta = D.eta_pin / 100;

  // 4. Công suất PV
  const dt = Number(v.dt_lap) || 0;
  const maxRoof = dt > 0 ? Math.floor(dt / D.m2_tam) : Infinity;
  const kwpMatch = (dayLoad + (hyb ? battUse / eta / eta : 0)) / Y;
  const nMatch = Math.max(1, Math.ceil(kwpMatch * 1000 / P.wp));
  const invFor = kwp => (ov.inverter && parseKw(v.inverter)) ? parseKw(v.inverter) : pickInverter(kwp, P.dc_ac);
  const run = n => { const kwp = n * P.wp / 1000; return simulate({ kwp, acKw: invFor(kwp), Y, dayLoad, nightLoad, battUse: hyb ? battUse : 0, P, tou: tt !== 'sh' }); };
  let panels;
  if (ov.tam_de_xuat && Number(v.tam_de_xuat) > 0) { panels = Math.round(Number(v.tam_de_xuat)); steps.push(`Số tấm (kỹ sư chọn): ${panels} tấm.`); }
  else if (ov.cs_de_xuat && Number(v.cs_de_xuat) > 0) { panels = Math.ceil(Number(v.cs_de_xuat) * 1000 / P.wp); }
  else {
    panels = nMatch;
    let txt = `Công suất theo điện năng: ${fmtN(Math.round(dayLoad))}${hyb ? ` + sạc pin ${fmtN(Math.round(battUse / eta / eta))}` : ''} kWh ÷ ${n2(Y)} ≈ ${n2(kwpMatch)} kWp (${nMatch} tấm).`;
    if (P.gia_ban_du <= 0 && type !== 'Off-grid') {
      let n = nMatch, r = run(n);
      if (r.scr < P.scr_min) {
        let lo = 1, hi = nMatch; // tìm số tấm lớn nhất còn đạt tỷ lệ tự dùng tối thiểu
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (run(mid).scr >= P.scr_min) lo = mid; else hi = mid - 1; }
        n = lo;
        txt += ` Vì đỉnh nắng trưa vượt phụ tải và hệ không bán điện dư, giảm còn ${n} tấm để tỷ lệ tự dùng ≥ ${P.scr_min}%.`;
      }
      panels = n;
    }
    if (panels > maxRoof) { notes.push(`Diện tích mái ${fmtN(dt)} m² chỉ đặt được khoảng ${maxRoof} tấm (cần ${panels}) — đã giới hạn theo mái.`); panels = Math.max(1, maxRoof); }
    steps.push(txt);
  }
  const kwp = ov.cs_de_xuat && Number(v.cs_de_xuat) > 0 ? Number(v.cs_de_xuat) : Math.round(panels * P.wp / 10) / 100;
  if (!(ov.cs_de_xuat && Number(v.cs_de_xuat) > 0)) steps.push(`Công suất PV: ${panels} tấm × ${P.wp} Wp = ${n2(kwp)} kWp.`);

  // 5. Inverter
  const nguon = ((s.c && s.c.nguon_dien) || [])[0];
  let invKw, invTxt;
  if (ov.inverter && parseKw(v.inverter)) { invKw = parseKw(v.inverter); invTxt = v.inverter; steps.push(`Inverter (kỹ sư chọn): ${invTxt} → DC/AC = ${n2(kwp / invKw)}.`); }
  else {
    invKw = pickInverter(kwp, P.dc_ac);
    const phase = invKw <= 6 && nguon !== '3 pha' ? '1 pha' : '3 pha';
    invTxt = `${type} ${phase} ${n2(invKw)} kW`;
    steps.push(`Inverter: ${n2(kwp)} kWp ÷ DC/AC ${n2(P.dc_ac)} ≈ ${n2(kwp / P.dc_ac)} kW → chọn ${n2(invKw)} kW ${phase}.`);
  }
  if (invKw / kwp > 2) notes.push(`Inverter ${n2(invKw)} kW lớn hơn nhiều so với ${n2(kwp)} kWp PV — có thể tăng thêm tấm cho tận dụng inverter.`);
  if (kwp / invKw > 1.5) notes.push(`DC/AC = ${n2(kwp / invKw)} khá cao — kiểm tra giới hạn đầu vào DC của inverter.`);

  // 6. Mô phỏng năng lượng
  const sim = simulate({ kwp, acKw: invKw, Y, dayLoad, nightLoad, battUse: hyb ? battUse : 0, P, tou: tt !== 'sh' });
  const year = ov.san_luong && Number(v.san_luong) > 0 ? Number(v.san_luong) : Math.round(sim.pv);
  const k = sim.pv > 0 ? year / sim.pv : 1;
  const self = sim.self * k, dis = sim.dis * k, exp = sim.exp * k;
  steps.push(ov.san_luong ? `Sản lượng (kỹ sư nhập): ${fmtN(year)} kWh/năm.`
    : `Sản lượng năm đầu: ${fmtN(year)} kWh${sim.clip >= 0.05 ? ` (đã trừ ${n1(sim.clip)}% bị cắt do inverter ${n2(invKw)} kW)` : ' (không bị cắt bởi inverter)'}.`);
  steps.push(`Phân bổ: tự dùng trực tiếp ${fmtN(Math.round(self))} kWh${hyb ? `, qua pin ${fmtN(Math.round(dis))} kWh` : ''}, dư ${fmtN(Math.round(exp))} kWh${P.gia_ban_du > 0 ? ` (bán ${fmtN(P.gia_ban_du)} đ/kWh)` : ' (không phát lên lưới, bị giới hạn)'} → tỷ lệ tự dùng ${n1(sim.scr)}%.`);

  // 7. Tiết kiệm năm đầu
  let save;
  if (tt === 'sh') {
    const offM = (self + dis) / 12;
    save = (billSH(eMonth, P.vat) - billSH(eMonth - offM, P.vat)) * 12;
    steps.push(`Tiết kiệm: hóa đơn giảm từ ${fmtN(Math.round(billSH(eMonth, P.vat)))} còn ${fmtN(Math.round(billSH(eMonth - offM, P.vat)))} đ/tháng (cắt các bậc giá cao trước) ≈ ${tr(save)}/năm.`);
  } else {
    const sv = (sim.saveTou + sim.disTou) * k * vatK;
    save = sv;
    steps.push(`Tiết kiệm: điện tự dùng ban ngày tính giá giờ bình thường ${fmtN(Math.round(P.gia_bt * vatK))} đ/kWh${hyb ? `, điện xả từ pin tính theo khung giờ đêm (cao điểm 17h30–22h30: ${fmtN(Math.round(P.gia_cd * vatK))} đ/kWh)` : ''} ≈ ${tr(sv)}/năm (gồm VAT).`);
  }
  if (P.gia_ban_du > 0) save += exp * P.gia_ban_du;

  // 8. Đầu tư & hoàn vốn (dòng tiền từng năm)
  const dauTu = Number(v.dau_tu) || 0;
  const capex = dauTu > 0 ? dauTu : kwp * P.suat_dt + (hyb ? batt * P.suat_pin : 0);
  const om = capex * P.om / 100;
  let cum = 0, payback = 0, total25 = 0;
  for (let y = 1; y <= 30; y++) {
    const cf = save * Math.pow(1 - P.suy_giam / 100, y - 1) * Math.pow(1 + P.tang_gia / 100, y - 1) - om;
    if (y <= 25) total25 += cf;
    if (!payback && cum + cf >= capex) payback = y - 1 + (capex - cum) / cf;
    cum += cf;
  }
  if (ov.hoan_von && Number(v.hoan_von) > 0) payback = Number(v.hoan_von);
  steps.push(`Đầu tư: ${dauTu > 0 ? 'theo mức dự kiến (II.8)' : `${n2(kwp)} kWp × ${tr(P.suat_dt)}${hyb ? ` + ${n2(batt)} kWh × ${tr(P.suat_pin)}` : ''}`} = ${tr(capex)}.`);
  steps.push(payback
    ? `Hoàn vốn ≈ ${n1(payback)} năm${ov.hoan_von ? ' (kỹ sư nhập)' : ` (dòng tiền từng năm: giá điện +${P.tang_gia}%/năm, tấm pin suy giảm ${n1(P.suy_giam)}%/năm, O&M ${n1(P.om)}%/năm); lợi nhuận ròng 25 năm ≈ ${tr(total25 - capex)}`}.`
    : 'Không hoàn vốn trong 30 năm với các giả định hiện tại.');

  if (type === 'Off-grid' && (self + dis) < eMonth * 12 * 0.95) notes.push(`Hệ off-grid chỉ đáp ứng ≈ ${n1((self + dis) / (eMonth * 12) * 100)}% nhu cầu — cần tăng pin/PV hoặc có nguồn dự phòng.`);
  if (hyb && dis < battUse * 365 * 0.6) notes.push(`Pin chỉ được sạc đầy khoảng ${n1(dis / (battUse * 365) * 100)}% công suất trung bình — PV dư ban ngày chưa đủ, cân nhắc tăng PV hoặc giảm pin.`);

  const out = { tam_de_xuat: panels, cs_de_xuat: kwp, inverter: invTxt, pin_de_xuat: hyb ? batt : '', san_luong: year, hoan_von: payback ? Math.round(payback * 10) / 10 : '' };
  return { ok: true, out, steps: steps.concat(notes.map(n => '⚠ ' + n)), hyb };
}
function applyAuto(s) {
  if (!s.v || s.v.vi_mode !== 'auto') return null;
  const r = autoPropose(s);
  if (r.ok) { const ov = s.ov || {}; for (const k of AUTO_KEYS) if (!ov[k]) s.v[k] = r.out[k]; }
  return r;
}
