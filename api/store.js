// Ngăn lưu trữ riêng của từng tài khoản: lịch sử trò chuyện, các bảng nháp
// GET  /api/store?k=<khóa>          → { rec: { v, u } | null }
// GET  /api/store?prefix=chat:      → { keys: [...] }
// POST /api/store { items:[{k,v,u,del}] } → lưu nhiều mục một lúc (bản mới hơn thắng)
const T = require("./_tk");
const KEY_RE = /^(chat-index|board-index|(chat|board):[a-z0-9]{6,24})$/;
const MAX_BYTES = 600 * 1024, MAX_FIELDS = 400;
module.exports = T.guard(async (req, res, { me }) => {
  if (me.khach) return T.fail(res, 403, "Tài khoản khách chỉ lưu trên máy này");
  const hk = T.userKey(me.user);
  if (req.method === "GET") {
    const k = String(req.query.k || "");
    if (!KEY_RE.test(k)) return T.fail(res, 400, "Khóa không hợp lệ");
    const raw = await T.redis("HGET", hk, k);
    let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch {}
    return T.send(res, 200, { rec });
  }
  if (req.method === "POST") {
    const b = await T.body(req), items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    if (!items.length) return T.send(res, 200, { ok: true, luu: [] });
    for (const it of items) if (!it || !KEY_RE.test(String(it.k))) return T.fail(res, 400, "Khóa không hợp lệ");
    const keys = items.map(it => it.k);
    const old = await T.redis("HMGET", hk, ...keys);
    const set = [], del = [], luu = [], cu = [];
    items.forEach((it, i) => {
      let o = null; try { o = old[i] ? JSON.parse(old[i]) : null; } catch {}
      const u = Number(it.u) || Date.now();
      if (o && o.u > u) { cu.push(it.k); return; }          // máy khác vừa lưu bản mới hơn → giữ bản đó
      if (it.del) { del.push(it.k); luu.push(it.k); return; }
      const json = JSON.stringify({ v: it.v, u });
      if (json.length > MAX_BYTES) { cu.push(it.k); return; }
      set.push(it.k, json); luu.push(it.k);
    });
    if (set.length) {
      const n = await T.redis("HLEN", hk);
      if (n > MAX_FIELDS) return T.fail(res, 413, "Bộ nhớ của tài khoản đã đầy. Hãy xóa bớt cuộc trò chuyện hoặc bảng nháp cũ.");
      await T.redis("HSET", hk, ...set);
    }
    if (del.length) await T.redis("HDEL", hk, ...del);
    return T.send(res, 200, { ok: true, luu, cu });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
