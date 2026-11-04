// /api/logout (và /logout) — đăng xuất: xóa cookie phiên
const T = require("./_tk");
module.exports = (req, res) => {
  const c = T.cookie("", 0);
  if (req.method === "GET") { res.statusCode = 302; res.setHeader("Set-Cookie", c); res.setHeader("Location", "/"); return res.end(); }
  return T.send(res, 200, { ok: true }, { "Set-Cookie": c });
};
