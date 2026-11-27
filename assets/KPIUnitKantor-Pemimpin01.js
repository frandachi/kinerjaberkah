import{r as y,j as e,c as I,aD as me,B as $e,q as Dl,aN as PdfIcon,as as ChevronsUpDown,aq as CheckIcon}from"./ui-Bxdhc9mB.js";
import{I as fe,B as T,a as _,c as P,u as qe,b as Ve}from"./index-CdyJlLvAQ.js";
import{u as se,b as qc,c as useMut}from"./query-7fhvqgVT.js";
import{S as He}from"./skeleton-7xRvmPlJ.js";
import{S as M,a as B,b as E,c as R,d as c}from"./select-BgJbFb_v.js";
import{P as Pop,a as PopTrig,b as PopCont,C as Cmd,c as CmdInput,d as CmdList,e as CmdEmpty,f as CmdGroup,g as CmdItem}from"./popover-kM9QbBAg.js";
import{b as z,e as C,T as Qe,a as Ye,c as A,d as Je}from"./table-CsTO6OPB.js";
import{i as inferUT,g as listUK,r as normUnitKey}from"./unit-kantor-DMQ7qF6z.js";
import{c as it,b as monthAch,y as kbY,kbMonthClosed}from"./kpi-scoring-Zero03.js";
import{n as lt,g as ot0,U as UNIT_OPTS}from"./kpi-units-Bpgxx_sX.js";
/** Tampilkan label satuan apa adanya (Peringkat, Analisa, …); jangan map ke % generik. */
function ot(u){
  const raw=String(u??"").trim();
  if(!raw)return"—";
  if(["percentage","currency","score","number"].includes(raw))return ot0(raw);
  return raw;
}
import{a as pe,b as ct,c as dt,v as kbNilaiAkhir,p as kbPS}from"./kpi-summary-Zero03.js";
import{g as ut,d as he,P as PERS,n as kbNormPers}from"./kpi-perspective-fFNWJAaz.js";
import{C as mt,c as xt}from"./card-jQ2tvwnD.js";
import{P as ht}from"./PageHeader-DdzXL2rh.js";
import"./vendor-CvVmYoZI.js";
import{P as POL_OPTS}from"./kpi-polarity-Zero02.js";

/** Kepala unit yang KPI Individu-nya jadi sumber KPI Unit. */
function isPemimpinHead(j=""){
  const s=String(j).toLowerCase().replace(/^pj\.?\s*/,"");
  if(!s||s.includes("wakil"))return!1;
  if(s.includes("seksi")||s.includes("kas mobil")||s.includes("payment")||s.includes("unit layanan"))return!1;
  if(/^pemimpin divisi\b/.test(s)||/^kepala divisi\b/.test(s))return!0;
  if(/^pemimpin departemen\b/.test(s)||/^kepala departemen\b/.test(s))return!0;
  if(/^pemimpin ukk\b/.test(s)||/^kepala ukk\b/.test(s))return!0;
  if(/^pemimpin unit\b/.test(s)||/^kepala unit\b/.test(s))return!0;
  if(/^pemimpin (project|proyek)\b/.test(s)||/^project leader\b/.test(s))return!0;
  if(/^pemimpin cabang\b/.test(s)||/^pemimpin capem\b/.test(s)||/^kepala cabang\b/.test(s))return!0;
  return!1;
}

/** Pemimpin unit kantor (cabang) — untuk scope user pemimpin cabang. */
function isPemimpinUK(j=""){
  const s=String(j).toLowerCase().replace(/^pj\.?\s*/,"");
  if(!s.includes("pemimpin")||s.includes("wakil"))return!1;
  if(s.includes("seksi")||s.includes("kas")||s.includes("payment")||s.includes("unit layanan"))return!1;
  if(s.includes("pemimpin divisi")||s.includes("pemimpin departemen")||s.includes("pemimpin ukk")||s.includes("pemimpin unit"))return!1;
  return s.includes("pemimpin cabang")||s.includes("pemimpin capem");
}

function isUnitKantorKpi(k){
  const t=String(k.unit_type||"").toLowerCase()||inferUT(k.unit_name||"");
  if(!(t==="kck"||t==="kc"||t==="kcp"||t==="kk"))return!1;
  if(k.pic==="from-individu-pemimpin"||k.pic==="from-nilai-kantor-cabang")return!0;
  return isPemimpinUK(k.jabatan);
}

function orgKind(name=""){
  const u=String(name||"").trim();
  if(/^departemen/i.test(u))return"departemen";
  if(/^ukk\b/i.test(u))return"ukk";
  if(/^unit\b/i.test(u))return"unit";
  if(/^divisi\b/i.test(u))return"divisi";
  if(/^project\b/i.test(u)||/^proyek\b/i.test(u))return"project";
  return inferUT(u)||"";
}

function kpiOrg(k){
  const ut=String(k.unit_type||"").toLowerCase();
  if(["divisi","departemen","ukk","unit","project","kck","kc","kcp"].includes(ut))return ut;
  return orgKind(k.unit_name);
}

function isMenuKpi(k){
  // Salinan hasil sync dari Individu pemimpin (semua org)
  if(k.pic==="from-individu-pemimpin")return!0;
  // Import Nilai Kantor Cabang (Cabkor/Cabang/Capem/KK)
  if(k.pic==="from-nilai-kantor-cabang")return!0;
  // Upload unit kantor pemimpin cabang
  if(isUnitKantorKpi(k))return!0;
  // Upload KPI Unit pusat (Divisi/Departemen/UKK/Unit/Project)
  const ut=String(k.unit_type||"").toLowerCase();
  if(["divisi","departemen","ukk","unit","project"].includes(ut))return!0;
  return!1;
}

function normKpiName(s){
  return String(s||"").toLowerCase()
    .replace(/\(konsolidasi\)/g,"")
    .replace(/engangament/g,"engagement")
    .replace(/\bindeks\b/g,"index")
    .replace(/[\/().,_-]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function monthFillCount(k,field){
  let o=k&&k[field];
  if(typeof o==="string"){try{o=JSON.parse(o||"{}")}catch{o={}}}
  if(!o||typeof o!=="object")return 0;
  return Object.values(o).filter(v=>v!=null&&v!=="").length;
}
function unitDataScore(k){
  const mt=monthFillCount(k,"monthly_target");
  const md=monthFillCount(k,"monthly_data");
  const hasAnnual=k&&k.target!=null&&String(k.target).trim()!==""&&String(k.target).trim()!=="0"?1:0;
  // Utamakan data yang punya target bulanan (hasil upload Excel), baru kelengkapan realisasi.
  return mt*1000+md*10+hasAnnual;
}
function unitSourceRank(k){
  // Tie-break: Excel Nilai Kantor Cabang / sync Individu, lalu upload unit, lalu pegawai
  if(k.pic==="from-nilai-kantor-cabang")return 0;
  if(k.pic==="from-individu-pemimpin")return 0;
  const ut=String(k.unit_type||"").toLowerCase();
  if(ut==="kck"||ut==="kc"||ut==="kcp"||ut==="kk")return 1;
  if(ut==="divisi"||ut==="departemen"||ut==="ukk"||ut==="unit"||ut==="project")return 2;
  if(ut==="pegawai")return 3;
  return 9;
}

/** KPI scorecard unit (bukan KPI Individu pegawai) — sumber skor UI + export. */
function isUnitScorecardKpi(k){
  const pic=String(k&&k.pic||"");
  if(pic==="from-nilai-kantor-cabang"||pic==="from-individu-pemimpin")return!0;
  const ut=String(k&&k.unit_type||"").toLowerCase();
  return["kck","kc","kcp","kk","divisi","departemen","ukk","unit","project"].includes(ut);
}

/** Satu nama KPI per unit — utamakan baris dengan target/realisasi lebih lengkap.
 *  Matching unit memakai normUnitKey agar alias ejaan (Sidimpuan↔Sidempuan) tidak dobel.
 *  Jika unit sudah punya scorecard kck/kc/kcp/sync, buang KPI Individu pegawai agar skor
 *  tidak tercampur (contoh Cabkor: kck 2.70 + pegawai 3.11 → 2.90). */
function dedupeUnitKpis(list){
  const unitOfficeKeys=new Set(
    list
      .filter(k=>{
        const ut=String(k.unit_type||"").toLowerCase();
        const pic=String(k.pic||"");
        return pic==="from-nilai-kantor-cabang"||pic==="from-individu-pemimpin"||["kc","kck","kcp","kk"].includes(ut);
      })
      .map(k=>normUnitKey(k.unit_name))
      .filter(Boolean)
  );
  const filtered=list.filter(k=>{
    if(!isMenuKpi(k))return!1;
    const ut=String(k.unit_type||"").toLowerCase();
    if(ut==="pegawai"&&unitOfficeKeys.has(normUnitKey(k.unit_name)))return!1;
    return isUnitScorecardKpi(k);
  });
  const best=new Map;
  for(const k of filtered){
    const key=[normUnitKey(k.unit_name),normKpiName(k.name)].join("|");
    const prev=best.get(key);
    if(!prev){best.set(key,k);continue}
    const sNew=unitDataScore(k),sOld=unitDataScore(prev);
    if(sNew>sOld||(sNew===sOld&&(unitSourceRank(k)<unitSourceRank(prev)||(unitSourceRank(k)===unitSourceRank(prev)&&(parseFloat(k.weight)||0)>(parseFloat(prev.weight)||0))))){
      best.set(key,k);
    }
  }
  return[...best.values()];
}

const TIPE=[
  {value:"all",label:"Semua Tipe"},
  {value:"divisi",label:"Divisi"},
  {value:"departemen",label:"Departemen"},
  {value:"ukk",label:"UKK"},
  {value:"unit",label:"Unit"},
  {value:"project",label:"Project"},
  {value:"kc",label:"Kantor Cabang (KC)"},
  {value:"kcp",label:"Kantor Cabang Pembantu (KCP)"}
];

function ge(j){
  const l=parseFloat(j);
  return Number.isNaN(l)||l<=0?"-":l.toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function kb2(d){return String(Math.round((Number(d)+Number.EPSILON)*100)/100)}
function kbBobot(v){const n=Number(v);if(!Number.isFinite(n))return"—";const r=Math.round(n*100)/100;return r.toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1")}
/** Rasio pertumbuhan Excel (0.67), bukan poin persen (67.16%). */
function kbIsPertumbuhanPembiayaan(kpi){
  return/pertumbuhan\s*o\s*\/\s*s\s*pembiayaan/i.test(String(kpi&&kpi.name||""));
}
function fmtVal(kpi,num){
  if(num==null||num==="")return"-";
  const d=Number(num);
  if(!Number.isFinite(d))return"-";
  const kind=lt(kpi&&kpi.unit);
  const r=Math.round((d+Number.EPSILON)*100)/100;
  // Realisasi/target selalu ROUND 2 desimal
  // Pertumbuhan O/S Pembiayaan: tampil desimal Excel (0.67), tanpa tanda %
  if(kbIsPertumbuhanPembiayaan(kpi))return r.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  if(kind==="percentage")return r.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
  return r.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}

/** Ambil target akhir tahun dari monthly_target (Des → mundur). */
function annualFromMonthlyTarget(kpi){
  const mt=parseJsonField(kpi&&kpi.monthly_target);
  for(const m of["Des","Nov","Okt","Sep","Ags","Jul","Jun","Mei","Apr","Mar","Feb","Jan"]){
    const n=monthNum(mt,m);
    if(n!=null&&n!==0)return n;
  }
  return null;
}

/**
 * Target Tahun = field target.
 * Satuan currency/number: jika target tahunan tampak seperti % / bobot
 * (jauh lebih kecil dari target bulanan juta), pakai target Des.
 */
function resolveTargetTahunNum(kpi){
  const raw=kpi&&kpi.target;
  const e=raw==null||raw===""?NaN:Number(String(raw).replace(",","."));
  const kind=lt(kpi&&kpi.unit);
  const fromMt=annualFromMonthlyTarget(kpi);
  if((kind==="currency"||kind==="number")&&fromMt!=null){
    const absMt=Math.abs(fromMt);
    if(!Number.isFinite(e)||e==="")return fromMt;
    // Target = bobot, atau skala % vs jutaan di monthly
    const w=parseFloat(kpi.weight);
    if(Number.isFinite(w)&&Math.abs(e-w)<1e-9&&absMt>=1000)return fromMt;
    if(absMt>=1000&&Math.abs(e)<absMt/50)return fromMt;
  }
  if(!Number.isFinite(e))return null;
  return e;
}

/** Target Tahun = field target Individu (bukan hitungan YTD scoring). */
function displayTargetTahun(kpi){
  const n=resolveTargetTahunNum(kpi);
  if(n==null)return fmtVal(kpi,0);
  return fmtVal(kpi,n);
}

function resolveActual(kpi,scores){
  const n=scores&&scores.actualNum!=null?Number(scores.actualNum):null;
  if(n!=null&&Number.isFinite(n)&&n!==0)return n;
  const raw=kpi.actual;
  if(raw==null||raw==="")return null;
  const p=parseFloat(String(raw).replace(",","."));
  return Number.isFinite(p)&&p!==0?p:null;
}

function parseJsonField(v){
  if(typeof v!=="string")return v||{};
  try{return JSON.parse(v)||{}}catch{return{}}
}

const MONTHS=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

function monthNum(obj,key){
  const src=parseJsonField(obj);
  const raw=src==null?void 0:src[key];
  if(raw==null||raw==="")return null;
  const n=parseFloat(String(raw).replace(",","."));
  return Number.isFinite(n)?n:null;
}

function monthPctOrZero(kpi,month){
  if(!kbMonthClosed(month))return null;
  const src=parseJsonField(kpi.monthly_data);
  const raw=src==null?void 0:src[month];
  const empty=raw==null||raw==="";
  const actual=empty?null:parseFloat(String(raw).replace(",","."));
  if(empty||!Number.isFinite(actual))return null;
  let target=monthNum(kpi.monthly_target,month);
  if(target==null){
    const ann=parseFloat(String(kpi.target??"").replace(",","."));
    target=Number.isFinite(ann)?ann:0;
  }
  const pct=monthAch(actual,target,kpi.polarity);
  return Number.isFinite(pct)?Math.round(pct*100)/100:null;
}
function monthSkorOf(kpi,pct){
  if(!Number.isFinite(pct))return null;
  const unit=lt(kpi.unit);
  const indeks=kbY(pct,kpi.polarity,unit,kpi.perspective)||0;
  const bobot=parseFloat(kpi.weight)||0;
  // ROUND(bobot × indeks, 2) / 100 — bobot 0–100
  return Math.round(bobot*indeks*100)/100/100;
}
function MonthTriplet({kpi,month,style,canEdit,onOpenMenu}){
  const closed=kbMonthClosed(month);
  const actual=monthNum(kpi.monthly_data,month);
  const target=monthNum(kpi.monthly_target,month);
  const pct=monthPctOrZero(kpi,month);
  const hasR=actual!=null;
  const hasT=target!=null&&target!==0;
  const skor=closed&&pct!=null?monthSkorOf(kpi,pct):null;
  const pctCell=pct==null?"bg-slate-50/40 text-slate-400":pe(pct).cell;
  const clickProps=canEdit&&onOpenMenu?{onClick:onOpenMenu,className:"cursor-pointer"}:{};
  return[
    e.jsx(C,{
      className:P("border-r text-center align-middle text-[11px] font-semibold tabular-nums py-1.5 px-1 min-w-[52px] bg-blue-50/20",canEdit&&"cursor-pointer"),
      style,
      onClick:clickProps.onClick,
      children:e.jsx(KpiEditHint,{disabled:!canEdit,label:"Klik untuk edit",children:hasR?fmtVal(kpi,actual):fmtVal(kpi,0)})
    },month+"-r"),
    e.jsx(C,{
      className:P("border-r text-center align-middle text-[11px] text-slate-500 tabular-nums py-1.5 px-1 min-w-[52px] bg-sky-50/40",canEdit&&"cursor-pointer"),
      style,
      onClick:clickProps.onClick,
      children:e.jsx(KpiEditHint,{disabled:!canEdit,label:"Klik untuk edit",children:hasT?fmtVal(kpi,target):fmtVal(kpi,0)})
    },month+"-t"),
    e.jsx(C,{
      className:P("border-r text-center align-middle text-[11px] font-semibold tabular-nums py-1.5 px-1 min-w-[54px]",pctCell,canEdit&&"cursor-pointer"),
      style,
      onClick:clickProps.onClick,
      title:closed?"Pencapaian bulan (realisasi vs target)":"Bulan belum dihitung",
      children:pct!=null?pct.toFixed(2)+"%":"—"
    },month+"-p"),
    e.jsx(C,{
      className:P("border-r text-center align-middle text-[11px] font-bold tabular-nums py-1.5 px-1 min-w-[48px]",closed?"bg-violet-50/50 text-violet-800":"bg-slate-50/40 text-slate-400",canEdit&&"cursor-pointer"),
      style,
      onClick:clickProps.onClick,
      title:closed?"Skor bulan = ROUND(bobot × indeks, 2) / 100":"Bulan belum dihitung",
      children:skor!=null?skor.toFixed(2):"—"
    },month+"-s")
  ];
}

const TIPE_LABEL={kck:"Cabang Utama",kc:"KC",kcp:"KCP",divisi:"Divisi",departemen:"Departemen",ukk:"UKK",unit:"Unit",project:"Project"};

function gt(j){
  return[...j].sort((l,v)=>{
    const h=he(l.perspective)-he(v.perspective);
    if(h!==0)return h;
    const d=Number(l.sort_order??0)-Number(v.sort_order??0);
    return d!==0?d:String(l.name||"").localeCompare(String(v.name||""),"id");
  });
}

function StatusBadge({score}){
  const info=kbNilaiAkhir(score);
  const label=info.kategori||info.predikat||"-";
  if(label==="-")return e.jsx("span",{className:"text-slate-400",children:"-"});
  const st=info.style||{};
  return e.jsx("span",{
    className:"inline-flex px-2.5 py-1 rounded-md text-sm font-bold",
    style:{backgroundColor:st.backgroundColor||"#e2e8f0",color:st.color||"#334155"},
    children:label
  });
}
// Status baris KPI: predikat dari indeks 1–5 (sama KPI Individu), bukan dari hasil bobot.
function IndeksStatus({indeks}){
  const zA=kbPS(indeks);
  if(!zA||!(zA.indeks>0))return e.jsx("span",{className:"text-slate-400",children:"—"});
  return e.jsxs("span",{
    className:P("inline-flex items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",zA.badge),
    title:`Indeks ${zA.indeks} — ${zA.pencapaian||zA.predikat}`,
    children:[
      e.jsx("span",{className:P("w-2 h-2 rounded-full ring-1 ring-white/40",zA.dot)}),
      zA.predikat
    ]
  });
}

function jt({stats:j,className:l}){
  const{pencapaianTotal:h=0,kpiTercapai:d=0,kpiTotal:b=0,kpiTercapaiPersen:o=0,scoredCount:g=0,coveragePersen:k=0,skorAkhir:sa=0}=j||{},N=g>0?g:b;
  const skor=Number(sa)||0;
  const f=[
    {title:"Skor Akhir",value:g>0&&skor>0?skor.toFixed(2):"-",sub:"Skala penilaian akhir",color:"text-blue-600",border:"border-blue-100",extra:null},
    {title:"Status",value:null,sub:g>0?`Sesuai skala penilaian akhir · ${g} KPI berdata`:"Belum ada data",color:"text-slate-700",border:"border-slate-200",extra:e.jsx(StatusBadge,{score:skor})},
    {title:"Pencapaian Total",value:h>0?`${ge(h)}%`:"-",sub:k>0?`Coverage data ${k}%`:"Target: 100%",color:"text-green-600",border:"border-green-100",extra:null},
    {title:"KPI Tercapai",value:N>0?`${d} / ${N}`:"-",sub:N>0?`${Math.round(o)}% dari berdata`:"",color:"text-orange-600",border:"border-orange-100",extra:null}
  ];
  return e.jsx("div",{
    className:P("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4",l),
    children:f.map(m=>e.jsx(mt,{
      className:P("border shadow-sm",m.border),
      children:e.jsxs(xt,{
        className:"p-4",
        children:[
          e.jsx("p",{className:P("text-sm font-medium",m.color),children:m.title}),
          m.extra
            ?e.jsx("div",{className:"mt-2",children:m.extra})
            :e.jsx("p",{className:"text-2xl font-bold text-slate-800 mt-1 truncate",children:m.value}),
          m.sub?e.jsx("p",{className:"text-xs mt-0.5 text-muted-foreground",children:m.sub}):null
        ]
      })
    },m.title))
  });
}

function sameUnit(a,b){return normUnitKey(a)===normUnitKey(b)}
function pickDisplayName(key,candidates){
  if(!candidates||!candidates.length)return"";
  // Utamakan nama master unit kantor (mis. Sidempuan) bila ada di katalog
  const master=listUK().map(u=>u.name).find(n=>normUnitKey(n)===key);
  if(master&&candidates.some(c=>normUnitKey(c)===key))return master;
  // Utamakan ejaan yang dipakai baris unit upload (kc/kck/kcp)
  return candidates[0];
}
function persKeyOf(k){return kbNormPers(k.perspective)||String(k.perspective||"").trim()}

function lowestKpis(rows,limit=5){
  return gt(rows)
    .map(k=>{
      const u=lt(k.unit);
      const sc=it(k,u);
      return{kpi:k,...sc};
    })
    .filter(x=>x.scored&&x.pencapaian<100)
    .sort((a,b)=>a.pencapaian-b.pencapaian)
    .slice(0,limit);
}

function RankingTable({rows,onOpenUnit}){
  if(!rows.length)return null;
  return e.jsxs("div",{
    className:"bg-card rounded-xl border shadow-sm overflow-hidden",
    children:[
      e.jsxs("div",{
        className:"bg-white px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
        children:[
          e.jsxs("div",{children:[
            e.jsx("h2",{className:"text-sm font-bold text-slate-800 uppercase tracking-wide",children:"Ranking Unit"}),
            e.jsx("p",{className:"text-xs text-muted-foreground",children:"Klik baris untuk membuka scorecard detail unit"})
          ]}),
          e.jsx("p",{className:"text-xs text-slate-500",children:`${rows.length} unit`})
        ]
      }),
      e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{
        className:"w-full text-sm",
        children:[
          e.jsx("thead",{className:"bg-slate-50 text-slate-600",children:e.jsxs("tr",{children:[
            e.jsx("th",{className:"text-left px-3 py-2 font-semibold w-12",children:"No"}),
            e.jsx("th",{className:"text-left px-3 py-2 font-semibold",children:"Unit"}),
            e.jsx("th",{className:"text-center px-3 py-2 font-semibold",children:"Tipe"}),
            e.jsx("th",{className:"text-right px-3 py-2 font-semibold",children:"Skor Akhir"}),
            e.jsx("th",{className:"text-center px-3 py-2 font-semibold",children:"Status"}),
            e.jsx("th",{className:"text-right px-3 py-2 font-semibold",children:"Pencapaian"}),
            e.jsx("th",{className:"text-right px-3 py-2 font-semibold",children:"KPI"}),
            e.jsx("th",{className:"text-center px-3 py-2 font-semibold",children:"Aksi"})
          ]})}),
          e.jsx("tbody",{children:rows.map((r,i)=>e.jsxs("tr",{
            className:"border-t hover:bg-blue-50/40 cursor-pointer",
            onClick:()=>onOpenUnit(r.unit),
            children:[
              e.jsx("td",{className:"px-3 py-2.5 text-slate-500",children:i+1}),
              e.jsx("td",{className:"px-3 py-2.5 font-medium text-slate-800",children:r.unit}),
              e.jsx("td",{className:"px-3 py-2.5 text-center text-xs uppercase text-slate-500",children:(r.tipe||"-").toUpperCase()}),
              e.jsx("td",{className:"px-3 py-2.5 text-right font-bold tabular-nums text-blue-700",children:r.skor>0?r.skor.toFixed(2):"-"}),
              e.jsx("td",{className:"px-3 py-2.5 text-center",children:e.jsx(StatusBadge,{score:r.skor})}),
              e.jsx("td",{className:"px-3 py-2.5 text-right tabular-nums",children:r.pencapaian>0?`${ge(r.pencapaian)}%`:"-"}),
              e.jsxs("td",{className:"px-3 py-2.5 text-right tabular-nums text-slate-600",children:[r.kpiTercapai,"/",r.kpiTotal]}),
              e.jsx("td",{className:"px-3 py-2.5 text-center",children:e.jsx(T,{size:"sm",variant:"outline",className:"h-7 text-xs",onClick:ev=>{ev.stopPropagation();onOpenUnit(r.unit)},children:"Detail"})})
            ]
          },r.unit))})
        ]
      })})
    ]
  });
}

function LowestList({rows}){
  const low=lowestKpis(rows,5);
  if(!low.length)return null;
  return e.jsxs("div",{
    className:"border-t bg-amber-50/40 px-4 py-3",
    children:[
      e.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2",children:"KPI Terendah (belum tercapai)"}),
      e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2",children:low.map(x=>e.jsxs("div",{
        className:"rounded-lg border border-amber-100 bg-white px-3 py-2 flex items-start justify-between gap-2",
        children:[
          e.jsxs("div",{className:"min-w-0",children:[
            e.jsx("p",{className:"text-sm font-medium text-slate-800 truncate",children:x.kpi.name}),
            e.jsx("p",{className:"text-[11px] text-slate-500",children:ut(x.kpi.perspective)})
          ]}),
          e.jsxs("div",{className:"text-right shrink-0",children:[
            e.jsxs("p",{className:"text-sm font-bold text-red-600 tabular-nums",children:[x.pencapaian.toFixed(2),"%"]}),
            e.jsxs("p",{className:"text-[11px] text-slate-500",children:["Indeks ",x.indeks||"-"]})
          ]})
        ]
      },x.kpi.id))})
    ]
  });
}

function KpiEditHint({children,label="Klik untuk edit",disabled}){
  if(disabled)return children;
  const wrapRef=y.useRef(null);
  const[pos,setPos]=y.useState(null);
  const show=()=>{
    const el=wrapRef.current;if(!el)return;
    const r=el.getBoundingClientRect();
    setPos({top:Math.max(4,r.top-2),left:Math.min(window.innerWidth-120,r.right-4)});
  };
  const hide=()=>setPos(null);
  return e.jsxs(I.Fragment,{children:[
    e.jsx("span",{ref:wrapRef,onMouseEnter:show,onMouseLeave:hide,style:{display:"inline-block",maxWidth:"100%"},children}),
    pos?e.jsx("span",{style:{position:"fixed",top:pos.top,left:pos.left,transform:"translate(-100%,-100%)",zIndex:2147483000,backgroundColor:"#ea580c",color:"#fff",fontSize:"10px",fontWeight:700,lineHeight:1.2,padding:"3px 8px",borderRadius:"4px",whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 2px 8px rgba(234,88,12,.4)"},children:label}):null
  ]});
}

function UnitEditDialog({open,kpi,mode="meta",onClose,onSaved,toast:notify,api:apiClient}){
  const isMeta=mode==="meta";
  const isRealisasi=mode==="realisasi";
  const[md,setMd]=y.useState({});
  const[mt,setMt]=y.useState({});
  const[kpiName,setKpiName]=y.useState("");
  const[kpiCode,setKpiCode]=y.useState("");
  const[perspective,setPerspective]=y.useState("financial");
  const[satuan,setSatuan]=y.useState("percentage");
  const[polarity,setPolarity]=y.useState("maximize");
  const[bobot,setBobot]=y.useState("");
  const[targetTahun,setTargetTahun]=y.useState("");
  const[saving,setSaving]=y.useState(!1);
  const{data:masterRes}=se({
    queryKey:["kpis","master","unit-edit"],
    queryFn:()=>apiClient.get("/kpis/master"),
    enabled:!!(open&&isMeta&&apiClient),
    staleTime:6e4
  });
  const masterItems=y.useMemo(()=>{
    const raw=(masterRes&&masterRes.items)||masterRes||[];
    return Array.isArray(raw)?raw.filter(m=>m&&m.name):[];
  },[masterRes]);
  y.useEffect(()=>{
    if(!open||!kpi)return;
    setMd({...parseJsonField(kpi.monthly_data)});
    setMt({...parseJsonField(kpi.monthly_target)});
    setKpiName(String(kpi.name||"").trim());
    setKpiCode(String(kpi.kpi_code||kpi.parent_kpi_id||"").trim());
    setPerspective(String(kpi.perspective||"financial").trim()||"financial");
    const u0=lt(kpi.unit)||String(kpi.unit||"").trim()||"percentage";
    const known=(UNIT_OPTS||[]).some(o=>o.value===u0);
    setSatuan(known?u0:(String(kpi.unit||"").trim()||"percentage"));
    const p0=String(kpi.polarity||"maximize").trim()||"maximize";
    setPolarity(p0);
    setBobot(kpi.weight!=null&&kpi.weight!==""?String(kpi.weight):"");
    const tgN=resolveTargetTahunNum(kpi);
    setTargetTahun(tgN!=null?String(tgN):(kpi.target!=null&&kpi.target!==""?String(kpi.target):""));
  },[open,kpi,mode]);
  y.useEffect(()=>{
    if(!open||!kpi||!masterItems.length)return;
    const code=String(kpi.kpi_code||kpi.parent_kpi_id||"").trim().toUpperCase();
    const byCode=code?masterItems.find(m=>String(m.code||"").toUpperCase()===code):null;
    const nameKey=String(kpi.name||"").trim().toLowerCase();
    const byName=nameKey?masterItems.find(m=>String(m.name||"").trim().toLowerCase()===nameKey):null;
    const hit=byCode||byName;
    if(hit){
      setKpiCode(String(hit.code||""));
      if(!kpiName)setKpiName(String(hit.name||""));
    }
  },[open,kpi,masterItems]);
  const satuanOptions=(()=>{
    const base=[...(UNIT_OPTS||[])];
    if(satuan&&!base.some(o=>o.value===satuan))base.push({value:satuan,label:satuan});
    return base;
  })();
  const polarityOptions=(()=>{
    const base=[...(POL_OPTS||[])];
    if(polarity&&!base.some(o=>o.value===polarity)){
      base.unshift({value:polarity,label:polarity,shortLabel:polarity});
    }
    return base;
  })();
  const perspectiveValue=kbNormPers(perspective)||String(perspective||"financial").trim()||"financial";
  const perspectiveOptions=(()=>{
    const base=(PERS||[]).map(t=>({value:t,label:ut(t)}));
    if(perspectiveValue&&!base.some(o=>o.value===perspectiveValue)){
      base.unshift({value:perspectiveValue,label:ut(perspectiveValue)||perspectiveValue});
    }
    return base;
  })();
  const masterOptions=y.useMemo(()=>{
    const list=[...masterItems].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"id"));
    const curName=String(kpiName||"").trim();
    const curCode=String(kpiCode||"").trim();
    if(curName&&!list.some(m=>String(m.code||"")===curCode||String(m.name||"").trim().toLowerCase()===curName.toLowerCase())){
      list.unshift({code:curCode||"__current__",name:curName,perspective,unit:satuan,polarity});
    }
    return list;
  },[masterItems,kpiName,kpiCode,perspective,satuan,polarity]);
  const selectedMasterValue=(()=>{
    const code=String(kpiCode||"").trim();
    if(code&&masterOptions.some(m=>String(m.code||"")===code))return code;
    const nameKey=String(kpiName||"").trim().toLowerCase();
    const hit=masterOptions.find(m=>String(m.name||"").trim().toLowerCase()===nameKey);
    return hit?String(hit.code||""): (code||"__current__");
  })();
  const applyMaster=(code)=>{
    const m=masterOptions.find(x=>String(x.code||"")===String(code||""));
    if(!m)return;
    setKpiCode(String(m.code||"").startsWith("__")?"":String(m.code||""));
    setKpiName(String(m.name||"").trim());
    if(m.perspective)setPerspective(String(m.perspective));
    if(m.polarity)setPolarity(String(m.polarity));
    if(m.unit){
      const u0=lt(m.unit)||String(m.unit).trim();
      const known=(UNIT_OPTS||[]).some(o=>o.value===u0);
      setSatuan(known?u0:u0||satuan);
    }
  };
  if(!open||!kpi)return null;
  const setVal=(month,field,raw)=>{
    const next=String(raw??"");
    if(field==="realisasi")setMd(p=>({...p,[month]:next}));
    else setMt(p=>({...p,[month]:next}));
  };
  const doSave=async()=>{
    setSaving(!0);
    try{
      if(isMeta){
        const w=parseFloat(String(bobot).replace(",","."));
        if(!Number.isFinite(w))throw new Error("Bobot (%) harus angka");
        const tgRaw=String(targetTahun??"").trim();
        let tg="";
        if(tgRaw!==""){
          const n=parseFloat(tgRaw.replace(",","."));
          if(!Number.isFinite(n))throw new Error("Target Tahun harus angka");
          tg=n;
        }
        const nameVal=String(kpiName||"").trim();
        if(!nameVal)throw new Error("Nama KPI wajib dipilih");
        const unitVal=String(satuan||"").trim()||lt(kpi.unit)||"percentage";
        const polVal=String(polarity||"").trim()||kpi.polarity||"maximize";
        const persVal=kbNormPers(perspective)||String(perspective||"").trim()||kpi.perspective||"financial";
        const codeVal=String(kpiCode||"").trim()||null;
        await apiClient.updateKpi(kpi.id,{
          name:nameVal,
          perspective:persVal,
          unit:unitVal,
          polarity:polVal,
          target:tg,
          actual:kpi.actual,
          weight:w,
          unit_name:kpi.unit_name,
          jabatan:kpi.jabatan,
          unit_type:kpi.unit_type,
          status:kpi.status||"Draft",
          description:kpi.description||null,
          formula:kpi.formula||null,
          objective:kpi.objective||null,
          pic:kpi.pic||null,
          kpi_code:codeVal||kpi.kpi_code||null,
          parent_kpi_id:codeVal||kpi.parent_kpi_id||kpi.kpi_code||null,
          parent_kpi_manual:kpi.parent_kpi_manual||null,
          strategy_id:kpi.strategy_id||null,
          manual_indeks:kpi.manual_indeks??null,
          monthly_data:kpi.monthly_data||{},
          monthly_target:kpi.monthly_target||{}
        });
        notify&&notify({title:"Tersimpan",description:"Nama, perspektif, satuan, polarisasi, bobot, dan target tahun diperbarui"});
      }else{
        const monthly_data={},monthly_target={};
        for(const m of MONTHS){
          if(md[m]!==""&&md[m]!=null){
            const n=parseFloat(String(md[m]).replace(",","."));
            if(!Number.isFinite(n))throw new Error(`Realisasi ${m} harus angka`);
            monthly_data[m]=n;
          }else monthly_data[m]="";
          if(mt[m]!==""&&mt[m]!=null){
            const n=parseFloat(String(mt[m]).replace(",","."));
            if(!Number.isFinite(n))throw new Error(`Target ${m} harus angka`);
            monthly_target[m]=n;
          }else monthly_target[m]="";
        }
        await apiClient.updateKpiRealisasi(kpi.id,{monthly_data,monthly_target});
        notify&&notify({title:"Tersimpan",description:"Realisasi & target bulanan diperbarui"});
      }
      onSaved&&onSaved();
      onClose&&onClose();
    }catch(err){
      notify&&notify({title:"Gagal menyimpan",description:(err&&err.message)||"Gagal menyimpan",variant:"destructive"});
    }finally{
      setSaving(!1);
    }
  };
  const grid={display:"grid",gridTemplateColumns:"72px repeat(12, minmax(64px, 1fr))",gap:4,alignItems:"center"};
  return e.jsx("div",{
    style:{position:"fixed",inset:0,zIndex:40,background:"rgba(11,27,51,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
    onClick:ev=>{if(ev.target===ev.currentTarget&&!saving)onClose&&onClose()},
    children:e.jsxs("div",{
      style:{width:isMeta?"min(520px, 96vw)":"min(1120px, 96vw)",background:"#fff",borderRadius:10,boxShadow:"0 20px 50px rgba(0,0,0,.35)",overflow:isMeta?"visible":"hidden",maxHeight:"92vh",display:"flex",flexDirection:"column",position:"relative",zIndex:41},
      onClick:ev=>ev.stopPropagation(),
      children:[
        e.jsxs("div",{className:"bg-[#0f2744] text-white px-4 py-3 shrink-0",children:[
          e.jsx("h2",{className:"text-sm font-semibold",children:isMeta?"Edit KPI":"Edit Realisasi & Target"}),
          e.jsx("p",{className:"text-[11px] text-white/70 mt-0.5 truncate",children:`${kpiName||kpi.name||""} · ${kpi.unit_name||""}`})
        ]}),
        e.jsxs("div",{className:isMeta?"p-4 space-y-3":"p-4 space-y-3 overflow-y-auto",children:[
          isMeta?e.jsxs("div",{className:"grid grid-cols-1 gap-3",children:[
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Nama KPI"}),
              e.jsxs(M,{value:selectedMasterValue,onValueChange:applyMaster,children:[
                e.jsx(B,{className:"h-9 w-full",children:e.jsx(E,{placeholder:masterItems.length?"Pilih dari Master KPI":"Memuat Master KPI…"})}),
                e.jsx(R,{className:"max-h-72",position:"popper",style:{zIndex:500},children:masterOptions.map(o=>e.jsxs(c,{value:String(o.code||o.name),children:[
                  e.jsx("span",{className:"block truncate",children:o.name}),
                  o.code&&!String(o.code).startsWith("__")?e.jsx("span",{className:"block text-[10px] text-slate-400",children:o.code}):null
                ]},String(o.code||o.name)))})
              ]}),
              e.jsx("p",{className:"text-[10px] text-slate-500",children:"Pilih nama dari Master KPI. Perspektif, satuan & polarisasi ikut terisi dari master."})
            ]}),
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Perspektif"}),
              e.jsxs(M,{value:perspectiveValue,onValueChange:v=>setPerspective(kbNormPers(v)||v),children:[
                e.jsx(B,{className:"h-9 w-full",children:e.jsx(E,{placeholder:"Pilih perspektif"})}),
                e.jsx(R,{position:"popper",style:{zIndex:500},children:perspectiveOptions.map(o=>e.jsx(c,{value:o.value,children:o.label},o.value))})
              ]})
            ]}),
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Satuan"}),
              e.jsxs(M,{value:satuan,onValueChange:setSatuan,children:[
                e.jsx(B,{className:"h-9 w-full",children:e.jsx(E,{})}),
                e.jsx(R,{position:"popper",style:{zIndex:500},children:satuanOptions.map(o=>e.jsx(c,{value:o.value,children:o.label},o.value))})
              ]})
            ]}),
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Polarisasi"}),
              e.jsxs(M,{value:polarity,onValueChange:setPolarity,children:[
                e.jsx(B,{className:"h-9 w-full",children:e.jsx(E,{placeholder:"Pilih polarisasi"})}),
                e.jsx(R,{position:"popper",style:{zIndex:500},children:polarityOptions.map(o=>e.jsx(c,{value:o.value,children:o.label||o.shortLabel||o.value},o.value))})
              ]})
            ]}),
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Bobot (%)"}),
              e.jsx(fe,{type:"text",inputMode:"decimal",className:"h-9",value:bobot,onChange:ev=>setBobot(ev.target.value),placeholder:"0"})
            ]}),
            e.jsxs("div",{className:"space-y-1",children:[
              e.jsx("label",{className:"text-[11px] font-semibold text-slate-600",children:"Target Tahun"}),
              e.jsx(fe,{type:"text",inputMode:"decimal",className:"h-9",value:targetTahun,onChange:ev=>setTargetTahun(ev.target.value),placeholder:"0"})
            ]})
          ]}):null,
          isRealisasi?e.jsxs("div",{className:"rounded-md border border-slate-200 p-2 space-y-2 overflow-x-auto",children:[
            e.jsxs("div",{style:grid,children:[
              e.jsx("div",{className:"text-[11px] font-semibold text-slate-600",children:"Bulan"}),
              ...MONTHS.map(m=>e.jsx("div",{className:"text-[11px] font-semibold text-slate-700 text-center",children:m},"h-"+m))
            ]}),
            e.jsxs("div",{style:grid,children:[
              e.jsx("div",{className:"text-[11px] font-semibold text-slate-600",children:"Realisasi"}),
              ...MONTHS.map(m=>e.jsx(fe,{type:"text",inputMode:"decimal",className:"h-8 text-xs px-1 text-center",value:md[m]??"",onChange:ev=>setVal(m,"realisasi",ev.target.value)},"r-"+m))
            ]}),
            e.jsxs("div",{style:grid,children:[
              e.jsx("div",{className:"text-[11px] font-semibold text-slate-600",children:"Target"}),
              ...MONTHS.map(m=>e.jsx(fe,{type:"text",inputMode:"decimal",className:"h-8 text-xs px-1 text-center",value:mt[m]??"",onChange:ev=>setVal(m,"target",ev.target.value)},"t-"+m))
            ]})
          ]}):null,
          e.jsx("p",{className:"text-[11px] text-slate-500",children:isMeta?"Ubah nama (Master KPI), perspektif, satuan, polarisasi, bobot, dan target tahun KPI Unit.":"Ubah realisasi & target bulanan (superadmin dapat semua bulan)."}),
          e.jsxs("div",{className:"flex gap-2 pt-1",children:[
            e.jsx(T,{type:"button",variant:"outline",className:"flex-1",disabled:saving,onClick:()=>onClose&&onClose(),children:"Batal"}),
            e.jsx(T,{type:"button",className:"flex-1 bg-blue-600 hover:bg-blue-700 text-white",disabled:saving,onClick:doSave,children:saving?"Menyimpan…":"Simpan"})
          ]})
        ]})
      ]
    })
  });
}

function DetailTable({rows,canEdit,selectedId,onOpenMenu}){
  const x=gt(rows);
  if(!x.length)return null;
  const openMenu=(n,ev)=>{
    if(!canEdit||!onOpenMenu)return;
    ev.stopPropagation();
    onOpenMenu(n,{
      x:Math.min(ev.clientX,(window.innerWidth||800)-200),
      y:Math.min(ev.clientY,(window.innerHeight||600)-160)
    });
  };
  return e.jsxs(I.Fragment,{children:x.map((n,FA)=>{
    const u=lt(n.unit);
    const sc=it(n,u);
    const{pencapaian:N,indeks:f,hasil:m,scored:hS}=sc;
    const persKey=persKeyOf(n);
    const persPrev=FA>0&&persKeyOf(x[FA-1])===persKey;
    let persSpan=0;
    if(!persPrev){persSpan=1;for(let i=FA+1;i<x.length&&persKeyOf(x[i])===persKey;i++)persSpan++}
    const persBreak=!persPrev&&FA>0;
    const persLine=persBreak?{borderTop:"1.5px solid #64748b"}:{};
    const selected=selectedId===n.id;
    return e.jsxs(z,{
      className:P("hover:bg-slate-50",selected&&"bg-blue-50/60"),
      children:[
        !persPrev?e.jsx(C,{rowSpan:persSpan,className:"border-r align-middle text-sm font-semibold text-slate-800 px-2 py-2 bg-slate-50 whitespace-nowrap sticky z-20",style:{left:0,minWidth:110,verticalAlign:"middle",...persLine},onClick:canEdit?ev=>openMenu(n,ev):void 0,children:e.jsx(KpiEditHint,{disabled:!canEdit,children:ut(n.perspective)})}):null,
        e.jsx(C,{className:P("border-r align-top py-2 px-2 sticky z-20",selected?"bg-blue-50":"bg-white",canEdit&&"cursor-pointer"),style:{left:110,minWidth:220,...persLine},onClick:canEdit?ev=>openMenu(n,ev):void 0,children:e.jsx(KpiEditHint,{disabled:!canEdit,children:e.jsx("div",{className:"font-medium text-sm text-blue-900",children:n.name})})}),
        e.jsx(C,{className:P("border-r text-center align-top text-sm py-2 sticky z-20",selected?"bg-blue-50":"bg-white",canEdit&&"cursor-pointer"),style:{left:330,minWidth:80,...persLine},onClick:canEdit?ev=>openMenu(n,ev):void 0,children:e.jsx(KpiEditHint,{disabled:!canEdit,children:ot(u)})}),
        e.jsx(C,{className:P("border-r text-center align-top text-sm font-semibold py-2 sticky z-20",selected?"bg-blue-50":"bg-white",canEdit&&"cursor-pointer"),style:{left:410,minWidth:70,...persLine},onClick:canEdit?ev=>openMenu(n,ev):void 0,children:e.jsx(KpiEditHint,{disabled:!canEdit,children:kbBobot(n.weight)})}),
        e.jsx(C,{className:P("border-r text-center align-top text-sm py-2 sticky z-20",selected?"bg-blue-50":"bg-white",canEdit&&"cursor-pointer"),style:{left:480,minWidth:90,boxShadow:"2px 0 4px -2px rgba(0,0,0,.18)",...persLine},onClick:canEdit?ev=>openMenu(n,ev):void 0,children:e.jsx(KpiEditHint,{disabled:!canEdit,children:displayTargetTahun(n)})}),
        ...MONTHS.flatMap(mo=>MonthTriplet({kpi:n,month:mo,style:persLine,canEdit,onOpenMenu:ev=>openMenu(n,ev)})),
        e.jsx(C,{className:P("border-r text-center align-top text-sm font-semibold py-2",hS?pe(N).cell:"text-slate-400",canEdit&&"cursor-pointer"),style:persLine,onClick:canEdit?ev=>openMenu(n,ev):void 0,children:hS?((Number(N)||0).toFixed(2)+"%"):"0.00%"}),
        e.jsx(C,{className:P("border-r text-center align-top text-sm font-bold py-2",hS&&f>0?ct(f).cell:"text-slate-400",canEdit&&"cursor-pointer"),style:persLine,onClick:canEdit?ev=>openMenu(n,ev):void 0,children:hS?Number(m||0).toFixed(2):"0.00"}),
        e.jsx(C,{className:P("text-center align-top text-sm py-2",canEdit&&"cursor-pointer"),style:persLine,onClick:canEdit?ev=>openMenu(n,ev):void 0,children:hS?e.jsx(IndeksStatus,{indeks:f}):e.jsx("span",{className:"text-slate-400",children:"0"})})
      ]
    },n.id);
  })});
}

function lookupUnitMeta(unitName){
  const key=normUnitKey(unitName);
  if(!key)return null;
  const all=listUK();
  return all.find(u=>normUnitKey(u.name)===key)||all.find(u=>normUnitKey(u.name).includes(key)||key.includes(normUnitKey(u.name)))||null;
}

/** Satu sumber skor unit untuk UI ranking + export Excel (harus identik). */
function buildRankingRowsFromGroups(ce, {formatUnitKerja, isUnitCabang}={}){
  return Object.entries(ce||{}).map(([unit,rows])=>{
    const st=dt(rows);
    const skorRaw=st.scoredCount>0?Number(st.skorAkhir)||0:0;
    // Samakan tampilan UI (.toFixed(2)) dengan angka di Excel
    const skor=skorRaw>0?Math.round((skorRaw+Number.EPSILON)*100)/100:0;
    const meta=lookupUnitMeta(unit);
    const unitType=(rows[0]&&rows[0].unit_type)||inferUT(unit)||"";
    const masterType=meta&&meta.type||"";
    const labelSrc=(meta&&meta.name)||unit;
    const kantor=typeof formatUnitKerja==="function"
      ?formatUnitKerja(labelSrc,{type:masterType,unitType})
      :labelSrc;
    const isCabang=typeof isUnitCabang==="function"
      ?isUnitCabang(labelSrc,{type:masterType,unitType})
      :false;
    const kategori=skor>0?kbNilaiAkhir(skor).kategori:"-";
    return{
      unit,
      unitType,
      type:masterType,
      masterType,
      tipe:kpiOrg({unit_name:unit,unit_type:unitType})||orgKind(unit),
      isCabang,
      kode:meta&&meta.kode!=null?meta.kode:"",
      kantor,
      skor,
      kategori,
      pencapaian:st.pencapaianTotal||0,
      kpiTercapai:st.kpiTercapai||0,
      kpiTotal:st.kpiTotal||0,
      scoredCount:st.scoredCount||0
    };
  }).sort((a,b)=>
    (b.skor||0)-(a.skor||0)||
    (b.pencapaian||0)-(a.pencapaian||0)||
    String(a.kantor||a.unit||"").localeCompare(String(b.kantor||b.unit||""),"id")
  );
}

async function buildExport(ce){
  const[{buildUnitRankingWorkbook,appendUnitScorecardSheets,nilaiPeriodeMonthLabel,formatUnitKerja,isUnitCabang,safeFilePart},XS]=await Promise.all([
    import("./kpi-individu-export-Core01.js"),
    import("./xlsx-style-01.js")
  ]);
  const year=new Date().getFullYear();
  const monthLabel=nilaiPeriodeMonthLabel();
  // WAJIB: dataset & skor sama persis dengan yang tampil di UI KPI Unit
  const rankingRows=buildRankingRowsFromGroups(ce,{formatUnitKerja,isUnitCabang});
  const wb=buildUnitRankingWorkbook(XS.utils,rankingRows,{year,monthLabel});
  // Sheet scorecard detail per unit (perspektif, KPI, bobot, 12 bulan × Realisasi/Target/Pencapaian/Skor, YTD, Status)
  appendUnitScorecardSheets(XS.utils,wb,ce,{
    year,monthLabel,
    metaFor:(unit,rows)=>{
      const r=rankingRows.find(x=>x.unit===unit)||{};
      return{kantor:r.kantor||unit,tipe:r.tipe||""};
    }
  });
  const scope=rankingRows.length===1?rankingRows[0].kantor:monthLabel;
  XS.writeFile(wb,`Laporan_Unit_${safeFilePart(scope)}_${year}.xlsx`);
  return rankingRows.length;
}

/** Export PDF scorecard lengkap semua unit pada filter (1 halaman per unit). */
async function buildPdfExport(ce){
  const[{buildUnitReport,buildPdf,nilaiPeriodeMonthLabel,formatUnitKerja,isUnitCabang,safeFilePart}]=await Promise.all([
    import("./kpi-individu-export-Core01.js")
  ]);
  const{P:JsPDF}=await import("./KPIIndividu-MonthLine03.js");
  const year=new Date().getFullYear();
  const monthLabel=nilaiPeriodeMonthLabel();
  const rankingRows=buildRankingRowsFromGroups(ce,{formatUnitKerja,isUnitCabang});
  const reports=rankingRows.map((r,ri)=>{
    const rows=ce[r.unit]||[];
    const rep=buildUnitReport(r.unit,rows,{kantor:r.kantor,tipe:TIPE_LABEL[r.tipe]||r.tipe||""});
    rep._idx=ri;
    return rep;
  });
  // A3 landscape agar 12 bulan × 4 kolom tetap terbaca
  const doc=buildPdf(JsPDF,reports,year,"a3",{kind:"unit"});
  const scope=rankingRows.length===1?rankingRows[0].kantor:monthLabel;
  doc.save(`Scorecard_Unit_${safeFilePart(scope)}_${year}.pdf`);
  return reports.length;
}

function qt(){
  const{user:a}=qe(),{toast:U}=Ve(),client=qc(),
    isUser=(a==null?void 0:a.role)==="user",
    isSA=(a==null?void 0:a.role)==="superadmin",
    unitUnrestricted=isSA||!!(a&&a.unit_scope_unrestricted),
    scopedUnits=Array.isArray(a&&a.scoped_units)?a.scoped_units:(a&&a.unit_name?[a.unit_name]:[]),
    isPemimpin=isUser&&isPemimpinHead(a==null?void 0:a.jabatan),
    isPemimpinCabang=isUser&&isPemimpinUK(a==null?void 0:a.jabatan),
    [tipe,H]=y.useState((!unitUnrestricted&&(a!=null&&a.unit_name))? (orgKind(a.unit_name)||"all") : "all"),
    [unitName,re]=y.useState((!unitUnrestricted||isUser)&&(a!=null&&a.unit_name)?a.unit_name:"all"),
    [unitOpen,setUnitOpen]=y.useState(!1),
    [persp,f]=y.useState("all"),
    [g,k]=y.useState(""),
    [shown,F]=y.useState(!!isUser),
    [editKpi,setEditKpi]=y.useState(null),
    [editMode,setEditMode]=y.useState("meta"),
    [menuKpi,setMenuKpi]=y.useState(null),
    [menuPos,setMenuPos]=y.useState({x:0,y:0}),
    [selectedId,setSelectedId]=y.useState(null);

  y.useEffect(()=>{
    if(!menuKpi)return;
    const close=()=>setMenuKpi(null);
    const onKey=ev=>{if(ev.key==="Escape")close()};
    window.addEventListener("click",close);
    window.addEventListener("keydown",onKey);
    return()=>{window.removeEventListener("click",close);window.removeEventListener("keydown",onKey)};
  },[menuKpi]);

  const openKpiMenu=(kpi,pos)=>{
    setSelectedId(kpi.id);
    setMenuKpi(kpi);
    setMenuPos(pos||{x:120,y:120});
  };
  const openEdit=(kpi,mode)=>{
    setEditKpi(kpi);
    setEditMode(mode);
    setMenuKpi(null);
    setSelectedId(kpi&&kpi.id||null);
  };

  const delMut=useMut({
    mutationFn:id=>_.deleteKpi(id),
    onSuccess:()=>{
      client.invalidateQueries({queryKey:["kpis","kpi-unit-kantor"]});
      client.invalidateQueries({queryKey:["kpis"]});
      U({title:"Berhasil",description:"KPI Unit berhasil dihapus"});
      setMenuKpi(null);
      setSelectedId(null);
    },
    onError:err=>{
      U({title:"Gagal menghapus",description:(err&&err.message)||"Gagal menghapus KPI",variant:"destructive"});
    }
  });

  const{data:Q=[],isLoading:Ce}=se({
    queryKey:["kpis","kpi-unit-kantor",isPemimpinCabang?"unit-office":"default"],
    queryFn:()=>isPemimpinCabang?_.getKpis({scope:"unit-office",fields:"score"}):_.getKpis({fields:"score"})
  });

  se({
    queryKey:["penilaian-akhir"],
    queryFn:async()=>{
      const rows=await _.getPenilaianAkhir().catch(()=>[]);
      try{localStorage.setItem("kb_nilai_akhir",JSON.stringify(rows||[]))}catch(_){}
      return rows;
    }
  });

  const pemimpinKpis=y.useMemo(()=>{
    const list=Array.isArray(Q)?Q:(Q==null?void 0:Q.data)||[];
    return dedupeUnitKpis(list.filter(isMenuKpi));
  },[Q]);

  const unitOptions=y.useMemo(()=>{
    const fromData=pemimpinKpis.map(k=>k.unit_name).filter(Boolean);
    const fromMaster=listUK().map(u=>u.name);
    const groups=new Map;
    [...fromData,...fromMaster].forEach(name=>{
      const key=normUnitKey(name);
      if(!key)return;
      if(!groups.has(key))groups.set(key,[]);
      const arr=groups.get(key);
      if(!arr.includes(name))arr.push(name);
    });
    let all=[...groups.entries()].map(([key,names])=>pickDisplayName(key,names)).filter(Boolean)
      .sort((x,y2)=>x.localeCompare(y2,"id"));
    if(!unitUnrestricted){
      const allow=new Set((scopedUnits||[]).map(nm=>normUnitKey(nm)));
      all=all.filter(name=>allow.has(normUnitKey(name)));
      if(!all.length&&(a&&a.unit_name)) all=[a.unit_name];
    }
    if(tipe==="all")return all;
    const byTipe=new Set(
      pemimpinKpis.filter(k=>kpiOrg(k)===tipe).map(k=>normUnitKey(k.unit_name)).filter(Boolean)
    );
    return all.filter(name=>orgKind(name)===tipe||byTipe.has(normUnitKey(name)));
  },[pemimpinKpis,tipe,unitUnrestricted,scopedUnits,a&&a.unit_name]);

  const tipeOptions=y.useMemo(()=>{
    if(unitUnrestricted)return TIPE;
    const kinds=new Set;
    (scopedUnits||[]).forEach(nm=>{const k=orgKind(nm); if(k)kinds.add(k)});
    if(a&&a.unit_name){const k=orgKind(a.unit_name); if(k)kinds.add(k)}
    pemimpinKpis.forEach(k=>{const t=kpiOrg(k); if(t&&(scopedUnits||[]).some(su=>sameUnit(su,k.unit_name)))kinds.add(t)});
    const filtered=TIPE.filter(t=>t.value==="all"||kinds.has(t.value));
    return filtered.length?filtered:TIPE.filter(t=>t.value==="all"||t.value===(orgKind(a&&a.unit_name)||""));
  },[unitUnrestricted,scopedUnits,a,pemimpinKpis]);

  y.useEffect(()=>{
    if(unitUnrestricted)return;
    if(a&&a.unit_name){
      const kind=orgKind(a.unit_name);
      if(kind)H(kind);
      re(a.unit_name);
    }
  },[unitUnrestricted,a&&a.unit_name]);

  y.useEffect(()=>{isUser&&F(!0)},[isUser]);

  const O=y.useMemo(()=>{
    let list=pemimpinKpis;
    if(!unitUnrestricted){
      const allow=new Set((scopedUnits||[]).map(nm=>normUnitKey(nm)));
      if(a&&a.unit_name)allow.add(normUnitKey(a.unit_name));
      list=list.filter(k=>allow.has(normUnitKey(k.unit_name))||sameUnit(k.unit_name,a&&a.unit_name));
      if(tipe!=="all")list=list.filter(k=>kpiOrg(k)===tipe);
      if(unitName!=="all")list=list.filter(k=>sameUnit(k.unit_name,unitName));
    }else if(isUser&&(a!=null&&a.unit_name)){
      list=list.filter(k=>sameUnit(k.unit_name,a.unit_name)||k.unit_name===a.unit_name);
      if(isPemimpin)list=list.filter(k=>String(k.jabatan||"").trim().toLowerCase()===String(a.jabatan||"").trim().toLowerCase()||k.pic==="from-individu-pemimpin");
    }else{
      if(tipe!=="all")list=list.filter(k=>kpiOrg(k)===tipe);
      if(unitName!=="all")list=list.filter(k=>sameUnit(k.unit_name,unitName));
    }
    if(persp!=="all")list=list.filter(k=>k.perspective===persp);
    if(g.trim()){
      const q=g.toLowerCase();
      list=list.filter(k=>[k.name,k.unit_name,k.jabatan].filter(Boolean).some(s=>String(s).toLowerCase().includes(q)));
    }
    return gt(list);
  },[pemimpinKpis,isUser,isPemimpin,a,tipe,unitName,persp,g]);

  const groupByUnit=(list)=>{
    const groups=new Map;
    list.forEach(s=>{
      const raw=s.unit_name||"Unit Tidak Diketahui";
      const key=normUnitKey(raw)||raw;
      if(!groups.has(key))groups.set(key,{label:raw,names:[raw],rows:[]});
      const g=groups.get(key);
      if(!g.names.includes(raw))g.names.push(raw);
      g.rows.push(s);
    });
    const out={};
    for(const[key,g]of groups.entries()){
      const label=pickDisplayName(key,g.names)||g.label;
      out[label]=g.rows;
    }
    return out;
  };
  const ce=y.useMemo(()=>groupByUnit(O),[O]);
  // Ranking UI & Export Excel memakai builder yang sama dari `ce` (data yang tampil di UI)
  const ranking=y.useMemo(()=>buildRankingRowsFromGroups(ce),[ce]);

  const Te=y.useMemo(()=>dt(O),[O]);
  const multiUnit=!isUser&&unitName==="all"&&ranking.length>1;
  const showDetail=!multiUnit;

  const onShow=()=>{
    if(!isUser&&unitName==="all"&&tipe==="all"){
      U({title:"Pilih filter",description:"Pilih tipe unit (Divisi / Departemen / UKK / Unit / Project / KC / KCP) atau nama unit terlebih dahulu.",variant:"destructive"});
      return;
    }
    F(!0);
  };

  const openUnit=name=>{
    re(name);
    F(!0);
  };

  const[exporting,setExporting]=y.useState(!1);
  const[exportingPdf,setExportingPdf]=y.useState(!1);
  const[syncing,setSyncing]=y.useState(!1);
  const onSync=async()=>{
    if(!window.confirm("Sinkronisasi menimpa KPI Unit agar sama dengan KPI Individu pemimpin Divisi, Departemen, UKK, Unit, Cabang, dan Project. Lanjutkan?"))return;
    setSyncing(!0);
    try{
      const res=await _.post("/kpis/sync-unit-from-pemimpin",{});
      await client.invalidateQueries({queryKey:["kpis","kpi-unit-kantor"]});
      F(!0);
      const by=res&&res.byOrg?Object.entries(res.byOrg).map(([k,v])=>`${k}:${v}`).join(", "):"";
      U({title:"Sinkronisasi selesai",description:((res&&res.message)||"KPI Unit sudah mengikuti KPI Individu pemimpin.")+(by?" ("+by+")":"")});
    }catch(err){
      U({title:"Gagal sinkronisasi",description:(err&&err.message)||"Gagal menyinkronkan KPI Unit",variant:"destructive"});
    }finally{
      setSyncing(!1);
    }
  };
  const onExport=async()=>{
    if(!Object.keys(ce).length){
      U({title:"Tidak ada data",description:"Tampilkan data unit terlebih dahulu.",variant:"destructive"});
      return;
    }
    setExporting(!0);
    try{
      // Pakai `ce` yang sama dengan ranking + scorecard di UI
      const n=await buildExport(ce);
      U({title:"Export berhasil",description:`Excel ranking + scorecard detail ${n} unit (realisasi, target, pencapaian, skor per bulan) — sama dengan UI KPI Unit.`});
    }catch(err){
      console.error("Export KPI Unit error:",err);
      U({title:"Gagal export",description:(err&&err.message)||"Gagal membuat Excel",variant:"destructive"});
    }finally{
      setExporting(!1);
    }
  };
  const onExportPdf=async()=>{
    if(!Object.keys(ce).length){
      U({title:"Tidak ada data",description:"Tampilkan data unit terlebih dahulu.",variant:"destructive"});
      return;
    }
    setExportingPdf(!0);
    try{
      const n=await buildPdfExport(ce);
      U({title:"Export PDF berhasil",description:`Scorecard lengkap ${n} unit — satu halaman per unit, sama dengan UI KPI Unit.`});
    }catch(err){
      console.error("Export PDF KPI Unit error:",err);
      U({title:"Gagal export PDF",description:(err&&err.message)||"Gagal membuat PDF",variant:"destructive"});
    }finally{
      setExportingPdf(!1);
    }
  };

  return e.jsxs("div",{className:"flex flex-col space-y-4 pb-8",children:[
    e.jsx(ht,{
      eyebrow:"KPI Unit",
      title:"KPI Unit",
      subtitle:isPemimpin
        ?`Scorecard unit kantor dari KPI Individu Anda sebagai pemimpin — ${(a==null?void 0:a.unit_name)||""}`
        :"Scorecard KPI Unit dari KPI Individu pemimpin — Divisi, Departemen, UKK, Unit, Project, dan Cabang",
      actions:!isUser||(shown&&O.length>0)?e.jsxs("div",{className:"flex flex-wrap gap-2",children:[
        !isUser?e.jsx(T,{variant:"outline",size:"sm",className:"h-9",disabled:syncing,onClick:onSync,children:syncing?"Menyinkronkan...":"Sinkronisasi KPI Unit"}):null,
        shown&&O.length>0?e.jsxs(T,{variant:"outline",size:"sm",className:"h-9",disabled:exporting,onClick:onExport,children:[
          e.jsx(Dl,{className:"w-3.5 h-3.5 mr-1.5"}),exporting?"Menyiapkan...":"Export Excel"
        ]}):null,
        shown&&O.length>0?e.jsxs(T,{variant:"outline",size:"sm",className:"h-9",disabled:exportingPdf,onClick:onExportPdf,children:[
          e.jsx(PdfIcon,{className:"w-3.5 h-3.5 mr-1.5"}),exportingPdf?"Menyiapkan...":"Export PDF"
        ]}):null
      ]}):null
    }),

    O.length>0&&shown?e.jsx(jt,{stats:Te}):null,

    !isUser?e.jsx("div",{className:"flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200",children:e.jsxs("div",{className:"flex flex-wrap gap-3 items-end",children:[
      e.jsxs("div",{className:"relative flex-1 min-w-[180px] max-w-sm",children:[
        e.jsx(me,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"}),
        e.jsx(fe,{className:"pl-9",placeholder:"Cari nama KPI / unit...",value:g,onChange:t=>{k(t.target.value);F(!1)}})
      ]}),
      e.jsxs(M,{value:tipe,onValueChange:t=>{H(t);re("all");F(!1)},children:[
        e.jsx(B,{className:"w-auto min-w-[200px]",children:e.jsx(E,{})}),
        e.jsx(R,{children:tipeOptions.map(o=>e.jsx(c,{value:o.value,children:o.label},o.value))})
      ]}),
      e.jsxs(Pop,{open:unitOpen,onOpenChange:setUnitOpen,children:[
        e.jsx(PopTrig,{asChild:!0,children:e.jsxs(T,{variant:"outline",role:"combobox",className:"w-auto min-w-[220px] max-w-[320px] justify-between h-9 font-normal",children:[
          e.jsx("span",{className:"truncate",children:unitName==="all"?"Semua Unit":unitName}),
          e.jsx(ChevronsUpDown,{className:"ml-2 h-4 w-4 shrink-0 opacity-50"})
        ]})}),
        e.jsx(PopCont,{className:"w-[320px] p-0 !z-[80]",align:"start",children:e.jsxs(Cmd,{children:[
          e.jsx(CmdInput,{placeholder:"Cari unit…"}),
          e.jsxs(CmdList,{children:[
            e.jsx(CmdEmpty,{children:"Unit tidak ditemukan."}),
            e.jsxs(CmdGroup,{children:[
              unitUnrestricted&&e.jsxs(CmdItem,{value:"all Semua Unit",onSelect:()=>{re("all");F(!1);setUnitOpen(!1)},children:[
                e.jsx(CheckIcon,{className:P("mr-2 h-4 w-4",unitName==="all"?"opacity-100":"opacity-0")}),
                "Semua Unit"
              ]}),
              unitOptions.map(t=>e.jsxs(CmdItem,{value:t,onSelect:()=>{re(t);F(!1);setUnitOpen(!1)},children:[
                e.jsx(CheckIcon,{className:P("mr-2 h-4 w-4",unitName===t?"opacity-100":"opacity-0")}),
                t
              ]},t))
            ]})
          ]})
        ]})})
      ]}),
      e.jsxs(M,{value:persp,onValueChange:t=>{f(t);F(!1)},children:[
        e.jsx(B,{className:"w-auto min-w-[160px]",children:e.jsx(E,{})}),
        e.jsxs(R,{children:[
          e.jsx(c,{value:"all",children:"Semua Perspektif"}),
          PERS.map(t=>e.jsx(c,{value:t,children:ut(t)},t))
        ]})
      ]}),
      e.jsx(T,{onClick:onShow,className:"bg-blue-600 hover:bg-blue-700",children:"Tampilkan Data"})
    ]})}):null,

    Ce?e.jsx("div",{className:"space-y-4",children:[1,2,3,4].map(t=>e.jsx(He,{className:"h-16 w-full rounded-lg"},t))}):
    !shown?e.jsxs("div",{className:"text-center py-16 bg-card rounded-xl border border-dashed border-border",children:[
      e.jsx("div",{className:"w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center",children:e.jsx(me,{className:"w-8 h-8 text-blue-500"})}),
      e.jsx("h3",{className:"text-lg font-semibold text-foreground mb-1",children:"Silakan Pilih Filter"}),
      e.jsxs("p",{className:"text-muted-foreground max-w-md mx-auto",children:[
        "Pilih tipe ",e.jsx("span",{className:"font-semibold text-slate-700",children:"Divisi / Departemen / UKK / Unit / Project / KC / KCP"}),
        ", lalu klik Tampilkan Data."
      ]})
    ]}):
    O.length===0?e.jsxs("div",{className:"text-center py-16 bg-card rounded-xl border border-dashed border-border",children:[
      e.jsx("div",{className:"w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center",children:e.jsx($e,{className:"w-8 h-8 text-primary"})}),
      e.jsx("h3",{className:"text-lg font-semibold text-foreground mb-1",children:"Data KPI Unit Kosong"}),
      e.jsx("p",{className:"text-muted-foreground",children:"Belum ada KPI Individu pemimpin untuk filter ini."})
    ]}):
    e.jsxs("div",{className:"space-y-6",children:[
      multiUnit?e.jsx(RankingTable,{rows:ranking,onOpenUnit:openUnit}):null,
      showDetail?e.jsx("div",{className:"space-y-8",children:Object.entries(ce).map(([t,s])=>{
        const r=s.reduce((p,S)=>p+(parseFloat(S.weight)||0),0);
        const unitStats=dt(s);
        const skorU=Number(unitStats.skorAkhir)||0;
        return e.jsxs("div",{className:"bg-card rounded-xl border shadow-sm",children:[
          e.jsxs("div",{className:"bg-white p-4 border-b border-slate-200 text-center",children:[
            e.jsxs("h2",{className:"text-lg font-bold text-slate-800 uppercase tracking-wide",children:[["divisi","departemen","ukk","unit","project"].includes(orgKind(t))?"KPI UNIT — ":"KPI UNIT KANTOR — ",t," TAHUN ",new Date().getFullYear()]}),
            e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:"Sumber: KPI Individu pemimpin unit kantor"}),
            e.jsxs("div",{className:"mt-2 flex flex-wrap items-center justify-center gap-3",children:[
              e.jsxs("span",{className:"text-sm text-slate-700",children:["Skor Akhir: ",e.jsx("strong",{className:"text-blue-700 text-base",children:unitStats.scoredCount>0&&skorU>0?skorU.toFixed(2):"-"})]}),
              e.jsxs("span",{className:"inline-flex items-center gap-1.5 text-sm text-slate-700",children:["Status: ",e.jsx(StatusBadge,{score:skorU})]}),
              Math.abs(r-100)>.1
                ?e.jsxs("span",{className:"text-xs text-red-600 font-medium",children:["Bobot ",kbBobot(r),"%"]})
                :e.jsx("span",{className:"text-xs text-emerald-600",children:"Bobot 100%"})
            ]})
          ]}),
          e.jsx("div",{className:"overflow-auto max-h-[70vh] relative",children:e.jsxs(Qe,{className:"border-collapse border border-slate-300 w-full min-w-[1900px]",children:[
            e.jsxs(Ye,{className:"bg-sky-100",children:[
              e.jsxs(z,{className:"bg-sky-100 border-b border-slate-300",children:[
                e.jsx(A,{rowSpan:2,className:"min-w-[110px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 left-0 z-40 align-middle",style:{left:0,minWidth:110},children:"Perspektif"}),
                e.jsx(A,{rowSpan:2,className:"min-w-[220px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-40 align-middle",style:{left:110,minWidth:220},children:"KPI"}),
                e.jsx(A,{rowSpan:2,className:"w-[80px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-40 align-middle",style:{left:330,minWidth:80},children:"Satuan"}),
                e.jsx(A,{rowSpan:2,className:"w-[70px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-40 align-middle",style:{left:410,minWidth:70},children:"Bobot (%)"}),
                e.jsx(A,{rowSpan:2,className:"w-[90px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-40 align-middle",style:{left:480,minWidth:90,boxShadow:"2px 0 4px -2px rgba(0,0,0,.18)"},children:"Target Tahun"}),
                ...MONTHS.map(mo=>e.jsx(A,{colSpan:4,className:"border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-[10px] bg-sky-100 px-1 sticky top-0 z-30",children:mo},mo+"-h")),
                e.jsx(A,{rowSpan:2,className:"w-[80px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-30 align-middle",children:"YTD (%)"}),
                e.jsx(A,{rowSpan:2,className:"w-[70px] border-r border-slate-300 text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-30 align-middle",children:"Skor"}),
                e.jsx(A,{rowSpan:2,className:"w-[90px] text-center font-bold text-slate-800 uppercase text-xs bg-sky-100 sticky top-0 z-30 align-middle",children:"Status"})
              ]}),
              e.jsxs(z,{className:"bg-sky-100 border-b-2 border-slate-400",children:[
                ...MONTHS.flatMap(mo=>[
                  e.jsx(A,{className:"border-r border-slate-300 text-center font-semibold text-[10px] bg-blue-50/80 min-w-[52px] px-1 sticky top-[28px] z-20",children:"Realisasi"},mo+"-hr"),
                  e.jsx(A,{className:"border-r border-slate-300 text-center font-semibold text-[10px] bg-sky-50 min-w-[52px] px-1 sticky top-[28px] z-20",children:"Target"},mo+"-ht"),
                  e.jsx(A,{className:"border-r border-slate-300 text-center font-semibold text-[10px] bg-emerald-50/70 min-w-[54px] px-1 sticky top-[28px] z-20",children:"Pencapaian"},mo+"-hp"),
                  e.jsx(A,{className:"border-r border-slate-300 text-center font-semibold text-[10px] bg-violet-50/70 min-w-[48px] px-1 sticky top-[28px] z-20",children:"Skor"},mo+"-hs")
                ])
              ]})
            ]}),
            e.jsxs(Je,{children:[
              e.jsx(DetailTable,{rows:s,canEdit:isSA,selectedId,onOpenMenu:openKpiMenu}),
              s.length>0?e.jsxs(z,{className:"bg-slate-200 font-extrabold text-sm border-t-2 border-slate-400",children:[
                e.jsx(C,{colSpan:3,className:"text-right py-3 border-r border-slate-300 uppercase",children:"TOTAL"}),
                e.jsxs(C,{className:"text-center py-3 border-r border-slate-300 text-blue-900",children:[kbBobot(r),"%"]}),
                e.jsx(C,{colSpan:52,className:"py-3"})
              ]}):null
            ]})
          ]})}),
          e.jsx(LowestList,{rows:s})
        ]},t);
      })}):null,
      multiUnit?e.jsx("p",{className:"text-center text-xs text-slate-400",children:"Pilih satu unit dari ranking untuk melihat scorecard lengkap, atau ganti filter Unit Kantor."}):null,
      isSA&&shown?e.jsx("p",{className:"text-center text-xs text-slate-500",children:"Superadmin: klik sel KPI untuk membuka menu Edit KPI / Edit Realisasi & Target / Hapus."}):null
    ]}),
    menuKpi?e.jsx("div",{
      style:{position:"fixed",left:menuPos.x,top:menuPos.y,zIndex:90,minWidth:200,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 12px 28px rgba(15,23,42,.18)",padding:4},
      onClick:ev=>ev.stopPropagation(),
      children:e.jsxs("div",{className:"py-1",children:[
        e.jsx("p",{className:"px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate",children:menuKpi.name}),
        e.jsx("button",{type:"button",className:"w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50",onClick:()=>openEdit(menuKpi,"meta"),children:"Edit KPI"}),
        e.jsx("button",{type:"button",className:"w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50",onClick:()=>openEdit(menuKpi,"realisasi"),children:"Edit Realisasi & Target"}),
        e.jsx("button",{type:"button",disabled:!!delMut.isPending,className:"w-full text-left px-3 py-2 text-sm rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50",onClick:()=>{
          if(!menuKpi||!menuKpi.id)return;
          if(!window.confirm(`Yakin hapus KPI Unit "${menuKpi.name||""}"? Tindakan ini tidak dapat dibatalkan.`))return;
          delMut.mutate(menuKpi.id);
          setMenuKpi(null);
        },children:delMut.isPending?"Menghapus…":"Hapus KPI"})
      ]})
    }):null,
    e.jsx(UnitEditDialog,{
      open:!!editKpi,
      kpi:editKpi,
      mode:editMode,
      onClose:()=>setEditKpi(null),
      onSaved:()=>{client.invalidateQueries({queryKey:["kpis","kpi-unit-kantor"]})},
      toast:U,
      api:_
    })
  ]});
}

export{qt as default};
