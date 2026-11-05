// Đánh giá website: mỗi tài khoản một đánh giá (có thể sửa), hiện tên người viết
// GET    /api/danhgia                 → danh sách (quản trị thấy cả bài đã ẩn)
// PUT    /api/danhgia { sao, nd }     → viết hoặc sửa đánh giá của mình
// DELETE /api/danhgia                 → xóa đánh giá của mình
// POST   /api/danhgia { user, an }    → quản trị: ẩn / hiện;  { user, xoa:true } → quản trị: xóa
const T = require("./_tk");
module.exports = T.guard(async (req, res, { me, accs }) => {
  const admin = me.quyen.includes("quan_tri");
  if (req.method === "GET") {
    const flat = await T.redis("HGETALL", T.DANHGIA) || [], list = [];
    for (let i = 0; i < flat.length; i += 2) {
      let r; try { r = JSON.parse(flat[i + 1]); } catch { continue; }
      const u = flat[i], a = accs[u];
      if (!a) continue;                                  // tài khoản đã bị xóa
      if (r.an && !admin && u !== me.user) continue;
      list.push({ user: u, ten: a.ten || u, lop: a.lop || "", vai: a.quyen && a.quyen.includes("quan_tri") ? "Quản trị" : a.quyen && a.quyen.includes("giao_vien") ? "Giáo viên" : "Học sinh", sao: r.sao, nd: r.nd, luc: r.luc, sua: r.sua || 0, an: !!r.an });
    }
    list.sort((x, y) => (y.sua || y.luc) - (x.sua || x.luc));
    return T.send(res, 200, { list, admin });
  }
  if (req.method === "PUT") {
    if (me.khach) return T.fail(res, 403, "Đăng nhập bằng tài khoản riêng để viết đánh giá");
    const b = await T.body(req), sao = Math.round(Number(b.sao)), nd = T.str(b.nd, 600);
    if (!(sao >= 1 && sao <= 5)) return T.fail(res, 400, "Chọn số sao từ 1 đến 5");
    if (nd.length < 3) return T.fail(res, 400, "Viết vài chữ nhận xét nhé (ít nhất 3 ký tự)");
    const raw = await T.redis("HGET", T.DANHGIA, me.user); let old = null; try { old = raw ? JSON.parse(raw) : null; } catch {}
    const now = Date.now(), rec = { sao, nd, luc: old ? old.luc : now, sua: old ? now : 0, an: old ? !!old.an : false };
    await T.redis("HSET", T.DANHGIA, me.user, JSON.stringify(rec));
    return T.send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") { await T.redis("HDEL", T.DANHGIA, me.user); return T.send(res, 200, { ok: true }); }
  if (req.method === "POST") {
    if (!admin) return T.fail(res, 403, "Chỉ quản trị viên được ẩn hoặc xóa đánh giá");
    const b = await T.body(req), u = T.str(b.user, 30).toLowerCase();
    const raw = await T.redis("HGET", T.DANHGIA, u); if (!raw) return T.fail(res, 404, "Không tìm thấy đánh giá");
    if (b.xoa) { await T.redis("HDEL", T.DANHGIA, u); return T.send(res, 200, { ok: true }); }
    const r = JSON.parse(raw); r.an = !!b.an; await T.redis("HSET", T.DANHGIA, u, JSON.stringify(r));
    return T.send(res, 200, { ok: true });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
