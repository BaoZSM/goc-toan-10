/* ================= Máy tính cầm tay – phần lõi tính toán =================
   Không dùng DOM. Dùng chung cho hai máy (kiểu fx-580VN X và kiểu fx-880BTG). */
const CALC_CORE = (() => {
  /* ---------- lỗi ---------- */
  const ERR = {
    math:  ["Math ERROR",      "Kết quả vượt giới hạn hoặc phép tính không hợp lệ"],
    syntax:["Syntax ERROR",    "Biểu thức viết sai cú pháp"],
    dim:   ["Dimension ERROR", "Kích thước ma trận/vectơ không phù hợp"],
    arg:   ["Argument ERROR",  "Đối số không đúng"],
    stack: ["Stack ERROR",     "Biểu thức quá phức tạp"],
    time:  ["Time Out",        "Không tìm được nghiệm trong thời gian cho phép"],
    var:   ["Variable ERROR",  "Biến không hợp lệ"],
    range: ["Range ERROR",     "Vượt quá số dòng cho phép của bảng"],
    cant:  ["Can't Solve",     "Không tìm được nghiệm"],
    circ:  ["Circular ERROR",  "Ô tham chiếu vòng tròn"]
  };
  function err(code, pos){ const e = new Error(ERR[code] ? ERR[code][0] : code); e.calc = code; e.pos = pos; throw e; }
  const fin = x => { if(typeof x === "number" && (!isFinite(x) || Math.abs(x) >= 1e100)) err("math"); return x; };

  /* ---------- kiểu giá trị ---------- */
  class Cx { constructor(re, im){ this.re = re; this.im = im; } }
  const isC = v => v instanceof Cx;
  const isM = v => !!(v && v.m);
  const isV = v => !!(v && v.v);
  const isN = v => typeof v === "number";
  const toC = v => isC(v) ? v : new Cx(v, 0);
  const tidyC = c => { const s = Math.max(Math.abs(c.re), Math.abs(c.im)); const re = Math.abs(c.re) < 1e-13*s ? 0 : c.re, im = Math.abs(c.im) < 1e-13*s ? 0 : c.im; return im === 0 ? fin(re) : new Cx(fin(re), fin(im)); };

  /* ---------- bảng mã phím (token) ----------
     d: chữ hiện trên màn hình, l: danh sách từ vựng cho bộ phân tích */
  const TK = {};
  const def = (id, d, l) => { TK[id] = { d, l }; };
  "0123456789".split("").forEach(c => def(c, c, null));
  def(".", ".", null); def("E", "ᴇ", null);
  const OPS = { "+":"+", "−":"−", "×":"×", "÷":"÷" };
  for(const k in OPS) def(k, OPS[k], [{ k:"op", v:k }]);
  def("neg", "−", [{ k:"neg" }]);
  def("(", "(", [{ k:"(" }]); def(")", ")", [{ k:")" }]); def(",", ",", [{ k:"," }]);
  def("^(", "^(", [{ k:"op", v:"^" }, { k:"(" }]);
  def("xrt(", "ˣ√(", [{ k:"op", v:"xrt" }, { k:"(" }]);
  def("frac", "⌟", [{ k:"op", v:"frac" }]);
  def("npr", "P", [{ k:"op", v:"npr" }]); def("ncr", "C", [{ k:"op", v:"ncr" }]);
  def("ang", "∠", [{ k:"op", v:"ang" }]); def("dot", "•", [{ k:"op", v:"dot" }]);
  [["and"," and "],["or"," or "],["xor"," xor "],["xnor"," xnor "]].forEach(([k,d]) => def(k, d, [{ k:"op", v:k }]));
  [["eq","="],["ne","≠"],["gt",">"],["lt","<"],["ge","≥"],["le","≤"]].forEach(([k,d]) => def(k, d, [{ k:"op", v:k }]));
  [["sq","²"],["cube","³"],["inv","⁻¹"],["fact","!"],["pct","%"],["dms","°"],["udeg","ᵒ"],["urad","ʳ"],["ugra","ᵍ"],["topol","▶r∠θ"],["torect","▶a+bi"],["yhat","ŷ"],["xhat","x̂"],["xhat1","x̂₁"],["xhat2","x̂₂"]]
    .forEach(([k,d]) => def(k, d, [{ k:"post", v:k }]));
  const FN = { "sqrt(":"√(", "cbrt(":"∛(", "log(":"log(", "ln(":"ln(", "pow10(":"10^(", "exp(":"e^(",
    "sin(":"sin(", "cos(":"cos(", "tan(":"tan(", "asin(":"sin⁻¹(", "acos(":"cos⁻¹(", "atan(":"tan⁻¹(",
    "sinh(":"sinh(", "cosh(":"cosh(", "tanh(":"tanh(", "asinh(":"sinh⁻¹(", "acosh(":"cosh⁻¹(", "atanh(":"tanh⁻¹(",
    "abs(":"Abs(", "pol(":"Pol(", "rec(":"Rec(", "int(":"Int(", "intg(":"Intg(", "rnd(":"Rnd(", "gcd(":"GCD(", "lcm(":"LCM(",
    "ranint(":"RanInt#(", "deriv(":"d/dx(", "integ(":"∫(", "sum(":"Σ(", "prod(":"Π(",
    "arg(":"arg(", "conj(":"Conjg(", "rep(":"ReP(", "imp(":"ImP(",
    "det(":"Det(", "trn(":"Trn(", "ident(":"Identity(", "ref(":"Ref(", "rref(":"Rref(",
    "angle(":"Angle(", "unitv(":"UnitV(", "not(":"Not(", "negb(":"Neg(",
    "Sum(":"Sum(", "Mean(":"Mean(", "Min(":"Min(", "Max(":"Max(" };
  for(const k in FN) def(k, FN[k], [{ k:"fn", v:k.slice(0,-1) }, { k:"(" }]);
  const IDS = { pi:"π", e:"e", ans:"Ans", preans:"PreAns", i:"𝑖", ran:"Ran#",
    A:"A", B:"B", C:"C", D:"D", E_:"E", F:"F", x:"x", y:"y", z:"z", M:"M",
    MatA:"MatA", MatB:"MatB", MatC:"MatC", MatD:"MatD", MatAns:"MatAns",
    VctA:"VctA", VctB:"VctB", VctC:"VctC", VctD:"VctD", VctAns:"VctAns" };
  for(const k in IDS) def(k, IDS[k], [{ k:"id", v:k }]);
  ["hA","hB","hC","hD","hE","hF"].forEach(k => def(k, k[1], null));          // chữ số hệ 16
  [["bd","d"],["bh","h"],["bb","b"],["bo","o"]].forEach(([k,d]) => def(k, d, null)); // tiền tố hệ cơ số
  def("colon", ":", [{ k:"op", v:"colon" }]);
  def("ssEq", "=", null);                                                       // dấu = đầu công thức bảng tính

  /* thống kê: biến kết quả */
  const STV = { "st:n":"n", "st:mx":"x̄", "st:Sx":"Σx", "st:Sx2":"Σx²", "st:ox":"σx", "st:sx":"sx", "st:minX":"minX", "st:maxX":"maxX",
    "st:my":"ȳ", "st:Sy":"Σy", "st:Sy2":"Σy²", "st:Sxy":"Σxy", "st:oy":"σy", "st:sy":"sy", "st:minY":"minY", "st:maxY":"maxY",
    "st:a":"a", "st:b":"b", "st:c":"c", "st:r":"r", "st:med":"Med", "st:q1":"Q₁", "st:q3":"Q₃" };
  for(const k in STV) def(k, STV[k], [{ k:"id", v:k }]);

  /* hằng số khoa học (CODATA 2018) */
  const CONST = [
    ["mp","mₚ","Khối lượng proton",1.67262192369e-27,"kg"], ["mn","mₙ","Khối lượng neutron",1.67492749804e-27,"kg"],
    ["me","mₑ","Khối lượng electron",9.1093837015e-31,"kg"], ["mu","mμ","Khối lượng muon",1.883531627e-28,"kg"],
    ["a0","a₀","Bán kính Bohr",5.29177210903e-11,"m"], ["h","h","Hằng số Planck",6.62607015e-34,"J s"],
    ["hb","ħ","Hằng số Planck rút gọn",1.054571817e-34,"J s"], ["qe","e","Điện tích nguyên tố",1.602176634e-19,"C"],
    ["F","F","Hằng số Faraday",96485.33212,"C mol⁻¹"], ["NA","Nₐ","Số Avogadro",6.02214076e23,"mol⁻¹"],
    ["kB","k","Hằng số Boltzmann",1.380649e-23,"J K⁻¹"], ["Vm","Vₘ","Thể tích mol khí lí tưởng (273,15 K; 100 kPa)",22.71095464e-3,"m³ mol⁻¹"],
    ["R","R","Hằng số khí",8.314462618,"J mol⁻¹ K⁻¹"], ["c0","c₀","Tốc độ ánh sáng",299792458,"m s⁻¹"],
    ["e0","ε₀","Hằng số điện",8.8541878128e-12,"F m⁻¹"], ["u0","μ₀","Hằng số từ",1.25663706212e-6,"N A⁻²"],
    ["G","G","Hằng số hấp dẫn",6.6743e-11,"m³ kg⁻¹ s⁻²"], ["g","g","Gia tốc rơi tự do chuẩn",9.80665,"m s⁻²"],
    ["atm","atm","Áp suất khí quyển chuẩn",101325,"Pa"], ["sig","σ","Hằng số Stefan–Boltzmann",5.670374419e-8,"W m⁻² K⁻⁴"],
    ["Rinf","R∞","Hằng số Rydberg",10973731.56816,"m⁻¹"], ["amu","u","Đơn vị khối lượng nguyên tử",1.6605390666e-27,"kg"]
  ];
  CONST.forEach(([k,d]) => def("k:"+k, d, [{ k:"id", v:"k:"+k }]));
  const CONSTV = Object.fromEntries(CONST.map(c => ["k:"+c[0], c[3]]));

  /* chuyển đổi đơn vị */
  const CONV = [
    ["in>cm","in▶cm",x=>x*2.54], ["cm>in","cm▶in",x=>x/2.54], ["ft>m","ft▶m",x=>x*0.3048], ["m>ft","m▶ft",x=>x/0.3048],
    ["mi>km","mile▶km",x=>x*1.609344], ["km>mi","km▶mile",x=>x/1.609344], ["nmi>m","n mile▶m",x=>x*1852], ["m>nmi","m▶n mile",x=>x/1852],
    ["acre>m2","acre▶m²",x=>x*4046.8564224], ["m2>acre","m²▶acre",x=>x/4046.8564224], ["gal>L","gal(US)▶L",x=>x*3.785411784], ["L>gal","L▶gal(US)",x=>x/3.785411784],
    ["oz>g","oz▶g",x=>x*28.349523125], ["g>oz","g▶oz",x=>x/28.349523125], ["lb>kg","lb▶kg",x=>x*0.45359237], ["kg>lb","kg▶lb",x=>x/0.45359237],
    ["kmh>ms","km/h▶m/s",x=>x/3.6], ["ms>kmh","m/s▶km/h",x=>x*3.6], ["atm>Pa","atm▶Pa",x=>x*101325], ["Pa>atm","Pa▶atm",x=>x/101325],
    ["mmHg>Pa","mmHg▶Pa",x=>x*133.322387415], ["Pa>mmHg","Pa▶mmHg",x=>x/133.322387415], ["hp>kW","hp▶kW",x=>x*0.745699872], ["kW>hp","kW▶hp",x=>x/0.745699872],
    ["cal>J","cal▶J",x=>x*4.184], ["J>cal","J▶cal",x=>x/4.184], ["F>C","°F▶°C",x=>(x-32)*5/9], ["C>F","°C▶°F",x=>x*9/5+32]
  ];
  CONV.forEach(([k,d]) => def("cv:"+k, d, [{ k:"post", v:"cv:"+k }]));
  const CONVF = Object.fromEntries(CONV.map(c => ["cv:"+c[0], c[2]]));

  const disp = id => (TK[id] ? TK[id].d : id);

  /* ---------- phân tích từ vựng ---------- */
  const HEXV = { hA:10, hB:11, hC:12, hD:13, hE:14, hF:15 };
  const BASEP = { bd:10, bh:16, bb:2, bo:8 };
  function lex(toks, ctx){
    const out = [], base = ctx.mode === "base";
    let i = 0;
    const isDig = t => /^[0-9]$/.test(t) || t === "." || (base && HEXV[t] != null);
    while(i < toks.length){
      const t = toks[i];
      if(base && BASEP[t] != null){                      // số có tiền tố cơ số: d12, hFF…
        const b = BASEP[t]; let j = i + 1, s = "";
        while(j < toks.length && isDig(toks[j]) && toks[j] !== "."){ s += HEXV[toks[j]] != null ? "ABCDEF"[HEXV[toks[j]]-10] : toks[j]; j++; }
        if(!s) err("syntax", i);
        out.push({ k:"num", v:parseBase(s, b), i }); i = j; continue;
      }
      if(isDig(t)){
        let j = i, s = "";
        if(base){
          while(j < toks.length && isDig(toks[j])){ if(toks[j] === ".") err("syntax", j); s += HEXV[toks[j]] != null ? "ABCDEF"[HEXV[toks[j]]-10] : toks[j]; j++; }
          out.push({ k:"num", v:parseBase(s, ctx.base), i }); i = j; continue;
        }
        while(j < toks.length && /^[0-9.]$/.test(toks[j])){ s += toks[j]; j++; }
        if(toks[j] === "E"){
          j++; let es = "";
          if(toks[j] === "neg" || toks[j] === "−"){ es = "-"; j++; } else if(toks[j] === "+"){ j++; }
          let k = j; while(k < toks.length && /^[0-9]$/.test(toks[k])){ es += toks[k]; k++; }
          if(!/\d/.test(es)) err("syntax", j);
          if(s === "") s = "1";
          s += "e" + es; j = k;
        }
        if((s.match(/\./g)||[]).length > 1 || s === ".") err("syntax", i);
        out.push({ k:"num", v:parseFloat(s.startsWith(".") ? "0"+s : s), i }); i = j; continue;
      }
      if(t === "E"){ // ×10ˣ đứng đầu = 1×10ˣ
        let j = i + 1, es = "";
        if(toks[j] === "neg" || toks[j] === "−"){ es = "-"; j++; }
        while(j < toks.length && /^[0-9]$/.test(toks[j])){ es += toks[j]; j++; }
        if(!/\d/.test(es)) err("syntax", i);
        out.push({ k:"num", v:parseFloat("1e"+es), i }); i = j; continue;
      }
      if(ctx.cells && /^[A-E]$/.test(t === "E_" ? "E" : t) && /^[0-9]$/.test(toks[i+1] || "")){ // ô bảng tính A1…E45
        let j = i + 1, s = ""; while(j < toks.length && /^[0-9]$/.test(toks[j])){ s += toks[j]; j++; }
        out.push({ k:"cell", v:(t === "E_" ? "E" : t) + s, i }); i = j; continue;
      }
      const d = TK[t];
      if(!d || !d.l) err("syntax", i);
      d.l.forEach(x => out.push({ ...x, i }));
      i++;
    }
    return out;
  }
  function parseBase(s, b){
    const n = parseInt(s, b);
    if(isNaN(n) || !s.split("").every(c => parseInt(c, 16) < b)) err("syntax");
    // số nhập vào được hiểu như bit bù hai
    if(b === 2){ if(s.length > 16) err("math"); return n >= 32768 ? n - 65536 : n; }
    if(b === 16 || b === 8){ if(n > 0xFFFFFFFF) err("math"); return n >= 2147483648 ? n - 4294967296 : n; }
    if(n > 2147483647) err("math");
    return n;
  }

  /* ---------- phân tích cú pháp (Pratt) ---------- */
  const BP = { or:4, xor:4, xnor:4, and:5, eq:8, ne:8, gt:8, lt:8, ge:8, le:8, colon:2, "+":20, "−":20, "×":30, "÷":30, dot:30, npr:40, ncr:40, ang:40, frac:50, "^":60, xrt:60 };
  const IMP = 32, NEGBP = 45, POSTBP = 70;
  function parse(lx){
    let p = 0;
    const peek = () => lx[p], next = () => lx[p++];
    const primStart = t => t && (t.k === "num" || t.k === "id" || t.k === "fn" || t.k === "(" || t.k === "cell");
    function group(){ // ( … ) – thiếu ngoặc đóng ở cuối thì tự đóng
      const t = next(); if(!t || t.k !== "(") err("syntax", t ? t.i : undefined);
      if(peek() && peek().k === ")") err("syntax", peek().i);
      const e = expr(0);
      const c = peek();
      if(c && c.k === ")") next(); else if(c) err("syntax", c.i);
      return e;
    }
    function nud(t){
      if(!t) err("syntax");
      if(t.k === "num"){
        let v = t.v;
        if(peek() && peek().k === "post" && peek().v === "dms"){
          next(); let w = 60, tot = v;
          while(peek() && peek().k === "num" && lx[p+1] && lx[p+1].k === "post" && lx[p+1].v === "dms"){ tot += next().v / w; next(); w *= 60; }
          if(w === 60 && peek() && peek().k === "num" && !lx[p+1]) { tot += next().v / 60; } // 2°30 → 2°30′
          return { n:"num", v:tot, dms:true };
        }
        return { n:"num", v };
      }
      if(t.k === "id") return { n:"id", v:t.v, i:t.i };
      if(t.k === "cell") return { n:"cell", v:t.v, i:t.i };
      if(t.k === "(") { p--; return group(); }
      if(t.k === "neg") return { n:"neg", a:expr(NEGBP) };
      if(t.k === "op" && (t.v === "−" || t.v === "+")) return t.v === "−" ? { n:"neg", a:expr(NEGBP) } : expr(NEGBP);
      if(t.k === "fn"){
        const o = next(); if(!o || o.k !== "(") err("syntax", t.i);
        const args = [];
        if(peek() && peek().k === ")"){ next(); return { n:"call", f:t.v, args, i:t.i }; }
        for(;;){
          args.push(expr(0));
          const c = peek();
          if(!c) break;
          if(c.k === ","){ next(); continue; }
          if(c.k === ")"){ next(); break; }
          err("syntax", c.i);
        }
        return { n:"call", f:t.v, args, i:t.i };
      }
      err("syntax", t.i);
    }
    function expr(rbp){
      let left = nud(next());
      for(;;){
        const n = peek(); if(!n) break;
        if(n.k === "post"){ if(POSTBP <= rbp) break; next(); left = { n:"post", op:n.v, a:left, i:n.i }; continue; }
        if(n.k === "op"){
          const lbp = BP[n.v]; if(lbp <= rbp) break; next();
          if(n.v === "^" || n.v === "xrt"){ const b = group(); left = { n:"bin", op:n.v, a:left, b }; continue; }
          left = { n:"bin", op:n.v, a:left, b:expr(lbp), i:n.i }; continue;
        }
        if(primStart(n)){ if(IMP <= rbp) break; left = { n:"bin", op:"×", a:left, b:expr(IMP), imp:true }; continue; }
        break;
      }
      return left;
    }
    if(!lx.length) err("syntax");
    const e = expr(0);
    if(p < lx.length) err("syntax", lx[p].i);
    return e;
  }

  /* ---------- số học ---------- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while(b){ [a, b] = [b, a % b]; } return a; };
  const isInt = x => isN(x) && Number.isInteger(x);
  const nearInt = x => Math.abs(x - Math.round(x)) < 1e-9 * Math.max(1, Math.abs(x)) ? Math.round(x) : x;
  function toFrac(x, maxQ, tol){
    if(!isFinite(x)) return null;
    const s = Math.sign(x) || 1, a = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = a;
    for(let it = 0; it < 40; it++){
      const ai = Math.floor(b), h2 = ai*h1 + h0, k2 = ai*k1 + k0;
      if(k2 > maxQ) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if(Math.abs(a - h1/k1) <= tol * Math.max(1, a)) return { p:s*h1, q:k1 };
      const f = b - ai; if(f < 1e-18) break; b = 1/f;
    }
    return null;
  }
  const digits = n => String(Math.abs(n)).length;
  function factorSquare(n){ // n = a²·b, b không có ước chính phương
    let a = 1, b = 1, m = n;
    for(let p = 2; p*p <= m && p < 1e6; p++){ let c = 0; while(m % p === 0){ m /= p; c++; } a *= Math.pow(p, c >> 1); if(c & 1) b *= p; }
    b *= m; return { a, b };
  }
  /* dạng chính xác của một số thực: số nguyên, phân số, a√b/c, aπ/b */
  function exactOf(x){
    if(!isFinite(x) || Math.abs(x) >= 1e10) return null;
    if(x === 0) return { t:"int", v:0 };
    const f = toFrac(x, 1e9, 1e-13);
    if(f && digits(f.p) + digits(f.q) <= 10) return f.q === 1 ? { t:"int", v:f.p } : { t:"frac", p:f.p, q:f.q };
    const s = toFrac(x*x, 1e4, 2e-13);
    if(s && s.p > 0 && s.p <= 1e7){
      const { a, b } = factorSquare(s.p * s.q);
      if(b > 1 && b < 1e6){ const g = gcd(a, s.q); const A = a/g, Q = s.q/g; if(digits(A) + digits(b) + digits(Q) <= 10) return { t:"surd", sg:Math.sign(x), a:A, b, q:Q }; }
    }
    const pf = toFrac(x/Math.PI, 1000, 1e-13);
    if(pf && Math.abs(pf.p) <= 1000 && pf.p !== 0) return { t:"pi", p:pf.p, q:pf.q };
    return null;
  }

  /* ---------- góc ---------- */
  const toRad = (x, S) => S.ang === "D" ? x*Math.PI/180 : S.ang === "G" ? x*Math.PI/200 : x;
  const fromRad = (x, S) => S.ang === "D" ? x*180/Math.PI : S.ang === "G" ? x*200/Math.PI : x;
  const full = S => S.ang === "D" ? 360 : S.ang === "G" ? 400 : 2*Math.PI;
  function trig(f, x, S){
    if(Math.abs(x) >= (S.ang === "R" ? 1e10*Math.PI/180 : S.ang === "G" ? 1e10*10/9 : 1e10)) err("math");
    const F = full(S), q = F/4;
    let r = x % F; if(r < 0) r += F;
    const k = r / q;                                    // bội của góc vuông → kết quả đúng tuyệt đối
    if(S.ang !== "R" && Math.abs(k - Math.round(k)) < 1e-12){
      const n = ((Math.round(k) % 4) + 4) % 4;
      if(f === "sin") return [0,1,0,-1][n];
      if(f === "cos") return [1,0,-1,0][n];
      if(n % 2) err("math"); return 0;
    }
    const t = toRad(x, S);
    let v = f === "sin" ? Math.sin(t) : f === "cos" ? Math.cos(t) : Math.tan(t);
    if(f === "tan" && Math.abs(Math.cos(t)) < 1e-15) err("math");
    if(Math.abs(v) < 1e-15) v = 0;
    return v;
  }

  /* ---------- ma trận, vectơ ---------- */
  const M = m => ({ m });
  const V = v => ({ v });
  const dims = a => [a.m.length, a.m[0].length];
  function mmul(a, b){ const [r1,c1] = dims(a), [r2,c2] = dims(b); if(c1 !== r2) err("dim"); return M(Array.from({length:r1}, (_, i) => Array.from({length:c2}, (_, j) => { let s = 0; for(let k = 0; k < c1; k++) s += a.m[i][k]*b.m[k][j]; return s; }))); }
  function mdet(a){ const [r,c] = dims(a); if(r !== c) err("dim"); const m = a.m.map(x => x.slice()); let d = 1;
    for(let i = 0; i < r; i++){ let p = i; for(let k = i+1; k < r; k++) if(Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
      if(Math.abs(m[p][i]) < 1e-14) return 0; if(p !== i){ [m[p], m[i]] = [m[i], m[p]]; d = -d; } d *= m[i][i];
      for(let k = i+1; k < r; k++){ const f = m[k][i]/m[i][i]; for(let j = i; j < r; j++) m[k][j] -= f*m[i][j]; } }
    return nearInt(d); }
  function minv(a){ const [r,c] = dims(a); if(r !== c) err("dim"); const m = a.m.map((row, i) => row.concat(Array.from({length:r}, (_, j) => +(i === j))));
    for(let i = 0; i < r; i++){ let p = i; for(let k = i+1; k < r; k++) if(Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
      if(Math.abs(m[p][i]) < 1e-13) err("math"); [m[p], m[i]] = [m[i], m[p]]; const d = m[i][i]; for(let j = 0; j < 2*r; j++) m[i][j] /= d;
      for(let k = 0; k < r; k++) if(k !== i){ const f = m[k][i]; for(let j = 0; j < 2*r; j++) m[k][j] -= f*m[i][j]; } }
    return M(m.map(row => row.slice(r))); }
  function mref(a, reduced){ const m = a.m.map(x => x.slice()), [R, C] = dims(a); let lead = 0;
    for(let r = 0; r < R && lead < C; r++){ let i = r; while(Math.abs(m[i][lead]) < 1e-13){ i++; if(i === R){ i = r; lead++; if(lead === C) return M(clean(m)); } }
      [m[i], m[r]] = [m[r], m[i]]; const d = m[r][lead]; m[r] = m[r].map(x => x/d);
      for(let k = reduced ? 0 : r+1; k < R; k++) if(k !== r){ const f = m[k][lead]; m[k] = m[k].map((x, j) => x - f*m[r][j]); }
      lead++; }
    return M(clean(m)); }
  const clean = m => m.map(row => row.map(x => Math.abs(x) < 1e-13 ? 0 : x));
  const mapM = (a, f) => M(a.m.map(r => r.map(f)));
  const vnorm = a => Math.hypot(...a.v);
  const vdot = (a, b) => { if(a.v.length !== b.v.length) err("dim"); return a.v.reduce((s, x, i) => s + x*b.v[i], 0); };
  function vcross(a, b){ if(a.v.length !== b.v.length) err("dim"); const [x1,y1,z1 = 0] = a.v, [x2,y2,z2 = 0] = b.v; return V([y1*z2 - z1*y2, z1*x2 - x1*z2, x1*y2 - y1*x2]); }

  /* ---------- phép toán chung ---------- */
  function add(a, b, sub){
    if(isN(a) && isN(b)) return fin(sub ? a - b : a + b);
    if(isC(a) || isC(b)){ if(isM(a) || isM(b) || isV(a) || isV(b)) err("math"); const x = toC(a), y = toC(b); return tidyC(new Cx(sub ? x.re - y.re : x.re + y.re, sub ? x.im - y.im : x.im + y.im)); }
    if(isM(a) && isM(b)){ const [r1,c1] = dims(a), [r2,c2] = dims(b); if(r1 !== r2 || c1 !== c2) err("dim"); return M(a.m.map((r, i) => r.map((x, j) => sub ? x - b.m[i][j] : x + b.m[i][j]))); }
    if(isV(a) && isV(b)){ if(a.v.length !== b.v.length) err("dim"); return V(a.v.map((x, i) => sub ? x - b.v[i] : x + b.v[i])); }
    err("math");
  }
  function mul(a, b){
    if(isN(a) && isN(b)) return fin(a*b);
    if(isC(a) || isC(b)){ if(isM(a) || isM(b) || isV(a) || isV(b)) err("math"); const x = toC(a), y = toC(b); return tidyC(new Cx(x.re*y.re - x.im*y.im, x.re*y.im + x.im*y.re)); }
    if(isN(a) && isM(b)) return mapM(b, x => a*x);
    if(isM(a) && isN(b)) return mapM(a, x => x*b);
    if(isM(a) && isM(b)) return mmul(a, b);
    if(isN(a) && isV(b)) return V(b.v.map(x => a*x));
    if(isV(a) && isN(b)) return V(a.v.map(x => x*b));
    if(isV(a) && isV(b)) return vcross(a, b);
    if(isM(a) && isV(b)){ const r = mmul(a, M(b.v.map(x => [x]))); return V(r.m.map(x => x[0])); }
    err("math");
  }
  function div(a, b){
    if(isN(a) && isN(b)){ if(b === 0) err("math"); return fin(a/b); }
    if(isC(a) || isC(b)){ if(!(isN(a) || isC(a)) || !(isN(b) || isC(b))) err("math"); const x = toC(a), y = toC(b), d = y.re*y.re + y.im*y.im; if(d === 0) err("math"); return tidyC(new Cx((x.re*y.re + x.im*y.im)/d, (x.im*y.re - x.re*y.im)/d)); }
    if(isM(a) && isN(b)){ if(b === 0) err("math"); return mapM(a, x => x/b); }
    if(isV(a) && isN(b)){ if(b === 0) err("math"); return V(a.v.map(x => x/b)); }
    err("math");
  }
  function neg(a){ if(isN(a)) return -a; if(isC(a)) return tidyC(new Cx(-a.re, -a.im)); if(isM(a)) return mapM(a, x => -x); if(isV(a)) return V(a.v.map(x => -x)); err("math"); }
  function cpowInt(c, n){ let r = new Cx(1, 0), b = c, k = Math.abs(n); while(k){ if(k & 1) r = toC(mul(r, b)); b = toC(mul(b, b)); k >>= 1; } return n < 0 ? div(1, r) : tidyC(r); }
  function pow(a, b, S){
    if(isM(a)){ if(!isInt(b) || b < 1) err("math"); const [r,c] = dims(a); if(r !== c) err("dim"); let res = a; for(let i = 1; i < b; i++) res = mmul(res, a); return res; }
    if(isC(a) || isC(b)){ if(!isInt(b)) err("math"); if(Math.abs(b) > 99) err("math"); return cpowInt(toC(a), b); }
    if(!isN(a) || !isN(b)) err("math");
    if(a === 0){ if(b <= 0) err("math"); return 0; }
    if(a < 0 && !Number.isInteger(b)){
      const f = toFrac(b, 1000, 1e-12);                // (−8)^(1/3) = −2 khi mẫu số lẻ
      if(f && f.q % 2 === 1){ const r = Math.pow(-a, b); return fin(f.p % 2 ? -r : r); }
      if(S.mode === "cplx"){ const r = Math.pow(-a, b), t = Math.PI*b; return tidyC(new Cx(r*Math.cos(t), r*Math.sin(t))); }
      err("math");
    }
    return fin(Math.pow(a, b));
  }
  function root(n, x, S){
    if(!isN(n) || !isN(x)) err("math");
    if(n === 0) err("math");
    if(x < 0){ if(Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1/n); return pow(x, 1/n, S); }
    return fin(Math.pow(x, 1/n));
  }
  function csqrt(c){ const r = Math.hypot(c.re, c.im); const re = Math.sqrt((r + c.re)/2), im = Math.sign(c.im || 1)*Math.sqrt((r - c.re)/2); return tidyC(new Cx(re, im)); }
  function fact(n){ if(!isInt(n) || n < 0 || n > 69) err("math"); let r = 1; for(let i = 2; i <= n; i++) r *= i; return r; }
  function nPr(n, r){ if(!isInt(n) || !isInt(r) || r < 0 || n < r || n >= 1e10) err("math"); let v = 1; for(let i = 0; i < r; i++) v *= (n - i); return fin(v); }
  function nCr(n, r){ if(!isInt(n) || !isInt(r) || r < 0 || n < r || n >= 1e10) err("math"); r = Math.min(r, n - r); let v = 1; for(let i = 1; i <= r; i++) v = v*(n - r + i)/i; return fin(Math.round(v)); }
  const num = v => { if(isC(v)){ if(v.im !== 0) err("math"); return v.re; } if(!isN(v)) err("math"); return v; };
  const int = v => { const x = num(v); if(!Number.isInteger(x)) err("math"); return x; };
  function b32(x, S){ // giới hạn hệ cơ số N
    if(!Number.isInteger(x)) x = Math.trunc(x);
    if(x > 2147483647 || x < -2147483648) err("math");
    if(S.base === 2 && (x > 32767 || x < -32768)) err("math");
    return x;
  }

  /* ---------- tính giá trị ---------- */
  function cmp(op, a, b){
    if(isM(a) || isM(b) || isV(a) || isV(b)) err("math");
    if(isC(a) || isC(b)){ if(op !== "eq" && op !== "ne") err("math"); const x = toC(a), y = toC(b), eq = Math.abs(x.re - y.re) <= 1e-10*Math.max(1, Math.abs(x.re), Math.abs(y.re)) && Math.abs(x.im - y.im) <= 1e-10*Math.max(1, Math.abs(x.im), Math.abs(y.im)); return { bool: op === "eq" ? eq : !eq }; }
    const eq = Math.abs(a - b) <= 1e-10*Math.max(1, Math.abs(a), Math.abs(b));
    const r = { eq, ne:!eq, gt:!eq && a > b, lt:!eq && a < b, ge:eq || a > b, le:eq || a < b }[op];
    return { bool:r };
  }
  function ev(n, env){
    if(++env.steps > 2e6) err("time");
    const S = env.S;
    switch(n.n){
      case "num": return n.v;
      case "id": return idVal(n.v, env, n.i);
      case "cell": if(!env.cell) err("syntax"); return env.cell(n.v);
      case "neg": { const a = ev(n.a, env); return S.mode === "base" ? b32(-a, S) : neg(a); }
      case "post": return post(n.op, ev(n.a, env), env);
      case "call": return call(n.f, n.args, env);
      case "bin": {
        if(["eq","ne","gt","lt","ge","le"].includes(n.op)) return cmp(n.op, ev(n.a, env), ev(n.b, env));
        const a = ev(n.a, env), b = ev(n.b, env);
        if(S.mode === "base") return baseOp(n.op, a, b, S);
        switch(n.op){
          case "+": return add(a, b);
          case "−": return add(a, b, true);
          case "×": return mul(a, b);
          case "÷": return div(a, b);
          case "frac": return div(a, b);
          case "^": return pow(a, b, S);
          case "xrt": return root(num(a), num(b), S);
          case "npr": return nPr(num(a), num(b));
          case "ncr": return nCr(num(a), num(b));
          case "ang": { if(S.mode !== "cplx") err("syntax"); const r = num(a), t = toRad(num(b), S); return tidyC(new Cx(r*Math.cos(t), r*Math.sin(t))); }
          case "dot": if(!isV(a) || !isV(b)) err("math"); return vdot(a, b);
        }
        err("syntax");
      }
    }
    err("syntax");
  }
  function baseOp(op, a, b, S){
    a = int(a); b = int(b);
    const u = x => x >>> 0;
    switch(op){
      case "+": return b32(a + b, S); case "−": return b32(a - b, S); case "×": return b32(a*b, S);
      case "÷": if(b === 0) err("math"); return b32(Math.trunc(a/b), S);
      case "and": return b32(u(a) & u(b), S) | 0; case "or": return (u(a) | u(b)) | 0; case "xor": return (u(a) ^ u(b)) | 0; case "xnor": return ~(u(a) ^ u(b)) | 0;
    }
    err("syntax");
  }
  function idVal(v, env, i){
    const S = env.S, m = env.mem;
    if(v === "pi") return Math.PI;
    if(v === "e") return Math.E;
    if(v === "i"){ if(S.mode !== "cplx") err("syntax", i); return new Cx(0, 1); }
    if(v === "ran") return Math.floor(Math.random()*1000)/1000;
    if(v === "ans") return m.ans;
    if(v === "preans") return m.preans;
    if(v.startsWith("k:")) return CONSTV[v];
    if(v.startsWith("Mat")){ const x = m.mat[v.slice(3)]; if(!x) err("dim"); return x; }
    if(v.startsWith("Vct")){ const x = m.vct[v.slice(3)]; if(!x) err("dim"); return x; }
    if(v.startsWith("st:")){ if(!env.stat) err("syntax"); const r = env.stat(v.slice(3)); if(r == null) err("math"); return r; }
    const key = v === "E_" ? "E" : v;
    if(env.bind && key in env.bind) return env.bind[key];
    if(key in m.vars) return m.vars[key];
    err("syntax", i);
  }
  function post(op, a, env){
    const S = env.S;
    switch(op){
      case "sq": return S.mode === "base" ? b32(int(a)*int(a), S) : isM(a) ? pow(a, 2, S) : mul(a, a);
      case "cube": return isM(a) ? pow(a, 3, S) : mul(a, mul(a, a));
      case "inv": if(isM(a)) return minv(a); return div(1, a);
      case "fact": return fact(num(a));
      case "pct": return div(num(a), 100);
      case "dms": return num(a);
      case "udeg": return fromRad(num(a)*Math.PI/180, S);
      case "urad": return fromRad(num(a), S);
      case "ugra": return fromRad(num(a)*Math.PI/200, S);
      case "topol": case "torect": { const c = toC(a); return Object.assign(new Cx(c.re, c.im), { view: op === "topol" ? "polar" : "rect" }); }
      case "yhat": case "xhat": case "xhat1": case "xhat2": if(!env.est) err("syntax"); return env.est(op, num(a));
    }
    if(CONVF[op]) return fin(CONVF[op](num(a)));
    err("syntax");
  }
  function withX(env, x){ return { ...env, bind:{ ...(env.bind || {}), x } }; }
  function call(f, args, env){
    const S = env.S, A = i => { if(!args[i]) err("arg"); return ev(args[i], env); };
    const need = n => { if(args.length !== n) err("arg"); };
    switch(f){
      case "sqrt": { need(1); const a = A(0); if(isC(a)) return csqrt(a); if(num(a) < 0){ if(S.mode === "cplx") return new Cx(0, Math.sqrt(-a)); err("math"); } return Math.sqrt(a); }
      case "cbrt": need(1); return Math.cbrt(num(A(0)));
      case "log": { if(args.length === 2){ const b = num(A(0)), x = num(A(1)); if(b <= 0 || b === 1 || x <= 0) err("math"); return nearInt(Math.log(x)/Math.log(b)); } need(1); const x = num(A(0)); if(x <= 0) err("math"); return Math.log10(x); }
      case "ln": { need(1); const x = num(A(0)); if(x <= 0) err("math"); return Math.log(x); }
      case "pow10": need(1); return pow(10, num(A(0)), S);
      case "exp": need(1); return fin(Math.exp(num(A(0))));
      case "sin": case "cos": case "tan": need(1); return trig(f, num(A(0)), S);
      case "asin": case "acos": { need(1); const x = num(A(0)); if(x < -1 || x > 1) err("math"); const r = f === "asin" ? Math.asin(x) : Math.acos(x); return nearAngle(fromRad(r, S)); }
      case "atan": need(1); return nearAngle(fromRad(Math.atan(num(A(0))), S));
      case "sinh": need(1); return fin(Math.sinh(num(A(0))));
      case "cosh": need(1); return fin(Math.cosh(num(A(0))));
      case "tanh": need(1); return Math.tanh(num(A(0)));
      case "asinh": need(1); return Math.asinh(num(A(0)));
      case "acosh": { need(1); const x = num(A(0)); if(x < 1) err("math"); return Math.acosh(x); }
      case "atanh": { need(1); const x = num(A(0)); if(x <= -1 || x >= 1) err("math"); return Math.atanh(x); }
      case "abs": { need(1); const a = A(0); if(isC(a)) return Math.hypot(a.re, a.im); if(isV(a)) return vnorm(a); if(isM(a)) return mapM(a, Math.abs); return Math.abs(num(a)); }
      case "pol": { need(2); const x = num(A(0)), y = num(A(1)); if(x === 0 && y === 0) err("math"); const r = Math.hypot(x, y), t = nearAngle(fromRad(Math.atan2(y, x), S)); return { pair:[r, t], names:["r","θ"] }; }
      case "rec": { need(2); const r = num(A(0)), t = num(A(1)); const c = trig("cos", t, S), s = trig("sin", t, S); return { pair:[r*c, r*s], names:["x","y"] }; }
      case "int": need(1); return Math.trunc(num(A(0)));
      case "intg": need(1); return Math.floor(num(A(0)));
      case "rnd": need(1); return rndDisp(num(A(0)), S);
      case "gcd": { if(args.length < 2) err("arg"); return args.map((_, i) => int(A(i))).reduce((a, b) => gcd(a, b)); }
      case "lcm": { if(args.length < 2) err("arg"); return args.map((_, i) => int(A(i))).reduce((a, b) => { if(!a || !b) err("math"); return Math.abs(a*b)/gcd(a, b); }); }
      case "ranint": { need(2); const a = int(A(0)), b = int(A(1)); if(a > b) err("math"); return a + Math.floor(Math.random()*(b - a + 1)); }
      case "deriv": { if(args.length < 2) err("arg"); const a = num(A(1)); return nearTiny(deriv(x => num(ev(args[0], withX(env, x))), a)); }
      case "integ": { if(args.length < 3) err("arg"); const a = num(A(1)), b = num(A(2)); return nearTiny(integ(x => num(ev(args[0], withX(env, x))), a, b, env)); }
      case "sum": case "prod": { need(3); const a = int(A(1)), b = int(A(2)); if(a > b) err("math"); if(b - a > 1e5) err("time"); let s = f === "sum" ? 0 : 1; for(let k = a; k <= b; k++){ const v = ev(args[0], withX(env, k)); s = f === "sum" ? add(s, v) : mul(s, v); } return s; }
      case "arg": { need(1); const c = toC(A(0)); if(c.re === 0 && c.im === 0) err("math"); return nearAngle(fromRad(Math.atan2(c.im, c.re), S)); }
      case "conj": { need(1); const c = toC(A(0)); return tidyC(new Cx(c.re, -c.im)); }
      case "rep": need(1); return toC(A(0)).re;
      case "imp": need(1); return toC(A(0)).im;
      case "det": { need(1); const a = A(0); if(!isM(a)) err("math"); return mdet(a); }
      case "trn": { need(1); const a = A(0); if(!isM(a)) err("math"); return M(a.m[0].map((_, j) => a.m.map(r => r[j]))); }
      case "ident": { need(1); const n = int(A(0)); if(n < 1 || n > 4) err("arg"); return M(Array.from({length:n}, (_, i) => Array.from({length:n}, (_, j) => +(i === j)))); }
      case "ref": case "rref": { need(1); const a = A(0); if(!isM(a)) err("math"); return mref(a, f === "rref"); }
      case "angle": { need(2); const a = A(0), b = A(1); if(!isV(a) || !isV(b)) err("math"); const d = vnorm(a)*vnorm(b); if(!d) err("math"); return nearAngle(fromRad(Math.acos(Math.max(-1, Math.min(1, vdot(a, b)/d))), S)); }
      case "unitv": { need(1); const a = A(0); if(!isV(a)) err("math"); const n = vnorm(a); if(!n) err("math"); return V(a.v.map(x => x/n)); }
      case "not": need(1); return b32(~int(A(0)), S);
      case "negb": need(1); return b32(-int(A(0)), S);
      case "Sum": case "Mean": case "Min": case "Max": { if(!env.range) err("syntax"); const xs = env.range(args); if(!xs.length) err("math");
        if(f === "Sum") return xs.reduce((a, b) => a + b, 0); if(f === "Mean") return xs.reduce((a, b) => a + b, 0)/xs.length; return f === "Min" ? Math.min(...xs) : Math.max(...xs); }
    }
    err("syntax");
  }
  const nearAngle = x => { const r = Math.round(x*1e9)/1e9; return Math.abs(r - x) < 1e-11*Math.max(1, Math.abs(x)) ? r : x; };
  const nearTiny = x => Math.abs(x) < 1e-12 ? 0 : x;
  function rndDisp(x, S){ const f = S.fmt; if(f.t === "fix") return +x.toFixed(f.n); if(f.t === "sci") return +x.toPrecision(f.n || 10); return +x.toPrecision(10); }

  /* đạo hàm (Ridders) */
  function deriv(f, a){
    const NT = 10, CON = 1.4, CON2 = CON*CON; let h = 0.1*Math.max(1, Math.abs(a)), best = NaN, errt = Infinity;
    const T = [[ (f(a+h) - f(a-h))/(2*h) ]];
    for(let i = 1; i < NT; i++){
      h /= CON; T[i] = [(f(a+h) - f(a-h))/(2*h)]; let fac = CON2;
      for(let j = 1; j <= i; j++){ T[i][j] = (T[i][j-1]*fac - T[i-1][j-1])/(fac - 1); fac *= CON2;
        const e = Math.max(Math.abs(T[i][j] - T[i][j-1]), Math.abs(T[i][j] - T[i-1][j-1])); if(e <= errt){ errt = e; best = T[i][j]; } }
      if(Math.abs(T[i][i] - T[i-1][i-1]) >= 2*errt) break;
    }
    if(!isFinite(best)) err("math");
    return nearInt(Math.abs(best - Math.round(best*1e10)/1e10) < 1e-11 ? Math.round(best*1e10)/1e10 : best);
  }
  /* tích phân: Gauss–Kronrod 7-15 thích nghi */
  const GK = { x:[0.991455371120813,0.949107912342759,0.864864423359769,0.741531185599394,0.586087235467691,0.405845151377397,0.207784955007898,0],
    wk:[0.022935322010529,0.063092092629979,0.104790010322250,0.140653259715525,0.169004726639267,0.190350578064785,0.204432940075298,0.209482141084728],
    wg:[0.129484966168870,0.279705391489277,0.381830050505119,0.417959183673469] };
  function gk(f, a, b){ const c = (a+b)/2, h = (b-a)/2; let k = GK.wk[7]*f(c), g = GK.wg[3]*f(c);
    for(let i = 0; i < 7; i++){ const dx = h*GK.x[i], s = f(c-dx) + f(c+dx); k += GK.wk[i]*s; if(i % 2 === 1) g += GK.wg[(i-1)/2]*s; }
    return [k*h, Math.abs((k - g)*h)]; }
  function integ(f, a, b, env){
    if(a === b) return 0;
    const t0 = Date.now(); let tot = 0, n = 0;
    const stack = [[a, b, 0]];
    while(stack.length){
      const [x, y, d] = stack.pop(); const [v, e] = gk(f, x, y);
      if(e <= 1e-11*Math.max(1, Math.abs(v)) || d > 40){ tot += v; continue; }
      if(++n > 5000 || Date.now() - t0 > 3000) err("time");
      const m = (x + y)/2; stack.push([x, m, d+1], [m, y, d+1]);
    }
    const r = Math.round(tot*1e10)/1e10;
    return Math.abs(r - tot) < 1e-10*Math.max(1, Math.abs(tot)) ? nearInt(r) : tot;
  }

  /* ---------- giải phương trình một ẩn (SOLVE) ---------- */
  function solve1(f, x0){
    const F = x => { try{ const v = f(x); return isFinite(v) ? v : NaN; }catch(e){ return NaN; } };
    let x = x0, fx = F(x);
    if(fx === 0) return x;
    // Newton – Secant
    for(let it = 0; it < 150 && isFinite(fx); it++){
      const h = 1e-6*Math.max(1, Math.abs(x)), d = (F(x+h) - F(x-h))/(2*h);
      if(!isFinite(d) || d === 0) break;
      let nx = x - fx/d, nf = F(nx), k = 0;
      while((!isFinite(nf) || Math.abs(nf) > Math.abs(fx)) && k < 30){ nx = x - (fx/d)/Math.pow(2, ++k); nf = F(nx); }
      if(!isFinite(nf)) break;
      if(Math.abs(nx - x) < 1e-14*Math.max(1, Math.abs(x)) || nf === 0){ x = nx; fx = nf; break; }
      x = nx; fx = nf;
    }
    if(isFinite(fx) && Math.abs(fx) < 1e-9*Math.max(1, Math.abs(f(x0 + 1) - f(x0)))) return polish(F, x);
    // quét tìm đổi dấu quanh x0 rồi chia đôi
    for(let R = 1; R <= 1e6; R *= 4){
      const N = 200; let pa = x0 - R, fa = F(pa);
      for(let k = 1; k <= N; k++){ const pb = x0 - R + 2*R*k/N, fb = F(pb);
        if(isFinite(fa) && isFinite(fb) && fa*fb <= 0) return polish(F, bisect(F, pa, pb, fa));
        pa = pb; fa = fb; }
    }
    err("cant");
  }
  function bisect(F, a, b, fa){ for(let i = 0; i < 200; i++){ const m = (a+b)/2, fm = F(m); if(fm === 0) return m; if(fa*fm < 0) b = m; else { a = m; fa = fm; } } return (a+b)/2; }
  const polish = (F, x) => { const r = Math.round(x*1e10)/1e10; return Math.abs(F(r)) <= Math.abs(F(x)) ? nearInt(r) : x; };

  /* ---------- nghiệm đa thức (Durand–Kerner + Newton) ---------- */
  function polyRoots(co){ // co: [a, b, c, …] bậc cao trước
    const n = co.length - 1, a0 = co[0]; if(a0 === 0) err("math");
    const c = co.map(x => x/a0);
    const f = t => c.reduce((s, k) => s*t + k, 0), d = t => c.slice(0, -1).reduce((s, k, i) => s*t + k*(n - i), 0);
    if(n === 1) return [nearInt(-c[1])];
    if(n === 2){ // công thức nghiệm, xử lý nghiệm kép chính xác
      const B = c[1], C = c[2], D = B*B - 4*C;
      if(Math.abs(D) <= 1e-13*Math.max(1, B*B, Math.abs(C))) return [nearInt(-B/2), nearInt(-B/2)];
      if(D > 0){ const q = -(B + Math.sign(B || 1)*Math.sqrt(D))/2; const r1 = q, r2 = q !== 0 ? C/q : 0; return [polishR(f, d, r1), polishR(f, d, r2)]; }
      return [new Cx(-B/2, Math.sqrt(-D)/2), new Cx(-B/2, -Math.sqrt(-D)/2)];
    }
    // nghiệm thực (kể cả nghiệm bội) qua các điểm tới hạn của đạo hàm
    const real = realRoots(c);
    let rest = c.slice();
    real.forEach(r => { const q = [rest[0]]; for(let i = 1; i < rest.length - 1; i++) q.push(rest[i] + q[i-1]*r); rest = q; });
    const out = real.map(r => polishR(f, d, r));
    if(rest.length === 3){ const B = rest[1]/rest[0], C = rest[2]/rest[0], D = B*B - 4*C;
      if(D < 0) out.push(new Cx(-B/2, Math.sqrt(-D)/2), new Cx(-B/2, -Math.sqrt(-D)/2)); }
    else if(rest.length === 5) out.push(...dk(rest));
    const Pz = z => { let r = new Cx(0, 0); c.forEach(k => { r = toC(add(mul(r, z), k)); }); return Math.hypot(r.re, r.im); };
    const snap = x => { const f1 = toFrac(x, 1000, 1e-8); if(f1) return f1.p/f1.q; const f2 = toFrac(x*x, 1000, 1e-8); if(f2) return Math.sign(x)*Math.sqrt(f2.p/f2.q); return x; };
    return out.map(z => { if(!isC(z)) return z; const w = new Cx(snap(z.re), snap(z.im)); return Pz(w) <= Math.max(Pz(z)*100, 1e-12) ? w : z; });
  }
  function realRoots(c){ // c chuẩn hóa hệ số đầu = 1; trả về các nghiệm thực có lặp theo bội
    const n = c.length - 1;
    if(n === 1) return [-c[1]/c[0]];
    if(n === 2){ const B = c[1]/c[0], C = c[2]/c[0], D = B*B - 4*C;
      if(Math.abs(D) <= 1e-12*Math.max(1, B*B, Math.abs(C))) return [-B/2, -B/2];
      if(D < 0) return []; const q = -(B + Math.sign(B || 1)*Math.sqrt(D))/2; return [q, q !== 0 ? C/q : 0].sort((x, y) => x - y); }
    const f = t => c.reduce((s, k) => s*t + k, 0), mag = t => c.reduce((s, k) => s*Math.abs(t) + Math.abs(k), 0);
    const crit = realRoots(c.slice(0, -1).map((k, i) => k*(n - i)));
    const bound = 1 + Math.max(...c.slice(1).map(k => Math.abs(k/c[0])));
    const roots = [], uniq = [];
    crit.forEach(x => { if(!uniq.length || Math.abs(x - uniq[uniq.length-1].x) > 1e-7*Math.max(1, Math.abs(x))) uniq.push({ x, m:1 }); else uniq[uniq.length-1].m++; });
    const isZero = x => Math.abs(f(x)) <= 1e-9*mag(x);
    uniq.forEach(u => { u.root = isZero(u.x); });
    const pts = [-bound, ...uniq.map(u => u.x), bound];
    for(let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1], ua = uniq[i-1], ub = uniq[i];
      if(ua && ua.root) {} // nghiệm bội đã tính ở điểm tới hạn
      const fa = f(a), fb = f(b);
      if(!(ua && ua.root) && !(ub && ub.root) && fa*fb < 0){ let lo = a, hi = b, flo = fa; for(let k = 0; k < 200; k++){ const m = (lo + hi)/2, fm = f(m); if(fm === 0){ lo = hi = m; break; } if(flo*fm < 0) hi = m; else { lo = m; flo = fm; } } roots.push((lo + hi)/2); }
      else if((ua && ua.root) !== (ub && ub.root)){ // một đầu là nghiệm bội: tìm nghiệm đơn còn lại trong khoảng (nếu có)
        const x0 = ua && ua.root ? a : b, other = ua && ua.root ? b : a, fo = f(other);
        const step = (other - x0)*1e-4, near = x0 + step, fn = f(near);
        if(isFinite(fo) && Math.abs(fn) > 1e-9*mag(near) && fn*fo < 0){ let lo = near, hi = other, flo = fn; if(lo > hi){ [lo, hi] = [hi, lo]; flo = f(lo); } for(let k = 0; k < 200; k++){ const m = (lo + hi)/2, fm = f(m); if(flo*fm < 0) hi = m; else { lo = m; flo = fm; } } roots.push((lo + hi)/2); }
      }
    }
    uniq.forEach(u => { if(u.root) for(let k = 0; k <= u.m; k++) roots.push(u.x); });
    return roots.sort((x, y) => x - y);
  }
  function dk(co){
    const n = co.length - 1, c = co.map(x => x/co[0]);
    const P = z => c.reduce((s, k) => toC(add(mul(s, z), k)), new Cx(0, 0));
    let R = Array.from({length:n}, (_, k) => toC(pow(new Cx(0.4, 0.9), k, { mode:"cplx" })));
    for(let it = 0; it < 800; it++){
      let mx = 0;
      R = R.map((z, i) => { let dd = new Cx(1, 0); R.forEach((w, j) => { if(j !== i){ let diff = toC(add(z, w, true)); if(diff.re === 0 && diff.im === 0) diff = new Cx(1e-12, 1e-12); dd = toC(mul(dd, diff)); } });
        const dz = toC(div(P(z), dd)); mx = Math.max(mx, Math.hypot(dz.re, dz.im)); return toC(add(z, dz, true)); });
      if(mx < 1e-15) break;
    }
    // nghiệm phức bội: thay cụm nghiệm gần nhau bằng trung bình của cụm
    const used = new Set(), out = [];
    R.forEach((z, i) => { if(used.has(i)) return; const grp = [i];
      R.forEach((w, j) => { if(j > i && !used.has(j) && Math.hypot(z.re - w.re, z.im - w.im) < 1e-4*Math.max(1, Math.hypot(z.re, z.im))) grp.push(j); });
      grp.forEach(j => used.add(j)); const m = new Cx(grp.reduce((s, j) => s + R[j].re, 0)/grp.length, grp.reduce((s, j) => s + R[j].im, 0)/grp.length);
      grp.forEach(() => out.push(new Cx(m.re, m.im))); });
    return out.map(z => new Cx(Math.abs(z.re) < 1e-12*Math.max(1, Math.abs(z.im)) ? 0 : z.re, z.im));
  }
  function polishR(f, d, x){
    for(let i = 0; i < 60; i++){ const dd = d(x); if(!dd) break; const nx = x - f(x)/dd; if(!isFinite(nx)) break; if(Math.abs(nx - x) < 1e-16*Math.max(1, Math.abs(x))){ x = nx; break; } x = nx; }
    for(const p of [12, 10, 8, 7]){ const r = +x.toPrecision(p); if(Math.abs(f(r)) <= Math.max(Math.abs(f(x))*10, 1e-13)) return nearInt(r); }
    return nearInt(x);
  }

  /* ---------- định dạng số ---------- */
  function fmtDec(x, S, engShift){
    if(x === 0) return { m:"0" };
    const ax = Math.abs(x), f = S.fmt || { t:"norm", n:1 };
    let m, e = null;
    if(engShift != null){
      let ex = Math.floor(Math.log10(ax)/3)*3 + engShift;
      const mm = x/Math.pow(10, ex); m = trim((+mm.toPrecision(10)).toString().includes("e") ? mm.toFixed(9) : (+mm.toPrecision(10)).toString()); e = ex;
      return sep({ m, e }, S);
    }
    if(f.t === "fix"){
      if(ax >= 1e10) { const [mm, ee] = x.toExponential(9).split("e"); return sep({ m:trim(mm), e:+ee }, S); }
      return sep({ m:x.toFixed(f.n) }, S);
    }
    if(f.t === "sci"){ const [mm, ee] = x.toExponential((f.n || 10) - 1).split("e"); return sep({ m:mm, e:+ee }, S); }
    const lo = f.n === 2 ? 1e-9 : 1e-2;
    if(ax >= 1e10 || ax < lo){ let [mm, ee] = x.toExponential(9).split("e"); mm = trim(mm); if(mm === "10"){ mm = "1"; ee = +ee + 1; } return sep({ m:mm, e:+ee }, S); }
    let s = x.toPrecision(10);
    if(s.includes("e")){ const [mm, ee] = s.split("e"); return sep({ m:trim(mm), e:+ee }, S); }
    return sep({ m:trim(s) }, S);
  }
  const trim = s => s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  function sep(o, S){
    let [ip, dp] = o.m.split(".");
    if(S.sep){ const sgn = ip.startsWith("-") ? "-" : ""; ip = sgn + ip.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, S.dec === "," ? "." : ","); }
    o.m = (dp != null ? ip + (S.dec === "," ? "," : ".") + dp : ip).replace("-", "−");
    return o;
  }

  /* ---------- tính từ chuỗi token ---------- */
  function evaluate(toks, env){
    env.steps = 0;
    const lx = lex(toks, { mode:env.S.mode, base:env.S.base, cells:!!env.cell });
    const ast = parse(lx);
    return ev(ast, env);
  }
  /* dùng cho các ô nhập số (Phân phối, Phương trình…) */
  const evalNum = (toks, env) => num(evaluate(toks, env));
  function freeVars(toks){ const s = new Set(); toks.forEach(t => { if(["A","B","C","D","E_","F","x","y","z","M"].includes(t)) s.add(t); }); return [...s]; }

  return { ERR, err, TK, disp, CONST, CONV, STV, Cx, isC, isM, isV, isN, toC, lex, parse, ev, evaluate, evalNum, exactOf, toFrac, fmtDec, gcd, factorSquare, polyRoots, solve1, deriv, integ, mdet, minv, nearInt, freeVars, fin, num, trig };
})();


/* ================= Máy tính cầm tay – giao diện và các chế độ =================
   Hai máy dùng chung lõi CALC_CORE:
   - "580": kiểu fx-580VN X (SHIFT, ALPHA, MENU, OPTN, CALC/SOLVE, STO/RCL, ENG, S⇔D, M+)
   - "880": kiểu fx-880BTG (HOME, SETTINGS, TOOLS, CATALOG, FORMAT, VARIABLE, FUNCTION, BACK, OK, EXE)
   Đây là bản mô phỏng chức năng do học sinh làm để học tập, không phải sản phẩm của hãng. */
const CALC = (() => {
  const K = CALC_CORE;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);

  /* ---------- chế độ / ứng dụng ---------- */
  const MODES = {
    calc: { ten:"Tính toán",        st:"",       ic:"1+2" },
    cplx: { ten:"Số phức",          st:"CMPLX",  ic:"a+b𝑖" },
    base: { ten:"Cơ số N",          st:"BASE",   ic:"0b1" },
    mat:  { ten:"Ma trận",          st:"MAT",    ic:"[A]" },
    vct:  { ten:"Vectơ",            st:"VCT",    ic:"v⃗" },
    stat: { ten:"Thống kê",         st:"STAT",   ic:"x̄ σ" },
    dist: { ten:"Phân phối",        st:"DIST",   ic:"N(μ)" },
    sprd: { ten:"Bảng tính",        st:"SHEET",  ic:"A1" },
    table:{ ten:"Bảng giá trị",     st:"TABLE",  ic:"f(x)" },
    eqn:  { ten:"Phương trình",     st:"EQN",    ic:"x=?" },
    ineq: { ten:"Bất phương trình", st:"INEQ",   ic:"x>?" },
    verif:{ ten:"Kiểm tra",         st:"VERIF",  ic:"✓?" },
    ratio:{ ten:"Tỉ lệ",            st:"RATIO",  ic:"a:b" },
    box:  { ten:"Math Box",         st:"BOX",    ic:"⚄" }
  };

  /* ---------- bàn phím ----------
     k(id, nhãn chính, lệnh chính, nhãn SHIFT, lệnh SHIFT, nhãn ALPHA, lệnh ALPHA, nhãn Cơ số N) */
  const k = (id, l, a, sl, sa, al, aa, bn) => ({ id, l, a, sl, sa, al, aa, bn });
  const BIG = (exe, m880) => [
    [k("7","7","ins:7","CONST","cmd:const"), k("8","8","ins:8","CONV","cmd:conv"), k("9","9","ins:9","RESET","cmd:reset"), k("del","DEL","cmd:del","INS","cmd:ins"), k("ac","AC","cmd:ac","OFF","cmd:off")],
    [k("4","4","ins:4"), k("5","5","ins:5"), k("6","6","ins:6"), k("mul","×","ins:×","nPr","ins:npr"), k("div","÷","ins:÷","nCr","ins:ncr")],
    [k("1","1","ins:1"), k("2","2","ins:2"), k("3","3","ins:3"), k("plus","+","ins:+","Pol","ins:pol("), k("minus","−","ins:−","Rec","ins:rec(")],
    [k("0","0","ins:0","Rnd","ins:rnd("), m880 ? k("dot",".","ins:.","Ran#","ins:ran") : k("dot",".","ins:.","Ran#","ins:ran","RanInt","ins:ranint("), m880 ? k("exp","×10ˣ","ins:E","RanInt","ins:ranint(") : k("exp","×10ˣ","ins:E","π","ins:pi","e","ins:e"), k("ans","Ans","ins:ans","PreAns","ins:preans"), exe]
  ];
  const KEYS = {
    "580": {
      top:[k("shift","SHIFT","mod:shift"), k("alpha","ALPHA","mod:alpha"), "pad", k("menu","MENU","cmd:menu","SETUP","cmd:setup"), k("on","ON","cmd:on")],
      fn:[
        [k("optn","OPTN","cmd:optn"), k("calc","CALC","cmd:calc","SOLVE","cmd:solve","=","ins:eq"), k("integ","∫","ins:integ(","d/dx","ins:deriv(",":","ins:colon"), k("xv","x","ins:x","Σ","ins:sum("), k("inv","x⁻¹","ins:inv","x!","ins:fact"), k("loga","logₐb","ins:log(","Π","ins:prod(")],
        [k("frac","a/b","ins:frac"), k("sqrt","√","ins:sqrt(","∛","ins:cbrt("), k("sq","x²","ins:sq","x³","ins:cube",null,null,"DEC"), k("pow","xⁿ","ins:^(","ⁿ√","ins:xrt(",null,null,"HEX"), k("log","log","ins:log(","10ˣ","ins:pow10(",null,null,"BIN"), k("ln","ln","ins:ln(","eˣ","ins:exp(",null,null,"OCT")],
        [k("neg","(−)","ins:neg","∠","ins:ang","A","ins:A","A"), k("dms","°′″","ins:dms","FACT","cmd:pfact","B","ins:B","B"), k("abs","Abs","ins:abs(","GCD","ins:gcd(","C","ins:C","C"), k("sin","sin","ins:sin(","sin⁻¹","ins:asin(","D","ins:D","D"), k("cos","cos","ins:cos(","cos⁻¹","ins:acos(","E","ins:E_","E"), k("tan","tan","ins:tan(","tan⁻¹","ins:atan(","F","ins:F","F")],
        [k("sto","RCL","cmd:rcl","STO","cmd:sto"), k("eng","ENG","cmd:eng","←ENG","cmd:engl","𝑖","ins:i","𝑖"), k("lp","(","ins:(","%","ins:pct","z","ins:z"), k("rp",")","ins:)",",","ins:,","y","ins:y"), k("sd","S⇔D","cmd:sd","a⌟b⇔d/c","cmd:mixed"), k("mplus","M+","cmd:mplus","M−","cmd:mminus","M","ins:M")]
      ],
      big:BIG(k("exe","=","cmd:exe","≈","cmd:approx"))
    },
    /* Bố cục phím theo máy thật dòng ClassWiz CW (fx-880BTG): phím tròn, chữ vàng là chức năng SHIFT,
       chữ trắng phía trên là tên phím. Không có ALPHA: biến A–F là SHIFT + 4,5,6,1,2,3; x, y, z là SHIFT + 0 . ×10ⁿ. */
    "880": {
      top:[
        { ...k("on","ON","cmd:on"), cap:"ON", face:"", c:1, r:1, cls:"pw" },
        { ...k("home","HOME","cmd:menu"), cap:"HOME", icon:"home", c:2, r:1 },
        { ...k("set","SETTINGS","cmd:setup"), cap:"SETTINGS", icon:"set", c:1, r:2 },
        { ...k("back","BACK","cmd:back"), icon:"back", c:2, r:2 },
        { ...k("shift","SHIFT","mod:shift"), cap:"SHIFT", icon:"shift", c:1, r:3 },
        { ...k("var","VARIABLE","cmd:variable"), cap:"VARIABLE", icon:"var", c:2, r:3 },
        { ...k("func","FUNCTION","cmd:function"), cap:"FUNCTION", face:"f(𝑥)", c:3, r:3 },
        { ...k("catalog","CATALOG","cmd:catalog"), cap:"CATALOG", icon:"book", c:5, r:3 },
        { ...k("tools","TOOLS","cmd:optn"), cap:"TOOLS", icon:"dots", c:6, r:3 },
        { id:"up", a:"cmd:up", l:"Lên", icon:"up", c:4, r:1, cls:"pd" }, { id:"left", a:"cmd:left", l:"Trái", icon:"left", c:3, r:2, cls:"pd" },
        { id:"ok", a:"cmd:ok", l:"OK", face:"OK", c:4, r:2, cls:"pd okk" }, { id:"right", a:"cmd:right", l:"Phải", icon:"right", c:5, r:2, cls:"pd" },
        { id:"down", a:"cmd:down", l:"Xuống", icon:"down", c:4, r:3, cls:"pd" },
        { id:"pgup", a:"cmd:pgup", l:"Lên một trang", icon:"pgup", c:6, r:1, cls:"rk rk1" }, { id:"pgdn", a:"cmd:pgdn", l:"Xuống một trang", icon:"pgdn", c:6, r:2, cls:"rk rk2" }
      ],
      fn:[
        [k("xv","𝑥","ins:x","QR","cmd:qr"), k("frac","▭⁄▭","ins:frac","a b/c","cmd:mixed"), k("sqrt","√▭","ins:sqrt(","ⁿ√","ins:xrt("), k("pow","▭ⁿ","ins:^(","x⁻¹","ins:inv"), k("sq","▭²","ins:sq","log","ins:log("), k("loga","logₐb","ins:log(","ln","ins:ln(")],
        [k("ans","Ans","ins:ans"), k("sin","sin","ins:sin(","sin⁻¹","ins:asin("), k("cos","cos","ins:cos(","cos⁻¹","ins:acos("), k("tan","tan","ins:tan(","tan⁻¹","ins:atan("), k("lp","(","ins:(","=","ins:eq"), k("rp",")","ins:)",",","ins:,")]
      ],
      big:[
        [k("7","7","ins:7","π","ins:pi"), k("8","8","ins:8","e","ins:e"), k("9","9","ins:9","𝑖","ins:i"), { ...k("del","DEL","cmd:del","INS","cmd:ins"), icon:"del" }, k("ac","AC","cmd:ac","OFF","cmd:off")],
        [k("4","4","ins:4","A","ins:A"), k("5","5","ins:5","B","ins:B"), k("6","6","ins:6","C","ins:C"), k("mul","×","ins:×"), k("div","÷","ins:÷")],
        [k("1","1","ins:1","D","ins:D"), k("2","2","ins:2","E","ins:E_"), k("3","3","ins:3","F","ins:F"), k("plus","+","ins:+","°′″","ins:dms"), k("minus","−","ins:−","(−)","ins:neg")],
        [k("0","0","ins:0","𝑥","ins:x"), k("dot",".","ins:.","𝑦","ins:y"), k("exp","×10ⁿ","ins:E","𝑧","ins:z"), { ...k("format","FORMAT","cmd:format"), face:"FORMAT", cls:"fmt" }, k("exe","EXE","cmd:exe","≈","cmd:approx")]
      ]
    }
  };
  /* biểu tượng trên mặt phím (vẽ đơn giản) */
  const KICON = {
    home:'<svg viewBox="0 0 24 24"><path d="M4 11.5L12 5l8 6.5M6.5 10v8.5h11V10"/></svg>',
    set:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="8" cy="17" r="1.8"/></svg>',
    back:'<svg viewBox="0 0 24 24"><path d="M9 7L5 11l4 4"/><path d="M5 11h9a4 4 0 0 1 0 8h-3"/></svg>',
    shift:'<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v7H9v-7H5z"/></svg>',
    var:'<svg viewBox="0 0 24 24"><path d="M3 8h8M8 5l3 3-3 3M11 16H3M6 13l-3 3 3 3"/><text x="14" y="17" font-size="10" font-style="italic" stroke="none" fill="currentColor">x</text></svg>',
    book:'<svg viewBox="0 0 24 24"><path d="M12 7c-2-1.5-5-2-8-1.5v12c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-12c-3-.5-6 0-8 1.5zM12 7v12"/></svg>',
    dots:'<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>',
    up:'<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5"/></svg>', down:'<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
    left:'<svg viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5"/></svg>', right:'<svg viewBox="0 0 24 24"><path d="M10 7l5 5-5 5"/></svg>',
    pgup:'<svg viewBox="0 0 24 24"><path d="M7 12l5-5 5 5M7 17l5-5 5 5"/></svg>', pgdn:'<svg viewBox="0 0 24 24"><path d="M7 7l5 5 5-5M7 12l5 5 5-5"/></svg>',
    del:'<svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-5-6z" fill="currentColor" stroke="none"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="#2b2f36" stroke-width="2"/></svg>'
  };
  const BASE_LETTER = { "580":{ neg:"hA", dms:"hB", abs:"hC", sin:"hD", cos:"hE", tan:"hF" }, "880":{ "4":"hA", "5":"hB", "6":"hC", "1":"hD", "2":"hE", "3":"hF" } };
  const BASE_SET = { sq:10, pow:16, log:2, ln:8 };
  const BASE_NAME = { 10:"Dec", 16:"Hex", 2:"Bin", 8:"Oct" };

  /* ---------- trình soạn biểu thức ---------- */
  class Ed {
    constructor(t){ this.t = (t || []).slice(); this.c = this.t.length; }
    ins(x){ this.t.splice(this.c, 0, x); this.c++; }
    del(){ if(this.c > 0){ this.t.splice(this.c - 1, 1); this.c--; } else if(this.t.length) this.t.splice(0, 1); }
    left(){ this.c = this.c > 0 ? this.c - 1 : this.t.length; }
    right(){ this.c = this.c < this.t.length ? this.c + 1 : 0; }
    html(caret, errPos){
      const parts = this.t.map((x, i) => `<span class="${i === errPos ? "er" : ""}">${esc(K.disp(x))}</span>`);
      if(caret) parts.splice(this.c, 0, `<span class="car"></span>`);
      return parts.join("") || (caret ? "" : "&nbsp;");
    }
  }
  const tokStr = t => t.map(K.disp).join("");

  /* ---------- hiển thị số ---------- */
  const fr = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
  const neg = s => s.replace(/^-/, "−");
  function exactHTML(e, S){
    if(e.t === "int") return neg(String(e.v));
    if(e.t === "frac"){
      const s = e.p < 0 ? "−" : "", p = Math.abs(e.p);
      if(S.frac === "abc" && p > e.q) return `${s}${Math.floor(p/e.q)}${fr(p % e.q, e.q)}`;
      return s + fr(p, e.q);
    }
    if(e.t === "surd"){
      const s = e.sg < 0 ? "−" : "", top = `${e.a !== 1 ? e.a : ""}<span class="rt">√<span>${e.b}</span></span>`;
      return s + (e.q !== 1 ? fr(top, e.q) : top);
    }
    if(e.t === "pi"){
      const s = e.p < 0 ? "−" : "", p = Math.abs(e.p), top = `${p !== 1 ? p : ""}π`;
      return s + (e.q !== 1 ? fr(top, e.q) : top);
    }
    return "";
  }
  function decHTML(x, S, eng){
    const o = K.fmtDec(x, S, eng);
    return o.e != null ? `${o.m}<span class="x10">×10<sup>${neg(String(o.e))}</sup></span>` : o.m;
  }
  function dmsHTML(x){
    const s = x < 0 ? "−" : ""; let a = Math.abs(x), d = Math.floor(a), m = Math.floor((a - d)*60), sec = ((a - d)*60 - m)*60;
    sec = Math.round(sec*100)/100; if(sec >= 60){ sec -= 60; m++; } if(m >= 60){ m -= 60; d++; }
    return `${s}${d}°${m}°${Number.isInteger(sec) ? sec : String(sec)}°`;
  }
  function pfactHTML(x){
    if(!Number.isInteger(x) || x < 2 || x >= 1e10) return null;
    let n = x, out = [];
    for(let p = 2; p <= 1000 && p*p <= n; p++){ let c = 0; while(n % p === 0){ n /= p; c++; } if(c) out.push(c > 1 ? `${p}<sup>${c}</sup>` : `${p}`); }
    if(n > 1) out.push(n > 1000*1000 ? `(${n})` : `${n}`);
    return out.join("×");
  }
  function baseStr(x, b){
    if(b === 10) return String(x);
    const bits = b === 2 ? 16 : 32, u = x < 0 ? (b === 2 ? x + 65536 : x + 4294967296) : x;
    const len = b === 2 ? 16 : b === 16 ? 8 : 11;
    return u.toString(b).toUpperCase().padStart(len, "0").slice(-len) + (bits ? "" : "");
  }
  /* một số thực theo cách xem: exact | dec | eng | dms | pfact | base */
  function numHTML(x, S, view, eng){
    if(S.mode === "base") return baseStr(x, S.base);
    if(view === "dms") return dmsHTML(x);
    if(view === "pfact") return pfactHTML(x) || decHTML(x, S);
    if(view === "eng") return decHTML(x, S, eng || 0);
    if(view === "exact" || (view == null && S.io === "math")){ const e = K.exactOf(x); if(e) return exactHTML(e, S); }
    return decHTML(x, S);
  }
  function cxHTML(c, S, view){
    c = Object.assign(new K.Cx(K.nearInt(c.re), K.nearInt(c.im)), { view:c.view });
    const polar = c.view === "polar" || (c.view !== "rect" && S.cplx === "polar");
    if(polar){
      const r = Math.hypot(c.re, c.im), t = K.nearInt(Math.atan2(c.im, c.re)*(S.ang === "D" ? 180/Math.PI : S.ang === "G" ? 200/Math.PI : 1));
      return `${numHTML(r, S, view)}∠${numHTML(t, S, view)}`;
    }
    if(c.im === 0) return numHTML(c.re, S, view);
    const im = Math.abs(c.im), imS = im === 1 ? "" : numHTML(im, S, view);
    const sg = c.im < 0 ? "−" : (c.re !== 0 ? "+" : "");
    return `${c.re !== 0 ? numHTML(c.re, S, view) : ""}${sg}${imS}𝑖`;
  }
  function matHTML(m, S, view){
    const cell = x => `<td>${numHTML(x, S, view)}</td>`;
    return `<table class="lmat">${m.map(r => `<tr>${r.map(cell).join("")}</tr>`).join("")}</table>`;
  }
  function valHTML(v, S, view, eng){
    if(v == null) return "";
    if(v.bool != null) return v.bool ? "ĐÚNG <small>(TRUE)</small>" : "SAI <small>(FALSE)</small>";
    if(v.pair) return v.names.map((n, i) => `<div>${n}=${numHTML(v.pair[i], S, view, eng)}</div>`).join("");
    if(K.isM(v)) return matHTML(v.m, S, view);
    if(K.isV(v)) return `<span class="lvec">[${v.v.map(x => numHTML(x, S, view)).join("&nbsp;&nbsp;")}]</span>`;
    if(K.isC(v)) return cxHTML(v, S, view);
    return numHTML(v, S, view, eng);
  }
  const shortNum = (x, S) => { if(x == null || x === "") return ""; if(typeof x !== "number") return "?"; const o = K.fmtDec(x, { ...S, fmt:{ t:"norm", n:1 }, sep:false }); let s = o.e != null ? `${o.m}ᴇ${o.e}` : o.m; if(s.length > 8){ const p = x.toPrecision(4); s = p.includes("e") ? p.replace(/e\+?/, "ᴇ").replace("-", "−") : p; } return s; };

  /* ---------- thống kê ---------- */
  const REGS = {
    "1v":  { ten:"1-Biến",           f:null },
    lin:   { ten:"y=a+bx",            X:x => x, Y:y => y, back:(A, B) => [A, B], yh:(c, x) => c.a + c.b*x, xh:(c, y) => (y - c.a)/c.b },
    quad:  { ten:"y=a+bx+cx²",        quad:true, yh:(c, x) => c.a + c.b*x + c.c*x*x },
    ln:    { ten:"y=a+b·ln(x)",       X:x => Math.log(x), Y:y => y, back:(A, B) => [A, B], yh:(c, x) => c.a + c.b*Math.log(x), xh:(c, y) => Math.exp((y - c.a)/c.b) },
    exp:   { ten:"y=a·e^(bx)",        X:x => x, Y:y => Math.log(y), back:(A, B) => [Math.exp(A), B], yh:(c, x) => c.a*Math.exp(c.b*x), xh:(c, y) => Math.log(y/c.a)/c.b },
    abx:   { ten:"y=a·b^x",           X:x => x, Y:y => Math.log(y), back:(A, B) => [Math.exp(A), Math.exp(B)], yh:(c, x) => c.a*Math.pow(c.b, x), xh:(c, y) => Math.log(y/c.a)/Math.log(c.b) },
    axb:   { ten:"y=a·x^b",           X:x => Math.log(x), Y:y => Math.log(y), back:(A, B) => [Math.exp(A), B], yh:(c, x) => c.a*Math.pow(x, c.b), xh:(c, y) => Math.pow(y/c.a, 1/c.b) },
    inv:   { ten:"y=a+b/x",           X:x => 1/x, Y:y => y, back:(A, B) => [A, B], yh:(c, x) => c.a + c.b/x, xh:(c, y) => c.b/(y - c.a) }
  };
  function statCalc(st, S){
    const rows = st.data.filter(r => r.x != null && (st.type === "1v" || r.y != null));
    const fq = r => S.freq ? (r.f == null ? 1 : r.f) : 1;
    if(!rows.length) return null;
    let n = 0, Sx = 0, Sx2 = 0, Sy = 0, Sy2 = 0, Sxy = 0;
    rows.forEach(r => { const f = fq(r); if(f < 0) K.err("math"); n += f; Sx += f*r.x; Sx2 += f*r.x*r.x; if(r.y != null){ Sy += f*r.y; Sy2 += f*r.y*r.y; Sxy += f*r.x*r.y; } });
    if(!n) return null;
    const mx = Sx/n, my = Sy/n, ox = Math.sqrt(Math.max(0, Sx2/n - mx*mx)), oy = Math.sqrt(Math.max(0, Sy2/n - my*my));
    const sx = n > 1 ? Math.sqrt(Math.max(0, (Sx2 - n*mx*mx)/(n - 1))) : null, sy = n > 1 ? Math.sqrt(Math.max(0, (Sy2 - n*my*my)/(n - 1))) : null;
    const xs = rows.map(r => r.x), ys = rows.map(r => r.y).filter(y => y != null);
    const o = { n, mx, Sx, Sx2, ox, sx, minX:Math.min(...xs), maxX:Math.max(...xs), my, Sy, Sy2, Sxy, oy, sy, minY:ys.length ? Math.min(...ys) : null, maxY:ys.length ? Math.max(...ys) : null };
    // tứ phân vị (cách tính của máy: trung vị của nửa dưới / nửa trên)
    const ex = []; rows.forEach(r => { const f = fq(r); if(Number.isInteger(f) && ex.length + f < 50000) for(let i = 0; i < f; i++) ex.push(r.x); });
    if(ex.length === n){ ex.sort((a, b) => a - b); const med = a => a.length % 2 ? a[(a.length - 1)/2] : (a[a.length/2 - 1] + a[a.length/2])/2; const h = Math.floor(n/2);
      o.med = med(ex); if(n > 1){ o.q1 = med(ex.slice(0, h)); o.q3 = med(ex.slice(n - h)); } }
    if(st.type !== "1v"){
      const R = REGS[st.type];
      if(R.quad){
        let s = Array(5).fill(0), t = Array(3).fill(0);
        rows.forEach(r => { const f = fq(r); for(let p = 0; p < 5; p++) s[p] += f*Math.pow(r.x, p); for(let p = 0; p < 3; p++) t[p] += f*Math.pow(r.x, p)*r.y; });
        const A = [[s[0], s[1], s[2], t[0]], [s[1], s[2], s[3], t[1]], [s[2], s[3], s[4], t[2]]];
        const sol = gauss(A); if(!sol) K.err("math"); [o.a, o.b, o.c] = sol;
      } else {
        let N = 0, X = 0, Y = 0, XX = 0, YY = 0, XY = 0;
        rows.forEach(r => { const f = fq(r); const u = R.X(r.x), v = R.Y(r.y); if(!isFinite(u) || !isFinite(v)) K.err("math"); N += f; X += f*u; Y += f*v; XX += f*u*u; YY += f*v*v; XY += f*u*v; });
        const sxx = XX - X*X/N, syy = YY - Y*Y/N, sxy = XY - X*Y/N; if(!sxx) K.err("math");
        const B = sxy/sxx, A0 = (Y - B*X)/N; [o.a, o.b] = R.back(A0, B); o.r = syy ? sxy/Math.sqrt(sxx*syy) : 1;
      }
    }
    return o;
  }
  function gauss(A){
    const n = A.length, m = A.map(r => r.slice());
    for(let i = 0; i < n; i++){ let p = i; for(let k2 = i+1; k2 < n; k2++) if(Math.abs(m[k2][i]) > Math.abs(m[p][i])) p = k2;
      if(Math.abs(m[p][i]) < 1e-12) return null; [m[p], m[i]] = [m[i], m[p]];
      for(let k2 = 0; k2 < n; k2++) if(k2 !== i){ const f = m[k2][i]/m[i][i]; for(let j = i; j <= n; j++) m[k2][j] -= f*m[i][j]; } }
    return m.map((r, i) => K.nearInt(r[n]/r[i]));
  }

  /* ---------- phân phối ---------- */
  function erf(x){
    const ax = Math.abs(x);
    if(ax < 2.5){ let s = 0, t = x, n = 0; while(Math.abs(t) > 1e-17*Math.abs(s) || n < 3){ s += t/(2*n + 1); n++; t *= -x*x/n; if(n > 200) break; } return 2/Math.sqrt(Math.PI)*s; }
    return Math.sign(x)*(1 - erfcCF(ax));
  }
  function erfcCF(x){ // phân số liên tục (Lentz)
    let f = x, C = x, D = 0, tiny = 1e-300;
    for(let n = 1; n < 300; n++){ const an = n/2; D = x + an*D; D = 1/(Math.abs(D) < tiny ? tiny : D); C = x + an/C; if(Math.abs(C) < tiny) C = tiny; const del = C*D; f *= del; if(Math.abs(del - 1) < 1e-16) break; }
    return Math.exp(-x*x)/Math.sqrt(Math.PI)/f;
  }
  const Phi = z => z < -5 ? 0.5*erfcCF(-z/Math.SQRT2) : z > 5 ? 1 - 0.5*erfcCF(z/Math.SQRT2) : 0.5*(1 + erf(z/Math.SQRT2));
  function invPhi(p){
    if(p <= 0 || p >= 1) K.err("math");
    const a = [-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239],
      b = [-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1],
      c = [-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],
      d = [7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
    let x;
    if(p < 0.02425){ const q = Math.sqrt(-2*Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    else if(p > 1 - 0.02425){ const q = Math.sqrt(-2*Math.log(1-p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    else { const q = p - 0.5, r = q*q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
    for(let i = 0; i < 3; i++){ const e = Phi(x) - p, u = e*Math.sqrt(2*Math.PI)*Math.exp(x*x/2); x = x - u/(1 + x*u/2); }
    return x;
  }
  function lgamma(z){ const g = 7, C = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if(z < 0.5) return Math.log(Math.PI/Math.abs(Math.sin(Math.PI*z))) - lgamma(1 - z);
    z -= 1; let x = C[0]; for(let i = 1; i < g + 2; i++) x += C[i]/(z + i); const t = z + g + 0.5; return 0.5*Math.log(2*Math.PI) + (z + 0.5)*Math.log(t) - t + Math.log(x); }
  function binPD(x, n, p){ if(x < 0 || x > n) return 0; if(p === 0) return x === 0 ? 1 : 0; if(p === 1) return x === n ? 1 : 0;
    if(n <= 1000){ let c = 1; for(let i = 1; i <= x; i++) c = c*(n - x + i)/i; return c*Math.pow(p, x)*Math.pow(1 - p, n - x); }
    return Math.exp(lgamma(n+1) - lgamma(x+1) - lgamma(n-x+1) + x*Math.log(p) + (n-x)*Math.log(1-p)); }
  function poiPD(x, l){ if(x < 0) return 0; return Math.exp(-l + x*Math.log(l) - lgamma(x+1)); }
  const DIST = [
    { id:"npd", ten:"Phân phối chuẩn PD",  f:[["x",0],["σ",1],["μ",0]], kq:"p", tinh:v => { if(v.σ <= 0) K.err("math"); return Math.exp(-((v.x - v.μ)**2)/(2*v.σ*v.σ))/(v.σ*Math.sqrt(2*Math.PI)); } },
    { id:"ncd", ten:"Phân phối chuẩn CD",  f:[["Dưới",0],["Trên",1],["σ",1],["μ",0]], kq:"P", tinh:v => { if(v.σ <= 0 || v["Dưới"] > v["Trên"]) K.err("math"); return Phi((v["Trên"] - v.μ)/v.σ) - Phi((v["Dưới"] - v.μ)/v.σ); } },
    { id:"inv", ten:"Nghịch đảo chuẩn",    f:[["Đuôi","Trái"],["Diện tích",0.5],["σ",1],["μ",0]], kq:"xInv", tinh:v => { const a = v["Diện tích"]; if(v.σ <= 0 || a <= 0 || a >= 1) K.err("math");
        const t = v["Đuôi"]; if(t === "Giữa"){ const z = invPhi(0.5 + a/2); return [v.μ - z*v.σ, v.μ + z*v.σ]; } return v.μ + v.σ*invPhi(t === "Phải" ? 1 - a : a); } },
    { id:"bpd", ten:"Nhị thức PD",          f:[["x",0],["N",1],["p",0.5]], kq:"P", tinh:v => { if(!Number.isInteger(v.x) || !Number.isInteger(v.N) || v.N < 0 || v.p < 0 || v.p > 1) K.err("math"); return binPD(v.x, v.N, v.p); } },
    { id:"bcd", ten:"Nhị thức CD",          f:[["x",0],["N",1],["p",0.5]], kq:"P", tinh:v => { if(!Number.isInteger(v.x) || !Number.isInteger(v.N) || v.N < 0 || v.p < 0 || v.p > 1) K.err("math"); let s = 0; for(let i = 0; i <= Math.min(v.x, v.N); i++) s += binPD(i, v.N, v.p); return Math.min(1, s); } },
    { id:"ppd", ten:"Poisson PD",           f:[["x",0],["λ",1]], kq:"P", tinh:v => { if(!Number.isInteger(v.x) || v.λ <= 0) K.err("math"); return poiPD(v.x, v.λ); } },
    { id:"pcd", ten:"Poisson CD",           f:[["x",0],["λ",1]], kq:"P", tinh:v => { if(!Number.isInteger(v.x) || v.λ <= 0) K.err("math"); let s = 0; for(let i = 0; i <= v.x; i++) s += poiPD(i, v.λ); return Math.min(1, s); } }
  ];

  /* ---------- cài đặt mặc định ---------- */
  const DEF_S = () => ({ io:"math", ang:"D", fmt:{ t:"norm", n:1 }, frac:"dc", cplx:"rect", freq:false, dec:".", sep:false, tail:"Trái" });
  const DEF_MEM = () => ({ ans:0, preans:0, vars:{ A:0, B:0, C:0, D:0, E:0, F:0, x:0, y:0, z:0, M:0 }, mat:{}, vct:{} });

  /* =====================================================================
     Một máy tính gắn vào một phần tử
     ===================================================================== */
  function mount(host, model){
    model = model === "580" ? "580" : "880";
    const KEYDEF = KEYS[model], MODEL_MODES = model === "580"
      ? ["calc","cplx","base","mat","vct","stat","dist","table","eqn","ineq","verif","ratio"]
      : ["calc","stat","dist","sprd","table","eqn","ineq","cplx","base","mat","vct","ratio","box"];
    const SKEY = "toan10-calc-" + model;
    const c = { model, S:DEF_S(), mem:DEF_MEM(), mode:"calc", base:10, stack:[], shift:false, alpha:false, sto:false, off:false,
      stat:{ type:"1v", data:[] }, sheet:{}, fn:{ f:[], g:[] }, verify:false, tbl:{ start:1, end:5, step:1 } };
    try{ const s = JSON.parse(localStorage.getItem(SKEY) || "null");
      if(s){ Object.assign(c.S, s.S || {}); Object.assign(c.mem, s.mem || {}); c.mem.vars = { ...DEF_MEM().vars, ...((s.mem || {}).vars || {}) };
        if(s.stat) c.stat = s.stat; if(s.sheet) c.sheet = s.sheet; if(s.fn) c.fn = s.fn; if(s.tbl) c.tbl = s.tbl; if(MODEL_MODES.includes(s.mode)) c.mode = s.mode; if(s.base) c.base = s.base; } }catch(e){}
    const plainMem = () => ({ ...c.mem, ans:typeof c.mem.ans === "number" ? c.mem.ans : 0, preans:typeof c.mem.preans === "number" ? c.mem.preans : 0 });
    let saveT = null;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try{ localStorage.setItem(SKEY, JSON.stringify({ S:c.S, mem:plainMem(), stat:c.stat, sheet:c.sheet, fn:c.fn, tbl:c.tbl, mode:c.mode, base:c.base })); }catch(e){} }, 300); };

    /* ---- khung máy ---- */
    host.innerHTML = "";
    const el = document.createElement("div");
    el.className = "cw cw-" + model; el.tabIndex = 0;
    el.setAttribute("role", "application"); el.setAttribute("aria-label", "Máy tính cầm tay mô phỏng kiểu " + (model === "580" ? "fx-580VN X" : "fx-880BTG"));
    const keyHTML = kd => `<button type="button" class="ck ck-${kd.id}${kd.cls ? " " + kd.cls : ""}" data-k="${kd.id}" aria-label="${esc(kd.l)}"${kd.c ? ` style="grid-column:${kd.c};grid-row:${kd.r}"` : ""}>`
      + `<span class="ck-tl">${kd.sl ? `<i class="s">${esc(kd.sl)}</i>` : ""}${kd.al ? `<i class="a">${esc(kd.al)}</i>` : ""}${kd.bn ? `<i class="b">${esc(kd.bn)}</i>` : ""}${kd.cap ? `<i class="cap">${esc(kd.cap)}</i>` : ""}</span>`
      + (kd.icon ? `<span class="ki">${KICON[kd.icon]}</span>` : `<b>${esc(kd.face != null ? kd.face : kd.l)}</b>`) + `</button>`;
    const pad = `<div class="cpad"><button type="button" class="cp up" data-k="up" aria-label="Lên"></button><button type="button" class="cp dn" data-k="down" aria-label="Xuống"></button><button type="button" class="cp lf" data-k="left" aria-label="Trái"></button><button type="button" class="cp rt" data-k="right" aria-label="Phải"></button>${model === "880" ? `<button type="button" class="cp ok" data-k="ok" aria-label="OK">OK</button>` : `<span class="cp mid">REPLAY</span>`}</div>`;
    el.innerHTML = `<div class="cw-head"><span class="cw-name">${model === "580" ? "fx-580VN X" : "fx-880BTG"}</span><span class="cw-sub">${model === "580" ? "MÔ PHỎNG · NATURAL DISPLAY" : "MÔ PHỎNG · CLASSWIZ"}</span><span class="cw-sol" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <div class="cw-lcd"><div class="lst" aria-hidden="true"></div><div class="lbody" aria-live="polite"></div></div>
      <div class="cw-keys">
        <div class="ctop">${KEYDEF.top.map(x => x === "pad" ? pad : keyHTML(x)).join("")}</div>
        <div class="cfn">${KEYDEF.fn.flat().map(keyHTML).join("")}</div>
        <div class="cbig">${KEYDEF.big.flat().map(keyHTML).join("")}</div>
      </div>`;
    host.appendChild(el);
    const lst = el.querySelector(".lst"), lbody = el.querySelector(".lbody");
    const KD = {}; [...KEYDEF.top.filter(x => x !== "pad"), ...KEYDEF.fn.flat(), ...KEYDEF.big.flat()].forEach(x => { KD[x.id] = x; });
    if(model === "880") el.querySelector(".cfn").insertAdjacentHTML("beforebegin", "");

    /* ---- môi trường tính ---- */
    const S = () => ({ ...c.S, mode:c.mode === "verif" ? "calc" : (c.mode === "stat" || c.mode === "table" || c.mode === "sprd" || c.mode === "eqn" || c.mode === "ineq" || c.mode === "dist" || c.mode === "ratio" || c.mode === "box") ? "calc" : c.mode, base:c.base });
    const env = extra => ({ S:S(), mem:c.mem, stat:c.mode === "stat" ? statVar : null, est:c.mode === "stat" ? statEst : null, ...(extra || {}) });
    const evalT = (toks, extra) => K.evaluate(toks, env(extra));
    const evalNum = (toks, extra) => { const v = evalT(toks, extra); if(K.isC(v)){ if(v.im) K.err("math"); return v.re; } if(typeof v !== "number") K.err("math"); return v; };
    function statVar(nm){ const o = statCalc(c.stat, c.S); if(!o) K.err("math"); const v = o[nm]; if(v == null) K.err("math"); return v; }
    function statEst(op, v){ const o = statCalc(c.stat, c.S); if(!o || c.stat.type === "1v") K.err("math"); const R = REGS[c.stat.type];
      if(op === "yhat") return R.yh(o, v);
      if(R.quad){ const D = o.b*o.b - 4*o.c*(o.a - v); if(D < 0 || !o.c) K.err("math"); const r1 = (-o.b + Math.sqrt(D))/(2*o.c), r2 = (-o.b - Math.sqrt(D))/(2*o.c); return op === "xhat2" ? Math.min(r1, r2) : Math.max(r1, r2); }
      if(op !== "xhat") K.err("syntax"); return R.xh(o, v); }

    /* ---- màn hình con ---- */
    const top = () => c.stack[c.stack.length - 1];
    const push = s => { c.stack.push(s); render(); };
    const pop = () => { if(c.stack.length > 1) c.stack.pop(); render(); };
    const toRoot = () => { c.stack.length = 1; render(); };
    function errScreen(e, back){
      const code = e.calc || "math", [t, m] = K.ERR[code] || ["Math ERROR", e.message];
      return { st:"", html:() => `<div class="lerr"><b>${t}</b><span>${m}</span><small>[AC] Hủy · [◀][▶] Sửa lại</small></div>`,
        key:a => { if(a === "cmd:ac" || a === "cmd:on" || a === "cmd:back"){ c.stack.pop(); back && back("ac"); render(); return true; }
          if(a === "cmd:left" || a === "cmd:right"){ c.stack.pop(); back && back("edit"); render(); return true; } return true; } };
    }
    const showErr = (e, back) => { if(!e.calc) console.error(e); push(errScreen(e, back)); };

    /* danh sách chọn */
    function Menu(title, items, opt = {}){
      let cur = 0;
      const per = opt.per || 5;
      return { st:opt.st, html:() => {
          const s0 = Math.max(0, Math.min(cur - Math.floor(per/2), items.length - per));
          const vis = items.slice(s0, s0 + per);
          return `<div class="lmenu">${title ? `<div class="lmt">${esc(title)}</div>` : ""}${vis.map((it, i) => { const j = s0 + i; return `<div class="lmi${j === cur ? " on" : ""}"><span class="no">${j < 9 ? j + 1 : ""}</span><span class="tx">${it.html || esc(it.t)}</span>${it.v != null ? `<span class="vv">${it.v}</span>` : ""}</div>`; }).join("")}
            ${items.length > per ? `<div class="lsc">${s0 > 0 ? "▲" : "&nbsp;"}${s0 + per < items.length ? "▼" : ""}</div>` : ""}</div>`; },
        key:a => {
          if(a === "cmd:up"){ cur = (cur - 1 + items.length) % items.length; return true; }
          if(a === "cmd:down"){ cur = (cur + 1) % items.length; return true; }
          if(a === "cmd:exe" || a === "cmd:ok"){ items[cur].f(); return true; }
          const m = a.match(/^ins:([1-9])$/); if(m && +m[1] <= items.length){ cur = +m[1] - 1; items[cur].f(); return true; }
          if(a === "cmd:ac" || a === "cmd:back" || (opt.closeOn || []).includes(a)){ pop(); return true; }
          return true;
        } };
    }
    const Info = (title, html) => ({ html:() => `<div class="linfo">${title ? `<div class="lmt">${esc(title)}</div>` : ""}${html}</div>`, key:a => { if(["cmd:ac","cmd:back","cmd:exe","cmd:ok"].includes(a)){ pop(); return true; } return true; } });

    /* ô nhập nhiều dòng (giá trị số hoặc biểu thức) */
    function Form(title, fields, onDone, opt = {}){
      let cur = 0, ed = null;
      const show = f => f.kind === "expr" ? (f.toks && f.toks.length ? esc(tokStr(f.toks)) : "") : f.kind === "choice" ? esc(f.val) : (f.val == null ? "" : esc(shortNum(f.val, c.S)));
      const commit = () => {
        const f = fields[cur];
        if(f.kind === "expr"){ f.toks = ed.t.slice(); ed = null; return true; }
        if(!ed.t.length){ ed = null; return true; }
        try{ f.val = evalNum(ed.t); ed = null; return true; }catch(e){ const keep = ed; showErr(e, how => { if(how === "edit") ed = keep; else ed = null; }); return false; }
      };
      const self = { st:opt.st, html:() => {
          const per = 4, s0 = Math.max(0, Math.min(cur - 1, fields.length - per));
          return `<div class="lform">${title ? `<div class="lmt">${esc(title)}</div>` : ""}${fields.slice(s0, s0 + per).map((f, i) => { const j = s0 + i, on = j === cur;
            return `<div class="lfr${on ? " on" : ""}"><span class="lb">${esc(f.label)}${f.kind === "expr" ? "" : "="}</span><span class="vl">${on && ed ? ed.html(true) : show(f)}${f.kind === "choice" && on ? ` <small>(◀ ▶)</small>` : ""}</span></div>`; }).join("")}
            ${fields.length > per ? `<div class="lsc">${s0 > 0 ? "▲" : ""}${s0 + per < fields.length ? "▼" : ""}</div>` : ""}</div>`; },
        key:a => {
          const f = fields[cur];
          if(f.kind === "choice" && (a === "cmd:left" || a === "cmd:right")){ const i = f.opts.indexOf(f.val); f.val = f.opts[(i + (a === "cmd:right" ? 1 : f.opts.length - 1)) % f.opts.length]; return true; }
          if(a.startsWith("ins:") && f.kind !== "choice"){ if(!ed) ed = new Ed(f.kind === "expr" ? [] : []); ed.ins(a.slice(4)); return true; }
          if(a === "cmd:del"){ if(ed) ed.del(); else if(f.kind === "expr"){ ed = new Ed(f.toks || []); ed.del(); } return true; }
          if(ed && (a === "cmd:left" || a === "cmd:right")){ a === "cmd:left" ? ed.left() : ed.right(); return true; }
          if(a === "cmd:up"){ if(ed && !commit()) return true; cur = Math.max(0, cur - 1); return true; }
          if(a === "cmd:down"){ if(ed && !commit()) return true; cur = Math.min(fields.length - 1, cur + 1); return true; }
          if(a === "cmd:exe" || a === "cmd:ok"){
            if(ed){ if(!commit()) return true; }
            if(cur < fields.length - 1){ cur++; return true; }
            const vals = {}; for(const x of fields){ if(x.kind !== "expr" && x.kind !== "choice" && x.val == null && !x.optional){ cur = fields.indexOf(x); return true; } vals[x.key || x.label] = x.kind === "expr" ? x.toks : x.val; }
            try{ onDone(vals); }catch(e){ showErr(e); }
            return true;
          }
          if(a === "cmd:ac"){ if(ed){ ed = null; return true; } if(opt.onAC){ opt.onAC(); return true; } pop(); return true; }
          if(a === "cmd:back"){ if(ed){ ed = null; return true; } pop(); return true; }
          if(a === "cmd:optn" && opt.optn){ opt.optn(); return true; }
          return true;
        } };
      return self;
    }

    /* danh sách kết quả */
    function Results(title, rows, opt = {}){
      let cur = 0;
      return { st:opt.st, html:() => {
          const per = opt.per || 3, s0 = Math.max(0, Math.min(cur, rows.length - per));
          return `<div class="lres">${title ? `<div class="lmt">${esc(title)}</div>` : ""}${rows.slice(s0, s0 + per).map(r => `<div class="lrr"><span class="lb">${r[0]}</span><span class="vl">${r[1]}</span></div>`).join("")}
            ${rows.length > per ? `<div class="lsc">${s0 > 0 ? "▲" : "&nbsp;"}${s0 + per < rows.length ? "▼" : ""}</div>` : ""}</div>`; },
        key:a => {
          if(a === "cmd:up"){ cur = Math.max(0, cur - 1); return true; }
          if(a === "cmd:down"){ cur = Math.min(Math.max(0, rows.length - (opt.per || 3)), cur + 1); return true; }
          if(a === "cmd:exe" || a === "cmd:ok" || a === "cmd:ac" || a === "cmd:back"){ if(opt.onClose) opt.onClose(a); else pop(); return true; }
          if(a === "cmd:optn" && opt.optn){ opt.optn(); return true; }
          return true;
        } };
    }

    /* bảng nhập (ma trận, vectơ, hệ số, dữ liệu thống kê) */
    function Grid(o){
      // o: { title, cols:[tên], rows:n, data:[[số|null]], grow:bool, max:n, onExe, onAC, optn, st }
      let r = 0, col = 0, ed = null, top0 = 0, left0 = 0;
      const visR = 3, visC = Math.min(o.cols.length, 4);
      const commit = () => { if(!ed.t.length){ ed = null; return true; }
        try{ const v = evalNum(ed.t); while(o.data.length <= r) o.data.push(o.cols.map(() => null)); o.data[r][col] = v; ed = null; return true; }
        catch(e){ const keep = ed; showErr(e, how => { ed = how === "edit" ? keep : null; }); return false; } };
      const nRows = () => o.grow ? Math.min(o.max || 160, o.data.length + 1) : o.rows;
      const move = (dr, dc) => {
        r = Math.max(0, Math.min(nRows() - 1, r + dr)); col = Math.max(0, Math.min(o.cols.length - 1, col + dc));
        if(r < top0) top0 = r; if(r >= top0 + visR) top0 = r - visR + 1; if(col < left0) left0 = col; if(col >= left0 + visC) left0 = col - visC + 1;
      };
      return { st:o.st, html:() => {
          const n = nRows(), rowsH = [];
          for(let i = top0; i < Math.min(n, top0 + visR); i++){
            rowsH.push(`<tr><th>${i + 1}</th>${o.cols.slice(left0, left0 + visC).map((_, jj) => { const j = left0 + jj, v = (o.data[i] || [])[j];
              return `<td class="${i === r && j === col ? "on" : ""}">${v == null ? "" : esc(shortNum(v, c.S))}</td>`; }).join("")}</tr>`);
          }
          const curV = (o.data[r] || [])[col];
          return `<div class="lgrid">${o.title ? `<div class="lmt">${esc(o.title)}</div>` : ""}<table><tr><th></th>${o.cols.slice(left0, left0 + visC).map(x => `<th>${esc(x)}</th>`).join("")}</tr>${rowsH.join("")}</table>
            <div class="lgv">${ed ? ed.html(true) : curV == null ? "&nbsp;" : numHTML(curV, S(), null)}</div></div>`; },
        key:a => {
          if(a.startsWith("ins:")){ if(!ed) ed = new Ed(); ed.ins(a.slice(4)); return true; }
          if(a === "cmd:del"){ if(ed){ ed.del(); return true; } if(o.grow && o.data[r]){ o.data.splice(r, 1); move(0, 0); o.onChange && o.onChange(); } else if(o.data[r]){ o.data[r][col] = o.grow ? null : 0; o.onChange && o.onChange(); } return true; }
          if(a === "cmd:exe" || a === "cmd:ok"){
            if(ed){ if(!commit()) return true; o.onChange && o.onChange();
              if(col < o.cols.length - 1 && !o.down) move(0, 1); else { if(o.down) move(1, 0); else { move(1, 0); col = 0; left0 = 0; } }
              return true; }
            if(o.onExe){ try{ o.onExe(); }catch(e){ showErr(e); } } return true;
          }
          if(["cmd:up","cmd:down","cmd:left","cmd:right"].includes(a)){
            if(ed){ if(a === "cmd:left"){ ed.left(); return true; } if(a === "cmd:right"){ ed.right(); return true; } if(!commit()) return true; o.onChange && o.onChange(); }
            move(a === "cmd:up" ? -1 : a === "cmd:down" ? 1 : 0, a === "cmd:left" ? -1 : a === "cmd:right" ? 1 : 0); return true; }
          if(a === "cmd:ac" || a === "cmd:back"){ if(ed){ ed = null; return true; } if(o.onAC) o.onAC(); else pop(); return true; }
          if(a === "cmd:optn" && o.optn){ o.optn(); return true; }
          return true;
        } };
    }

    /* ---------------- màn hình tính toán (Tính toán, Số phức, Cơ số N, Ma trận, Vectơ, Kiểm tra…) ---------------- */
    function CalcScreen(){
      const s = { ed:new Ed(), res:null, view:null, eng:null, shown:false, hist:[], hi:-1, last:null, errPos:null, calcVars:null };
      const contTok = new Set(["+","−","×","÷","^(","xrt(","sq","cube","inv","fact","pct","npr","ncr","frac","eq","ne","gt","lt","ge","le","and","or","xor","xnor","dot","topol","torect","dms","yhat","xhat","xhat1","xhat2"]);
      function setResult(v, toks){
        s.res = v; s.view = typeof v === "number" && toks.includes("dms") ? "dms" : null; s.eng = null; s.shown = true; s.last = toks.slice();
        if(v && v.bool == null){
          if(K.isM(v)) c.mem.mat.Ans = v;
          else if(K.isV(v)) c.mem.vct.Ans = v;
          else { c.mem.preans = c.mem.ans; c.mem.ans = v.pair ? v.pair[0] : v; if(v.pair){ c.mem.vars.x = v.pair[0]; c.mem.vars.y = v.pair[1]; } }
        }
        s.hist.push({ t:toks.slice(), v }); if(s.hist.length > 30) s.hist.shift(); s.hi = -1;
        save();
      }
      function exe(){
        if(!s.ed.t.length){ if(s.last && s.shown){ s.ed = new Ed(s.last); } else return; }
        const toks = s.ed.t.slice();
        if(c.sto){ return storeTo(c.stoVar, toks); }
        try{ const v = evalT(toks, s.calcVars ? { bind:null } : null); setResult(v, toks); }
        catch(e){ s.errPos = e.pos; showErr(e, how => { if(how === "edit"){ s.shown = false; s.ed.c = e.pos != null ? Math.min(e.pos + 1, s.ed.t.length) : s.ed.t.length; } else { s.ed = new Ed(); s.shown = false; s.res = null; } s.errPos = null; }); }
      }
      function storeTo(name, toks){
        c.sto = false;
        try{ const v = toks && toks.length ? evalT(toks) : c.mem.ans; const num = K.isC(v) ? v : typeof v === "number" ? v : K.err("math");
          c.mem.vars[name === "E_" ? "E" : name] = num; s.res = num; s.shown = true; s.view = null; s.stoMsg = (toks && toks.length ? "" : "Ans") + "→" + (name === "E_" ? "E" : name);
          if(toks && toks.length){ c.mem.preans = c.mem.ans; c.mem.ans = num; s.last = toks.slice(); } save(); }
        catch(e){ showErr(e); }
      }
      s.storeTo = storeTo;
      s.html = () => {
        const S0 = S();
        const inp = s.shown && s.ed.t.length === 0 && s.last ? esc(tokStr(s.last)) : s.ed.html(!s.shown, s.errPos);
        let out = "";
        if(s.shown && s.res != null){
          out = valHTML(s.res, S0, s.view, s.eng);
          if(s.stoMsg) out = `<small class="lsto">${s.stoMsg}</small> ` + out;
        }
        const baseTag = c.mode === "base" ? `<span class="lbase">${BASE_NAME[c.base]}</span>` : "";
        return `<div class="lcalc${K.isM(s.res) || K.isV(s.res) ? " big" : ""}">${baseTag}<div class="lin">${inp}</div><div class="lout">${out}</div></div>`;
      };
      s.key = a => {
        if(a.startsWith("ins:")){
          let t = a.slice(4);
          if(c.sto && /^(A|B|C|D|E_|F|x|y|z|M)$/.test(t)){ storeTo(t, s.shown ? null : s.ed.t); return true; }
          s.stoMsg = null;
          if(s.shown){
            const prev = s.res;
            s.ed = new Ed(); s.shown = false; s.res = null;
            if(contTok.has(t) && prev != null && prev.bool == null) s.ed.ins(K.isM(prev) ? "MatAns" : K.isV(prev) ? "VctAns" : "ans");
          }
          s.ed.ins(t); return true;
        }
        switch(a){
          case "cmd:exe": exe(); return true;
          case "cmd:approx": { exe(); if(s.shown && typeof s.res === "number") s.view = "dec"; return true; }
          case "cmd:del": if(s.shown){ s.shown = false; s.ed = new Ed(s.last || []); return true; } s.ed.del(); return true;
          case "cmd:ac": s.ed = new Ed(); s.shown = false; s.res = null; s.stoMsg = null; c.sto = false; return true;
          case "cmd:left": if(s.shown){ s.shown = false; s.ed = new Ed(s.last || []); return true; } s.ed.left(); return true;
          case "cmd:right": if(s.shown){ s.shown = false; s.ed = new Ed(s.last || []); s.ed.c = 0; return true; } s.ed.right(); return true;
          case "cmd:up": case "cmd:down": {
            if(!s.hist.length) return true;
            if(!s.shown && s.ed.t.length) return true;
            s.hi = s.hi < 0 ? s.hist.length - 1 : Math.max(0, Math.min(s.hist.length - 1, s.hi + (a === "cmd:up" ? -1 : 1)));
            const h = s.hist[s.hi]; s.last = h.t.slice(); s.res = h.v; s.shown = true; s.view = null; s.ed = new Ed(); return true; }
          case "cmd:sd": if(s.shown && s.res != null){ s.view = (s.view === "dec" || (s.view == null && c.S.io !== "math")) ? "exact" : "dec"; } return true;
          case "cmd:mixed": if(s.shown){ c.S.frac = c.S.frac === "abc" ? "dc" : "abc"; s.view = "exact"; } return true;
          case "cmd:eng": case "cmd:engl": if(s.shown && typeof s.res === "number"){ s.eng = s.view === "eng" ? s.eng + (a === "cmd:eng" ? -3 : 3) : 0; s.view = "eng"; } return true;
          case "cmd:pfact": if(s.shown && typeof s.res === "number"){ s.view = s.view === "pfact" ? null : "pfact"; } return true;
          case "cmd:mplus": case "cmd:mminus": {
            try{ const toks = s.shown || !s.ed.t.length ? null : s.ed.t.slice(); const v = toks ? evalNum(toks) : K.num(c.mem.ans);
              c.mem.vars.M = K.fin(c.mem.vars.M + (a === "cmd:mplus" ? v : -v)); if(toks){ setResult(v, toks); } s.stoMsg = a === "cmd:mplus" ? "M+" : "M−"; s.shown = true; s.res = v; save(); }
            catch(e){ showErr(e); } return true; }
          case "cmd:calc": startCalc(); return true;
          case "cmd:solve": startSolve(); return true;
        }
        if(a === "ins:dms" && s.shown) { s.view = s.view === "dms" ? null : "dms"; return true; }
        return false;
      };
      function startCalc(){
        const toks = s.shown ? (s.last || []) : s.ed.t;
        if(!toks.length) return;
        const vars = K.freeVars(toks.filter(t => t !== "eq"));
        const fields = vars.map(v => ({ label:v === "E_" ? "E" : v, key:v, val:c.mem.vars[v === "E_" ? "E" : v] }));
        const run = vals => { for(const v in vals) c.mem.vars[v === "E_" ? "E" : v] = vals[v]; c.stack.pop();
          try{ const r = evalT(toks); setResult(r, toks); }catch(e){ showErr(e); } render(); };
        if(!fields.length) return run({});
        push(Form("CALC", fields, run));
      }
      function startSolve(){
        const toks = s.shown ? (s.last || []) : s.ed.t;
        if(!toks.length || !toks.includes("x")){ showErr(Object.assign(new Error(), { calc:"var" })); return; }
        const i = toks.indexOf("eq"), L = i >= 0 ? toks.slice(0, i) : toks, R = i >= 0 ? toks.slice(i + 1) : ["0"];
        if(!L.length || !R.length){ showErr(Object.assign(new Error(), { calc:"syntax" })); return; }
        const vars = K.freeVars(toks).filter(v => v !== "x");
        const fields = [...vars.map(v => ({ label:v === "E_" ? "E" : v, key:v, val:c.mem.vars[v === "E_" ? "E" : v] })), { label:"x (giá trị đầu)", key:"x", val:c.mem.vars.x }];
        push(Form("SOLVE", fields, vals => {
          for(const v in vals) c.mem.vars[v === "E_" ? "E" : v] = vals[v];
          c.stack.pop();
          try{
            const f = x => evalNum(L, { bind:{ x } }) - evalNum(R, { bind:{ x } });
            const x = K.solve1(f, vals.x || 0), lr = f(x);
            c.mem.vars.x = x; c.mem.preans = c.mem.ans; c.mem.ans = x; save();
            push(Results("SOLVE", [["x", numHTML(x, S(), null)], ["L−R", decHTML(Math.abs(lr) < 1e-300 ? 0 : lr, S())]], { onClose:() => { pop(); } }));
          }catch(e){ showErr(e); }
          render();
        }));
      }
      return s;
    }

    /* ---------------- menu theo chế độ: OPTN (580) / TOOLS (880) ---------------- */
    const insert = t => () => { c.stack.pop(); const sc = top(); if(sc && sc.key) sc.key("ins:" + t); render(); };
    const insList = (title, list) => () => push(Menu(title, list.map(([t, tok]) => ({ t, f:insert(tok) }))));
    const HYP = [["sinh","sinh("],["cosh","cosh("],["tanh","tanh("],["sinh⁻¹","asinh("],["cosh⁻¹","acosh("],["tanh⁻¹","atanh("]];
    const ANG = [["° (độ)","udeg"],["ʳ (radian)","urad"],["ᵍ (grad)","ugra"],["°′″ (độ phút giây)","dms"]];
    const NUMF = [["GCD – ước chung lớn nhất","gcd("],["LCM – bội chung nhỏ nhất","lcm("],["Int – phần nguyên","int("],["Intg – số nguyên lớn nhất ≤ x","intg("],["Rnd – làm tròn theo hiển thị","rnd("],["Abs – giá trị tuyệt đối","abs("]];
    const PROB = [["x! – giai thừa","fact"],["nPr – chỉnh hợp","npr"],["nCr – tổ hợp","ncr"],["Ran# – số ngẫu nhiên","ran"],["RanInt#( – số nguyên ngẫu nhiên","ranint("]];
    const CMPS = [["=","eq"],["≠","ne"],[">","gt"],["<","lt"],["≥","ge"],["≤","le"]];
    function constMenu(){ push(Menu("Hằng số khoa học", K.CONST.map(([id, sym, ten, v, u]) => ({ html:`<b>${sym}</b> ${esc(ten)}`, f:insert("k:" + id) })), { per:5 })); }
    function convMenu(){ push(Menu("Chuyển đổi đơn vị", K.CONV.map(([id, d]) => ({ t:d, f:insert("cv:" + id) })), { per:5 })); }
    function matMenu(kind){
      const L = kind === "mat" ? ["A","B","C","D"] : ["A","B","C","D"], nm = kind === "mat" ? "Mat" : "Vct", store = kind === "mat" ? c.mem.mat : c.mem.vct;
      const define = edit => () => push(Menu(edit ? "Sửa" : "Định nghĩa", L.map(x => ({ t:`${nm}${x}${store[x] ? (kind === "mat" ? `  ${store[x].m.length}×${store[x].m[0].length}` : `  ${store[x].v.length} chiều`) : ""}`, f:() => {
        c.stack.pop(); if(edit && store[x]) return editMat(kind, x);
        if(kind === "mat") push(Menu(`Mat${x}: số hàng?`, [1,2,3,4].map(rn => ({ t:`${rn} hàng`, f:() => { c.stack.pop(); push(Menu(`Mat${x}: số cột?`, [1,2,3,4].map(cn => ({ t:`${cn} cột`, f:() => { c.stack.pop(); store[x] = { m:Array.from({length:rn}, () => Array(cn).fill(0)) }; editMat(kind, x); } })))); } }))));
        else push(Menu(`Vct${x}: số chiều?`, [2,3].map(dn => ({ t:`${dn} chiều`, f:() => { c.stack.pop(); store[x] = { v:Array(dn).fill(0) }; editMat(kind, x); } }))));
      } }))));
      const items = [{ t:kind === "mat" ? "Định nghĩa ma trận" : "Định nghĩa vectơ", f:() => { c.stack.pop(); define(false)(); } }, { t:kind === "mat" ? "Sửa ma trận" : "Sửa vectơ", f:() => { c.stack.pop(); define(true)(); } }];
      [...L, "Ans"].forEach(x => items.push({ t:nm + x, f:insert(nm + x) }));
      if(kind === "mat") [["Định thức Det(","det("],["Chuyển vị Trn(","trn("],["Ma trận đơn vị Identity(","ident("],["Bậc thang Ref(","ref("],["Bậc thang rút gọn Rref(","rref("]].forEach(([t, tok]) => items.push({ t, f:insert(tok) }));
      else [["Tích vô hướng •","dot"],["Góc giữa hai vectơ Angle(","angle("],["Vectơ đơn vị UnitV(","unitv("],["Độ dài Abs(","abs(" ]].forEach(([t, tok]) => items.push({ t, f:insert(tok) }));
      push(Menu(model === "580" ? "OPTN" : "TOOLS", items));
    }
    function editMat(kind, x){
      const store = kind === "mat" ? c.mem.mat : c.mem.vct, it = store[x];
      const data = kind === "mat" ? it.m : [it.v];
      const cols = kind === "mat" ? it.m[0].map((_, j) => String(j + 1)) : it.v.map((_, j) => ["x","y","z"][j]);
      push(Grid({ title:(kind === "mat" ? "Mat" : "Vct") + x, cols, rows:data.length, data, onChange:() => { if(kind !== "mat") it.v = data[0].map(v => v || 0); save(); }, onAC:() => { if(kind !== "mat") it.v = data[0].map(v => v || 0); data.forEach(r => r.forEach((v, j) => { if(v == null) r[j] = 0; })); save(); pop(); } }));
    }
    function optn(){
      const m = c.mode, T = model === "580" ? "OPTN" : "TOOLS";
      if(m === "mat" || m === "vct") return matMenu(m);
      if(m === "cplx") return push(Menu(T, [["Argument arg(","arg("],["Liên hợp Conjg(","conj("],["Dạng cực ▶r∠θ","topol"],["Dạng đại số ▶a+bi","torect"],["Phần thực ReP(","rep("],["Phần ảo ImP(","imp("],["Đơn vị ảo 𝑖","i"],["Dấu góc ∠","ang"]].map(([t, tok]) => ({ t, f:insert(tok) }))));
      if(m === "base" && model === "880") return push(Menu(T, [["Dec – hệ 10","base:10"],["Hex – hệ 16","base:16"],["Bin – hệ 2","base:2"],["Oct – hệ 8","base:8"],["and","and"],["or","or"],["xor","xor"],["xnor","xnor"],["Not(","not("],["Neg(","negb("],["d – số thập phân","bd"],["h – số thập lục phân","bh"],["b – số nhị phân","bb"],["o – số bát phân","bo"]].map(([t, tok]) => ({ t, f: tok.startsWith("base:") ? () => { c.base = +tok.slice(5); save(); c.stack.pop(); render(); } : insert(tok) })), { per:5 }));
      if(m === "base") return push(Menu(T, [["and","and"],["or","or"],["xor","xor"],["xnor","xnor"],["Not(","not("],["Neg(","negb("],["d – số thập phân","bd"],["h – số thập lục phân","bh"],["b – số nhị phân","bb"],["o – số bát phân","bo"]].map(([t, tok]) => ({ t, f:insert(tok) }))));
      if(m === "verif") return push(Menu(T, CMPS.map(([t, tok]) => ({ t, f:insert(tok) }))));
      if(m === "stat") return statMenu();
      if(m === "sprd") return sheetMenu();
      if(m === "table") return tableSetup();
      const items = [{ t:"Hàm hyperbolic", f:() => { c.stack.pop(); insList("Hyperbolic", HYP)(); } }, { t:"Đơn vị góc", f:() => { c.stack.pop(); insList("Đơn vị góc", ANG)(); } }, { t:"Hàm số học", f:() => { c.stack.pop(); insList("Hàm số học", NUMF)(); } }];
      if(model === "880") items.push({ t:"Kiểm tra (=, ≠, >, <, ≥, ≤)", f:() => { c.stack.pop(); insList("Kiểm tra", CMPS)(); } }, { t:"Tính giá trị biểu thức (CALC)", f:() => { c.stack.pop(); top().key("cmd:calc"); render(); } }, { t:"Giải phương trình (SOLVE)", f:() => { c.stack.pop(); top().key("cmd:solve"); render(); } });
      push(Menu(T, items));
    }
    function catalog(){ // 880
      const all = [
        ["Hàm hay dùng", [["x³","cube"],["∛(","cbrt("],["%","pct"],["√(","sqrt("],["log(","log("],["ln(","ln("],["10^(","pow10("],["e^(","exp("],["Abs(","abs("],["d/dx(","deriv("],["∫(","integ("],["Σ(","sum("],["Π(","prod(" ]]],
        ["Xác suất", PROB], ["Số học", NUMF], ["Góc, tọa độ", [...ANG, ["Pol(","pol("],["Rec(","rec("]]], ["Hyperbolic, lượng giác", [...HYP, ["sin⁻¹(","asin("],["cos⁻¹(","acos("],["tan⁻¹(","atan(" ]]],
        ["Biến, Ans", [["A","A"],["B","B"],["C","C"],["D","D"],["E","E_"],["F","F"],["x","x"],["y","y"],["z","z"],["M","M"],["Ans","ans"],["PreAns","preans"]]],
        ["So sánh (Kiểm tra)", CMPS]
      ];
      const items = all.map(([t, list]) => ({ t, f:() => { c.stack.pop(); insList(t, list)(); } }));
      items.push({ t:"Hằng số khoa học", f:() => { c.stack.pop(); constMenu(); } }, { t:"Chuyển đổi đơn vị", f:() => { c.stack.pop(); convMenu(); } });
      push(Menu("CATALOG", items));
    }
    function format(){ // 880
      const sc = top(); if(!sc || !("res" in sc) || !sc.shown || sc.res == null) return;
      const set = (v, extra) => () => { c.stack.pop(); sc.view = v; if(extra) extra(); render(); };
      const items = [{ t:"Chuẩn", f:set(null) }, { t:"Thập phân", f:set("dec") }, { t:"Phân số", f:set("exact", () => { c.S.frac = "dc"; }) }, { t:"Hỗn số", f:set("exact", () => { c.S.frac = "abc"; }) },
        { t:"Kỹ thuật (ENG)", f:set("eng", () => { sc.eng = 0; }) }, { t:"Độ phút giây", f:set("dms") }, { t:"Thừa số nguyên tố", f:set("pfact") }];
      if(K.isC(sc.res)) items.push({ t:"Dạng cực r∠θ", f:() => { c.stack.pop(); sc.res = Object.assign(new K.Cx(sc.res.re, sc.res.im), { view:"polar" }); render(); } }, { t:"Dạng đại số a+b𝑖", f:() => { c.stack.pop(); sc.res = Object.assign(new K.Cx(sc.res.re, sc.res.im), { view:"rect" }); render(); } });
      push(Menu("FORMAT", items));
    }
    const VARS = ["A","B","C","D","E_","F","x","y","z","M"];
    const varLabel = v => v === "E_" ? "E" : v;
    function rcl(){ // 580: RCL hiện giá trị các biến
      push(Menu("RCL – Biến", VARS.map(v => ({ html:`<b>${varLabel(v)}</b>`, v:valHTML(c.mem.vars[varLabel(v)], { ...S(), io:"dec" }), f:insert(v) })), { per:5 }));
    }
    function variable(storing){ // 880
      const sc0 = c.stack[0];
      push(Menu(storing ? "STO – Lưu vào biến" : "VARIABLE", VARS.map(v => ({ html:`<b>${varLabel(v)}</b>`, v:valHTML(c.mem.vars[varLabel(v)], { ...S(), io:"dec" }), f:() => {
        c.stack.pop();
        if(storing){ const sc = top(); if(sc && sc.storeTo) sc.storeTo(v, sc.shown ? null : sc.ed.t); render(); return; }
        push(Menu("Biến " + varLabel(v), [{ t:"Gọi lại (chèn vào biểu thức)", f:insert(v) }, { t:"Lưu Ans vào " + varLabel(v), f:() => { c.stack.pop(); c.mem.vars[varLabel(v)] = typeof c.mem.ans === "number" || K.isC(c.mem.ans) ? c.mem.ans : 0; save(); render(); } }, { t:"Xóa " + varLabel(v) + " (đặt về 0)", f:() => { c.stack.pop(); c.mem.vars[varLabel(v)] = 0; save(); render(); } }]));
      } })).concat(c.mode === "sprd" ? ["A","B","C","D","E_"].map(L => ({ html:`Ô cột <b>${varLabel(L)}</b>`, f:insert(L) })) : []), { per:5 }));
      void sc0;
    }

    /* ---------------- cài đặt ---------------- */
    function setup(){
      const S0 = c.S;
      const sub = (t, opts) => () => push(Menu(t, opts.map(([lab, fn]) => ({ t:lab, f:() => { fn(); save(); c.stack.pop(); c.stack.pop(); setup(); } }))));
      const fmtLab = S0.fmt.t === "fix" ? `Fix ${S0.fmt.n}` : S0.fmt.t === "sci" ? `Sci ${S0.fmt.n}` : `Norm ${S0.fmt.n}`;
      const items = [
        { t:"Nhập/Xuất", v:S0.io === "math" ? "MathI/MathO" : "MathI/DecimalO", f:sub("Nhập/Xuất", [["MathI/MathO (phân số, căn)", () => S0.io = "math"], ["MathI/DecimalO (thập phân)", () => S0.io = "dec"]]) },
        { t:"Đơn vị góc", v:{ D:"Độ", R:"Radian", G:"Grad" }[S0.ang], f:sub("Đơn vị góc", [["Độ (D)", () => S0.ang = "D"], ["Radian (R)", () => S0.ang = "R"], ["Grad (G)", () => S0.ang = "G"]]) },
        { t:"Định dạng số", v:fmtLab, f:() => push(Menu("Định dạng số", [
            { t:"Fix – cố định số chữ số thập phân", f:() => { c.stack.pop(); push(Menu("Fix 0~9", Array.from({length:10}, (_, n) => ({ t:"Fix " + n, f:() => { S0.fmt = { t:"fix", n }; save(); c.stack.length = 1; render(); } })))); } },
            { t:"Sci – số chữ số có nghĩa", f:() => { c.stack.pop(); push(Menu("Sci 0~9 (0 = 10 chữ số)", Array.from({length:10}, (_, n) => ({ t:"Sci " + n, f:() => { S0.fmt = { t:"sci", n }; save(); c.stack.length = 1; render(); } })))); } },
            { t:"Norm – thông thường", f:() => { c.stack.pop(); push(Menu("Norm 1~2", [1, 2].map(n => ({ t:`Norm ${n}${n === 1 ? " (10⁻² > |x| ≥ 10¹⁰ dùng ×10ˣ)" : " (10⁻⁹ > |x| ≥ 10¹⁰ dùng ×10ˣ)"}`, f:() => { S0.fmt = { t:"norm", n }; save(); c.stack.length = 1; render(); } })))); } }])) },
        { t:"Kết quả phân số", v:S0.frac === "abc" ? "ab/c (hỗn số)" : "d/c", f:sub("Kết quả phân số", [["ab/c – hỗn số", () => S0.frac = "abc"], ["d/c – phân số", () => S0.frac = "dc"]]) },
        { t:"Số phức", v:S0.cplx === "polar" ? "r∠θ" : "a+b𝑖", f:sub("Kết quả số phức", [["a+b𝑖", () => S0.cplx = "rect"], ["r∠θ", () => S0.cplx = "polar"]]) },
        { t:"Thống kê: cột tần số", v:S0.freq ? "Bật" : "Tắt", f:sub("Cột tần số", [["Bật", () => S0.freq = true], ["Tắt", () => S0.freq = false]]) },
        { t:"Dấu thập phân", v:S0.dec === "," ? "Phẩy" : "Chấm", f:sub("Dấu thập phân", [["Dấu chấm (.)", () => S0.dec = "."], ["Dấu phẩy (,)", () => S0.dec = ","]]) },
        { t:"Phân cách hàng nghìn", v:S0.sep ? "Bật" : "Tắt", f:sub("Phân cách hàng nghìn", [["Bật", () => S0.sep = true], ["Tắt", () => S0.sep = false]]) },
        { t:"Đặt lại (Reset)", f:() => { c.stack.pop(); reset(); } }
      ];
      push(Menu(model === "580" ? "SETUP" : "SETTINGS", items, { per:5 }));
    }
    function reset(){
      push(Menu("Đặt lại", [
        { t:"Cài đặt về mặc định", f:() => { c.S = DEF_S(); save(); c.stack.pop(); push(Info("", "<p>Đã đặt lại cài đặt.</p><small>[AC]</small>")); } },
        { t:"Xóa bộ nhớ (biến, Ans)", f:() => { c.mem = DEF_MEM(); save(); c.stack.pop(); push(Info("", "<p>Đã xóa bộ nhớ.</p><small>[AC]</small>")); } },
        { t:"Đặt lại tất cả", f:() => { c.S = DEF_S(); c.mem = DEF_MEM(); c.stat = { type:"1v", data:[] }; c.sheet = {}; c.fn = { f:[], g:[] }; save(); setMode("calc"); push(Info("", "<p>Đã đặt lại toàn bộ máy.</p><small>[AC]</small>")); } }
      ]));
    }

    /* ---------------- HOME / MENU: chọn chế độ ---------------- */
    function Home(){
      let cur = Math.max(0, MODEL_MODES.indexOf(c.mode));
      const cols = 4, labels = "123456789ABCD";
      return { st:"", html:() => {
          const rows = Math.ceil(MODEL_MODES.length/cols), r0 = Math.max(0, Math.min(Math.floor(cur/cols) - 1, rows - 2));
          const vis = MODEL_MODES.slice(r0*cols, r0*cols + cols*2);
          return `<div class="lhome">${vis.map((m, i) => { const j = r0*cols + i; return `<div class="lhi${j === cur ? " on" : ""}"><span class="ic">${MODES[m].ic}</span>${model === "580" ? `<span class="no">${labels[j]}</span>` : ""}</div>`; }).join("")}
            <div class="lhn">${model === "580" ? labels[cur] + ": " : ""}${esc(MODES[MODEL_MODES[cur]].ten)}</div>${rows > 2 ? `<div class="lsc">${r0 > 0 ? "▲" : "&nbsp;"}${r0 + 2 < rows ? "▼" : ""}</div>` : ""}</div>`; },
        key:a => {
          const n = MODEL_MODES.length;
          if(a === "cmd:left") cur = (cur - 1 + n) % n;
          else if(a === "cmd:right") cur = (cur + 1) % n;
          else if(a === "cmd:up") cur = cur - cols >= 0 ? cur - cols : cur;
          else if(a === "cmd:down") cur = cur + cols < n ? cur + cols : cur;
          else if(a === "cmd:exe" || a === "cmd:ok") setMode(MODEL_MODES[cur]);
          else if(a === "cmd:ac" || a === "cmd:back" || a === "cmd:menu") pop();
          else { const m = a.match(/^ins:([1-9])$/), map = { neg:"A", dms:"B", abs:"C" };
            const ch = m ? m[1] : model === "580" ? map[c.lastKey] : null; const j = ch ? labels.indexOf(ch) : -1; if(j >= 0 && j < n) setMode(MODEL_MODES[j]); }
          return true;
        } };
    }

    /* ---------------- các chế độ ---------------- */
    function setMode(m){
      c.mode = m; c.sto = false; c.stack = []; save();
      switch(m){
        case "stat": c.stack.push(CalcScreen()); if(!c.stat.data.length) statType(); else statEditor(); break;
        case "dist": c.stack.push(Menu("Phân phối", DIST.map(d => ({ t:d.ten, f:() => distForm(d) })), { per:5, st:"DIST" })); break;
        case "table": c.stack.push(tableHome()); break;
        case "eqn": c.stack.push(eqnHome()); break;
        case "ineq": c.stack.push(Menu("Bất phương trình", [2, 3, 4].map(n => ({ t:`Bậc ${n}: ${["","","ax²+bx+c","ax³+bx²+cx+d","ax⁴+bx³+cx²+dx+e"][n]}`, f:() => ineqType(n) })))); break;
        case "ratio": c.stack.push(Menu("Tỉ lệ", [{ t:"A:B = X:D", f:() => ratioForm(1) }, { t:"A:B = C:X", f:() => ratioForm(2) }])); break;
        case "sprd": c.stack.push(Sheet()); break;
        case "box": c.stack.push(Menu("Math Box", [{ t:"Tung xúc xắc", f:() => diceForm() }, { t:"Tung đồng xu", f:() => coinForm() }, { t:"Trục số", f:() => numberLine() }, { t:"Đường tròn lượng giác", f:() => circleForm() }])); break;
        default: c.stack.push(CalcScreen());
          if(m === "mat" && !Object.keys(c.mem.mat).filter(x => x !== "Ans").length) matMenu("mat");
          if(m === "vct" && !Object.keys(c.mem.vct).filter(x => x !== "Ans").length) matMenu("vct");
      }
      render();
    }

    /* Thống kê */
    function statType(){
      push(Menu("Kiểu thống kê", Object.keys(REGS).map(t => ({ t:REGS[t].ten, f:() => { c.stat.type = t; c.stat.data = c.stat.data.map(r => ({ x:r.x, y:t === "1v" ? null : r.y, f:r.f })); save(); c.stack.length = 1; statEditor(); } })), { per:4 }));
    }
    function statEditor(){
      const two = c.stat.type !== "1v", cols = ["x"].concat(two ? ["y"] : [], c.S.freq ? ["Tần số"] : []);
      const data = c.stat.data.map(r => [r.x, ...(two ? [r.y] : []), ...(c.S.freq ? [r.f == null ? 1 : r.f] : [])]);
      const sync = () => { c.stat.data = data.filter(r => r.some(v => v != null)).map(r => ({ x:r[0], y:two ? r[1] : null, f:c.S.freq ? r[cols.length - 1] : null })); save(); };
      push(Grid({ title:REGS[c.stat.type].ten, cols, data, grow:true, max:two ? 80 : 160, onChange:sync, onAC:() => { sync(); c.stack.length = 1; render(); }, optn:statMenu, st:"STAT" }));
    }
    function statResults(){
      try{
        const o = statCalc(c.stat, c.S); if(!o) K.err("math");
        const S0 = S(), f = v => v == null ? "—" : numHTML(v, { ...S0, io:"dec" });
        const rows = [["x̄", f(o.mx)], ["Σx", f(o.Sx)], ["Σx²", f(o.Sx2)], ["σ²x", f(o.ox*o.ox)], ["σx", f(o.ox)], ["s²x", o.sx == null ? "—" : f(o.sx*o.sx)], ["sx", f(o.sx)], ["n", f(o.n)]];
        if(c.stat.type === "1v") rows.push(["min(x)", f(o.minX)], ["Q₁", f(o.q1)], ["Med", f(o.med)], ["Q₃", f(o.q3)], ["max(x)", f(o.maxX)]);
        else rows.push(["ȳ", f(o.my)], ["Σy", f(o.Sy)], ["Σy²", f(o.Sy2)], ["Σxy", f(o.Sxy)], ["σy", f(o.oy)], ["sy", f(o.sy)], ["min(x)", f(o.minX)], ["max(x)", f(o.maxX)], ["min(y)", f(o.minY)], ["max(y)", f(o.maxY)]);
        push(Results(c.stat.type === "1v" ? "Thống kê 1 biến" : "Thống kê 2 biến", rows, { per:4 }));
      }catch(e){ showErr(e); }
    }
    function regResults(){
      try{
        const o = statCalc(c.stat, c.S); if(!o || c.stat.type === "1v") K.err("math");
        const f = v => numHTML(v, { ...S(), io:"dec" }), rows = [["a", f(o.a)], ["b", f(o.b)]];
        if(c.stat.type === "quad") rows.push(["c", f(o.c)]); else rows.push(["r", f(o.r)]);
        push(Results(REGS[c.stat.type].ten, rows, { per:4 }));
      }catch(e){ showErr(e); }
    }
    function statMenu(){
      const T = model === "580" ? "OPTN" : "TOOLS", two = c.stat.type !== "1v";
      const items = [
        { t:"Chọn kiểu thống kê", f:() => { c.stack.pop(); statType(); } },
        { t:"Dữ liệu", f:() => { c.stack.length = 1; statEditor(); } },
        { t:two ? "Tính thống kê 2 biến" : "Tính thống kê 1 biến", f:() => { c.stack.pop(); statResults(); } }
      ];
      if(two) items.push({ t:"Tính hồi quy", f:() => { c.stack.pop(); regResults(); } });
      items.push({ t:"Biến thống kê (chèn)", f:() => { c.stack.length = 1; insList("Biến thống kê", [["n","st:n"],["x̄","st:mx"],["Σx","st:Sx"],["Σx²","st:Sx2"],["σx","st:ox"],["sx","st:sx"],["min(x)","st:minX"],["max(x)","st:maxX"],
        ...(two ? [["ȳ","st:my"],["Σy","st:Sy"],["Σy²","st:Sy2"],["Σxy","st:Sxy"],["σy","st:oy"],["sy","st:sy"]] : [["Q₁","st:q1"],["Med","st:med"],["Q₃","st:q3"]])])(); } });
      if(two) items.push({ t:"Hồi quy (a, b, r, ŷ, x̂)", f:() => { c.stack.length = 1; insList("Hồi quy", [["a","st:a"],["b","st:b"],...(c.stat.type === "quad" ? [["c","st:c"],["x̂₁","xhat1"],["x̂₂","xhat2"]] : [["r","st:r"],["x̂","xhat"]]),["ŷ","yhat"]])(); } });
      items.push({ t:"Xóa toàn bộ dữ liệu", f:() => { c.stat.data = []; save(); c.stack.length = 1; statEditor(); } });
      push(Menu(T, items, { per:5 }));
    }

    /* Phân phối */
    const distMem = {};
    function distForm(d){
      const vals = distMem[d.id] || {};
      const fields = d.f.map(([lab, dv]) => lab === "Đuôi" ? { label:lab, kind:"choice", opts:["Trái","Phải","Giữa"], val:vals[lab] || dv } : { label:lab, val:vals[lab] != null ? vals[lab] : dv });
      push(Form(d.ten, fields, v => {
        distMem[d.id] = v;
        const r = d.tinh(v);
        const rows = Array.isArray(r) ? [["x₁Inv", numHTML(r[0], { ...S(), io:"dec" })], ["x₂Inv", numHTML(r[1], { ...S(), io:"dec" })]] : [[d.kq, numHTML(r, { ...S(), io:"dec" })]];
        if(!Array.isArray(r)){ c.mem.preans = c.mem.ans; c.mem.ans = r; save(); }
        push(Results(d.ten, rows));
      }, { st:"DIST" }));
    }

    /* Bảng giá trị */
    function tableHome(){
      return Menu("Bảng giá trị", [
        { t:"Định nghĩa f(x), g(x)", f:() => tableDefine() },
        { t:"Khoảng bảng & tạo bảng", f:() => tableRange() }
      ]);
    }
    function tableDefine(next){
      push(Form("f(x), g(x) (g có thể bỏ trống)", [{ label:"f(x)=", key:"f", kind:"expr", toks:c.fn.f }, { label:"g(x)=", key:"g", kind:"expr", toks:c.fn.g, optional:true }], v => {
        c.fn.f = v.f || []; c.fn.g = v.g || []; save(); c.stack.pop(); if(next !== false) tableRange(); else render();
      }));
    }
    function tableSetup(){ push(Menu(model === "580" ? "OPTN" : "TOOLS", [{ t:"Định nghĩa f(x), g(x)", f:() => { c.stack.pop(); tableDefine(); } }, { t:"Khoảng bảng", f:() => { c.stack.pop(); tableRange(); } }])); }
    function tableRange(){
      if(!c.fn.f.length) return tableDefine();
      push(Form("Khoảng bảng", [{ label:"Bắt đầu", key:"start", val:c.tbl.start }, { label:"Kết thúc", key:"end", val:c.tbl.end }, { label:"Bước", key:"step", val:c.tbl.step }], v => {
        if(v.step === 0 || (v.end - v.start)/v.step < 0) K.err("math");
        const both = c.fn.g.length > 0, n = Math.floor((v.end - v.start)/v.step + 1e-9) + 1;
        if(n > (both ? 30 : 45)) K.err("range");
        c.tbl = v; save();
        const rows = [];
        for(let i = 0; i < n; i++){ const x = K.nearInt(+(v.start + i*v.step).toPrecision(12)); const cell = toks => { try{ return evalNum(toks, { bind:{ x } }); }catch(e){ return "ERROR"; } };
          rows.push([x, cell(c.fn.f), both ? cell(c.fn.g) : null]); }
        c.stack.pop(); push(TableView(rows, both));
      }));
    }
    function TableView(rows, both){
      let r = 0, col = 0, t0 = 0;
      const cols = both ? 3 : 2, names = ["x","f(x)","g(x)"];
      return { st:"TABLE", html:() => {
          const v = rows[r][col];
          return `<div class="lgrid ltbl"><table><tr><th></th>${names.slice(0, cols).map(n => `<th>${n}</th>`).join("")}</tr>${rows.slice(t0, t0 + 3).map((row, i) => `<tr><th>${t0 + i + 1}</th>${row.slice(0, cols).map((x, j) => `<td class="${t0 + i === r && j === col ? "on" : ""}">${typeof x === "number" ? esc(shortNum(x, c.S)) : x}</td>`).join("")}</tr>`).join("")}</table>
            <div class="lgv">${typeof v === "number" ? numHTML(v, S(), null) : v}</div></div>`; },
        key:a => {
          if(a === "cmd:up") r = Math.max(0, r - 1); else if(a === "cmd:down") r = Math.min(rows.length - 1, r + 1);
          else if(a === "cmd:left") col = Math.max(0, col - 1); else if(a === "cmd:right") col = Math.min(cols - 1, col + 1);
          else if(a === "cmd:ac" || a === "cmd:back" || a === "cmd:exe" || a === "cmd:ok"){ pop(); return true; }
          else if(a === "cmd:optn"){ tableSetup(); return true; }
          if(r < t0) t0 = r; if(r >= t0 + 3) t0 = r - 2; return true;
        } };
    }

    /* Phương trình */
    function eqnHome(){
      const items = [
        { t:"Hệ phương trình bậc nhất", f:() => push(Menu("Số ẩn", [2, 3, 4].map(n => ({ t:`${n} ẩn`, f:() => { c.stack.pop(); simulEditor(n); } })))) },
        { t:"Phương trình đa thức", f:() => push(Menu("Bậc", [2, 3, 4].map(n => ({ t:`Bậc ${n}: ${["","","ax²+bx+c","ax³+bx²+cx+d","ax⁴+bx³+cx²+dx+e"][n]}`, f:() => { c.stack.pop(); polyEditor(n); } })))) }
      ];
      if(model === "880") items.push({ t:"Solver (giải phương trình bất kì)", f:() => solverForm() });
      return Menu("Phương trình", items);
    }
    const eqnMem = {};
    function simulEditor(n){
      const L = ["x","y","z","t"].slice(0, n), cols = [...["a","b","c","d"].slice(0, n), "hệ số tự do"];
      const data = eqnMem["s" + n] || Array.from({length:n}, () => Array(n + 1).fill(0)); eqnMem["s" + n] = data;
      push(Grid({ title:`Hệ ${n} ẩn: ${L.join(", ")}`, cols, rows:n, data, st:"EQN", onExe:() => {
        const A = data.map(r => r.map(v => v || 0));
        const sol = gauss(A.map(r => r.slice()));
        if(!sol){ // vô nghiệm hay vô số nghiệm: so hạng ma trận
          const rk = M => { const m = K.minv ? null : null; void m; const R = M.map(r => r.slice()); let rank = 0; const cn = R[0].length;
            for(let col2 = 0; col2 < cn && rank < R.length; col2++){ let p = rank; for(let i = rank; i < R.length; i++) if(Math.abs(R[i][col2]) > Math.abs(R[p][col2])) p = i; if(Math.abs(R[p][col2]) < 1e-10) continue; [R[p], R[rank]] = [R[rank], R[p]];
              for(let i = 0; i < R.length; i++) if(i !== rank){ const f = R[i][col2]/R[rank][col2]; for(let j = col2; j < cn; j++) R[i][j] -= f*R[rank][j]; } rank++; } return rank; };
          const r1 = rk(A.map(r => r.slice(0, n))), r2 = rk(A);
          return push(Info("", `<p class="lbig">${r1 < r2 ? "Vô nghiệm" : "Vô số nghiệm"}</p><small>${r1 < r2 ? "No Solution" : "Infinite Solution"}</small>`));
        }
        push(Results(`Nghiệm hệ ${n} ẩn`, sol.map((v, i) => [L[i], numHTML(v, S(), null)]), { per:4 }));
      } }));
    }
    function polyEditor(n){
      const cols = ["a","b","c","d","e"].slice(0, n + 1);
      const data = eqnMem["p" + n] || [Array(n + 1).fill(0)]; eqnMem["p" + n] = data;
      push(Grid({ title:["","","ax²+bx+c=0","ax³+bx²+cx+d=0","ax⁴+bx³+cx²+dx+e=0"][n], cols, rows:1, data, st:"EQN", onExe:() => polySolve(data[0].map(v => v || 0)) }));
    }
    function rootHTML(z){ return K.isC(z) ? cxHTML(new K.Cx(K.nearInt(z.re), K.nearInt(z.im)), { ...S(), cplx:"rect" }, null) : numHTML(z, S(), null); }
    function quadExact(a, b, cc){
      const D = b*b - 4*a*cc;
      const p = K.exactOf(-b/(2*a)), q = K.exactOf(Math.sqrt(Math.abs(D))/(2*Math.abs(a)));
      if(!p || !q || q.t !== "surd" || (p.t !== "int" && p.t !== "frac")) return null;
      if(D <= 0) return null;
      const pp = p.t === "int" ? p.v : p.p, pq = p.t === "int" ? 1 : p.q, L = pq*q.q/K.gcd(pq, q.q), A = pp*L/pq, B = q.a*L/q.q;
      const sgn = a > 0 ? 1 : -1;
      const term = sg => `${A !== 0 ? neg(String(A)) : ""}${sg < 0 ? "−" : (A !== 0 ? "+" : "")}${B !== 1 ? B : ""}<span class="rt">√<span>${q.b}</span></span>`;
      const wrap = h => L === 1 ? h : fr(h, L);
      return [wrap(term(sgn)), wrap(term(-sgn))];
    }
    function polySolve(co){
      if(co[0] === 0) K.err("math");
      const n = co.length - 1;
      let roots = K.polyRoots(co);
      const re = roots.filter(z => !K.isC(z)).sort((x, y) => y - x), im = roots.filter(z => K.isC(z)).sort((x, y) => y.im - x.im);
      roots = re.concat(im);
      let html = roots.map(rootHTML);
      if(n === 2){ const ex = quadExact(co[0], co[1], co[2]); if(ex && !roots.some(K.isC)) html = ex; }
      const rows = roots.map((_, i) => [`x${"₁₂₃₄"[i]}`, html[i]]);
      if(n === 2){ const xv = -co[1]/(2*co[0]), yv = co[2] - co[1]*co[1]/(4*co[0]); const mm = co[0] > 0 ? "cực tiểu" : "cực đại"; rows.push([`x ${mm}`, numHTML(xv, S(), null)], [`y ${mm}`, numHTML(K.nearInt(yv), S(), null)]); }
      if(n === 3){ const A = 3*co[0], B = 2*co[1], C = co[2], D = B*B - 4*A*C;
        if(D > 0){ const x1 = (-B - Math.sqrt(D))/(2*A), x2 = (-B + Math.sqrt(D))/(2*A), f = x => ((co[0]*x + co[1])*x + co[2])*x + co[3];
          const [xmax, xmin] = co[0] > 0 ? [Math.min(x1, x2), Math.max(x1, x2)] : [Math.max(x1, x2), Math.min(x1, x2)];
          rows.push(["x cực đại", numHTML(K.nearInt(xmax), S(), null)], ["y cực đại", numHTML(K.nearInt(f(xmax)), S(), null)], ["x cực tiểu", numHTML(K.nearInt(xmin), S(), null)], ["y cực tiểu", numHTML(K.nearInt(f(xmin)), S(), null)]); } }
      push(Results("Nghiệm", rows, { per:3 }));
    }
    function solverForm(){
      push(Form("Solver: nhập phương trình chứa x", [{ label:"", key:"eq", kind:"expr", toks:eqnMem.solver || [] }, { label:"x (giá trị đầu)", key:"x0", val:c.mem.vars.x }], v => {
        const toks = v.eq || []; eqnMem.solver = toks;
        if(!toks.includes("x")) K.err("var");
        const i = toks.indexOf("eq"), L = i >= 0 ? toks.slice(0, i) : toks, R = i >= 0 ? toks.slice(i + 1) : ["0"];
        const f = x => evalNum(L, { bind:{ x } }) - evalNum(R, { bind:{ x } });
        const x = K.solve1(f, v.x0 || 0); c.mem.vars.x = x; save();
        push(Results("Solver", [["x", numHTML(x, S(), null)], ["L−R", decHTML(f(x), S())]]));
      }));
    }

    /* Bất phương trình */
    function ineqType(n){
      const P = ["","","ax²+bx+c","ax³+bx²+cx+d","ax⁴+bx³+cx²+dx+e"][n];
      push(Menu("Dạng", [["> 0","gt"],["< 0","lt"],["≥ 0","ge"],["≤ 0","le"]].map(([t, op]) => ({ t:P + t, f:() => { c.stack.pop(); ineqEditor(n, op, P + t); } }))));
    }
    function ineqEditor(n, op, title){
      const cols = ["a","b","c","d","e"].slice(0, n + 1), data = [Array(n + 1).fill(0)];
      push(Grid({ title, cols, rows:1, data, st:"INEQ", onExe:() => {
        const co = data[0].map(v => v || 0); if(co[0] === 0) K.err("math");
        const P = x => co.reduce((s, k2) => s*x + k2, 0);
        const rts = [...new Set(K.polyRoots(co).filter(z => !K.isC(z)).map(z => +z.toPrecision(13)))].sort((x, y) => x - y);
        const ok = x => { const v = P(x); return op === "gt" ? v > 0 : op === "lt" ? v < 0 : op === "ge" ? v >= 0 : v <= 0; };
        const strict = op === "gt" || op === "lt";
        const pts = []; // xen kẽ: khoảng 0, nghiệm 0, khoảng 1, …
        const mids = rts.length ? [rts[0] - 1, ...rts.slice(1).map((r, i) => (r + rts[i])/2), rts[rts.length - 1] + 1] : [0];
        mids.forEach((m, i) => { pts.push({ in:ok(m), k:"I" }); if(i < rts.length) pts.push({ in:!strict, k:"R", v:rts[i] }); });
        const runs = []; let cur = null;
        pts.forEach((p, i) => { if(p.in){ if(!cur) cur = { s:i }; cur.e = i; } else if(cur){ runs.push(cur); cur = null; } }); if(cur) runs.push(cur);
        const H = v => numHTML(v, S(), null), LT = { "<":"&lt;", "≤":"≤" };
        let out;
        if(!runs.length) out = "Vô nghiệm <small>(No-Solution)</small>";
        else if(runs.length === 1 && runs[0].s === 0 && runs[0].e === pts.length - 1) out = "Mọi số thực <small>(All Real Numbers)</small>";
        else out = runs.map(r => {
          const a = pts[r.s], b = pts[r.e];
          if(a.k === "R" && r.s === r.e) return `x=${H(a.v)}`;
          const lo = r.s === 0 ? null : (a.k === "R" ? [a.v, "≤"] : [pts[r.s - 1].v, "<"]);
          const hi = r.e === pts.length - 1 ? null : (b.k === "R" ? [b.v, "≤"] : [pts[r.e + 1].v, "<"]);
          return `${lo ? H(lo[0]) + LT[lo[1]] : ""}x${hi ? LT[hi[1]] + H(hi[0]) : ""}`;
        }).join(", ");
        push(Info(title, `<div class="lineq">${out}</div>`));
      } }));
    }

    /* Tỉ lệ */
    function ratioForm(t){
      const f = t === 1 ? [["A",1],["B",1],["D",1]] : [["A",1],["B",1],["C",1]];
      push(Form(t === 1 ? "A:B = X:D" : "A:B = C:X", f.map(([l, v]) => ({ label:l, val:v })), v => {
        let X; if(t === 1){ if(!v.B) K.err("math"); X = v.A*v.D/v.B; } else { if(!v.A) K.err("math"); X = v.B*v.C/v.A; }
        c.mem.preans = c.mem.ans; c.mem.ans = X; save();
        push(Results(t === 1 ? "A:B = X:D" : "A:B = C:X", [["X", numHTML(X, S(), null)]]));
      }, { st:"RATIO" }));
    }

    /* Bảng tính (880) – 5 cột A–E × 45 hàng */
    function sheetVal(ref, seen){
      const cell = c.sheet[ref]; if(!cell) return 0;
      if(!cell.f) return cell.v;
      if(seen.has(ref)) K.err("circ");
      seen.add(ref);
      const v = evalNum(cell.t.slice(1), { cell:r => sheetVal(r, seen), range:args => sheetRange(args, seen) });
      seen.delete(ref); return v;
    }
    function sheetRange(args, seen){
      const out = [];
      args.forEach(a => {
        if(a.n === "bin" && a.op === "colon" && a.a.n === "cell" && a.b.n === "cell"){
          const [c1, r1] = [a.a.v.charCodeAt(0), +a.a.v.slice(1)], [c2, r2] = [a.b.v.charCodeAt(0), +a.b.v.slice(1)];
          for(let cc = Math.min(c1, c2); cc <= Math.max(c1, c2); cc++) for(let rr = Math.min(r1, r2); rr <= Math.max(r1, r2); rr++){ const ref = String.fromCharCode(cc) + rr; if(c.sheet[ref]) out.push(sheetVal(ref, seen)); }
        } else out.push(K.num(K.ev(a, env({ cell:r => sheetVal(r, seen), range:x => sheetRange(x, seen) }))));
      });
      return out;
    }
    function Sheet(){
      let r = 1, col = 0, t0 = 1, ed = null;
      const ref = () => "ABCDE"[col] + r;
      const show = rf => { const cell = c.sheet[rf]; if(!cell) return ""; try{ return esc(shortNum(cell.f ? sheetVal(rf, new Set()) : cell.v, c.S)); }catch(e){ return "ERR"; } };
      const s = { st:"SHEET", html:() => {
          const cell = c.sheet[ref()];
          let bottom = ed ? ed.html(true) : cell ? (cell.f ? esc(tokStr(cell.t)) : esc(shortNum(cell.v, c.S))) : "&nbsp;";
          return `<div class="lgrid lsheet"><table><tr><th></th>${"ABCDE".split("").map(L => `<th>${L}</th>`).join("")}</tr>${[0,1,2].map(i => { const rr = t0 + i; return `<tr><th>${rr}</th>${"ABCDE".split("").map((L, j) => `<td class="${rr === r && j === col ? "on" : ""}">${show(L + rr)}</td>`).join("")}</tr>`; }).join("")}</table><div class="lgv"><small>${ref()}</small> ${bottom}</div></div>`; },
        key:a => {
          if(a.startsWith("ins:")){ let t = a.slice(4); if(!ed){ ed = new Ed(); if(t === "eq") t = "ssEq"; } ed.ins(t); return true; }
          if(a === "cmd:del"){ if(ed) ed.del(); else { delete c.sheet[ref()]; save(); } return true; }
          if(a === "cmd:exe" || a === "cmd:ok"){
            if(!ed){ r = Math.min(45, r + 1); if(r >= t0 + 3) t0 = r - 2; return true; }
            const t = ed.t.slice();
            try{
              if(t[0] === "ssEq"){ c.sheet[ref()] = { f:true, t }; sheetVal(ref(), new Set()); }
              else if(t.length) c.sheet[ref()] = { f:false, v:evalNum(t) };
              ed = null; save(); r = Math.min(45, r + 1); if(r >= t0 + 3) t0 = r - 2;
            }catch(e){ if(t[0] === "ssEq" && e.calc === "circ") delete c.sheet[ref()]; showErr(e); }
            return true;
          }
          if(ed && (a === "cmd:left" || a === "cmd:right")){ a === "cmd:left" ? ed.left() : ed.right(); return true; }
          if(a === "cmd:up"){ ed = null; r = Math.max(1, r - 1); } else if(a === "cmd:down"){ ed = null; r = Math.min(45, r + 1); }
          else if(a === "cmd:left"){ col = Math.max(0, col - 1); } else if(a === "cmd:right"){ col = Math.min(4, col + 1); }
          else if(a === "cmd:ac"){ ed = null; return true; }
          else if(a === "cmd:optn"){ sheetMenu(); return true; }
          else return false;
          if(r < t0) t0 = r; if(r >= t0 + 3) t0 = r - 2; return true;
        } };
      return s;
    }
    function sheetMenu(){
      push(Menu("TOOLS – Bảng tính", [
        { t:"Bắt đầu công thức (=)", f:insert("eq") }, { t:"Sum( – tổng", f:insert("Sum(") }, { t:"Mean( – trung bình", f:insert("Mean(") }, { t:"Min(", f:insert("Min(") }, { t:"Max(", f:insert("Max(") },
        { t:"Dấu : (khoảng ô, ví dụ A1:A5)", f:insert("colon") },
        ...["A","B","C","D","E_"].map(L => ({ t:"Cột " + varLabel(L), f:insert(L) })),
        { t:"Xóa toàn bộ bảng tính", f:() => { c.sheet = {}; save(); c.stack.pop(); render(); } }
      ], { per:5 }));
    }

    /* Math Box (880) */
    function diceForm(){
      push(Form("Tung xúc xắc", [{ label:"Số xúc xắc (1~3)", key:"n", val:1 }, { label:"Số lần tung (1~250)", key:"t", val:20 }], v => {
        if(![1,2,3].includes(v.n) || !Number.isInteger(v.t) || v.t < 1 || v.t > 250) K.err("arg");
        const res = Array.from({length:v.t}, () => Array.from({length:v.n}, () => 1 + Math.floor(Math.random()*6)));
        boxResult("Xúc xắc", res, r => r.reduce((a, b) => a + b, 0), v.n, v.n*6, v.n > 1 ? "Tổng" : "Mặt");
      }, { st:"BOX" }));
    }
    function coinForm(){
      push(Form("Tung đồng xu", [{ label:"Số đồng xu (1~3)", key:"n", val:1 }, { label:"Số lần tung (1~250)", key:"t", val:20 }], v => {
        if(![1,2,3].includes(v.n) || !Number.isInteger(v.t) || v.t < 1 || v.t > 250) K.err("arg");
        const res = Array.from({length:v.t}, () => Array.from({length:v.n}, () => Math.random() < 0.5 ? 1 : 0));
        boxResult("Đồng xu", res, r => r.reduce((a, b) => a + b, 0), 0, v.n, "Số mặt ngửa");
      }, { st:"BOX" }));
    }
    function boxResult(title, res, agg, lo, hi, lab){
      const cnt = {}; for(let k2 = lo; k2 <= hi; k2++) cnt[k2] = 0; res.forEach(r => cnt[agg(r)]++);
      const rows = Object.keys(cnt).map(k2 => [`${lab} ${k2}`, `${cnt[k2]} lần · ${(cnt[k2]/res.length).toFixed(3).replace(/\.?0+$/, "") || "0"}`]);
      const list = res.map((r, i) => [`Lần ${i + 1}`, title === "Đồng xu" ? r.map(x => x ? "N" : "S").join(" ") + ` (${agg(r)})` : r.join("+") + (r.length > 1 ? ` = ${agg(r)}` : "")]);
      push(Results(`${title}: tần suất tương đối`, rows.concat([["—", "<small>Kết quả từng lần (N: ngửa, S: sấp)</small>"]], list), { per:4, st:"BOX" }));
    }
    function numberLine(){
      push(Form("Trục số: tối đa 3 quan hệ, ví dụ x>2", [1, 2, 3].map(i => ({ label:`(${i})`, key:"r" + i, kind:"expr", toks:[], optional:true })), v => {
        const rels = ["r1","r2","r3"].map(k2 => v[k2]).filter(t => t && t.length).map(t => {
          const i = t.findIndex(x => ["eq","ne","gt","lt","ge","le"].includes(x)); if(i !== 1 || t[0] !== "x") K.err("syntax");
          return { op:t[1], v:evalNum(t.slice(2)) }; });
        if(!rels.length) K.err("arg");
        const xs = rels.map(r => r.v), lo = Math.min(...xs), hi = Math.max(...xs), span = Math.max(4, hi - lo), a = lo - span*0.4, b = hi + span*0.4, X = x => 10 + (x - a)/(b - a)*180;
        const svg = `<svg viewBox="0 0 200 ${30 + rels.length*16}" class="lsvg"><line x1="6" y1="${18 + rels.length*16}" x2="196" y2="${18 + rels.length*16}" stroke="currentColor" stroke-width="1"/>${xs.map(x => `<text x="${X(x)}" y="${28 + rels.length*16}" font-size="8" text-anchor="middle">${esc(shortNum(x, c.S))}</text><line x1="${X(x)}" y1="${15 + rels.length*16}" x2="${X(x)}" y2="${21 + rels.length*16}" stroke="currentColor"/>`).join("")}
          ${rels.map((r, i) => { const y = 10 + i*16, x = X(r.v), filled = ["eq","ge","le"].includes(r.op);
            const seg = r.op === "gt" || r.op === "ge" ? `<line x1="${x}" y1="${y}" x2="196" y2="${y}" stroke="currentColor" stroke-width="2"/><path d="M196 ${y}l-5-3v6z"/>` : r.op === "lt" || r.op === "le" ? `<line x1="6" y1="${y}" x2="${x}" y2="${y}" stroke="currentColor" stroke-width="2"/><path d="M6 ${y}l5-3v6z"/>` : r.op === "ne" ? `<line x1="6" y1="${y}" x2="196" y2="${y}" stroke="currentColor" stroke-width="2"/>` : "";
            return `${seg}<circle cx="${x}" cy="${y}" r="3.2" fill="${filled ? "currentColor" : "var(--lcd)"}" stroke="currentColor" stroke-width="1.4"/><text x="2" y="${y + 3}" font-size="7">(${i + 1})</text>`; }).join("")}</svg>`;
        push(Info("Trục số", svg));
      }, { st:"BOX" }));
    }
    function circleForm(){
      push(Form("Đường tròn lượng giác", [{ label:"Góc θ", key:"t", val:30 }], v => {
        const S0 = S(), t = v.t, r = K.trig("cos", t, S0), s = K.trig("sin", t, S0);
        let tn; try{ tn = numHTML(K.trig("tan", t, S0), S0, null); }catch(e){ tn = "không xác định"; }
        const X = 50 + 34*r, Y = 50 - 34*s, rad = t*(S0.ang === "D" ? Math.PI/180 : S0.ang === "G" ? Math.PI/200 : 1);
        const large = ((rad % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI) > Math.PI ? 1 : 0;
        const svg = `<svg viewBox="0 0 100 100" class="lsvg lcirc"><line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" stroke-width=".6"/><line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" stroke-width=".6"/><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="1"/>
          <path d="M60 50 A10 10 0 ${large} 0 ${50 + 10*r} ${50 - 10*s}" fill="none" stroke="currentColor" stroke-width="1"/><line x1="50" y1="50" x2="${X}" y2="${Y}" stroke="currentColor" stroke-width="1.4"/>
          <line x1="${X}" y1="${Y}" x2="${X}" y2="50" stroke="currentColor" stroke-dasharray="2 1.5" stroke-width=".8"/><line x1="${X}" y1="${Y}" x2="50" y2="${Y}" stroke="currentColor" stroke-dasharray="2 1.5" stroke-width=".8"/><circle cx="${X}" cy="${Y}" r="2.2"/></svg>`;
        push(Info("", `<div class="lcircw">${svg}<div class="lcv"><div>θ=${numHTML(t, S0, null)}${S0.ang === "D" ? "°" : ""}</div><div>sin θ=${numHTML(s, S0, null)}</div><div>cos θ=${numHTML(r, S0, null)}</div><div>tan θ=${tn}</div></div></div>`));
      }, { st:"BOX" }));
    }

    /* ---------------- hiển thị ---------------- */
    function render(){
      if(c.off){ lst.innerHTML = ""; lbody.innerHTML = ""; el.classList.add("off"); return; }
      el.classList.remove("off");
      const sc = top(), ang = { D:"D", R:"R", G:"G" }[c.S.ang];
      const tags = [];
      if(c.shift) tags.push(`<b class="t-s">S</b>`);
      if(c.alpha) tags.push(`<b class="t-a">A</b>`);
      if(c.mem.vars.M) tags.push("M");
      if(c.sto) tags.push("STO");
      const mt = (sc && sc.st) || MODES[c.mode].st; if(mt) tags.push(mt);
      if(c.mode === "base") tags.push(BASE_NAME[c.base]);
      tags.push(ang);
      if(c.S.fmt.t !== "norm") tags.push(c.S.fmt.t === "fix" ? "FIX" : "SCI");
      if(c.S.io === "math") tags.push("Math▲");
      lst.innerHTML = tags.map(t => `<span>${t}</span>`).join("");
      lbody.innerHTML = sc ? sc.html() : "";
      el.querySelectorAll(".ck").forEach(b => b.classList.toggle("lit", (b.dataset.k === "shift" && c.shift) || (b.dataset.k === "alpha" && c.alpha)));
      el.classList.toggle("bn", c.mode === "base");
      el.classList.toggle("cx", c.mode === "cplx");
    }

    /* ---------------- xử lý phím ---------------- */
    function actionFor(id){
      const kd = KD[id];
      if(!kd){ return "cmd:" + id; }
      if(c.mode === "base" && model === "580" && !c.shift && !c.alpha){
        if(BASE_SET[id] != null) return "base:" + BASE_SET[id];
        if(BASE_LETTER[model][id]) return "ins:" + BASE_LETTER[model][id];
      }
      if(c.mode === "base" && model === "880" && c.shift && BASE_LETTER[model][id]) return "ins:" + BASE_LETTER[model][id];
      if(c.mode === "cplx" && !c.shift && !c.alpha && model === "580" && id === "eng") return "ins:i";
      if(c.sto && model === "580" && kd.aa && /^ins:(A|B|C|D|E_|F|x|y|z|M)$/.test(kd.aa)) return kd.aa;
      if(c.shift && kd.sa) return kd.sa;
      if(c.alpha && kd.aa) return kd.aa;
      return kd.a;
    }
    function press(id){
      if(c.off){ if(id === "on"){ c.off = false; setMode(c.mode); } return; }
      c.lastKey = id;
      let a = actionFor(id);
      const wasShift = c.shift, wasAlpha = c.alpha;
      if(a === "mod:shift"){ c.shift = !c.shift; c.alpha = false; render(); return; }
      if(a === "mod:alpha"){ c.alpha = !c.alpha; c.shift = false; render(); return; }
      c.shift = false; c.alpha = false;
      if(a === "cmd:ok" && model === "880") a = "cmd:exe";
      void wasShift; void wasAlpha;
      try{
        if(a === "cmd:on"){ c.sto = false; setMode(c.mode); return; }
        if(a === "cmd:off"){ c.off = true; render(); return; }
        if(a === "cmd:pgup" || a === "cmd:pgdn"){ const sc = top(); for(let k2 = 0; k2 < 4; k2++) sc && sc.key && sc.key(a === "cmd:pgup" ? "cmd:up" : "cmd:down"); render(); return; }
        if(a === "cmd:qr"){ push(Info("QR", "<p>Máy thật tạo mã QR để xem màn hình trên điện thoại. Bản mô phỏng chạy ngay trên web nên không cần mã QR.</p><small>[AC]</small>")); return; }
        if(a === "cmd:ins"){ return; }
        if(a === "cmd:menu"){ if(top() && top().lhome) pop(); else { const h = Home(); h.lhome = true; push(h); } return; }
        if(a === "cmd:setup"){ setup(); return; }
        if(a === "cmd:reset"){ reset(); return; }
        if(a === "cmd:const"){ constMenu(); return; }
        if(a === "cmd:conv"){ convMenu(); return; }
        if(a === "cmd:catalog"){ catalog(); return; }
        if(a === "cmd:format"){ format(); return; }
        if(a === "cmd:rcl"){ rcl(); return; }
        if(a === "cmd:variable"){ variable(false); return; }
        if(a === "cmd:function"){ if(c.mode === "table") tableDefine(false); else push(Menu("FUNCTION", [{ t:"Định nghĩa f(x), g(x)", f:() => { c.stack.pop(); tableDefine(false); } }, { t:"Chèn f(x) hiện tại", f:() => { c.stack.pop(); const sc = top(); if(sc && sc.key && c.fn.f.length){ sc.key("ins:("); c.fn.f.forEach(t => sc.key("ins:" + t)); sc.key("ins:)"); } render(); } }])); return; }
        if(a === "cmd:sto"){ if(model === "880"){ variable(true); return; } c.sto = !c.sto; c.stoVar = null; render(); return; }
        if(a.startsWith("base:")){ const b = +a.slice(5); if(c.mode === "base"){ c.base = b; save(); } render(); return; }
        if(a === "cmd:optn"){ optn(); return; }
        if(a === "cmd:back"){ if(c.stack.length > 1){ const sc = top(); if(sc.key && sc.key("cmd:back") !== false){ render(); return; } pop(); } else { const sc = top(); sc.key && sc.key("cmd:ac"); render(); } return; }
        const sc = top();
        if(sc && sc.key){ const h = sc.key(a); if(h === false && a === "cmd:back") pop(); }
      }catch(e){ showErr(e); return; }
      render();
    }
    el.addEventListener("pointerdown", e => {
      const b = e.target.closest("[data-k]"); if(!b) return;
      e.preventDefault(); el.focus({ preventScroll:true });
      b.classList.add("down"); setTimeout(() => b.classList.remove("down"), 120);
      press(b.dataset.k);
    });
    el.addEventListener("click", e => { if(e.detail === 0){ const b = e.target.closest("[data-k]"); if(b) press(b.dataset.k); } }); // bàn phím Enter/Space trên nút
    /* gõ bằng bàn phím máy tính */
    const KB = { "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9", ".":"dot", ",":"dot", "+":"plus", "-":"minus", "*":"mul", "/":"div", "(":"lp", ")":"rp", "^":"pow",
      Enter:"exe", "=":"exe", Backspace:"del", Delete:"ac", Escape:"ac", ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right", x:"xv", s:"sin", c:"cos", t:"tan", l:"ln", r:"sqrt", p:"pi", "!":"inv" };
    el.addEventListener("keydown", e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.key === "Shift"){ return; }
      let id = KB[e.key];
      if(e.key === "!"){ c.shift = true; id = "inv"; }
      if(e.key === "p" && model === "580"){ c.shift = true; id = "exp"; }
      if(model === "880"){ if(e.key === "p"){ c.shift = true; id = "7"; } if(e.key === "l"){ c.shift = true; id = "loga"; } if(e.key === "!"){ c.shift = false; id = null; } }
      if(!id) return;
      e.preventDefault();
      if(["up","down","left","right"].includes(id)){ const sc = top(); try{ sc && sc.key && sc.key("cmd:" + id); }catch(err2){ showErr(err2); } render(); return; }
      press(id);
    });
    // nút mũi tên trên bàn phím mô phỏng
    ["up","down","left","right"].forEach(d => { if(!KD[d]) KD[d] = { id:d, a:"cmd:" + d }; });
    if(!KD.ok) KD.ok = { id:"ok", a:"cmd:ok" };

    setMode(c.mode);
    return { el, press, destroy(){ host.innerHTML = ""; }, model, get state(){ return c; } };
  }

  /* ---------------- giao diện (CSS riêng của máy tính) ---------------- */
  const CSS = `
.cw{--u:calc(100cqw/36);font-size:var(--u);width:100%;box-sizing:border-box;padding:1.1em 1.1em 1.4em;border-radius:2.2em 2.2em 3em 3em;position:relative;outline:none;user-select:none;-webkit-user-select:none;touch-action:manipulation;font-family:"Be Vietnam Pro",system-ui,sans-serif}
.cw-wrap{container-type:inline-size;width:100%}
.cw-580{background:linear-gradient(170deg,#3b4048,#23272e 40%,#1b1e24);color:#eef1f4;box-shadow:inset 0 .15em 0 rgba(255,255,255,.12),0 1.6em 3em rgba(0,0,0,.35)}
.cw:focus-visible{box-shadow:0 0 0 .3em #3DD68C,0 1.6em 3em rgba(0,0,0,.3)}
.cw-head{display:flex;align-items:center;gap:.8em;padding:.2em .6em .8em}
.cw-name{font-weight:800;font-size:1.25em;letter-spacing:.02em}
.cw-sub{font-size:.62em;opacity:.65;letter-spacing:.08em;flex:1}
.cw-sol{display:flex;gap:.12em;padding:.25em;border-radius:.35em;background:#3a2a1c}
.cw-sol i{width:1.5em;height:1.1em;background:linear-gradient(180deg,#5b4330,#2b1d12);border-radius:.12em}
.cw-880 .cw-sol{background:#2f3a42}.cw-880 .cw-sol i{background:linear-gradient(180deg,#4b5862,#262f36)}
.cw-lcd{--lcd:#c9d6c2;--ink:#1d2a22;background:var(--lcd);color:var(--ink);border-radius:.7em;border:.45em solid #15181c;box-shadow:inset 0 .3em .6em rgba(0,0,0,.25);height:14.5em;display:flex;flex-direction:column;overflow:hidden;font-family:"Be Vietnam Pro",system-ui,sans-serif}
.cw-880 .cw-lcd{--lcd:#e9eef0;--ink:#15212b;border-color:#2c3740;height:15.5em}
.cw.off .cw-lcd{background:#9fac9a}.cw-880.off .cw-lcd{background:#c9d0d3}
.lst{display:flex;gap:.55em;font-size:.78em;font-weight:700;padding:.25em .6em;min-height:1.6em;border-bottom:.08em solid rgba(0,0,0,.12)}
.lst span{opacity:.85}.lst .t-s{background:var(--ink);color:var(--lcd);padding:0 .3em;border-radius:.2em}.lst .t-a{background:#8c2b2b;color:#fff;padding:0 .3em;border-radius:.2em}
.lbody{flex:1;min-height:0;position:relative;padding:.4em .7em;font-size:1.25em;line-height:1.35;overflow:hidden}
.lcalc{height:100%;display:flex;flex-direction:column;justify-content:space-between}
.lin{font-size:.95em;word-break:break-all;max-height:3.9em;overflow:hidden}
.lin .car{display:inline-block;width:.1em;height:1.1em;vertical-align:-.15em;background:var(--ink);margin:0 -.05em;animation:cwb 1s steps(1) infinite}
.lin .er{background:var(--ink);color:var(--lcd)}
@keyframes cwb{50%{opacity:0}}
.lout{text-align:right;font-size:1.45em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:clip;max-width:100%}
.lcalc.big .lout{font-size:1.05em}
.lout small,.lineq small,.linfo small{font-size:.55em;font-weight:500;opacity:.8}
.lout .lsto{font-size:.55em}
.lbase{position:absolute;right:.7em;top:.3em;font-size:.7em;font-weight:700;opacity:.7}
.fr{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.72em;line-height:1.05;margin:0 .12em}
.fr>span:first-child{border-bottom:.09em solid currentColor;padding:0 .15em}
.rt>span{border-top:.09em solid currentColor;padding-left:.05em}
.x10{font-size:.8em}.x10 sup{font-size:.7em}
.lmat{display:inline-table;border-left:.12em solid;border-right:.12em solid;border-radius:.3em;border-collapse:separate;border-spacing:.4em .05em;font-size:.75em;vertical-align:middle}
.lmat td{text-align:right}
.lmt{font-size:.68em;font-weight:700;opacity:.75;margin-bottom:.15em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lmenu,.lform,.lres,.linfo{font-size:.82em}
.lmi{display:flex;align-items:center;gap:.5em;padding:.05em .35em;border-radius:.25em;white-space:nowrap;overflow:hidden}
.lmi .no{width:1em;font-weight:700;opacity:.7;flex:none}
.lmi .tx{flex:1;overflow:hidden;text-overflow:ellipsis}
.lmi .vv{font-size:.85em;opacity:.85;max-width:45%;overflow:hidden;text-overflow:ellipsis}
.lmi.on{background:var(--ink);color:var(--lcd)}
.lsc{position:absolute;right:.4em;bottom:.2em;font-size:.6em;opacity:.7}
.lfr,.lrr{display:flex;gap:.4em;padding:.05em .3em;border-radius:.25em;white-space:nowrap;align-items:center;overflow:hidden}
.lfr.on{background:rgba(0,0,0,.1);box-shadow:inset .2em 0 0 var(--ink)}
.lfr .lb,.lrr .lb{flex:none;font-weight:700}
.lfr .vl{flex:1;text-align:right;overflow:hidden}
.lrr .vl{flex:1;text-align:right;font-weight:600;font-size:1.05em}
.lerr{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;gap:.15em}
.lerr b{font-size:1.15em}.lerr span{font-size:.65em}.lerr small{font-size:.58em;opacity:.75;margin-top:.3em}
.lhome{display:grid;grid-template-columns:repeat(4,1fr);gap:.3em;font-size:.72em;height:100%;align-content:start}
.lhi{border:.1em solid rgba(0,0,0,.25);border-radius:.4em;height:2.6em;display:flex;align-items:center;justify-content:center;position:relative;font-weight:700}
.lhi .no{position:absolute;left:.2em;top:0;font-size:.65em;opacity:.7}
.lhi.on{background:var(--ink);color:var(--lcd)}
.lhn{grid-column:1/-1;font-weight:700;text-align:center;font-size:1.05em;margin-top:.1em}
.lgrid{font-size:.72em;display:flex;flex-direction:column;height:100%}
.lgrid table{border-collapse:collapse;width:100%;table-layout:fixed}
.lgrid th{font-size:.8em;opacity:.75;font-weight:700;width:1.6em}
.lgrid tr:first-child th{width:auto}
.lgrid td{border:.08em solid rgba(0,0,0,.3);text-align:right;padding:0 .25em;height:1.35em;white-space:nowrap;overflow:hidden}
.lgrid td.on{background:var(--ink);color:var(--lcd)}
.lgv{margin-top:auto;border-top:.08em solid rgba(0,0,0,.25);text-align:right;font-size:1.25em;padding-top:.1em;white-space:nowrap;overflow:hidden}
.lgv small{float:left;font-size:.6em;opacity:.7;margin-top:.3em}
.lsheet th{width:1.2em}
.lineq{font-size:1.1em;font-weight:600;text-align:center;margin-top:.6em;line-height:1.6}
.lbig{font-size:1.4em;font-weight:700;text-align:center;margin:.4em 0 0}
.linfo p{margin:.3em 0;text-align:center}
.lsvg{width:100%;height:auto;max-height:9em;color:var(--ink);fill:currentColor;font-family:inherit}
.lsvg text{fill:currentColor}
.lcircw{display:flex;gap:.6em;align-items:center}.lcircw .lsvg{width:42%;max-height:8.5em}.lcv{font-size:.95em;line-height:1.5}
/* bàn phím */
.cw-keys{margin-top:1em}
.ctop{display:grid;grid-template-columns:1fr 1fr 2.4fr 1fr 1fr;gap:.6em;align-items:center}
.cfn{display:grid;grid-template-columns:repeat(6,1fr);gap:1.1em .55em;margin-top:.9em}
.cbig{display:grid;grid-template-columns:repeat(5,1fr);gap:1.25em .8em;margin-top:1.3em}
.ck{position:relative;border:0;cursor:pointer;font:inherit;color:inherit;padding:0;border-radius:.6em;display:flex;align-items:center;justify-content:center;height:2.35em;font-size:1em;transition:transform .06s,filter .1s}
.ck b{font-weight:700;font-size:.82em;white-space:nowrap}
.ck-tl{position:absolute;left:0;right:0;bottom:100%;display:flex;justify-content:space-between;font-style:normal;font-size:.6em;line-height:1.1;padding:0 .05em .12em;pointer-events:none;white-space:nowrap}
.ck-tl i{font-style:normal;font-weight:700}
.ck-tl .s{color:#E8B84A}.ck-tl .a{color:#ff7b7b;margin-left:auto}.ck-tl .b{color:#5fd0c4;margin-left:auto}
.ck-tl .s+.b,.ck-tl .a+.b{display:none}
.cw.bn .ck-tl .b{display:inline}.cw.bn .ck-tl .s+.b,.cw.bn .ck-tl .a+.b{display:inline}.cw.bn .ck-tl .a{display:none}
.cw:not(.bn) .ck-tl .b{display:none}
.cw.cx .ck-eng .ck-tl .b,.cw.cx .ck-pi .ck-tl .b{display:inline;color:#ff9f43}
.cw-580 .ck{background:linear-gradient(180deg,#4b525c,#363b43);box-shadow:0 .2em 0 #15181c,inset 0 .1em 0 rgba(255,255,255,.12)}
.cw-580 .cbig .ck{background:linear-gradient(180deg,#e9ecef,#cfd4d9);color:#1b1f24;height:2.9em;box-shadow:0 .22em 0 #8b9198,inset 0 .1em 0 #fff}
.cw-580 .cbig .ck b{font-size:1.15em}
.cw-580 .ck-del,.cw-580 .ck-ac{background:linear-gradient(180deg,#d9822b,#b9651a)!important;color:#fff!important;box-shadow:0 .22em 0 #7a3f0c!important}
.cw-580 .ck-shift{background:linear-gradient(180deg,#d9a93f,#b9892a);color:#1b1f24}
.cw-580 .ck-alpha{background:linear-gradient(180deg,#c84b4b,#a03434)}
.ck-tools b,.ck-catalog b,.ck-format b,.ck-var b,.ck-func b,.ck-optn b,.ck-calc b,.ck-sto b,.ck-eng b,.ck-sd b{font-size:.62em!important}
.ck.lit{filter:brightness(1.25);outline:.18em solid currentColor;outline-offset:.08em}
.ck.down,.ck:active{transform:translateY(.16em);filter:brightness(.92)}
.ck:focus-visible{outline:.2em solid #3DD68C;outline-offset:.1em}
.cpad{position:relative;height:5em;border-radius:50%/50%;background:radial-gradient(circle at 50% 40%,#5a616b,#2d3138);box-shadow:0 .25em 0 #111,inset 0 .1em 0 rgba(255,255,255,.12)}
.cp{position:absolute;border:0;background:transparent;cursor:pointer;color:inherit;padding:0}
.cp::after{content:"";position:absolute;left:50%;top:50%;border:.42em solid transparent;transform:translate(-50%,-50%)}
.cp.up{left:30%;right:30%;top:0;height:34%}.cp.up::after{border-bottom-color:currentColor;margin-top:-.2em}
.cp.dn{left:30%;right:30%;bottom:0;height:34%}.cp.dn::after{border-top-color:currentColor;margin-top:.2em}
.cp.lf{left:0;top:25%;bottom:25%;width:30%}.cp.lf::after{border-right-color:currentColor;margin-left:-.2em}
.cp.rt{right:0;top:25%;bottom:25%;width:30%}.cp.rt::after{border-left-color:currentColor;margin-left:.2em}
.cp.ok{left:34%;right:34%;top:30%;bottom:30%;border-radius:50%;background:linear-gradient(180deg,#e9eef1,#cbd4da);font-weight:800;font-size:.75em;box-shadow:0 .15em 0 #9aa6ae}.cp.ok::after{display:none}
.cp.mid{left:0;right:0;top:44%;text-align:center;font-size:.48em;font-weight:700;opacity:.6;letter-spacing:.1em;pointer-events:none}
.cp:active{transform:scale(.94)}

/* ===== fx-880BTG: bố cục phím tròn kiểu ClassWiz CW ===== */
.cw-880{background:linear-gradient(170deg,#3b4048,#272a30 45%,#1c1e23);color:#eef1f4;box-shadow:inset 0 .15em 0 rgba(255,255,255,.1),0 1.6em 3em rgba(0,0,0,.35)}
.cw-880 .cw-sol{display:none}
.cw-880 .ctop{grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(3,3.25em);gap:.35em .4em;align-items:end;justify-items:center;margin-top:.4em}
.cw-880 .cfn{grid-template-columns:repeat(6,1fr);gap:1.25em .4em;justify-items:center;margin-top:1.4em}
.cw-880 .cbig{grid-template-columns:repeat(5,1fr);gap:1.4em .6em;justify-items:center;margin-top:1.5em}
.cw-880 .ck{width:2.75em;height:2.75em;border-radius:50%;background:radial-gradient(circle at 50% 30%,#50565f,#2e3239 70%);box-shadow:0 .18em 0 #0e0f12,inset 0 .1em 0 rgba(255,255,255,.14);color:#f3f5f7}
.cw-880 .ck b{font-size:.92em;font-weight:600}
.cw-880 .cfn .ck b{font-size:.95em}
.cw-880 .cbig .ck{width:3.45em;height:3.45em;background:radial-gradient(circle at 50% 30%,#5d636c,#3a3f47 70%)}
.cw-880 .cbig .ck b{font-size:1.45em;font-weight:500}
.cw-880 .ck-ac b,.cw-880 .ck-exe b{font-size:1.15em!important;font-weight:700!important}
.cw-880 .ck-exp b{font-size:1em!important}
.cw-880 .fmt b{font-size:.62em!important;font-weight:800!important;letter-spacing:-.02em}
.cw-880 .ck-shift{background:radial-gradient(circle at 50% 30%,#f1dc9c,#b8954a 75%);color:#3a2d10}
.cw-880 .ck.pw{width:1.9em;height:1.9em;margin-bottom:.35em;background:radial-gradient(circle at 50% 30%,#3a3e45,#1f2227)}
.cw-880 .ck.pw::after{content:"";width:.18em;height:.7em;border-radius:.1em;background:#cfd3d8;position:absolute;top:.2em;left:50%;transform:translateX(-50%)}
.cw-880 .ck.pd{width:2.5em;height:2.5em}
.cw-880 .ck.okk{width:2.6em;height:2.6em;background:radial-gradient(circle at 50% 30%,#3e434b,#25282e 70%)}
.cw-880 .ck.okk b{font-weight:800;font-size:.85em}
.cw-880 .ck.rk{width:2.4em;height:3.1em;border-radius:1.3em 1.3em .3em .3em}
.cw-880 .ck.rk2{border-radius:.3em .3em 1.3em 1.3em;align-self:start}
.cw-880 .ki{display:grid;place-items:center}
.cw-880 .ki svg{width:1.35em;height:1.35em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.cw-880 .ki svg circle{fill:currentColor;stroke:none}
.cw-880 .ck-set .ki svg circle{fill:#2e3239;stroke:currentColor;stroke-width:1.6}
.cw-880 .ck-del .ki svg{width:1.7em;height:1.7em}
.cw-880 .ck-tl{justify-content:center;font-size:.58em}
.cw-880 .ck-tl .s{color:#e2bd5d;margin-right:auto}
.cw-880 .ck-tl .cap{color:#e9ecef;font-weight:800;letter-spacing:.02em}
.cw-880 .ck-tl .s+.cap{display:none}
.cw-880 .cbig .ck-tl{font-size:.52em}
.cw-880 .ck.lit{outline-color:#e2bd5d}
`;
  let cssDone = false;
  function ensureCSS(){ if(cssDone || typeof document === "undefined") return; cssDone = true; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); }
  return { mount(host, model){ ensureCSS(); host.classList.add("cw-wrap"); return mount(host, model); }, MODES };
})();
