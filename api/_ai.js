// Phần dùng chung của trợ lý AI trên Vercel (file bắt đầu bằng _ không thành đường dẫn web)
// Khóa API đặt trong Vercel → Settings → Environment Variables, KHÔNG ghi vào file này.
const LESSON_LIST = ["Bài 1. Mệnh đề", "Bài 2. Tập hợp và các phép toán trên tập hợp", "Bài 3. Bất phương trình bậc nhất hai ẩn",
  "Bài 4. Hệ bất phương trình bậc nhất hai ẩn", "Bài 5. Giá trị lượng giác của một góc từ 0° đến 180°", "Bài 6. Hệ thức lượng trong tam giác",
  "Bài 7. Các khái niệm mở đầu (vectơ)", "Bài 8. Tổng và hiệu của hai vectơ", "Bài 9. Tích của một vectơ với một số"];

// ---- Ảnh đề bài và hình vẽ trong câu trả lời ----
const FIG_RULES = `

Ảnh: người dùng có thể gửi ảnh chụp đề bài. Đọc kỹ đề trong ảnh (kể cả hình vẽ), chép lại đề ngắn gọn ở dòng đầu rồi giải từng bước. Nếu ảnh mờ hay thiếu chữ thì nói rõ chỗ không đọc được.

Hình vẽ: khi đề có hình (tam giác, vectơ, đường tròn, góc) hoặc liên quan mặt phẳng tọa độ Oxy (điểm, đường thẳng, miền nghiệm của bất phương trình, đồ thị), hãy kèm MỘT hình minh họa ở cuối câu trả lời bằng khối mã đúng mẫu sau (trang web sẽ tự vẽ):
\`\`\`hinh
{"tieu_de":"Miền nghiệm của hệ","truc":true,"x":[-1,5],"y":[-1,5],
 "diem":[{"ten":"A","x":0,"y":2},{"ten":"B","x":2,"y":0}],
 "doan":[["A","B"]], "vecto":[["A","B"]],
 "duong_thang":[{"a":1,"b":1,"c":-2,"ten":"d: x + y = 2"}],
 "mien":[{"a":1,"b":1,"c":-2,"dau":"<="},{"a":-1,"b":0,"c":0,"dau":"<="}],
 "duong_tron":[{"tam":"A","r":1}],
 "goc":[{"dinh":"A","canh":["B","C"],"nhan":"60°"}],
 "do_thi":[{"f":"x^2-2*x-3","ten":"y = x² − 2x − 3"}]}
\`\`\`
Quy tắc cho khối hinh: JSON hợp lệ (dấu ngoặc kép, không chú thích); chỉ ghi các mục cần dùng; "truc": true khi bài có hệ trục Oxy, false khi chỉ là hình học (khi đó tự đặt tọa độ hợp lý, đúng tỉ lệ độ dài và số đo góc của đề). "doan", "vecto", "goc", "duong_tron" dùng tên điểm đã khai báo trong "diem". "duong_thang" và "mien" theo dạng ax + by + c (dấu "dau" là <, <=, >, >=); nhiều "mien" thì trang tô phần chung (miền nghiệm của hệ). "f" chỉ dùng x, số, + − * / ^, ngoặc và sin cos tan sqrt abs ln. Không viết khối hinh khi không cần hình.`;

// Chuẩn hóa tin nhắn: chữ, hoặc danh sách [{type:"text",text}|{type:"image",media_type,data}]
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function normMsgs(list) {
  let msgs = Array.isArray(list) ? list.slice(-16) : [], imgLeft = 2;
  msgs = msgs.filter(m => m && (m.role === "user" || m.role === "assistant"));
  for (let i = msgs.length - 1; i >= 0; i--) {     // giữ tối đa 2 ảnh gần nhất
    const m = msgs[i];
    if (typeof m.content === "string") { m.content = m.content.slice(0, m.role === "assistant" ? 8000 : 2000); continue; }
    if (!Array.isArray(m.content) || m.role !== "user") { m.content = ""; continue; }
    const out = [];
    m.content.slice(0, 4).forEach(b => {
      if (b && b.type === "text" && typeof b.text === "string" && b.text.trim()) out.push({ type: "text", text: b.text.slice(0, 2000) });
      else if (b && b.type === "image" && IMG_TYPES.includes(b.media_type) && typeof b.data === "string" && b.data.length < 2.2e6 && /^[A-Za-z0-9+/=]+$/.test(b.data.slice(0, 200))) {
        if (imgLeft > 0) { imgLeft--; out.push({ type: "image", media_type: b.media_type, data: b.data }); }
        else out.push({ type: "text", text: "[ảnh đề bài đã gửi trước đó]" });
      }
    });
    m.content = out.length ? out : "";
  }
  msgs = msgs.filter(m => (typeof m.content === "string" ? m.content.trim() : m.content.length)).map(m => ({ role: m.role, content: m.content }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}
const toClaude = m => ({ role: m.role, content: typeof m.content === "string" ? m.content : m.content.map(b => b.type === "image"
  ? { type: "image", source: { type: "base64", media_type: b.media_type, data: b.data } } : { type: "text", text: b.text }) });
const toGemini = m => ({ role: m.role === "assistant" ? "model" : "user", parts: typeof m.content === "string" ? [{ text: m.content }] : m.content.map(b => b.type === "image"
  ? { inlineData: { mimeType: b.media_type, data: b.data } } : { text: b.text }) });

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

Danh sách bài trọng tâm: ${LESSON_LIST.join("; ")}.` + FIG_RULES;

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
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 58000);
  try {
    if (cfg.provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map(toGemini),
          generationConfig: { maxOutputTokens: 3000, temperature: 0.4 } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw { status: r.status, detail: d.error && d.error.message };
      const text = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || "").join("").trim();
      if (!text) throw { status: 502, detail: "AI không trả lời (có thể câu hỏi bị chặn)" };
      return text;
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 3000, system: SYSTEM_PROMPT, messages: messages.map(toClaude) }) });
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
async function readBody(req, max = 60000) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let data = ""; for await (const c of req) { data += c; if (data.length > max) return {}; }
  try { return JSON.parse(data); } catch { return {}; }
}
module.exports = { config, allow, callAI, send, readBody, normMsgs };
