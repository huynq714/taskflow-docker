# TASKFLOW – BÀI THỰC HÀNH DOCKER

## 1. Giới thiệu
TaskFlow là ứng dụng web quản lý công việc có giao diện tiếng Việt, responsive, xây dựng bằng Flask + JavaScript thuần + SQLite. Các chức năng: tạo/sửa/xóa nhiệm vụ, tìm kiếm, lọc trạng thái, lọc độ ưu tiên, đánh dấu hoàn thành, hạn hoàn thành và thống kê tổng quan. Dữ liệu lưu trong Docker named volume nên không mất khi container bị tạo lại bằng Compose (trừ khi chủ động xóa volume).

**Lưu ý:** Đây là bản demo phục vụ học tập trên máy cá nhân. Không có đăng nhập, không phù hợp mở trực tiếp lên Internet hoặc cho nhiều người dùng cùng chia sẻ. Mặc định port chỉ bind localhost.

## 2. Yêu cầu hệ thống Windows
- Windows 10/11, Docker Desktop đã cài và đang chạy ở chế độ **Linux containers** (WSL2 được khuyến nghị).
- PowerShell hoặc Terminal của VS Code. Không cần cài Python ở máy chủ vì Python nằm trong image.

## 3. Cách chạy
1. Giải nén ZIP và mở PowerShell ngay trong thư mục có `Dockerfile` và `docker-compose.yml`.
2. Kiểm tra: `docker --version` và `docker compose version`.
3. Kiểm tra cấu hình: `docker compose config`.
4. Build + chạy nền: `docker compose up --build -d`.
5. Xem trạng thái: `docker compose ps`.
6. Mở **http://localhost:5000** để dùng ứng dụng.
7. API kiểm tra sức khỏe: **http://localhost:5000/health**.

Một số lệnh hữu ích:

```powershell
docker compose logs -f taskflow              # xem log
docker compose exec taskflow id               # xác thực user không phải root
docker compose exec taskflow ls -ld /app/data # xem phân quyền thư mục
docker compose exec taskflow ls -l /app/docker-entrypoint.sh # kiểm tra quyền thực thi script
docker compose exec taskflow sh -c 'echo "$DATABASE_PATH"' # kiểm tra biến môi trường
curl.exe http://localhost:5000/health         # kiểm tra kết nối DB và ứng dụng
docker compose down                          # dừng/xóa container, vẫn giữ dữ liệu
docker compose up -d                         # khởi động lại, dữ liệu còn
```

**Cảnh báo:** `docker compose down -v` xóa cả volume và mất dữ liệu công việc. Đừng dùng nếu muốn giữ dữ liệu.

Nếu port 5000 đã được sử dụng, sửa `ports: - "127.0.0.1:5001:5000"` trong Compose và truy cập http://localhost:5001.

## 4. Cấu trúc file

```text
taskflow/
├── app.py                  # REST API Flask, SQLite, validation, headers bảo mật
├── templates/index.html    # bố cục giao diện
├── static/style.css        # giao diện responsive
├── static/app.js           # tương tác tạo/sửa/xóa/lọc/tìm kiếm
├── requirements.txt        # Flask và Gunicorn
├── Dockerfile              # hướng dẫn build image
├── docker-entrypoint.sh    # khởi tạo DB khi chạy container
├── docker-compose.yml      # khai báo service, port, volume, security
├── .dockerignore           # tránh copy file không cần thiết vào image
├── .gitignore
└── README.md
```

## 5. Phân tích Dockerfile và giải thích lệnh

**Base image:** `FROM python:3.12-slim` cung cấp Python runtime trên Linux nhỏ gọn. `WORKDIR /app` chọn thư mục làm việc. `COPY` đưa source và dependency manifest vào image. `ENV` định nghĩa biến môi trường; `EXPOSE 5000` mô tả cổng nội bộ, không tự xuất bản port.

**Bốn RUN mang mục đích khác nhau:**
1. `RUN groupadd ... && useradd ...`: chuẩn bị tài khoản `appuser` và nhóm `appgroup` không có đặc quyền root.
2. `RUN pip install --no-cache-dir -r requirements.txt`: cài Python dependencies trong quá trình build.
3. `RUN mkdir -p /app/data && chown -R appuser:appgroup /app`: tạo nơi lưu SQLite và giao quyền sở hữu cho user chạy ứng dụng.
4. `RUN chmod 755 /app/docker-entrypoint.sh && chmod 750 /app/data`: đặt quyền thực thi script; chỉ owner/group được quyền truy cập thư mục dữ liệu.

**Khác nhau giữa RUN / CMD / ENTRYPOINT:**
- `RUN`: thực hiện trong **lúc build image**, kết quả được lưu vào layer. Ví dụ cài Flask, tạo user.
- `ENTRYPOINT`: xác định chương trình thực thi **lúc container khởi động**; ở đây gọi `/app/docker-entrypoint.sh`.
- `CMD`: cung cấp lệnh mặc định chạy **lúc khởi động** (ở đây Gunicorn). Các phần tử `CMD` trở thành đối số của ENTRYPOINT script; script gọi `exec "$@"` để khởi chạy đúng lệnh và chuyển tiếp tín hiệu dừng.

**Quy trình:** `docker compose up --build -d` → Docker build image → chạy container với USER `appuser` → ENTRYPOINT tạo/kiểm tra SQLite table → `exec` Gunicorn theo CMD → Flask phục vụ UI và API cổng 5000.

## 6. Phân quyền và bảo mật
- `USER appuser`: tiến trình Gunicorn/Flask không chạy root. Nguyên tắc **least privilege** giúp giảm mức độ ảnh hưởng nếu ứng dụng bị khai thác.
- `chown`: đảm bảo thư mục `/app` thuộc về appuser để script có thể thao tác trong vùng cho phép. Với named volume, Docker thông thường khởi tạo volume từ nội dung đường dẫn trong image; có thể kiểm tra thực tế qua `docker compose exec taskflow id` và `ls -ld /app/data`.
- `chmod 755`: chủ sở hữu được đọc/ghi/chạy script; user khác được đọc/chạy. `chmod 750`: owner toàn quyền và group được đọc/truy cập, user ngoài không có quyền trong `/app/data`.
- Compose `security_opt: no-new-privileges:true`, `cap_drop: ALL`, filesystem read-only, tmpfs tại `/tmp`, giới hạn RAM và số tiến trình. Named volume duy nhất `/app/data` cho dữ liệu ghi.
- `ports: "127.0.0.1:5000:5000"`: chỉ truy cập từ chính máy host; không mở trực tiếp ra mạng LAN/Internet.
- SQL dùng placeholders `?` chống SQL injection; giá trị nhập được kiểm tra giới hạn; giao diện dùng `textContent` thay vì HTML động để giảm rủi ro XSS; có HTTP security headers.
- Không lưu secrets trong source code, không gắn Docker socket vào container, không dùng privileged mode. `pip --no-cache-dir` hạn chế cache trong image.
- Bản demo chưa có authentication/authorization, CSRF protection cho môi trường dùng cookie, rate limiting, TLS hay kiểm soát đa người dùng; cần bổ sung trước khi đưa lên production.

## 7. Docker Compose
`build` xây image từ Dockerfile; `image` đặt tag cục bộ; `ports` ánh xạ host 5000 sang container 5000 chỉ qua localhost; `environment` chỉ DB path; `volumes` gắn named volume `taskflow_data` vào `/app/data` để dữ liệu bền vững; `restart` tự chạy lại khi daemon phục hồi; `security_opt`, `cap_drop`, `read_only`, `tmpfs`, `mem_limit` và `pids_limit` là lớp bảo vệ bổ sung.

## 8. CI/CD và cách deploy an toàn (đề xuất)
1. **CI** (GitHub Actions hoặc GitLab CI): mỗi push/PR chạy lint và unit/integration tests, quét dependency và quét Docker image (Trivy/Grype), dùng secrets scan.
2. Khi merge branch chính, build image với tag theo Git commit SHA và push lên container registry riêng, không dùng tag `latest` đơn độc; cân nhắc pin base image theo digest và cập nhật định kỳ.
3. **CD**: deploy image đã kiểm tra tới máy chủ qua workflow được bảo vệ, không đưa token/mật khẩu vào image; dùng secret manager, chỉ cấp quyền tối thiểu.
4. Production: chạy sau reverse proxy HTTPS/TLS, bật authentication, authorization, CSRF protection khi cần, rate limiting, centralized logging/monitoring, health check, sao lưu DB. Với nhiều người dùng hoặc tải lớn, đổi SQLite sang PostgreSQL.
5. Có staging, approval, rollback theo image tag và quét lỗ hổng thường xuyên.

**Đây là mô tả phương án CI/CD, không khẳng định dự án đã triển khai pipeline thực tế.**

## 9. Bằng chứng nên chụp màn hình
1. Mở Dockerfile trong VS Code thấy `FROM`, 4 `RUN`, `USER`, `ENTRYPOINT`, `CMD`.
2. Mở `docker-compose.yml` và `docker-entrypoint.sh`.
3. Terminal chạy `docker compose up --build -d` thành công.
4. Terminal `docker compose ps` báo running/healthy.
5. Website http://localhost:5000: thêm nhiệm vụ, sửa, đánh dấu hoàn thành, tìm kiếm/lọc và các thống kê.
6. Terminal `docker compose exec taskflow id` hiển thị UID không phải 0 (root).
7. Terminal `curl.exe http://localhost:5000/health` hiển thị `database: connected`.


## CI/CD THỰC TẾ VỚI GITHUB ACTIONS

Dự án đã tích hợp hai pipeline thực thi được:

- `.github/workflows/ci.yml`: tự động chạy khi có Pull Request hoặc push vào `main`, `dev`. Workflow cài Python 3.12, cài dependencies, kiểm tra cú pháp, chạy smoke tests, build Docker image và quét image bằng Trivy. Bước quét trả lỗi nếu tìm được lỗ hổng HIGH/CRITICAL đã có bản vá.
- `.github/workflows/publish.yml`: chạy khi push nhánh `main` hoặc kích hoạt thủ công; chạy test, build và quét image trước khi đăng nhập GitHub Container Registry (GHCR) qua `GITHUB_TOKEN` do GitHub cấp. Sau đó phát hành image với nhãn `latest` và mã commit SHA. Đây là **Continuous Delivery (đưa image lên registry)**, không tự ý triển khai lên máy chủ thật.

### Bật pipeline

1. Tạo repository GitHub mới, đưa **nội dung bên trong thư mục `taskflow`** lên thư mục gốc của repository. Nhớ giữ nguyên `.github/workflows` (thư mục ẩn).
2. Trong repository mở tab **Actions** để xem kết quả. Push vào nhánh `main` sẽ chạy cả hai workflow, push vào `dev` chỉ chạy CI. Khi tạo Pull Request cũng chạy CI.
3. Để workflow publish image, vào repository **Settings → Actions → General → Workflow permissions**; đảm bảo quy tắc tổ chức cho phép cấp `packages: write` cho `GITHUB_TOKEN` (workflow đã khai báo quyền tối thiểu này). Một số chính sách tổ chức có thể hạn chế publish.
4. Vào tab **Packages** trên GitHub để kiểm tra image `ghcr.io/<owner-chữ-thường>/taskflow:latest`. Package có thể ở chế độ private; thay đổi visibility nếu muốn người khác pull mà không đăng nhập.

### Phân biệt CI và CD

- **CI:** kiểm thử và kiểm tra chất lượng trước khi phát hành.
- **CD/Delivery:** phát hành Docker image đạt chuẩn lên GHCR, sẵn sàng tải và triển khai.
- **Deployment:** cập nhật container chạy trên server thật (không tự động trong bài này vì chưa cấu hình server và secrets triển khai).

### Lệnh Git cơ bản trên Windows PowerShell

```powershell
git init
git add .
git commit -m "feat: TaskFlow Docker and GitHub Actions CI/CD"
git branch -M main
git remote add origin https://github.com/TEN-TAI-KHOAN/TEN-REPO.git
git push -u origin main
```

Thay `TEN-TAI-KHOAN` và `TEN-REPO` bằng tài khoản và repository thực tế của bạn. Đăng nhập GitHub khi Git yêu cầu. Nếu repository đã có lịch sử commit, hãy clone và đồng bộ thay vì chạy `git init` lại.

**Lưu ý an toàn:** Không commit token, password, `.env` chứa secrets; dùng GitHub Secrets cho khóa thực tế. Quyền `packages: write` chỉ được cấp cho workflow publish. Có thể tăng an toàn bằng cách pin GitHub Actions theo commit SHA, dùng branch protection, kiểm tra dependency định kỳ, ký image và bổ sung phê duyệt trước khi deploy production.
