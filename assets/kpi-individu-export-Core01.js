import { c as scoreKpi, g as monthTarget, i as hasMonth, b as polarityPct, M as MONTHS, y as kbY, kbMonthClosed } from "./kpi-scoring-Zero03.js";
import { c as statsKpis, p as skorInfo, n as cloneKpi, r as pencapaianInfo, v as kbNilaiAkhir } from "./kpi-summary-Zero03.js";
import { n as normUnit, g as unitLabel } from "./kpi-units-Bpgxx_sX.js";
import { g as persLabel, c as persSort, n as normPers } from "./kpi-perspective-fFNWJAaz.js";

export const UNIT_TYPES = [
  { value: "all", label: "Semua Tipe" },
  { value: "corporate", label: "Corporate/Direksi" },
  { value: "divisi", label: "Divisi" },
  { value: "departemen", label: "Departemen" },
  { value: "ukk", label: "UKK" },
  { value: "unit", label: "Unit" },
  { value: "koordinator", label: "Cabang Utama" },
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
    koordinator: () => e.includes("cabang utama") || e.includes("cabang koordinator"),
    cabang: () => e.includes("cabang") && !e.includes("koordinator") && !e.includes("utama") && !e.includes("pembantu") && !e.includes("capem"),
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

/* ── Scorecard unit: rumus identik dengan tabel detail halaman KPI Unit ── */

/** Realisasi kumulatif sampai bulan `month` (satuan currency/number = Σ, lainnya = nilai terakhir). */
function unitRealisasiTo(k, unitKind, month) {
  const md = parseJson(k.monthly_data);
  const idx = MONTHS.indexOf(month);
  if (idx < 0) return null;
  let last = null;
  for (let i = 0; i <= idx; i++) {
    const raw = md[MONTHS[i]];
    if (raw == null || raw === "") continue;
    const n = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) continue;
    last = unitKind === "currency" || unitKind === "number" ? (last == null ? n : last + n) : n;
  }
  return last;
}

/** Skor bulan = ROUND(bobot × indeks, 2) / 100 — sama dengan MonthTriplet UI KPI Unit. */
function unitMonthSkor(k, pct) {
  if (!Number.isFinite(pct)) return null;
  const unit = normUnit(k.unit);
  const indeks = kbY(pct, k.polarity, unit, k.perspective) || 0;
  const bobot = parseFloat(k.weight) || 0;
  return Math.round(bobot * indeks * 100) / 100 / 100;
}

/** Target Des → mundur (sama dengan annualFromMonthlyTarget UI KPI Unit). */
function unitAnnualFromMonthlyTarget(k) {
  const mt = parseJson(k && k.monthly_target);
  for (const m of ["Des", "Nov", "Okt", "Sep", "Ags", "Jul", "Jun", "Mei", "Apr", "Mar", "Feb", "Jan"]) {
    const raw = mt == null ? null : mt[m];
    if (raw == null || raw === "") continue;
    const n = parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
}

/** Target Tahun — sama dengan resolveTargetTahunNum UI: field target,
 *  kecuali currency/number yang targetnya tampak seperti %/bobot → pakai Σ/des monthly. */
function unitTargetTahunNum(kpi) {
  const raw = kpi && kpi.target;
  const e = raw == null || raw === "" ? NaN : Number(String(raw).replace(",", "."));
  const kind = normUnit(kpi && kpi.unit);
  const fromMt = unitAnnualFromMonthlyTarget(kpi);
  if ((kind === "currency" || kind === "number") && fromMt != null) {
    const absMt = Math.abs(fromMt);
    if (!Number.isFinite(e)) return fromMt;
    const w = parseFloat(kpi.weight);
    if (Number.isFinite(w) && Math.abs(e - w) < 1e-9 && absMt >= 1000) return fromMt;
    if (absMt >= 1000 && Math.abs(e) < absMt / 50) return fromMt;
  }
  if (!Number.isFinite(e)) return null;
  return e;
}

export function bobotLabel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  return r.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function fmtValue(v, unit) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  const u = normUnit(unit);
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  if (u === "percentage") return r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  return r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      weight: Number.isFinite(Number(k.weight)) ? Number(bobotLabel(k.weight)) : null,
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

function infoRows(r, year, kind = "individu") {
  const p = r.pegawai;
  if (kind === "unit") {
    return [
      [`KPI Unit Tahun ${year}`],
      ["Unit Kantor", p.unit_name || ""],
      ["Tipe", p.tipe || ""],
      ["Jabatan", p.jabatan || ""],
      ["Pemimpin", p.name || ""],
    ];
  }
  return [
    [`KPI Individu Tahun ${year}`],
    ["Nama", p.name || ""],
    ["NPP", p.npp || ""],
    ["Jabatan", p.jabatan || ""],
    ["Unit Kerja", p.unit_name || ""],
  ];
}

function sheetName(r, used, kind = "individu") {
  const p = r.pegawai;
  const raw =
    kind === "unit"
      ? p.unit_name || p.name || "Unit"
      : `${String(p.npp || "").split(".")[0]} ${p.name || ""}`;
  const base = String(raw).replace(/[\[\]:*?\/\\]/g, "").trim().slice(0, 31) || (kind === "unit" ? "Unit" : "Pegawai");
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

export function buildWorkbook(XU, reports, year, opts = {}) {
  const kind = opts.kind === "unit" ? "unit" : "individu";
  const wb = XU.book_new();
  const summaryHead =
    kind === "unit"
      ? ["No", "Unit Kantor", "Tipe", "Jabatan", "Pemimpin", "Jumlah KPI", "Total Bobot (%)", "YTD (%)", "Skor", "Status"]
      : ["No", "NPP", "Nama", "Jabatan", "Unit Kerja", "Jumlah KPI", "Total Bobot (%)", "YTD (%)", "Skor", "Status"];
  const summary = [
    [`Ringkasan KPI ${kind === "unit" ? "Unit" : "Individu"} Tahun ${year}`],
    [`Diekspor: ${new Date().toLocaleString("id-ID")}`],
    [],
    summaryHead,
    ...reports.map((r, i) =>
      kind === "unit"
        ? [
            i + 1,
            r.pegawai.unit_name || "",
            r.pegawai.tipe || "",
            r.pegawai.jabatan || "",
            r.pegawai.name || "",
            r.rows.length,
            r.totals.totalBobot,
            r.totals.avgYtd > 0 ? round(r.totals.avgYtd, 1) : null,
            round(r.totals.totalSkor, 2),
            r.totals.status,
          ]
        : [
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
          ]
    ),
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
    const head = infoRows(r, year, kind);
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
    XU.book_append_sheet(wb, ws, sheetName(r, used, kind));
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

// Draws one landscape page (or more if the KPI list overflows) per pegawai/unit,
// laid out like the monthly scorecard table (KPI Individu / KPI Unit).
export function buildPdf(JsPDF, reports, year, paper = "a4", opts = {}) {
  const kind = opts.kind === "unit" ? "unit" : "individu";
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: paper, compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6;
  const scale = paper === "a3" ? 1.4 : 1;
  const base = 5 * scale;
  const fixed = [5, 17, 38, 8, 12].map((v) => v * scale);
  const tail = [10, 7, 13].map((v) => v * scale);
  const perMonth = kind === "unit" ? 4 : 3;
  const monthW = (W - M * 2 - fixed.reduce((a, b) => a + b, 0) - tail.reduce((a, b) => a + b, 0)) / (12 * perMonth);
  const lineH = 2.1 * scale;
  const headH1 = 4.5 * scale, headH2 = 4 * scale;

  let pageUsed = false;
  /** Halaman Ranking Unit (cermin sheet "Unit Kerja"/"Kantor Cabang" di Excel). */
  function rankingPage(rows, title, nameCol) {
    if (pageUsed) doc.addPage();
    pageUsed = true;
    let y = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * scale);
    setText(RGB.text);
    doc.text(`RANKING ${String(title).toUpperCase()} — NILAI PERIODE ${String(opts.monthLabel || "").toUpperCase()} ${year}`, M, y + 4.5);
    y += 8 * scale;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5 * scale);
    setText(RGB.muted);
    doc.text(`Dicetak ${new Date().toLocaleString("id-ID")}  ·  ${rows.length} unit`, M, y + 2);
    y += 5 * scale;
    const cols = [6 * scale, 14 * scale, 40 * scale, 14 * scale, 18 * scale];
    const heads = ["No", "Kode", nameCol, "Total Nilai", "Kategori Nilai"];
    const rh = 5 * scale;
    let x = M;
    heads.forEach((t, i) => { cell(x, y, cols[i], rh, t, { fill: [30, 58, 138], bold: true, color: [255, 255, 255], align: i === 2 ? "left" : "center" }); x += cols[i]; });
    y += rh;
    rows.forEach((r, i) => {
      const indeks = r.indeks != null ? r.indeks : (r.skor < 1.5 ? 1 : r.skor < 2.5 ? 2 : r.skor < 3.5 ? 3 : r.skor < 4.5 ? 4 : 5);
      const ic = INDEKS_CELL[indeks] || RGB.head;
      x = M;
      cell(x, y, cols[0], rh, i + 1, { align: "center", color: RGB.muted }); x += cols[0];
      cell(x, y, cols[1], rh, r.kode != null && r.kode !== "" ? String(r.kode) : "", { align: "center" }); x += cols[1];
      cell(x, y, cols[2], rh, r.kantor || r.unit || "", { align: "left" }); x += cols[2];
      cell(x, y, cols[3], rh, r.skor != null && Number.isFinite(Number(r.skor)) ? Number(r.skor).toFixed(2) : "—", { align: "center", bold: true }); x += cols[3];
      cell(x, y, cols[4], rh, r.kategori || "-", { align: "center", bold: true, fill: ic.fill, color: ic.text });
      y += rh;
      if (y + rh > H - M) {
        doc.addPage();
        y = M;
        x = M;
        heads.forEach((t, i2) => { cell(x, y, cols[i2], rh, t, { fill: [30, 58, 138], bold: true, color: [255, 255, 255], align: i2 === 2 ? "left" : "center" }); x += cols[i2]; });
        y += rh;
      }
    });
  }
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

  if (kind === "unit" && Array.isArray(opts.ranking) && opts.ranking.length) {
    const pusat = opts.ranking.filter((r) => !r.isCabang);
    const cabang = opts.ranking.filter((r) => r.isCabang);
    if (pusat.length) rankingPage(pusat, "Unit Kerja", "Unit Kerja");
    if (cabang.length) rankingPage(cabang, "Kantor Cabang", "Kantor Cabang");
  }

  function header(r, y, cont) {
    const p = r.pegawai;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10 * scale);
    setText(RGB.text);
    doc.text(kind === "unit" ? `KPI UNIT — ${String((r.pegawai && (r.pegawai.kantor || r.pegawai.unit_name)) || "").toUpperCase()} TAHUN ${year}${cont ? " (lanjutan)" : ""}` : `KPI Individu Tahun ${year}${cont ? " (lanjutan)" : ""}`, M, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7 * scale);
    setText(RGB.muted);
    doc.text(
      kind === "unit"
        ? `${p.unit_name || "-"}  ·  ${p.tipe ? `${p.tipe}  ·  ` : ""}${p.jabatan ? `Pemimpin: ${p.name || "-"} (${p.jabatan})` : p.name || ""}  ·  Skor Akhir: ${r.totals && r.totals.totalSkor != null ? Number(r.totals.totalSkor).toFixed(2) : "-"}  ·  Status: ${(r.totals && (r.totals.kategori || r.totals.status)) || "-"}`
        : `${p.name || "-"}  ·  NPP ${p.npp || "-"}  ·  ${p.jabatan || "-"}  ·  ${p.unit_name || "-"}`,
      M,
      y + 8 * scale
    );
    y += 11 * scale;
    let x = M;
    const labels = ["No", "Perspektif", "KPI", "Bobot (%)", `Target Tahun ${year}`];
    fixed.forEach((w, i) => {
      cell(x, y, w, headH1 + headH2, labels[i], { fill: RGB.head, bold: true, align: i === 1 || i === 2 ? "left" : "center" });
      x += w;
    });
    MONTH_HEAD.forEach((m) => {
      cell(x, y, monthW * perMonth, headH1, m, { fill: RGB.head, bold: true, leftStrong: true });
      cell(x, y + headH1, monthW, headH2, "Realisasi", { fill: RGB.real, bold: true, size: base * 0.75, leftStrong: true });
      cell(x + monthW, y + headH1, monthW, headH2, "Target", { fill: RGB.tgt, bold: true, size: base * 0.75 });
      cell(x + monthW * 2, y + headH1, monthW, headH2, "Pencapaian", { fill: RGB.pct, bold: true, size: base * 0.75 });
      if (kind === "unit") cell(x + monthW * 3, y + headH1, monthW, headH2, "Skor", { fill: [237, 233, 254], bold: true, size: base * 0.75 });
      x += monthW * perMonth;
    });
    ["YTD (%)", "Skor", "Status"].forEach((t, i) => {
      cell(x, y, tail[i], headH1 + headH2, t, { fill: RGB.head, bold: true, leftStrong: i === 0 });
      x += tail[i];
    });
    return y + headH1 + headH2;
  }

  reports.forEach((r, ri) => {
    if (ri > 0 || pageUsed) doc.addPage();
    pageUsed = true;
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
        if (kind === "unit") cell(x + monthW * 3, y, monthW, h, m.skor != null ? m.skor.toFixed(2) : "—", { size: base * 0.85, color: [76, 29, 149] });
        x += monthW * perMonth;
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
    cell(x, y, fixed[4] + monthW * 12 * perMonth, th, "", { fill: RGB.head });
    x += fixed[4] + monthW * 12 * perMonth;
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
    doc.text(`Dicetak ${new Date().toLocaleString("id-ID")}  ·  Halaman ${kind === "unit" ? "unit" : "pegawai"} ${ri + 1} dari ${reports.length}`, M, H - M + 2);
  });
  return doc;
}

export function safeFilePart(s) {
  return String(s || "").replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "_") || "Semua";
}

const BULAN_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Label bulan penuh untuk header "Nilai periode …" (default: bulan terakhir yang sudah ditutup, WIB). */
export function nilaiPeriodeMonthLabel(now = new Date()) {
  const w = new Date(now.getTime() + 7 * 3600 * 1000);
  let idx = w.getUTCMonth() - 1;
  if (idx < 0) idx = 11;
  return BULAN_FULL[idx];
}

/** True jika unit adalah kantor cabang (KC / KCK / KCP / Syariah). */
export function isUnitCabang(name, typeOrOpts = "", unitType = "") {
  const opts =
    typeOrOpts && typeof typeOrOpts === "object"
      ? typeOrOpts
      : { type: typeOrOpts, unitType };
  const n = String(name || "").trim();
  const ut = String(opts.unitType || unitType || "").toLowerCase();
  const masterType = String(opts.type || "").toUpperCase();
  return (
    ut === "kc" ||
    ut === "kck" ||
    ut === "kcp" ||
    masterType === "KONVENSIONAL" ||
    masterType === "SYARIAH" ||
    /^(KC|KCS|KCP|KCK|KCPS)\s/i.test(n) ||
    /\bcabang\b|\bcapem\b/i.test(n)
  );
}

/**
 * Format nama Unit Kerja sesuai tipe:
 * - Cabang (KC/KCK/KCP/Syariah) → KC / KCS / KCP / KCK / KCPS
 * - Divisi / Departemen / UKK / Unit / Project / Direksi → nama asli
 */
export function formatUnitKerja(name, typeOrOpts = "", unitType = "") {
  const opts =
    typeOrOpts && typeof typeOrOpts === "object"
      ? typeOrOpts
      : { type: typeOrOpts, unitType };
  let n = String(name || "").trim();
  if (!n) return "";
  n = n.replace(/\s+/g, " ");
  if (!isUnitCabang(n, opts)) return n;

  if (/^(KC|KCS|KCP|KCK|KCPS)\s/i.test(n)) return n;
  const masterType = String(opts.type || "").toUpperCase();
  const sy = /syariah/i.test(n) || masterType === "SYARIAH";
  if (/koordinator|kordinato|utama/i.test(n)) {
    n = n.replace(/^Cabang\s+/i, "").trim();
    return `KC ${n}`;
  }
  if (/pembantu|capem/i.test(n)) {
    n = n
      .replace(/^Cabang Pembantu Syariah\s+/i, "")
      .replace(/^Cabang Pembantu\s+/i, "")
      .replace(/^Capem\s+/i, "")
      .trim();
    return `${sy ? "KCPS" : "KCP"} ${n}`;
  }
  n = n.replace(/^Cabang Syariah\s+/i, "").replace(/^Cabang\s+/i, "").trim();
  return `${sy ? "KCS" : "KC"} ${n}`;
}

/** @deprecated gunakan formatUnitKerja */
export function formatKantorCabang(name, type = "") {
  return formatUnitKerja(name, { type });
}

function buildRankingSheet(XU, rankingRows, { periodeHead, nameCol, sheetName }) {
  const XS_BLUE = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "2F75B5" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: XS_BORDER,
  };
  const aoa = [
    ["No", "Kode", nameCol, periodeHead, ""],
    ["", "", "", "Total Nilai", "Kategori Nilai"],
    ...rankingRows.map((r, i) => [
      i + 1,
      r.kode != null && r.kode !== "" ? Number(r.kode) || r.kode : "",
      r.kantor || r.unit || "",
      r.skor != null && Number.isFinite(Number(r.skor)) ? round(Number(r.skor), 2) : null,
      r.kategori || "-",
    ]),
  ];
  const ws = XU.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
    { s: { r: 0, c: 3 }, e: { r: 0, c: 4 } },
  ];
  ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 12 }, { wch: 16 }];
  ws["!rows"] = [{ hpt: 22 }, { hpt: 20 }];
  const lastRow = Math.max(rankingRows.length + 1, 1);
  ws["!autofilter"] = { ref: `A2:E${lastRow + 1}` };
  for (let c = 0; c < 5; c++) {
    xsCell(XU, ws, 0, c, XS_BLUE);
    xsCell(XU, ws, 1, c, XS_BLUE);
  }
  rankingRows.forEach((r, i) => {
    const y = 2 + i;
    for (let c = 0; c < 5; c++) {
      const left = c === 2;
      const cell = xsCell(XU, ws, y, c, {
        alignment: { vertical: "center", horizontal: left ? "left" : "center" },
      });
      if (c === 3) cell.z = "0.00";
      if (c === 4) cell.s.font = { ...(cell.s.font || {}), bold: true };
    }
  });
  return { ws, sheetName };
}

/**
 * Satu baris scorecard per KPI unit — nilai identik dengan tabel detail UI KPI Unit:
 * realisasi/target per bulan mentah, pencapaian (hanya bulan ditutup), skor bulan,
 * Target Tahun (resolveTargetTahunNum), YTD, Skor, Status indeks 1–5.
 */
export function buildUnitScorecardRows(rows) {
  const sorted = (rows || []).slice().sort(persSort);
  let totalBobot = 0;
  const out = sorted.map((k0, i) => {
    const k = { ...k0, monthly_data: parseJson(k0.monthly_data), monthly_target: parseJson(k0.monthly_target) };
    const unit = normUnit(k.unit);
    const { pencapaian, hasil, scored, indeks } = scoreKpi(k, unit);
    const w = parseFloat(k.weight) || 0;
    totalBobot += w;
    const md = parseJson(k.monthly_data);
    const mt = parseJson(k.monthly_target);
    const annRaw = parseFloat(String(k.target ?? "").replace(",", "."));
    const targetTahun = unitTargetTahunNum(k);
    const months = MONTHS.map((m) => {
      const closed = kbMonthClosed(m);
      const rawR = md == null ? null : md[m];
      const r = rawR == null || rawR === "" ? null : parseFloat(String(rawR).replace(",", "."));
      const hasR = Number.isFinite(r);
      const rawT = mt == null ? null : mt[m];
      const tDisp = rawT == null || rawT === "" ? null : parseFloat(String(rawT).replace(",", "."));
      // Perhitungan pencapaian: fallback target tahunan → 0 (sama dengan monthPctOrZero UI)
      const tCalc = Number.isFinite(tDisp) ? tDisp : Number.isFinite(annRaw) ? annRaw : 0;
      let pct = null;
      if (closed && hasR) {
        const p = polarityPct(r, tCalc, k.polarity);
        pct = Number.isFinite(p) ? Math.round(p * 100) / 100 : null;
      }
      const skor = closed && pct != null ? unitMonthSkor(k, pct) : null;
      return {
        realisasi: hasR ? r : 0,
        target: Number.isFinite(tDisp) ? tDisp : 0,
        pencapaian: pct,
        skor,
        closed,
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
      weight: Number.isFinite(Number(k.weight)) ? Number(bobotLabel(k.weight)) : null,
      target: targetTahun != null ? targetTahun : 0,
      months,
      scored,
      ytd: scored ? pencapaian : null,
      skor: scored ? hasil : null,
      indeks: scored && info.indeks > 0 ? info.indeks : 0,
      status: scored && info.indeks > 0 ? info.predikat : "",
    };
  });
  return { rows: out, totalBobot: round(totalBobot, 2) };
}

/** Report scorecard lengkap satu unit (Excel + PDF) dari baris KPI unit. */
export function buildUnitReport(unitName, rows, meta = {}) {
  const parsed = (rows || []).map((k) => ({ ...k, monthly_data: parseJson(k.monthly_data), monthly_target: parseJson(k.monthly_target) }));
  const st = statsKpis(parsed);
  const skorAkhir = st.scoredCount > 0 ? Number(st.skorAkhir) || 0 : 0;
  const nilai = skorAkhir > 0 ? kbNilaiAkhir(skorAkhir) : { kategori: "-" };
  const { rows: body, totalBobot } = buildUnitScorecardRows(parsed);
  const indeksAkhir = skorAkhir > 0 ? (skorAkhir < 1.5 ? 1 : skorAkhir < 2.5 ? 2 : skorAkhir < 3.5 ? 3 : skorAkhir < 4.5 ? 4 : 5) : 0;
  return {
    pegawai: {
      unit_name: unitName,
      kantor: meta.kantor || unitName,
      tipe: meta.tipe || "",
      jabatan: meta.jabatan || "",
      name: meta.leader || meta.name || "",
    },
    rows: body,
    totals: {
      totalBobot,
      totalSkor: round(skorAkhir, 2),
      avgYtd: st.pencapaianTotal || 0,
      indeks: indeksAkhir,
      kategori: skorAkhir > 0 ? nilai.kategori : "-",
      status: skorAkhir > 0 ? nilai.kategori : "",
      scoredCount: st.scoredCount || 0,
      kpiTotal: (rows || []).length,
    },
  };
}

/**
 * Tambahkan sheet scorecard detail per unit ke workbook ranking.
 * Layout sama dengan UI: Perspektif | KPI | Satuan | Bobot | Target Tahun |
 * 12 × (Realisasi, Target, Pencapaian %, Skor) | YTD | Skor | Status.
 */
export function appendUnitScorecardSheets(XU, wb, ce, opts = {}) {
  const monthLabel = opts.monthLabel || nilaiPeriodeMonthLabel();
  const year = opts.year || new Date().getFullYear();
  const used = new Set(wb.SheetNames.map((n) => String(n).toLowerCase()));
  const NC = 56; // 5 tetap + 48 bulan + 3 ekor
  const XS_SUB4 = ["DBEAFE", "E0F2FE", "D1FAE5", "EDE9FE"];
  Object.entries(ce || {}).forEach(([unitName, rows]) => {
    if (!Array.isArray(rows) || !rows.length) return;
    const rep = buildUnitReport(unitName, rows, opts.metaFor ? opts.metaFor(unitName, rows) : {});
    const st = rep.totals;
    const head = [
      [`KPI UNIT — ${String(unitName).toUpperCase()} TAHUN ${year}`],
      ["Sumber", "Scorecard KPI Unit (sama dengan tampilan halaman KPI Unit)"],
      ["Nilai periode", monthLabel],
      ["Skor Akhir", st.totalSkor, "Status", st.kategori || "-", "KPI berdata", `${st.scoredCount || 0}/${st.kpiTotal || rows.length}`],
      ["Bobot total (%)", st.totalBobot],
      [`Diekspor: ${new Date().toLocaleString("id-ID")}`],
    ];
    const h0 = head.length + 1;
    const top = ["Perspektif", "KPI", "Satuan", "Bobot (%)", `Target Tahun ${year}`];
    const sub = ["", "", "", "", ""];
    MONTHS.forEach((m) => {
      top.push(m, "", "", "");
      sub.push("Realisasi", "Target", "Pencapaian (%)", "Skor");
    });
    top.push("YTD (%)", "Skor", "Status");
    sub.push("", "", "");
    const body = rep.rows.map((row) => {
      const line = [row.perspective, row.name, unitLabel(row.unit), row.weight != null ? Number(row.weight) : null, row.target];
      row.months.forEach((m) => line.push(m.realisasi, m.target, m.pencapaian != null ? round(m.pencapaian, 2) : null, m.skor != null ? round(m.skor, 2) : null));
      line.push(row.ytd != null ? round(row.ytd, 2) : null, row.skor != null ? round(row.skor, 2) : null, row.status || "—");
      return line;
    });
    const total = ["TOTAL", "", "", st.totalBobot, null];
    MONTHS.forEach(() => total.push(null, null, null, null));
    total.push(st.avgYtd > 0 ? round(st.avgYtd, 1) : null, st.totalSkor, st.kategori || "");

    const ws = XU.aoa_to_sheet([...head, [], top, sub, ...body, total]);
    const merges = [];
    for (let c = 0; c < 5; c++) merges.push({ s: { r: h0, c }, e: { r: h0 + 1, c } });
    MONTHS.forEach((_, i) => merges.push({ s: { r: h0, c: 5 + i * 4 }, e: { r: h0, c: 8 + i * 4 } }));
    for (let c = 53; c < 56; c++) merges.push({ s: { r: h0, c }, e: { r: h0 + 1, c } });
    let start = 0;
    rep.rows.forEach((row, i) => {
      const next = rep.rows[i + 1];
      if (!next || next.perspectiveKey !== row.perspectiveKey) {
        if (i > start) merges.push({ s: { r: h0 + 2 + start, c: 0 }, e: { r: h0 + 2 + i, c: 0 } });
        start = i + 1;
      }
    });
    const totalRow = h0 + 2 + rep.rows.length;
    merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 2 } });
    ws["!merges"] = merges;
    ws["!cols"] = [22, 45, 12, 9, 16, ...MONTHS.flatMap(() => [11, 11, 12, 9]), 9, 8, 14].map((wch) => ({ wch }));

    ws.A1.s = { font: { bold: true, sz: 14 } };
    for (let i = 1; i < head.length; i++) {
      const c0 = XU.encode_cell({ r: i, c: 0 });
      if (ws[c0]) ws[c0].s = { font: { bold: true } };
    }
    for (let c = 0; c < NC; c++) {
      xsCell(XU, ws, h0, c, XS_HEAD);
      const sub = c >= 5 && c < 53 ? XS_SUB4[(c - 5) % 4] : null;
      xsCell(XU, ws, h0 + 1, c, sub ? { ...XS_HEAD, fill: { patternType: "solid", fgColor: { rgb: sub } } } : XS_HEAD);
    }
    rep.rows.forEach((row, i) => {
      const y = h0 + 2 + i;
      const fmt = XS_NUMFMT[row.unitKind] || "General";
      for (let c = 0; c < NC; c++) {
        const left = c === 0 || c === 1 || c === 2;
        const cell = xsCell(XU, ws, y, c, {
          alignment: { vertical: "center", horizontal: left ? "left" : "center", wrapText: c === 0 || c === 1 },
        });
        if (c === 1) cell.s.font = { bold: true };
        const inMonth = c >= 5 && c < 53;
        const inMonthNum = inMonth && (c - 5) % 4 < 2;
        if (c === 4 || inMonthNum) cell.z = fmt;
        if (inMonth && (c - 5) % 4 === 2) {
          cell.z = "0.00";
          const p = row.months[Math.floor((c - 5) / 4)].pencapaian;
          if (p != null && p >= 100) cell.s.font = { color: { rgb: "047857" } };
          else if (p != null && p > 0 && p < 80) cell.s.font = { color: { rgb: "B45309" } };
        }
        if (inMonth && (c - 5) % 4 === 3) cell.z = "0.00";
        if (c === 53 || c === 54) cell.z = "0.00";
        if (c === 53 || c === 55) xsIndeks(cell, row.indeks);
      }
    });
    for (let c = 0; c < NC; c++) {
      const cell = xsCell(XU, ws, totalRow, c, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
        alignment: { vertical: "center", horizontal: c === 0 ? "left" : "center" },
      });
      if (c === 3) {
        const ok = Math.abs((st.totalBobot || 0) - 100) <= 0.1;
        cell.s.fill = { patternType: "solid", fgColor: { rgb: ok ? "D1FAE5" : "FEE2E2" } };
      }
      if (c === 53 || c === 54) cell.z = "0.00";
      if (c === 53 || c === 55) xsIndeks(cell, st.indeks);
    }
    ws["!rows"] = [];
    ws["!rows"][h0] = { hpt: 20 };
    ws["!rows"][h0 + 1] = { hpt: 18 };

    const base = String(unitName).replace(/[\[\]:*?\/\\]/g, "").trim().slice(0, 31) || "Unit";
    let name = base, n2 = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 27)} (${n2++})`;
    used.add(name.toLowerCase());
    XU.book_append_sheet(wb, ws, name);
  });
  return wb;
}

/**
 * Workbook ranking unit — 2 sheet:
 * 1) Unit Kerja (Divisi / Departemen / UKK / Unit / dll.)
 * 2) Kantor Cabang (KC / KCK / KCP)
 */
export function buildUnitRankingWorkbook(XU, rankingRows = [], opts = {}) {
  const bulan = opts.monthLabel || nilaiPeriodeMonthLabel();
  const periodeHead = `Nilai periode ${bulan}`;
  const wb = XU.book_new();

  const pusat = [];
  const cabang = [];
  for (const r of rankingRows) {
    const name = r.unit || r.kantor || "";
    const cab =
      r.isCabang != null
        ? !!r.isCabang
        : isUnitCabang(name, { type: r.masterType || r.type || "", unitType: r.unitType || "" });
    (cab ? cabang : pusat).push(r);
  }

  const s1 = buildRankingSheet(XU, pusat, {
    periodeHead,
    nameCol: "Unit Kerja",
    sheetName: "Unit Kerja",
  });
  XU.book_append_sheet(wb, s1.ws, s1.sheetName);

  const s2 = buildRankingSheet(XU, cabang, {
    periodeHead,
    nameCol: "Kantor Cabang",
    sheetName: "Kantor Cabang",
  });
  XU.book_append_sheet(wb, s2.ws, s2.sheetName);

  return wb;
}
