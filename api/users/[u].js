// PUT /api/users/<tên> — sửa tên, mật khẩu, quyền; DELETE — xóa tài khoản (cần quyền quan_tri)
const T = require("../_tk");
module.exports = T.guard(async (req, res, { me, accs }) => {
  const u = String(req.query.u || "").toLowerCase(), a = accs[u];
  if (u === T.DEMO.user) return T.fail(res, 400, "Tài khoản khách là tài khoản cố định, không sửa được");
  if (!a) return T.fail(res, 404, "Không tìm thấy tài khoản");
  if (req.method === "PUT") {
    const b = await T.body(req);
    if (b.ten !== undefined) a.ten = T.str(b.ten, 60) || u;
    if (b.quyen !== undefined) {
      const q = T.cleanPerms(b.quyen);
      if (u === me.user && !q.includes("quan_tri")) return T.fail(res, 400, "Bạn không thể tự bỏ quyền quản lý tài khoản của chính mình");
      a.quyen = q;
    }
    let headers = {};
    if (b.password) {
      if (String(b.password).length < 6) return T.fail(res, 400, "Mật khẩu cần ít nhất 6 ký tự");
      Object.assign(a, T.hashPass(String(b.password)));   // phiên cũ của tài khoản này tự hết hiệu lực
      if (u === me.user) headers["Set-Cookie"] = T.cookie(T.makeToken(u, a), T.SESSION_HOURS * 3600);
    }
    await T.saveAccounts(accs);
    return T.send(res, 200, { ok: true }, headers);
  }
  if (req.method === "DELETE") {
    if (u === me.user) return T.fail(res, 400, "Không thể tự xóa tài khoản của mình");
    delete accs[u]; await T.saveAccounts(accs);
    return T.send(res, 200, { ok: true });
  }
  return T.fail(res, 405, "Không hỗ trợ");
}, { need: "quan_tri" });
