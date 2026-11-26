import { r as c, j as n } from "./ui-Bxdhc9mB.js";
import { r as readWorkbook, u as xlsxUtils, w as writeWorkbook } from "./xlsx-BBWTpfDg.js";
import { B as Button, t as toast, a as api } from "./index-CdyJlLvAQ.js";
import { C as Card, c as CardContent } from "./card-jQ2tvwnD.js";
import { parseKpiIndividuWorkbook, buildKpiIndividuTemplate } from "./kpi-individu-parser-Npp01.js";

const STATUS = {
  ready: { label: "Siap disimpan", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  saved: { label: "Tersimpan", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  unmatched: { label: "Pegawai tidak ditemukan", cls: "bg-red-50 text-red-700 border-red-200" },
  invalid: { label: "Tidak valid", cls: "bg-red-50 text-red-700 border-red-200" },
  conflict: { label: "Konflik unit+jabatan", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  duplicate: { label: "Duplikat", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const MATCH_VIA = { npp: "cocok via NPP", nama: "cocok via nama" };

const PERSPECTIVE_LABEL = {
  financial: "Financial",
  customer: "Customer",
  internal_process: "Internal Business Process",
  learning_growth: "Learning & Growth",
};

function Stat({ label, value, tone }) {
  return n.jsxs("div", {
    className: "rounded-lg border px-3 py-2 " + (tone || "bg-white border-slate-200"),
    children: [
      n.jsx("div", { className: "text-xs text-slate-500", children: label }),
      n.jsx("div", { className: "text-lg font-semibold", children: value }),
    ],
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(new Uint8Array(ev.target.result));
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

function KpiIndividuImport() {
  const fileRef = c.useRef(null);
  const [fileName, setFileName] = c.useState("");
  const [entries, setEntries] = c.useState([]);
  const [skipped, setSkipped] = c.useState([]);
  const [result, setResult] = c.useState(null);
  const [busy, setBusy] = c.useState("");

  const check = async (list) => {
    setBusy("check");
    try {
      setResult(await api.post("/kpis/import-individu", { dryRun: true, entries: list }));
    } catch (err) {
      setResult(null);
      toast.error(err.message || "Gagal memeriksa data");
    } finally {
      setBusy("");
    }
  };

  const onFile = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = null;
    if (!file) return;
    setBusy("parse");
    setResult(null);
    try {
      const wb = readWorkbook(await readFile(file), { type: "array" });
      const parsed = parseKpiIndividuWorkbook(wb, xlsxUtils);
      setFileName(file.name);
      setEntries(parsed.entries);
      setSkipped(parsed.skipped);
      setBusy("");
      if (!parsed.entries.length) {
        toast.error("Tidak ada blok KPI pegawai yang terbaca. Pastikan memakai format template.");
        return;
      }
      await check(parsed.entries);
    } catch (err) {
      setBusy("");
      toast.error("Gagal membaca file: " + (err.message || err));
    }
  };

  const save = async () => {
    const ready = result ? result.summary.ready - result.summary.saved : 0;
    if (!ready) return;
    const ok = window.confirm(
      `Simpan KPI untuk ${ready} pegawai?\n\nKPI individu lama pada unit + jabatan pegawai tersebut akan diganti dengan data dari file.`
    );
    if (!ok) return;
    setBusy("save");
    try {
      const res = await api.post("/kpis/import-individu", { dryRun: false, entries });
      setResult(res);
      toast.success(`${res.summary.saved} pegawai tersimpan (${res.summary.kpis} KPI)`);
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setBusy("");
    }
  };

  const reset = () => {
    setFileName("");
    setEntries([]);
    setSkipped([]);
    setResult(null);
  };

  const downloadTemplate = () => {
    writeWorkbook(buildKpiIndividuTemplate(xlsxUtils), "Template_Upload_KPI_Individu.xlsx");
  };

  const summary = result && result.summary;
  const pending = summary ? summary.ready - summary.saved : 0;
  const rows = result ? result.results : [];

  return n.jsxs("div", {
    className: "space-y-6",
    children: [
      n.jsx(Card, {
        className: "border-dashed border-2 bg-slate-50/50",
        children: n.jsxs(CardContent, {
          className: "flex flex-col items-center justify-center py-10 text-center",
          children: [
            n.jsx("h3", { className: "text-lg font-semibold mb-2", children: "Upload File Excel KPI Individu" }),
            n.jsx("p", {
              className: "text-sm text-slate-500 mb-4 max-w-2xl",
              children:
                "Tidak perlu memilih unit kantor atau jabatan. Sistem mencocokkan setiap blok pegawai di file dengan data pegawai berdasarkan NPP, nama, dan jabatan.",
            }),
            n.jsxs("div", {
              className: "bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-left max-w-2xl",
              children: [
                n.jsx("h3", { className: "font-semibold text-blue-900 mb-2 text-sm", children: "Petunjuk Upload:" }),
                n.jsxs("ul", {
                  className: "list-disc list-inside text-xs text-blue-800 space-y-1",
                  children: [
                    n.jsx("li", {
                      children:
                        "Gunakan format template KPI: JABATAN, NAMA, NPP, UNIT KERJA, PERSPEKTIF, INDIKATOR KINERJA, UKURAN, BOBOT, POLARITAS, TARGET TAHUNAN, lalu Realisasi & Target per bulan (Jan–Des).",
                    }),
                    n.jsx("li", {
                      children: "Satu file boleh berisi banyak sheet dan banyak pegawai. Pisahkan blok antar pegawai dengan satu baris kosong.",
                    }),
                    n.jsx("li", {
                      children: "Urutan pencocokan: NPP, lalu nama, lalu jabatan. Unit kerja & jabatan yang disimpan mengikuti data pegawai di sistem.",
                    }),
                    n.jsx("li", {
                      children: "Bobot boleh ditulis 10 / 10% / 0,1. Satuan: %, Juta Rupiah, Indeks, atau Angka.",
                    }),
                    n.jsx("li", {
                      children:
                        "Setiap nama KPI otomatis masuk Master KPI dengan kode (KPI-FIN-02, KPI-CUS-01, …). Nama yang sama pada perspektif yang sama memakai master yang sudah ada — tidak ada nama ganda.",
                    }),
                    n.jsxs("li", {
                      children: [
                        "KPI individu disimpan per ",
                        n.jsx("strong", { children: "unit + jabatan" }),
                        ". KPI lama pada unit + jabatan yang sama akan diganti saat disimpan.",
                      ],
                    }),
                  ],
                }),
              ],
            }),
            n.jsx("input", { type: "file", ref: fileRef, className: "hidden", accept: ".xlsx, .xls", onChange: onFile }),
            n.jsxs("div", {
              className: "flex flex-col sm:flex-row gap-4 mb-2 flex-wrap justify-center",
              children: [
                n.jsx(Button, {
                  onClick: () => fileRef.current && fileRef.current.click(),
                  className: "px-8",
                  disabled: !!busy,
                  children: busy === "parse" ? "Membaca file..." : busy === "check" ? "Mencocokkan pegawai..." : "Pilih File",
                }),
                n.jsx(Button, {
                  variant: "outline",
                  onClick: downloadTemplate,
                  className: "px-8 bg-white text-blue-700 border-blue-600 hover:bg-blue-50 hover:text-blue-800",
                  children: "Download Template KPI Individu",
                }),
              ],
            }),
          ],
        }),
      }),
      fileName &&
        n.jsx(Card, {
          className: "border border-slate-200 shadow-sm",
          children: n.jsxs(CardContent, {
            className: "p-6 space-y-4",
            children: [
              n.jsxs("div", {
                className: "flex flex-wrap items-center justify-between gap-3",
                children: [
                  n.jsxs("div", {
                    children: [
                      n.jsx("div", { className: "font-semibold text-slate-900", children: "Pratinjau Pencocokan" }),
                      n.jsxs("div", { className: "text-xs text-slate-500", children: ["File: ", fileName] }),
                    ],
                  }),
                  n.jsxs("div", {
                    className: "flex flex-wrap gap-2",
                    children: [
                      n.jsx(Button, {
                        variant: "outline",
                        onClick: () => check(entries),
                        disabled: !!busy || !entries.length,
                        children: busy === "check" ? "Memeriksa..." : "Periksa Ulang",
                      }),
                      n.jsx(Button, { variant: "outline", onClick: reset, disabled: !!busy, children: "Reset" }),
                      n.jsx(Button, {
                        onClick: save,
                        disabled: !!busy || !pending,
                        children: busy === "save" ? "Menyimpan..." : `Simpan ${pending} Pegawai`,
                      }),
                    ],
                  }),
                ],
              }),
              summary &&
                n.jsxs("div", {
                  className: "grid grid-cols-2 sm:grid-cols-4 gap-3",
                  children: [
                    n.jsx(Stat, { label: "Blok pegawai", value: summary.total }),
                    n.jsx(Stat, {
                      label: summary.saved ? "Tersimpan" : "Siap disimpan",
                      value: summary.saved || summary.ready,
                      tone: "bg-emerald-50 border-emerald-200",
                    }),
                    n.jsx(Stat, { label: "Tidak ditemukan", value: summary.unmatched, tone: "bg-red-50 border-red-200" }),
                    n.jsx(Stat, { label: "Konflik / duplikat", value: summary.conflict, tone: "bg-amber-50 border-amber-200" }),
                    n.jsx(Stat, { label: "Tidak valid", value: summary.invalid, tone: "bg-red-50 border-red-200" }),
                    n.jsx(Stat, { label: summary.saved ? "KPI disimpan" : "KPI akan disimpan", value: summary.kpis }),
                    n.jsx(Stat, {
                      label: summary.saved ? "Master KPI baru dibuat" : "Master KPI baru",
                      value: summary.masterNew || 0,
                      tone: "bg-blue-50 border-blue-200",
                    }),
                    n.jsx(Stat, { label: "Master KPI dipakai ulang", value: summary.masterReused || 0, tone: "bg-blue-50 border-blue-200" }),
                  ],
                }),
              result && result.newMasters && result.newMasters.length > 0 &&
                n.jsxs("details", {
                  className: "bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900",
                  children: [
                    n.jsxs("summary", {
                      className: "font-semibold cursor-pointer",
                      children: [
                        summary.saved ? "Master KPI baru yang dibuat" : "Master KPI baru yang akan dibuat",
                        " (",
                        result.newMasters.length,
                        ") — nama KPI yang sama pada perspektif yang sama memakai kode yang sudah ada",
                      ],
                    }),
                    n.jsx("div", {
                      className: "mt-2 max-h-72 overflow-y-auto space-y-0.5",
                      children: result.newMasters.map((m) =>
                        n.jsxs("div", {
                          children: [
                            n.jsx("span", { className: "font-mono font-semibold", children: m.code }),
                            " — ",
                            m.name,
                            n.jsxs("span", { className: "text-slate-500", children: [" (", PERSPECTIVE_LABEL[m.perspective] || m.perspective, ")"] }),
                          ],
                        }, m.code)
                      ),
                    }),
                  ],
                }),
              skipped.length > 0 &&
                n.jsxs("div", {
                  className: "bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800",
                  children: [
                    n.jsx("div", { className: "font-semibold mb-1", children: "Sheet dilewati:" }),
                    n.jsx("ul", {
                      className: "list-disc list-inside space-y-0.5",
                      children: skipped.map((s, i) =>
                        n.jsxs("li", { children: [n.jsx("strong", { children: s.sheet }), " — ", s.reason] }, i)
                      ),
                    }),
                  ],
                }),
              rows.length > 0 &&
                n.jsx("div", {
                  className: "overflow-x-auto border border-slate-200 rounded-lg",
                  children: n.jsxs("table", {
                    className: "w-full text-xs",
                    children: [
                      n.jsx("thead", {
                        className: "bg-slate-50 text-slate-600",
                        children: n.jsxs("tr", {
                          children: [
                            n.jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "#" }),
                            n.jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "Sheet / Baris" }),
                            n.jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "Data di File" }),
                            n.jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "Pegawai di Sistem" }),
                            n.jsx("th", { className: "px-3 py-2 text-right font-semibold", children: "KPI / Bobot" }),
                            n.jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "Status" }),
                          ],
                        }),
                      }),
                      n.jsx("tbody", {
                        children: rows.map((r, i) => {
                          const st = STATUS[r.status] || STATUS.invalid;
                          const notes = [r.message, ...(r.warnings || [])].filter(Boolean);
                          return n.jsxs(
                            "tr",
                            {
                              className: "border-t border-slate-100 align-top",
                              children: [
                                n.jsx("td", { className: "px-3 py-2 text-slate-400", children: i + 1 }),
                                n.jsxs("td", {
                                  className: "px-3 py-2",
                                  children: [
                                    n.jsx("div", { className: "font-medium text-slate-700", children: r.sheet }),
                                    n.jsxs("div", { className: "text-slate-400", children: ["Baris ", r.rows] }),
                                  ],
                                }),
                                n.jsxs("td", {
                                  className: "px-3 py-2",
                                  children: [
                                    n.jsx("div", { className: "font-medium text-slate-800", children: r.nama || "(tanpa nama)" }),
                                    n.jsx("div", { className: "text-slate-500", children: r.npp || "NPP kosong" }),
                                    n.jsx("div", { className: "text-slate-500", children: r.jabatan || "-" }),
                                  ],
                                }),
                                n.jsx("td", {
                                  className: "px-3 py-2",
                                  children: r.pegawai
                                    ? n.jsxs(n.Fragment, {
                                        children: [
                                          n.jsx("div", { className: "font-medium text-slate-800", children: r.pegawai.name }),
                                          n.jsx("div", { className: "text-slate-500", children: r.pegawai.npp }),
                                          n.jsxs("div", {
                                            className: "text-slate-500",
                                            children: [r.pegawai.jabatan, " — ", r.pegawai.unit_name],
                                          }),
                                          r.matchedBy &&
                                            n.jsx("div", { className: "text-blue-600", children: MATCH_VIA[r.matchedBy] || r.matchedBy }),
                                        ],
                                      })
                                    : n.jsx("span", { className: "text-slate-400", children: "-" }),
                                }),
                                n.jsxs("td", {
                                  className: "px-3 py-2 text-right whitespace-nowrap",
                                  children: [
                                    n.jsxs("div", { className: "font-medium text-slate-800", children: [r.kpiCount, " KPI"] }),
                                    n.jsxs("div", {
                                      className: Math.abs((r.weightTotal || 0) - 100) > 0.5 ? "text-amber-600" : "text-slate-500",
                                      children: ["Bobot ", r.weightTotal],
                                    }),
                                    (r.masterNew > 0 || r.masterReused > 0) &&
                                      n.jsxs("div", {
                                        className: "text-blue-600",
                                        children: ["Master: ", r.masterReused || 0, " ada, ", r.masterNew || 0, " baru"],
                                      }),
                                  ],
                                }),
                                n.jsxs("td", {
                                  className: "px-3 py-2",
                                  children: [
                                    n.jsx("span", {
                                      className: "inline-block rounded-full border px-2 py-0.5 font-medium whitespace-nowrap " + st.cls,
                                      children: st.label,
                                    }),
                                    notes.length > 0 &&
                                      n.jsx("ul", {
                                        className: "mt-1 space-y-0.5 text-slate-500",
                                        children: notes.map((m, j) => n.jsx("li", { children: m }, j)),
                                      }),
                                  ],
                                }),
                              ],
                            },
                            r.key ?? i
                          );
                        }),
                      }),
                    ],
                  }),
                }),
            ],
          }),
        }),
    ],
  });
}

export { KpiIndividuImport };
