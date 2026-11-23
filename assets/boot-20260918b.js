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
  // Single AuthContext: always load canon AQ only.
  // Hanya bust cache file kritis saat VERSION berubah — jangan unduh ulang
  // puluhan MB (MonthLine 650KB, dll) di setiap deploy.
  const BASE = "/kinerjaberkah/assets/";
  const CANON = "index-CdyJlLvAQ.js";
  const VERSION = "20261122d";
  try { localStorage.removeItem("kb_periode_settings"); } catch {}
  const LS_KEY = "kb_index_cache_v";

  // Minimal set: auth canon + modul yang sering salah-cache setelah deploy satuan/target
  const SHIMS = [
    BASE + CANON,
    BASE + "index-CdyJlLvO.js",
    BASE + "Login-OMbfbvvI.js",
    BASE + "boot-20260918b.js",
    BASE + "kpi-units-Bpgxx_sX.js",
    BASE + "kpi-polarity-Zero02.js",
    BASE + "kpi-scoring-Zero03.js",
    BASE + "kpi-summary-Zero03.js",
    BASE + "DeleteConfirmDialog-Manual14.js",
    BASE + "KPIUnitKantor-Pemimpin01.js",
    BASE + "kpi-individu-export-Core01.js",
    BASE + "LaporanAnalisis-Export04.js",
    BASE + "Dashboard-Score01.js",
    BASE + "KPIIndividu-MonthLine03.js",
    BASE + "kpi-individu-parser-Npp01.js",
    BASE + "Dashboard-Score01.js",
    BASE + "orgLevel-DzZJ66Xo.js",
    BASE + "UploadExcel-NppMatch02.js",
    BASE + "unit-kantor-DMQ7qF6z.js",
    BASE + "DataPegawai-PermUnit01.js",
  ];

  function refreshShims() {
    // Fire-and-forget, jangan block render
    SHIMS.forEach((u) => {
      try { fetch(u, { cache: "reload", credentials: "same-origin" }).catch(() => null); } catch {}
    });
  }

  let versionChanged = false;
  try {
    const prev = localStorage.getItem(LS_KEY);
    if (prev !== VERSION) {
      versionChanged = true;
      localStorage.setItem(LS_KEY, VERSION);
      if (prev) {
        try { await Promise.all(SHIMS.map((u) => fetch(u, { cache: "reload", credentials: "same-origin" }).catch(() => null))); } catch {}
        location.reload();
        return;
      }
      refreshShims();
    }
  } catch {}

  // Soft path: langsung mount — jangan no-cache fetch yang menunda login/app
  // Jangan pakai ?v= di import (bisa dual AuthContext / modul dobel).
  const canon = await import("./" + CANON);
  try {
    const viaO = await import("./index-CdyJlLvO.js").catch(() => null);
    if (viaO && viaO.u && canon.u && viaO.u !== canon.u) {
      const k = "kb_auth_dual_reload";
      if (sessionStorage.getItem(k) !== VERSION) {
        sessionStorage.setItem(k, VERSION);
        refreshShims();
        location.reload();
        return;
      }
    }
  } catch {}

  canon.m();
})();
