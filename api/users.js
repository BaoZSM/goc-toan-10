// GET /api/users — danh sách tài khoản; POST /api/users — tạo một hoặc nhiều tài khoản (cần quyền quan_tri)
const T = require("./_tk");
module.exports = T.guard(async (req, res, { me, accs }) => {
  if (req.method === "GET")
    return T.send(res, 200, { users: [{ user: T.DEMO.user, ten: T.DEMO.ten, lop: "", quyen: [], tao: "" }].concat(Object.entries(accs).map(([u, a]) => ({ user: u, ten: a.ten || u, lop: a.lop || "", quyen: T.cleanPerms(a.quyen), tao: a.tao || "" }))) });
  if (req.method === "POST") {
    const b = await T.body(req), pass = String(b.password || ""), lop = T.str(b.lop, 20), quyen = T.cleanPerms(b.quyen);
    if (pass.length < 6) return T.fail(res, 400, "Mật khẩu cần ít nhất 6 ký tự");
    // Tạo nhiều tài khoản cùng lúc: ds = [{ username, ten }]
    const list = Array.isArray(b.ds) ? b.ds.slice(0, 300) : [{ username: b.username, ten: b.ten }];
    const tao = [], bo = [];
    for (const it of list) {
      const user = T.str(it && it.username, 30).toLowerCase(), ten = T.str(it && it.ten, 60);
      if (!T.USER_RE.test(user)) { bo.push({ user, ly_do: "Tên đăng nhập không hợp lệ" }); continue; }
      if (accs[user] || user === T.DEMO.user) { bo.push({ user, ly_do: "Đã có" }); continue; }
      accs[user] = { ...T.hashPass(pass), ten: ten || user, lop, quyen, tao: T.today() }; tao.push(user);
    }
    if (!Array.isArray(b.ds) && bo.length) return T.fail(res, bo[0].ly_do === "Đã có" ? 409 : 400, bo[0].ly_do === "Đã có" ? "Tên đăng nhập này đã có" : "Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
    if (tao.length) await T.saveAccounts(accs);
    return T.send(res, 200, { ok: true, tao, bo });
  }
  return T.fail(res, 405, "Không hỗ trợ");
}, { need: "quan_tri" });
