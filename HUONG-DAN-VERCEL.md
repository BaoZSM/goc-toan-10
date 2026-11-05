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

- Trên bản Vercel có **tài khoản thật và phân quyền** khi đã làm phần "Tài khoản" bên dưới. Riêng **sửa bài giảng và tải PDF trên web** vẫn chỉ có ở bản máy chủ chạy trên máy tính.
- Với gói miễn phí, Google có thể dùng nội dung câu hỏi để cải thiện sản phẩm. Hãy nhắc học sinh **không gõ thông tin cá nhân** vào chatbox.
- Gói Hobby của Vercel dành cho dự án cá nhân, phi thương mại, phù hợp với dự án học sinh.

## Tài khoản và quyền quản trị

### A. Tạo cơ sở dữ liệu (làm 1 lần)
1. Vào vercel.com, mở dự án **goc-toan-10**, chọn thẻ **Storage**.
2. Bấm **Create Database** (hoặc **Browse Marketplace**), chọn **Upstash**, rồi chọn **Upstash for Redis**.
3. Chọn gói **Free**, vùng **Singapore**. Đặt tên tùy ý (ví dụ `toan10-tai-khoan`), bấm **Create**.
4. Khi được hỏi kết nối với dự án nào, chọn **goc-toan-10**, giữ tích cả 3 môi trường, bấm **Connect**.
   Vercel tự thêm các biến `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

### B. Đặt mật khẩu cho tài khoản admin đầu tiên
1. Dự án **goc-toan-10**, mở **Settings**, chọn **Environment Variables**.
2. Thêm Key `ADMIN_MAT_KHAU`, Value là mật khẩu bạn muốn (ít nhất 6 ký tự), bấm **Save**.
3. (Nên làm) Thêm Key `SESSION_SECRET`, Value là một chuỗi dài bất kỳ, ví dụ 40 ký tự gõ lung tung.

### C. Đưa code mới lên
Chép `index.html`, `vercel.json`, thư mục `api` vào thư mục repo, rồi **Commit** và **Push origin** trong GitHub Desktop.
Nếu bạn đã push code trước khi làm A và B: vào **Deployments**, bấm **⋯** ở bản mới nhất, chọn **Redeploy**.

### D. Đăng nhập admin và tạo tài khoản
1. Mở trang, đăng nhập tên `admin` với mật khẩu đã đặt ở `ADMIN_MAT_KHAU`. Lần đầu đăng nhập, tài khoản admin được tạo tự động.
2. Ở menu trái có mục **Quản lý tài khoản**.
3. Tạo tài khoản: điền tên đăng nhập (vd `hs10a1.nam`), mật khẩu, tên hiển thị. Bấm **Học sinh (chỉ xem)** hoặc **Quản trị**, rồi bấm **Tạo tài khoản**.
4. Sửa tài khoản: bấm **Sửa** để đổi tên hiển thị, đặt lại mật khẩu, bật/tắt quyền **Quản lý tài khoản**. Bấm **Xóa** hai lần để xóa.
5. Đổi mật khẩu admin: bấm **Sửa** ở dòng của chính bạn. Từ đó mật khẩu trong `ADMIN_MAT_KHAU` không còn tác dụng, có thể xóa biến này.

| Nếu thấy | Cách sửa |
|---|---|
| Không có mục Quản lý tài khoản, admin đăng nhập báo sai | Chưa có cơ sở dữ liệu hoặc chưa Redeploy sau khi làm A, B |
| Nhập sai 5 lần bị khóa | Đợi 10 phút |
| Quên mật khẩu admin | Nhờ một tài khoản quản trị khác đặt lại. Nếu không còn ai: vào Upstash, xóa khóa `toan10:tai-khoan` (mất toàn bộ tài khoản), rồi làm lại bước B, D |

Lưu ý: tài khoản `khach` / `ltk2026` luôn dùng được. Học sinh đăng nhập được giữ phiên 7 ngày trên máy đó.

## Tạo tài khoản cho cả lớp một lần

1. Đăng nhập admin, mở **Quản lý tài khoản**, tìm khung **Thêm nhiều tài khoản**.
2. Dán danh sách vào ô **Danh sách**, mỗi dòng một học sinh: `số báo danh, họ và tên`. Có thể dán thẳng 2 cột từ Excel.
3. Điền **Lớp** (vd `10C09`) và **Mật khẩu chung**, rồi bấm **Tạo các tài khoản học sinh**.
4. Dòng nào đã có tài khoản hoặc sai định dạng sẽ được bỏ qua và báo lại, không tạo trùng.
5. Học sinh nên tự đổi mật khẩu: bấm vào **tên của mình** ở góc trên bên phải, chọn đổi mật khẩu.

Tài khoản giáo viên: khi tạo hoặc sửa, tích **Giáo viên**. Giáo viên và quản trị không bị tính vào bảng thi đua.

## Dữ liệu được lưu theo từng tài khoản

| Mục | Lưu ở đâu | Ghi chú |
|---|---|---|
| Lịch sử trò chuyện với trợ lý | Cơ sở dữ liệu, theo tài khoản | Tối đa 80 cuộc trò chuyện; mở trên máy nào cũng thấy |
| Bảng nháp | Cơ sở dữ liệu, theo tài khoản | Tối đa 30 bảng; tự lưu sau mỗi nét vẽ |
| Bài đã học, điểm luyện tập | Cơ sở dữ liệu, theo tài khoản | Dùng để tính bảng thi đua; điểm luyện tập chỉ giữ mức cao nhất |
| Đánh giá website | Cơ sở dữ liệu | Mỗi tài khoản 1 đánh giá; quản trị ẩn/hiện/xóa được |
| Tài khoản khách | Chỉ trên máy đang dùng | Khách không được xếp hạng, không viết đánh giá |

Mọi thay đổi được ghi vào máy ngay rồi gửi lên máy chủ. Nếu mất mạng, trang ghi chú "Chưa lưu được lên máy chủ – sẽ thử lại" và tự gửi lại khi có mạng hoặc lần mở trang sau.
Xóa một tài khoản cũng xóa luôn trò chuyện, bảng nháp, điểm và đánh giá của tài khoản đó.

Gói miễn phí của Upstash giới hạn số lệnh mỗi tháng. Một lớp khoảng 45 học sinh dùng bình thường vẫn nằm trong giới hạn; nếu trang báo lỗi lưu hàng loạt, vào Upstash xem mục **Usage**.
