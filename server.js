const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SPOTS, LIVE_FINDS } = require("./data.cjs");

const PORT = Number(process.env.PORT || 8081);
const ROOT = __dirname;
const users = new Map();
const sessions = new Map();
const groups = new Map();
const discoveries = new Map();

[...SPOTS, ...LIVE_FINDS].forEach(s => discoveries.set(s.id, {
  ...s,
  createdBy: s.friend ? "nearby explorer" : "Leftovers",
  createdAt: Date.now() - (s.live ? 2 * 60000 : 60 * 60000),
  category: s.tags?.includes("museum") ? "events" : s.tags?.includes("coffee") ? "food" : "things"
}));

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json" };
function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization"});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>1e6)req.destroy()});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error("Invalid JSON"))}});req.on("error",reject)})}
function token(){return crypto.randomBytes(24).toString("hex")}
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
function hash(p){return crypto.createHash("sha256").update(String(p)).digest("hex")}
function userFrom(req){const h=req.headers.authorization||"";return sessions.get(h.startsWith("Bearer ")?h.slice(7):"")}
function safeGroup(g){return {code:g.code,createdBy:g.createdBy,members:[...g.members.values()].map(m=>({username:m.username,budget:m.budget})),votes:Object.fromEntries([...g.votes].map(([u,v])=>[u,Object.fromEntries(v)])),customSpots:g.customSpots||[]}}
function voteCounts(g){const counts={};for(const choices of g.votes.values())for(const [id,like] of choices)if(like)counts[id]=(counts[id]||0)+1;return counts}
function getMajority(g){const counts=voteCounts(g),threshold=Math.floor(g.members.size/2)+1;const winner=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return winner&&winner[1]>=threshold?{id:winner[0],votes:winner[1],threshold,name:getSpot(g,winner[0])?.name||winner[0]}:null}
function getSpot(g,id){return SPOTS.find(s=>s.id===id)||g.customSpots.find(s=>s.id===id)||discoveries.get(id)}
function sendError(res,e){json(res,400,{error:e.message||"Something went wrong"})}

async function route(req,res){
  const u=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});return res.end()}
  if(u.pathname.startsWith("/api/"))try{
    if(req.method==="POST"&&u.pathname==="/api/signup"){const d=await body(req),name=String(d.username||"").trim(),key=name.toLowerCase();if(!/^[a-zA-Z0-9_.-]{2,24}$/.test(name))throw Error("Username must be 2–24 letters, numbers, _, . or -.");if(String(d.password||"").length<4)throw Error("Password must be at least 4 characters.");if(users.has(key))throw Error("That username already exists.");users.set(key,{username:name,password:hash(d.password)});const t=token();sessions.set(t,key);return json(res,201,{token:t,username:name})}
    if(req.method==="POST"&&u.pathname==="/api/login"){const d=await body(req),key=String(d.username||"").toLowerCase(),usr=users.get(key);if(!usr||usr.password!==hash(d.password))throw Error("Incorrect username or password.");const t=token();sessions.set(t,key);return json(res,200,{token:t,username:usr.username})}
    const me=userFrom(req);if(!me)return json(res,401,{error:"Please log in."});
    if(req.method==="POST"&&u.pathname==="/api/groups"){let c=code();while(groups.has(c))c=code();const g={code:c,createdBy:me,members:new Map([[me,{username:users.get(me).username,budget:null}]]),votes:new Map(),customSpots:[]};groups.set(c,g);return json(res,201,{group:safeGroup(g)})}
    const join=u.pathname.match(/^\/api\/groups\/([^/]+)\/join$/);if(req.method==="POST"&&join){const c=join[1].toUpperCase(),g=groups.get(c);if(!g)throw Error("Group not found.");if(g.members.size>=12&&!g.members.has(me))throw Error("This group is full.");if(!g.members.has(me))g.members.set(me,{username:users.get(me).username,budget:null});return json(res,200,{group:safeGroup(g)})}
    const gm=u.pathname.match(/^\/api\/groups\/([^/]+)$/);if(gm){const c=gm[1].toUpperCase(),g=groups.get(c);if(!g||!g.members.has(me))throw Error("Group not found.");if(req.method==="GET")return json(res,200,{group:safeGroup(g)})}
    const bm=u.pathname.match(/^\/api\/groups\/([^/]+)\/budget$/);if(req.method==="POST"&&bm){const g=groups.get(bm[1].toUpperCase());if(!g||!g.members.has(me))throw Error("Group not found.");const d=await body(req),n=Number(d.budget);if(!Number.isFinite(n)||n<0||n>10000)throw Error("Budget must be between $0 and $10,000.");g.members.get(me).budget=Math.round(n*100)/100;return json(res,200,{group:safeGroup(g)})}
    const sm=u.pathname.match(/^\/api\/groups\/([^/]+)\/spots$/);if(req.method==="POST"&&sm){const g=groups.get(sm[1].toUpperCase());if(!g||!g.members.has(me))throw Error("Group not found.");const d=await body(req),name=String(d.name||"").trim(),cost=Number(d.cost),walk=Number(d.walk);if(!name||name.length>60)throw Error("Give the activity a name.");if(!Number.isFinite(cost)||cost<0||cost>10000)throw Error("Cost must be between $0 and $10,000.");if(!Number.isFinite(walk)||walk<0||walk>999)throw Error("Distance must be 0–999 minutes.");const item={id:"custom-"+crypto.randomBytes(5).toString("hex"),name,cost:Math.round(cost*100)/100,walk:Math.round(walk),blurb:String(d.blurb||"Added by the group.").slice(0,180),tags:[],leftoverOf:"group idea",friend:true,custom:true};g.customSpots.push(item);return json(res,201,{group:safeGroup(g)})}
    const vm=u.pathname.match(/^\/api\/groups\/([^/]+)\/vote$/);if(req.method==="POST"&&vm){const g=groups.get(vm[1].toUpperCase());if(!g||!g.members.has(me))throw Error("Group not found.");const d=await body(req),id=String(d.spotId||"");if(!id)throw Error("Missing activity.");if(!getSpot(g,id))throw Error("Activity not found.");if(!g.votes.has(me))g.votes.set(me,new Map());g.votes.get(me).set(id,Boolean(d.like));return json(res,200,{group:safeGroup(g),match:getMajority(g),voteCount:g.votes.get(me)?.size||0})}
    if(req.method==="GET"&&u.pathname==="/api/discoveries"){const usr=users.get(me);return json(res,200,{discoveries:[...discoveries.values()].sort((a,b)=>b.createdAt-a.createdAt),saved:usr.saved?[...usr.saved]:[]})}
    const ds=u.pathname.match(/^\/api\/discoveries\/([^/]+)\/save$/);if(req.method==="POST"&&ds){const id=decodeURIComponent(ds[1]);if(!discoveries.has(id))throw Error("Discovery not found.");const d=await body(req),usr=users.get(me);if(!usr.saved)usr.saved=new Set();d.saved?usr.saved.add(id):usr.saved.delete(id);return json(res,200,{saved:[...usr.saved]})}
    if(req.method==="POST"&&u.pathname==="/api/discoveries"){const d=await body(req),name=String(d.name||"").trim(),cost=Number(d.cost||0),walk=Number(d.distance||5);if(!name||name.length>70)throw Error("Give your discovery a short name.");if(!Number.isFinite(cost)||cost<0||cost>10000)throw Error("Cost must be between 0 and 10,000.");if(!Number.isFinite(walk)||walk<0||walk>999)throw Error("Distance must be between 0 and 999 minutes.");const item={id:"find-"+crypto.randomBytes(6).toString("hex"),name,blurb:String(d.blurb||"Shared by a nearby explorer.").slice(0,220),tags:[],cost,walk,friend:true,live:true,createdBy:users.get(me).username,createdAt:Date.now(),category:String(d.category||"things")};discoveries.set(item.id,item);return json(res,201,{discovery:item})}
    return json(res,404,{error:"API route not found."});
  }catch(e){return sendError(res,e)}
  let file=u.pathname==="/"?"/index.html":decodeURIComponent(u.pathname);if(file.includes(".."))return json(res,400,{error:"Bad path"});const fp=path.join(ROOT,file);fs.readFile(fp,(err,data)=>{if(err){if(file!=="/index.html")return fs.readFile(path.join(ROOT,"index.html"),(e,d)=>e?json(res,404,{error:"Not found"}):sendFile(res,d,".html"));return json(res,404,{error:"Not found"})}sendFile(res,data,path.extname(fp))})
}
function sendFile(res,data,ext){res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data)}
http.createServer((req,res)=>route(req,res).catch(e=>sendError(res,e))).listen(PORT,"0.0.0.0",()=>console.log(`Leftovers running at http://127.0.0.1:${PORT}`));
