import{r as g,j as e,at as Plus,aD as Search,az as Pencil,au as Trash2,aq as Check}from"./ui-Bxdhc9mB.js";
import{b as useQueryClient,u as useQuery,c as useMutation}from"./query-7fhvqgVT.js";
import{c as cn,B as Button,I as Input,t as toast,a as api}from"./index-CdyJlLvAQ.js";
import{C as Card,a as CardHeader,b as CardTitle,c as CardContent}from"./card-jQ2tvwnD.js";
import{B as Badge}from"./badge-BDPDcSpQ.js";
import{S as Skeleton}from"./skeleton-7xRvmPlJ.js";
import{S as Select,a as SelectTrigger,b as SelectValue,c as SelectContent,d as SelectItem}from"./select-BgJbFb_v.js";
import{D as Dialog,a as DialogContent,b as DialogHeader,c as DialogTitle,d as DialogFooter}from"./dialog-C7q5Ayci.js";
import{L as Label}from"./label-BZL7aJ1G.js";
import{T as Textarea}from"./textarea-K__2sspm.js";
import{A as AlertDialog,a as AlertDialogContent,b as AlertDialogHeader,c as AlertDialogTitle,d as AlertDialogDescription,e as AlertDialogFooter,f as AlertDialogCancel,g as AlertDialogAction}from"./alert-dialog-wjszyc00.js";
import{D as DIVISI_KP}from"./unit-kantor-DMQ7qF6z.js";

const PERSPECTIVES=[
  {value:"financial",label:"Financial",badge:"bg-emerald-100 text-emerald-800"},
  {value:"customer",label:"Customer",badge:"bg-blue-100 text-blue-800"},
  {value:"internal_process",label:"Internal Process",badge:"bg-amber-100 text-amber-900"},
  {value:"learning_growth",label:"Learning & Growth",badge:"bg-slate-100 text-slate-800"},
];

function normPerspective(p){
  const l=String(p||"").toLowerCase();
  if(l.includes("financial")||l.includes("finansial"))return"financial";
  if(l.includes("customer")||l.includes("pelanggan"))return"customer";
  if(l.includes("internal")||l.includes("proses")||l.includes("process"))return"internal_process";
  if(l.includes("learning")||l.includes("growth")||l.includes("people"))return"learning_growth";
  return p||"financial";
}

function perspectiveMeta(p){
  const key=normPerspective(p);
  return PERSPECTIVES.find(x=>x.value===key)||{value:key,label:key,badge:"bg-slate-100 text-slate-700"};
}

const emptyForm={name:"",perspective:"financial",description:"",divisi:[]};

function parseDivisiList(raw){
  if(Array.isArray(raw))return raw.map(s=>String(s).trim()).filter(Boolean);
  return String(raw||"").split(",").map(s=>s.trim()).filter(Boolean);
}

function DivisiMultiSelect({value=[],onChange}){
  const[q,setQ]=g.useState("");
  const selected=Array.isArray(value)?value:[];
  const base=[...DIVISI_KP];
  selected.forEach(n=>{if(n&&!base.includes(n))base.push(n);});
  const qt=q.trim();
  const options=base.sort((a,b)=>a.localeCompare(b,"id")).filter(n=>!qt||n.toLowerCase().includes(qt.toLowerCase()));
  const toggle=name=>{
    if(selected.includes(name))onChange(selected.filter(x=>x!==name));
    else onChange([...selected,name]);
  };
  const clear=()=>onChange([]);
  const addCustom=()=>{
    if(!qt)return;
    if(!selected.includes(qt))onChange([...selected,qt]);
    setQ("");
  };
  return e.jsxs("div",{className:"space-y-2",children:[
    selected.length>0&&e.jsxs("div",{className:"flex flex-wrap gap-1.5 items-center",children:[
      selected.map(name=>e.jsxs(Badge,{variant:"secondary",className:"text-[11px] gap-1 pr-1",children:[
        name,
        e.jsx("button",{type:"button",className:"ml-0.5 rounded hover:bg-slate-300/60 px-1",onClick:()=>toggle(name),"aria-label":"Hapus "+name,children:"×"}),
      ]},name)),
      e.jsx("button",{type:"button",className:"text-[11px] text-blue-700 hover:underline",onClick:clear,children:"Hapus semua"}),
    ]}),
    e.jsxs("div",{className:"flex gap-2",children:[
      e.jsxs("div",{className:"relative flex-1",children:[
        e.jsx(Search,{className:"absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none"}),
        e.jsx(Input,{className:"pl-8 h-9",placeholder:"Cari divisi, atau ketik nama baru lalu Enter...",value:q,onChange:ev=>setQ(ev.target.value),onKeyDown:ev=>{if(ev.key==="Enter"){ev.preventDefault();addCustom();}}}),
      ]}),
      e.jsx(Button,{type:"button",variant:"outline",size:"sm",className:"h-9 shrink-0",onClick:addCustom,disabled:!qt,children:"Tambah"}),
    ]}),
    e.jsx("div",{className:"rounded-md border border-input max-h-[220px] overflow-y-auto bg-white",children:
      options.length?e.jsx("ul",{className:"py-1",children:options.map(name=>{
        const on=selected.includes(name);
        return e.jsxs("li",{children:[
          e.jsxs("button",{type:"button",onClick:()=>toggle(name),className:cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50",on&&"bg-blue-50"),children:[
            e.jsx("span",{className:cn("flex h-4 w-4 items-center justify-center rounded border",on?"bg-blue-600 border-blue-600 text-white":"border-slate-300"),children:on?e.jsx(Check,{className:"h-3 w-3"}):null}),
            e.jsx("span",{className:"flex-1",children:name}),
          ]}),
        ]},name);
      })}):e.jsxs("div",{className:"px-3 py-6 text-sm text-muted-foreground text-center space-y-2",children:[
        e.jsx("p",{children:qt?`"${qt}" belum ada di daftar`:"Divisi tidak ditemukan"}),
        qt?e.jsx(Button,{type:"button",size:"sm",variant:"outline",onClick:addCustom,children:"Gunakan nama ini"}):null,
      ]})
    }),
    e.jsx("p",{className:"text-[11px] text-muted-foreground",children:selected.length?selected.length+" divisi dipilih — bisa tambah nama manual jika tidak ada di daftar":"Pilih dari daftar atau ketik nama divisi baru lalu Enter / Tambah"}),
  ]});
}

function ObjectiveFormDialog({open,onOpenChange,item,onSave}){
  const[form,setForm]=g.useState(emptyForm);
  const[saving,setSaving]=g.useState(!1);
  g.useEffect(()=>{
    if(!open)return;
    setForm(item?{
      name:item.name||"",
      perspective:normPerspective(item.perspective)||"financial",
      description:item.description||"",
      divisi:parseDivisiList(item.divisi),
    }:{...emptyForm,divisi:[]});
  },[open,item]);
  const submit=async()=>{
    if(!form.name.trim()){
      toast.error("Nama objective perlu diisi");
      return;
    }
    setSaving(!0);
    try{
      await onSave({
        name:form.name.trim(),
        perspective:form.perspective,
        description:form.description.trim(),
        divisi:form.divisi.length?form.divisi.join(", "):"",
      });
      onOpenChange(!1);
    }catch(err){
      toast.error((err&&err.message)||"Gagal menyimpan objective");
    }finally{
      setSaving(!1);
    }
  };
  return e.jsx(Dialog,{open,onOpenChange,children:e.jsxs(DialogContent,{className:"sm:max-w-lg max-h-[90vh] overflow-y-auto",children:[
    e.jsx(DialogHeader,{children:e.jsx(DialogTitle,{children:item?"Edit Objective":"Tambah Objective"})}),
    e.jsxs("div",{className:"space-y-3 py-2",children:[
      e.jsxs("div",{className:"space-y-1.5",children:[
        e.jsx(Label,{children:"Perspektif"}),
        e.jsxs(Select,{value:PERSPECTIVES.some(p=>p.value===form.perspective)?form.perspective:"__custom__",onValueChange:v=>setForm(f=>({...f,perspective:v==="__custom__"?"":v})),children:[
          e.jsx(SelectTrigger,{children:e.jsx(SelectValue,{placeholder:"Pilih atau ketik di bawah"})}),
          e.jsxs(SelectContent,{children:[
            PERSPECTIVES.map(p=>e.jsx(SelectItem,{value:p.value,children:p.label},p.value)),
            e.jsx(SelectItem,{value:"__custom__",children:"Lainnya (ketik manual)"}),
          ]}),
        ]}),
        (!PERSPECTIVES.some(p=>p.value===form.perspective)||form.perspective==="")&&e.jsx(Input,{className:"mt-1",value:form.perspective,onChange:ev=>setForm(f=>({...f,perspective:ev.target.value})),placeholder:"Ketik perspektif manual..."}),
      ]}),
      e.jsxs("div",{className:"space-y-1.5",children:[
        e.jsx(Label,{children:"Nama Objective"}),
        e.jsx(Input,{value:form.name,onChange:ev=>setForm(f=>({...f,name:ev.target.value})),placeholder:"Contoh: Meningkatkan efisiensi operasional"}),
      ]}),
      e.jsxs("div",{className:"space-y-1.5",children:[
        e.jsx(Label,{children:"Divisi Kantor Pusat (bisa lebih dari 1)"}),
        e.jsx(DivisiMultiSelect,{value:form.divisi,onChange:list=>setForm(f=>({...f,divisi:list}))}),
      ]}),
      e.jsxs("div",{className:"space-y-1.5",children:[
        e.jsx(Label,{children:"Deskripsi (opsional)"}),
        e.jsx(Textarea,{value:form.description,onChange:ev=>setForm(f=>({...f,description:ev.target.value})),placeholder:"Catatan singkat...",rows:3}),
      ]}),
    ]}),
    e.jsxs(DialogFooter,{children:[
      e.jsx(Button,{variant:"outline",onClick:()=>onOpenChange(!1),disabled:saving,children:"Batal"}),
      e.jsx(Button,{onClick:submit,disabled:saving,className:"bg-blue-600 hover:bg-blue-700",children:saving?"Menyimpan...":item?"Simpan Perubahan":"Tambah"}),
    ]}),
  ]})});
}

function ObjectiveTab(){
  const qc=useQueryClient();
  const[search,setSearch]=g.useState("");
  const[persp,setPersp]=g.useState("all");
  const[dialogOpen,setDialogOpen]=g.useState(!1);
  const[editItem,setEditItem]=g.useState(null);
  const[deleteItem,setDeleteItem]=g.useState(null);
  const[page,setPage]=g.useState(1);
  const pageSize=20;

  const{data:objectives=[],isLoading}=useQuery({
    queryKey:["objectives"],
    queryFn:()=>api.getObjectives().catch(()=>[]),
  });
  const{data:strategies=[]}=useQuery({
    queryKey:["strategies"],
    queryFn:()=>api.getStrategies().catch(()=>[]),
  });

  const createMut=useMutation({
    mutationFn:body=>api.post("/parameters/objectives",body),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["objectives"]});toast.success("Objective ditambahkan");},
    onError:err=>toast.error((err&&err.message)||"Gagal menambah objective"),
  });
  const updateMut=useMutation({
    mutationFn:({id,data})=>api.put(`/parameters/objectives/${id}`,data),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["objectives"]});toast.success("Objective diperbarui");},
    onError:err=>toast.error((err&&err.message)||"Gagal memperbarui objective"),
  });
  const deleteMut=useMutation({
    mutationFn:id=>api.delete(`/parameters/objectives/${id}`),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["objectives"]});toast.success("Objective dihapus");setDeleteItem(null);},
    onError:err=>toast.error((err&&err.message)||"Gagal menghapus objective"),
  });

  const filtered=g.useMemo(()=>{
    const q=search.trim().toLowerCase();
    return(objectives||[]).filter(o=>{
      if(persp!=="all"&&normPerspective(o.perspective)!==persp)return!1;
      if(!q)return!0;
      return String(o.name||"").toLowerCase().includes(q)
        ||String(o.divisi||"").toLowerCase().includes(q)
        ||String(o.description||"").toLowerCase().includes(q);
    });
  },[objectives,search,persp]);

  const pageItems=g.useMemo(()=>{
    const start=(page-1)*pageSize;
    return filtered.slice(start,start+pageSize);
  },[filtered,page]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));

  const kpiCount=id=>(strategies||[]).filter(s=>s.objective_id===id).length;

  const openCreate=()=>{setEditItem(null);setDialogOpen(!0);};
  const openEdit=item=>{setEditItem(item);setDialogOpen(!0);};
  const handleSave=async data=>{
    if(editItem&&editItem.id)await updateMut.mutateAsync({id:editItem.id,data});
    else await createMut.mutateAsync(data);
  };

  if(isLoading){
    return e.jsxs("div",{className:"space-y-3",children:[
      e.jsx(Skeleton,{className:"h-10 w-72"}),
      e.jsx(Skeleton,{className:"h-64"}),
    ]});
  }

  return e.jsxs("div",{className:"space-y-4",children:[
    e.jsxs(Card,{className:"border shadow-sm overflow-hidden",children:[
      e.jsxs(CardHeader,{className:"pb-3 border-b bg-slate-50/80",children:[
        e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",children:[
          e.jsxs("div",{children:[
            e.jsx(CardTitle,{className:"text-base font-semibold text-slate-800",children:"Daftar Objective"}),
            e.jsxs("p",{className:"text-xs text-slate-500 mt-0.5",children:[filtered.length," dari ",objectives.length," objective"]}),
          ]}),
          e.jsxs(Button,{size:"sm",className:"bg-blue-600 hover:bg-blue-700",onClick:openCreate,children:[
            e.jsx(Plus,{className:"w-4 h-4 mr-1.5"})," Tambah Objective",
          ]}),
        ]}),
        e.jsxs("div",{className:"flex flex-wrap gap-2 mt-3",children:[
          e.jsxs("div",{className:"relative flex-1 min-w-[180px]",children:[
            e.jsx(Search,{className:"w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"}),
            e.jsx(Input,{className:"pl-8 h-9 bg-white",placeholder:"Cari objective / divisi...",value:search,onChange:ev=>{setSearch(ev.target.value);setPage(1);}}),
          ]}),
          e.jsxs(Select,{value:persp,onValueChange:v=>{setPersp(v);setPage(1);},children:[
            e.jsx(SelectTrigger,{className:"w-[200px] h-9 bg-white",children:e.jsx(SelectValue,{placeholder:"Perspektif"})}),
            e.jsxs(SelectContent,{children:[
              e.jsx(SelectItem,{value:"all",children:"Semua Perspektif"}),
              PERSPECTIVES.map(p=>e.jsx(SelectItem,{value:p.value,children:p.label},p.value)),
            ]}),
          ]}),
        ]}),
      ]}),
      e.jsx(CardContent,{className:"p-0 overflow-x-auto",children:
        filtered.length===0
          ?e.jsxs("div",{className:"text-center py-16",children:[
            e.jsx("p",{className:"text-slate-500 mb-3",children:"Belum ada objective"}),
            e.jsxs(Button,{variant:"outline",size:"sm",onClick:openCreate,children:[e.jsx(Plus,{className:"w-4 h-4 mr-1.5"})," Tambah Objective Pertama"]}),
          ]})
          :e.jsxs(e.Fragment,{children:[
            e.jsxs("table",{className:"w-full text-xs",children:[
              e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[
                e.jsx("th",{className:"px-3 py-2 text-left",children:"No"}),
                e.jsx("th",{className:"px-2 py-2 text-left",children:"Nama Objective"}),
                e.jsx("th",{className:"px-2 py-2 text-left",children:"Perspektif"}),
                e.jsx("th",{className:"px-2 py-2 text-left",children:"Divisi"}),
                e.jsx("th",{className:"px-2 py-2 text-right",children:"KPI"}),
                e.jsx("th",{className:"px-3 py-2 text-right",children:"Aksi"}),
              ]})}),
              e.jsx("tbody",{children:pageItems.map((o,idx)=>{
                const meta=perspectiveMeta(o.perspective);
                const n=kpiCount(o.id);
                return e.jsxs("tr",{className:"border-t border-slate-100 hover:bg-slate-50/60",children:[
                  e.jsx("td",{className:"px-3 py-2",children:(page-1)*pageSize+idx+1}),
                  e.jsxs("td",{className:"px-2 py-2 max-w-[360px]",children:[
                    e.jsx("p",{className:"font-semibold text-slate-800 line-clamp-2",children:o.name}),
                    o.description?e.jsx("p",{className:"text-[11px] text-slate-500 mt-0.5 line-clamp-1",children:o.description}):null,
                  ]}),
                  e.jsx("td",{className:"px-2 py-2",children:e.jsx(Badge,{className:cn("hover:bg-opacity-100",meta.badge),children:meta.label})}),
                  e.jsx("td",{className:"px-2 py-2 text-slate-600 max-w-[200px]",children:e.jsx("span",{className:"line-clamp-2",children:o.divisi||"—"})}),
                  e.jsx("td",{className:"px-2 py-2 text-right tabular-nums font-semibold",children:n}),
                  e.jsxs("td",{className:"px-3 py-2 text-right",children:[
                    e.jsxs("div",{className:"inline-flex gap-1",children:[
                      e.jsx(Button,{variant:"ghost",size:"icon",className:"h-8 w-8",onClick:()=>openEdit(o),title:"Edit",children:e.jsx(Pencil,{className:"w-3.5 h-3.5"})}),
                      e.jsx(Button,{variant:"ghost",size:"icon",className:"h-8 w-8 text-destructive",onClick:()=>setDeleteItem(o),title:"Hapus",children:e.jsx(Trash2,{className:"w-3.5 h-3.5"})}),
                    ]}),
                  ]}),
                ]},o.id);
              })}),
            ]}),
            totalPages>1&&e.jsxs("div",{className:"flex items-center justify-between px-3 py-2 border-t bg-slate-50 text-xs text-slate-600",children:[
              e.jsxs("span",{children:["Halaman ",page," / ",totalPages]}),
              e.jsxs("div",{className:"flex gap-2",children:[
                e.jsx(Button,{variant:"outline",size:"sm",disabled:page<=1,onClick:()=>setPage(p=>p-1),children:"Sebelumnya"}),
                e.jsx(Button,{variant:"outline",size:"sm",disabled:page>=totalPages,onClick:()=>setPage(p=>p+1),children:"Berikutnya"}),
              ]}),
            ]}),
          ]}),
      }),
    ]}),
    e.jsx(ObjectiveFormDialog,{open:dialogOpen,onOpenChange:setDialogOpen,item:editItem,onSave:handleSave}),
    e.jsx(AlertDialog,{open:!!deleteItem,onOpenChange:open=>!open&&setDeleteItem(null),children:e.jsxs(AlertDialogContent,{children:[
      e.jsxs(AlertDialogHeader,{children:[
        e.jsx(AlertDialogTitle,{children:"Hapus Objective?"}),
        e.jsxs(AlertDialogDescription,{children:[
          "Hapus ",e.jsx("strong",{children:deleteItem==null?void 0:deleteItem.name}),"? Tindakan ini tidak dapat dibatalkan.",
        ]}),
      ]}),
      e.jsxs(AlertDialogFooter,{children:[
        e.jsx(AlertDialogCancel,{children:"Batal"}),
        e.jsx(AlertDialogAction,{
          className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",
          onClick:()=>deleteItem&&deleteMut.mutate(deleteItem.id),
          children:"Hapus",
        }),
      ]}),
    ]})}),
  ]});
}

export{ObjectiveTab as O,ObjectiveTab as default};
