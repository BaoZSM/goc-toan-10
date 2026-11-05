// Tài khoản trên Vercel: lưu trong cơ sở dữ liệu Upstash Redis (miễn phí), không cần cài thêm gói nào.
// Biến môi trường cần có (Vercel tự thêm khi kết nối Upstash qua mục Storage):
//   KV_REST_API_URL + KV_REST_API_TOKEN   (hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//   ADMIN_MAT_KHAU   mật khẩu để tạo tài khoản "admin" lần đầu tiên
//   SESSION_SECRET   (không bắt buộc) chuỗi bí mật để ký phiên đăng nhập
const crypto = require("crypto");

const DEMO = { user: "khach", pass: "ltk2026", ten: "Khách tham quan" };
const PERMS = ["sua_bai", "sua_tai_lieu", "quan_tri", "giao_vien"];
const USER_RE = /^[a-z0-9._-]{3,30}$/;
const KEY = "toan10:tai-khoan";
const SESSION_HOURS = 24 * 7;

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const SECRET = process.env.SESSION_SECRET || (DB_TOKEN ? crypto.createHash("sha256").update("toan10|" + DB_TOKEN).digest("hex") : "");

const dbOn = () => !!(DB_URL && DB_TOKEN);
async function redis(...cmd) {
  const r = await fetch(DB_URL, { method: "POST", headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error("Lỗi cơ sở dữ liệu: " + (d.error || r.status));
  return d.result;
}
async function loadAccounts() { const v = await redis("GET", KEY); try { return v ? JSON.parse(v) : {}; } catch { return {}; } }
const saveAccounts = accs => redis("SET", KEY, JSON.stringify(accs));

const cleanPerms = q => Array.isArray(q) ? PERMS.filter(p => q.includes(p)) : [];
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const today = () => new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
function hashPass(pass) { const salt = crypto.randomBytes(16); return { salt: salt.toString("hex"), hash: crypto.scryptSync(pass, salt, 64).toString("hex") }; }
function passOK(acc, pass) {
  if (!acc) { crypto.scryptSync(pass, "dummy-salt", 64); return false; }
  const h = crypto.scryptSync(pass, Buffer.from(acc.salt, "hex"), 64);
  return crypto.timingSafeEqual(h, Buffer.from(acc.hash, "hex"));
}

// Phiên đăng nhập: cookie có chữ ký. pv = dấu của mật khẩu → đổi mật khẩu hoặc xóa tài khoản thì phiên cũ hết hiệu lực.
const b64 = s => Buffer.from(s).toString("base64url");
const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
function makeToken(user, acc) { const body = b64(JSON.stringify({ u: user, pv: acc ? acc.salt.slice(0, 8) : "khach", exp: Date.now() + SESSION_HOURS * 3600e3 })); return body + "." + sign(body); }
function readToken(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)tk=([^;]+)/); if (!m || !SECRET) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig || sig.length !== sign(body).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try { const t = JSON.parse(Buffer.from(body, "base64url").toString()); return t.exp > Date.now() ? t : null; } catch { return null; }
}
const cookie = (tok, age) => `tk=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;

async function currentUser(req, accs) {
  const t = readToken(req); if (!t) return null;
  if (t.u === DEMO.user && t.pv === "khach") return { user: DEMO.user, ten: DEMO.ten, lop: "", quyen: [], khach: true };
  accs = accs || await loadAccounts();
  const a = accs[t.u]; if (!a || a.salt.slice(0, 8) !== t.pv) return null;
  return { user: t.u, ten: a.ten || t.u, lop: a.lop || "", quyen: cleanPerms(a.quyen) };
}

function send(res, code, obj, headers = {}) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
  for (const k in headers) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
const fail = (res, code, loi, extra) => send(res, code, { loi, ...(extra || {}) });
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(ok => { let s = ""; req.on("data", c => { s += c; if (s.length > 1e5) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); req.on("error", () => ok({})); });
}
// Chặn trang web khác gửi yêu cầu thay mặt người dùng
function sameOrigin(req) {
  const o = req.headers.origin, host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!o) return true; try { return new URL(o).host === host; } catch { return false; }
}
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
// Khung chung: kiểm tra cơ sở dữ liệu và đăng nhập trước khi chạy
function guard(fn, { need } = {}) {
  return async (req, res) => {
    try {
      if (!dbOn()) return fail(res, 503, "Trang chưa kết nối cơ sở dữ liệu tài khoản", { ma: "no_db" });
      if (req.method !== "GET" && !sameOrigin(req)) return fail(res, 403, "Không được phép");
      const accs = await loadAccounts();
      const me = await currentUser(req, accs);
      if (need !== false && !me) return fail(res, 401, "Bạn cần đăng nhập");
      if (need && need !== true && !me.quyen.includes(need)) return fail(res, 403, "Tài khoản của bạn không có quyền làm việc này");
      return await fn(req, res, { me, accs });
    } catch (e) { console.error(e); return fail(res, 500, "Máy chủ gặp lỗi, thử lại sau nhé"); }
  };
}

// Mỗi tài khoản có một "ngăn" riêng trong cơ sở dữ liệu
const userKey = u => "toan10:u:" + u;
const DIEM = "toan10:diem", DANHGIA = "toan10:danhgia";
// Bỏ dữ liệu của tài khoản đã xóa
async function dropUserData(u) { await redis("DEL", userKey(u)); await redis("HDEL", DIEM, u); await redis("HDEL", DANHGIA, u); }
const isStudent = a => !!a && !cleanPerms(a.quyen).some(p => p === "quan_tri" || p === "giao_vien");
module.exports = { userKey, DIEM, DANHGIA, dropUserData, isStudent, DEMO, PERMS, USER_RE, SESSION_HOURS, redis, loadAccounts, saveAccounts, cleanPerms, str, today, hashPass, passOK, makeToken, cookie, send, fail, body, ipOf, guard, dbOn };
