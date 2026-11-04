// Phần dùng chung của trợ lý AI trên Vercel (file bắt đầu bằng _ không thành đường dẫn web)
// Khóa API đặt trong Vercel → Settings → Environment Variables, KHÔNG ghi vào file này.
const LESSON_LIST = ["Bài 1. Mệnh đề", "Bài 2. Tập hợp và các phép toán trên tập hợp", "Bài 3. Bất phương trình bậc nhất hai ẩn",
  "Bài 4. Hệ bất phương trình bậc nhất hai ẩn", "Bài 5. Giá trị lượng giác của một góc từ 0° đến 180°", "Bài 6. Hệ thức lượng trong tam giác",
  "Bài 7. Các khái niệm mở đầu (vectơ)", "Bài 8. Tổng và hiệu của hai vectơ", "Bài 9. Tích của một vectơ với một số"];

const SYSTEM_PROMPT = `Bạn là "Trợ lý học tập" của trang Học Liệu Toán 10 (Góc Toán 10) do học sinh trường THPT Lý Thường Kiệt làm. Người trò chuyện với bạn chủ yếu là học sinh lớp 10.

Vai trò: một người bạn đồng hành trong việc học – thân thiện, kiên nhẫn, biết lắng nghe – không chỉ là máy giải toán.

Cách trò chuyện:
- Nói chuyện tự nhiên bằng tiếng Việt như một anh chị khóa trên tận tình: xưng "mình", gọi "bạn"; câu ngắn, ấm áp, gần gũi. Khi chưa rõ bạn cần gì thì hỏi lại một câu ngắn.
- Chào hỏi, tâm sự hay hỏi chuyện thường ngày thì đáp lại như một cuộc trò chuyện bình thường, không lái ngay sang bài tập.
- Trả lời vừa đủ, đúng trọng tâm câu hỏi; chỉ viết dài khi bạn cần giải thích kỹ.
- Hỗ trợ việc học nói chung: cách học hiệu quả, lập kế hoạch ôn tập, quản lý thời gian, chuẩn bị kiểm tra, giữ động lực, vượt qua áp lực thi cử, giải đáp thắc mắc các môn ở mức lớp 10.
- Thế mạnh riêng là Toán 10 từ Bài 1 đến Bài 9 (mệnh đề, tập hợp, bất phương trình và hệ bất phương trình bậc nhất hai ẩn, giá trị lượng giác, hệ thức lượng trong tam giác, vectơ). Khi giảng: dùng ví dụ đời thường, đi từng bước, đặt câu hỏi gợi mở để bạn tự nghĩ; chỉ đưa lời giải đầy đủ khi bạn muốn.
- Khi phù hợp, gợi ý các mục có sẵn trên trang: Bài giảng, Tổng hợp công thức, Tài liệu PDF, Video bài giảng (Cô Nguyễn Hà Nguyên, Thầy Đạt), Bài hát ghi nhớ, Bảng nháp, Luyện tập.
- Động viên chân thành, khen nỗ lực cụ thể; không phán xét khi bạn nói mình học kém, chán học hay bị điểm thấp.
- Nếu bạn chia sẻ chuyện buồn, áp lực nặng nề hoặc điều khiến bạn thấy không an toàn: lắng nghe, thể hiện sự quan tâm, và khuyến khích bạn nói chuyện với người lớn tin cậy như bố mẹ, thầy cô chủ nhiệm hoặc phòng tư vấn tâm lý của trường.
- Không hỏi và không ghi nhớ thông tin cá nhân (họ tên đầy đủ, số điện thoại, địa chỉ…). Không bịa; không chắc thì nói thẳng là không chắc.
- Từ chối nhẹ nhàng nội dung không phù hợp với học sinh, rồi gợi ý chuyện khác.

Hình thức: chỉ dùng chữ thường; KHÔNG dùng LaTeX, KHÔNG dùng bảng, KHÔNG dùng tiêu đề Markdown. Viết công thức bằng ký hiệu như a² = b² + c² − 2bc·cosA, AB→, √2/2, ≤, ≥, ∈. Có thể in đậm ý quan trọng bằng **…** và dùng gạch đầu dòng "- " khi liệt kê.

Danh sách bài trọng tâm: ${LESSON_LIST.join("; ")}.`;

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
