/**
 * Edit Realisasi & Target KPI Unit — khusus role superadmin.
 */
import { r as React, j as e, aD as SearchIcon } from "./ui-Bxdhc9mB.js";
import { I as Input, B as Button, a as api, u as useAuth, t as toast } from "./index-CdyJlLvAQ.js";
import { u as useQuery, b as useQueryClient } from "./query-7fhvqgVT.js";
import { S as Skeleton } from "./skeleton-7xRvmPlJ.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BgJbFb_v.js";
import { C as Card, c as CardContent } from "./card-jQ2tvwnD.js";
import { P as PageHeader } from "./PageHeader-DdzXL2rh.js";
import { g as persLabel } from "./kpi-perspective-fFNWJAaz.js";
import { n as normUnit, g as unitLabel } from "./kpi-units-Bpgxx_sX.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const UNIT_TYPES = [
  { value: "all", label: "Semua tipe" },
  { value: "divisi", label: "Divisi" },
  { value: "departemen", label: "Departemen" },
  { value: "ukk", label: "UKK" },
  { value: "unit", label: "Unit" },
  { value: "project", label: "Project" },
  { value: "kck", label: "KCK" },
  { value: "kc", label: "KC" },
  { value: "kcp", label: "KCP / Capem / KK" },
];

function parseJson(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v) || {};
  } catch {
    return {};
  }
}

function fmtCell(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function EditDialog({ open, kpi, onClose, onSaved }) {
  const [md, setMd] = React.useState({});
  const [mt, setMt] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !kpi) return;
    setMd({ ...parseJson(kpi.monthly_data) });
    setMt({ ...parseJson(kpi.monthly_target) });
  }, [open, kpi]);

  if (!open || !kpi) return null;

  const setVal = (month, field, raw) => {
    const next = String(raw ?? "");
    if (field === "realisasi") setMd((p) => ({ ...p, [month]: next }));
    else setMt((p) => ({ ...p, [month]: next }));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const monthly_data = {};
      const monthly_target = {};
      for (const m of MONTHS) {
        if (md[m] !== "" && md[m] != null) {
          const n = parseFloat(String(md[m]).replace(",", "."));
          if (!Number.isFinite(n)) throw new Error(`Realisasi ${m} harus angka`);
          monthly_data[m] = n;
        } else monthly_data[m] = "";
        if (mt[m] !== "" && mt[m] != null) {
          const n = parseFloat(String(mt[m]).replace(",", "."));
          if (!Number.isFinite(n)) throw new Error(`Target ${m} harus angka`);
          monthly_target[m] = n;
        } else monthly_target[m] = "";
      }
      await api.updateKpiRealisasi(kpi.id, { monthly_data, monthly_target });
      toast.success("Realisasi & target KPI Unit tersimpan");
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      toast.error(err?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const grid = {
    display: "grid",
    gridTemplateColumns: `72px repeat(12, minmax(64px, 1fr))`,
    gap: 4,
    alignItems: "center",
  };

  return e.jsx("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 80,
      background: "rgba(11,27,51,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    onClick: (ev) => {
      if (ev.target === ev.currentTarget && !saving) onClose && onClose();
    },
    children: e.jsxs("div", {
      style: {
        width: "min(1120px, 96vw)",
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 20px 50px rgba(0,0,0,.35)",
        overflow: "hidden",
      },
      onClick: (ev) => ev.stopPropagation(),
      children: [
        e.jsxs("div", {
          className: "bg-[#0f2744] text-white px-4 py-3",
          children: [
            e.jsx("h2", { className: "text-sm font-semibold", children: "Edit Realisasi & Target — KPI Unit" }),
            e.jsx("p", {
              className: "text-[11px] text-white/70 mt-0.5 truncate",
              children: `${kpi.name || ""} · ${kpi.unit_name || ""}`,
            }),
          ],
        }),
        e.jsxs("div", {
          className: "p-4 space-y-3",
          children: [
            e.jsxs("div", {
              className: "rounded-md border border-slate-200 p-2 space-y-2 overflow-x-auto",
              children: [
                e.jsxs("div", {
                  style: grid,
                  children: [
                    e.jsx("div", { className: "text-[11px] font-semibold text-slate-600", children: "Bulan" }),
                    ...MONTHS.map((m) =>
                      e.jsx("div", { className: "text-[11px] font-semibold text-slate-700 text-center", children: m }, "h-" + m)
                    ),
                  ],
                }),
                e.jsxs("div", {
                  style: grid,
                  children: [
                    e.jsx("div", { className: "text-[11px] font-semibold text-slate-600", children: "Realisasi" }),
                    ...MONTHS.map((m) =>
                      e.jsx(
                        Input,
                        {
                          type: "text",
                          inputMode: "decimal",
                          className: "h-8 text-xs px-1 text-center",
                          value: md[m] ?? "",
                          onChange: (ev) => setVal(m, "realisasi", ev.target.value),
                        },
                        "r-" + m
                      )
                    ),
                  ],
                }),
                e.jsxs("div", {
                  style: grid,
                  children: [
                    e.jsx("div", { className: "text-[11px] font-semibold text-slate-600", children: "Target" }),
                    ...MONTHS.map((m) =>
                      e.jsx(
                        Input,
                        {
                          type: "text",
                          inputMode: "decimal",
                          className: "h-8 text-xs px-1 text-center",
                          value: mt[m] ?? "",
                          onChange: (ev) => setVal(m, "target", ev.target.value),
                        },
                        "t-" + m
                      )
                    ),
                  ],
                }),
              ],
            }),
            e.jsx("p", {
              className: "text-[11px] text-slate-500",
              children: "Khusus superadmin — boleh mengubah semua bulan (termasuk yang sudah tutup buku di Periode & Kalender).",
            }),
            e.jsxs("div", {
              className: "flex gap-2 pt-1",
              children: [
                e.jsx(Button, {
                  type: "button",
                  variant: "outline",
                  className: "flex-1",
                  disabled: saving,
                  onClick: () => onClose && onClose(),
                  children: "Batal",
                }),
                e.jsx(Button, {
                  type: "button",
                  className: "flex-1 bg-blue-600 hover:bg-blue-700 text-white",
                  disabled: saving,
                  onClick: doSave,
                  children: saving ? "Menyimpan…" : "Simpan",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}

function matchType(unitType, filter) {
  if (filter === "all") return true;
  const t = String(unitType || "").toLowerCase();
  if (filter === "kcp") return t === "kcp" || t === "kk" || t.includes("pembantu");
  return t === filter;
}

export default function KPIUnitEditSA() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSA = (user?.role || "") === "superadmin";

  const [q, setQ] = React.useState("");
  const [tipe, setTipe] = React.useState("all");
  const [unitName, setUnitName] = React.useState("all");
  const [show, setShow] = React.useState(false);
  const [editKpi, setEditKpi] = React.useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["kpis", "unit-edit-sa"],
    queryFn: () => api.getKpis({ fields: "score" }),
    enabled: isSA,
  });

  const unitRows = React.useMemo(
    () =>
      (rows || []).filter((r) => {
        const t = String(r.unit_type || "").toLowerCase();
        return t && t !== "pegawai" && t !== "master";
      }),
    [rows]
  );

  const unitOptions = React.useMemo(() => {
    const set = new Map();
    for (const r of unitRows) {
      if (!matchType(r.unit_type, tipe)) continue;
      const n = r.unit_name || "";
      if (n) set.set(n, n);
    }
    return [...set.keys()].sort((a, b) => a.localeCompare(b, "id"));
  }, [unitRows, tipe]);

  const filtered = React.useMemo(() => {
    if (!show) return [];
    const qq = q.trim().toLowerCase();
    return unitRows
      .filter((r) => matchType(r.unit_type, tipe))
      .filter((r) => unitName === "all" || r.unit_name === unitName)
      .filter((r) => !qq || String(r.name || "").toLowerCase().includes(qq) || String(r.unit_name || "").toLowerCase().includes(qq))
      .sort(
        (a, b) =>
          String(a.unit_name || "").localeCompare(String(b.unit_name || ""), "id") ||
          String(a.name || "").localeCompare(String(b.name || ""), "id")
      );
  }, [unitRows, tipe, unitName, q, show]);

  if (!isSA) {
    return e.jsxs("div", {
      className: "p-8 text-center space-y-2",
      children: [
        e.jsx("h2", { className: "text-lg font-semibold text-slate-800", children: "Akses ditolak" }),
        e.jsx("p", { className: "text-sm text-slate-500", children: "Menu ini hanya untuk role Superadmin." }),
      ],
    });
  }

  return e.jsxs("div", {
    className: "space-y-4 pb-8",
    children: [
      e.jsx(PageHeader, {
        eyebrow: "KPI Unit",
        title: "Edit Realisasi & Target Unit",
        subtitle: "Ubah realisasi dan target bulanan KPI Unit Kerja / Kantor Cabang (khusus Superadmin).",
      }),
      e.jsx(Card, {
        className: "border shadow-sm",
        children: e.jsxs(CardContent, {
          className: "p-4 flex flex-wrap gap-3 items-end",
          children: [
            e.jsxs("div", {
              className: "relative flex-1 min-w-[200px] max-w-sm",
              children: [
                e.jsx(SearchIcon, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }),
                e.jsx(Input, {
                  className: "pl-9",
                  placeholder: "Cari nama KPI / unit…",
                  value: q,
                  onChange: (ev) => setQ(ev.target.value),
                }),
              ],
            }),
            e.jsxs(Select, {
              value: tipe,
              onValueChange: (v) => {
                setTipe(v);
                setUnitName("all");
                setShow(false);
              },
              children: [
                e.jsx(SelectTrigger, { className: "w-[180px]", children: e.jsx(SelectValue, {}) }),
                e.jsx(SelectContent, {
                  children: UNIT_TYPES.map((t) => e.jsx(SelectItem, { value: t.value, children: t.label }, t.value)),
                }),
              ],
            }),
            e.jsxs(Select, {
              value: unitName,
              onValueChange: (v) => {
                setUnitName(v);
                setShow(false);
              },
              children: [
                e.jsx(SelectTrigger, { className: "w-[240px]", children: e.jsx(SelectValue, { placeholder: "Pilih unit" }) }),
                e.jsxs(SelectContent, {
                  children: [
                    e.jsx(SelectItem, { value: "all", children: "Semua unit" }),
                    ...unitOptions.map((n) => e.jsx(SelectItem, { value: n, children: n }, n)),
                  ],
                }),
              ],
            }),
            e.jsx(Button, {
              className: "bg-blue-600 hover:bg-blue-700",
              onClick: () => setShow(true),
              children: "Tampilkan",
            }),
          ],
        }),
      }),
      isLoading
        ? e.jsx("div", {
            className: "space-y-2",
            children: [1, 2, 3, 4, 5].map((i) => e.jsx(Skeleton, { className: "h-12 w-full" }, i)),
          })
        : !show
          ? e.jsx("div", {
              className: "text-center py-16 border border-dashed rounded-xl text-slate-500 text-sm",
              children: 'Pilih filter lalu klik "Tampilkan".',
            })
          : filtered.length === 0
            ? e.jsx("div", {
                className: "text-center py-16 border border-dashed rounded-xl text-slate-500 text-sm",
                children: "Tidak ada KPI Unit yang cocok.",
              })
            : e.jsx("div", {
                className: "bg-white border rounded-xl overflow-hidden shadow-sm",
                children: e.jsxs("div", {
                  className: "overflow-x-auto",
                  children: [
                    e.jsxs("table", {
                      className: "w-full text-sm",
                      children: [
                        e.jsx("thead", {
                          className: "bg-slate-100 text-slate-700",
                          children: e.jsxs("tr", {
                            children: [
                              e.jsx("th", { className: "text-left px-3 py-2 border-b", children: "Unit" }),
                              e.jsx("th", { className: "text-left px-3 py-2 border-b", children: "Tipe" }),
                              e.jsx("th", { className: "text-left px-3 py-2 border-b", children: "KPI" }),
                              e.jsx("th", { className: "text-left px-3 py-2 border-b", children: "Perspektif" }),
                              e.jsx("th", { className: "text-center px-3 py-2 border-b", children: "Satuan" }),
                              e.jsx("th", { className: "text-center px-3 py-2 border-b", children: "Okt R" }),
                              e.jsx("th", { className: "text-center px-3 py-2 border-b", children: "Okt T" }),
                              e.jsx("th", { className: "text-center px-3 py-2 border-b", children: "Aksi" }),
                            ],
                          }),
                        }),
                        e.jsx("tbody", {
                          children: filtered.map((r) => {
                            const md = parseJson(r.monthly_data);
                            const mt = parseJson(r.monthly_target);
                            return e.jsxs(
                              "tr",
                              {
                                className: "border-t hover:bg-slate-50",
                                children: [
                                  e.jsx("td", { className: "px-3 py-2 font-medium text-slate-800", children: r.unit_name }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-xs uppercase text-slate-500",
                                    children: r.unit_type,
                                  }),
                                  e.jsx("td", { className: "px-3 py-2 text-blue-900", children: r.name }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-xs text-slate-600",
                                    children: persLabel(r.perspective),
                                  }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-center text-xs",
                                    children: unitLabel(normUnit(r.unit)) || r.unit || "—",
                                  }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-center tabular-nums",
                                    children: fmtCell(md.Okt),
                                  }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-center tabular-nums text-slate-500",
                                    children: fmtCell(mt.Okt),
                                  }),
                                  e.jsx("td", {
                                    className: "px-3 py-2 text-center",
                                    children: e.jsx(Button, {
                                      size: "sm",
                                      variant: "outline",
                                      className: "h-7 text-xs",
                                      onClick: () => setEditKpi(r),
                                      children: "Edit R/T",
                                    }),
                                  }),
                                ],
                              },
                              r.id
                            );
                          }),
                        }),
                      ],
                    }),
                    e.jsxs("div", {
                      className: "px-3 py-2 text-xs text-slate-500 border-t bg-slate-50",
                      children: [filtered.length, " KPI ditampilkan"],
                    }),
                  ],
                }),
              }),
      e.jsx(EditDialog, {
        open: !!editKpi,
        kpi: editKpi,
        onClose: () => setEditKpi(null),
        onSaved: () => {
          qc.invalidateQueries({ queryKey: ["kpis"] });
        },
      }),
    ],
  });
}
