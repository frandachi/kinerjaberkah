import{n as A,c as p,s as kbSkala,i as kbIndeks}from"./kpi-polarity-Zero02.js";
const f=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
/** Index bulan terakhir yang sudah dihitung (bulan sebelum bulan berjalan, WIB). Januari → -1. */
function kbLastClosedIdx(now=new Date()){const w=new Date(now.getTime()+7*3600*1000);return w.getUTCMonth()-1}
/** Bulan sudah masuk perhitungan (bukan bulan berjalan / ke depan). */
function kbMonthClosed(m,now=new Date()){const i=f.indexOf(m);return i>=0&&i<=kbLastClosedIdx(now)}
/** Salin monthly_data hanya untuk bulan yang sudah ditutup. */
function kbClosedOnly(data,now=new Date()){const out={};if(!data||typeof data!="object")return out;for(const m of f){if(!kbMonthClosed(m,now))continue;if(data[m]!==void 0)out[m]=data[m]}return out}
function d(n){return n==="currency"||n==="number"}
function x(n){return n==="percentage"||n==="score"}
function P(n,t){const r=n==null?void 0:n[t];return r==null||r===""?!1:!Number.isNaN(parseFloat(r))}
function N(n){return!n||typeof n!="object"?[]:f.filter(t=>P(n,t))}
/** Realisasi kosong + target bulanan 0 → anggap realisasi 0 (0/0 = 100%). */
function kbCoalesceZero(n,t){
  const src=n&&typeof n==="object"?n:{};
  const targets=t&&typeof t==="object"?t:{};
  const out={...src};
  let changed=!1;
  for(const m of f){
    const raw=out[m];
    if(raw!=null&&raw!=="")continue;
    const tRaw=targets[m];
    if(tRaw==null||tRaw==="")continue;
    if(parseFloat(tRaw)!==0)continue;
    out[m]=0;changed=!0;
  }
  return changed?out:src;
}
function kbAnnualZeroZero(n,a){
  const t=parseFloat(String(n?.target??"").replace(",","."));
  if(t!==0)return!1;
  const v=parseFloat(a);
  return!Number.isFinite(v)||v===0;
}
function l(n,t=f){return t.reduce((r,e)=>{const u=parseFloat(n==null?void 0:n[e]);return r+(Number.isNaN(u)?0:u)},0)}
function g(n,t=null){const r=t||f;let e=0,u=0;return r.forEach(s=>{if(!P(n,s))return;const c=parseFloat(n==null?void 0:n[s]);Number.isNaN(c)||(e+=c,u+=1)}),u>0?e/u:0}
function K(n){return N(n).length>0}
function F(n,t){
  if(!t||typeof t!="object")return 0;
  if(d(n))return l(t,f);
  if(x(n)){
    for(const r of f){
      if(!P(t,r))continue;
      const e=parseFloat(t[r]);
      if(!Number.isNaN(e))return e;
    }
  }
  return 0;
}
function S(n,t,r){
  if(!r||typeof r!="object")return 0;
  if(d(n)){
    const e=N(t);
    if(e.length===0)return 0;
    const u=e.filter(c=>P(r,c));
    const s=u.length>0?u:e;
    return l(r,s);
  }
  return F(n,r);
}
function w(n,t){if(!t||typeof t!="object")return 0;const r=N(t);return r.length===0?0:d(n)?l(t,r):g(t,r)}
function U(n,t){const r=parseFloat(n==null?void 0:n[t]);return Number.isNaN(r)?null:r}
function W(n,t,r="maximize"){return p(n,t,r)}
function monthT(t,a,annual,c){
  if(P(t,a)){
    const i=parseFloat(t[a]);
    if(!Number.isNaN(i))return i;
  }
  const y=parseFloat(annual);
  if(!Number.isNaN(y))return y;
  if(!Number.isNaN(c))return c;
  return 0;
}
function J(n,t,r="maximize",annual){
  const e=A(r);
  let u=0,s=0;
  const c=F("percentage",t);
  f.forEach(a=>{
    if(!P(n,a))return;
    const o=parseFloat(n[a]);
    if(Number.isNaN(o))return;
    const i=monthT(t,a,annual,c);
    u+=p(o,i,e);s+=1;
  });
  return s>0?u/s:0;
}
function V(n,t,r,e="maximize",annual){
  const u=A(e);
  if(d(r)){
    const o=N(n);
    if(o.length===0)return 0;
    const i=o.filter(b=>P(t,b));
    if(i.length>0)return p(l(n,i),l(t,i),u);
    const y=parseFloat(annual);
    return p(l(n,o),Number.isNaN(y)?0:y,u);
  }
  if(N(n).length>0)return J(n,t,u,annual);
  return 0;
}
// Skala B (Maximize indeks/skor, Minimize, Faster): 3 baru tercapai di 100–<110%.
function kbLG(ps){return/learning|growth|pembelajaran|\blng\b/i.test(String(ps||""))}function kbScale(r,u,ps){const hit=kbSkala(r);if(hit)return hit;const p=A(r);return p==="minimize"||p==="faster"?"B":p==="maximize"&&kbLG(ps)?"C":p==="maximize"&&u==="score"?"B":"A"}
function Y(n,r,u,ps){
  const t=parseFloat(n);
  if(Number.isNaN(t))return 0;
  return kbIndeks(t,r,u,ps);
}
/** skor = ROUND(bobot × indeks, 2) / 100; bobot 0–100 */
function E(n,t,totalBulan=1){const r=parseFloat(n)||0,e=parseFloat(t)||0;return Math.round(r*e*100)/100/100}
function H(n,t,u){
  if(n.manual_indeks!==void 0&&n.manual_indeks!==null&&n.manual_indeks!==""){
    const e=parseFloat(n.manual_indeks);
    if(Number.isFinite(e)&&e>0)return e;
  }
  return Y(t,n.polarity,u,n.perspective);
}
function kbStabCuts(pol){try{const rows=JSON.parse(localStorage.getItem("kb_polaritas")||"null");if(pol==="minimize_d"){const d=Array.isArray(rows)&&rows.find(r=>String(r.kode||"").toLowerCase()==="minimize_d");const dm=Number(d&&(d.batas2!=null?d.batas2:(d.batas&&d.batas[0]))),dh=Number(d&&(d.batas3!=null?d.batas3:(d.batas&&d.batas[1])));if(dm>0&&dh>dm)return[dm,dh];return[10,50]}const row=Array.isArray(rows)&&rows.find(r=>String(r.kode||"").toLowerCase()==="minimize_c"||String(r.rumus||"").toLowerCase()==="stabilize");const mid=Number(row&&(row.batas2!=null?row.batas2:(row.batas&&row.batas[0])));const high=Number(row&&(row.batas3!=null?row.batas3:(row.batas&&row.batas[1])));if(mid>0&&mid<high&&mid<20)return[mid,high]}catch(e){}return pol==="minimize_d"?[10,50]:[0.25,1]}
function kbNormStabPair(actual,target,kpi){let a=parseFloat(actual),t=parseFloat(target);if(!Number.isFinite(a)||!Number.isFinite(t))return{a,t};if(String(kpi&&kpi.polarity||"").trim().toLowerCase()==="minimize_d")return{a,t};const name=String(kpi&&kpi.name||"");const isNpl=/\bnpl\b|\bnpf\b/i.test(name);const u=String(kpi&&kpi.unit||"").toLowerCase();const isPct=u==="percentage"||u.includes("%")||u.includes("persen");if(!isNpl&&!isPct)return{a,t};if(a>=20&&t>=10)return{a:a/100,t:t/100};if(a>=10&&t>=10)return{a,t};if(a>=10&&t<10){if(t>=5&&a/Math.max(t,1e-9)<2.5)return{a,t};if(a>=20||t<5)return{a:a/100,t};return{a,t}}if(t>=10&&a<10){if(t>=50&&a>0&&a<10)return{a,t:t/100};if(t>=20&&a>0&&a<=5&&a!==Math.trunc(a))return{a,t:t/100};return{a,t}}if(t===0&&a>=5)return{a:a/100,t};return{a,t}}
function kbNormStabActual(actual,target,kpi){return kbNormStabPair(actual,target,kpi).a}
function kbDetectStabSeries(pairs,kpi){if(String(kpi&&kpi.polarity||"").trim().toLowerCase()==="minimize_d")return{divA:false,divT:false};const name=String(kpi&&kpi.name||"");const u=String(kpi&&kpi.unit||"").toLowerCase();const isNpl=/\bnpl\b|\bnpf\b/i.test(name);const isPct=u==="percentage"||u.includes("%")||u.includes("persen");if(!isNpl&&!isPct)return{divA:false,divT:false};const ps=(pairs||[]).filter(p=>Number.isFinite(p.a)&&Number.isFinite(p.t));if(ps.length<4)return{divA:false,divT:false};const ts=ps.map(p=>p.t).sort((x,y)=>x-y);const medT=ts[Math.floor(ts.length/2)];const highA=ps.filter(p=>p.a>=20).length;const smallDec=ps.filter(p=>p.a>0&&p.a<5&&p.a!==Math.trunc(p.a)).length;if(medT>=5&&medT<=15&&highA>=2&&smallDec>=2)return{divA:true,divT:true};return{divA:false,divT:false}}
function kbApplySeries(a,t,fix){let aa=a,tt=t;if(fix&&fix.divT&&Number.isFinite(tt))tt=tt/100;if(fix&&fix.divA&&Number.isFinite(aa)&&aa>=10)aa=aa/100;return{a:aa,t:tt}}
function kbStabX(actual,target,pol){const a=parseFloat(actual),b=parseFloat(target),x=a-b;let [mid,high]=kbStabCuts(pol);if(!Number.isFinite(x))return 0;if(x<-1e-9)return 5;if(Math.abs(x)<=1e-9)return 4;if(x<=mid)return 3;if(x<=high)return 2;return 1}
function kbPolForScore(n){const raw=String(n.polarity||"").trim().toLowerCase();if(raw==="minimize_d")return"minimize_d";const name=String(n.name||"");const code=String(n.kpi_code||n.parent_kpi_id||n.id||"").trim().toUpperCase();if(code==="KPI-CUS-42"||code==="KPI-CUS-04"||(/pembiayaan\s*syariah/i.test(name)&&/dblm/i.test(name)))return"maximize_a";if(code==="KPI-IBP-10"||code==="KPI-IBP-25"||(/penyelesa+iaan?\s+temuan\s+audit/i.test(name)&&/komitmen/i.test(name))||(/temuan/i.test(name)&&/audit/i.test(name)&&/komitmen/i.test(name)))return"maximize_b";if(/\bnpl\b|\bnpf\b/i.test(name)&&/gross/i.test(name))return"minimize_c";const kbT=parseFloat(String((n&&n.target)??"").replace(",","."));if(/denda|kerugian/i.test(name)&&/regulator|ojk|\bbi\b|dps|fraud|kepatuhan|pelanggaran|operasional|syariah|laporan/i.test(name)&&kbT===0)return"minimize_d";if((raw===""||raw==="maximize")&&/temuan/i.test(name))return"maximize_b";if((raw===""||raw==="minimize")&&/\bnpl\b|\bnpf\b/i.test(name))return"minimize_c";if((raw===""||raw==="minimize")&&/cost\s*of\s*fund/i.test(name))return"minimize_a";if(/efisiensi\s*biaya/i.test(name)||(/biaya\s*atk/i.test(name)&&/listrik|bbm/i.test(name)))return"minimize_a";if((raw===""||raw==="maximize")&&/culture|integrity/i.test(name))return"maximize_c";if((raw===""||raw==="maximize")&&/kol\.?\s*1|col\.?\s*1/i.test(name))return"maximize_a";return n.polarity}
function kbStabFromDiff(diff,sampleMag,pol){const x=parseFloat(diff);let[mid,high]=kbStabCuts(pol);if(!Number.isFinite(x))return 0;if(x<-1e-9)return 5;if(Math.abs(x)<=1e-9)return 4;if(x<=mid)return 3;if(x<=high)return 2;return 1}
function kbIsPertumbuhanOs(n){return/pertumbuhan\s*o\s*\/\s*s/i.test(String(n&&n.name||""))}
function kbPencapaianMonth(o,tg,n,pol){const a=parseFloat(o),t=parseFloat(tg);if(Number.isNaN(a)||Number.isNaN(t))return 0;if(kbIsPertumbuhanOs(n)&&t!==0){const ach=Math.max(0,1+(a-t)/Math.abs(t));return Math.round(ach*100*10000)/10000}return p(a,t,pol)}
function kbAvgMonths(n,data,targets,unit){const pol=kbPolForScore(n);const weight=parseFloat(n.weight)||0;const row={...n,polarity:pol};const stab=kbIsStab(row);let series={divA:false,divT:false};if(stab){const probe=[];f.forEach(a=>{if(!kbMonthClosed(a))return;if(!P(data,a))return;const o=parseFloat(data[a]);if(Number.isNaN(o))return;probe.push({a:o,t:monthT(targets,a,n.target,F("percentage",targets))})});series=kbDetectStabSeries(probe,row)}const rows=[];f.forEach(a=>{if(!kbMonthClosed(a))return;if(!P(data,a))return;const o=parseFloat(data[a]);if(Number.isNaN(o))return;const tg=monthT(targets,a,n.target,F("percentage",targets));let pencapaian,indeks;if(stab){const sc=kbApplySeries(o,tg,series);const pair=kbNormStabPair(sc.a,sc.t,row);pencapaian=p(pair.a,pair.t,"stabilize");indeks=kbStabX(pair.a,pair.t,pol)}else{pencapaian=kbPencapaianMonth(o,tg,row,pol);indeks=kbIndeks(pencapaian,pol,unit,n.perspective)}indeks=Math.round(Number(indeks)||0);if(indeks<0)indeks=0;if(indeks>5)indeks=5;rows.push({pencapaian,indeks})});if(!rows.length)return null;const c=rows.length;const pencapaian=Math.round(rows.reduce((s,r)=>s+r.pencapaian,0)/c*100)/100;const indeks=Math.round(rows.reduce((s,r)=>s+r.indeks,0)/c*10000)/10000;const hasil=E(weight,indeks,1);return{indeks,pencapaian,count:c,hasil}}
function kbIsStab(n){const raw=String(n.polarity||"").trim().toLowerCase();if(raw==="stabilize"||raw==="minimize_c"||raw==="minimize_d"||A(n.polarity)==="stabilize")return true;return /npl/i.test(String(n.name||""))&&(raw===""||raw==="maximize"||raw==="minimize")}
function R(n,t,opts){
  const r=parseFloat(n.weight)||0,e=n.monthly_target||{};
  let u=kbClosedOnly(kbCoalesceZero(n.monthly_data||{},e));
  const s=A(n.polarity);
  let c=F(t,e),a=(d(t)?S(t,u,e):c),o=w(t,u);
  // Utamakan rumus realisasi bulanan; manual_indeks hanya jika belum ada data bulan.
  const hasMonths=N(u).length>0;
  const manRaw=n.manual_indeks, manNum=parseFloat(manRaw);
  const manual=!hasMonths&&manRaw!==void 0&&manRaw!==null&&manRaw!==""&&Number.isFinite(manNum)&&manNum>0;
  let scored=hasMonths||manual;
  if(!scored&&kbAnnualZeroZero(n,o)){scored=!0;o=0;if(!Number.isFinite(a)||a===0)a=0}
  const monthAvg=N(u).length>0?kbAvgMonths(n,u,e,t):null;
  const i=scored?(monthAvg?monthAvg.pencapaian:p(0,0,s)):0;
  const M=scored?(manual?H(n,i,t):monthAvg?monthAvg.indeks:0):0;
  const _=scored?(manual?(r*M)/100:monthAvg&&monthAvg.hasil!=null?monthAvg.hasil:E(r,M,1)):0;
  return{targetNum:a,actualNum:o,pencapaian:i,indeks:M,hasil:_,targetAnnual:c,scored,totalBulan:monthAvg?monthAvg.count:0};
}
function q(n,t={},r){
  const e=t.monthly_data??n.monthly_data??{},u=t.monthly_target??n.monthly_target??{},s=r(t.unit??n.unit),c=w(s,e);
  // Jangan timpa target tahunan dengan agregat monthly_target (penyebab Target Tahun ≠ Excel).
  return{...n,...t,monthly_data:e,monthly_target:u,actual:c};
}
export{f as M,F as a,W as b,R as c,q as d,w as e,U as g,K as h,P as i,Y as y,kbScale as s,kbMonthClosed,kbLastClosedIdx,kbClosedOnly};
