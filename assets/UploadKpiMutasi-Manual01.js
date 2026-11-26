import{r as i,j as e,W as RefreshIcon}from"./ui-Bxdhc9mB.js";import{b as useQC,u as useQ}from"./query-7fhvqgVT.js";import{u as useAuth,c as cx,B as Btn,a as api,t as toast}from"./index-CdyJlLvAQ.js";import{P as PageHeader}from"./PageHeader-DdzXL2rh.js";import{C as Card,c as CardContent,a as CardHeader,b as CardTitle,d as CardDescription}from"./card-jQ2tvwnD.js";import{L as Label}from"./label-BZL7aJ1G.js";import{B as Badge}from"./badge-BDPDcSpQ.js";import"./vendor-CvVmYoZI.js";

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader;
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function PreviewBox({preview}){
  if(!preview)return null;
  const peg=preview.pegawai||{};
  const oldP=preview.old||{};
  const newP=preview.new||{};
  const periods=preview.periods||{};
  return e.jsxs("div",{className:"rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 text-sm",children:[
    e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[
      e.jsx("span",{className:"font-semibold text-slate-800",children:"Preview import"}),
      preview.force_will_replace?e.jsx(Badge,{className:"bg-amber-100 text-amber-800 hover:bg-amber-100",children:"Akan ganti mutasi aktif"}):null
    ]}),
    e.jsxs("div",{children:[
      e.jsx("div",{className:"text-xs uppercase tracking-wide text-slate-500 mb-1",children:"Pegawai"}),
      e.jsxs("div",{className:"font-medium text-slate-900",children:[peg.name||"—"," ",e.jsxs("span",{className:"text-xs font-mono text-slate-500",children:["(",peg.npp||"—",")"]})]})
    ]}),
    e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[
      e.jsxs("div",{className:"rounded-lg border bg-white p-3",children:[
        e.jsx("div",{className:"text-xs font-semibold text-slate-500 uppercase mb-1",children:"Sebelum mutasi (Sheet 1)"}),
        e.jsx("div",{className:"font-medium",children:oldP.unit_name||"—"}),
        e.jsx("div",{className:"text-xs text-slate-500",children:oldP.jabatan||"—"}),
        e.jsxs("div",{className:"text-xs mt-1",children:[oldP.kpi_count||0," KPI · ",(oldP.month_keys||[]).join(", ")||"—"]})
      ]}),
      e.jsxs("div",{className:"rounded-lg border bg-white p-3",children:[
        e.jsx("div",{className:"text-xs font-semibold text-slate-500 uppercase mb-1",children:"Sesudah mutasi (Sheet 2)"}),
        e.jsx("div",{className:"font-medium",children:newP.unit_name||"—"}),
        e.jsx("div",{className:"text-xs text-slate-500",children:newP.jabatan||"—"}),
        e.jsxs("div",{className:"text-xs mt-1",children:[newP.kpi_count||0," KPI · ",(newP.month_keys||[]).join(", ")||"—"]})
      ]})
    ]}),
    periods.effective_date?e.jsxs("div",{className:"text-xs text-slate-600",children:["Effective date: ",e.jsx("strong",{children:periods.effective_date})]}):null
  ]});
}

function UploadKpiMutasiPage(){
  const{user}=useAuth();
  const qc=useQC();
  const[file,setFile]=i.useState(null);
  const[pegawaiId,setPegawaiId]=i.useState("");
  const[force,setForce]=i.useState(!1);
  const[preview,setPreview]=i.useState(null);
  const[busy,setBusy]=i.useState(!1);
  const role=user&&user.role;
  const allowed=role==="superadmin"||role==="admin";

  const{data:pegawaiRaw=[]}=useQ({
    queryKey:["pegawai","upload-mutasi"],
    queryFn:()=>api.getPegawai(),
    enabled:allowed
  });
  const pegawaiList=Array.isArray(pegawaiRaw)?pegawaiRaw:(pegawaiRaw&&pegawaiRaw.data)||[];

  const runImport=async({dryRun})=>{
    if(!file){toast.error("Pilih file Excel terlebih dahulu");return}
    setBusy(!0);
    try{
      const fileBase64=await fileToBase64(file);
      const result=await api.post("/mutations/import-kpi",{
        fileBase64,
        pegawaiId:pegawaiId||null,
        force:!!force,
        dryRun:!!dryRun
      });
      if(dryRun){
        setPreview(result);
        toast.success("Preview berhasil. Periksa data lalu konfirmasi import.");
      }else{
        setPreview(result);
        toast.success((result&&result.message)||"Import mutasi berhasil");
        qc.invalidateQueries({queryKey:["kpis"]});
        qc.invalidateQueries({queryKey:["mutations"]});
        qc.invalidateQueries({queryKey:["pegawai"]});
      }
    }catch(err){
      toast.error((err&&err.message)||"Gagal memproses file");
    }finally{
      setBusy(!1);
    }
  };

  if(!allowed){
    return e.jsxs("div",{className:"max-w-xl mx-auto py-16 text-center space-y-2",children:[
      e.jsx("h1",{className:"text-lg font-semibold text-slate-800",children:"Akses Ditolak"}),
      e.jsx("p",{className:"text-sm text-slate-500",children:"Menu ini hanya untuk Superadmin / Admin."})
    ]});
  }

  return e.jsxs("div",{className:"space-y-6 pb-20 max-w-3xl mx-auto",children:[
    e.jsx(PageHeader,{
      eyebrow:"Administrasi",
      title:"Upload Data KPI untuk Mutasi",
      subtitle:"Unggah template Excel 2 sheet (sebelum & sesudah mutasi) untuk membuat scorecard mutasi pegawai."
    }),
    e.jsxs(Card,{className:"border border-slate-200 shadow-sm",children:[
      e.jsxs(CardHeader,{className:"border-b bg-slate-50/80",children:[
        e.jsx(CardTitle,{children:"Petunjuk"}),
        e.jsx(CardDescription,{children:"Sheet 1 = scorecard SEBELUM mutasi. Sheet 2 = scorecard SESUDAH mutasi. NPP/nama di Excel dipakai untuk mencocokkan pegawai."})
      ]}),
      e.jsx(CardContent,{className:"pt-4",children:e.jsxs("ul",{className:"list-disc pl-5 text-sm text-slate-600 space-y-1",children:[
        e.jsx("li",{children:"File harus .xlsx dengan minimal 2 sheet."}),
        e.jsx("li",{children:"Jika pegawai tidak terdeteksi otomatis, pilih manual di bawah."}),
        e.jsx("li",{children:"Jika sudah ada mutasi aktif, centang \"Ganti mutasi aktif\"."}),
        e.jsx("li",{children:"Gunakan Preview dulu sebelum Konfirmasi Import."})
      ]})})
    ]}),
    e.jsxs(Card,{className:"border border-slate-200 shadow-sm",children:[
      e.jsxs(CardHeader,{className:"border-b bg-slate-50/80",children:[
        e.jsx(CardTitle,{children:"Pengaturan Import"}),
        e.jsx(CardDescription,{children:"Opsional: kunci ke pegawai tertentu jika NPP di Excel tidak cocok."})
      ]}),
      e.jsxs(CardContent,{className:"pt-4 space-y-4",children:[
        e.jsxs("div",{className:"space-y-1.5",children:[
          e.jsx(Label,{children:"Pegawai (opsional)"}),
          e.jsxs("select",{
            className:"w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm",
            value:pegawaiId,
            onChange:ev=>setPegawaiId(ev.target.value),
            children:[
              e.jsx("option",{value:"",children:"Deteksi otomatis dari Excel (NPP / Nama)"}),
              ...pegawaiList.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"id")).map(p=>
                e.jsxs("option",{value:p.id,children:[p.name," (",p.npp||"-",") — ",p.unit_name||"-"]},p.id)
              )
            ]
          })
        ]}),
        e.jsxs("label",{className:"flex items-start gap-2 text-sm text-slate-700 cursor-pointer",children:[
          e.jsx("input",{type:"checkbox",className:"mt-1",checked:force,onChange:ev=>setForce(ev.target.checked)}),
          e.jsxs("span",{children:[
            e.jsx("span",{className:"font-medium",children:"Ganti mutasi aktif"}),
            e.jsx("span",{className:"block text-xs text-slate-500",children:"Centang jika pegawai sudah punya mutasi aktif dan ingin diganti."})
          ]})
        ]}),
        e.jsxs("div",{className:"space-y-1.5",children:[
          e.jsx(Label,{children:"File Excel"}),
          e.jsx("input",{
            type:"file",
            accept:".xlsx,.xls",
            className:"block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100",
            onChange:ev=>{
              const f=(ev.target.files&&ev.target.files[0])||null;
              setFile(f);
              setPreview(null);
            }
          }),
          file?e.jsxs("p",{className:"text-xs text-slate-500",children:["Dipilih: ",file.name," (",Math.round(file.size/1024)," KB)"]}):null
        ]}),
        e.jsx(PreviewBox,{preview}),
        e.jsxs("div",{className:"flex flex-wrap gap-3 pt-2",children:[
          e.jsxs(Btn,{
            type:"button",
            variant:"outline",
            disabled:busy||!file,
            onClick:()=>runImport({dryRun:!0}),
            children:[e.jsx(RefreshIcon,{className:cx("w-4 h-4 mr-2",busy&&"animate-spin")}),busy?"Memproses...":"Preview"]
          }),
          e.jsxs(Btn,{
            type:"button",
            className:"bg-blue-600 hover:bg-blue-700",
            disabled:busy||!file||!preview,
            onClick:()=>runImport({dryRun:!1}),
            children:[busy?"Mengimpor...":"Konfirmasi Import"]
          })
        ]})
      ]})
    ]})
  ]});
}

export{UploadKpiMutasiPage as default};
