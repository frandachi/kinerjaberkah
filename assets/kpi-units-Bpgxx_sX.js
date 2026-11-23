const u=[{value:"percentage",label:"% (Persentase)"},{value:"currency",label:"Juta Rupiah"},{value:"score",label:"Indeks (Skor)"},{value:"number",label:"Angka"}];
function a(n){
  if(["percentage","currency","score","number"].includes(n))return n;
  const e=(n||"").toLowerCase();
  if(e==="%"||e.includes("persen")||e.includes("percent"))return"percentage";
  if(e.includes("rp")||e.includes("rupiah")||e.includes("juta"))return"currency";
  if(e.includes("peringkat"))return"number";
  if(e==="indeks"||e.includes("skor")||(e.includes("indeks")&&!e.includes("peringkat")))return"score";
  if(e.includes("angka")||e.includes("bilangan")||e.includes("jumlah")||e.includes("hari")||e.includes("kasus")||e.includes("rekening")||e.includes("account")||e.includes("program")||e.includes("analisa")||e.includes("kali")||e.includes("orang"))return"number";
  return"percentage";
}
function c(n){
  if(n==null||n==="")return"-";
  const raw=String(n).trim();
  if(["percentage","currency","score","number"].includes(raw)){
    const e=u.find(r=>r.value===raw);
    return(e==null?void 0:e.label)??raw;
  }
  // Label master (Peringkat, Juta Rupiah, …) tampil apa adanya
  return raw;
}
export{u as U,c as g,a as n};
