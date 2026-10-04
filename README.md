# App Khảo sát điện mặt trời BM01 (bản offline)

Đây là một trang web tĩnh, không cần máy chủ hay cơ sở dữ liệu. Sau lần mở đầu tiên có mạng, app được lưu vào điện thoại và dùng được cả khi không có mạng.

## Đưa lên Vercel

### Cách 1 — qua GitHub (không cần cài đặt gì)
1. Đăng nhập https://github.com và tạo repository mới, ví dụ `khao-sat-solar`.
2. Trong repository, bấm **Add file → Upload files**, kéo **toàn bộ nội dung** của thư mục này vào (gồm `index.html`, `sw.js`, `vercel.json`, các thư mục `js`, `vendor`, `fonts`, `icons`). Bấm **Commit changes**.
3. Đăng nhập https://vercel.com bằng tài khoản GitHub, bấm **Add New → Project**, chọn repository vừa tạo, bấm **Import**.
4. Ở mục **Framework Preset**, chọn **Other**. Để trống Build Command và Output Directory, rồi bấm **Deploy**.
5. Khoảng 30 giây sau, Vercel cấp một địa chỉ dạng `https://khao-sat-solar.vercel.app`. Gửi địa chỉ này cho đồng nghiệp.

### Cách 2 — bằng dòng lệnh (máy tính đã cài Node.js)
```
npm i -g vercel
cd vercel-app
vercel --prod
```

### Cập nhật phiên bản mới
Upload các file mới đè lên file cũ trên GitHub. Vercel sẽ tự deploy lại. Điện thoại nhận bản mới vào lần mở app kế tiếp khi có mạng.

## Cài lên điện thoại
- **iPhone (Safari):** mở địa chỉ app → bấm nút Chia sẻ → **Thêm vào MH chính**.
- **Android (Chrome):** mở địa chỉ app → menu ⋮ → **Cài đặt ứng dụng** (hoặc **Thêm vào màn hình chính**).

Mở app một lần khi có mạng để máy tải đủ dữ liệu. Sau đó app chạy được khi không có mạng: nhập liệu, chụp ảnh, ký tên, xuất Excel và PDF đều làm ngay trên máy.

## Lưu ý về dữ liệu
- Hồ sơ và ảnh nằm **trên chính điện thoại đó** (bộ nhớ của trình duyệt). Mỗi người có danh sách hồ sơ riêng.
- Muốn chuyển hồ sơ cho người khác hoặc sang máy khác: bấm **Sao lưu dữ liệu**, gửi file `.json` qua Zalo hoặc email, rồi bên nhận bấm **Khôi phục / nhập hồ sơ**.
- Nếu xoá dữ liệu trình duyệt, gỡ app hoặc dọn bộ nhớ Safari, hồ sơ sẽ mất. Hãy sao lưu định kỳ.
- iPhone: nên dùng app đã thêm vào màn hình chính. Safari có thể xoá dữ liệu của trang web lâu ngày không mở.
