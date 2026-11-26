import{r as i,j as e,q as DownloadIcon,aD as SearchIcon,W as RefreshIcon,au as TrashIcon}from"./ui-Bxdhc9mB.js";import{b as useQC,u as useQ,c as useMut}from"./query-7fhvqgVT.js";import{u as useAuth,c as cx,B as Btn,I as Input,a as api,t as toast}from"./index-CdyJlLvAQ.js";import{P as PageHeader}from"./PageHeader-DdzXL2rh.js";import{C as Card,c as CardContent,a as CardHeader,b as CardTitle,d as CardDescription}from"./card-jQ2tvwnD.js";import{B as Badge}from"./badge-BDPDcSpQ.js";import"./vendor-CvVmYoZI.js";

const MONTHS=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

function fmtSize(n){
  const v=Number(n)||0;
  if(v<1024)return v+" B";
  if(v<1024*1024)return(v/1024).toFixed(1)+" KB";
  return(v/(1024*1024)).toFixed(2)+" MB";
}

function fmtDate(v){
  if(!v)return"—";
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return String(v);
  return d.toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

async function downloadEvidence(row){
  const token=localStorage.getItem("token");
  const res=await fetch(`/kinerjaberkah/api/kpi-evidence/file/${encodeURIComponent(row.stored_name)}`,{
    headers:token?{Authorization:`Bearer ${token}`}:{}
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({message:"Gagal unduh"}));
    throw new Error(err.message||"Gagal unduh bukti");
  }
  const blob=await res.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=row.original_name||row.stored_name;
  a.click();
  URL.revokeObjectURL(url);
}

function FileEvidencePage(){
  const{user}=useAuth();
  const qc=useQC();
  const[search,setSearch]=i.useState("");
  const[month,setMonth]=i.useState("all");
  const[q,setQ]=i.useState("");
  const role=user&&user.role;
  const privileged=role==="admin"||role==="superadmin";

  i.useEffect(()=>{
    const t=setTimeout(()=>setQ(search.trim()),350);
    return()=>clearTimeout(t);
  },[search]);

  const{data,isLoading,refetch,isFetching}=useQ({
    queryKey:["kpi-evidence",q,month],
    queryFn:()=>{
      const params=new URLSearchParams();
      if(q)params.set("search",q);
      if(month!=="all")params.set("month_key",month);
      return api.get(`/kpi-evidence?${params.toString()}`);
    }
  });
  const rows=Array.isArray(data)?data:(data&&data.data)||[];

  const delMut=useMut({
    mutationFn:id=>api.delete(`/kpi-evidence/${id}`),
    onSuccess:()=>{
      toast.success("Bukti dihapus");
      qc.invalidateQueries({queryKey:["kpi-evidence"]});
    },
    onError:err=>toast.error((err&&err.message)||"Gagal menghapus")
  });

  return e.jsxs("div",{className:"space-y-5 pb-16 max-w-6xl mx-auto",children:[
    e.jsx(PageHeader,{
      eyebrow:"Dokumen",
      title:"File Evidence",
      subtitle:privileged
        ?"Daftar bukti dokumen realisasi KPI yang diunggah pegawai."
        :"Bukti dokumen realisasi (PDF, maks. 1 MB) KPI Anda (per bulan)."
    }),
    e.jsxs(Card,{className:"border shadow-sm",children:[
      e.jsxs(CardHeader,{className:"pb-3 border-b bg-slate-50/80",children:[
        e.jsx(CardTitle,{className:"text-base",children:"Daftar Bukti Realisasi"}),
        e.jsx(CardDescription,{children:"File disimpan di server dan terhubung ke KPI + bulan realisasi."})
      ]}),
      e.jsxs(CardContent,{className:"pt-4 space-y-4",children:[
        e.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[
          e.jsxs("div",{className:"relative flex-1 min-w-[200px]",children:[
            e.jsx(SearchIcon,{className:"w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"}),
            e.jsx(Input,{
              className:"pl-8 h-9 bg-white",
              placeholder:"Cari nama KPI, file, unit, pengunggah...",
              value:search,
              onChange:ev=>setSearch(ev.target.value)
            })
          ]}),
          e.jsxs("select",{
            className:"h-9 rounded-md border border-slate-200 bg-white px-3 text-sm",
            value:month,
            onChange:ev=>setMonth(ev.target.value),
            children:[
              e.jsx("option",{value:"all",children:"Semua Bulan"}),
              ...MONTHS.map(m=>e.jsx("option",{value:m,children:m},m))
            ]
          }),
          e.jsxs(Btn,{
            type:"button",
            variant:"outline",
            size:"sm",
            className:"h-9",
            onClick:()=>refetch(),
            children:[e.jsx(RefreshIcon,{className:cx("w-4 h-4 mr-1.5",isFetching&&"animate-spin")}),"Muat Ulang"]
          })
        ]}),
        e.jsxs("div",{className:"overflow-x-auto rounded-lg border",children:[
          e.jsxs("table",{className:"w-full text-xs",children:[
            e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[
              e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"KPI"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"Bulan"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"File"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"Unit / Jabatan"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"Pengunggah"}),
              e.jsx("th",{className:"px-2 py-2 text-left",children:"Waktu"}),
              e.jsx("th",{className:"px-3 py-2 text-right",children:"Aksi"})
            ]})}),
            e.jsx("tbody",{children:
              isLoading?e.jsx("tr",{children:e.jsx("td",{colSpan:8,className:"px-3 py-10 text-center text-slate-400",children:"Memuat..."})}):
              rows.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:8,className:"px-3 py-10 text-center text-slate-400",children:"Belum ada bukti terunggah. Unggah dari Form Realisasi KPI Bulanan."})}):
              rows.map((row,idx)=>e.jsxs("tr",{className:"border-t border-slate-100 hover:bg-slate-50/60",children:[
                e.jsx("td",{className:"px-3 py-2 text-slate-500",children:idx+1}),
                e.jsxs("td",{className:"px-2 py-2",children:[
                  e.jsx("div",{className:"font-medium text-slate-800 max-w-[220px] line-clamp-2",children:row.kpi_name||row.kpi_id}),
                  e.jsx("div",{className:"text-[10px] text-slate-400 font-mono",children:row.kpi_id})
                ]}),
                e.jsx("td",{className:"px-2 py-2",children:e.jsx(Badge,{variant:"outline",children:row.month_key})}),
                e.jsxs("td",{className:"px-2 py-2",children:[
                  e.jsx("div",{className:"font-medium text-slate-800 max-w-[180px] truncate",title:row.original_name,children:row.original_name}),
                  e.jsx("div",{className:"text-[10px] text-slate-400",children:fmtSize(row.file_size)})
                ]}),
                e.jsxs("td",{className:"px-2 py-2 text-slate-600 max-w-[180px]",children:[
                  e.jsx("div",{className:"truncate",children:row.unit_name||"—"}),
                  e.jsx("div",{className:"text-[10px] text-slate-400 truncate",children:row.jabatan||"—"})
                ]}),
                e.jsx("td",{className:"px-2 py-2",children:row.uploader_name||"—"}),
                e.jsx("td",{className:"px-2 py-2 whitespace-nowrap text-slate-500",children:fmtDate(row.created_at)}),
                e.jsx("td",{className:"px-3 py-2",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[
                  e.jsx(Btn,{
                    type:"button",
                    variant:"ghost",
                    size:"icon",
                    className:"h-8 w-8 text-blue-600",
                    title:"Unduh",
                    onClick:()=>downloadEvidence(row).catch(err=>toast.error(err.message)),
                    children:e.jsx(DownloadIcon,{className:"w-4 h-4"})
                  }),
                  privileged?e.jsx(Btn,{
                    type:"button",
                    variant:"ghost",
                    size:"icon",
                    className:"h-8 w-8 text-red-600",
                    title:"Hapus",
                    disabled:delMut.isPending,
                    onClick:()=>{
                      if(window.confirm(`Hapus bukti "${row.original_name}"?`)) delMut.mutate(row.id);
                    },
                    children:e.jsx(TrashIcon,{className:"w-4 h-4"})
                  }):null
                ]})})
              ]},row.id))
            })
          ]})
        ]}),
        e.jsxs("p",{className:"text-[11px] text-slate-500",children:[rows.length," file ditampilkan",privileged?"":" · hanya unit/jabatan Anda"]})
      ]})
    ]})
  ]});
}

export{FileEvidencePage as default};
