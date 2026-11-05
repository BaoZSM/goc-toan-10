// GET /api/me — ai đang đăng nhập; PUT /api/me — tự đổi mật khẩu
const T = require("./_tk");
module.exports = T.guard(async (req, res, { me, accs }) => {
  if (req.method === "GET") return T.send(res, 200, { user: me.user, name: me.ten, lop: me.lop, quyen: me.quyen });
  if (req.method === "PUT") {
    if (me.khach) return T.fail(res, 400, "Tài khoản khách không đổi được mật khẩu");
    const b = await T.body(req), a = accs[me.user];
    if (!T.passOK(a, String(b.cu || "x"))) return T.fail(res, 400, "Mật khẩu hiện tại chưa đúng");
    const moi = String(b.moi || "");
    if (moi.length < 6) return T.fail(res, 400, "Mật khẩu mới cần ít nhất 6 ký tự");
    Object.assign(a, T.hashPass(moi)); await T.saveAccounts(accs);
    return T.send(res, 200, { ok: true }, { "Set-Cookie": T.cookie(T.makeToken(me.user, a), T.SESSION_HOURS * 3600) });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
