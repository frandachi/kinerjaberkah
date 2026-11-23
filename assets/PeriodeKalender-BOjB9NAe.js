import{r as n,j as e,aA as J,w as I}from"./ui-Bxdhc9mB.js";import{P as K}from"./PageHeader-DdzXL2rh.js";import{C as o,c as b,a as p,b as g,d as k}from"./card-jQ2tvwnD.js";import{B as D,c as j,t as R,a as api,u as useAuth}from"./index-CdyJlLvAQ.js";import{L as f}from"./label-BZL7aJ1G.js";import{S as N,a as y,b as S,c as v,d as w}from"./select-BgJbFb_v.js";import{C as Y}from"./checkbox-D-3KCFC5.js";import{b as useQueryClient,u as useQuery,c as useMutation}from"./query-7fhvqgVT.js";import"./vendor-CvVmYoZI.js";

const T="kb_periode_settings";
const i=[{key:"Jan",label:"Januari"},{key:"Feb",label:"Februari"},{key:"Mar",label:"Maret"},{key:"Apr",label:"April"},{key:"Mei",label:"Mei"},{key:"Jun",label:"Juni"},{key:"Jul",label:"Juli"},{key:"Ags",label:"Agustus"},{key:"Sep",label:"September"},{key:"Okt",label:"Oktober"},{key:"Nov",label:"November"},{key:"Des",label:"Desember"}];
const l=new Date().getFullYear();
const C=[l-1,l,l+1,2026,2027,2028].filter((s,c,t)=>t.indexOf(s)===c).sort();

function normalize(raw){
  const tahunAktif=String((raw&&raw.tahunAktif)||l);
  const src=(raw&&raw.bulanTutup&&typeof raw.bulanTutup==="object")?raw.bulanTutup:{};
  const bulanTutup={};
  for(const m of i){if(src[m.key])bulanTutup[m.key]=true}
  return{tahunAktif,bulanTutup};
}
function readLocal(){
  try{const s=localStorage.getItem(T);if(s)return normalize(JSON.parse(s))}catch{}
  return normalize(null);
}
function writeLocal(a){
  try{localStorage.setItem(T,JSON.stringify(normalize(a)))}catch{}
}

function z(){
  var x;
  const{user}=useAuth();
  const qc=useQueryClient();
  const canEdit=user&&(user.role==="superadmin"||user.role==="admin");
  const q=useQuery({
    queryKey:["periode-kalender"],
    queryFn:async()=>{
      try{
        const remote=await api.get("/parameters/periode-kalender");
        if(remote&&typeof remote==="object"){
          const src=remote.bulanTutup!==undefined?remote:(remote.data&&typeof remote.data==="object"?remote.data:null);
          if(src){
            const nrm=normalize(src);
            writeLocal(nrm);
            return nrm;
          }
        }
      }catch{}
      const open=normalize({tahunAktif:String(l),bulanTutup:{}});
      writeLocal(open);
      return open;
    },
    staleTime:0,
    refetchOnMount:"always"
  });

  const remote=normalize(q.data||readLocal());
  const[s,c]=n.useState(()=>remote.tahunAktif);
  const[t,A]=n.useState(()=>({...remote.bulanTutup}));
  const[d,h]=n.useState(()=>remote.tahunAktif);

  n.useEffect(()=>{
    if(!q.data)return;
    const nrm=normalize(q.data);
    c(nrm.tahunAktif);
    A({...nrm.bulanTutup});
    h(nrm.tahunAktif);
  },[q.data]);

  n.useEffect(()=>{h(s)},[s]);

  const publish=(tahunAktif,bulanTutup)=>{
    const payload=normalize({tahunAktif,bulanTutup});
    writeLocal(payload);
    qc.setQueryData(["periode-kalender"],payload);
    return payload;
  };

  const saveMut=useMutation({
    mutationFn:async(payload)=>api.put("/parameters/periode-kalender",payload),
    onSuccess:(saved)=>{
      const nrm=normalize(saved&&saved.bulanTutup!==undefined?saved:(saved&&saved.data)||saved);
      writeLocal(nrm);
      qc.setQueryData(["periode-kalender"],nrm);
      try{qc.invalidateQueries({queryKey:["periode-kalender"]})}catch{}
      R.success("Periode tersimpan — kunci realisasi/target sudah disinkronkan.");
    },
    onError:(err)=>{
      R.error((err&&err.message)||"Gagal menyimpan ke server");
    }
  });

  const P=n.useMemo(()=>i.filter(a=>t[a.key]).length,[t]);

  const M=a=>{
    if(!canEdit)return;
    const next={...t,[a.key]:!t[a.key]};
    A(next);
    const payload=publish(s,next);
    saveMut.mutate(payload);
  };

  const onYear=v0=>{
    if(!canEdit)return;
    c(v0);
    const payload=publish(v0,t);
    saveMut.mutate(payload);
  };

  const O=()=>{
    if(!canEdit){R.error("Hanya admin yang dapat mengunci/membuka periode");return}
    const payload=publish(s,t);
    saveMut.mutate(payload);
  };

  const E=(x=i[new Date().getMonth()])==null?void 0:x.key;

  return e.jsxs("div",{className:"space-y-6",children:[
    e.jsx(K,{eyebrow:"Pengaturan Sistem",title:"Periode & Kalender",subtitle:"Centang bulan untuk mengunci edit realisasi & target. Perubahan langsung tersimpan dan dipakai di form Edit Realisasi.",actions:canEdit?e.jsxs(D,{className:"bg-blue-600 hover:bg-blue-700",onClick:O,disabled:saveMut.isPending,children:[e.jsx(J,{className:"w-4 h-4 mr-1.5"})," ",saveMut.isPending?"Menyimpan…":"Simpan"]}):null}),
    e.jsx(o,{className:"border shadow-sm border-sky-100 bg-sky-50/50",children:e.jsx(b,{className:"p-4 text-sm text-slate-700",children:"Status di halaman ini harus sama dengan form Edit Realisasi. Centang = dikunci. Kosong = terbuka (bisa edit/revisi)."})}),
    e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4",children:[
      e.jsxs(o,{className:"border shadow-sm",children:[
        e.jsxs(p,{className:"border-b bg-slate-50/80",children:[
          e.jsx(g,{className:"text-base",children:"Pengaturan Periode"}),
          e.jsx(k,{children:"Tahun aktif & bulan tutup buku (kunci/buka)"})
        ]}),
        e.jsxs(b,{className:"p-5 space-y-4",children:[
          e.jsxs("div",{className:"space-y-1.5",children:[
            e.jsx(f,{children:"Tahun aktif"}),
            e.jsxs(N,{value:s,onValueChange:onYear,disabled:!canEdit,children:[
              e.jsx(y,{className:"w-40",children:e.jsx(S,{})}),
              e.jsx(v,{children:C.map(a=>e.jsx(w,{value:String(a),children:a},a))})
            ]})
          ]}),
          e.jsxs("div",{children:[
            e.jsxs(f,{className:"mb-2 block",children:["Bulan tutup buku / dikunci (",P,"/12)"]}),
            e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-2",children:i.map(a=>e.jsxs("label",{className:j("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",canEdit?"cursor-pointer":"cursor-not-allowed opacity-80",t[a.key]?"bg-amber-50 border-amber-200":"bg-white"),children:[
              e.jsx(Y,{checked:!!t[a.key],onCheckedChange:()=>M(a),disabled:!canEdit}),
              e.jsx("span",{children:a.label}),
              e.jsx("span",{className:"ml-auto text-[10px] uppercase tracking-wide text-slate-400",children:t[a.key]?"Kunci":"Buka"})
            ]},a.key))})
          ]})
        ]})
      ]}),
      e.jsxs(o,{className:"border shadow-sm",children:[
        e.jsxs(p,{className:"border-b bg-slate-50/80 flex flex-row items-center justify-between",children:[
          e.jsxs("div",{children:[
            e.jsxs(g,{className:"text-base flex items-center gap-2",children:[e.jsx(I,{className:"w-4 h-4"})," Kalender KPI ",d]}),
            e.jsx(k,{children:"Status kunci per bulan"})
          ]}),
          e.jsxs(N,{value:d,onValueChange:h,children:[
            e.jsx(y,{className:"w-28 h-8",children:e.jsx(S,{})}),
            e.jsx(v,{children:C.map(a=>e.jsx(w,{value:String(a),children:a},a))})
          ]})
        ]}),
        e.jsx(b,{className:"p-5",children:e.jsx("div",{className:"grid grid-cols-3 sm:grid-cols-4 gap-2",children:i.map(a=>{
          const r=!!t[a.key],u=String(d)===String(l)&&a.key===E;
          return e.jsxs("div",{className:j("rounded-xl border p-3 text-center min-h-[72px] flex flex-col justify-center",r&&"bg-slate-100 border-slate-300",u&&!r&&"bg-blue-50 border-blue-300 ring-1 ring-blue-200",!r&&!u&&"bg-white"),children:[
            e.jsx("p",{className:"text-xs font-semibold text-slate-800",children:a.label}),
            e.jsx("p",{className:"text-[10px] mt-1 text-slate-500",children:r?"Dikunci (tutup buku)":u?"Bulan berjalan · Terbuka":"Terbuka"})
          ]},a.key)
        })})})
      ]})
    ]})
  ]})
}
export{z as default};
