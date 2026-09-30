const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const MONTH_ALIASES = {
  jan: "Jan", januari: "Jan", january: "Jan",
  feb: "Feb", februari: "Feb", february: "Feb",
  mar: "Mar", maret: "Mar", march: "Mar",
  apr: "Apr", april: "Apr",
  mei: "Mei", may: "Mei",
  jun: "Jun", juni: "Jun", june: "Jun",
  jul: "Jul", juli: "Jul", july: "Jul",
  ags: "Ags", agu: "Ags", agt: "Ags", agus: "Ags", agust: "Ags", agustus: "Ags", aug: "Ags", august: "Ags",
  sep: "Sep", sept: "Sep", september: "Sep",
  okt: "Okt", oktober: "Okt", oct: "Okt", october: "Okt",
  nov: "Nov", november: "Nov", nop: "Nov", nopember: "Nov",
  des: "Des", desember: "Des", dec: "Des", december: "Des",
};

function text(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function low(v) {
  return text(v).toLowerCase();
}

function fillMerges(ws, utils) {
  for (const m of ws["!merges"] || []) {
    const top = ws[utils.encode_cell(m.s)];
    if (!top) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        const addr = utils.encode_cell({ r, c });
        if (!ws[addr] || text(ws[addr].v) === "") ws[addr] = { t: top.t, v: top.v, w: top.w };
      }
    }
  }
}

function monthOf(v) {
  const k = low(v).replace(/[.\s]/g, "");
  return MONTH_ALIASES[k] || null;
}

function detectHeader(rows) {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(low);
    const hasKpi = cells.some((c) => c.includes("indikator"));
    const hasOther = cells.some((c) => c.includes("bobot") || c === "npp" || c.startsWith("nama") || c === "jabatan");
    if (hasKpi && hasOther) return i;
  }
  return -1;
}

function mapColumns(header, sub) {
  const col = { months: {} };
  let lastMonth = null;
  const width = Math.max(header.length, sub.length);
  for (let c = 0; c < width; c++) {
    const h = low(header[c]);
    const s = low(sub[c]);
    const month = monthOf(h) || (!h && lastMonth && (s.includes("real") || s.includes("target")) ? lastMonth : null);
    if (month) {
      lastMonth = month;
      const slot = col.months[month] || (col.months[month] = {});
      if (s.includes("real")) slot.real = c;
      else if (s.includes("target")) slot.target = c;
      else if (slot.real === undefined) slot.real = c;
      else if (slot.target === undefined) slot.target = c;
      continue;
    }
    lastMonth = null;
    if (!h) continue;
    const setOnce = (key) => { if (col[key] === undefined) col[key] = c; };
    if (h.startsWith("periode")) setOnce("periode");
    else if (h === "jabatan" || h.startsWith("jabatan")) setOnce("jabatan");
    else if (h.startsWith("nama")) setOnce("nama");
    else if (h === "npp" || h.startsWith("npp")) setOnce("npp");
    else if (h.includes("unit kerja") || h.includes("unit kantor")) setOnce("unit");
    else if (h.includes("perspe")) setOnce("perspektif");
    else if (h.includes("indikator") || h === "kpi") setOnce("name");
    else if (h.includes("ukuran") || h.includes("satuan")) setOnce("ukuran");
    else if (h.includes("bobot")) setOnce("bobot");
    else if (h.includes("polar")) setOnce("polaritas");
    else if (h.includes("target")) setOnce("targetTahunan");
  }
  return col;
}

function perspectiveOf(v) {
  const p = low(v);
  if (!p || p === "*") return "";
  if (p.includes("finan") || p.includes("keuangan")) return "financial";
  if (p.includes("custom") || p.includes("pelanggan") || p.includes("nasabah")) return "customer";
  if (p.includes("internal") || p.includes("proses") || p.includes("process") || p.includes("bisnis")) return "internal_process";
  if (p.includes("learning") || p.includes("growth") || p.includes("pembelajaran")) return "learning_growth";
  return "";
}

function unitOf(v) {
  const s = low(v);
  if (!s) return "percentage";
  if (/%|persen|percent/.test(s)) return "percentage";
  if (/\brp\b|rupiah|juta|miliar|milyar/.test(s)) return "currency";
  if (/indeks|index|skor|score|composit/.test(s)) return "score";
  return "number";
}

function polarityOf(raw, name, ukuran) {
  const p = low(raw);
  if (p) {
    if (p.includes("min")) return "minimize";
    if (p.includes("fast") || p.includes("waktu")) return "faster";
    if (p.includes("range")) return "range";
    return "maximize";
  }
  const n = low(name);
  if (/\bnpl\b|cost of (credit|fund)|\bbopo\b|\bdenda\b|\bckpn\b|\bloses\b|\bloss\b/.test(n)) return "minimize";
  if (/\bhari\b/.test(low(ukuran))) return "faster";
  return "maximize";
}

export function parseNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? { n: raw, pct: false } : null;
  const s = text(raw);
  if (!s) return null;
  const m = s.match(/-?\d[\d.,]*/);
  if (!m) return null;
  let tok = m[0].replace(/[.,]+$/, "");
  const hasDot = tok.includes(".");
  const hasComma = tok.includes(",");
  if (hasDot && hasComma) {
    const dec = tok.lastIndexOf(",") > tok.lastIndexOf(".") ? "," : ".";
    tok = tok.split(dec === "," ? "." : ",").join("").replace(",", ".");
  } else if (hasComma) {
    tok = /^-?\d{1,3}(,\d{3}){2,}$/.test(tok) ? tok.replace(/,/g, "") : tok.replace(",", ".");
  } else if (hasDot && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(tok)) {
    tok = tok.replace(/\./g, "");
  }
  const n = parseFloat(tok);
  return Number.isFinite(n) ? { n, pct: s.includes("%") } : null;
}

function valueFor(raw, unit) {
  const p = parseNumber(raw);
  if (!p) return null;
  let n = p.n;
  if (unit === "percentage" && !p.pct && Math.abs(n) <= 1) n *= 100;
  return Math.round(n * 10000) / 10000;
}

function annualTarget(raw, unit) {
  if (raw === "" || raw == null) return "";
  if (typeof raw === "number") {
    const v = valueFor(raw, unit);
    return v == null ? "" : String(v);
  }
  return text(raw);
}

function parseSheet(ws, sheetName, utils, startKey) {
  fillMerges(ws, utils);
  const rows = utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: true });
  const h = detectHeader(rows);
  if (h < 0) return { entries: [], skipped: "Header (INDIKATOR KINERJA UTAMA / BOBOT) tidak ditemukan" };

  const header = rows[h] || [];
  const next = rows[h + 1] || [];
  const hasSub = next.some((v) => /realisasi|target/i.test(text(v)));
  const col = mapColumns(header, hasSub ? next : []);
  if (col.periode !== undefined) return { entries: [], skipped: "Format mutasi (kolom PERIODE) belum didukung di layar ini" };
  if (col.name === undefined) return { entries: [], skipped: "Kolom INDIKATOR KINERJA UTAMA tidak ditemukan" };
  if (col.nama === undefined && col.npp === undefined) return { entries: [], skipped: "Kolom NAMA / NPP tidak ditemukan" };

  const get = (row, key) => (col[key] === undefined ? "" : row[col[key]]);
  const entries = [];
  let cur = null;
  let persp = "";

  for (let i = h + (hasSub ? 2 : 1); i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.every((v) => text(v) === "")) {
      cur = null;
      persp = "";
      continue;
    }
    const name = text(get(row, "name"));
    const perspCell = text(get(row, "perspektif"));
    if (/^kolom\b/i.test(perspCell) || name.startsWith(":")) continue;

    const nama = text(get(row, "nama"));
    const npp = text(get(row, "npp")).replace(/^npp\s*[.:\-]?\s*/i, "");
    const jabatan = text(get(row, "jabatan"));
    const unit = text(get(row, "unit"));
    const newIdentity = (npp || nama) && (!cur || (npp ? npp !== cur.npp : nama !== cur.nama));
    if (newIdentity || (!cur && name)) {
      cur = { key: startKey + entries.length, sheet: sheetName, nama, npp, jabatan, unit_name: unit, first: i + 1, last: i + 1, raw: [] };
      entries.push(cur);
    }
    if (!cur) continue;
    if (jabatan && !cur.jabatan) cur.jabatan = jabatan;
    if (unit && !cur.unit_name) cur.unit_name = unit;
    if (nama && !cur.nama) cur.nama = nama;

    const p = perspectiveOf(perspCell);
    if (p) persp = p;
    if (!name || /^\(key performance/i.test(name)) continue;

    const ukuran = get(row, "ukuran");
    const bobot = get(row, "bobot");
    const target = get(row, "targetTahunan");
    const monthCells = MONTHS.map((m) => {
      const slot = col.months[m] || {};
      return { m, real: slot.real === undefined ? "" : row[slot.real], target: slot.target === undefined ? "" : row[slot.target] };
    });
    const hasValue = text(ukuran) || text(bobot) || text(target) || monthCells.some((x) => text(x.real) || text(x.target));
    if (!hasValue) continue;

    cur.raw.push({ name, perspective: persp || "financial", ukuran, bobot, target, polaritas: get(row, "polaritas"), monthCells });
    cur.last = i + 1;
  }

  return {
    entries: entries.filter((e) => e.raw.length || e.nama || e.npp).map((e) => {
      const weights = e.raw.map((r) => (parseNumber(r.bobot) || { n: 0 }).n);
      const fractional = weights.filter((w) => w > 0 && w <= 1).length;
      const fractionMode = fractional > 0 && fractional >= weights.filter((w) => w > 1).length;
      const scaleOf = (w) => (fractionMode && w <= 1 ? 100 : 1);
      const kpis = e.raw.map((r, idx) => {
        const unit = unitOf(r.ukuran);
        const monthly_data = {};
        const monthly_target = {};
        for (const x of r.monthCells) {
          const rv = valueFor(x.real, unit);
          const tv = valueFor(x.target, unit);
          if (rv != null) monthly_data[x.m] = rv;
          if (tv != null) monthly_target[x.m] = tv;
        }
        return {
          name: r.name,
          perspective: r.perspective,
          unit,
          unit_label: text(r.ukuran),
          polarity: polarityOf(r.polaritas, r.name, r.ukuran),
          weight: Math.round(weights[idx] * scaleOf(weights[idx]) * 100) / 100,
          target: annualTarget(r.target, unit),
          monthly_data,
          monthly_target,
        };
      });
      return {
        key: e.key,
        sheet: e.sheet,
        rows: e.first === e.last ? String(e.first) : `${e.first}-${e.last}`,
        nama: e.nama,
        npp: e.npp,
        jabatan: e.jabatan,
        unit_name: e.unit_name,
        kpis,
      };
    }),
    skipped: "",
  };
}

export function parseKpiIndividuWorkbook(wb, utils) {
  const entries = [];
  const skipped = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const res = parseSheet(ws, name, utils, entries.length);
    if (res.skipped) skipped.push({ sheet: name, reason: res.skipped });
    entries.push(...res.entries);
  }
  entries.forEach((e, i) => { e.key = i; });
  return { entries, skipped };
}

export function buildKpiIndividuTemplate(utils) {
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agust", "Sept", "Okt", "Nov", "Des"];
  const head = ["JABATAN", "NAMA", "NPP", "PERSPEKTIF", "INDIKATOR KINERJA UTAMA", "Ukuran", "Bobot", "Target Tahunan"];
  const row3 = [...head];
  const row4 = ["", "", "", "", "(Key Performance Indicators)", "", "", ""];
  monthLabels.forEach((m) => { row3.push(m, ""); row4.push("Realisasi", "Target"); });
  const blankMonths = () => monthLabels.flatMap(() => ["", ""]);
  const sample = [
    ["Pemimpin Divisi Audit Internal", "Nama Pegawai", "1234.01011980.01012005", "Financial", "Potensi Kerugian yang Teridentifikasi dari Audit", "Juta Rupiah", 10, "2,5% Laba Tahun 2026", 7500, 2753, 7500, 5824.25, ...blankMonths().slice(4)],
    ["", "", "", "", "Recovery Kerugian akibat Audit", "% (persentase)", 10, "25%", "0,09%", 0.25, "0,09%", 0.25, ...blankMonths().slice(4)],
    ["", "", "", "Customer", "Perbaikan Indeks Penerapan Fungsi Audit Intern", "Indeks (skor)", 10, "≥ 90", 100, "≥ 90", 100, "≥ 90", ...blankMonths().slice(4)],
    ["", "", "", "Internal Bisnis Proses", "Penyelesaian Tindak Lanjut Sesuai Komitmen", "% (persentase)", 10, 1, "11,25%", 1, "19,63%", 1, ...blankMonths().slice(4)],
    ["", "", "", "Learning & Growth", "Culture Implementation Index", "Indeks (skor)", 5, 4, ...blankMonths()],
  ];
  const notes = [
    [],
    ["", "", "", "Petunjuk", "Satu file boleh berisi banyak sheet / banyak pegawai. Pisahkan blok pegawai dengan satu baris kosong."],
    ["", "", "", "NAMA, NPP, JABATAN", "Sistem mencocokkan pegawai dari NPP, lalu nama, lalu jabatan. Unit & jabatan disimpan sesuai data pegawai."],
    ["", "", "", "Kolom Ukuran", "% (persentase) | Juta Rupiah | Indeks (skor) | Angka"],
    ["", "", "", "Kolom Bobot", "Persen (10) atau desimal (0,1); total per pegawai 100."],
    ["", "", "", "Kolom Target Tahunan", "Target selama setahun (angka atau teks, mis. ≥ 90%)."],
    ["", "", "", "Kolom Target", "Target pada masing-masing bulan."],
    ["", "", "", "Kolom Realisasi", "Realisasi pada masing-masing bulan (kosongkan bulan yang belum berjalan)."],
    ["", "", "", "Upload ulang", "KPI individu lama pada unit + jabatan pegawai yang sama akan diganti."],
  ];
  const aoa = [["Template Pengisian KPI Individu Tahun " + new Date().getFullYear()], [], row3, row4, ...sample, ...notes];
  const ws = utils.aoa_to_sheet(aoa);
  const merges = [];
  for (let c = 0; c < head.length; c++) if (c !== 4) merges.push({ s: { r: 2, c }, e: { r: 3, c } });
  monthLabels.forEach((_, i) => merges.push({ s: { r: 2, c: 8 + i * 2 }, e: { r: 2, c: 9 + i * 2 } }));
  for (const c of [0, 1, 2]) merges.push({ s: { r: 4, c }, e: { r: 8, c } });
  merges.push({ s: { r: 4, c: 3 }, e: { r: 5, c: 3 } });
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 48 }, { wch: 16 }, { wch: 8 }, { wch: 22 }, ...monthLabels.flatMap(() => [{ wch: 10 }, { wch: 10 }])];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "KPI Individu");
  return wb;
}
