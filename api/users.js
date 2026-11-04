// GET /api/users — danh sách tài khoản; POST /api/users — tạo tài khoản (cần quyền quan_tri)
const T = require("./_tk");
module.exports = T.guard(async (req, res, { me, accs }) => {
  if (req.method === "GET")
    return T.send(res, 200, { users: [{ user: T.DEMO.user, ten: T.DEMO.ten, quyen: [], tao: "" }].concat(Object.entries(accs).map(([u, a]) => ({ user: u, ten: a.ten || u, quyen: T.cleanPerms(a.quyen), tao: a.tao || "" }))) });
  if (req.method === "POST") {
    const b = await T.body(req);
    const user = T.str(b.username, 30).toLowerCase(), pass = String(b.password || "");
    if (!T.USER_RE.test(user)) return T.fail(res, 400, "Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
    if (accs[user] || user === T.DEMO.user) return T.fail(res, 409, "Tên đăng nhập này đã có");
    if (pass.length < 6) return T.fail(res, 400, "Mật khẩu cần ít nhất 6 ký tự");
    accs[user] = { ...T.hashPass(pass), ten: T.str(b.ten, 60) || user, quyen: T.cleanPerms(b.quyen), tao: T.today() };
    await T.saveAccounts(accs);
    return T.send(res, 200, { ok: true });
  }
  return T.fail(res, 405, "Không hỗ trợ");
}, { need: "quan_tri" });
