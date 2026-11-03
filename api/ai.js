// GET /api/ai — cho trang biết trợ lý AI đã bật chưa (không bao giờ trả về khóa)
const { config, send } = require("./_ai");
module.exports = (req, res) => {
  const c = config();
  send(res, 200, { on: c.on, provider: c.on ? (c.provider === "gemini" ? "Gemini" : "Claude") : "" });
};
