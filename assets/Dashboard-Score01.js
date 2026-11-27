import{r as React,j as e,W as RefreshIcon}from"./ui-Bxdhc9mB.js";
import{u as useAuth,c as cn,a as api}from"./index-CdyJlLvAQ.js";
import{u as useQuery}from"./query-7fhvqgVT.js";
import{S as Skeleton}from"./skeleton-7xRvmPlJ.js";
import{C as Card,c as CardContent}from"./card-jQ2tvwnD.js";
import{c as monthlyTrend,r as rankGroups}from"./orgLevel-DzZJ66Xo.js";
import{c as statsKpis,v as kbNilaiAkhir}from"./kpi-summary-Zero03.js";
import{P as PERSPECTIVES,n as normPerspective}from"./kpi-perspective-fFNWJAaz.js";
import{P as PageHeader}from"./PageHeader-DdzXL2rh.js";
import{R as ResponsiveContainer,T as Tooltip,L as Legend,B as Bar,C as Cell}from"./generateCategoricalChart-C0sokpAq.js";
import{B as BarChart}from"./BarChart-BOhpV_sO.js";
import{L as LineChart,C as CartesianGrid,a as Line}from"./LineChart-DZBwNciV.js";
import{X as XAxis,Y as YAxis}from"./YAxis-gvmD1SJ7.js";
import{P as PieChart,a as Pie}from"./PieChart-B8_1Ow04.js";
import"./vendor-CvVmYoZI.js";

const PERSPECTIVE_LABEL={
  financial:"Financial",
  customer:"Customer",
  internal_process:"Internal Bisnis Proses",
  learning_growth:"Learning & Growth/people"
};
const PERSPECTIVE_COLOR={
  financial:"#2563eb",
  customer:"#0ea5e9",
  internal_process:"#f59e0b",
  learning_growth:"#10b981"
};
const KANTOR_TYPES=new Set(["kck","kc","kcp","kk"]);
const SKIP_PIC=new Set(["from-individu-pemimpin","from-nilai-kantor-cabang"]);

function normUnit(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}
function unitType(k){
  return String(k&&k.unit_type||"").trim().toLowerCase();
}
function isDivisi(k){
  return unitType(k)==="divisi";
}
function isKantor(k){
  return KANTOR_TYPES.has(unitType(k));
}
function isIndividu(k){
  return unitType(k)==="pegawai"&&!SKIP_PIC.has(String(k&&k.pic||""));
}
function isKonsolidasi(k){
  const ut=unitType(k);
  return ut&&ut!=="master";
}
function rankOf(rows,keyFn){
  return rankGroups(rows,keyFn,1e4).slice().sort((a,b)=>(b.skor||0)-(a.skor||0)||(b.score||0)-(a.score||0)).map(a=>({
    ...a,
    klasifikasi:(kbNilaiAkhir(a.skor)||{}).kategori||"-"
  }));
}
function splitTopBottom(list){
  const top=list.slice(0,10);
  const bot=list.slice(-10).reverse();
  return{top,bot};
}
function fmtNum(t){
  const d=parseFloat(t);
  return Number.isNaN(d)||d<=0?"-":d.toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1});
}
function shortLabel(s,n=18){
  const t=String(s||"");
  return t.length>n?t.slice(0,n-1)+"…":t;
}
function toneOf(pred){
  if(pred==="Istimewa"||pred==="Sangat Baik")return"text-emerald-700";
  if(pred==="Baik")return"text-blue-700";
  if(/cukup/i.test(pred||""))return"text-amber-700";
  return"text-red-700";
}
function chartRows(list,nameOf){
  return(list||[]).map((a,i)=>({
    no:i+1,
    name:shortLabel(nameOf(a),16),
    full:nameOf(a),
    skor:Math.round((Number(a.skor)||0)*100)/100
  }));
}
function RealisasiTargetChart({title,data}){
  const has=Array.isArray(data)&&data.some(d=>d&&d.hasData);
  return e.jsxs("div",{className:"border rounded-lg p-3 min-w-0 bg-white",children:[
    e.jsx("p",{className:"text-xs font-semibold text-slate-700 mb-2",children:title}),
    e.jsx("div",{className:"h-56",children:!has?e.jsx("p",{className:"h-full flex items-center justify-center text-xs text-slate-400",children:"Belum ada data"}):e.jsx(ResponsiveContainer,{width:"100%",height:"100%",children:e.jsxs(LineChart,{data,margin:{top:8,right:12,left:-8,bottom:0},children:[
      e.jsx(CartesianGrid,{strokeDasharray:"3 3",className:"opacity-30"}),
      e.jsx(XAxis,{dataKey:"name",tick:{fontSize:11}}),
      e.jsx(YAxis,{tick:{fontSize:11},domain:[0,120],tickFormatter:v=>`${v}%`}),
      e.jsx(Tooltip,{formatter:(v,n)=>[`${Number(v).toFixed(1)}%`,n]}),
      e.jsx(Legend,{wrapperStyle:{fontSize:11}}),
      e.jsx(Line,{type:"monotone",dataKey:"realisasi",name:"Realisasi (%)",stroke:"#2563eb",strokeWidth:2.5,dot:{r:3},activeDot:{r:5}}),
      e.jsx(Line,{type:"monotone",dataKey:"target",name:"Target (%)",stroke:"#10b981",strokeWidth:2,strokeDasharray:"5 5",dot:!1})
    ]})})})
  ]});
}
function RankTable({title,rows,good,nameHeader,nameOf,subOf}){
  return e.jsxs("div",{className:"border rounded-lg overflow-hidden min-w-0 bg-white",children:[
    e.jsx("div",{className:cn("px-3 py-2 text-xs font-bold uppercase tracking-wide",good?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700"),children:title}),
    e.jsxs("table",{className:"w-full text-xs",children:[
      e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[
        e.jsx("th",{className:"text-left px-3 py-2 w-10",children:"No"}),
        e.jsx("th",{className:"text-left px-2 py-2",children:nameHeader}),
        e.jsx("th",{className:"text-right px-2 py-2",children:"Skor"}),
        e.jsx("th",{className:"text-left px-3 py-2",children:"Kategori"})
      ]})}),
      e.jsx("tbody",{children:rows.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:4,className:"px-3 py-8 text-center text-slate-400",children:"Belum ada data"})}):rows.map((a,i)=>e.jsxs("tr",{className:"border-t border-slate-100",children:[
        e.jsx("td",{className:"px-3 py-2 text-slate-500 tabular-nums align-top",children:i+1}),
        e.jsxs("td",{className:"px-2 py-2 align-top",children:[
          e.jsx("p",{className:"font-medium text-slate-800 leading-snug",children:nameOf(a)}),
          subOf?e.jsx("p",{className:"text-slate-500 leading-snug",style:{fontSize:10},children:subOf(a)}):null
        ]}),
        e.jsx("td",{className:cn("px-2 py-2 text-right font-bold tabular-nums align-top whitespace-nowrap",toneOf(a.klasifikasi)),children:a.skor>0?Number(a.skor).toFixed(2):"—"}),
        e.jsx("td",{className:"px-3 py-2 align-top text-slate-600",children:a.klasifikasi||"-"})
      ]},a.key))})
    ]})
  ]});
}
function RankBar({title,rows,good,nameOf}){
  const data=chartRows(rows,nameOf);
  const fill=good?"#059669":"#dc2626";
  return e.jsxs("div",{className:"border rounded-lg overflow-hidden min-w-0 bg-white",children:[
    e.jsx("div",{className:cn("px-3 py-2 text-xs font-bold uppercase tracking-wide",good?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700"),children:title+" — Grafik"}),
    e.jsx("div",{className:"h-72 px-2 py-2",children:data.length===0?e.jsx("p",{className:"h-full flex items-center justify-center text-xs text-slate-400",children:"Belum ada data"}):e.jsx(ResponsiveContainer,{width:"100%",height:"100%",children:e.jsxs(BarChart,{data,layout:"vertical",margin:{top:4,right:16,left:4,bottom:4},children:[
      e.jsx(CartesianGrid,{strokeDasharray:"3 3",className:"opacity-30"}),
      e.jsx(XAxis,{type:"number",tick:{fontSize:10},domain:[0,"auto"]}),
      e.jsx(YAxis,{type:"category",dataKey:"name",width:96,tick:{fontSize:10}}),
      e.jsx(Tooltip,{formatter:(v)=>[Number(v).toFixed(2),"Skor"],labelFormatter:(l,p)=>{var _a;return((_a=p&&p[0]&&p[0].payload)==null?void 0:_a.full)||l}}),
      e.jsx(Bar,{dataKey:"skor",name:"Skor",fill,radius:[0,4,4,0],barSize:14})
    ]})})})
  ]});
}
function RankPair({heading,topTitle,botTitle,ranked,nameHeader,nameOf,subOf,showCharts=!1}){
  const{top,bot}=splitTopBottom(ranked);
  return e.jsxs("section",{className:"space-y-3",children:[
    e.jsx("h2",{className:"text-sm font-bold uppercase tracking-wide text-slate-700",children:heading}),
    showCharts?e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-4",children:[
      e.jsx(RankBar,{title:topTitle,rows:top,good:!0,nameOf}),
      e.jsx(RankBar,{title:botTitle,rows:bot,good:!1,nameOf})
    ]}):null,
    e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-4",children:[
      e.jsx(RankTable,{title:topTitle,rows:top,good:!0,nameHeader,nameOf,subOf}),
      e.jsx(RankTable,{title:botTitle,rows:bot,good:!1,nameHeader,nameOf,subOf})
    ]})
  ]});
}

function DashboardOverview(){
  const{user}=useAuth();
  const isUser=(user==null?void 0:user.role)==="user";
  const{data:S=[],isLoading,dataUpdatedAt,refetch,isFetching}=useQuery({
    queryKey:["kpis","dashboard"],
    queryFn:()=>api.get("/kpis?fields=score")
  });
  const rows=React.useMemo(()=>{
    const list=Array.isArray(S)?S:[];
    if(!isUser||!user)return list;
    return list.filter(k=>k.jabatan===user.jabatan&&k.unit_name===user.unit_name);
  },[S,isUser,user]);
  const konsolRows=React.useMemo(()=>rows.filter(isKonsolidasi),[rows]);
  const divisiRows=React.useMemo(()=>rows.filter(isDivisi),[rows]);
  const kantorRows=React.useMemo(()=>rows.filter(isKantor),[rows]);
  const trendKonsol=React.useMemo(()=>monthlyTrend(konsolRows),[konsolRows]);
  const trendDivisi=React.useMemo(()=>monthlyTrend(divisiRows),[divisiRows]);
  const trendKantor=React.useMemo(()=>monthlyTrend(kantorRows),[kantorRows]);
  const divisiRank=React.useMemo(()=>{
    const src=divisiRows;
    const label=new Map;
    src.forEach(k=>{const n=normUnit(k.unit_name);if(n&&!label.has(n))label.set(n,k.unit_name)});
    return rankOf(src,k=>k.unit_name?normUnit(k.unit_name):null).map(a=>({...a,label:label.get(a.key)||a.key}));
  },[divisiRows]);
  const kantorRank=React.useMemo(()=>{
    const src=kantorRows;
    const label=new Map;
    src.forEach(k=>{const n=normUnit(k.unit_name);if(n&&!label.has(n))label.set(n,k.unit_name)});
    return rankOf(src,k=>k.unit_name?normUnit(k.unit_name):null).map(a=>({...a,label:label.get(a.key)||a.key}));
  },[kantorRows]);
  const individuRank=React.useMemo(()=>{
    const src=rows.filter(isIndividu);
    const meta=new Map;
    src.forEach(k=>{
      if(!k.unit_name||!k.jabatan)return;
      const key=[k.unit_name,k.jabatan].join("||");
      if(!meta.has(key))meta.set(key,{name:(k.pic&&!SKIP_PIC.has(String(k.pic))?k.pic:k.jabatan)||k.unit_name,jabatan:k.jabatan,unit:k.unit_name});
    });
    return rankOf(src,k=>k.unit_name&&k.jabatan?[k.unit_name,k.jabatan].join("||"):null).map(a=>({...a,...(meta.get(a.key)||{name:a.key,jabatan:"",unit:""})}));
  },[rows]);
  const perspectiveRows=React.useMemo(()=>PERSPECTIVES.map(key=>{
    const list=rows.filter(k=>normPerspective(k.perspective)===key);
    const stat=statsKpis(list);
    const bobot=list.reduce((sum,k)=>sum+(parseFloat(k.weight)||0),0);
    return{
      key,
      label:PERSPECTIVE_LABEL[key]||key,
      bobot,
      pencapaian:Math.round((stat.pencapaianTotal||0)*10)/10,
      skor:Math.round((stat.skorTotal||0)*10)/10,
      klasifikasi:stat.klasifikasi
    };
  }),[rows]);
  const pieData=React.useMemo(()=>perspectiveRows.filter(a=>a.pencapaian>0).map(a=>({name:a.label,value:a.pencapaian,key:a.key})),[perspectiveRows]);
  const perspBar=React.useMemo(()=>perspectiveRows.map(a=>({
    name:shortLabel(a.label,16),
    full:a.label,
    key:a.key,
    realisasi:a.pencapaian||0,
    target:a.pencapaian>0||a.bobot>0?100:0
  })),[perspectiveRows]);
  const trendByPersp=React.useMemo(()=>{
    const out={};
    for(const key of PERSPECTIVES){
      const list=rows.filter(k=>normPerspective(k.perspective)===key);
      out[key]=monthlyTrend(list);
    }
    return out;
  },[rows]);
  const overall=React.useMemo(()=>statsKpis(rows),[rows]);
  const updated=dataUpdatedAt?new Date(dataUpdatedAt).toLocaleString("id-ID",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";

  if(isLoading)return e.jsxs("div",{className:"space-y-4",children:[
    e.jsx(Skeleton,{className:"h-10 w-96"}),
    e.jsx(Skeleton,{className:"h-64 rounded-lg"}),
    e.jsx(Skeleton,{className:"h-64 rounded-lg"}),
    e.jsx(Skeleton,{className:"h-64 rounded-lg"})
  ]});

  return e.jsxs("div",{className:"space-y-6 pb-6",children:[
    e.jsx(PageHeader,{
      eyebrow:"Dashboard",
      title:"Dashboard Overview",
      subtitle:"Realisasi vs target per 4 perspektif, konsolidasi/divisi/kantor unit, dan ranking 10 terbaik/terburuk.",
      actions:e.jsxs("button",{type:"button",onClick:()=>refetch(),className:"h-9 px-3 rounded-md border bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 text-sm",children:[
        e.jsx(RefreshIcon,{className:cn("w-3.5 h-3.5",isFetching&&"animate-spin")}),
        "Refresh"
      ]})
    }),
    e.jsxs(Card,{className:"border shadow-sm",children:[
      e.jsx("div",{className:"px-4 sm:px-5 pt-4 pb-2",children:e.jsx("h2",{className:"text-sm font-bold uppercase tracking-wide text-slate-700",children:"Pencapaian Perspektif"})}),
      e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-12 gap-4 px-4 sm:px-5 pb-4",children:[
        e.jsxs("div",{className:"xl:col-span-4 border rounded-lg p-3",children:[
          e.jsx("p",{className:"text-xs font-semibold text-slate-600 mb-2",children:"Komposisi Pencapaian (%)"}),
          e.jsx("div",{className:"h-56 relative",children:pieData.length===0?e.jsx("p",{className:"absolute inset-0 flex items-center justify-center text-xs text-slate-400",children:"Belum ada data"}):e.jsxs(e.Fragment,{children:[
            e.jsx(ResponsiveContainer,{width:"100%",height:"100%",children:e.jsxs(PieChart,{children:[
              e.jsx(Pie,{data:pieData,dataKey:"value",nameKey:"name",innerRadius:48,outerRadius:72,paddingAngle:2,children:pieData.map(a=>e.jsx(Cell,{fill:PERSPECTIVE_COLOR[a.key]||"#94a3b8"},a.key))}),
              e.jsx(Tooltip,{formatter:(v)=>[`${Number(v).toFixed(1)}%`,"Pencapaian"]}),
              e.jsx(Legend,{wrapperStyle:{fontSize:11}})
            ]})}),
            e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none",children:e.jsxs("div",{className:"text-center",children:[
              e.jsx("p",{className:"text-lg font-bold text-slate-800",children:fmtNum(overall.pencapaianTotal)}),
              e.jsx("p",{className:"text-[9px] text-slate-500 uppercase",children:"%"})
            ]})})
          ]})})
        ]}),
        e.jsxs("div",{className:"xl:col-span-8 border rounded-lg p-3",children:[
          e.jsx("p",{className:"text-xs font-semibold text-slate-700 mb-2",children:"Realisasi vs Target — 4 Perspektif"}),
          e.jsx("div",{className:"h-56",children:e.jsx(ResponsiveContainer,{width:"100%",height:"100%",children:e.jsxs(BarChart,{data:perspBar,margin:{top:8,right:12,left:0,bottom:4},children:[
            e.jsx(CartesianGrid,{strokeDasharray:"3 3",className:"opacity-30"}),
            e.jsx(XAxis,{dataKey:"name",tick:{fontSize:11}}),
            e.jsx(YAxis,{tick:{fontSize:11},domain:[0,120],tickFormatter:v=>`${v}%`}),
            e.jsx(Tooltip,{formatter:(v,n)=>[`${Number(v).toFixed(1)}%`,n],labelFormatter:(l,p)=>{var _a;return((_a=p&&p[0]&&p[0].payload)==null?void 0:_a.full)||l}}),
            e.jsx(Legend,{wrapperStyle:{fontSize:11}}),
            e.jsx(Bar,{dataKey:"realisasi",name:"Realisasi (%)",fill:"#2563eb",radius:[4,4,0,0],barSize:28}),
            e.jsx(Bar,{dataKey:"target",name:"Target (%)",fill:"#10b981",radius:[4,4,0,0],barSize:28})
          ]})})})
        ]})
      ]}),
      e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3 px-4 sm:px-5 pb-4",children:PERSPECTIVES.map(key=>e.jsx(RealisasiTargetChart,{
        title:`Realisasi vs Target — ${PERSPECTIVE_LABEL[key]||key}`,
        data:trendByPersp[key]||[]
      },key))}),
      e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-3 gap-3 px-4 sm:px-5 pb-4",children:[
        e.jsx(RealisasiTargetChart,{title:"Total Realisasi vs Target — Konsolidasi",data:trendKonsol}),
        e.jsx(RealisasiTargetChart,{title:"Total Realisasi vs Target — Divisi",data:trendDivisi}),
        e.jsx(RealisasiTargetChart,{title:"Total Realisasi vs Target — Kantor Unit",data:trendKantor})
      ]}),
      e.jsx(CardContent,{className:"p-0 overflow-x-auto border-t",children:e.jsxs("table",{className:"w-full text-xs",children:[
        e.jsx("thead",{className:"bg-slate-50 text-slate-500",children:e.jsxs("tr",{children:[
          e.jsx("th",{className:"text-left px-4 py-2",children:"Perspektif"}),
          e.jsx("th",{className:"text-right px-2 py-2",children:"Bobot"}),
          e.jsx("th",{className:"text-right px-2 py-2",children:"Pencapaian"}),
          e.jsx("th",{className:"text-right px-2 py-2",children:"Skor"}),
          e.jsx("th",{className:"text-left px-4 py-2",children:"Klasifikasi"})
        ]})}),
        e.jsx("tbody",{children:perspectiveRows.map(a=>e.jsxs("tr",{className:"border-t border-slate-100",children:[
          e.jsxs("td",{className:"px-4 py-2 font-medium text-slate-800",children:[
            e.jsx("span",{className:"inline-block w-2 h-2 rounded-full mr-2 align-middle",style:{background:PERSPECTIVE_COLOR[a.key]}}),
            a.label
          ]}),
          e.jsx("td",{className:"px-2 py-2 text-right tabular-nums",children:fmtNum(a.bobot)}),
          e.jsxs("td",{className:"px-2 py-2 text-right tabular-nums font-semibold",children:[fmtNum(a.pencapaian),"%"]}),
          e.jsx("td",{className:"px-2 py-2 text-right tabular-nums",children:fmtNum(a.skor)}),
          e.jsx("td",{className:cn("px-4 py-2",toneOf(a.klasifikasi)),children:a.klasifikasi&&a.klasifikasi!=="-"?a.klasifikasi:"-"})
        ]},a.key))})
      ]})})
    ]}),
    e.jsx(Card,{className:"border shadow-sm",children:e.jsxs(CardContent,{className:"p-4 sm:p-5 space-y-8",children:[
      e.jsx(RankPair,{
        heading:"Pencapaian 10 Top Unit Divisi terbaik dan terburuk",
        topTitle:"10 Unit Divisi Terbaik",
        botTitle:"10 Unit Divisi Terburuk",
        ranked:divisiRank,
        nameHeader:"Unit Divisi",
        nameOf:a=>a.label||a.key,
        showCharts:!1
      }),
      e.jsx(RankPair,{
        heading:"Pencapaian 10 Top Unit Kantor terbaik dan terburuk",
        topTitle:"10 Unit Kantor Terbaik",
        botTitle:"10 Unit Kantor Terburuk",
        ranked:kantorRank,
        nameHeader:"Unit Kantor",
        nameOf:a=>a.label||a.key,
        showCharts:!1
      }),
      e.jsx(RankPair,{
        heading:"Pencapaian 10 Top KPI Individu terbaik dan terburuk",
        topTitle:"10 KPI Individu Terbaik",
        botTitle:"10 KPI Individu Terburuk",
        ranked:individuRank,
        nameHeader:"Pegawai / Jabatan / Unit",
        nameOf:a=>a.name||"—",
        subOf:a=>[a.jabatan,a.unit].filter(Boolean).join(" · "),
        showCharts:!0
      })
    ]})}),
    e.jsxs("p",{className:"text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5",children:[
      e.jsx(RefreshIcon,{className:"w-3 h-3"}),"Data terakhir diperbarui: ",updated," WIB"
    ]})
  ]});
}

export{DashboardOverview as default};
