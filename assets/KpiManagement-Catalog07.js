import{t as Ce,m as Ie,bd as Te,be as Me,bf as Be,r,j as e,at as oe,aD as me,aE as Ee,az as H,au as Fe,W as kbRefresh}from"./ui-Bxdhc9mB.js";import{O as ObjectiveTab}from"./ObjectiveTab-DivMulti05.js";import{b as Le,c as _e}from"./vendor-CvVmYoZI.js";import{b as Ae,u as J,c as W}from"./query-7fhvqgVT.js";import{c as p,B as x,I as pe,t as k,a as P,u as kbAuth}from"./index-CdyJlLvAQ.js";import{C as j,a as K,b as C,c as g}from"./card-jQ2tvwnD.js";import{B as he}from"./badge-BDPDcSpQ.js";import{S as ue}from"./skeleton-7xRvmPlJ.js";import{S as E,a as F,b as L,c as _,d as i}from"./select-BgJbFb_v.js";import{P as Y}from"./kpi-perspective-fFNWJAaz.js";import{U as De,g as X,n as ze}from"./kpi-units-Bpgxx_sX.js";import{I as Re,K as kbScaleTbl}from"./KpiIndeksPredikatTable-Fit01.js";import{K as Ue,D as qe}from"./DeleteConfirmDialog-Manual07.js";import{n as be}from"./kpi-polarity-Zero01.js";import{h as Oe,a as $e}from"./kpi-scoring-Zero01.js";import{R as Ve,C as Qe,T as Ge,L as He}from"./generateCategoricalChart-C0sokpAq.js";import{P as Je,a as We}from"./PieChart-B8_1Ow04.js";import"./kpi-summary-zp-GQLPf.js";import"./unit-kantor-DMQ7qF6z.js";import{D as kbDlg,a as kbDlgC,b as kbDlgH,c as kbDlgT,d as kbDlgF}from"./dialog-C7q5Ayci.js";import{L as kbLbl}from"./label-BZL7aJ1G.js";import"./alert-dialog-wjszyc00.js";const Z=[{id:"master",label:"Master KPI",icon:Ce},{id:"objective",label:"Objective",icon:oe},{id:"target",label:"Target Tahunan",icon:Ie},{id:"bobot",label:"Bobot & Parameter",icon:Te},{id:"perspektif",label:"Perspektif KPI",icon:Me},{id:"satuan",label:"Satuan & Skala",icon:Be}],f={financial:{label:"Finansial",color:"#16a34a",badge:"bg-emerald-100 text-emerald-800",desc:"Mengukur kinerja keuangan dan penciptaan nilai bagi pemegang saham.",bobotStandar:30},customer:{label:"Pelanggan",color:"#2563eb",badge:"bg-blue-100 text-blue-800",desc:"Mengukur kepuasan, loyalitas, dan proposisi nilai bagi nasabah.",bobotStandar:30},internal_process:{label:"Proses Internal",color:"#f59e0b",badge:"bg-amber-100 text-amber-900",desc:"Mengukur efektivitas proses bisnis, operasional, dan inovasi.",bobotStandar:25},learning_growth:{label:"Pembelajaran & Pertumbuhan",color:"#0f2744",badge:"bg-slate-100 text-slate-800",desc:"Mengukur kapabilitas SDM, budaya, dan sistem informasi.",bobotStandar:15}};function h(o){const l=String(o||"").toLowerCase();return l.includes("financial")||l.includes("finansial")?"financial":l.includes("customer")||l.includes("pelanggan")?"customer":l.includes("internal")||l.includes("proses")||l.includes("process")?"internal_process":l.includes("learning")||l.includes("growth")||l.includes("people")?"learning_growth":"financial"}function Ye(o,l){const c=o.kpi_code||o.kode||o.code||o.parent_kpi_id;if(c)return c;const I=h(o.perspective),N={financial:"FIN",customer:"CUS",internal_process:"INT",learning_growth:"LNG"}[I]||"KPI";return`KPI-${N}-??`}function Xe(o){const l=be(o);return l==="minimize"?"≤ (semakin kecil semakin baik)":l==="faster"?"≤ waktu (semakin cepat semakin baik)":l==="range"?"Range target":"≥ (semakin besar semakin baik)"}
function kbRememberPol(rows){try{localStorage.setItem("kb_polaritas",JSON.stringify((rows||[]).map(a=>({kode:a.kode,nama:a.nama,rumus:a.rumus,skala:a.skala,batas2:a.batas2,batas3:a.batas3,batas4:a.batas4,batas5:a.batas5}))))}catch(e){}}
function kbRememberNilai(rows){try{localStorage.setItem("kb_nilai_akhir",JSON.stringify((rows||[]).map(a=>({kategori:a.kategori,warna:a.warna,nilai_min:Number(a.nilai_min),nilai_max:Number(a.nilai_max)}))))}catch(e){}}
function kbPolLabel(row,list){const p=String(row.polarity||"maximize").trim().toLowerCase();const hit=(list||[]).find(a=>String(a.kode||"").toLowerCase()===p);if(hit&&hit.nama)return hit.nama;if(p==="maximize_a")return"Maximize A";if(p==="maximize_b")return"Maximize B";if(p==="maximize_c")return"Maximize C";if(p==="minimize"||p==="minimize_a")return"Minimize A";if(p==="minimize_b")return"Minimize B";if(p==="minimize_c"||p==="stabilize")return"Minimize C";if(p==="faster")return"Faster is better";if(p==="range")return"Range";if(/learning|growth|pembelajaran|\blng\b/i.test(String(row.perspective||"")))return"Maximize C";const u=String(row.unit||"").toLowerCase();if(u==="score"||u.includes("indeks")||u.includes("skor"))return"Maximize B";return"Maximize A"}
function Na(){var ce;const[o,l]=Le(),I=_e(),N=o.get("tab")||"master",n=Z.some(a=>a.id===N&&a.id!=="target")?N:"master",je=a=>{if(a==="target"){I("/target-tahunan");return}const s=new URLSearchParams(o);s.set("tab",a),l(s,{replace:!0})};r.useEffect(()=>{N==="target"&&I("/target-tahunan",{replace:!0})},[N,I]);const {data:kbPols=[]}=J({queryKey:["polaritas"],queryFn:async()=>{const rows=await P.getPolaritas().catch(()=>[]);kbRememberPol(rows);return rows}});J({queryKey:["penilaian-akhir"],queryFn:async()=>{const rows=await P.getPenilaianAkhir().catch(()=>[]);kbRememberNilai(rows);return rows}});const $=Ae(),[u,V]=r.useState(""),[A,ge]=r.useState("all"),[D,fe]=r.useState("all"),[T,ee]=r.useState("all"),[ae,Ne]=r.useState("2026"),[se,te]=r.useState("satuan"),[ye,z]=r.useState(!1),[y,Q]=r.useState(null),[R,G]=r.useState(null),[v,w]=r.useState(1),M=15,{data:b=[],isLoading:ve}=J({queryKey:["kpis","catalog"],queryFn:()=>P.get("/kpis/catalog?_="+Date.now())}),{data:le=[]}=J({queryKey:["kpis","units"],queryFn:()=>P.get("/kpis/units?_="+Date.now()).catch(()=>[])}),{data:weightSum}=J({queryKey:["kpis","weight-summary",T,u],queryFn:()=>P.get("/kpis/weight-summary?unit_name="+encodeURIComponent(T==="all"?"":T)+"&search="+encodeURIComponent(u.trim()))}),{data:S=[]}=J({queryKey:["kpis","bobot-rows",T,u],enabled:n==="bobot"&&T!=="all",queryFn:()=>P.get("/kpis?fields=list&unit_name="+encodeURIComponent(T)+"&search="+encodeURIComponent(u.trim()))}),{data:U=[]}=J({queryKey:["strategies"],queryFn:()=>P.getStrategies().catch(()=>[])}),{data:q=[]}=J({queryKey:["satuans"],queryFn:()=>P.getSatuans().catch(()=>[])}),re=r.useMemo(()=>{const a=new Map;b.forEach(s=>{const t=`${String(s.name||"").trim().toLowerCase()}||${h(s.perspective)}`;a.has(t)||a.set(t,s)});return[...a.values()]},[b]),B=r.useMemo(()=>{const a=u.trim().toLowerCase();return re.filter(s=>!(a&&!String(s.name||"").toLowerCase().includes(a)&&!String(s.id||"").toLowerCase().includes(a)||A!=="all"&&h(s.perspective)!==A||D==="aktif"&&String(s.status||"").toLowerCase()==="draft"||D==="draft"&&String(s.status||"").toLowerCase()!=="draft"))},[re,u,A,D]),ne=r.useMemo(()=>{const a=(v-1)*M;return B.slice(a,a+M)},[B,v]),m=r.useMemo(()=>{if(!weightSum)return{totalBobot:0,byPersp:[],count:0};const s=Y.map(t=>{const row=(weightSum.byPersp||[]).find(d=>h(d.key)===t||d.key===t);const c=row?Number(row.value)||0:0;return{key:t,name:f[t].label,value:Math.round(c*10)/10,color:f[t].color}}).filter(t=>t.value>0);return{totalBobot:Number(weightSum.totalBobot)||0,byPersp:s,count:Number(weightSum.count)||0}},[weightSum]),we=W({mutationFn:a=>P.post("/kpis",a),onSuccess:()=>{$.invalidateQueries({queryKey:["kpis"]}),$.invalidateQueries({queryKey:["kpis","catalog"]}),$.invalidateQueries({queryKey:["kpis","units"]}),$.invalidateQueries({queryKey:["kpis","weight-summary"]}),$.invalidateQueries({queryKey:["strategies"]}),k.success("KPI berhasil ditambahkan")},onError:a=>k.error(a.message||"Gagal menambah KPI")}),Se=W({mutationFn:({id:a,data:s})=>P.put(`/kpis/${a}`,s),onSuccess:kbRes=>{$.invalidateQueries({queryKey:["kpis"]}),$.invalidateQueries({queryKey:["kpis","catalog"]}),$.invalidateQueries({queryKey:["kpis","units"]}),$.invalidateQueries({queryKey:["kpis","weight-summary"]}),$.invalidateQueries({queryKey:["strategies"]}),k.success(kbRes&&kbRes._master_status?(kbRes._master_status==="Draft"?"Status diubah ke Draft":"Status diubah ke Aktif")+(kbRes._catalog_updated>0?" · "+kbRes._catalog_updated+" KPI bernama sama ikut diperbarui":""):(kbRes&&kbRes._catalog_updated!==void 0?(kbRes._catalog_updated>0?"KPI diperbarui untuk "+kbRes._catalog_updated+" KPI bernama sama":"Tidak ada perubahan"):"KPI berhasil diperbarui"))},onError:a=>k.error(a.message||"Gagal memperbarui KPI")}),ke=W({mutationFn:a=>P.delete(`/kpis/${a}`),onSuccess:()=>{$.invalidateQueries({queryKey:["kpis"]}),$.invalidateQueries({queryKey:["kpis","catalog"]}),$.invalidateQueries({queryKey:["kpis","units"]}),$.invalidateQueries({queryKey:["kpis","weight-summary"]}),$.invalidateQueries({queryKey:["strategies"]}),k.success("KPI berhasil dihapus"),G(null)},onError:a=>k.error(a.message||"Gagal menghapus KPI")}),Pe=async a=>{y&&!y._fromStrategy?await Se.mutateAsync({id:y.id,data:y.instance_count!=null?{...a,_catalog:!0}:a}):await we.mutateAsync(a),Q(null),z(!1)},ie=()=>{Q(null),z(!0)},O=a=>{Q(a),z(!0)},Ke=r.useMemo(()=>Array.isArray(q)&&q.length>0?q.map(a=>({id:a.id,name:a.name||a.satuan||a.label,desc:a.description||a.keterangan||"-"})):De.map(a=>({id:a.value,name:a.label,desc:a.value})),[q]);return ve?e.jsxs("div",{className:"space-y-4",children:[e.jsx(ue,{className:"h-10 w-72"}),e.jsx(ue,{className:"h-64"})]}):e.jsxs("div",{className:"space-y-5 pb-10",children:[e.jsx("div",{className:"flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3",children:e.jsxs("div",{children:[e.jsx("p",{className:"text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1",children:"Master Data"}),e.jsx("h1",{className:"text-xl lg:text-2xl font-bold tracking-tight text-slate-900",children:((ce=Z.find(a=>a.id===n))==null?void 0:ce.label)||"Master KPI"}),e.jsxs("p",{className:"text-sm text-slate-500 mt-0.5",children:[n==="master"&&"Kelola daftar KPI yang digunakan di seluruh unit kerja",n==="objective"&&"Kelola objective Balanced Scorecard (tambah, edit, hapus)",n==="target"&&"Tetapkan target tahunan per unit kerja",n==="bobot"&&"Atur bobot dan parameter penilaian per unit",n==="perspektif"&&"Kelola perspektif Balanced Scorecard",n==="satuan"&&"Kelola satuan pengukuran, skala penilaian, dan tipe polaritas"]})]})}),e.jsx("div",{className:"flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm",children:Z.map(a=>e.jsxs("button",{type:"button",onClick:()=>{je(a.id),w(1),V("")},className:p("inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",n===a.id?"bg-[#0f2744] text-white shadow":"text-slate-600 hover:bg-slate-100"),children:[e.jsx(a.icon,{className:"w-4 h-4"}),a.label]},a.id))}),n==="objective"&&e.jsx(ObjectiveTab,{}),n==="master"&&e.jsxs(j,{className:"border shadow-sm overflow-hidden",children:[e.jsxs(K,{className:"pb-3 border-b bg-slate-50/80",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx(C,{className:"text-base font-semibold text-slate-800",children:"Daftar Master KPI"}),e.jsx("p",{className:"text-xs text-slate-500 mt-0.5",children:"Cari, filter, dan kelola indikator kinerja"})]}),e.jsxs(x,{size:"sm",className:"bg-blue-600 hover:bg-blue-700",onClick:ie,children:[e.jsx(oe,{className:"w-4 h-4 mr-1.5"})," Tambah KPI"]})]}),e.jsxs("div",{className:"flex flex-wrap gap-2 mt-3",children:[e.jsxs("div",{className:"relative flex-1 min-w-[180px]",children:[e.jsx(me,{className:"w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"}),e.jsx(pe,{className:"pl-8 h-9 bg-white",placeholder:"Cari KPI...",value:u,onChange:a=>{V(a.target.value),w(1)}})]}),e.jsxs(E,{value:A,onValueChange:a=>{ge(a),w(1)},children:[e.jsx(F,{className:"w-[180px] h-9 bg-white",children:e.jsx(L,{placeholder:"Perspektif"})}),e.jsxs(_,{children:[e.jsx(i,{value:"all",children:"Semua Perspektif"}),Y.map(a=>e.jsx(i,{value:a,children:f[a].label},a))]})]}),e.jsxs(E,{value:D,onValueChange:a=>{fe(a),w(1)},children:[e.jsx(F,{className:"w-[140px] h-9 bg-white",children:e.jsx(L,{placeholder:"Status"})}),e.jsxs(_,{children:[e.jsx(i,{value:"all",children:"Semua Status"}),e.jsx(i,{value:"aktif",children:"Aktif"}),e.jsx(i,{value:"draft",children:"Draft"})]})]})]})]}),e.jsxs(g,{className:"p-0 overflow-x-auto",children:[e.jsxs("table",{className:"w-full text-xs",children:[e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Kode KPI"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Nama KPI"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Perspektif"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Satuan"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Tipe / Polaritas"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Status"}),e.jsx("th",{className:"px-3 py-2 text-right",children:"Aksi"})]})}),e.jsx("tbody",{children:ne.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:8,className:"px-3 py-10 text-center text-slate-400",children:"Belum ada data KPI"})}):ne.map((a,s)=>{const t=h(a.perspective),c=f[t],d=(v-1)*M+s,xe=String(a.status||"Aktif").toLowerCase()!=="draft";return e.jsxs("tr",{className:"border-t border-slate-100 hover:bg-slate-50/60",children:[e.jsx("td",{className:"px-3 py-2 text-slate-500",children:d+1}),e.jsx("td",{className:"px-2 py-2 font-mono text-[11px] text-slate-600",children:Ye(a,d)}),e.jsx("td",{className:"px-2 py-2 font-medium text-slate-800 max-w-[260px]",children:e.jsx("span",{className:"line-clamp-2",children:a.name})}),e.jsx("td",{className:"px-2 py-2",children:e.jsx("span",{className:p("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold",c.badge),children:c.label})}),e.jsx("td",{className:"px-2 py-2",children:X(a.unit)}),e.jsx("td",{className:"px-2 py-2 text-slate-600",children:kbPolLabel(a,kbPols)}),e.jsx("td",{className:"px-2 py-2",children:e.jsx(he,{className:xe?"bg-emerald-100 text-emerald-800 hover:bg-emerald-100":"bg-slate-200 text-slate-700",children:xe?"Aktif":"Draft"})}),e.jsx("td",{className:"px-3 py-2",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[e.jsx(x,{variant:"ghost",size:"icon",className:"h-8 w-8",title:"Lihat",onClick:()=>O(a),children:e.jsx(Ee,{className:"w-3.5 h-3.5"})}),!a._fromStrategy&&e.jsxs(e.Fragment,{children:[e.jsx(x,{variant:"ghost",size:"icon",className:"h-8 w-8",title:"Edit",onClick:()=>O(a),children:e.jsx(H,{className:"w-3.5 h-3.5"})}),e.jsx(x,{variant:"ghost",size:"icon",className:"h-8 w-8 text-red-600",title:"Hapus",onClick:()=>G(a),children:e.jsx(Fe,{className:"w-3.5 h-3.5"})})]})]})})]},`${a.id}-${d}`)})})]}),e.jsxs("div",{className:"flex items-center justify-between px-3 py-2 border-t text-xs text-slate-500",children:[e.jsxs("span",{children:[B.length," KPI · halaman ",v,"/",Math.max(1,Math.ceil(B.length/M))]}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx(x,{variant:"outline",size:"sm",disabled:v<=1,onClick:()=>w(a=>a-1),children:"Prev"}),e.jsx(x,{variant:"outline",size:"sm",disabled:v*M>=B.length,onClick:()=>w(a=>a+1),children:"Next"})]})]})]})]}),n==="target"&&e.jsxs(j,{className:"border shadow-sm overflow-hidden",children:[e.jsxs(K,{className:"pb-3 border-b bg-slate-50/80",children:[e.jsxs("div",{className:"flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx(C,{className:"text-base font-semibold text-slate-800",children:"Target Tahunan"}),e.jsx("p",{className:"text-xs text-slate-500 mt-0.5",children:"Tetapkan target KPI per unit kerja untuk tahun berjalan"})]}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs(E,{value:ae,onValueChange:Ne,children:[e.jsx(F,{className:"w-[120px] h-9 bg-white",children:e.jsx(L,{})}),e.jsxs(_,{children:[e.jsx(i,{value:"2025",children:"2025"}),e.jsx(i,{value:"2026",children:"2026"}),e.jsx(i,{value:"2027",children:"2027"})]})]}),e.jsxs(x,{size:"sm",className:"bg-blue-600 hover:bg-blue-700",onClick:ie,children:[e.jsx(oe,{className:"w-4 h-4 mr-1.5"})," Tetapkan Target"]})]})]}),e.jsxs("div",{className:"flex flex-wrap gap-2 mt-3",children:[e.jsxs(E,{value:T,onValueChange:ee,children:[e.jsx(F,{className:"w-[260px] h-9 bg-white",children:e.jsx(L,{placeholder:"Unit Kerja"})}),e.jsxs(_,{children:[e.jsx(i,{value:"all",children:"Semua Unit Kerja"}),le.map(a=>e.jsx(i,{value:a,children:a},a))]})]}),e.jsxs("div",{className:"relative flex-1 min-w-[160px]",children:[e.jsx(me,{className:"w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"}),e.jsx(pe,{className:"pl-8 h-9 bg-white",placeholder:"Cari KPI...",value:u,onChange:a=>V(a.target.value)})]})]})]}),e.jsxs(g,{className:"p-0 overflow-x-auto",children:[e.jsxs("table",{className:"w-full text-xs",children:[e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Unit / Jabatan"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Nama KPI"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Satuan"}),e.jsxs("th",{className:"px-2 py-2 text-right",children:["Target ",ae]}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Keterangan"}),e.jsx("th",{className:"px-3 py-2 text-right",children:"Aksi"})]})}),e.jsx("tbody",{children:S.slice(0,100).map((a,s)=>{const t=ze(a.unit),c=Oe(a.monthly_target)?$e(t,a.monthly_target):parseFloat(a.target)||0,d=Xe(a.polarity);return e.jsxs("tr",{className:"border-t border-slate-100",children:[e.jsx("td",{className:"px-3 py-2 text-slate-500",children:s+1}),e.jsxs("td",{className:"px-2 py-2",children:[e.jsx("div",{className:"font-medium text-slate-800 max-w-[180px] truncate",title:a.unit_name,children:a.unit_name}),e.jsx("div",{className:"text-[10px] text-slate-500 truncate max-w-[180px]",children:a.jabatan})]}),e.jsx("td",{className:"px-2 py-2 font-medium max-w-[220px]",children:e.jsx("span",{className:"line-clamp-2",children:a.name})}),e.jsx("td",{className:"px-2 py-2",children:X(a.unit)}),e.jsx("td",{className:"px-2 py-2 text-right font-semibold tabular-nums",children:c>0?c.toLocaleString("id-ID",{maximumFractionDigits:2}):a.target||"-"}),e.jsx("td",{className:"px-2 py-2 text-[10px] text-slate-500",children:d}),e.jsx("td",{className:"px-3 py-2 text-right",children:e.jsx(x,{variant:"ghost",size:"icon",className:"h-8 w-8",onClick:()=>O(a),children:e.jsx(H,{className:"w-3.5 h-3.5"})})})]},a.id)})})]}),e.jsx("p",{className:"px-3 py-2 text-[11px] text-slate-500 border-t bg-slate-50",children:"Catatan: ≤ berarti semakin kecil semakin baik; ≥ berarti semakin besar semakin baik. Untuk ubah target bulanan detail gunakan juga menu OKR Jabatan / KPI Unit."})]})]}),n==="bobot"&&e.jsxs("div",{className:"space-y-4",children:[e.jsxs(j,{className:"border shadow-sm",children:[e.jsx(K,{className:"pb-3 border-b bg-slate-50/80",children:e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx(C,{className:"text-base font-semibold text-slate-800",children:"Bobot & Parameter"}),e.jsx("p",{className:"text-xs text-slate-500 mt-0.5",children:"Atur bobot KPI per unit agar total mendekati 100%"})]}),e.jsxs(E,{value:T,onValueChange:ee,children:[e.jsx(F,{className:"w-[260px] h-9 bg-white",children:e.jsx(L,{placeholder:"Unit Kerja"})}),e.jsxs(_,{children:[e.jsx(i,{value:"all",children:"Semua Unit Kerja"}),le.map(a=>e.jsx(i,{value:a,children:a},a))]})]})]})}),e.jsx(g,{className:"p-4",children:e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4",children:[e.jsxs("div",{className:"rounded-xl border bg-blue-50 border-blue-100 p-4",children:[e.jsx("p",{className:"text-xs font-semibold text-blue-700 uppercase",children:"Total Bobot"}),e.jsxs("p",{className:p("text-3xl font-bold mt-1 tabular-nums",Math.abs(m.totalBobot-100)<=.1?"text-emerald-700":"text-red-600"),children:[m.totalBobot.toLocaleString("id-ID",{maximumFractionDigits:1}),"%"]}),e.jsx("p",{className:"text-[11px] text-slate-500 mt-1",children:Math.abs(m.totalBobot-100)<=.1?"Bobot sesuai (≈100%)":"Bobot belum 100%"})]}),e.jsxs("div",{className:"rounded-xl border bg-slate-50 p-4",children:[e.jsx("p",{className:"text-xs font-semibold text-slate-600 uppercase",children:"Total KPI"}),e.jsx("p",{className:"text-3xl font-bold text-slate-800 mt-1",children:m.count})]}),e.jsx("div",{className:"h-36",children:m.byPersp.length===0?e.jsx("p",{className:"h-full flex items-center justify-center text-xs text-slate-400",children:"Belum ada bobot"}):e.jsx(Ve,{width:"100%",height:"100%",children:e.jsxs(Je,{children:[e.jsx(We,{data:m.byPersp,dataKey:"value",nameKey:"name",innerRadius:35,outerRadius:55,children:m.byPersp.map(a=>e.jsx(Qe,{fill:a.color},a.key))}),e.jsx(Ge,{formatter:a=>`${a}%`}),e.jsx(He,{wrapperStyle:{fontSize:10}})]})})})]})})]}),e.jsx(j,{className:"border shadow-sm overflow-hidden",children:e.jsx(g,{className:"p-0 overflow-x-auto",children:e.jsxs("table",{className:"w-full text-xs",children:[e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Nama KPI"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Perspektif"}),e.jsx("th",{className:"px-2 py-2 text-right",children:"Bobot (%)"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Parameter Penilaian"}),e.jsx("th",{className:"px-3 py-2 text-right",children:"Aksi"})]})}),e.jsxs("tbody",{children:[S.slice(0,80).map((a,s)=>{const t=h(a.perspective);return e.jsxs("tr",{className:"border-t border-slate-100",children:[e.jsx("td",{className:"px-3 py-2",children:s+1}),e.jsx("td",{className:"px-2 py-2 font-medium max-w-[240px]",children:e.jsx("span",{className:"line-clamp-2",children:a.name})}),e.jsx("td",{className:"px-2 py-2",children:e.jsx("span",{className:p("px-2 py-0.5 rounded text-[10px] font-semibold",f[t].badge),children:f[t].label})}),e.jsx("td",{className:"px-2 py-2 text-right font-semibold tabular-nums",children:parseFloat(a.weight)||0}),e.jsxs("td",{className:"px-2 py-2 text-slate-600",children:["Realisasi vs Target (",X(a.unit),")"]}),e.jsx("td",{className:"px-3 py-2 text-right",children:e.jsx(x,{variant:"ghost",size:"icon",className:"h-8 w-8",onClick:()=>O(a),children:e.jsx(H,{className:"w-3.5 h-3.5"})})})]},a.id)}),e.jsxs("tr",{className:"border-t-2 bg-slate-50 font-bold",children:[e.jsx("td",{colSpan:3,className:"px-3 py-2 text-right",children:"TOTAL"}),e.jsx("td",{className:"px-2 py-2 text-right tabular-nums",children:m.totalBobot.toFixed(1)}),e.jsx("td",{colSpan:2})]})]})]})})})]}),n==="perspektif"&&e.jsxs(j,{className:"border shadow-sm overflow-hidden",children:[e.jsxs(K,{className:"pb-3 border-b bg-slate-50/80",children:[e.jsx(C,{className:"text-base font-semibold text-slate-800",children:"Perspektif KPI"}),e.jsx("p",{className:"text-xs text-slate-500 mt-0.5",children:"Perspektif Balance Scorecard yang dipakai di seluruh aplikasi"})]}),e.jsxs(g,{className:"p-0 overflow-x-auto",children:[e.jsxs("table",{className:"w-full text-xs",children:[e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Nama Perspektif"}),e.jsx("th",{className:"px-2 py-2 text-left",children:"Deskripsi"}),e.jsx("th",{className:"px-2 py-2 text-center",children:"Warna"}),e.jsx("th",{className:"px-2 py-2 text-right",children:"Bobot Standar (%)"}),e.jsx("th",{className:"px-2 py-2 text-right",children:"Jumlah KPI"}),e.jsx("th",{className:"px-3 py-2 text-left",children:"Status"})]})}),e.jsx("tbody",{children:Y.map((a,s)=>{const t=f[a],c=b.filter(d=>h(d.perspective)===a).length;return e.jsxs("tr",{className:"border-t border-slate-100",children:[e.jsx("td",{className:"px-3 py-2",children:s+1}),e.jsx("td",{className:"px-2 py-2 font-semibold",children:t.label}),e.jsx("td",{className:"px-2 py-2 text-slate-600 max-w-[360px]",children:t.desc}),e.jsx("td",{className:"px-2 py-2 text-center",children:e.jsx("span",{className:"inline-block w-6 h-6 rounded-md border",style:{background:t.color}})}),e.jsxs("td",{className:"px-2 py-2 text-right font-semibold tabular-nums",children:[t.bobotStandar,"%"]}),e.jsx("td",{className:"px-2 py-2 text-right tabular-nums",children:c}),e.jsx("td",{className:"px-3 py-2",children:e.jsx(he,{className:"bg-emerald-100 text-emerald-800 hover:bg-emerald-100",children:"Aktif"})})]},a)})})]}),e.jsxs("p",{className:"px-3 py-2 text-[11px] text-slate-500 border-t bg-slate-50",children:["Bobot standar bersifat acuan. Bobot aktual per unit diatur di menu ",e.jsx("strong",{children:"Bobot & Parameter"}),"."]})]})]}),n==="satuan"&&e.jsx(KbSatuanTab,{}),e.jsx(KbCatDlg,{open:ye,onOpenChange:z,kpi:y&&!y._fromStrategy?y:null,onSave:Pe,catalogMode:!!(y&&!y._fromStrategy&&y.instance_count!=null)}),e.jsx(qe,{open:!!R,onOpenChange:a=>!a&&G(null),kpi:R,onConfirm:()=>R&&ke.mutate(R.id)})]})}const KB_TIPE = [
  { v: "percentage", l: "Persentase (%)", d: "Pencapaian bulanan = realisasi ÷ target, lalu dirata-rata.", sk: "A", badge: "bg-blue-100 text-blue-800" },
  { v: "currency", l: "Nominal (Juta Rupiah)", d: "Realisasi & target dijumlah (akumulasi) lalu dibandingkan.", sk: "A", badge: "bg-emerald-100 text-emerald-800" },
  { v: "number", l: "Angka / Jumlah", d: "Realisasi & target dijumlah (akumulasi) lalu dibandingkan.", sk: "A", badge: "bg-amber-100 text-amber-900" },
  { v: "score", l: "Indeks / Skor", d: "Pencapaian bulanan = realisasi ÷ target, lalu dirata-rata.", sk: "B", badge: "bg-violet-100 text-violet-800" },
];
function kbTipeOf(s) {
  return s && KB_TIPE.some((t) => t.v === s.tipe) ? s.tipe : ze(s && s.name);
}
function kbTipeInfo(v) {
  return KB_TIPE.find((t) => t.v === v) || KB_TIPE[0];
}
function KbSatuanTab() {
  const qc = Ae(), { user: kbUser } = kbAuth(), canEdit = !!kbUser && ["admin", "superadmin"].includes(kbUser.role), canDel = !!kbUser && kbUser.role === "superadmin";
  const [view, setView] = r.useState("satuan"), [dlg, setDlg] = r.useState(null), [del, setDel] = r.useState(null), [form, setForm] = r.useState({ name: "", tipe: "percentage", keterangan: "" });
  const { data: list = [], isLoading: loading } = J({ queryKey: ["satuans"], queryFn: () => P.getSatuans().catch(() => []) });
  const { data: usage } = J({ queryKey: ["satuans", "usage"], queryFn: () => P.getSatuanUsage().catch(() => null) });
  const inv = () => qc.invalidateQueries({ queryKey: ["satuans"] });
  const busy = (m) => !!(m.isPending || m.isLoading);
  const save = W({
    mutationFn: (d) => (dlg && dlg.id ? P.updateSatuan(dlg.id, d) : P.createSatuan(d)),
    onSuccess: () => { k.success(dlg && dlg.id ? "Satuan diperbarui" : "Satuan ditambahkan"); setDlg(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menyimpan satuan"),
  });
  const rm = W({
    mutationFn: (id) => P.deleteSatuan(id),
    onSuccess: () => { k.success("Satuan dihapus"); setDel(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menghapus satuan"),
  });
  const sync = W({
    mutationFn: () => P.syncSatuan(),
    onSuccess: (a) => { k.success((a && a.message) || "Sinkronisasi selesai"); inv(); qc.invalidateQueries({ queryKey: ["kpis"] }); },
    onError: (a) => k.error(a.message || "Gagal sinkronisasi"),
  });
  const openForm = (s) => {
    setForm(s ? { name: s.name || "", tipe: kbTipeOf(s), keterangan: s.keterangan || "" } : { name: "", tipe: "percentage", keterangan: "" });
    setDlg(s || {});
  };
  const submit = () => {
    const name = form.name.trim();
    if (!name) return k.error("Nama satuan wajib diisi");
    save.mutate({ name, tipe: form.tipe, keterangan: form.keterangan.trim() });
  };
  const nonStd = (usage && usage.nonstandard) || [];
  const nonStdN = nonStd.reduce((t, x) => t + x.n, 0);
  const nonStdLabel = Object.entries(nonStd.reduce((m, x) => ((m[x.unit == null ? "(kosong)" : `"${x.unit}"`] = (m[x.unit == null ? "(kosong)" : `"${x.unit}"`] || 0) + x.n), m), {})).map(([u, n]) => `${u}: ${n}`).join(", ");
  const tabBtn = (id, label) => e.jsx("button", { type: "button", onClick: () => setView(id), className: p("px-3 py-1.5 rounded-md text-sm font-medium", view === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"), children: label });

  const tipeCards = e.jsx("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3",
    children: KB_TIPE.map((t) => {
      const nSat = list.filter((s) => kbTipeOf(s) === t.v).length;
      const nKpi = usage ? usage.kpi[t.v] || 0 : null, nMaster = usage ? usage.master[t.v] || 0 : null;
      return e.jsxs(j, {
        className: "border shadow-sm",
        children: [e.jsxs(g, {
          className: "p-4 space-y-2",
          children: [
            e.jsxs("div", { className: "flex items-center justify-between gap-2", children: [e.jsx("span", { className: p("inline-flex px-2 py-0.5 rounded text-[11px] font-bold", t.badge), children: t.l }), e.jsxs("span", { className: "text-[10px] font-mono text-slate-400", children: [t.v] })] }),
            e.jsx("p", { className: "text-[11px] text-slate-500 leading-snug min-h-[30px]", children: t.d }),
            e.jsxs("div", {
              className: "grid grid-cols-3 gap-1 text-center pt-1",
              children: [["Satuan", nSat], ["KPI", nKpi], ["Master", nMaster]].map(([lbl, val]) => e.jsxs("div", { className: "rounded-md bg-slate-50 py-1.5", children: [e.jsx("p", { className: "text-base font-bold text-slate-800 tabular-nums", children: val == null ? "…" : val.toLocaleString("id-ID") }), e.jsx("p", { className: "text-[10px] text-slate-500", children: lbl })] }, lbl)),
            }),
            e.jsxs("p", { className: "text-[10px] text-slate-500", children: ["Skala Maximize: ", e.jsx("strong", { children: t.sk }), " (L&G: ", e.jsx("strong", { children: "C" }), ") · Minimize/Faster: ", e.jsx("strong", { children: "B" })] }),
            nSat === 0 && (nKpi || nMaster) ? e.jsx("p", { className: "text-[10px] font-semibold text-red-600", children: "Belum ada satuan untuk tipe ini" }) : null,
          ],
        })],
      }, t.v);
    }),
  });

  const syncBar = nonStdN > 0 && e.jsxs("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5",
    children: [
      e.jsxs("p", { className: "text-xs text-amber-900", children: [e.jsxs("strong", { children: [nonStdN.toLocaleString("id-ID"), " KPI"] }), " masih memakai kode satuan lama (", nonStdLabel, "). Perhitungan tetap benar; sinkronkan agar data KPI & Master KPI seragam."] }),
      canEdit && e.jsxs(x, { size: "sm", variant: "outline", className: "bg-white shrink-0", disabled: busy(sync), onClick: () => sync.mutate(), children: [e.jsx(kbRefresh, { className: p("w-3.5 h-3.5 mr-1.5", busy(sync) && "animate-spin") }), "Sinkronkan"] }),
    ],
  });

  const satuanTable = e.jsxs(j, {
    className: "border shadow-sm overflow-hidden",
    children: [
      e.jsx(K, {
        className: "pb-2 border-b bg-slate-50/80",
        children: e.jsxs("div", {
          className: "flex items-center justify-between gap-2",
          children: [
            e.jsxs("div", { children: [e.jsx(C, { className: "text-sm font-semibold text-slate-800", children: "Daftar Satuan" }), e.jsx("p", { className: "text-xs text-slate-500", children: "Label satuan beserta tipe perhitungan yang dipakai KPI & Master KPI" })] }),
            canEdit && e.jsxs(x, { size: "sm", className: "bg-blue-600 hover:bg-blue-700", onClick: () => openForm(null), children: [e.jsx(oe, { className: "w-4 h-4 mr-1.5" }), "Tambah Satuan"] }),
          ],
        }),
      }),
      e.jsx(g, {
        className: "p-0 overflow-x-auto",
        children: e.jsxs("table", {
          className: "w-full text-xs",
          children: [
            e.jsx("thead", { className: "bg-slate-50 text-slate-500", children: e.jsxs("tr", { children: [e.jsx("th", { className: "px-3 py-2 text-left w-10", children: "No" }), e.jsx("th", { className: "px-2 py-2 text-left", children: "Satuan" }), e.jsx("th", { className: "px-2 py-2 text-left", children: "Tipe Perhitungan" }), e.jsx("th", { className: "px-2 py-2 text-left", children: "Keterangan" }), e.jsx("th", { className: "px-2 py-2 text-right", children: "KPI Bertipe Sama" }), canEdit && e.jsx("th", { className: "px-3 py-2 text-right", children: "Aksi" })] }) }),
            e.jsx("tbody", {
              children: loading
                ? e.jsx("tr", { children: e.jsx("td", { colSpan: 6, className: "px-3 py-8 text-center text-slate-400", children: "Memuat…" }) })
                : list.length === 0
                  ? e.jsx("tr", { children: e.jsx("td", { colSpan: 6, className: "px-3 py-8 text-center text-slate-400", children: "Belum ada satuan" }) })
                  : list.map((s, idx) => {
                    const t = kbTipeInfo(kbTipeOf(s)), nUse = usage ? (usage.kpi[t.v] || 0) + (usage.master[t.v] || 0) : null;
                    return e.jsxs("tr", {
                      className: "border-t border-slate-100 hover:bg-slate-50/60",
                      children: [
                        e.jsx("td", { className: "px-3 py-2 text-slate-500", children: idx + 1 }),
                        e.jsx("td", { className: "px-2 py-2 font-semibold text-slate-800", children: s.name }),
                        e.jsxs("td", { className: "px-2 py-2", children: [e.jsx("span", { className: p("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold", t.badge), children: t.l }), !s.tipe && e.jsx("span", { className: "ml-1.5 text-[10px] text-amber-700", title: "Tipe belum disimpan; ditebak dari nama satuan", children: "(otomatis)" })] }),
                        e.jsx("td", { className: "px-2 py-2 text-slate-600", children: s.keterangan || "-" }),
                        e.jsx("td", { className: "px-2 py-2 text-right tabular-nums text-slate-600", children: nUse == null ? "…" : nUse.toLocaleString("id-ID") }),
                        canEdit && e.jsx("td", { className: "px-3 py-2", children: e.jsxs("div", { className: "flex justify-end gap-1", children: [e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8", title: "Edit", onClick: () => openForm(s), children: e.jsx(H, { className: "w-3.5 h-3.5" }) }), canDel && e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8 text-red-600", title: "Hapus", onClick: () => setDel(s), children: e.jsx(Fe, { className: "w-3.5 h-3.5" }) })] }) }),
                      ],
                    }, s.id || idx);
                  }),
            }),
          ],
        }),
      }),
      e.jsx("p", { className: "px-3 py-2 text-[11px] text-slate-500 border-t bg-slate-50", children: "KPI menyimpan tipe perhitungan (percentage / currency / number / score). Nama satuan adalah label; beberapa satuan boleh memakai tipe yang sama." }),
    ],
  });

  const skalaView = e.jsxs("div", {
    className: "grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-start",
    children: [
      e.jsx(kbScaleTbl, {}),
      e.jsxs(j, {
        className: "border shadow-sm",
        children: [
          e.jsx(K, { className: "pb-2 border-b bg-slate-50/80", children: e.jsx(C, { className: "text-sm font-semibold text-slate-800", children: "Formula Polarisasi" }) }),
          e.jsx(g, {
            className: "p-3 space-y-2 text-xs text-slate-600",
            children: [
              ["Max A/B/C", "Aktual/Target X 100%"],
              ["Min A/B", "Target/Aktual X 100%"],
              ["Min C", "Aktual - Target"],
              ["Faster", "Target waktu/Aktual waktu X 100%"],
            ].map(([sk, txt]) => e.jsxs("div", { className: "flex gap-2", children: [e.jsx("span", { className: "inline-flex min-w-5 shrink-0 items-center justify-center rounded bg-slate-800 px-1.5 text-[10px] font-bold text-white", children: sk }), e.jsx("p", { className: "leading-snug", children: txt })] }, sk)),
          }),
          e.jsx("p", { className: "px-3 py-2 text-[11px] text-slate-500 border-t bg-slate-50", children: "Rumus dan rentang skor mengikuti Matriks Skor Pencapaian. Skor KPI = bobot × skor / 100." }),
        ],
      }),
    ],
  });

  const formDialog = e.jsx(kbDlg, {
    open: !!dlg,
    onOpenChange: (o) => !o && setDlg(null),
    children: e.jsxs(kbDlgC, {
      className: "sm:max-w-md",
      children: [
        e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: dlg && dlg.id ? "Edit Satuan" : "Tambah Satuan" }) }),
        e.jsxs("div", {
          className: "space-y-3 py-1",
          children: [
            e.jsxs("div", { className: "space-y-1.5", children: [e.jsx(kbLbl, { children: "Nama Satuan" }), e.jsx(pe, { value: form.name, maxLength: 100, placeholder: "mis. Hari Kerja", onChange: (a) => setForm((f0) => ({ ...f0, name: a.target.value })) })] }),
            e.jsxs("div", {
              className: "space-y-1.5",
              children: [
                e.jsx(kbLbl, { children: "Tipe Perhitungan" }),
                e.jsxs(E, { value: form.tipe, onValueChange: (v0) => setForm((f0) => ({ ...f0, tipe: v0 })), children: [e.jsx(F, { className: "h-9 bg-white", children: e.jsx(L, {}) }), e.jsx(_, { children: KB_TIPE.map((t) => e.jsx(i, { value: t.v, children: t.l }, t.v)) })] }),
                e.jsx("p", { className: "text-[11px] text-slate-500", children: kbTipeInfo(form.tipe).d }),
              ],
            }),
            e.jsxs("div", { className: "space-y-1.5", children: [e.jsx(kbLbl, { children: "Keterangan" }), e.jsx(pe, { value: form.keterangan, maxLength: 255, placeholder: "Opsional", onChange: (a) => setForm((f0) => ({ ...f0, keterangan: a.target.value })) })] }),
          ],
        }),
        e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDlg(null), children: "Batal" }), e.jsx(x, { className: "bg-blue-600 hover:bg-blue-700", disabled: busy(save), onClick: submit, children: busy(save) ? "Menyimpan…" : "Simpan" })] }),
      ],
    }),
  });

  const delDialog = e.jsx(kbDlg, {
    open: !!del,
    onOpenChange: (o) => !o && setDel(null),
    children: e.jsxs(kbDlgC, {
      className: "sm:max-w-md",
      children: [
        e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: "Hapus Satuan" }) }),
        e.jsxs("p", { className: "text-sm text-slate-600", children: ["Hapus satuan ", e.jsx("strong", { children: del && del.name }), "? KPI yang sudah ada tidak berubah karena KPI menyimpan tipe perhitungan, bukan nama satuan."] }),
        e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDel(null), children: "Batal" }), e.jsx(x, { variant: "destructive", disabled: busy(rm), onClick: () => del && rm.mutate(del.id), children: busy(rm) ? "Menghapus…" : "Ya, Hapus" })] }),
      ],
    }),
  });

  return e.jsxs("div", {
    className: "space-y-4",
    children: [
      e.jsxs("div", { className: "flex gap-1 p-1 bg-white border rounded-lg w-fit", children: [tabBtn("satuan", "Satuan"), tabBtn("skala", "Skala Penilaian"), tabBtn("polaritas", "Polaritas"), tabBtn("nilai", "Penilaian Akhir")] }),
      view === "satuan" ? e.jsxs("div", { className: "space-y-4", children: [tipeCards, syncBar, satuanTable] }) : view === "skala" ? skalaView : view === "polaritas" ? e.jsx(KbPolaritasPane, {}) : e.jsx(KbNilaiPane, {}),
      formDialog,
      delDialog,
    ],
  });
}
const KB_RUMUS = [
  { v: "maximize", l: "Maximize — Aktual/Target X 100%" },
  { v: "minimize", l: "Minimize — Target/Aktual X 100%" },
  { v: "faster", l: "Faster is better — Target waktu/Aktual waktu X 100%" },
  { v: "range", l: "Range — 90%–110% dihitung 100%" },
  { v: "stabilize", l: "Minimize C — Aktual - Target" },
  { v: "minimize_d", l: "Minimize D — Aktual - Target (Khusus Denda/Regulator, Target 0)" },
];
const KB_SKALA = [
  { v: "A", l: "A — 60 / 100 / 105 / 110 (Maximize A)" },
  { v: "B", l: "B — 80 / 100 / 110 / 120 (Maximize B & Faster)" },
  { v: "C", l: "C — 60 / 100 / 120 / 140 (Maximize C)" },
];
const KB_PREDIKAT = ["Kurang", "Cukup", "Baik", "Sangat Baik", "Istimewa"];
const KB_BATAS = { A: ["60", "100", "105", "110"], B: ["80", "100", "110", "120"], C: ["60", "100", "120", "140"] };
function kbBatasFields(skala) {
  const b = KB_BATAS[skala] || KB_BATAS.A;
  return { batas2: b[0], batas3: b[1], batas4: b[2], batas5: b[3] };
}
function kbShowBatas(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : fallback;
}
function kbNumId(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return String(v ?? "");
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
function kbPolFormula(rumus) {
  const r = String(rumus || "").toLowerCase();
  if (r === "maximize") return "Aktual/Target X 100%";
  if (r === "minimize") return "Target/Aktual X 100%";
  if (r === "faster") return "Target waktu/Aktual waktu X 100%";
  if (r === "stabilize") return "Aktual - Target";
  if (r === "range") return "90%–110% dihitung 100%";
  return r || "—";
}
function kbPolBands(row) {
  if (String(row.rumus || "").toLowerCase() === "stabilize") {
    const mid = kbNumId(row.batas2);
    const high = kbNumId(row.batas3);
    return [`> ${high}%`, `> ${mid}% s.d. ≤ ${high}%`, `> 0% s.d. ≤ ${mid}%`, "= 0%", "< 0%"];
  }
  const b = [row.batas2, row.batas3, row.batas4, row.batas5].map(kbNumId);
  return [`< ${b[0]}%`, `≥ ${b[0]}% s.d. < ${b[1]}%`, `≥ ${b[1]}% s.d. < ${b[2]}%`, `≥ ${b[2]}% s.d. ≤ ${b[3]}%`, `> ${b[3]}%`];
}
function KbPolaritasPane() {
  const qc = Ae(), { user: kbUser } = kbAuth(), canEdit = !!kbUser && ["admin", "superadmin"].includes(kbUser.role), canDel = !!kbUser && kbUser.role === "superadmin";
  const empty = { nama: "", kode: "", rumus: "maximize", skala: "A", keterangan: "", urutan: "", ...kbBatasFields("A") };
  const [dlg, setDlg] = r.useState(null), [del, setDel] = r.useState(null), [form, setForm] = r.useState(empty);
  const { data: list = [], isLoading } = J({ queryKey: ["polaritas"], queryFn: async () => { const rows = await P.getPolaritas().catch(() => []); kbRememberPol(rows); return rows; } });
  const inv = () => { qc.invalidateQueries({ queryKey: ["polaritas"] }); qc.invalidateQueries({ queryKey: ["kpis"] }); };
  const busy = (m) => !!(m.isPending || m.isLoading);
  const save = W({
    mutationFn: (d) => (dlg && dlg.id ? P.updatePolaritas(dlg.id, d) : P.createPolaritas(d)),
    onSuccess: () => { k.success(dlg && dlg.id ? "Polaritas diperbarui" : "Polaritas ditambahkan"); setDlg(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menyimpan polaritas"),
  });
  const rm = W({
    mutationFn: (id) => P.deletePolaritas(id),
    onSuccess: () => { k.success("Polaritas dihapus"); setDel(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menghapus polaritas"),
  });
  const openForm = (row) => {
    const skala = (row && row.skala) || "A";
    const preset = kbBatasFields(skala);
    const stab = row && row.rumus === "stabilize";
    const savedMid = Number(row && row.batas2);
    const useSavedStab = stab && savedMid > 0 && savedMid < 20;
    setForm(row ? { nama: row.nama || "", kode: row.kode || "", rumus: row.rumus || "maximize", skala, keterangan: row.keterangan || "", urutan: row.urutan ?? "", batas2: useSavedStab ? kbShowBatas(row.batas2, "0.25") : stab ? "0.25" : kbShowBatas(row.batas2, preset.batas2), batas3: useSavedStab ? kbShowBatas(row.batas3, "1") : stab ? "1" : kbShowBatas(row.batas3, preset.batas3), batas4: kbShowBatas(row && row.batas4, preset.batas4), batas5: kbShowBatas(row && row.batas5, preset.batas5) } : empty);
    setDlg(row || {});
  };
  const set = (key) => (ev) => setForm((f) => ({ ...f, [key]: ev.target.value }));
  const submit = () => {
    if (!form.nama.trim()) return k.error("Nama polaritas wajib diisi");
    const nums = ["batas2", "batas3", "batas4", "batas5"].map((key) => Number(String(form[key]).replace(",", ".")));
    if (form.rumus === "stabilize") {
      if (!(nums[0] > 0 && nums[0] < nums[1])) return k.error("Batas selisih harus naik, contoh 0,25 lalu 1");
    } else if (nums.some((n) => !Number.isFinite(n)) || !(nums[0] < nums[1] && nums[1] < nums[2] && nums[2] < nums[3])) return k.error("Batas skala harus naik: skor 2 < skor 3 < skor 4 < skor 5");
    const body = { nama: form.nama.trim(), rumus: form.rumus, skala: form.skala, keterangan: form.keterangan.trim(), urutan: form.urutan === "" ? 0 : Number(form.urutan), batas2: nums[0], batas3: nums[1], batas4: form.rumus === "stabilize" ? nums[1] + 1 : nums[2], batas5: form.rumus === "stabilize" ? nums[1] + 2 : nums[3] };
    if (!(dlg && dlg.id)) body.kode = form.kode.trim().toLowerCase();
    save.mutate(body);
  };
  return e.jsxs("div", { className: "space-y-4", children: [
    e.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      e.jsxs("div", { children: [
        e.jsx("h2", { className: "text-base font-semibold text-slate-800", children: "Tipe Polaritas" }),
        e.jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "Penulisan rentang mengikuti Matriks Skor Pencapaian: <, ≥, s.d., dan ≤." }),
      ] }),
      canEdit && e.jsxs(x, { size: "sm", className: "bg-blue-600 hover:bg-blue-700", onClick: () => openForm(null), children: [e.jsx(oe, { className: "w-4 h-4 mr-1.5" }), "Tambah Polaritas"] }),
    ] }),
    e.jsx(j, { className: "border shadow-sm overflow-hidden", children: e.jsx(g, { className: "p-0 overflow-x-auto", children: e.jsxs("table", { className: "w-full text-xs", children: [
      e.jsx("thead", { className: "bg-slate-50 text-slate-500", children: e.jsxs("tr", { children: ["Polarisasi", "Skor 1", "Skor 2", "Skor 3", "Skor 4", "Skor 5", "Formula", "Contoh KPI", "Aksi"].map((h) => e.jsx("th", { className: "px-2 py-2 text-left whitespace-nowrap" + (h === "Aksi" ? " text-right" : ""), children: h }, h)) }) }),
      e.jsx("tbody", { children: isLoading ? e.jsx("tr", { children: e.jsx("td", { colSpan: 9, className: "px-3 py-8", children: e.jsx(ue, { className: "h-8" }) }) }) : list.length === 0 ? e.jsx("tr", { children: e.jsx("td", { colSpan: 9, className: "px-3 py-8 text-center text-slate-400", children: "Belum ada polaritas" }) }) : list.map((row) => e.jsxs("tr", { className: "border-t border-slate-100", children: [
        e.jsx("td", { className: "px-2 py-2 font-medium text-slate-800 whitespace-nowrap", children: row.nama }),
        ...kbPolBands(row).map((cell, idx) => e.jsx("td", { className: "px-2 py-2 text-slate-700 whitespace-nowrap tabular-nums", children: cell }, idx)),
        e.jsx("td", { className: "px-2 py-2 text-slate-700 whitespace-nowrap", children: kbPolFormula(row.rumus) }),
        e.jsx("td", { className: "px-2 py-2 text-slate-600 min-w-[180px]", children: row.keterangan || "—" }),
        e.jsx("td", { className: "px-3 py-2", children: e.jsxs("div", { className: "flex justify-end gap-1", children: [
          canEdit && e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8", title: "Edit", onClick: () => openForm(row), children: e.jsx(H, { className: "w-3.5 h-3.5" }) }),
          canDel && e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8 text-red-600", title: "Hapus", onClick: () => setDel(row), children: e.jsx(Fe, { className: "w-3.5 h-3.5" }) }),
        ] }) }),
      ] }, row.id)) }),
    ] }) }) }),
    e.jsx(kbDlg, { open: !!dlg, onOpenChange: (o) => !o && setDlg(null), children: e.jsxs(kbDlgC, { className: "sm:max-w-xl", children: [
      e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: dlg && dlg.id ? "Edit Polaritas" : "Tambah Polaritas" }) }),
      e.jsxs("div", { className: "space-y-3", children: [
        e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Nama" }), e.jsx(pe, { value: form.nama, onChange: set("nama"), placeholder: "Maximize A" })] }),
        e.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Kode" }), e.jsx(pe, { value: form.kode, disabled: !!(dlg && dlg.id), onChange: set("kode"), placeholder: "maximize_a" })] }),
          e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Urutan" }), e.jsx(pe, { value: form.urutan, onChange: set("urutan"), inputMode: "numeric" })] }),
        ] }),
        e.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Rumus pencapaian" }), e.jsxs(E, { value: form.rumus, onValueChange: (v) => setForm((f) => v === "stabilize" ? { ...f, rumus: v, batas2: "0.25", batas3: "1" } : { ...f, rumus: v, ...(f.rumus === "stabilize" ? kbBatasFields(f.skala) : {}) }), children: [e.jsx(F, { children: e.jsx(L, {}) }), e.jsx(_, { children: KB_RUMUS.map((o) => e.jsx(i, { value: o.v, children: o.l }, o.v)) })] })] }),
          form.rumus !== "stabilize" && e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Isi dari skala" }), e.jsxs(E, { value: form.skala, onValueChange: (v) => setForm((f) => ({ ...f, skala: v, ...kbBatasFields(v) })), children: [e.jsx(F, { children: e.jsx(L, {}) }), e.jsx(_, { children: KB_SKALA.map((o) => e.jsx(i, { value: o.v, children: o.l }, o.v)) })] })] }),
        ] }),
        form.rumus === "stabilize" ? e.jsxs("div", { className: "space-y-2", children: [
          e.jsx(kbLbl, { children: "Skala penilaian (Aktual - Target)" }),
          e.jsx("p", { className: "text-[11px] text-slate-500", children: "Contoh Minimize C: batas skor 3 = 0,25 dan batas skor 1 = 1." }),
          e.jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
            e.jsxs("div", { className: "space-y-1", children: [e.jsx("span", { className: "text-[11px] font-medium text-slate-600", children: "Batas skor 3 (≤)" }), e.jsx(pe, { value: form.batas2, onChange: set("batas2"), inputMode: "decimal" })] }),
            e.jsxs("div", { className: "space-y-1", children: [e.jsx("span", { className: "text-[11px] font-medium text-slate-600", children: "Batas skor 1 (>)" }), e.jsx(pe, { value: form.batas3, onChange: set("batas3"), inputMode: "decimal" })] }),
          ] }),
          e.jsxs("table", { className: "w-full text-[11px] border rounded-md overflow-hidden", children: [
            e.jsx("thead", { className: "bg-slate-50 text-slate-500", children: e.jsxs("tr", { children: [e.jsx("th", { className: "px-2 py-1 text-left", children: "Skor" }), e.jsx("th", { className: "px-2 py-1 text-left", children: "Predikat" }), e.jsx("th", { className: "px-2 py-1 text-left", children: "Aktual - Target" })] }) }),
            e.jsx("tbody", { children: kbPolBands(form).map((cell, idx) => e.jsxs("tr", { className: "border-t", children: [e.jsx("td", { className: "px-2 py-1", children: String(idx + 1) }), e.jsx("td", { className: "px-2 py-1", children: KB_PREDIKAT[idx] }), e.jsx("td", { className: "px-2 py-1 whitespace-nowrap", children: cell })] }, idx)) }),
          ] }),
        ] }) : e.jsxs("div", { className: "space-y-2", children: [
          e.jsx(kbLbl, { children: "Skala penilaian (% pencapaian)" }),
          e.jsx("p", { className: "text-[11px] text-slate-500", children: "Angka ini yang dipakai menghitung skor. Memilih skala A, B, atau C hanya mengisi batas bawaan." }),
          e.jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: [
            [["batas2", "Cukup mulai (skor 2)"], ["batas3", "Baik mulai (skor 3)"], ["batas4", "Sangat Baik mulai (skor 4)"], ["batas5", "Istimewa di atas (skor 5)"]].map(([key, label]) => e.jsxs("div", { className: "space-y-1", children: [e.jsx("span", { className: "text-[11px] font-medium text-slate-600", children: label }), e.jsx(pe, { value: form[key], onChange: set(key), inputMode: "decimal" })] }, key)),
          ] }),
          e.jsxs("table", { className: "w-full text-[11px] border rounded-md overflow-hidden", children: [
            e.jsx("thead", { className: "bg-slate-50 text-slate-500", children: e.jsxs("tr", { children: [e.jsx("th", { className: "px-2 py-1 text-left", children: "Skor" }), e.jsx("th", { className: "px-2 py-1 text-left", children: "Predikat" }), e.jsx("th", { className: "px-2 py-1 text-left", children: "Pencapaian" })] }) }),
            e.jsx("tbody", { children: kbPolBands(form).map((cell, idx) => e.jsxs("tr", { className: "border-t", children: [e.jsx("td", { className: "px-2 py-1", children: String(idx + 1) }), e.jsx("td", { className: "px-2 py-1", children: KB_PREDIKAT[idx] }), e.jsx("td", { className: "px-2 py-1 whitespace-nowrap", children: cell })] }, idx)) }),
          ] }),
        ] }),
        e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Keterangan" }), e.jsx(pe, { value: form.keterangan, onChange: set("keterangan") })] }),
        dlg && dlg.id && e.jsx("p", { className: "text-[11px] text-slate-500", children: "Kode tidak bisa diubah karena sudah tersimpan di KPI. Mengubah batas skala langsung mengubah skor KPI yang memakai polaritas ini." }),
      ] }),
      e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDlg(null), children: "Batal" }), e.jsx(x, { disabled: busy(save), onClick: submit, children: busy(save) ? "Menyimpan…" : "Simpan" })] }),
    ] }) }),
    e.jsx(kbDlg, { open: !!del, onOpenChange: (o) => !o && setDel(null), children: e.jsxs(kbDlgC, { className: "sm:max-w-md", children: [
      e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: "Hapus Polaritas" }) }),
      e.jsxs("p", { className: "text-sm text-slate-600", children: ["Hapus ", e.jsx("strong", { children: del && del.nama }), "? Polaritas yang masih dipakai KPI tidak bisa dihapus."] }),
      e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDel(null), children: "Batal" }), e.jsx(x, { variant: "destructive", disabled: busy(rm), onClick: () => del && rm.mutate(del.id), children: busy(rm) ? "Menghapus…" : "Ya, Hapus" })] }),
    ] }) }),
  ] });
}
const KB_WARNA = ["Merah", "Orange", "Hijau Muda", "Hijau", "Hijau Tua"];
const kbWarnaStyle = { Merah: { backgroundColor: "#DC2626", color: "#fff" }, Orange: { backgroundColor: "#F97316", color: "#fff" }, "Hijau Muda": { backgroundColor: "#90EE90", color: "#14532d" }, Hijau: { backgroundColor: "#22C55E", color: "#fff" }, "Hijau Tua": { backgroundColor: "#00A651", color: "#fff" }, Biru: { backgroundColor: "#2563EB", color: "#fff" } };
function KbNilaiPane() {
  const qc = Ae(), { user: kbUser } = kbAuth(), canEdit = !!kbUser && ["admin", "superadmin"].includes(kbUser.role), canDel = !!kbUser && kbUser.role === "superadmin";
  const empty = { kategori: "", warna: "Hijau Muda", nilai_min: "", nilai_max: "", urutan: "" };
  const [dlg, setDlg] = r.useState(null), [del, setDel] = r.useState(null), [form, setForm] = r.useState(empty);
  const { data: list = [], isLoading } = J({ queryKey: ["penilaian-akhir"], queryFn: async () => { const rows = await P.getPenilaianAkhir().catch(() => []); kbRememberNilai(rows); return rows; } });
  const inv = () => qc.invalidateQueries({ queryKey: ["penilaian-akhir"] });
  const busy = (m) => !!(m.isPending || m.isLoading);
  const save = W({
    mutationFn: (d) => (dlg && dlg.id ? P.updatePenilaianAkhir(dlg.id, d) : P.createPenilaianAkhir(d)),
    onSuccess: () => { k.success(dlg && dlg.id ? "Kategori diperbarui" : "Kategori ditambahkan"); setDlg(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menyimpan kategori"),
  });
  const rm = W({
    mutationFn: (id) => P.deletePenilaianAkhir(id),
    onSuccess: () => { k.success("Kategori dihapus"); setDel(null); inv(); },
    onError: (a) => k.error(a.message || "Gagal menghapus kategori"),
  });
  const openForm = (row) => {
    setForm(row ? { kategori: row.kategori || "", warna: row.warna === "Hijau" ? "Hijau Muda" : (row.warna || "Hijau Muda"), nilai_min: row.nilai_min ?? "", nilai_max: row.nilai_max ?? "", urutan: row.urutan ?? "" } : empty);
    setDlg(row || {});
  };
  const set = (key) => (ev) => setForm((f) => ({ ...f, [key]: ev.target.value }));
  const submit = () => {
    const nilaiMin = Number(String(form.nilai_min).replace(",", "."));
    const nilaiMax = Number(String(form.nilai_max).replace(",", "."));
    if (!form.kategori.trim()) return k.error("Kategori wajib diisi");
    if (!Number.isFinite(nilaiMin) || !Number.isFinite(nilaiMax) || !(nilaiMin < nilaiMax)) return k.error("Nilai minimum harus lebih kecil dari nilai maksimum");
    save.mutate({ kategori: form.kategori.trim(), warna: form.warna, nilai_min: nilaiMin, nilai_max: nilaiMax, urutan: form.urutan === "" ? 0 : Number(form.urutan) });
  };
  return e.jsxs("div", { className: "space-y-4", children: [
    e.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      e.jsxs("div", { children: [
        e.jsx("h2", { className: "text-base font-semibold text-slate-800", children: "Penilaian Akhir Skor KPI" }),
        e.jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "Dipakai untuk kategori skor total (jumlah bobot × skor). Jika rentang bertumpuk, yang batas bawahnya lebih tinggi yang dipakai." }),
      ] }),
      canEdit && e.jsxs(x, { size: "sm", className: "bg-blue-600 hover:bg-blue-700", onClick: () => openForm(null), children: [e.jsx(oe, { className: "w-4 h-4 mr-1.5" }), "Tambah Kategori"] }),
    ] }),
    e.jsx(j, { className: "border shadow-sm overflow-hidden", children: e.jsx(g, { className: "p-0 overflow-x-auto", children: e.jsxs("table", { className: "w-full text-xs", children: [
      e.jsx("thead", { className: "bg-slate-50 text-slate-500", children: e.jsxs("tr", { children: ["Nilai", "Kategori", "Warna", "Aksi"].map((h) => e.jsx("th", { className: "px-3 py-2 text-left" + (h === "Aksi" ? " text-right" : ""), children: h }, h)) }) }),
      e.jsx("tbody", { children: isLoading ? e.jsx("tr", { children: e.jsx("td", { colSpan: 4, className: "px-3 py-8", children: e.jsx(ue, { className: "h-8" }) }) }) : list.length === 0 ? e.jsx("tr", { children: e.jsx("td", { colSpan: 4, className: "px-3 py-8 text-center text-slate-400", children: "Belum ada kategori" }) }) : list.map((row) => e.jsxs("tr", { className: "border-t border-slate-100", children: [
        e.jsx("td", { className: "px-3 py-2 tabular-nums", children: `${Number(row.nilai_min).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – ${Number(row.nilai_max).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
        e.jsx("td", { className: "px-3 py-2 font-medium text-slate-800", children: row.kategori }),
        e.jsx("td", { className: "px-3 py-2", children: e.jsx("span", { className: "inline-flex px-2 py-0.5 rounded text-[11px] font-semibold", style: kbWarnaStyle[row.warna] || { backgroundColor: "#e2e8f0", color: "#334155" }, children: row.warna === "Hijau" ? "Hijau Muda" : row.warna }) }),
        e.jsx("td", { className: "px-3 py-2", children: e.jsxs("div", { className: "flex justify-end gap-1", children: [
          canEdit && e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => openForm(row), children: e.jsx(H, { className: "w-3.5 h-3.5" }) }),
          canDel && e.jsx(x, { variant: "ghost", size: "icon", className: "h-8 w-8 text-red-600", onClick: () => setDel(row), children: e.jsx(Fe, { className: "w-3.5 h-3.5" }) }),
        ] }) }),
      ] }, row.id)) }),
    ] }) }) }),
    e.jsx(kbDlg, { open: !!dlg, onOpenChange: (o) => !o && setDlg(null), children: e.jsxs(kbDlgC, { className: "sm:max-w-md", children: [
      e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: dlg && dlg.id ? "Edit Kategori" : "Tambah Kategori" }) }),
      e.jsxs("div", { className: "space-y-3", children: [
        e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Kategori" }), e.jsx(pe, { value: form.kategori, onChange: set("kategori"), placeholder: "Istimewa" })] }),
        e.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Nilai minimum" }), e.jsx(pe, { value: form.nilai_min, onChange: set("nilai_min"), inputMode: "decimal" })] }),
          e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Nilai maksimum" }), e.jsx(pe, { value: form.nilai_max, onChange: set("nilai_max"), inputMode: "decimal" })] }),
        ] }),
        e.jsxs("div", { className: "space-y-1", children: [e.jsx(kbLbl, { children: "Warna" }), e.jsxs(E, { value: form.warna, onValueChange: (v) => setForm((f) => ({ ...f, warna: v })), children: [e.jsx(F, { children: e.jsx(L, {}) }), e.jsx(_, { children: KB_WARNA.map((o) => e.jsx(i, { value: o, children: o }, o)) })] })] }),
      ] }),
      e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDlg(null), children: "Batal" }), e.jsx(x, { disabled: busy(save), onClick: submit, children: busy(save) ? "Menyimpan…" : "Simpan" })] }),
    ] }) }),
    e.jsx(kbDlg, { open: !!del, onOpenChange: (o) => !o && setDel(null), children: e.jsxs(kbDlgC, { className: "sm:max-w-md", children: [
      e.jsx(kbDlgH, { children: e.jsx(kbDlgT, { children: "Hapus Kategori" }) }),
      e.jsxs("p", { className: "text-sm text-slate-600", children: ["Hapus kategori ", e.jsx("strong", { children: del && del.kategori }), "?"] }),
      e.jsxs(kbDlgF, { children: [e.jsx(x, { variant: "outline", onClick: () => setDel(null), children: "Batal" }), e.jsx(x, { variant: "destructive", disabled: busy(rm), onClick: () => del && rm.mutate(del.id), children: busy(rm) ? "Menghapus…" : "Ya, Hapus" })] }),
    ] }) }),
  ] });
}
function KbCatDlg(props) {
  const { user: kbUser } = kbAuth();
  return e.jsx(Ue, { ...props, canEditTarget: !!kbUser && ["admin", "superadmin"].includes(kbUser.role) });
}
export{Na as default};
