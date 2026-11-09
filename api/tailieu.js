// Tài liệu giáo viên gửi cho học sinh (Word, PowerPoint, Excel, PDF, ảnh, zip…)
// File được chia thành từng phần nhỏ và lưu trong cơ sở dữ liệu Upstash, không cần cài thêm gì.
// GET    /api/tailieu                    → danh sách tài liệu mình được xem (+ danh sách lớp nếu là giáo viên)
// GET    /api/tailieu?id=<id>&c=<i>      → tải phần thứ i của file (dữ liệu nhị phân)
// POST   /api/tailieu { act:"tao", ten, nd, lop, file, size }   → giáo viên: bắt đầu gửi file, nhận id và số phần
// POST   /api/tailieu { act:"phan", id, i, data }               → giáo viên: gửi một phần (base64)
// DELETE /api/tailieu?id=<id>            → người gửi hoặc quản trị viên xóa
const T = require("./_tk");
const crypto = require("crypto");

const META = "toan10:tlgv";
const chunkKey = (id, i) => `toan10:tlgv:c:${id}:${i}`;
const CHUNK = 700 * 1024;                 // mỗi phần ~700 KB (an toàn với giới hạn của Upstash và Vercel)
const MAX_FILE = 20 * 1024 * 1024;        // tối đa 20 MB một file
const MAX_TOTAL = 150 * 1024 * 1024;      // tổng dung lượng tất cả file, chừa chỗ cho dữ liệu khác
const TYPES = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  txt: "text/plain", zip: "application/zip", ggb: "application/octet-stream"
};
const extOf = n => (String(n).toLowerCase().match(/\.([a-z0-9]{2,5})$/) || [])[1] || "";
const parse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const isTeacher = me => me.quyen.includes("giao_vien") || me.quyen.includes("quan_tri");
const canSee = (me, f) => isTeacher(me) || !f.lop || (me.lop && f.lop === me.lop);

async function readJSON(req, max) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let data = ""; for await (const c of req) { data += c; if (data.length > max) return null; }
  try { return JSON.parse(data || "{}"); } catch { return {}; }
}
async function all() {
  const flat = await T.redis("HGETALL", META) || [], out = [];
  for (let i = 0; i < flat.length; i += 2) { const f = parse(flat[i + 1]); if (f) out.push(f); }
  return out;
}
async function drop(f) {
  const keys = Array.from({ length: f.n }, (_, i) => chunkKey(f.id, i));
  for (let i = 0; i < keys.length; i += 50) await T.redis("DEL", ...keys.slice(i, i + 50));
  await T.redis("HDEL", META, f.id);
}
const pub = (f, me, accs) => ({
  id: f.id, ten: f.ten, nd: f.nd, lop: f.lop, file: f.file, ext: f.ext, type: TYPES[f.ext] || "application/octet-stream",
  size: f.size, n: f.n, luc: f.luc, by: f.by, nguoi: (accs[f.by] && accs[f.by].ten) || f.by,
  xoa: f.by === me.user || me.quyen.includes("quan_tri")
});

module.exports = T.guard(async (req, res, { me, accs }) => {
  const teacher = isTeacher(me);

  if (req.method === "GET" && req.query.id) {
    const f = parse(await T.redis("HGET", META, String(req.query.id)));
    if (!f || !f.xong || !canSee(me, f)) return T.fail(res, 404, "Không tìm thấy tài liệu");
    const i = Number(req.query.c);
    if (!(Number.isInteger(i) && i >= 0 && i < f.n)) return T.fail(res, 400, "Phần không hợp lệ");
    const b64 = await T.redis("GET", chunkKey(f.id, i));
    if (!b64) return T.fail(res, 410, "File bị thiếu, nhờ thầy cô gửi lại");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.end(Buffer.from(b64, "base64"));
  }

  if (req.method === "GET") {
    let list = await all();
    if (teacher) {   // dọn các lần gửi bị bỏ dở quá 2 giờ
      const stale = list.filter(f => !f.xong && Date.now() - f.luc > 2 * 3600e3);
      for (const f of stale) await drop(f);
      list = list.filter(f => !stale.includes(f));
    }
    list = list.filter(f => f.xong && canSee(me, f)).sort((a, b) => b.luc - a.luc);
    const out = { list: list.map(f => pub(f, me, accs)), gv: teacher };
    if (teacher) {
      out.lops = [...new Set(Object.values(accs).filter(T.isStudent).map(a => a.lop).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
      out.dung = list.reduce((s, f) => s + f.size, 0); out.toiDa = MAX_TOTAL; out.maxFile = MAX_FILE;
    }
    return T.send(res, 200, out);
  }

  if (req.method === "POST") {
    if (!teacher) return T.fail(res, 403, "Chỉ giáo viên được gửi tài liệu");
    const b = await readJSON(req, 1.4e6);
    if (b === null) return T.fail(res, 413, "Phần file quá lớn");
    if (b.act === "tao") {
      const ten = T.str(b.ten, 120), nd = T.str(b.nd, 600), lop = T.str(b.lop, 20), file = T.str(b.file, 120).replace(/[\\/:*?"<>|]/g, "_");
      const ext = extOf(file), size = Math.floor(Number(b.size));
      if (!ten) return T.fail(res, 400, "Cần nhập tên tài liệu");
      if (!TYPES[ext]) return T.fail(res, 400, "Chỉ nhận PDF, Word, PowerPoint, Excel, ảnh, txt, zip hoặc GeoGebra");
      if (!(size > 0)) return T.fail(res, 400, "File trống");
      if (size > MAX_FILE) return T.fail(res, 413, "File lớn hơn 20 MB. Hãy nén hoặc chia nhỏ file.");
      const list = await all(), used = list.reduce((s, f) => s + (f.size || 0), 0);
      if (used + size > MAX_TOTAL) return T.fail(res, 413, "Kho tài liệu đã gần đầy. Hãy xóa bớt tài liệu cũ rồi gửi lại.");
      const f = { id: crypto.randomBytes(6).toString("hex"), ten, nd, lop, file, ext, size, n: Math.ceil(size / CHUNK), by: me.user, luc: Date.now(), xong: false };
      await T.redis("HSET", META, f.id, JSON.stringify(f));
      return T.send(res, 200, { id: f.id, n: f.n, chunk: CHUNK });
    }
    if (b.act === "phan") {
      const f = parse(await T.redis("HGET", META, String(b.id || "")));
      if (!f || f.by !== me.user) return T.fail(res, 404, "Không tìm thấy lần gửi này");
      const i = Number(b.i), data = String(b.data || "");
      if (!(Number.isInteger(i) && i >= 0 && i < f.n)) return T.fail(res, 400, "Phần không hợp lệ");
      const len = Buffer.from(data, "base64").length, want = i < f.n - 1 ? CHUNK : f.size - CHUNK * (f.n - 1);
      if (len !== want) return T.fail(res, 400, "Phần file bị lỗi, thử gửi lại");
      await T.redis("SET", chunkKey(f.id, i), data);
      const have = await T.redis("EXISTS", ...Array.from({ length: f.n }, (_, k) => chunkKey(f.id, k)));
      if (have === f.n && !f.xong) { f.xong = true; f.luc = Date.now(); await T.redis("HSET", META, f.id, JSON.stringify(f)); }
      return T.send(res, 200, { ok: true, xong: have === f.n, doc: have === f.n ? pub(f, me, accs) : null });
    }
    return T.fail(res, 400, "Yêu cầu không hợp lệ");
  }

  if (req.method === "DELETE") {
    const f = parse(await T.redis("HGET", META, String(req.query.id || "")));
    if (!f) return T.fail(res, 404, "Không tìm thấy tài liệu");
    if (f.by !== me.user && !me.quyen.includes("quan_tri")) return T.fail(res, 403, "Chỉ người gửi hoặc quản trị viên được xóa");
    await drop(f);
    return T.send(res, 200, { ok: true });
  }
  return T.fail(res, 405, "Không hỗ trợ");
});
