// Bảng thi đua lớp
// GET /api/diem          → bảng xếp hạng (chỉ học sinh: không tính khách, giáo viên, quản trị)
// GET /api/diem?toi=1    → tiến độ của chính mình { done, best, u }
// PUT /api/diem { done, best, u } → lưu tiến độ của mình (điểm luyện tập chỉ giữ mức cao nhất)
const T = require("./_tk");
const MAX = require("./_quiz-max.json");   // số câu của từng đề, để điểm không vượt quá thực tế
function clean(p) {
  const done = [...new Set((Array.isArray(p.done) ? p.done : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= MAX.bai))].sort((a, b) => a - b);
  const best = {};
  for (const k in (p.best || {})) if (MAX.de[k] !== undefined) { const v = Math.floor(Number(p.best[k])); if (v >= 0) best[k] = Math.min(v, MAX.de[k]); }
  return { done, best };
}
function points(p) {
  const hoc = p.done.length * MAX.diem.bai;
  let luyen = 0; for (const k in p.best) luyen += p.best[k] * (k.startsWith("b-") ? MAX.diem.cau_bai : MAX.diem.cau_khac);
  return { hoc, luyen, tong: hoc + luyen };
}
module.exports = T.guard(async (req, res, { me, accs }) => {
  if (req.method === "GET" && req.query.toi) {
    if (me.khach) return T.send(res, 200, { rec: null });
    const raw = await T.redis("HGET", T.DIEM, me.user); let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch {}
    return T.send(res, 200, { rec });
  }
  if (req.method === "GET") {
    if (me.khach) return T.fail(res, 403, "Tài khoản khách không xem được bảng thi đua");
    const flat = await T.redis("HGETALL", T.DIEM) || [], data = {};
    for (let i = 0; i < flat.length; i += 2) { try { data[flat[i]] = JSON.parse(flat[i + 1]); } catch {} }
    const rows = Object.entries(accs).filter(([u, a]) => T.isStudent(a)).map(([u, a]) => {
      const p = clean(data[u] || {}), d = points(p);
      return { user: u, ten: a.ten || u, lop: a.lop || "", bai: p.done.length, cau: Object.values(p.best).reduce((s, x) => s + x, 0), ...d, u: (data[u] && data[u].u) || 0 };
    }).sort((x, y) => y.tong - x.tong || y.bai - x.bai || x.u - y.u || x.ten.localeCompare(y.ten, "vi"));
    let hang = 0, prev = null; rows.forEach((r, i) => { if (r.tong !== prev) { hang = i + 1; prev = r.tong; } r.hang = hang; });
    return T.send(res, 200, { rows, cach_tinh: MAX.diem, toi_da: MAX.toi_da });
  }
  if (req.method === "PUT") {
    if (me.khach) return T.fail(res, 403, "Tài khoản khách không được xếp hạng");
    const b = await T.body(req), raw = await T.redis("HGET", T.DIEM, me.user);
    let old = null; try { old = raw ? JSON.parse(raw) : null; } catch {}
    const nw = clean(b), u = Number(b.u) || Date.now();
    const keep = old ? clean(old) : { done: [], best: {} };
    // điểm luyện tập: luôn giữ mức cao nhất; danh sách bài đã học: lấy bản mới hơn
    const best = { ...keep.best }; for (const k in nw.best) best[k] = Math.max(best[k] || 0, nw.best[k]);
    const done = !old || u >= (old.u || 0) ? nw.done : keep.done;
    const rec = { done, best, u: Math.max(u, (old && old.u) || 0) };
    await T.redis("HSET", T.DIEM, me.user, JSON.stringify(rec));
    return T.send(res, 200, { ok: true, rec });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
