import{j as e}from"./ui-Bxdhc9mB.js";
import{C as d,c as n}from"./card-jQ2tvwnD.js";
import{c as a}from"./index-CdyJlLvAQ.js";
const A=["< 60%","≥ 60% s.d. < 100%","≥ 100% s.d. < 105%","≥ 105% s.d. ≤ 110%","> 110%"];
const B=["< 80%","≥ 80% s.d. < 100%","≥ 100% s.d. < 110%","≥ 110% s.d. ≤ 120%","> 120%"];
const C=["< 60%","≥ 60% s.d. < 100%","≥ 100% s.d. < 120%","≥ 120% s.d. ≤ 140%","> 140%"];
const predikat=[
  {indeks:1,predikat:"Kurang",badge:"bg-red-600 text-white"},
  {indeks:2,predikat:"Cukup",badge:"bg-orange-500 text-white"},
  {indeks:3,predikat:"Baik",badge:"bg-green-100 text-green-900"},
  {indeks:4,predikat:"Sangat Baik",badge:"bg-green-500 text-white"},
  {indeks:5,predikat:"Istimewa",badge:"bg-green-800 text-white"},
];
const c=predikat.map((s,i)=>({...s,pencapaian:A[i],className:s.badge,status:s.predikat,dot:"",maxA:A[i],maxB:B[i],maxC:C[i]}));
const rows=[
  {nama:"Maximize A",skor:A,formula:"Aktual / Target × 100%",contoh:"Laba, pertumbuhan kredit, Col 1 kredit cair < 1 tahun"},
  {nama:"Maximize B",skor:B,formula:"Aktual / Target × 100%",contoh:"Kinerja supporting, tindak lanjut temuan"},
  {nama:"Maximize C",skor:C,formula:"Aktual / Target × 100%",contoh:"Indeks kepuasan pelanggan. Target 3"},
  {nama:"Minimize A",skor:["< 60%","≥ 60% s.d. < 100%","≥ 100% s.d. < 110%","≥ 110% s.d. ≤ 120%","> 120%"],formula:"Target / Aktual × 100%",contoh:"Cost of fund, biaya ATK, air, listrik, BBM, konsumsi, rapat"},
  {nama:"Minimize B",skor:["< 40%","≥ 40% s.d. < 60%","≥ 60% s.d. < 80%","≥ 80% s.d. ≤ 100%","> 100%"],formula:"Target / Aktual × 100%",contoh:"Peringkat TKS, GCG. Target 2"},
  {nama:"Minimize C",skor:["> 1%","> 0,25% s.d. ≤ 1%","> 0% s.d. ≤ 0,25%","= 0%","< 0%"],formula:"Aktual − Target",contoh:"Rasio NPL Gross"},
  {nama:"Faster is better",skor:["< 80%","≥ 80% s.d. < 100%","≥ 100% s.d. < 110%","≥ 110% s.d. ≤ 120%","> 120%"],formula:"Target waktu / Aktual waktu × 100%",contoh:"SLA. Berlaku tahun 2027"},
];
const nilai=[
  ["4,51 – 5,00","Istimewa","Hijau Tua","bg-green-800 text-white"],
  ["3,76 – 4,50","Sangat Baik","Hijau","bg-green-500 text-white"],
  ["2,51 – 3,75","Baik","Hijau Muda","bg-green-100 text-green-900"],
  ["1,51 – 2,50","Cukup Baik","Orange","bg-orange-500 text-white"],
  ["0,00 – 1,50","Kurang","Merah","bg-red-600 text-white"],
];
const th="px-2 py-2 font-bold text-slate-800 leading-tight whitespace-nowrap";
const td="px-2 py-2 text-slate-700 align-top";
const nilaiWarna={Merah:{backgroundColor:"#DC2626",color:"#fff"},Orange:{backgroundColor:"#F97316",color:"#fff"},"Hijau Muda":{backgroundColor:"#90EE90",color:"#14532d"},Hijau:{backgroundColor:"#22C55E",color:"#fff"},"Hijau Tua":{backgroundColor:"#00A651",color:"#fff"}};
function o({className:s,headerClassName:l="bg-slate-800",showContoh:show=true}){return e.jsxs(d,{className:a("border border-slate-200 shadow-sm overflow-hidden h-full",s),children:[e.jsx("div",{className:a(l,"text-white px-3 py-2.5 text-center font-semibold text-xs tracking-wide uppercase leading-snug"),children:"Matriks Skor & Polarisasi KPI"}),e.jsxs(n,{className:"p-0 space-y-0",children:[e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:a("w-full text-[11px]",show?"min-w-[880px]":""),children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-slate-200 bg-slate-50",children:[e.jsx("th",{className:a(th,"text-left"),children:"Polarisasi"}),[1,2,3,4,5].map(k=>e.jsxs("th",{className:a(th,"text-left"),children:["Skor ",k]},k)),e.jsx("th",{className:a(th,"text-left"),children:"Formula"}),show&&e.jsx("th",{className:a(th,"text-left"),children:"Contoh KPI"})]})}),e.jsx("tbody",{children:rows.map(t=>e.jsxs("tr",{className:"border-b border-slate-100",children:[e.jsx("td",{className:a(td,"font-semibold text-slate-800 whitespace-nowrap"),children:t.nama}),t.skor.map((cell,idx)=>e.jsx("td",{className:a(td,"whitespace-nowrap tabular-nums"),children:cell},idx)),e.jsx("td",{className:a(td,"whitespace-nowrap"),children:t.formula}),show&&e.jsx("td",{className:td,children:t.contoh})]},t.nama))})]})}),e.jsxs("div",{className:"border-t px-3 py-3",children:[e.jsx("p",{className:"text-[11px] font-semibold text-slate-700 mb-2",children:"Kriteria nilai akhir"}),e.jsx("table",{className:"w-full text-[11px] max-w-md",children:e.jsxs("tbody",{children:nilai.map(v=>e.jsxs("tr",{className:"border-b border-slate-100 last:border-0",children:[e.jsx("td",{className:"py-1 pr-3 tabular-nums text-slate-700",children:v[0]}),e.jsx("td",{className:"py-1 pr-3",children:e.jsx("span",{className:"inline-block rounded px-2 py-0.5 font-bold",style:nilaiWarna[v[2]],children:v[1]})}),e.jsx("td",{className:"py-1 text-slate-500",children:v[2]})]},v[0]))})})]}),e.jsx("p",{className:"px-3 pb-3 text-[10px] text-slate-500 leading-snug",children:"Skor 5 Minimize B adalah pencapaian di atas 100%. Skor 1 Faster is better adalah pencapaian di bawah 80%."})]})]})}
export{c as I,o as K};
