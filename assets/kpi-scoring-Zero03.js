import{n as A,c as p}from"./kpi-polarity-Zero02.js";
const f=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
function d(n){return n==="currency"||n==="number"}
function x(n){return n==="percentage"||n==="score"}
function P(n,t){const r=n==null?void 0:n[t];return r==null||r===""?!1:!Number.isNaN(parseFloat(r))}
function N(n){return!n||typeof n!="object"?[]:f.filter(t=>P(n,t))}
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
function Y(n){
  const t=parseFloat(n);
  if(Number.isNaN(t))return 0;
  if(t<60)return 1;
  if(t<80)return 2;
  if(t<=100)return 3;
  if(t<=110)return 4;
  return 5;
}
function E(n,t){const r=parseFloat(n)||0,e=parseFloat(t)||0;return r*(e/100)}
function H(n,t){
  if(n.manual_indeks!==void 0&&n.manual_indeks!==null&&n.manual_indeks!==""){
    const e=parseFloat(n.manual_indeks);
    return Number.isNaN(e)?0:e;
  }
  return Y(t);
}
function R(n,t){
  const r=parseFloat(n.weight)||0,e=n.monthly_target||{},u=n.monthly_data||{},s=A(n.polarity),c=F(t,e),a=(d(t)?S(t,u,e):c),o=w(t,u),scored=N(u).length>0,i=scored?V(u,e,t,s,n.target):0,M=scored?H(n,i):0,_=E(r,M);
  return{targetNum:a,actualNum:o,pencapaian:i,indeks:M,hasil:_,targetAnnual:c,scored};
}
function q(n,t={},r){
  const e=t.monthly_data??n.monthly_data??{},u=t.monthly_target??n.monthly_target??{},s=r(t.unit??n.unit),c=w(s,e),a=F(s,u);
  return{...n,...t,monthly_data:e,monthly_target:u,actual:c,...(N(u).length>0?{target:a}:{})};
}
export{f as M,F as a,W as b,R as c,q as d,w as e,U as g,K as h,P as i};
