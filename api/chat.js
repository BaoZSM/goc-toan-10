// POST /api/chat — nhận cuộc trò chuyện từ chatbox, hỏi AI, trả lời
const { config, allow, callAI, send, readBody } = require("./_ai");
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { loi: "Chỉ nhận POST" });
  // chỉ trả lời cho chính trang web này, không cho trang khác dùng ké khóa API
  const origin = req.headers.origin, host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && host && new URL(origin).host !== host) return send(res, 403, { loi: "Không được phép" });
  const cfg = config();
  if (!cfg.on) return send(res, 503, { ma: "no_ai", loi: "Trang chưa kết nối AI" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (!allow(ip, cfg.perHour)) return send(res, 429, { ma: "rate_limited", loi: `Mỗi giờ được hỏi tối đa ${cfg.perHour} câu. Bạn quay lại sau ít phút nhé.` });
  const b = await readBody(req);
  let msgs = Array.isArray(b.messages) ? b.messages.slice(-16) : [];
  msgs = msgs.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
             .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return send(res, 400, { loi: "Tin nhắn không hợp lệ" });
  try {
    return send(res, 200, { text: await callAI(cfg, msgs) });
  } catch (e) {
    const st = e && e.status; console.error("Lỗi AI:", st, e && (e.detail || e.message));
    if ((st === 400 && /api key|API_KEY/i.test((e && e.detail) || "")) || st === 401 || st === 403) return send(res, 502, { ma: "key", loi: "Khóa API của trang không đúng. Báo cho quản trị viên nhé." });
    if (st === 404) return send(res, 502, { ma: "model", loi: "Tên mô hình AI không đúng. Báo cho quản trị viên nhé." });
    if (st === 429) return send(res, 429, { ma: "rate_limited", loi: "AI đang quá tải hoặc hết lượt miễn phí. Thử lại sau ít phút." });
    return send(res, 502, { ma: "upstream", loi: "Không kết nối được AI lúc này. Thử lại sau nhé." });
  }
};
