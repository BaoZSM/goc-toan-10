// Thống kê học tập của một tài khoản
// GET /api/thongke            → số liệu của chính mình
// GET /api/thongke?u=<tên>    → số liệu của học sinh khác (chỉ giáo viên, quản trị viên)
// GET /api/thongke?ds=1       → danh sách học sinh để chọn (chỉ giáo viên, quản trị viên)
const T = require("./_tk");
const parse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
module.exports = T.guard(async (req, res, { me, accs }) => {
  if (req.method !== "GET") return T.fail(res, 405, "Không hỗ trợ");
  const teacher = me.quyen.includes("quan_tri") || me.quyen.includes("giao_vien");
  if (req.query.ds) {
    if (!teacher) return T.fail(res, 403, "Chỉ giáo viên và quản trị viên xem được");
    const rows = Object.entries(accs).filter(([, a]) => T.isStudent(a)).map(([u, a]) => ({ user: u, ten: a.ten || u, lop: a.lop || "" }))
      .sort((x, y) => x.lop.localeCompare(y.lop, "vi") || x.ten.localeCompare(y.ten, "vi"));
    return T.send(res, 200, { rows });
  }
  const u = String(req.query.u || me.user);
  if (u !== me.user && !teacher) return T.fail(res, 403, "Bạn chỉ xem được thống kê của chính mình");
  if (me.khach && u === me.user) return T.send(res, 200, { khach: true });
  const a = accs[u]; if (!a) return T.fail(res, 404, "Không có tài khoản này");
  const [st, ci, bi, dg] = await T.pipe([["HGET", T.userKey(u), "stats"], ["HGET", T.userKey(u), "chat-index"], ["HGET", T.userKey(u), "board-index"], ["HGET", T.DIEM, u]]);
  const S = parse(st), C = parse(ci), B = parse(bi), D = parse(dg) || {};
  const list = C && Array.isArray(C.v) ? C.v : [];
  return T.send(res, 200, {
    user: u, ten: a.ten || u, lop: a.lop || "",
    stats: S ? S.v : null,
    chats: { n: list.length, msgs: list.reduce((s, x) => s + (Number(x.n) || 0), 0) },
    boards: B && B.v && Array.isArray(B.v.list) ? B.v.list.length : 0,
    done: Array.isArray(D.done) ? D.done : [], best: D.best && typeof D.best === "object" ? D.best : {}
  });
});
