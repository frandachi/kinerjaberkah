import { c as scoreKpi, g as monthTarget, i as hasMonth, b as polarityPct, M as MONTHS } from "./kpi-scoring-Zero03.js";
import { p as skorInfo, n as cloneKpi, r as pencapaianInfo } from "./kpi-summary-Zero03.js";
import { n as normUnit, g as unitLabel } from "./kpi-units-Bpgxx_sX.js";
import { g as persLabel, c as persSort, n as normPers } from "./kpi-perspective-fFNWJAaz.js";

export const UNIT_TYPES = [
  { value: "all", label: "Semua Tipe" },
  { value: "corporate", label: "Corporate/Direksi" },
  { value: "divisi", label: "Divisi" },
  { value: "departemen", label: "Departemen" },
  { value: "ukk", label: "UKK" },
  { value: "unit", label: "Unit" },
  { value: "koordinator", label: "Cabang Koordinator" },
  { value: "cabang", label: "Cabang" },
  { value: "pembantu", label: "Cabang Pembantu" },
];

// Same rules as the Tipe Unit filter on the KPI Individu page.
export function matchUnitType(unitName, type) {
  if (type === "all") return true;
  const e = (unitName || "").toLowerCase();
  const rules = {
    corporate: () => e.includes("direktur") || e.includes("corporate") || e.includes("direksi"),
    divisi: () => e.includes("divisi") || e.includes("sekretariat"),
    departemen: () => e.includes("departemen"),
    ukk: () => e.includes("ukk"),
    unit: () => e.startsWith("unit"),
    koordinator: () => e.includes("cabang koordinator"),
    cabang: () => e.includes("cabang") && !e.includes("koordinator") && !e.includes("pembantu") && !e.includes("capem"),
    pembantu: () => e.includes("cabang pembantu") || e.includes("capem"),
  };
  return rules[type] ? rules[type]() : true;
}

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const kpiNameKey = (k) => norm(String(k.name || "").replace(/^-\s*/, ""));

function parseJson(v) {
  if (typeof v !== "string") return v || {};
  try {
    return JSON.parse(v) || {};
  } catch {
    return {};
  }
}

export function fmtValue(v, unit) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  const u = normUnit(unit);
  const s = n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return u === "percentage" ? `${s}%` : s;
}

export function fmtPct(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return "—";
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

function monthPct(k, m) {
  if (!hasMonth(k.monthly_data, m)) return null;
  const r = parseFloat(k.monthly_data[m]);
  const mt = monthTarget(k.monthly_target, m);
  const t = mt != null ? mt : parseFloat(k.target);
  return t == null || Number.isNaN(t) || Number.isNaN(r) ? null : polarityPct(r, t, k.polarity);
}

// KPI selection mirrors the KPI Individu page: same unit + jabatan, pegawai rows
// preferred, ordered by sort_order/name, de-duplicated by name, sorted by perspective.
// KPI rows that carry a pic belong only to that person, so another employee with the
// same unit + jabatan does not get a copy of someone else's scorecard.
function kpisForPegawai(p, byUnitJabatan) {
  let rows = byUnitJabatan.get(`${norm(p.unit_name)}|${norm(p.jabatan)}`) || [];
  if (rows.some((k) => norm(k.unit_type) === "pegawai")) rows = rows.filter((k) => norm(k.unit_type) === "pegawai");
  if (rows.some((k) => norm(k.pic))) rows = rows.filter((k) => !norm(k.pic) || norm(k.pic) === norm(p.name));
  rows = rows.slice().sort((a, b) => {
    const x = Number(a.sort_order ?? 0), y = Number(b.sort_order ?? 0);
    return x !== y ? x - y : String(a.name || "").localeCompare(String(b.name || ""), "id");
  });
  const seen = new Set(), out = [];
  for (const k of rows) {
    const key = kpiNameKey(k);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cloneKpi({ ...k, monthly_data: parseJson(k.monthly_data), monthly_target: parseJson(k.monthly_target) }));
  }
  return out.sort(persSort);
}

export function buildReport(p, kpis) {
  let totalBobot = 0, totalSkor = 0, weighted = 0;
  const rows = kpis.map((k, i) => {
    const unit = normUnit(k.unit);
    const { pencapaian, hasil, scored, indeks } = scoreKpi(k, unit);
    const w = parseFloat(k.weight) || 0;
    totalBobot += w;
    totalSkor += hasil;
    weighted += w * Math.max(0, Math.min(pencapaian, 120));
    const annual = parseFloat(k.target);
    const months = MONTHS.map((m) => {
      const has = hasMonth(k.monthly_data, m);
      const r = has ? parseFloat(k.monthly_data[m]) : null;
      const mt = monthTarget(k.monthly_target, m);
      return {
        realisasi: has && Number.isFinite(r) ? r : null,
        target: mt != null ? mt : Number.isFinite(annual) ? annual : null,
        pencapaian: monthPct(k, m),
      };
    });
    const info = skorInfo(indeks);
    const name = String(k.name || "").trim();
    return {
      no: i + 1,
      perspectiveKey: normPers(k.perspective) || String(k.perspective || "").trim(),
      perspective: persLabel(k.perspective),
      name: name.startsWith("-") ? name.slice(1).trim() : name,
      unit: k.unit,
      unitKind: unit,
      weight: k.weight ?? null,
      target: k.target != null && k.target !== "" ? Number(k.target) : null,
      months,
      scored,
      ytd: scored ? pencapaian : null,
      skor: scored ? hasil : null,
      indeks: scored && info.indeks > 0 ? info.indeks : 0,
      status: scored && info.indeks > 0 ? info.predikat : "",
    };
  });
  const avgYtd = totalBobot > 0 ? weighted / totalBobot : 0;
  const totalInfo = totalSkor > 0 ? pencapaianInfo(avgYtd) : skorInfo(0);
  return {
    pegawai: p,
    rows,
    totals: {
      totalBobot: round(totalBobot, 2),
      totalSkor,
      avgYtd,
      indeks: totalInfo.indeks,
      status: totalInfo.indeks > 0 ? totalInfo.predikat : "",
    },
  };
}

export function buildReports(pegawaiList, kpis, { unitType = "all", unitName = "all", pegawaiId = "all", onlyWithKpi = true } = {}) {
  const byUnitJabatan = new Map();
  (kpis || []).forEach((k) => {
    if (norm(k.unit_type) === "master") return;
    const key = `${norm(k.unit_name)}|${norm(k.jabatan)}`;
    if (!byUnitJabatan.has(key)) byUnitJabatan.set(key, []);
    byUnitJabatan.get(key).push(k);
  });
  return (pegawaiList || [])
    .filter((p) => p && p.unit_name && p.jabatan)
    .filter((p) => (unitName === "all" ? matchUnitType(p.unit_name, unitType) : p.unit_name === unitName))
    .filter((p) => pegawaiId === "all" || String(p.id) === String(pegawaiId))
    .map((p) => buildReport(p, kpisForPegawai(p, byUnitJabatan)))
    .filter((r) => !onlyWithKpi || r.rows.length > 0)
    .sort(
      (a, b) =>
        String(a.pegawai.unit_name).localeCompare(String(b.pegawai.unit_name), "id") ||
        String(a.pegawai.name || "").localeCompare(String(b.pegawai.name || ""), "id")
    );
}

const MONTH_HEAD = MONTHS;

function infoRows(r, year) {
  const p = r.pegawai;
  return [
    [`KPI Individu Tahun ${year}`],
    ["Nama", p.name || ""],
    ["NPP", p.npp || ""],
    ["Jabatan", p.jabatan || ""],
    ["Unit Kerja", p.unit_name || ""],
  ];
}

function sheetName(r, used) {
  const p = r.pegawai;
  const base = `${String(p.npp || "").split(".")[0]} ${p.name || ""}`.replace(/[\[\]:*?\/\\]/g, "").trim().slice(0, 31) || "Pegawai";
  let name = base, i = 2;
  while (used.has(name.toLowerCase())) name = `${base.slice(0, 27)} (${i++})`;
  used.add(name.toLowerCase());
  return name;
}

const XS_LINE = { style: "thin", color: { rgb: "94A3B8" } };
const XS_BORDER = { top: XS_LINE, bottom: XS_LINE, left: XS_LINE, right: XS_LINE };
const XS_HEAD = {
  font: { bold: true, color: { rgb: "1E293B" } },
  fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: XS_BORDER,
};
const XS_SUB_FILL = ["DBEAFE", "E0F2FE", "D1FAE5"];
const XS_INDEKS = {
  1: { fill: "FEE2E2", font: "991B1B" },
  2: { fill: "FFEDD5", font: "9A3412" },
  3: { fill: "DCFCE7", font: "14532D" },
  4: { fill: "15803D", font: "FFFFFF" },
  5: { fill: "2563EB", font: "FFFFFF" },
};
const XS_NUMFMT = { currency: "#,##0.00", percentage: "0.00", score: "0.##", number: "#,##0.##" };

function xsCell(XU, ws, r, c, style) {
  const addr = XU.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  ws[addr].s = { border: XS_BORDER, alignment: { vertical: "center" }, ...(ws[addr].s || {}), ...style };
  return ws[addr];
}

function xsIndeks(cell, indeks) {
  const c = XS_INDEKS[indeks];
  if (!c) return;
  cell.s.fill = { patternType: "solid", fgColor: { rgb: c.fill } };
  cell.s.font = { ...(cell.s.font || {}), bold: true, color: { rgb: c.font } };
}

export function buildWorkbook(XU, reports, year) {
  const wb = XU.book_new();
  const summary = [
    [`Ringkasan KPI Individu Tahun ${year}`],
    [`Diekspor: ${new Date().toLocaleString("id-ID")}`],
    [],
    ["No", "NPP", "Nama", "Jabatan", "Unit Kerja", "Jumlah KPI", "Total Bobot (%)", "YTD (%)", "Skor", "Status"],
    ...reports.map((r, i) => [
      i + 1,
      r.pegawai.npp || "",
      r.pegawai.name || "",
      r.pegawai.jabatan || "",
      r.pegawai.unit_name || "",
      r.rows.length,
      r.totals.totalBobot,
      r.totals.avgYtd > 0 ? round(r.totals.avgYtd, 1) : null,
      round(r.totals.totalSkor, 2),
      r.totals.status,
    ]),
  ];
  const ws0 = XU.aoa_to_sheet(summary);
  ws0["!cols"] = [6, 26, 30, 40, 40, 11, 14, 10, 8, 12].map((wch) => ({ wch }));
  ws0.A1.s = { font: { bold: true, sz: 14 } };
  for (let c = 0; c < 10; c++) xsCell(XU, ws0, 3, c, XS_HEAD);
  reports.forEach((r, i) => {
    for (let c = 0; c < 10; c++) {
      const cell = xsCell(XU, ws0, 4 + i, c, {
        alignment: { vertical: "center", horizontal: c === 0 || c >= 5 ? "center" : "left" },
      });
      if (c === 7) cell.z = "0.0";
      if (c === 8) cell.z = "0.00";
      if (c === 7 || c === 9) xsIndeks(cell, r.totals.indeks);
    }
  });
  XU.book_append_sheet(wb, ws0, "Ringkasan");

  const used = new Set(["ringkasan"]);
  reports.forEach((r) => {
    const head = infoRows(r, year);
    const h0 = head.length + 1;
    const top = ["No", "Perspektif", "KPI", "Satuan", "Bobot (%)", `Target Tahun ${year}`];
    const sub = ["", "", "", "", "", ""];
    MONTH_HEAD.forEach((m) => {
      top.push(m, "", "");
      sub.push("Realisasi", "Target", "Pencapaian (%)");
    });
    top.push("YTD (%)", "Skor", "Status");
    sub.push("", "", "");
    const body = r.rows.map((row) => {
      const line = [row.no, row.perspective, row.name, unitLabel(row.unit), row.weight != null ? Number(row.weight) : null, row.target];
      row.months.forEach((m) => line.push(m.realisasi, m.target, round(m.pencapaian, 1)));
      line.push(round(row.ytd, 1), round(row.skor, 2), row.status);
      return line;
    });
    const total = ["TOTAL", "", "", "", r.totals.totalBobot, null];
    MONTH_HEAD.forEach(() => total.push(null, null, null));
    total.push(r.totals.avgYtd > 0 ? round(r.totals.avgYtd, 1) : null, round(r.totals.totalSkor, 2), r.totals.status);

    const ws = XU.aoa_to_sheet([...head, [], top, sub, ...body, total]);
    const merges = [];
    for (let c = 0; c < 6; c++) merges.push({ s: { r: h0, c }, e: { r: h0 + 1, c } });
    MONTH_HEAD.forEach((_, i) => merges.push({ s: { r: h0, c: 6 + i * 3 }, e: { r: h0, c: 8 + i * 3 } }));
    for (let c = 42; c < 45; c++) merges.push({ s: { r: h0, c }, e: { r: h0 + 1, c } });
    let start = 0;
    r.rows.forEach((row, i) => {
      const next = r.rows[i + 1];
      if (!next || next.perspectiveKey !== row.perspectiveKey) {
        if (i > start) merges.push({ s: { r: h0 + 2 + start, c: 1 }, e: { r: h0 + 2 + i, c: 1 } });
        start = i + 1;
      }
    });
    const totalRow = h0 + 2 + r.rows.length;
    merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 3 } });
    ws["!merges"] = merges;
    ws["!cols"] = [5, 22, 45, 12, 9, 16, ...MONTH_HEAD.flatMap(() => [13, 13, 11]), 9, 8, 12].map((wch) => ({ wch }));

    ws.A1.s = { font: { bold: true, sz: 14 } };
    for (let i = 1; i < head.length; i++) ws[XU.encode_cell({ r: i, c: 0 })].s = { font: { bold: true } };
    for (let c = 0; c < 45; c++) {
      xsCell(XU, ws, h0, c, XS_HEAD);
      const sub = c >= 6 && c < 42 ? XS_SUB_FILL[(c - 6) % 3] : null;
      xsCell(XU, ws, h0 + 1, c, sub ? { ...XS_HEAD, fill: { patternType: "solid", fgColor: { rgb: sub } } } : XS_HEAD);
    }
    r.rows.forEach((row, i) => {
      const y = h0 + 2 + i;
      const fmt = XS_NUMFMT[row.unitKind] || "General";
      for (let c = 0; c < 45; c++) {
        const left = c === 1 || c === 2 || c === 3;
        const cell = xsCell(XU, ws, y, c, {
          alignment: { vertical: "center", horizontal: left ? "left" : "center", wrapText: c === 1 || c === 2 },
        });
        if (c === 2) cell.s.font = { bold: true };
        if (c === 5 || (c >= 6 && c < 42 && (c - 6) % 3 !== 2)) cell.z = fmt;
        if (c >= 6 && c < 42 && (c - 6) % 3 === 2) {
          cell.z = "0.0";
          const p = row.months[Math.floor((c - 6) / 3)].pencapaian;
          if (p != null && p >= 100) cell.s.font = { color: { rgb: "047857" } };
          else if (p != null && p > 0 && p < 80) cell.s.font = { color: { rgb: "B45309" } };
        }
        if (c === 42) cell.z = "0.0";
        if (c === 43) cell.z = "0.00";
        if (c === 42 || c === 44) xsIndeks(cell, row.indeks);
      }
    });
    for (let c = 0; c < 45; c++) {
      const cell = xsCell(XU, ws, totalRow, c, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
        alignment: { vertical: "center", horizontal: c === 0 ? "left" : "center" },
      });
      if (c === 4) {
        const ok = Math.abs((r.totals.totalBobot || 0) - 100) <= 0.1;
        cell.s.fill = { patternType: "solid", fgColor: { rgb: ok ? "D1FAE5" : "FEE2E2" } };
      }
      if (c === 42) cell.z = "0.0";
      if (c === 43) cell.z = "0.00";
      if (c === 42 || c === 44) xsIndeks(cell, r.totals.indeks);
    }
    ws["!rows"] = [];
    ws["!rows"][h0] = { hpt: 20 };
    ws["!rows"][h0 + 1] = { hpt: 18 };
    XU.book_append_sheet(wb, ws, sheetName(r, used));
  });
  return wb;
}

export function buildCsvRows(reports, year) {
  const head = ["NPP", "Nama", "Jabatan", "Unit Kerja", "No", "Perspektif", "KPI", "Satuan", "Bobot (%)", `Target Tahun ${year}`];
  MONTH_HEAD.forEach((m) => head.push(`${m} Realisasi`, `${m} Target`, `${m} Pencapaian (%)`));
  head.push("YTD (%)", "Skor", "Status");
  const out = [head];
  reports.forEach((r) => {
    const p = r.pegawai;
    const who = [p.npp || "", p.name || "", p.jabatan || "", p.unit_name || ""];
    r.rows.forEach((row) => {
      const line = [...who, row.no, row.perspective, row.name, unitLabel(row.unit), row.weight != null ? Number(row.weight) : "", row.target ?? ""];
      row.months.forEach((m) => line.push(m.realisasi ?? "", m.target ?? "", m.pencapaian != null ? round(m.pencapaian, 1) : ""));
      line.push(row.ytd != null ? round(row.ytd, 1) : "", row.skor != null ? round(row.skor, 2) : "", row.status);
      out.push(line);
    });
    const total = [...who, "TOTAL", "", "", "", r.totals.totalBobot, ""];
    MONTH_HEAD.forEach(() => total.push("", "", ""));
    total.push(r.totals.avgYtd > 0 ? round(r.totals.avgYtd, 1) : "", round(r.totals.totalSkor, 2), r.totals.status);
    out.push(total);
  });
  return out;
}

export function toCsv(rows) {
  const cell = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

const RGB = {
  border: [203, 213, 225],
  strong: [100, 116, 139],
  head: [248, 250, 252],
  real: [239, 246, 255],
  tgt: [240, 249, 255],
  pct: [236, 253, 245],
  text: [30, 41, 59],
  muted: [100, 116, 139],
  green: [4, 120, 87],
  amber: [180, 83, 9],
};
const INDEKS_CELL = {
  1: { fill: [254, 242, 242], text: [153, 27, 27] },
  2: { fill: [255, 247, 237], text: [154, 52, 18] },
  3: { fill: [240, 253, 244], text: [20, 83, 45] },
  4: { fill: [220, 252, 231], text: [20, 83, 45] },
  5: { fill: [239, 246, 255], text: [30, 64, 175] },
};
const INDEKS_BADGE = {
  1: { fill: [220, 38, 38], text: [255, 255, 255] },
  2: { fill: [249, 115, 22], text: [255, 255, 255] },
  3: { fill: [220, 252, 231], text: [20, 83, 45] },
  4: { fill: [21, 128, 61], text: [255, 255, 255] },
  5: { fill: [37, 99, 235], text: [255, 255, 255] },
};

// Draws one landscape page (or more if the KPI list overflows) per pegawai,
// laid out like the KPI Individu monthly table.
export function buildPdf(JsPDF, reports, year, paper = "a4") {
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: paper, compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6;
  const scale = paper === "a3" ? 1.4 : 1;
  const base = 5 * scale;
  const fixed = [5, 17, 38, 8, 12].map((v) => v * scale);
  const tail = [10, 7, 13].map((v) => v * scale);
  const monthW = (W - M * 2 - fixed.reduce((a, b) => a + b, 0) - tail.reduce((a, b) => a + b, 0)) / 36;
  const lineH = 2.1 * scale;
  const headH1 = 4.5 * scale, headH2 = 4 * scale;

  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  function cell(x, y, w, h, text, o = {}) {
    if (o.fill) {
      setFill(o.fill);
      doc.rect(x, y, w, h, "F");
    }
    setDraw(RGB.border);
    doc.setLineWidth(0.1);
    doc.rect(x, y, w, h, "S");
    if (o.leftStrong) {
      setDraw(o.leftColor || RGB.strong);
      doc.setLineWidth(0.25);
      doc.line(x, y, x, y + h);
    }
    if (text == null || text === "") return;
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    let fs = o.size || base;
    const max = w - 1;
    doc.setFontSize(fs);
    const lines = o.wrap ? doc.splitTextToSize(String(text), max) : [String(text)];
    if (!o.wrap) while (fs > 2.4 && doc.getTextWidth(lines[0]) > max) doc.setFontSize((fs -= 0.2));
    setText(o.color || RGB.text);
    const total = lines.length * lineH;
    let ty = y + (h - total) / 2 + lineH * 0.78;
    lines.forEach((ln) => {
      const tx = o.align === "left" ? x + 0.8 : o.align === "right" ? x + w - 0.8 : x + w / 2;
      doc.text(ln, tx, ty, { align: o.align === "left" ? "left" : o.align === "right" ? "right" : "center" });
      ty += lineH;
    });
  }

  function header(r, y, cont) {
    const p = r.pegawai;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10 * scale);
    setText(RGB.text);
    doc.text(`KPI Individu Tahun ${year}${cont ? " (lanjutan)" : ""}`, M, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7 * scale);
    setText(RGB.muted);
    doc.text(`${p.name || "-"}  ·  NPP ${p.npp || "-"}  ·  ${p.jabatan || "-"}  ·  ${p.unit_name || "-"}`, M, y + 8 * scale);
    y += 11 * scale;
    let x = M;
    const labels = ["No", "Perspektif", "KPI", "Bobot (%)", `Target Tahun ${year}`];
    fixed.forEach((w, i) => {
      cell(x, y, w, headH1 + headH2, labels[i], { fill: RGB.head, bold: true, align: i === 1 || i === 2 ? "left" : "center" });
      x += w;
    });
    MONTH_HEAD.forEach((m) => {
      cell(x, y, monthW * 3, headH1, m, { fill: RGB.head, bold: true, leftStrong: true });
      cell(x, y + headH1, monthW, headH2, "Realisasi", { fill: RGB.real, bold: true, size: base * 0.75, leftStrong: true });
      cell(x + monthW, y + headH1, monthW, headH2, "Target", { fill: RGB.tgt, bold: true, size: base * 0.75 });
      cell(x + monthW * 2, y + headH1, monthW, headH2, "Pencapaian", { fill: RGB.pct, bold: true, size: base * 0.75 });
      x += monthW * 3;
    });
    ["YTD (%)", "Skor", "Status"].forEach((t, i) => {
      cell(x, y, tail[i], headH1 + headH2, t, { fill: RGB.head, bold: true, leftStrong: i === 0 });
      x += tail[i];
    });
    return y + headH1 + headH2;
  }

  reports.forEach((r, ri) => {
    if (ri > 0) doc.addPage();
    let y = header(r, M, false);
    doc.setFontSize(base);
    const heights = r.rows.map((row) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(base);
      const n = doc.splitTextToSize(row.name, fixed[2] - 1).length;
      return Math.max(5 * scale, n * lineH + 1.4);
    });
    let persStartY = y, persStartIdx = 0;
    r.rows.forEach((row, i) => {
      const h = heights[i];
      if (y + h > H - M - 6 * scale) {
        doc.addPage();
        y = header(r, M, true);
        persStartY = y;
        persStartIdx = i;
      }
      const prev = r.rows[i - 1];
      const newPers = !prev || prev.perspectiveKey !== row.perspectiveKey || i === persStartIdx;
      if (newPers) {
        persStartY = y;
        persStartIdx = i;
      }
      let x = M;
      cell(x, y, fixed[0], h, row.no, { color: RGB.muted });
      x += fixed[0];
      // perspective cell is drawn once the group ends (spans rows)
      x += fixed[1];
      cell(x, y, fixed[2], h, row.name, { align: "left", wrap: true, bold: true });
      x += fixed[2];
      cell(x, y, fixed[3], h, row.weight ?? "—");
      x += fixed[3];
      cell(x, y, fixed[4], h, row.target != null ? fmtValue(row.target, row.unit) : "—", { color: [51, 65, 85] });
      x += fixed[4];
      row.months.forEach((m) => {
        const p = m.pencapaian;
        cell(x, y, monthW, h, m.realisasi != null ? fmtValue(m.realisasi, row.unit) : "—", { leftStrong: true, size: base * 0.85 });
        cell(x + monthW, y, monthW, h, m.target != null ? fmtValue(m.target, row.unit) : "—", { color: [71, 85, 105], size: base * 0.85 });
        cell(x + monthW * 2, y, monthW, h, p == null ? "—" : fmtPct(p), {
          size: base * 0.85,
          color: p != null && p >= 100 ? RGB.green : p != null && p > 0 && p < 80 ? RGB.amber : RGB.text,
        });
        x += monthW * 3;
      });
      const ic = INDEKS_CELL[row.indeks];
      cell(x, y, tail[0], h, row.scored ? fmtPct(row.ytd) : "—", { bold: true, leftStrong: true, fill: ic && ic.fill, color: ic ? ic.text : RGB.muted });
      x += tail[0];
      cell(x, y, tail[1], h, row.scored ? row.skor.toFixed(2) : "—", { bold: true });
      x += tail[1];
      cell(x, y, tail[2], h, "");
      if (row.status) {
        const b = INDEKS_BADGE[row.indeks];
        setFill(b.fill);
        doc.roundedRect(x + 0.8, y + h / 2 - 1.6 * scale, tail[2] - 1.6, 3.2 * scale, 0.6, 0.6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(base * 0.8);
        setText(b.text);
        doc.text(row.status, x + tail[2] / 2, y + h / 2 + 0.6 * scale, { align: "center" });
      }
      const next = r.rows[i + 1];
      const groupEnds = !next || next.perspectiveKey !== row.perspectiveKey || y + h + heights[i + 1] > H - M - 6 * scale;
      if (groupEnds) {
        cell(M + fixed[0], persStartY, fixed[1], y + h - persStartY, row.perspective, { align: "left", wrap: true, color: [71, 85, 105] });
      }
      if (prev && prev.perspectiveKey !== row.perspectiveKey) {
        setDraw(RGB.strong);
        doc.setLineWidth(0.35);
        doc.line(M, y, W - M, y);
      }
      y += h;
    });
    const th = 5.5 * scale;
    let x = M;
    cell(x, y, fixed[0] + fixed[1] + fixed[2], th, "TOTAL", { fill: RGB.head, bold: true, align: "left" });
    x += fixed[0] + fixed[1] + fixed[2];
    const okBobot = Math.abs((r.totals.totalBobot || 0) - 100) <= 0.1;
    cell(x, y, fixed[3], th, r.totals.totalBobot, { fill: okBobot ? [236, 253, 245] : [254, 242, 242], bold: true, color: okBobot ? RGB.green : [220, 38, 38] });
    x += fixed[3];
    cell(x, y, fixed[4] + monthW * 36, th, "", { fill: RGB.head });
    x += fixed[4] + monthW * 36;
    const tc = INDEKS_CELL[r.totals.indeks];
    cell(x, y, tail[0], th, r.totals.avgYtd > 0 ? fmtPct(r.totals.avgYtd) : "—", { bold: true, leftStrong: true, fill: tc ? tc.fill : RGB.head, color: tc ? tc.text : RGB.muted });
    x += tail[0];
    cell(x, y, tail[1], th, r.totals.totalSkor.toFixed(2), { bold: true, fill: RGB.head });
    x += tail[1];
    cell(x, y, tail[2], th, "", { fill: RGB.head });
    if (r.totals.status) {
      const b = INDEKS_BADGE[r.totals.indeks];
      setFill(b.fill);
      doc.roundedRect(x + 0.8, y + th / 2 - 1.6 * scale, tail[2] - 1.6, 3.2 * scale, 0.6, 0.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(base * 0.8);
      setText(b.text);
      doc.text(r.totals.status, x + tail[2] / 2, y + th / 2 + 0.6 * scale, { align: "center" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6 * scale);
    setText(RGB.muted);
    doc.text(`Dicetak ${new Date().toLocaleString("id-ID")}  ·  Halaman pegawai ${ri + 1} dari ${reports.length}`, M, H - M + 2);
  });
  return doc;
}

export function safeFilePart(s) {
  return String(s || "").replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "_") || "Semua";
}
