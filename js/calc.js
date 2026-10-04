// Tự động đề xuất thông số kỹ thuật (mục VI) từ điện năng / tiền điện hàng tháng.
// Mọi giả định chỉnh được trên form (s.calc). Ô kết quả nào kỹ sư sửa tay được đánh dấu s.ov[k]
// và giữ nguyên; các ô còn lại tính lại theo giá trị đã sửa.
const CALC_DEFAULTS = {
  gia_sh: 3000, gia_kd: 3300, gia_sx: 2000,  // đ/kWh bình quân
  yield: 4.0,        // kWh/kWp/ngày (Nam ~4.0 · Trung ~3.8 · Bắc ~3.2), đã gồm tổn hao hệ thống
  ty_le_ngay: 70, ty_le_ca: 50, ty_le_dem: 25,
  wp: 625,           // Wp / tấm
  m2_tam: 3.1,       // m² mái cho 1 tấm 2382×1134 + lối đi
  dc_ac: 1.2,        // tỷ lệ DC/AC khi chọn inverter
  suat_dt: 10000000, // đ/kWp phần PV + inverter
  pin_cover: 50,     // % điện dùng ban đêm lấy từ pin (hybrid)
  suat_pin: 6000000, // đ/kWh pin lưu trữ
  dod: 90,           // % dung lượng pin sử dụng được
  module: 5.12,      // kWh / module pin
};
const CALC_FIELDS = [
  { k: 'gia', l: 'Giá điện bình quân', u: 'đ/kWh', money: 1 },
  { k: 'yield', l: 'Sản lượng riêng', u: 'kWh/kWp/ngày', hint: 'Nam ~4.0 · Trung ~3.8 · Bắc ~3.2' },
  { k: 'ty_le', l: 'Tỷ lệ điện dùng ban ngày', u: '%' },
  { k: 'wp', l: 'Công suất 1 tấm pin', u: 'Wp' },
  { k: 'dc_ac', l: 'Tỷ lệ DC/AC chọn inverter', u: 'lần' },
  { k: 'suat_dt', l: 'Suất đầu tư PV', u: 'đ/kWp', money: 1 },
  { k: 'pin_cover', l: 'Điện đêm lấy từ pin', u: '%', hyb: 1 },
  { k: 'suat_pin', l: 'Suất đầu tư pin lưu trữ', u: 'đ/kWh', money: 1, hyb: 1 },
];
const INV_SIZES = [3, 3.6, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 33, 36, 40, 50, 60, 75, 80, 100, 110, 125];
const AUTO_KEYS = ['tam_de_xuat', 'cs_de_xuat', 'inverter', 'pin_de_xuat', 'san_luong', 'hoan_von'];

function sysType(s) {
  const lh = ((s.c && s.c.loai_he) || [])[0] || '';
  if (/Hybrid/.test(lh)) return 'Hybrid';
  if (/Off-grid/.test(lh)) return 'Off-grid';
  return 'On-grid';
}
function userBattery(s) {
  const sel = (s.c && s.c.luu_tru) || [];
  if (!sel.includes('Có – Dung lượng')) return 0;
  const n = Number(String((s.x && s.x.luu_tru) || '').replace(',', '.'));
  return n > 0 ? n : 0;
}
function calcParams(s) {
  const c = s.calc || {};
  const gt = ((s.c && s.c.gia_dien) || [])[0];
  const tg = ((s.c && s.c.tg_dung_dien) || [])[0];
  const D = CALC_DEFAULTS;
  const def = {
    gia: gt === 'Kinh doanh' ? D.gia_kd : gt === 'Sản xuất' ? D.gia_sx : D.gia_sh,
    yield: D.yield, ty_le: tg === 'Ban đêm' ? D.ty_le_dem : tg === 'Cả ngày lẫn đêm' ? D.ty_le_ca : D.ty_le_ngay,
    wp: D.wp, dc_ac: D.dc_ac, suat_dt: D.suat_dt,
    pin_cover: sysType(s) === 'Off-grid' ? 100 : D.pin_cover, suat_pin: D.suat_pin,
  };
  const P = { _def: def };
  for (const k in def) { const n = Number(c[k]); P[k] = c[k] === '' || c[k] == null || isNaN(n) || n <= 0 ? def[k] : n; }
  return P;
}

// Mô phỏng một ngày nắng theo dạng sin^1.5 (6h–18h, đỉnh nắng sunny ≈ 0,78 kW/kWp) với 3 kiểu ngày (nắng/trung bình/mây),
// cắt công suất AC tại công suất inverter. Trả về kWh/năm và % bị cắt.
const DAY_TYPES = [{ w: 0.4, f: 1.3 }, { w: 0.35, f: 1.0 }, { w: 0.25, f: 0.52 }];
function simulateYear(kwp, acKw, Y) {
  const dt = 0.25; let shape = 0;
  for (let t = 6; t < 18; t += dt) shape += Math.pow(Math.sin(Math.PI * (t + dt / 2 - 6) / 12), 1.5) * dt;
  const p0 = Y / shape;
  let dc = 0, ac = 0;
  for (const d of DAY_TYPES) for (let t = 6; t < 18; t += dt) {
    const p = kwp * p0 * d.f * Math.pow(Math.sin(Math.PI * (t + dt / 2 - 6) / 12), 1.5);
    dc += d.w * p * dt; ac += d.w * Math.min(p, acKw) * dt;
  }
  return { year: Math.round(ac * 365), daily: ac, clip: dc > 0 ? (1 - ac / dc) * 100 : 0 };
}
function parseKw(txt) { const m = String(txt || '').match(/([\d]+(?:[.,]\d+)?)\s*kW(?!p)/i); return m ? Number(m[1].replace(',', '.')) : 0; }
const n2 = x => String(Math.round(x * 100) / 100).replace('.', ',');

function autoPropose(s) {
  const v = s.v || {}, ov = s.ov || {};
  const P = calcParams(s); const D = CALC_DEFAULTS;
  const kwh = Number(v.kwh_thang) || 0, tien = Number(v.tien_dien) || 0;
  let eMonth, src;
  if (kwh > 0) { eMonth = kwh; src = `điện năng ${fmtN(kwh)} kWh/tháng`; }
  else if (tien > 0) { eMonth = tien / P.gia; src = `tiền điện ${fmtN(tien)} đ/tháng ÷ ${fmtN(P.gia)} đ/kWh ≈ ${fmtN(Math.round(eMonth))} kWh/tháng`; }
  else return { ok: false, msg: 'Nhập "Điện năng tiêu thụ hàng tháng" (II.9) hoặc "Tổng chi phí tiền điện" (II.10) để tự tính.' };

  const type = sysType(s), hyb = type !== 'On-grid';
  const steps = [`Nhu cầu: ${src}.`], notes = [];
  const dayLoad = eMonth * P.ty_le / 100 / 30;          // kWh/ngày dùng ban ngày
  const nightLoad = eMonth * (100 - P.ty_le) / 100 / 30; // kWh/ngày dùng ban đêm
  steps.push(`Điện dùng ban ngày ≈ ${fmtN(Math.round(dayLoad))} kWh/ngày, ban đêm ≈ ${fmtN(Math.round(nightLoad))} kWh/ngày (${P.ty_le}% / ${100 - P.ty_le}%).`);

  // Pin lưu trữ
  let batt = 0, battSrc = '';
  if (hyb) {
    const ub = userBattery(s);
    if (ub) { batt = ub; battSrc = 'theo dung lượng nhập ở mục IV.9'; }
    else if (ov.pin_de_xuat && Number(v.pin_de_xuat) > 0) { batt = Number(v.pin_de_xuat); battSrc = 'kỹ sư nhập'; }
    else {
      const need = nightLoad * P.pin_cover / 100 / (D.dod / 100);
      batt = Math.max(1, Math.ceil(need / D.module)) * D.module; batt = Math.round(batt * 100) / 100;
      battSrc = `${fmtN(Math.round(nightLoad))} × ${P.pin_cover}% ÷ DoD ${D.dod}% ≈ ${n2(need)} kWh → ${Math.round(batt / D.module)} module × ${n2(D.module)} kWh`;
    }
    steps.push(`Pin lưu trữ: ${n2(batt)} kWh (${battSrc}).`);
  }
  const battUse = batt * D.dod / 100; // kWh xả được mỗi ngày

  // Công suất PV
  const targetDaily = dayLoad + (hyb ? battUse / 0.95 : 0);
  const kwpNeed = targetDaily / P.yield;
  let panels, kwp;
  if (ov.tam_de_xuat && Number(v.tam_de_xuat) > 0) { panels = Math.round(Number(v.tam_de_xuat)); }
  else if (ov.cs_de_xuat && Number(v.cs_de_xuat) > 0) { panels = Math.ceil(Number(v.cs_de_xuat) * 1000 / P.wp); }
  else {
    panels = Math.max(1, Math.ceil(kwpNeed * 1000 / P.wp));
    const dt = Number(v.dt_lap) || 0;
    if (dt > 0) { const maxP = Math.floor(dt / D.m2_tam); if (maxP < panels) { notes.push(`Diện tích mái ${fmtN(dt)} m² chỉ đặt được khoảng ${maxP} tấm (cần ${panels}) — đã giới hạn theo mái.`); panels = Math.max(1, maxP); } }
  }
  kwp = ov.cs_de_xuat && Number(v.cs_de_xuat) > 0 ? Number(v.cs_de_xuat) : Math.round(panels * P.wp / 10) / 100;
  steps.push(ov.tam_de_xuat || ov.cs_de_xuat
    ? `Công suất PV (kỹ sư chọn): ${panels} tấm × ${P.wp} Wp → ${n2(kwp)} kWp.`
    : `Công suất PV cần: (${fmtN(Math.round(dayLoad))}${hyb ? ` + sạc pin ${fmtN(Math.round(battUse / 0.95))}` : ''}) ÷ ${n2(P.yield)} ≈ ${n2(kwpNeed)} kWp → ${panels} tấm × ${P.wp} Wp = ${n2(kwp)} kWp.`);

  // Inverter
  let invKw, invTxt;
  const nguon = ((s.c && s.c.nguon_dien) || [])[0];
  if (ov.inverter && parseKw(v.inverter)) { invKw = parseKw(v.inverter); invTxt = v.inverter; steps.push(`Inverter (kỹ sư chọn): ${invTxt} → giới hạn AC ${n2(invKw)} kW, DC/AC = ${n2(kwp / invKw)}.`); }
  else {
    const acMin = kwp / P.dc_ac;
    invKw = INV_SIZES.find(x => x >= acMin) || Math.ceil(acMin);
    const phase = invKw <= 6 && nguon !== '3 pha' ? '1 pha' : '3 pha';
    invTxt = `${type} ${phase} ${n2(invKw)} kW`;
    steps.push(`Inverter: ${n2(kwp)} kWp ÷ ${n2(P.dc_ac)} ≈ ${n2(acMin)} kW → chọn ${n2(invKw)} kW (${phase}).`);
  }

  // Sản lượng theo giới hạn inverter
  const sim = simulateYear(kwp, invKw, P.yield);
  const year = ov.san_luong && Number(v.san_luong) > 0 ? Number(v.san_luong) : sim.year;
  steps.push(ov.san_luong ? `Sản lượng (kỹ sư nhập): ${fmtN(year)} kWh/năm.`
    : `Sản lượng: mô phỏng ${n2(kwp)} kWp × ${n2(P.yield)} kWh/kWp/ngày, cắt tại ${n2(invKw)} kW AC → ${fmtN(year)} kWh/năm${sim.clip >= 0.05 ? ` (mất ${n2(sim.clip)}% do giới hạn inverter)` : ' (không bị cắt công suất)'}.`);

  // Tiết kiệm & hoàn vốn
  const daily = year / 365;
  const selfDay = Math.min(daily, dayLoad);
  const toBatt = hyb ? Math.min(Math.max(0, daily - selfDay), battUse / 0.95) : 0;
  const fromBatt = Math.min(toBatt * 0.95, nightLoad);
  const saveKwh = (selfDay + fromBatt) * 365;
  const save = saveKwh * P.gia;
  const dauTu = Number(v.dau_tu) || 0;
  const invest = dauTu > 0 ? dauTu : kwp * P.suat_dt + (hyb ? batt * P.suat_pin : 0);
  const payback = ov.hoan_von && Number(v.hoan_von) > 0 ? Number(v.hoan_von) : (save > 0 ? Math.round(invest / save * 10) / 10 : 0);
  steps.push(`Điện tự dùng ≈ ${fmtN(Math.round(saveKwh))} kWh/năm${hyb ? ` (ban ngày ${fmtN(Math.round(selfDay * 365))} + từ pin ${fmtN(Math.round(fromBatt * 365))})` : ''} → tiết kiệm ≈ ${fmtN(Math.round(save))} đ/năm.`);
  steps.push(`Đầu tư: ${dauTu > 0 ? 'mức đầu tư dự kiến (II.8)' : `${n2(kwp)} kWp × ${fmtN(P.suat_dt)} đ${hyb ? ` + ${n2(batt)} kWh × ${fmtN(P.suat_pin)} đ` : ''}`} = ${fmtN(Math.round(invest))} đ → hoàn vốn ≈ ${n2(payback)} năm${ov.hoan_von ? ' (kỹ sư nhập)' : ''}.`);
  if (daily > dayLoad + toBatt + 0.5 && !hyb) notes.push(`PV dư khoảng ${fmtN(Math.round((daily - dayLoad) * 365))} kWh/năm so với nhu cầu ban ngày — cân nhắc hệ hybrid hoặc giảm công suất.`);

  const out = { tam_de_xuat: panels, cs_de_xuat: kwp, inverter: invTxt, pin_de_xuat: hyb ? batt : '', san_luong: year, hoan_von: payback };
  return { ok: true, out, steps: steps.concat(notes), hyb };
}
function fmtN(n) { return Number(n).toLocaleString('vi-VN'); }
function applyAuto(s) {
  if (!s.v || s.v.vi_mode !== 'auto') return null;
  const r = autoPropose(s);
  if (r.ok) { const ov = s.ov || {}; for (const k of AUTO_KEYS) if (!ov[k]) s.v[k] = r.out[k]; }
  return r;
}
