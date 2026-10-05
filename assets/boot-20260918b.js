(function () {
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (!child || child.parentNode !== this) return child;
    try { return origRemove.call(this, child); } catch { return child; }
  };
  const origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return node;
    try { return origInsert.call(this, node, ref); } catch { return node; }
  };
  ["kb-eform-root", "kb-kpi-menu"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.parentNode) {
      try { el.parentNode.removeChild(el); } catch {}
    }
  });
})();

(async function () {
  // Single AuthContext: always load canon AQ only. Refresh shim/chunk HTTP
  // cache every boot so DomaiNesia's 30-day max-age cannot keep a stale full
  // copy of index-CdyJlLvK/O (which caused "useAuth must be used within AuthProvider").
  const BASE = "/kinerjaberkah/assets/";
  const CANON = "index-CdyJlLvAQ.js";
  const VERSION = "20261005i";
  const LS_KEY = "kb_index_cache_v";

  const SHIM_SUFFIXES = [
    "K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    "AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP",
  ];
  const SHIMS = SHIM_SUFFIXES.map((s) => BASE + "index-CdyJlLv" + s + ".js").concat([
    BASE + CANON,
    BASE + "PenggunaAkses-UserFix01.js",
    BASE + "unit-kantor-DMQ7qF6z.js",
    BASE + "DataPegawai-B5fDELoN.js",
    BASE + "MutasiPegawai-BndmMgt3.js",
    BASE + "KPIIndividu-MonthLine03.js",
    BASE + "PageHeader-DdzXL2rh.js",
    BASE + "Login-OMbfbvvI.js",
    BASE + "UploadKpiMutasi-Manual01.js",
    BASE + "FileEvidence-Manual01.js",
    BASE + "KPIIndividu-MonthLine03.js",
    BASE + "kpi-polarity-Zero01.js",
    BASE + "kpi-polarity-Zero02.js",
    BASE + "orgLevel-DzZJ66Xo.js",
    BASE + "Dashboard-Score01.js",
    BASE + "LaporanAnalisis-Export01.js",
    BASE + "KpiIndividuExport-Card01.js",
    BASE + "kpi-individu-export-Core01.js",
    BASE + "kpi-scoring-Zero01.js",
    BASE + "kpi-scoring-Zero03.js",
    BASE + "kpi-summary-zp-GQLPf.js",
    BASE + "kpi-summary-Zero03.js",
    BASE + "KpiIndeksPredikatTable-Fit01.js",
    BASE + "KonsolidasiUnit-Wrap01.js",
    BASE + "Scorecard-B7oCx77H.js",
    BASE + "KPIUnit-Score01.js",
    BASE + "OKRJabatan-PerfList01.js",
    BASE + "Panduan-D7yiiD2P.js",
    BASE + "KpiManagement-Catalog07.js",
    BASE + "index-CdyJlLvAQ.js",
  ]);

  async function refreshShims() {
    await Promise.all(
      SHIMS.map((u) => fetch(u, { cache: "reload", credentials: "same-origin" }).catch(() => null))
    );
  }

  // Always revalidate critical modules (CDN ignores no-cache headers)
  try { await refreshShims(); } catch {}

  try {
    const prev = localStorage.getItem(LS_KEY);
    if (prev !== VERSION) {
      localStorage.setItem(LS_KEY, VERSION);
      if (prev) {
        location.reload();
        return;
      }
    }
  } catch {}

  const canon = await import("./" + CANON);
  // Guard: if a stale shim somehow still exposes a different useAuth, hard reload once
  try {
    const viaO = await import("./index-CdyJlLvO.js").catch(() => null);
    if (viaO && viaO.u && canon.u && viaO.u !== canon.u) {
      const k = "kb_auth_dual_reload";
      if (sessionStorage.getItem(k) !== VERSION) {
        sessionStorage.setItem(k, VERSION);
        await refreshShims();
        location.reload();
        return;
      }
    }
  } catch {}

  canon.m();
})();
