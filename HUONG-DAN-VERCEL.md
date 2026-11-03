# Đưa Góc Toán 10 lên mạng bằng Vercel, có trợ lý AI luôn sẵn sàng

Làm xong bạn sẽ có một link dạng `https://ten-trang.vercel.app`:
- Trang chạy 24/7, **không cần bật máy tính**.
- **Chatbox tự kết nối AI Gemini**. Ai mở trang cũng hỏi được ngay: không cần đăng nhập Claude, không cần bấm cho phép, không giới hạn tuổi.
- **Video YouTube phát ngay trên trang.**
- Tài liệu PDF đọc ngay trên trang.

Tổng thời gian khoảng 15–20 phút. Cần 3 tài khoản miễn phí: **Google** (lấy khóa AI), **GitHub** (cất file trang web), **Vercel** (đưa trang lên mạng).

---

## Bước 1. Lấy khóa AI Gemini (miễn phí)

1. Vào **aistudio.google.com**, đăng nhập bằng tài khoản Google.
2. Bấm **Get API key**, rồi **Create API key**.
3. Bấm nút sao chép để chép dãy khóa (bắt đầu bằng `AIza…`) và **dán tạm vào Notepad**.

**Không bật thanh toán (Billing)** cho khóa này. Khi đó bạn chỉ dùng phần miễn phí và **không bao giờ bị trừ tiền**. Hết lượt miễn phí trong ngày thì chatbox báo "AI đang quá tải hoặc hết lượt miễn phí".

**Không đưa khóa này cho ai**, và không dán khóa vào file nào của trang web.

## Bước 2. Đưa các file lên GitHub

1. Vào **github.com**, bấm **Sign up** để tạo tài khoản (hoặc đăng nhập nếu đã có).
2. Bấm dấu **+** ở góc trên bên phải, chọn **New repository**.
   - **Repository name:** `goc-toan-10`
   - Chọn **Public**.
   - Bấm **Create repository**.
3. Trên trang vừa tạo, bấm dòng chữ **uploading an existing file**.
4. Giải nén file zip. Mở thư mục **`goc-toan-10-vercel`**, chọn **toàn bộ những gì bên trong** (`Ctrl` + `A`), gồm: `api`, `pdf`, `index.html`, `package.json`, `vercel.json` và file hướng dẫn này. **Kéo thả** tất cả vào trang GitHub.
   - Kéo **những thứ bên trong** thư mục, không kéo cả thư mục `goc-toan-10-vercel`.
5. Chờ tải lên xong, rồi bấm nút xanh **Commit changes** ở cuối trang.
6. Kiểm tra: trang GitHub phải hiện thư mục `api` và `pdf` cùng các file nằm ngay ở ngoài cùng.

## Bước 3. Đưa trang lên Vercel

1. Vào **vercel.com**, bấm **Sign Up**, chọn **Hobby**, rồi chọn **Continue with GitHub** và cho phép.
2. Bấm **Add New…**, chọn **Project**.
3. Tìm `goc-toan-10` trong danh sách và bấm **Import**. Nếu không thấy, bấm **Adjust GitHub App Permissions** để cho Vercel xem repository.
4. Ở trang cấu hình:
   - **Framework Preset:** chọn **Other**.
   - **Root Directory:** để nguyên `./`.
   - Mở mục **Environment Variables** và điền:
     - **Key:** `GEMINI_API_KEY`
     - **Value:** dán khóa ở Bước 1
     - Bấm **Add**.
5. Bấm **Deploy** và chờ khoảng 1 phút.
6. Màn hình chúc mừng hiện ra. Bấm vào ảnh trang web để mở. Link có dạng `https://goc-toan-10-xxxx.vercel.app`.

**Đổi link cho dễ nhớ (tùy chọn):** vào **Settings**, chọn **Domains**, sửa thành ví dụ `goc-toan-10-ltk.vercel.app` nếu tên đó còn trống.

## Bước 4. Kiểm tra

1. Mở link, bấm **Vào xem với tài khoản khách**.
2. Bấm **Hỏi trợ lý**. Dưới chữ "Trợ lý Toán 10" phải ghi **"Trực tuyến · sẵn sàng"**.
3. Hỏi thử: *"Giải thích định lý côsin bằng ví dụ dễ hiểu"*.
4. Mở **Video bài giảng**, chọn một thầy cô. Video phải phát ngay trên trang.

| Nếu thấy | Cách sửa |
|---|---|
| Chatbox ghi "Trả lời nhanh theo từ khóa" | Chưa có khóa. Vào **Settings**, chọn **Environment Variables**, thêm `GEMINI_API_KEY`. Sau đó vào **Deployments**, bấm dấu **⋯** ở bản mới nhất, chọn **Redeploy** |
| "Khóa API của trang không đúng" | Dán lại khóa (không thừa dấu cách), rồi **Redeploy** |
| "Tên mô hình AI không đúng" | Thêm biến `AI_MODEL` = `gemini-flash-latest`, rồi **Redeploy** |
| "AI đang quá tải hoặc hết lượt miễn phí" | Hết lượt miễn phí tạm thời. Đợi vài phút hoặc sang ngày hôm sau |
| Muốn xem lỗi chi tiết | Vào dự án trên Vercel, mở **Logs** |

## Cập nhật trang về sau

Khi mình gửi bản mới: vào repository trên GitHub, bấm **Add file**, chọn **Upload files**, kéo các file mới vào rồi bấm **Commit changes**. **Vercel tự cập nhật trang sau khoảng 1 phút.** Bạn không cần làm lại Bước 3.

## Cài đặt thêm (tùy chọn)

Thêm trong **Settings → Environment Variables**, sau đó **Redeploy**:

| Key | Ý nghĩa | Mặc định |
|---|---|---|
| `AI_SO_CAU_MOI_GIO` | Mỗi máy được hỏi tối đa bao nhiêu câu trong 1 giờ | `40` |
| `AI_MODEL` | Mô hình Gemini | `gemini-flash-lite-latest` |
| `ANTHROPIC_API_KEY` + `AI_PROVIDER` = `claude` | Dùng Claude thay Gemini (trả phí theo lượt) | — |

## Lưu ý

- Trên bản Vercel, **chỉ có tài khoản khách** (`khach` / `ltk2026`). Phần **tạo tài khoản, phân quyền, sửa bài, tải PDF trên web** cần nơi lưu dữ liệu, nên hiện chỉ có ở bản máy chủ chạy trên máy tính (file zip máy chủ).
- Với gói miễn phí, Google có thể dùng nội dung câu hỏi để cải thiện sản phẩm. Hãy nhắc học sinh **không gõ thông tin cá nhân** vào chatbox.
- Gói Hobby của Vercel dành cho dự án cá nhân, phi thương mại, phù hợp với dự án học sinh.
