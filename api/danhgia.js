// Đánh giá website: mỗi tài khoản một đánh giá (có thể sửa), hiện tên người viết; có trả lời và nút hữu ích / không hữu ích
// GET    /api/danhgia                       → danh sách (quản trị thấy cả mục đã ẩn)
// PUT    /api/danhgia { sao, nd }           → viết hoặc sửa đánh giá của mình
// DELETE /api/danhgia                       → xóa đánh giá của mình
// POST   /api/danhgia
//   { act:"tl", user, nd }                  → trả lời đánh giá của <user>
//   { act:"xoa_tl", user, id }              → xóa trả lời (người viết hoặc quản trị)
//   { act:"an_tl", user, id, an }           → quản trị: ẩn / hiện trả lời
//   { act:"vote", user, v: 1 | -1 | 0 }     → hữu ích / không hữu ích / bỏ chọn
//   { user, an } | { user, xoa:true }       → quản trị: ẩn / hiện / xóa đánh giá
const T = require("./_tk");
const crypto = require("crypto");
const vai = a => a.quyen && a.quyen.includes("quan_tri") ? "Quản trị" : a.quyen && a.quyen.includes("giao_vien") ? "Giáo viên" : "Học sinh";
module.exports = T.guard(async (req, res, { me, accs }) => {
  const admin = me.quyen.includes("quan_tri");
  if (req.method === "GET") {
    const flat = await T.redis("HGETALL", T.DANHGIA) || [], recs = [];
    for (let i = 0; i < flat.length; i += 2) { try { recs.push([flat[i], JSON.parse(flat[i + 1])]); } catch {} }
    const live = recs.filter(([u, r]) => accs[u] && (!r.an || admin || u === me.user));
    const extra = await T.pipe(live.flatMap(([u]) => [["HGETALL", T.voteKey(u)], ["LRANGE", T.tlKey(u), "0", "-1"]]));
    const list = live.map(([u, r], i) => {
      const vf = extra[2 * i] || [], votes = {}; for (let k = 0; k < vf.length; k += 2) votes[vf[k]] = +vf[k + 1];
      const tl = (extra[2 * i + 1] || []).map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(x => x && accs[x.user] && (!x.an || admin || x.user === me.user))
        .map(x => ({ id: x.id, user: x.user, ten: accs[x.user].ten || x.user, vai: vai(accs[x.user]), lop: accs[x.user].lop || "", nd: x.nd, luc: x.luc, an: !!x.an }));
      const a = accs[u];
      return { user: u, ten: a.ten || u, lop: a.lop || "", vai: vai(a), sao: r.sao, nd: r.nd, luc: r.luc, sua: r.sua || 0, an: !!r.an,
        thich: Object.values(votes).filter(v => v > 0).length, khong: Object.values(votes).filter(v => v < 0).length, toi: votes[me.user] || 0, tl };
    });
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
  if (req.method === "DELETE") { await T.pipe([["HDEL", T.DANHGIA, me.user], ["DEL", T.tlKey(me.user)], ["DEL", T.voteKey(me.user)]]); return T.send(res, 200, { ok: true }); }
  if (req.method === "POST") {
    const b = await T.body(req), u = T.str(b.user, 30).toLowerCase();
    const raw = await T.redis("HGET", T.DANHGIA, u); if (!raw || !accs[u]) return T.fail(res, 404, "Không tìm thấy đánh giá");
    if (b.act === "vote") {
      if (me.khach) return T.fail(res, 403, "Đăng nhập bằng tài khoản riêng để bình chọn");
      if (u === me.user) return T.fail(res, 400, "Không tự bình chọn cho đánh giá của mình");
      const v = Number(b.v);
      if (v === 1 || v === -1) await T.redis("HSET", T.voteKey(u), me.user, String(v)); else await T.redis("HDEL", T.voteKey(u), me.user);
      return T.send(res, 200, { ok: true });
    }
    if (b.act === "tl") {
      if (me.khach) return T.fail(res, 403, "Đăng nhập bằng tài khoản riêng để trả lời");
      const nd = T.str(b.nd, 400); if (nd.length < 1) return T.fail(res, 400, "Trả lời đang trống");
      if ((await T.redis("LLEN", T.tlKey(u))) >= 200) return T.fail(res, 400, "Đánh giá này đã có quá nhiều trả lời");
      await T.redis("RPUSH", T.tlKey(u), JSON.stringify({ id: crypto.randomBytes(6).toString("hex"), user: me.user, nd, luc: Date.now(), an: false }));
      return T.send(res, 200, { ok: true });
    }
    if (b.act === "xoa_tl" || b.act === "an_tl") {
      const items = await T.redis("LRANGE", T.tlKey(u), "0", "-1") || [];
      const i = items.findIndex(x => { try { return JSON.parse(x).id === b.id; } catch { return false; } });
      if (i < 0) return T.fail(res, 404, "Không tìm thấy trả lời");
      const it = JSON.parse(items[i]);
      if (b.act === "xoa_tl") {
        if (!admin && it.user !== me.user) return T.fail(res, 403, "Chỉ người viết hoặc quản trị viên được xóa");
        await T.redis("LREM", T.tlKey(u), "1", items[i]); return T.send(res, 200, { ok: true });
      }
      if (!admin) return T.fail(res, 403, "Chỉ quản trị viên được ẩn trả lời");
      it.an = !!b.an; await T.redis("LSET", T.tlKey(u), String(i), JSON.stringify(it)); return T.send(res, 200, { ok: true });
    }
    if (!admin) return T.fail(res, 403, "Chỉ quản trị viên được ẩn hoặc xóa đánh giá");
    if (b.xoa) { await T.pipe([["HDEL", T.DANHGIA, u], ["DEL", T.tlKey(u)], ["DEL", T.voteKey(u)]]); return T.send(res, 200, { ok: true }); }
    const r = JSON.parse(raw); r.an = !!b.an; await T.redis("HSET", T.DANHGIA, u, JSON.stringify(r));
    return T.send(res, 200, { ok: true });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
