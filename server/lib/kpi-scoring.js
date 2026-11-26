const { normalizePolarity, computePencapaianByPolarity, polaritySkala, polarityBatas, DEFAULT_BATAS } = require('./kpi-polarity');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

/** Index bulan terakhir yang sudah dihitung (bulan sebelum bulan berjalan, WIB). Januari → -1. */
function lastClosedMonthIndexForScore(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600 * 1000).getUTCMonth() - 1;
}

/** Bulan sudah masuk perhitungan skor/YTD (bukan bulan berjalan / ke depan). */
function isMonthClosedForScore(monthKey, now = new Date()) {
  const i = MONTHS.indexOf(monthKey);
  return i >= 0 && i <= lastClosedMonthIndexForScore(now);
}

/** Salin objek bulanan hanya untuk bulan yang sudah ditutup. */
function closedMonthsOnly(monthlyObj, now = new Date()) {
  const out = {};
  if (!monthlyObj || typeof monthlyObj !== 'object') return out;
  for (const m of MONTHS) {
    if (!isMonthClosedForScore(m, now)) continue;
    if (monthlyObj[m] !== undefined) out[m] = monthlyObj[m];
  }
  return out;
}

function isSumTargetUnit(unitType) {
  return unitType === 'currency' || unitType === 'number';
}

function isFlatTargetUnit(unitType) {
  return unitType === 'percentage' || unitType === 'score';
}

function sumMonthlyValues(monthlyObj) {
  return MONTHS.reduce((sum, m) => {
    const val = parseFloat(monthlyObj?.[m]);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);
}

function avgMonthlyValues(monthlyObj) {
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const val = parseFloat(monthlyObj?.[m]);
    if (!Number.isNaN(val)) {
      sum += val;
      count += 1;
    }
  });
  return count > 0 ? sum / count : 0;
}

function avgMonthlyRealisasi(monthlyData) {
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const raw = monthlyData?.[m];
    if (raw === undefined || raw === null || raw === '') return;
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return;
    sum += val;
    count += 1;
  });
  return count > 0 ? sum / count : 0;
}

function computeAnnualTargetFromMonthly(unitType, monthlyTarget) {
  if (!monthlyTarget || typeof monthlyTarget !== 'object') return 0;
  if (isSumTargetUnit(unitType)) {
    return sumMonthlyValues(monthlyTarget);
  }
  if (isFlatTargetUnit(unitType)) {
    for (const m of MONTHS) {
      const raw = monthlyTarget[m];
      if (raw === undefined || raw === null || raw === '') continue;
      const val = parseFloat(raw);
      if (!Number.isNaN(val)) return val; // termasuk 0
    }
  }
  return 0;
}

function computeYtdActual(unitType, monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return 0;
  if (isSumTargetUnit(unitType)) {
    return sumMonthlyValues(monthlyData);
  }
  return avgMonthlyValues(monthlyData);
}

function hasFilledMonth(monthlyObj) {
  if (!monthlyObj || typeof monthlyObj !== 'object') return false;
  return MONTHS.some((m) => {
    const raw = monthlyObj[m];
    return raw !== undefined && raw !== null && raw !== '' && !Number.isNaN(parseFloat(raw));
  });
}

/**
 * Realisasi kosong + target bulanan eksplisit 0 → anggap realisasi 0
 * (Target 0 & Realisasi 0 = 100%, mis. Jumlah Temuan).
 */
function coalesceBlankRealisasiAgainstZeroTarget(monthlyData, monthlyTarget) {
  const src = monthlyData && typeof monthlyData === 'object' ? monthlyData : {};
  const targets = monthlyTarget && typeof monthlyTarget === 'object' ? monthlyTarget : {};
  const out = { ...src };
  let changed = false;
  for (const m of MONTHS) {
    const raw = out[m];
    if (raw !== undefined && raw !== null && raw !== '') continue;
    const tRaw = targets[m];
    if (tRaw === undefined || tRaw === null || tRaw === '') continue;
    const t = parseFloat(tRaw);
    if (t !== 0) continue;
    out[m] = 0;
    changed = true;
  }
  return changed ? out : src;
}

function isAnnualZeroZero(kpi, actualNum) {
  const annual = parseFloat(String(kpi?.target ?? '').replace(',', '.'));
  if (annual !== 0) return false;
  const a = parseFloat(actualNum);
  return !Number.isFinite(a) || a === 0;
}

function computePencapaianPercent(actual, target, polarity = 'maximize') {
  return computePencapaianByPolarity(actual, target, polarity);
}

function monthTargetValue(monthlyTarget, month, annualTarget) {
  const raw = monthlyTarget?.[month];
  if (raw !== undefined && raw !== null && raw !== '') {
    const val = parseFloat(raw);
    if (!Number.isNaN(val)) return val;
  }
  const annual = parseFloat(annualTarget);
  if (!Number.isNaN(annual)) return annual;
  const fallback = computeAnnualTargetFromMonthly('percentage', monthlyTarget);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function filledMonths(monthlyObj) {
  if (!monthlyObj || typeof monthlyObj !== 'object') return [];
  return MONTHS.filter((m) => {
    const raw = monthlyObj[m];
    return raw !== undefined && raw !== null && raw !== '' && !Number.isNaN(parseFloat(raw));
  });
}

function sumMonths(monthlyObj, months) {
  return months.reduce((sum, m) => {
    const val = parseFloat(monthlyObj?.[m]);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);
}

// Nominal (Rp/angka): YTD realisasi ÷ YTD target pada bulan yang sama-sama terisi.
function computeYtdTarget(unitType, monthlyData, monthlyTarget) {
  if (!isSumTargetUnit(unitType)) return computeAnnualTargetFromMonthly(unitType, monthlyTarget);
  const dataMonths = filledMonths(monthlyData);
  if (!dataMonths.length) return 0;
  const matched = dataMonths.filter((m) => filledMonths(monthlyTarget).includes(m));
  return sumMonths(monthlyTarget, matched.length ? matched : dataMonths);
}

function computePencapaianTotal(monthlyData, monthlyTarget, unitType, polarity = 'maximize', annualTarget) {
  // Pass polarity mentah (maximize_a/b/c) — jangan normalize dulu agar aturan Target=0 Maximize A akurat.
  if (isSumTargetUnit(unitType)) {
    const dataMonths = filledMonths(monthlyData);
    if (!dataMonths.length) return 0;
    const targetMonths = new Set(filledMonths(monthlyTarget));
    const matched = dataMonths.filter((m) => targetMonths.has(m));
    if (matched.length) {
      return computePencapaianByPolarity(sumMonths(monthlyData, matched), sumMonths(monthlyTarget, matched), polarity);
    }
    const annual = parseFloat(annualTarget);
    return computePencapaianByPolarity(sumMonths(monthlyData, dataMonths), Number.isNaN(annual) ? 0 : annual, polarity);
  }
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const raw = monthlyData?.[m];
    if (raw === undefined || raw === null || raw === '') return;
    const actual = parseFloat(raw);
    if (Number.isNaN(actual)) return;
    const target = monthTargetValue(monthlyTarget, m, annualTarget);
    sum += computePencapaianByPolarity(actual, target, polarity);
    count += 1;
  });
  // YTD (%) = ROUND(Σ pencapaian / bulan_berjalan, 2)
  return count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
}

function isLearningGrowth(perspective) {
  return /learning|growth|pembelajaran|\blng\b/i.test(String(perspective || ''));
}

// Skala B (Maximize satuan indeks/skor di luar Learning & Growth, Minimize, Faster is Better): skor 3 baru di 100–<110%.
// Skala C (Maximize perspektif Learning & Growth, semua satuan): skor 4 di 80–100%.
function scoreScale(polarity, unitType, perspective) {
  const raw = String(polarity || '').trim().toLowerCase();
  const mode = normalizePolarity(polarity);
  if (mode === 'minimize' && (raw === '' || raw === 'minimize')) return unitType === 'score' ? 'B' : 'A';
  if (mode === 'minimize' || mode === 'faster') return polaritySkala(polarity) || 'B';
  const explicit = polaritySkala(polarity);
  if (explicit) return explicit;
  if (mode === 'maximize' && isLearningGrowth(perspective)) return 'C';
  if (mode === 'maximize' && unitType === 'score') return 'B';
  return 'A';
}

function indeksFromBands(pencapaian, bands) {
  const [b2, b3, b4, b5] = bands;
  if (pencapaian < b2) return 1;
  if (pencapaian < b3) return 2;
  if (pencapaian < b4) return 3;
  if (pencapaian <= b5) return 4;
  return 5;
}

function bandsForKpi(polarity, unitType, perspective) {
  const raw = String(polarity || '').trim().toLowerCase();
  const mode = normalizePolarity(polarity);
  // Kode polos lama: minimize -> A (skor/indeks -> B), maximize -> A/B/C sesuai satuan & perspektif.
  if (raw === '' || raw === 'minimize') {
    return polarityBatas(unitType === 'score' ? 'minimize_b' : 'minimize_a') || polarityBatas('minimize');
  }
  if (raw === 'maximize') {
    const scale = scoreScale(polarity, unitType, perspective);
    const kode = scale === 'C' ? 'maximize_c' : scale === 'B' ? 'maximize_b' : 'maximize_a';
    return polarityBatas(kode) || DEFAULT_BATAS[scale] || DEFAULT_BATAS.A;
  }
  const direct = polarityBatas(raw);
  if (direct) return direct;
  const scale = scoreScale(polarity, unitType, perspective);
  const kode = mode === 'minimize' ? (unitType === 'score' ? 'minimize_b' : 'minimize_a') : mode === 'faster' ? 'faster' : mode === 'range' ? 'range' : scale === 'C' ? 'maximize_c' : scale === 'B' ? 'maximize_b' : 'maximize_a';
  return polarityBatas(kode) || DEFAULT_BATAS[scale] || DEFAULT_BATAS.A;
}

function stabilizeCuts() {
  const batas = polarityBatas('minimize_c') || polarityBatas('stabilize');
  if (batas && batas[0] > 0 && batas[0] < batas[1] && batas[0] < 20) return { mid: batas[0], high: batas[1] };
  return { mid: 0.25, high: 1 };
}

/**
 * NPL/NPF Gross di Excel = persen. Upload sering salah skala (30 → 0,30; target 45 → 0,45).
 * Kembalikan pasangan (aktual, target) yang sudah distabilkan ke skala % yang sama.
 * Hindari false ÷100 pada NPL tinggi sah (mis. 11,3 vs target 9,8).
 */
function normalizeStabilizePair(actual, target, kpi) {
  let a = parseFloat(actual);
  let t = parseFloat(target);
  if (!Number.isFinite(a) || !Number.isFinite(t)) return { a, t };
  const name = String(kpi && kpi.name || '');
  const unit = normalizeUnit(kpi && kpi.unit);
  const isNpl = /\bnpl\b|\bnpf\b/i.test(name);
  if (!isNpl && unit !== 'percentage') return { a, t };

  // Keduanya tampak ×100 (42 vs 15, 100 vs 82, 20 vs 12).
  if (a >= 20 && t >= 10) return { a: a / 100, t: t / 100 };
  // Keduanya 10–20 dan dekat: NPL tinggi sah (Karya/Melati).
  if (a >= 10 && t >= 10) return { a, t };

  // Hanya aktual tinggi vs target kecil.
  if (a >= 10 && t < 10) {
    // 11 vs 8: rasio dekat → jangan ÷100.
    if (t >= 5 && a / Math.max(t, 1e-9) < 2.5) return { a, t };
    // 96 vs 1,34 atau 46 vs 3 → aktual ×100.
    if (a >= 20 || t < 5) return { a: a / 100, t };
    return { a, t };
  }

  // Hanya target tinggi vs aktual kecil/normal.
  if (t >= 10 && a < 10) {
    // Negeri Lama: target ~90, aktual 1,17.
    if (t >= 50 && a > 0 && a < 10) return { a, t: t / 100 };
    // Sadabuan: target ~45, aktual 1,39 (desimal).
    if (t >= 20 && a > 0 && a <= 5 && a !== Math.trunc(a)) return { a, t: t / 100 };
    // Tanjung Medan / Cikampak: biarkan (Excel Average Index memakai nilai mentah).
    return { a, t };
  }

  // Target 0, aktual bilangan bulat tinggi (Bahorok 8–13 → 0,08–0,13).
  if (t === 0 && a >= 5) return { a: a / 100, t };

  return { a, t };
}

/** @deprecated gunakan normalizeStabilizePair; tetap ada untuk kompatibilitas. */
function normalizeStabilizeActual(actual, target, kpi) {
  return normalizeStabilizePair(actual, target, kpi).a;
}

/**
 * Deteksi skala salah di seluruh deret bulan (campuran aktual 1,06 + 83, target 7–10).
 * Jika terdeteksi: target ÷100, aktual ≥10 ÷100 — selaras Average Index Excel (Talun Kenas).
 */
function detectStabilizeSeriesScale(monthPairs, kpi) {
  const name = String(kpi && kpi.name || '');
  const unit = normalizeUnit(kpi && kpi.unit);
  const isNpl = /\bnpl\b|\bnpf\b/i.test(name);
  if (!isNpl && unit !== 'percentage') return { divHighActual: false, divTarget: false };
  const pairs = (monthPairs || []).filter(
    (p) => Number.isFinite(p.a) && Number.isFinite(p.t)
  );
  if (pairs.length < 4) return { divHighActual: false, divTarget: false };
  const targets = pairs.map((p) => p.t).sort((x, y) => x - y);
  const medT = targets[Math.floor(targets.length / 2)];
  const highA = pairs.filter((p) => p.a >= 20).length;
  // Hanya aktual kecil desimal (1,06) — bukan bilangan bulat 1/2/6 (hindari false series Merek).
  const smallDecimalA = pairs.filter((p) => p.a > 0 && p.a < 5 && p.a !== Math.trunc(p.a)).length;
  if (medT >= 5 && medT <= 15 && highA >= 2 && smallDecimalA >= 2) {
    return { divHighActual: true, divTarget: true };
  }
  return { divHighActual: false, divTarget: false };
}

function applySeriesScale(actual, target, seriesFix) {
  let a = actual;
  let t = target;
  if (seriesFix && seriesFix.divTarget && Number.isFinite(t)) t = t / 100;
  if (seriesFix && seriesFix.divHighActual && Number.isFinite(a) && a >= 10) a = a / 100;
  return { a, t };
}

function stabilizeIndeks(actual, target) {
  const a = parseFloat(actual);
  const t = parseFloat(target);
  const x = a - t;
  let { mid, high } = stabilizeCuts();
  // Minimize C (Excel Skor sheet): Aktual − Target
  // 5: <0% | 4: =0% | 3: >0–≤0,25% | 2: >0,25–≤1% | 1: >1%
  if (!Number.isFinite(x)) return 0;
  if (x < -1e-9) return 5;
  if (Math.abs(x) <= 1e-9) return 4;
  if (x <= mid) return 3;
  if (x <= high) return 2;
  return 1;
}

function polarityForScore(kpi) {
  const raw = String(kpi && kpi.polarity || '').trim().toLowerCase();
  const name = String(kpi && kpi.name || '');
  const code = String(kpi && (kpi.kpi_code || kpi.parent_kpi_id || kpi.id) || '').trim().toUpperCase();
  // Lock polarisasi Master KPI (selalu, abaikan nilai salah di instance)
  if (code === 'KPI-CUS-42' || code === 'KPI-CUS-04' || /pembiayaan\s*syariah/i.test(name) && /dblm/i.test(name)) {
    return 'maximize_a';
  }
  if (
    code === 'KPI-IBP-10' ||
    code === 'KPI-IBP-25' ||
    (/penyelesa+iaan?\s+temuan\s+audit/i.test(name) && /komitmen/i.test(name)) ||
    (/temuan/i.test(name) && /audit/i.test(name) && /komitmen/i.test(name))
  ) {
    return 'maximize_b';
  }
  // NPL/NPF Gross selalu Minimize C (selisih absolut), jangan ikut minimize_a
  if (/\bnpl\b|\bnpf\b/i.test(name) && /gross/i.test(name)) return 'minimize_c';
  if ((raw === '' || raw === 'maximize') && /temuan/i.test(name)) return 'maximize_b';
  if ((raw === '' || raw === 'minimize') && /\bnpl\b|\bnpf\b/i.test(name)) return 'minimize_c';
  if ((raw === '' || raw === 'minimize') && /cost\s*of\s*fund/i.test(name)) return 'minimize_a';
  // Efisiensi biaya ATK/BBM/dll — Minimize A (Excel Parameter)
  if (/efisiensi\s*biaya/i.test(name) || (/biaya\s*atk/i.test(name) && /listrik|bbm/i.test(name))) {
    return 'minimize_a';
  }
  if ((raw === '' || raw === 'maximize') && /culture|integrity/i.test(name)) return 'maximize_c';
  if ((raw === '' || raw === 'maximize') && /kol\.?\s*1|col\.?\s*1/i.test(name)) return 'maximize_a';
  return kpi && kpi.polarity;
}

function stabilizeIndeksFromDiff(diff, sampleMag) {
  const x = parseFloat(diff);
  let { mid, high } = stabilizeCuts();
  if (!Number.isFinite(x)) return 0;
  if (x < -1e-9) return 5;
  if (Math.abs(x) <= 1e-9) return 4;
  if (x <= mid) return 3;
  if (x <= high) return 2;
  return 1;
}

/**
 * Skor = ROUND(bobot × indeks, 2) / 100
 * bobot disimpan 0–100.
 */
function computeHasil(bobot, indeks, totalBulan = 1) {
  const b = parseFloat(bobot) || 0;
  const i = parseFloat(indeks) || 0;
  // ROUND(bobot × indeks, 2) / 100 — totalBulan dipakai pemanggil untuk rata-rata
  return Math.round(b * i * 100) / 100 / 100;
}

/**
 * KPI Pertumbuhan O/S (Kredit/DPK) di scorecard Unit Kantor (Excel):
 * Ach = 1 + (Realisasi − Target) / ABS(Target)
 * → sama dengan R/T jika Target > 0; berbeda jika Target < 0.
 */
function isPertumbuhanOsKpi(kpi) {
  return /pertumbuhan\s*o\s*\/\s*s/i.test(String(kpi && kpi.name || ''));
}

/** Pencapaian % selaras Excel Nilai Kantor Cabang. */
function computePencapaianForMonth(actual, target, kpi, polarity) {
  const a = parseFloat(actual);
  const t = parseFloat(target);
  if (Number.isNaN(a) || Number.isNaN(t)) return 0;
  if (isPertumbuhanOsKpi(kpi) && t !== 0) {
    // Sama keluarga rumus Maximize A Excel: MAX(0%, 1+(R−T)/ABS(T))
    const ach = Math.max(0, 1 + (a - t) / Math.abs(t));
    return Math.round(ach * 100 * 10000) / 10000; // % (Excel ROUND(...,4) pada rasio)
  }
  return computePencapaianByPolarity(a, t, polarity);
}

function averageMonthlyScores(kpi, monthlyData, monthlyTarget) {
  // Selaras Excel Average index:
  // 1) indeks integer per bulan (band polaritas)
  // 2) Index YTD = rata-rata indeks bulan berdata
  // 3) kontribusi = Index YTD × (bobot/100)
  const unitType = normalizeUnit(kpi.unit);
  const polarity = polarityForScore(kpi);
  const scoredKpi = polarity === kpi.polarity ? kpi : { ...kpi, polarity };
  const weight = parseFloat(kpi.weight) || 0;
  const stabilize = usesStabilize(scoredKpi);
  let seriesFix = { divHighActual: false, divTarget: false };
  if (stabilize) {
    const probe = [];
    for (const m of MONTHS) {
      if (!isMonthClosedForScore(m)) continue;
      const raw = monthlyData?.[m];
      if (raw === undefined || raw === null || raw === '') continue;
      const actual = parseFloat(raw);
      if (Number.isNaN(actual)) continue;
      probe.push({ a: actual, t: monthTargetValue(monthlyTarget, m, kpi.target) });
    }
    seriesFix = detectStabilizeSeriesScale(probe, scoredKpi);
  }
  const monthRows = [];
  for (const m of MONTHS) {
    if (!isMonthClosedForScore(m)) continue;
    const raw = monthlyData?.[m];
    if (raw === undefined || raw === null || raw === '') continue;
    const actual = parseFloat(raw);
    if (Number.isNaN(actual)) continue;
    const target = monthTargetValue(monthlyTarget, m, kpi.target);
    let pencapaian;
    let indeks;
    if (stabilize) {
      const scaled = applySeriesScale(actual, target, seriesFix);
      const pair = normalizeStabilizePair(scaled.a, scaled.t, scoredKpi);
      pencapaian = computePencapaianByPolarity(pair.a, pair.t, 'stabilize');
      indeks = stabilizeIndeks(pair.a, pair.t);
    } else {
      pencapaian = computePencapaianForMonth(actual, target, scoredKpi, polarity);
      indeks = computeIndeksFromPencapaian(pencapaian, polarity, unitType, kpi.perspective);
    }
    // Excel menyimpan indeks sebagai bilangan bulat 1–5
    indeks = Math.round(Number(indeks) || 0);
    if (indeks < 0) indeks = 0;
    if (indeks > 5) indeks = 5;
    monthRows.push({ month: m, pencapaian, indeks });
  }
  if (!monthRows.length) return null;
  const count = monthRows.length;
  const pencapaian =
    Math.round((monthRows.reduce((s, r) => s + r.pencapaian, 0) / count) * 100) / 100;
  const indeks =
    Math.round((monthRows.reduce((s, r) => s + r.indeks, 0) / count) * 10000) / 10000;
  // Excel: kontribusi = rata-rata indeks × bobot/100 (bukan rata-rata ROUND bulanan)
  const hasil = computeHasil(weight, indeks, 1);
  return {
    indeks,
    pencapaian,
    count,
    hasil,
  };
}

function usesStabilize(kpi) {
  const raw = String(kpi && kpi.polarity || '').trim().toLowerCase();
  if (raw === 'stabilize' || raw === 'minimize_c' || normalizePolarity(kpi && kpi.polarity) === 'stabilize') return true;
  return /npl/i.test(String(kpi && kpi.name || '')) && (raw === '' || raw === 'maximize' || raw === 'minimize');
}

function computeIndeksFromPencapaian(pencapaianPercent, polarity = 'maximize', unitType = 'percentage', perspective = '') {
  const p = parseFloat(pencapaianPercent);
  if (Number.isNaN(p)) return 0;
  return indeksFromBands(p, bandsForKpi(polarity, unitType, perspective));
}

function resolveIndeks(kpi, pencapaianPercent) {
  const hasManual = kpi.manual_indeks !== undefined && kpi.manual_indeks !== null && kpi.manual_indeks !== '';
  if (hasManual) {
    const manual = parseFloat(kpi.manual_indeks);
    // Average Index Excel boleh fraksi (1.4, 2.6, …) dan di bawah 1 bila ada.
    if (Number.isFinite(manual) && manual > 0) return manual;
  }
  return computeIndeksFromPencapaian(pencapaianPercent, kpi.polarity, normalizeUnit(kpi.unit), kpi.perspective);
}

const PREDIKAT_BY_SKOR = ['Kurang', 'Cukup', 'Baik', 'Sangat Baik', 'Istimewa'];

function predikatFromIndeks(indeks) {
  const i = Math.round(parseFloat(indeks));
  if (Number.isNaN(i) || i <= 0) return '-';
  return PREDIKAT_BY_SKOR[Math.min(i, 5) - 1];
}

const NILAI_AKHIR_FALLBACK = [
  { kategori: 'Istimewa', warna: 'Hijau Tua', nilai_min: 4.51, nilai_max: 5 },
  { kategori: 'Sangat Baik', warna: 'Hijau', nilai_min: 3.76, nilai_max: 4.5 },
  { kategori: 'Baik', warna: 'Hijau Muda', nilai_min: 2.51, nilai_max: 3.75 },
  { kategori: 'Cukup Baik', warna: 'Orange', nilai_min: 1.51, nilai_max: 2.5 },
  { kategori: 'Kurang', warna: 'Merah', nilai_min: 0, nilai_max: 1.5 },
];
let nilaiAkhirRows = NILAI_AKHIR_FALLBACK.map((row) => ({ ...row }));

function setPenilaianAkhir(rows) {
  const next = [];
  for (const row of rows || []) {
    const kategori = String(row.kategori || '').trim();
    const nilaiMin = Number(row.nilai_min);
    const nilaiMax = Number(row.nilai_max);
    if (!kategori || !Number.isFinite(nilaiMin) || !Number.isFinite(nilaiMax)) continue;
    next.push({ kategori, warna: String(row.warna || '').trim(), nilai_min: nilaiMin, nilai_max: nilaiMax });
  }
  if (next.length) nilaiAkhirRows = next;
}

function matchNilaiAkhir(skor) {
  const s = parseFloat(skor);
  if (Number.isNaN(s)) return null;
  const hits = nilaiAkhirRows.filter((row) => s >= row.nilai_min - 1e-9 && s <= row.nilai_max + 1e-9);
  hits.sort((a, b) => b.nilai_min - a.nilai_min || a.nilai_max - b.nilai_max);
  if (hits[0]) return hits[0];
  const sorted = [...nilaiAkhirRows].sort((a, b) => b.nilai_max - a.nilai_max);
  if (sorted[0] && s > sorted[0].nilai_max) return sorted[0];
  return [...nilaiAkhirRows].sort((a, b) => a.nilai_min - b.nilai_min)[0] || null;
}

function predikatFromSkor(skor, scored = true) {
  if (!scored) return '-';
  const hit = matchNilaiAkhir(skor);
  return hit ? hit.kategori : '-';
}

function normalizeUnit(unit) {
  if (['percentage', 'currency', 'score', 'number'].includes(unit)) return unit;
  const u = (unit || '').toLowerCase();
  if (u === '%' || u.includes('persen') || u.includes('percent')) return 'percentage';
  if (u.includes('rp') || u.includes('rupiah') || u.includes('juta')) return 'currency';
  // "Indeks" score vs "Indeks …" labels that are actually peringkat/angka
  if (u.includes('peringkat')) return 'number';
  if (u === 'indeks' || u.includes('skor') || (u.includes('indeks') && !u.includes('peringkat'))) return 'score';
  if (
    u.includes('angka') ||
    u.includes('bilangan') ||
    u.includes('jumlah') ||
    u.includes('hari') ||
    u.includes('kasus') ||
    u.includes('rekening') ||
    u.includes('account') ||
    u.includes('program') ||
    u.includes('analisa') ||
    u.includes('kali') ||
    u.includes('orang') ||
    u.includes('unit')
  ) {
    return 'number';
  }
  return 'percentage';
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickMonthly(obj, allowedMonths) {
  const src = parseJsonField(obj);
  if (!Array.isArray(allowedMonths) || !allowedMonths.length) return src;
  const allow = new Set(allowedMonths);
  const out = {};
  for (const m of MONTHS) {
    if (allow.has(m) && src[m] !== undefined) out[m] = src[m];
  }
  return out;
}

function monthKeysInclusive(startDate, endDate, { clampToToday = false } = {}) {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  let end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (clampToToday) {
    const now = new Date();
    if (end > now) end = now;
  }
  if (end < start) return [];
  const keys = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    keys.push(MONTHS[cur.getMonth()]);
    cur.setMonth(cur.getMonth() + 1);
    if (keys.length > 24) break;
  }
  return keys;
}

function formatMonthRangeLabel(monthKeys = []) {
  if (!monthKeys.length) return '—';
  if (monthKeys.length === 1) return monthKeys[0];
  return `${monthKeys[0]}–${monthKeys[monthKeys.length - 1]}`;
}

function predikatFromPencapaian(pencapaianPercent, scored = true) {
  if (!scored) return '-';
  const p = parseFloat(pencapaianPercent);
  if (Number.isNaN(p)) return '-';
  const indeks = indeksFromBands(p, polarityBatas('maximize_a') || DEFAULT_BATAS.A);
  return PREDIKAT_BY_SKOR[indeks - 1] || 'Istimewa';
}

function computeKpiYtdScores(kpi, options = {}) {
  const unitType = normalizeUnit(kpi.unit);
  const weight = parseFloat(kpi.weight) || 0;
  const months = options.months;
  const monthlyTarget = closedMonthsOnly(pickMonthly(kpi.monthly_target, months));
  const monthlyDataRaw = closedMonthsOnly(pickMonthly(kpi.monthly_data, months));
  const monthlyData = coalesceBlankRealisasiAgainstZeroTarget(monthlyDataRaw, monthlyTarget);
  const polarity = normalizePolarity(kpi.polarity);
  let targetNum = computeYtdTarget(unitType, monthlyData, monthlyTarget);
  let actualNum = computeYtdActual(unitType, monthlyData);
  // Utamakan rumus dari realisasi bulanan. manual_indeks hanya jika belum ada data bulanan
  // (override eksplisit / KPI baru tanpa realisasi), atau options.allowManualIndeks.
  const hasMonths = hasFilledMonth(monthlyData);
  const manualVal = parseFloat(kpi.manual_indeks);
  const manualSet =
    !hasMonths &&
    (options.allowManualIndeks === true || options.allowManualIndeks == null) &&
    kpi.manual_indeks !== undefined &&
    kpi.manual_indeks !== null &&
    kpi.manual_indeks !== '' &&
    Number.isFinite(manualVal) &&
    manualVal > 0;
  let scored = hasMonths || manualSet;
  // Fallback: target tahunan 0 & realisasi 0 (atau belum diisi) → 100%.
  if (!scored && isAnnualZeroZero(kpi, actualNum)) {
    scored = true;
    actualNum = 0;
    if (!Number.isFinite(targetNum) || targetNum === 0) targetNum = 0;
  }
  const monthScores = hasMonths
    ? averageMonthlyScores(kpi, monthlyData, monthlyTarget)
    : null;
  const pencapaian = scored
    ? (monthScores
        ? monthScores.pencapaian
        : computePencapaianByPolarity(0, 0, polarity))
    : 0;
  const indeks = !scored
    ? 0
    : manualSet
      ? resolveIndeks(kpi, pencapaian)
      : monthScores
        ? monthScores.indeks
        : 0;
  const hasil = !scored
    ? 0
    : manualSet
      ? (weight * indeks) / 100
      : monthScores && monthScores.hasil != null
        ? monthScores.hasil
        : computeHasil(weight, indeks, 1);
  return { targetNum, actualNum, pencapaian, indeks, hasil, scored, totalBulan: monthScores ? monthScores.count : 0 };
}

function summarizeKpiSet(kpis = [], months = null) {
  let scoredWeight = 0;
  let weightedPencapaian = 0;
  let sumHasil = 0;
  let sumWeight = 0;
  let scoredCount = 0;
  let tercapai = 0;
  for (const kpi of kpis) {
    const weight = parseFloat(kpi.weight) || 0;
    const { pencapaian, hasil, scored } = computeKpiYtdScores(kpi, { months });
    // Skor akhir hanya dari KPI berdata (rumus), agar KPI kosong tidak mendilusi.
    if (!scored || weight <= 0) continue;
    sumWeight += weight;
    sumHasil += hasil;
    const w = weight > 0 ? weight : 1;
    scoredWeight += w;
    weightedPencapaian += w * Math.max(0, Math.min(pencapaian, 120));
    scoredCount += 1;
    if (pencapaian >= 100) tercapai += 1;
  }
  const pencapaian = scoredWeight > 0 ? weightedPencapaian / scoredWeight : 0;
  const skor = sumWeight > 0 ? (sumHasil / sumWeight) * 100 : 0;
  return {
    pencapaian,
    skor,
    status: predikatFromPencapaian(pencapaian, scoredCount > 0),
    scoredCount,
    kpiTotal: kpis.length,
    kpiTercapai: tercapai,
    totalWeight: sumWeight,
  };
}

module.exports = {
  MONTHS,
  setPenilaianAkhir,
  computeKpiYtdScores,
  computeIndeksFromPencapaian,
  computePencapaianPercent,
  computeYtdActual,
  pickMonthly,
  monthKeysInclusive,
  formatMonthRangeLabel,
  predikatFromPencapaian,
  predikatFromIndeks,
  predikatFromSkor,
  scoreScale,
  summarizeKpiSet,
  normalizeUnit,
  computeHasil,
  isMonthClosedForScore,
  lastClosedMonthIndexForScore,
  closedMonthsOnly,
};
