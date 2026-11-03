// Phần dùng chung của trợ lý AI trên Vercel (file bắt đầu bằng _ không thành đường dẫn web)
// Khóa API đặt trong Vercel → Settings → Environment Variables, KHÔNG ghi vào file này.
const LESSON_LIST = ["Bài 1. Mệnh đề", "Bài 2. Tập hợp và các phép toán trên tập hợp", "Bài 3. Bất phương trình bậc nhất hai ẩn",
  "Bài 4. Hệ bất phương trình bậc nhất hai ẩn", "Bài 5. Giá trị lượng giác của một góc từ 0° đến 180°", "Bài 6. Hệ thức lượng trong tam giác",
  "Bài 7. Các khái niệm mở đầu (vectơ)", "Bài 8. Tổng và hiệu của hai vectơ", "Bài 9. Tích của một vectơ với một số"];

const SYSTEM_PROMPT = `Bạn là "Trợ lý Toán 10" trên trang học liệu Góc Toán 10 do học sinh trường THPT Lý Thường Kiệt làm, dành cho học sinh lớp 10 (sách Kết nối tri thức).
Cách trả lời:
- Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn, rõ ràng như một bạn học giỏi đang giảng bài.
- Trọng tâm là Bài 1 đến Bài 9: ${LESSON_LIST.join("; ")}. Câu hỏi toán khác vẫn trả lời, nhưng nói rõ nếu nằm ngoài phạm vi Bài 1–9.
- Khi học sinh nhờ giải bài tập: hướng dẫn từng bước, đặt câu hỏi gợi mở; chỉ đưa lời giải đầy đủ khi học sinh yêu cầu rõ.
- Khi học sinh xin bài tập: cho 1 bài, chờ học sinh trả lời rồi mới chấm và giải thích.
- Chỉ dùng chữ thường, KHÔNG dùng LaTeX, KHÔNG dùng bảng, KHÔNG dùng tiêu đề Markdown. Viết công thức bằng ký hiệu như a² = b² + c² − 2bc·cosA, AB→, √2/2, ≤, ≥, ∈. Có thể in đậm ý quan trọng bằng **…**. Dùng gạch đầu dòng "- " khi liệt kê.
- Không bịa. Nếu không chắc, nói thẳng là không chắc.
- Không hỏi và không lưu thông tin cá nhân của học sinh.
- Câu hỏi không liên quan đến học tập: từ chối nhẹ nhàng và gợi ý quay lại môn Toán.`;

function config() {
  const e = process.env;
  const provider = String(e.AI_PROVIDER || (e.GEMINI_API_KEY ? "gemini" : e.ANTHROPIC_API_KEY ? "claude" : "")).toLowerCase();
  const key = provider === "gemini" ? e.GEMINI_API_KEY : provider === "claude" ? e.ANTHROPIC_API_KEY : "";
  return { on: !!key, provider, key: key || "",
    model: e.AI_MODEL || (provider === "gemini" ? "gemini-flash-lite-latest" : "claude-haiku-5-5"),
    perHour: +e.AI_SO_CAU_MOI_GIO || 40 };   // mỗi máy (địa chỉ IP) hỏi tối đa bao nhiêu câu / giờ
}

// Giới hạn đơn giản theo địa chỉ IP (mỗi máy chủ Vercel giữ riêng, chỉ để chặn hỏi dồn dập)
const hits = new Map();
function allow(ip, perHour) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= perHour) return false;
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

async function callAI(cfg, messages) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    if (cfg.provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 1500, temperature: 0.4 } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw { status: r.status, detail: d.error && d.error.message };
      const text = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || "").join("").trim();
      if (!text) throw { status: 502, detail: "AI không trả lời (có thể câu hỏi bị chặn)" };
      return text;
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1500, system: SYSTEM_PROMPT, messages }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw { status: r.status, detail: d.error && d.error.message };
    const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text) throw { status: 502, detail: "AI không trả lời" };
    return text;
  } finally { clearTimeout(timer); }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let data = ""; for await (const c of req) { data += c; if (data.length > 60000) return {}; }
  try { return JSON.parse(data); } catch { return {}; }
}
module.exports = { config, allow, callAI, send, readBody };
