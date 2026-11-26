import { r as React, j as h, bm as IconXlsx, F as IconCsv, aN as IconPdf, q as IconDownload } from "./ui-Bxdhc9mB.js";
import { u as useQuery } from "./query-7fhvqgVT.js";
import { u as useAuth, c as cn, B as Button, t as toast, a as api } from "./index-CdyJlLvAQ.js";
import { C as Card, a as CardHeader, b as CardTitle, c as CardContent } from "./card-jQ2tvwnD.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BgJbFb_v.js";
import { UNIT_TYPES, matchUnitType, buildReports, buildWorkbook, buildCsvRows, toCsv, buildPdf, safeFilePart, fmtPct } from "./kpi-individu-export-Core01.js";

const FORMATS = [
  { id: "xlsx", label: "Excel", ext: ".xlsx · 1 sheet per pegawai", icon: IconXlsx },
  { id: "pdf", label: "PDF", ext: ".pdf · 1 halaman per pegawai", icon: IconPdf },
  { id: "csv", label: "CSV", ext: ".csv · gabungan semua pegawai", icon: IconCsv },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function Field({ label, children }) {
  return h.jsxs("div", { children: [h.jsx("p", { className: "text-xs font-semibold text-slate-500 mb-1.5", children: label }), children] });
}

function KpiIndividuExportCard({ defaultYear }) {
  const { user } = useAuth();
  const isUser = user?.role === "user";
  const [unitType, setUnitType] = React.useState("all");
  const [unitName, setUnitName] = React.useState(isUser && user?.unit_name ? user.unit_name : "all");
  const [pegawaiId, setPegawaiId] = React.useState("all");
  const [year, setYear] = React.useState(defaultYear || String(new Date().getFullYear()));
  const [format, setFormat] = React.useState("xlsx");
  const [paper, setPaper] = React.useState("a4");
  const [busy, setBusy] = React.useState(false);

  const { data: kpis = [], isLoading: loadingKpi } = useQuery({ queryKey: ["kpis", "laporan"], queryFn: () => api.get("/kpis?fields=score") });
  const { data: pegawaiRaw = [], isLoading: loadingPeg } = useQuery({ queryKey: ["pegawai", "laporan-individu"], queryFn: () => api.getPegawai() });
  const pegawai = Array.isArray(pegawaiRaw) ? pegawaiRaw : [];

  const scopedPegawai = React.useMemo(
    () => (isUser ? pegawai.filter((p) => p.unit_name === user?.unit_name) : pegawai),
    [pegawai, isUser, user]
  );

  const allReports = React.useMemo(() => buildReports(scopedPegawai, kpis, { unitType: "all" }), [scopedPegawai, kpis]);

  const unitOptions = React.useMemo(
    () => [...new Set(allReports.map((r) => r.pegawai.unit_name))].filter((u) => matchUnitType(u, unitType)).sort((a, b) => a.localeCompare(b, "id")),
    [allReports, unitType]
  );

  const reports = React.useMemo(
    () => allReports.filter((r) => (unitName === "all" ? matchUnitType(r.pegawai.unit_name, unitType) : r.pegawai.unit_name === unitName)),
    [allReports, unitType, unitName]
  );

  const selected = React.useMemo(
    () => (pegawaiId === "all" ? reports : reports.filter((r) => String(r.pegawai.id) === String(pegawaiId))),
    [reports, pegawaiId]
  );

  React.useEffect(() => {
    if (unitName !== "all" && !unitOptions.includes(unitName) && !isUser) setUnitName("all");
  }, [unitOptions, unitName, isUser]);
  React.useEffect(() => {
    if (pegawaiId !== "all" && !reports.some((r) => String(r.pegawai.id) === String(pegawaiId))) setPegawaiId("all");
  }, [reports, pegawaiId]);

  const fileBase = () => {
    if (selected.length === 1) return `KPI_Individu_${selected[0].pegawai.npp || safeFilePart(selected[0].pegawai.name)}_${year}`;
    const scope = unitName !== "all" ? unitName : unitType !== "all" ? UNIT_TYPES.find((t) => t.value === unitType)?.label : "Semua";
    return `KPI_Individu_${safeFilePart(scope)}_${year}`;
  };

  const runExport = async () => {
    if (!selected.length) {
      toast.error("Tidak ada pegawai dengan KPI pada filter ini");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const base = fileBase();
      if (format === "xlsx") {
        const XS = await import("./xlsx-style-01.js");
        XS.writeFile(buildWorkbook(XS.utils, selected, year), `${base}.xlsx`);
      } else if (format === "csv") {
        downloadBlob(new Blob([toCsv(buildCsvRows(selected, year))], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else {
        const mod = await import("./KPIIndividu-MonthLine03.js");
        buildPdf(mod.P, selected, year, paper).save(`${base}.pdf`);
      }
      toast.success(`Export ${selected.length} pegawai berhasil diunduh`);
    } catch (err) {
      console.error("Export KPI Individu error:", err);
      toast.error("Gagal membuat file export. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const loading = loadingKpi || loadingPeg;
  const preview = selected.slice(0, 5);

  return h.jsxs(Card, {
    className: "border shadow-sm",
    children: [
      h.jsxs(CardHeader, {
        className: "pb-3 border-b bg-slate-50/80",
        children: [
          h.jsx(CardTitle, { className: "text-base font-bold text-slate-800", children: "Export KPI Individu" }),
          h.jsx("p", {
            className: "text-xs text-slate-500 mt-0.5",
            children: "Scorecard bulanan per pegawai (Realisasi, Target, Pencapaian, YTD, Skor, Status) — export sekaligus semua pegawai sesuai filter",
          }),
        ],
      }),
      h.jsxs(CardContent, {
        className: "p-4 space-y-5",
        children: [
          h.jsxs("div", {
            className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-3",
            children: [
              h.jsx(Field, {
                label: "Tipe Unit",
                children: h.jsxs(Select, {
                  value: unitType,
                  onValueChange: setUnitType,
                  disabled: isUser,
                  children: [
                    h.jsx(SelectTrigger, { className: "bg-white", children: h.jsx(SelectValue, {}) }),
                    h.jsx(SelectContent, { children: UNIT_TYPES.map((t) => h.jsx(SelectItem, { value: t.value, children: t.label }, t.value)) }),
                  ],
                }),
              }),
              h.jsx(Field, {
                label: "Unit Kantor",
                children: h.jsxs(Select, {
                  value: unitName,
                  onValueChange: setUnitName,
                  disabled: isUser,
                  children: [
                    h.jsx(SelectTrigger, { className: "bg-white", children: h.jsx(SelectValue, {}) }),
                    h.jsxs(SelectContent, {
                      children: [
                        !isUser && h.jsx(SelectItem, { value: "all", children: "Semua Unit" }),
                        ...(isUser && user?.unit_name ? [user.unit_name] : unitOptions).map((u) => h.jsx(SelectItem, { value: u, children: u }, u)),
                      ],
                    }),
                  ],
                }),
              }),
              h.jsx(Field, {
                label: "Pegawai",
                children: h.jsxs(Select, {
                  value: pegawaiId,
                  onValueChange: setPegawaiId,
                  children: [
                    h.jsx(SelectTrigger, { className: "bg-white", children: h.jsx(SelectValue, {}) }),
                    h.jsxs(SelectContent, {
                      children: [
                        h.jsx(SelectItem, { value: "all", children: `Semua Pegawai (${reports.length})` }),
                        ...reports.map((r) =>
                          h.jsx(SelectItem, { value: String(r.pegawai.id), children: `${r.pegawai.name} — ${r.pegawai.unit_name}` }, r.pegawai.id)
                        ),
                      ],
                    }),
                  ],
                }),
              }),
              h.jsx(Field, {
                label: "Tahun",
                children: h.jsxs(Select, {
                  value: year,
                  onValueChange: setYear,
                  children: [
                    h.jsx(SelectTrigger, { className: "bg-white", children: h.jsx(SelectValue, {}) }),
                    h.jsx(SelectContent, { children: ["2025", "2026", "2027"].map((y) => h.jsx(SelectItem, { value: y, children: y }, y)) }),
                  ],
                }),
              }),
            ],
          }),
          h.jsxs("div", {
            children: [
              h.jsx("p", { className: "text-xs font-semibold text-slate-500 mb-2", children: "Format" }),
              h.jsx("div", {
                className: "grid grid-cols-1 sm:grid-cols-3 gap-3",
                children: FORMATS.map((f) =>
                  h.jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => setFormat(f.id),
                      className: cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                        format === f.id ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 hover:border-slate-300 text-slate-600"
                      ),
                      children: [
                        h.jsx(f.icon, { className: "w-7 h-7" }),
                        h.jsx("span", { className: "text-sm font-semibold", children: f.label }),
                        h.jsx("span", { className: "text-[10px] opacity-70", children: f.ext }),
                      ],
                    },
                    f.id
                  )
                ),
              }),
              format === "pdf" &&
                h.jsxs("div", {
                  className: "flex items-center gap-2 mt-3 text-sm text-slate-700",
                  children: [
                    h.jsx("span", { className: "text-xs font-semibold text-slate-500", children: "Ukuran kertas:" }),
                    ...[
                      ["a4", "A4 Landscape"],
                      ["a3", "A3 Landscape (lebih besar)"],
                    ].map(([v, l]) =>
                      h.jsxs(
                        "label",
                        {
                          className: "flex items-center gap-1.5 cursor-pointer",
                          style: { marginRight: 12 },
                          children: [h.jsx("input", { type: "radio", name: "kb-ind-paper", checked: paper === v, onChange: () => setPaper(v) }), l],
                        },
                        v
                      )
                    ),
                  ],
                }),
            ],
          }),
          h.jsxs("div", {
            children: [
              h.jsx("p", {
                className: "text-xs font-semibold text-slate-500 mb-2",
                children: loading ? "Memuat data…" : `Preview — ${selected.length} pegawai akan diekspor${selected.length > 5 ? " (5 pertama)" : ""}`,
              }),
              h.jsx("div", {
                className: "border rounded-lg overflow-x-auto",
                children: h.jsxs("table", {
                  className: "w-full text-xs",
                  style: { minWidth: 640 },
                  children: [
                    h.jsx("thead", {
                      className: "bg-slate-50 text-slate-500",
                      children: h.jsxs("tr", {
                        children: [
                          h.jsx("th", { className: "px-2 py-1.5 text-left", children: "No" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-left", children: "Pegawai" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-left", children: "Unit Kerja" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-right", children: "KPI" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-right", children: "YTD" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-right", children: "Skor" }),
                          h.jsx("th", { className: "px-2 py-1.5 text-left", children: "Status" }),
                        ],
                      }),
                    }),
                    h.jsx("tbody", {
                      children: preview.length
                        ? preview.map((r, i) =>
                            h.jsxs(
                              "tr",
                              {
                                className: "border-t",
                                children: [
                                  h.jsx("td", { className: "px-2 py-1.5", children: i + 1 }),
                                  h.jsxs("td", {
                                    className: "px-2 py-1.5",
                                    children: [
                                      h.jsx("p", { className: "font-medium text-slate-800", children: r.pegawai.name }),
                                      h.jsx("p", { className: "text-slate-500", style: { fontSize: 10 }, children: `${r.pegawai.npp || "-"} · ${r.pegawai.jabatan || "-"}` }),
                                    ],
                                  }),
                                  h.jsx("td", { className: "px-2 py-1.5", children: r.pegawai.unit_name }),
                                  h.jsx("td", { className: "px-2 py-1.5 text-right tabular-nums", children: r.rows.length }),
                                  h.jsx("td", { className: "px-2 py-1.5 text-right tabular-nums", children: r.totals.avgYtd > 0 ? fmtPct(r.totals.avgYtd) : "—" }),
                                  h.jsx("td", { className: "px-2 py-1.5 text-right tabular-nums", children: r.totals.totalSkor.toFixed(2) }),
                                  h.jsx("td", { className: "px-2 py-1.5", children: r.totals.status || "—" }),
                                ],
                              },
                              r.pegawai.id
                            )
                          )
                        : h.jsx("tr", {
                            children: h.jsx("td", {
                              colSpan: 7,
                              className: "px-2 py-6 text-center text-slate-400",
                              children: loading ? "Memuat…" : "Tidak ada pegawai dengan KPI pada filter ini",
                            }),
                          }),
                    }),
                  ],
                }),
              }),
            ],
          }),
          h.jsx("div", {
            className: "flex justify-end pt-2",
            children: h.jsxs(Button, {
              className: "bg-blue-600 hover:bg-blue-700",
              onClick: runExport,
              disabled: busy || loading || !selected.length,
              children: [
                h.jsx(IconDownload, { className: "w-4 h-4 mr-1.5" }),
                busy ? " Memproses…" : selected.length > 1 ? ` Export ${selected.length} Pegawai` : " Export KPI Individu",
              ],
            }),
          }),
        ],
      }),
    ],
  });
}

export { KpiIndividuExportCard as K };
