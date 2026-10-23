import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:administrativo@triogerasom.com.br";
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") || "https://nathaliacarolaye.vercel.app";
const allowed = new Set(["juniotaylon0401@gmail.com", "eu15933220620@gmail.com"]);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function spNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` };
}
function daysInMonth(y: number, m: number) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function occurs(rec: any, date: string) {
  if (!rec?.start || date < rec.start || (rec.end && date > rec.end)) return false;
  const [y,m,d] = date.split("-").map(Number), [sy,sm,sd] = rec.start.split("-").map(Number);
  if (rec.freq === "w") {
    const a = Date.UTC(y,m-1,d), b = Date.UTC(sy,sm-1,sd);
    return Math.round((a-b)/86400000) % 7 === 0;
  }
  const target = Math.min(sd, daysInMonth(y,m));
  if (d !== target) return false;
  if (rec.freq === "m") return true;
  if (rec.freq === "a") return m === sm;
  return false;
}
function money(v:number){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
}
function walletLabel(state:any, x:any){
  const k=x?.walletKey||"";
  if(k==="cash") return "Dinheiro em mãos";
  if(k.startsWith("acc:")){
    const a=(state.acc||[]).find((v:any)=>v.id===k.slice(4));
    return a?`Conta ${a.name}`:"Conta bancária";
  }
  if(k.startsWith("vr:")){
    const v=(state.vr||[]).find((v:any)=>v.id===k.slice(3));
    return v?`VR ${v.brand}${v.nick?` · ${v.nick}`:""}`:"Vale-refeição";
  }
  return "Origem não informada";
}
function dueExpenses(state:any,date:string){
  const out:any[]=[];
  for(const x of state.tx||[]) if(x.type==="out" && x.date===date) out.push({...x,_payKey:`${x.id}|${date}`});
  for(const r of state.rec||[]) if(r.type==="out" && occurs(r,date)) out.push({...r,date,id:`r${r.id}`,rec:1,_payKey:`r${r.id}|${date}`});
  return out.filter(x=>!state.pd?.[x._payKey]);
}
async function sendAll(payload:any){
  const { data: subs, error } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  if (error) throw error;
  let sent=0;
  const seen=new Set<string>();
  for (const s of subs||[]) {
    if(seen.has(s.endpoint)) continue;
    seen.add(s.endpoint);
    try {
      await webpush.sendNotification(
        {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
        JSON.stringify(payload),
        { TTL: 3600 }
      );
      sent++;
    } catch (e:any) {
      const status=e?.statusCode||e?.status;
      if(status===404||status===410) await admin.from("push_subscriptions").delete().eq("id",s.id);
      else console.error("push",status,e?.message||e);
    }
  }
  return sent;
}
async function authUser(req:Request){
  const h=req.headers.get("authorization")||"";
  const token=h.replace(/^Bearer\s+/i,"");
  if(!token)return null;
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data.user)return null;
  const email=(data.user.email||"").toLowerCase();
  return allowed.has(email)?data.user:null;
}

Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"method"},405);
  let body:any={};
  try{body=await req.json()}catch{}

  if(body.mode==="vapid-key"){ return json({publicKey:VAPID_PUBLIC_KEY}); }\n\n  if(body.mode==="broadcast"){
    const user=await authUser(req);
    if(!user)return json({error:"unauthorized"},401);
    const rawUrl=String(body.url||"");
    const targetUrl=rawUrl.startsWith("http")
      ? rawUrl
      : `${APP_URL}/${rawUrl.replace(/^\.\/?/,"").replace(/^\//,"")}`;
    const payload={
      title:body.title||"Casa & Obra",
      body:body.body||"Nova atualização",
      url:targetUrl||`${APP_URL}/?tab=home`,
      tag:`activity-${Date.now()}`,
      renotify:true
    };
    return json({ok:true,sent:await sendAll(payload)});
  }

  if(body.mode==="due"){
    if(req.headers.get("x-cron-secret")!==CRON_SECRET)return json({error:"forbidden"},403);
    const {date,time}=spNow();
    const slots=["08:20","09:50","11:20","12:50","14:20","15:50","17:20","18:50","20:20","21:50","23:20"];
    const nowMin=Number(time.slice(0,2))*60+Number(time.slice(3,5));
    const slot=slots.find(s=>{const m=Number(s.slice(0,2))*60+Number(s.slice(3,5));return nowMin>=m&&nowMin<m+15});
    if(!slot)return json({ok:true,skipped:true,date,time});
    const dedupe=`due:${date}:${slot}`;
    const {error:logErr}=await admin.from("notification_dispatch_log").insert({dedupe_key:dedupe});
    if(logErr?.code==="23505")return json({ok:true,duplicate:true});
    if(logErr)throw logErr;

    const {data:row,error}=await admin.from("app_state").select("data").eq("id","casa-obra-shared").maybeSingle();
    if(error)throw error;
    const state=row?.data||{}, due=dueExpenses(state,date);
    if(!due.length)return json({ok:true,sent:0});

    const total=due.reduce((t:number,x:any)=>t+Number(x.val||0),0);
    const sample=due.slice(0,3).map((x:any)=>`${x.desc} (${walletLabel(state,x)})`).join(" · ");
    const payload={
      title:`${due.length} despesa${due.length>1?"s":""} pendente${due.length>1?"s":""}`,
      body:`${money(total)} vencendo hoje · ${sample}${due.length>3?" · …":""}`,
      url:`${APP_URL}/?tab=home`,
      tag:`due-${date}-${slot}`,
      renotify:true
    };
    return json({ok:true,sent:await sendAll(payload),count:due.length,total});
  }

  return json({error:"invalid_mode"},400);
});
