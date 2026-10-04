// Danh mục mục khảo sát theo biểu mẫu BM01. r = dòng trong file Excel; o = lựa chọn (đúng chữ trong mẫu);
// m = chọn nhiều; t = kiểu ô nhập; sub = dòng phụ; req = bắt buộc.
const SECTIONS = [
  { id: 'I', title: 'Thông tin khách hàng', items: [
    { k: 'ten_cty', n: '1', l: 'Tên Công Ty / Chủ hộ', r: 9, req: 1 },
    { k: 'dai_dien', n: '2', l: 'Tên Khách hàng / Người đại diện', r: 10, req: 1 },
    { k: 'di_dong', n: '2a', l: 'Di động', r: 11, t: 'tel', sub: 1 },
    { k: 'email_kh', n: '2b', l: 'Email', r: 12, t: 'email', sub: 1 },
    { k: 'dia_chi', n: '3', l: 'Địa chỉ', r: 13, req: 1 },
    { k: 'dien_thoai', n: '4', l: 'Điện thoại liên hệ', r: 14, t: 'tel' },
    { k: 'website', n: '5', l: 'Website / Fanpage', r: 15 },
    { k: 'email_cty', n: '6', l: 'Email liên hệ công ty', r: 16, t: 'email' },
    { k: 'sales', n: '7', l: 'Người liên hệ (Sales)', r: 17 },
    { k: 'ks_chinh', n: '8', l: 'Người khảo sát chính', r: 18, req: 1 },
    { k: 'ks_ho_tro', n: '8a', l: 'Người hỗ trợ khảo sát', r: 19, sub: 1 },
    { k: 'ngay_ks', n: '9', l: 'Ngày khảo sát', r: 20, t: 'date', req: 1 },
  ]},
  { id: 'II', title: 'Thông tin dự án', items: [
    { k: 'dia_diem', n: '1', l: 'Địa điểm lắp đặt', r: 23, gps: 1 },
    { k: 'so_huu', n: '2', l: 'Nhà nơi lắp đặt thuộc sở hữu của', r: 24 },
    { k: 'ma_cong_to', n: '3', l: 'Mã số công tơ điện (PE)', r: 25 },
    { k: 'duong_day', n: '4', l: 'Thông số đường dây EVN', r: 26 },
    { k: 'tram_ba', n: '5', l: 'Thông số trạm biến áp', r: 27 },
    { k: 'cs_mong_muon', n: '6', l: 'Công suất hệ thống mong muốn', r: 28, u: 'kWp' },
    { k: 'muc_dich', n: '7', l: 'Mục đích sử dụng', r: 29, m: 1, o: ['Tiết kiệm điện', 'Bán điện lưới', 'Dự phòng', 'Bảo vệ môi trường', 'Hệ độc lập tự dùng'] },
    { k: 'dau_tu', n: '8', l: 'Mức đầu tư dự kiến (VNĐ)', r: 30, t: 'money' },
    { k: 'kwh_thang', n: '9', l: 'Điện năng tiêu thụ hàng tháng (kWh)', r: 31, t: 'num', u: 'kWh' },
    { k: 'tien_dien', n: '10', l: 'Tổng chi phí tiền điện trung bình/tháng', r: 32, t: 'money' },
    { k: 'gia_dien', n: '11', l: 'Giá điện áp dụng', r: 33, o: ['Điện sinh hoạt', 'Kinh doanh', 'Sản xuất'] },
    { k: 'tg_dung_dien', n: '12', l: 'Thời gian sử dụng điện chính', r: 34, o: ['Ban ngày', 'Ban đêm', 'Cả ngày lẫn đêm'] },
    { k: 'ke_hoach', n: '13', l: 'Kế hoạch sử dụng điện', r: 35, t: 'area' },
    { k: 'nguon_dien', n: '14', l: 'Nguồn điện hiện tại', r: 36, o: ['1 pha', '3 pha'] },
    { k: 'so_dong_ho', n: '14a', l: 'Số đồng hồ điện', r: 37, sub: 1 },
    { k: 'tai_dien', n: '15', l: 'Liệt kê tải điện chủ yếu', r: 38, t: 'area' },
    { k: 'may_phat', n: '16', l: 'Máy phát điện dự phòng', r: 39, o: ['Có', 'Không có'] },
  ]},
  { id: 'III', title: 'Thông tin mái nhà', items: [
    { k: 'so_mai', n: '1', l: 'Số lượng mái / loại mái', r: 42 },
    { k: 'kt_mai', n: '2', l: 'Kích thước mái – D × R (m)', r: 43, ph: 'VD: 20 × 12' },
    { k: 'huong_mai', n: '3', l: 'Hướng mái (Azimuth)', r: 44, o: ['Nam', 'Đông Nam', 'Tây Nam', 'Khác: ______'] },
    { k: 'do_doc', n: '4', l: 'Độ dốc mái (Tilt)', r: 45, o: ['Bằng phẳng 0°', '~10°', '~15°', '~30°', 'Khác: ___'] },
    { k: 'cao_mai', n: '5', l: 'Chiều cao mái (số tầng)', r: 46 },
    { k: 'duong_len_mai', n: '6', l: 'Đường lên mái (khảo sát & thi công)', r: 47, o: ['Cầu thang cố định', 'Thang di động', 'Dây thừng'] },
    { k: 'tap_ket', n: '7', l: 'Đường tập kết tấm pin lên mái', r: 48, o: ['Thang máy/tải', 'Dây móc kéo', 'Chuyển tay'] },
    { k: 'vat_can', n: '8', l: 'Các vật cản trên mái', r: 49, m: 1, o: ['Ngói thái', 'Bồn nước', 'MNN NLMT', 'Ăng-ten', 'Cột thu lôi', 'Ống khói', 'Khác: ___'] },
    { k: 'chong_set', n: '9', l: 'Chiều cao & diện tích khu vực chống sét', r: 50 },
    { k: 'vl_mai', n: '10', l: 'Vật liệu làm mái', r: 51, o: ['Tôn lạnh', 'Ngói thái', 'Bê tông', 'Khác: ______'] },
    { k: 'xa_go', n: '11', l: 'Loại xà gồ mái – khoảng cách xà gồ (m)', r: 52 },
    { k: 'cl_mai', n: '12', l: 'Đánh giá chất lượng mái', r: 53, o: ['Mới/Rất tốt', 'Tốt', 'Cũ cần gia cố', 'Xuống cấp'] },
    { k: 'lien_ket', n: '13', l: 'Liên kết vào mái (phương thức bắt vít)', r: 54, o: ['Vít xuyên mái', 'Kẹp không xuyên', 'Bulong hóa chất'] },
    { k: 'dt_lap', n: '14', l: 'Diện tích mái có thể lắp đặt pin (m²)', r: 55, t: 'num', u: 'm²' },
    { k: 'so_tam', n: '15', l: 'Số lượng tấm pin dự kiến (tấm)', r: 56, t: 'num', u: 'tấm' },
  ]},
  { id: 'IV', title: 'Khu vực lắp điện – Inverter / Tủ điện', items: [
    { k: 'ban_ve_nl', n: '1', l: 'Bản vẽ sơ đồ nguyên lý hệ thống điện', r: 59, o: ['Có (CĐT cung cấp)', 'Không có'] },
    { k: 'vi_tri_inv', n: '2', l: 'Vị trí lắp đặt Inverter dự kiến', r: 60 },
    { k: 'kc_inv', n: '3', l: 'Khoảng cách từ mái đến vị trí Inverter (m)', r: 61, t: 'num', u: 'm' },
    { k: 'day_dc', n: '4', l: 'Đường đi dây DC dự kiến', r: 62, m: 1, o: ['Ống trắng cạnh tường', 'Máng cáp', 'Chôn ngầm', 'Khác'] },
    { k: 'vi_tri_ac', n: '5', l: 'Vị trí đấu nối dây AC dự kiến', r: 63 },
    { k: 'day_ac', n: '6', l: 'Đường đi dây AC dự kiến', r: 64, m: 1, o: ['Ống trắng cạnh tường', 'Máng cáp', 'Khác: ______'] },
    { k: 'cb_evn', n: '7', l: 'CB sau công tơ EVN', r: 65, o: ['Có', 'Không'] },
    { k: 'cb_ampe', n: '7a', l: 'Ampere CB (A)', r: 66, sub: 1, t: 'num', u: 'A' },
    { k: 'loai_he', n: '8', l: 'Loại hệ thống dự kiến', r: 67, o: ['On-grid (hòa lưới)', 'Off-grid', 'Hybrid'] },
    { k: 'luu_tru', n: '9', l: 'Hệ thống lưu trữ (Pin dự phòng)', r: 68, o: ['Có – Dung lượng: ______', 'Không cần'], ou: 'kWh' },
    { k: 'giam_sat', n: '10', l: 'Hệ thống giám sát / monitoring', r: 69, m: 1, o: ['App điện thoại', 'Web dashboard', 'Không cần'] },
  ]},
  { id: 'V', title: 'Đánh giá hiện trường & đề xuất', items: [
    { k: 'thuan_loi', n: '1', l: 'Thuận lợi', r: 72, col: 'D', t: 'area' },
    { k: 'rui_ro', n: '2', l: 'Không thuận lợi / Rủi ro', r: 73, col: 'D', t: 'area' },
    { k: 'giai_phap', n: '3', l: 'Đề xuất giải pháp', r: 74, col: 'D', t: 'area' },
  ]},
  { id: 'VI', title: 'Tóm tắt đề xuất kỹ thuật', items: [
    { k: 'cs_de_xuat', n: '1', l: 'Công suất đề xuất (kWp)', r: 77, t: 'num', u: 'kWp' },
    { k: 'tam_de_xuat', n: '2', l: 'Số tấm pin đề xuất (tấm)', r: 78, t: 'num', u: 'tấm' },
    { k: 'inverter', n: '3', l: 'Loại / Công suất Inverter', r: 79 },
    { k: 'san_luong', n: '4', l: 'Sản lượng điện ước tính/năm (kWh)', r: 80, t: 'num', u: 'kWh' },
    { k: 'pin_de_xuat', n: '5', l: 'Dung lượng pin lưu trữ (kWh)', r: 82, t: 'num', u: 'kWh' },
    { k: 'hoan_von', n: '6', l: 'Thời gian hoàn vốn ước tính (năm)', r: 81, t: 'num', u: 'năm' },
  ]},
];
const SLOTS = [
  { k: 's1', n: '01', l: 'Tổng quan mái nhà', cell: 'B86' },
  { k: 's2', n: '02', l: 'Vật cản & đặc điểm mái', cell: 'F86' },
  { k: 's3', n: '03', l: 'Tủ điện / Vị trí Inverter', cell: 'B88' },
  { k: 's4', n: '04', l: 'Đồng hồ điện / Công tơ EVN', cell: 'F88' },
  { k: 's5', n: '05', l: 'Mặt trước / Hướng nhà', cell: 'B90' },
  { k: 's6', n: '06', l: 'Đường tập kết vật tư', cell: 'F90' },
  { k: 'sketch', n: 'P3', l: 'Bản vẽ sơ đồ mặt bằng mái', cell: 'B94', wide: 1 },
];
const ALL_ITEMS = SECTIONS.flatMap(s => s.items.map(it => ({ ...it, sec: s.id, code: s.id + '.' + it.n })));

// Lựa chọn có ô "Khác"/"Dung lượng" để ghi thêm chữ
function optInfo(o) {
  const m = o.match(/^(.*?):\s*_+$/);
  if (m) return { label: m[1].trim(), token: o, other: true };
  if (o === 'Khác') return { label: 'Khác', token: o, other: true };
  return { label: o, token: o, other: false };
}

// Chuỗi hiển thị cho ô lựa chọn, giữ đúng bố cục ☐/☑ của mẫu
function checkText(template, it, s) {
  const sel = (s.c && s.c[it.k]) || [];
  const extra = (s.x && s.x[it.k]) || '';
  let out = template;
  for (const o of it.o) {
    const oi = optInfo(o);
    if (!sel.includes(oi.label)) continue;
    let tok = oi.token;
    const ex = extra && it.ou ? extra + ' ' + it.ou : extra;
    if (oi.other && ex) tok = /_+/.test(tok) ? tok.replace(/_+/, ex) : tok + ': ' + ex;
    out = out.replace('☐ ' + oi.token, '☑ ' + tok);
  }
  return out;
}

function itemDisplay(it, s) {
  if (it.o) {
    const sel = (s.c && s.c[it.k]) || [];
    const extra = (s.x && s.x[it.k]) || '';
    return sel.map(l => { const oi = it.o.map(optInfo).find(o => o.label === l); return oi && oi.other && extra ? l + ': ' + extra + (it.ou ? ' ' + it.ou : '') : l; }).join(', ');
  }
  const v = s.v && s.v[it.k];
  if (v == null || v === '') return '';
  if (it.t === 'money') return Number(v).toLocaleString('vi-VN');
  if (it.t === 'date') { const [y, m, d] = String(v).split('-'); return d ? `${d}/${m}/${y}` : v; }
  if (it.t === 'num' && !isNaN(Number(v))) return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return String(v);
}

function isFilled(it, s) {
  if (it.o) return ((s.c && s.c[it.k]) || []).length > 0;
  const v = s.v && s.v[it.k];
  return v != null && String(v).trim() !== '';
}
