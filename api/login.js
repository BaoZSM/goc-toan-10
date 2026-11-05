// POST /api/login — đăng nhập
const T = require("./_tk");
module.exports = T.guard(async (req, res, { accs }) => {
  if (req.method !== "POST") return T.fail(res, 405, "Chỉ nhận POST");
  const b = await T.body(req);
  const user = T.str(b.username, 30).toLowerCase(), pass = String(b.password || "");
  // Khóa tạm theo từng tài khoản trên từng máy (cả lớp dùng chung mạng trường nên không khóa theo IP)
  const failKey = "toan10:sai:" + T.ipOf(req) + ":" + user;
  const sai = +(await T.redis("GET", failKey)) || 0;
  if (sai >= 6) return T.fail(res, 429, "Nhập sai quá nhiều lần");
  if (user === T.DEMO.user && pass === T.DEMO.pass)
    return T.send(res, 200, { user, name: T.DEMO.ten, quyen: [] }, { "Set-Cookie": T.cookie(T.makeToken(user, null), T.SESSION_HOURS * 3600) });
  // Tạo tài khoản quản trị đầu tiên: đăng nhập "admin" bằng mật khẩu đặt trong biến môi trường ADMIN_MAT_KHAU
  const boot = process.env.ADMIN_MAT_KHAU;
  if (user === "admin" && !accs.admin && boot && boot.length >= 6 && pass === boot) {
    accs.admin = { ...T.hashPass(pass), ten: "Quản trị viên", quyen: T.PERMS.slice(), tao: T.today() };
    await T.saveAccounts(accs);
  }
  const acc = user && pass ? accs[user] : null;
  if (T.passOK(acc, pass || "x")) {
    await T.redis("DEL", failKey);
    return T.send(res, 200, { user, name: acc.ten || user, lop: acc.lop || "", quyen: T.cleanPerms(acc.quyen) }, { "Set-Cookie": T.cookie(T.makeToken(user, acc), T.SESSION_HOURS * 3600) });
  }
  await T.redis("INCR", failKey); await T.redis("EXPIRE", failKey, 600);
  return T.fail(res, 401, "Sai tên đăng nhập hoặc mật khẩu");
}, { need: false });
