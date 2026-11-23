import{n as A,c as p,s as kbSkala,i as kbIndeks}from"./kpi-polarity-Zero01.js";
const f=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
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
function B(n){const t=N(n);return t.length===0?0:g(n,t)}
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
    u+=p(o,monthT(t,a,annual,c),e);s+=1;
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
    if(N(t).length>0)return p(l(n,o),l(t,f),u);
    const y=parseFloat(annual);
    return p(l(n,o),Number.isNaN(y)?0:y,u);
  }
  if(N(n).length>0)return J(n,t,u,annual);
  return 0;
}
// Skala B (Maximize indeks/skor, Minimize, Faster): 3 baru tercapai di 100–<110%.
function kbLG(ps){return/learning|growth|pembelajaran|\blng\b/i.test(String(ps||""))}function kbScale(r,u,ps){const hit=kbSkala(r);if(hit)return hit;const p=A(r);return p==="minimize"||p==="faster"?"B":p==="maximize"&&kbLG(ps)?"C":p==="maximize"&&u==="score"?"B":"A"}
function Y(n,r,u,ps){const t=parseFloat(n);if(Number.isNaN(t))return 0;return kbIndeks(t,r,u,ps)}
function E(n,t){const r=parseFloat(n)||0,e=parseFloat(t)||0;return Math.round(r*(e/100)*100)/100}
function H(n,t,u){
  if(n.manual_indeks!==void 0&&n.manual_indeks!==null&&n.manual_indeks!==""){
    const e=parseFloat(n.manual_indeks);
    if(e>=1)return e;
  }
  return Y(t,n.polarity,u,n.perspective);
}
function kbStabCuts(){try{const rows=JSON.parse(localStorage.getItem("kb_polaritas")||"null");const row=Array.isArray(rows)&&rows.find(r=>String(r.kode||"").toLowerCase()==="minimize_c"||String(r.rumus||"").toLowerCase()==="stabilize");const mid=Number(row&&(row.batas2!=null?row.batas2:(row.batas&&row.batas[0])));const high=Number(row&&(row.batas3!=null?row.batas3:(row.batas&&row.batas[1])));if(mid>0&&mid<high&&mid<20)return[mid,high]}catch(e){}return[0.25,1]}
function kbStabX(actual,target){const a=parseFloat(actual),b=parseFloat(target),x=a-b;let [mid,high]=kbStabCuts();if(!Number.isFinite(x))return 0;if(x<-1e-9)return 5;if(Math.abs(x)<=1e-9)return 4;if(x<=mid)return 3;if(x<=high)return 2;return 1}
function kbPolForScore(n){const raw=String(n.polarity||"").trim().toLowerCase();const name=String(n.name||"");const code=String(n.kpi_code||n.parent_kpi_id||n.id||"").trim().toUpperCase();if(code==="KPI-CUS-42"||code==="KPI-CUS-04"||(/pembiayaan\s*syariah/i.test(name)&&/dblm/i.test(name)))return"maximize_a";if(code==="KPI-IBP-10"||code==="KPI-IBP-25"||(/penyelesa+iaan?\s+temuan\s+audit/i.test(name)&&/komitmen/i.test(name))||(/temuan/i.test(name)&&/audit/i.test(name)&&/komitmen/i.test(name)))return"maximize_b";if((raw===""||raw==="maximize")&&/temuan/i.test(name))return"maximize_b";if(/\bnpl\b|\bnpf\b/i.test(name)&&/gross/i.test(name))return"minimize_c";if((raw===""||raw==="minimize")&&/\bnpl\b|\bnpf\b/i.test(name))return"minimize_c";if((raw===""||raw==="minimize")&&/cost\s*of\s*fund/i.test(name))return"minimize_a";if((raw===""||raw==="maximize")&&/culture|integrity/i.test(name))return"maximize_c";if((raw===""||raw==="maximize")&&/kol\.?\s*1/i.test(name))return"maximize_a";return n.polarity}
function kbStabFromDiff(diff,sampleMag){const x=parseFloat(diff);let[mid,high]=kbStabCuts();if(!Number.isFinite(x))return 0;if(x<-1e-9)return 5;if(Math.abs(x)<=1e-9)return 4;if(x<=mid)return 3;if(x<=high)return 2;return 1}
function kbAvgMonths(n,data,targets,unit){const pol=kbPolForScore(n);let sp=0,sd=0,c=0,mag=0;f.forEach(a=>{if(!P(data,a))return;const o=parseFloat(data[a]);if(Number.isNaN(o))return;const tg=monthT(targets,a,n.target,F("percentage",targets));const row={...n,polarity:pol};if(kbIsStab(row)){const x=o-tg;sd+=x;mag=Math.max(mag,Math.abs(o)||0,Math.abs(tg)||0);sp+=mag>0&&mag<=1?x*100:x}else{sp+=p(o,tg,A(pol))}c+=1});if(!c)return null;const pencapaian=Math.round(sp/c*10000)/10000;const indeks=kbIsStab({...n,polarity:pol})?kbStabFromDiff(sd/c,mag):kbIndeks(pencapaian,pol,unit,n.perspective);return{indeks:Math.round(indeks*10000)/10000,pencapaian}}
function kbIsStab(n){const raw=String(n.polarity||"").trim().toLowerCase();if(raw==="stabilize"||raw==="minimize_c"||A(n.polarity)==="stabilize")return true;return /npl/i.test(String(n.name||""))&&(raw===""||raw==="maximize"||raw==="minimize")}
function R(n,t){
  const r=parseFloat(n.weight)||0,e=n.monthly_target||{};
  let u=kbCoalesceZero(n.monthly_data||{},e);
  const s=A(n.polarity);
  let c=F(t,e),a=(d(t)?S(t,u,e):c),o=w(t,u),scored=N(u).length>0;
  if(!scored&&kbAnnualZeroZero(n,o)){scored=!0;o=0;if(!Number.isFinite(a)||a===0)a=0}
  const monthAvg=scored&&N(u).length>0?kbAvgMonths(n,u,e,t):null;
  const i=scored?(monthAvg?monthAvg.pencapaian:p(0,0,s)):0;
  const manual=n.manual_indeks!==void 0&&n.manual_indeks!==null&&n.manual_indeks!==""&&parseFloat(n.manual_indeks)>=1;
  const M=scored?(manual?H(n,i,t):monthAvg?monthAvg.indeks:0):0;
  const _=E(r,M);
  return{targetNum:a,actualNum:o,pencapaian:i,indeks:M,hasil:_,targetAnnual:c,scored};
}
function q(n,t={},r){
  const e=t.monthly_data??n.monthly_data??{},u=t.monthly_target??n.monthly_target??{},s=r(t.unit??n.unit),c=w(s,e),a=F(s,u);
  return{...n,...t,monthly_data:e,monthly_target:u,actual:c,...(N(u).length>0?{target:a}:{})};
}
export{f as M,F as a,W as b,R as c,q as d,w as e,U as g,K as h,P as i,Y as y,kbScale as s};
