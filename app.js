import { BUDGETS, CATEGORIES, LIVE_FINDS, SPOTS } from "./data.js";

const API = "/api";
const ROUND_SECS = 30;
const APP_VERSION = "4.0 — original planner restored";
const STORE = {
  token: "leftovers:token",
  user: "leftovers:user",
  saved: (u) => `leftovers:saved:${u}`,
  anti: (u) => `leftovers:anti:${u}`,
};

const state = {
  token: localStorage.getItem(STORE.token) || "",
  user: localStorage.getItem(STORE.user) || "",
  screen: "home",
  profileTab: "saved",
  group: null,
  groupCode: "",
  cardIndex: 0,
  roundStarted: false,
  poller: null,
  pointer: null,
  location: null,
  budgetReaction: false,
  swipeAnimating: false,
  discoveries: [], discoverySaved: [], discoveryTimer: null, exploreFilter: "all",
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

function list(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveList(key, ids) {
  localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
}
function saved() { return list(STORE.saved(state.user)); }
function anti() { return list(STORE.anti(state.user)); }

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.hidden = false; el.textContent = msg;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3500);
}

function audioContext(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;try{const c=new C();if(c.state==="suspended")c.resume();return c;}catch{return null;}}
function kaChing(){const c=audioContext();if(!c)return;const n=c.currentTime;[0,.11,.23].forEach((d,i)=>{const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=[880,1175,1760][i];g.gain.setValueAtTime(.0001,n+d);g.gain.exponentialRampToValueAtTime(.18,n+d+.015);g.gain.exponentialRampToValueAtTime(.0001,n+d+.18);o.connect(g);g.connect(c.destination);o.start(n+d);o.stop(n+d+.2);});}
function swoosh(like){const c=audioContext();if(!c)return;const o=c.createOscillator(),g=c.createGain(),n=c.currentTime;o.type="triangle";o.frequency.setValueAtTime(like?420:300,n);o.frequency.exponentialRampToValueAtTime(like?1050:140,n+.18);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.12,n+.02);g.gain.exponentialRampToValueAtTime(.0001,n+.2);o.connect(g);g.connect(c.destination);o.start(n);o.stop(n+.22);}

function getPlace(id) { return SPOTS.find(s => s.id === id) || LIVE_FINDS.find(s => s.id === id) || state.discoveries.find(s => s.id === id) || (state.group?.customSpots || []).find(s => s.id === id); }

function render() {
  if (!state.token) return renderAuth();
  if (state.screen === "group") return renderGroup();
  if (state.screen === "budget") return renderBudget();
  if (state.screen === "swipe") return renderSwipe();
  if (state.screen === "results") return renderResults();
  if (state.screen === "profile") return renderProfile();
  if (state.screen === "explore") return renderExplore();
  renderHome();
}

function renderAuth() {
  $("app").innerHTML = `
    <main class="auth-wrap">
      <section class="gate-card">
        <div class="logo">Left<span>overs</span></div>
        <p class="eyebrow">GROUP HANGOUT PLANNER</p>
        <h1>Stop arguing. Start swiping.</h1>
        <p class="lead">Make a group, add everyone's day budget, swipe on activities, and let the majority pick the plan.</p>
        <div class="auth-tabs">
          <button class="auth-tab active" data-auth="login">Log in</button>
          <button class="auth-tab" data-auth="signup">Sign up</button>
        </div>
        <form id="auth-form">
          <label>Username<input id="username" autocomplete="username" maxlength="24" required placeholder="your username"></label>
          <label>Password<input id="password" type="password" autocomplete="current-password" minlength="4" required placeholder="4+ characters"></label>
          <button class="cta" type="submit"><span id="auth-action">Log in</span></button>
        </form>
        <p class="tiny">Local demo account. Don't use a real password here.</p><p class="tiny">v4 · original planner restored</p>
      </section>
    </main>`;
  let mode = "login";
  document.querySelectorAll("[data-auth]").forEach(b => b.onclick = () => {
    mode = b.dataset.auth;
    document.querySelectorAll("[data-auth]").forEach(x => x.classList.toggle("active", x === b));
    $("auth-action").textContent = mode === "login" ? "Log in" : "Create account";
  });
  $("auth-form").onsubmit = async e => {
    e.preventDefault();
    const username = $("username").value.trim(), password = $("password").value;
    try {
      const d = await api(mode === "login" ? "/login" : "/signup", {
        method:"POST", body: JSON.stringify({ username, password })
      });
      state.token = d.token; state.user = d.username;
      localStorage.setItem(STORE.token, state.token);
      localStorage.setItem(STORE.user, state.user);
      render();
    } catch (err) { toast(err.message); }
  };
}

function header(active = "home") {
  return `<header class="topbar">
    <button class="wordmark" data-nav="home">Left<span>overs</span></button>
    <nav>
      <button data-nav="explore" class="${active==="explore"?"active":""}">Explore</button>
      ${state.group ? `<button data-nav="group" class="${active==="group"?"active":""}">Group</button>` : ""}
      <button data-nav="home" class="${active==="home"?"active":""}">Plan</button>
      <button data-nav="profile" class="${active==="profile"?"active":""}">Profile</button>
    </nav>
    <button class="avatar" data-nav="profile">${esc(state.user.slice(0,1).toUpperCase())}</button>
  </header>`;
}

function wireNav() {
  document.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => {
    state.screen = b.dataset.nav; render();
  });
}


function discoveryCacheKey(){return `leftovers:discoveries:${state.user}`;}
function loadDiscoveryCache(){try{const d=JSON.parse(localStorage.getItem(discoveryCacheKey())||"null");if(d){state.discoveries=d.discoveries||[];state.discoverySaved=d.saved||[];}}catch{}}
function saveDiscoveryCache(){try{localStorage.setItem(discoveryCacheKey(),JSON.stringify({discoveries:state.discoveries,saved:state.discoverySaved}));}catch{}}
function ago(ts){const m=Math.max(0,Math.floor((Date.now()-Number(ts||Date.now()))/60000));return m<1?"just now":m===1?"1 min ago":`${m} min ago`;}
function discoveryCard(s){const yes=state.discoverySaved.includes(s.id);return `<article class="find-card"><div class="find-art">${iconFor(s)}${s.live?'<span class="live-badge">LIVE</span>':''}</div><div class="find-copy"><div class="card-meta">${esc(s.category||"thing")} · ${s.walk} min away · ${ago(s.createdAt)}</div><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p><div class="find-bottom"><span class="price">${Number(s.cost)?'$'+s.cost:'FREE'}</span><span class="found-by">${s.friend?'✦ '+esc(s.createdBy||'nearby explorer'):'Leftovers pick'}</span><button class="save-btn ${yes?'saved':''}" data-discovery-save="${esc(s.id)}">${yes?'★':'☆'}</button></div></div></article>`;}
async function syncDiscoveries(){if(!state.token)return;try{const d=await api('/discoveries');state.discoveries=d.discoveries||[];state.discoverySaved=d.saved||[];saveDiscoveryCache();}catch{loadDiscoveryCache();}}
function startDiscoveryPolling(){stopDiscoveryPolling();if(!navigator.onLine)return;state.discoveryTimer=setInterval(async()=>{if(state.screen!=="explore")return;const before=new Set(state.discoveries.map(x=>x.id));await syncDiscoveries();const fresh=state.discoveries.find(x=>!before.has(x.id));if(fresh&&fresh.createdBy!==state.user){toast('✦ New nearby find: '+fresh.name);swoosh(true);}render();},4000);}
function stopDiscoveryPolling(){clearInterval(state.discoveryTimer);state.discoveryTimer=null;}
function renderExplore(){loadDiscoveryCache();const list=state.discoveries.filter(x=>state.exploreFilter==='all'||x.category===state.exploreFilter);$('app').innerHTML=`<div class="shell">${header('explore')}<section class="hero"><p class="eyebrow">${navigator.onLine?'● LIVE NOW':'○ OFFLINE MODE'}</p><h1>What's good<br>around here?</h1><p>${navigator.onLine?'Fresh finds, food, events and little discoveries.':'Browsing your last synced feed.'}</p></section>${navigator.onLine?'':'<div class="offline-bar">OFFLINE · cached feed + saved spots still work</div>'}<div class="filters">${['all','food','events','things'].map(x=>`<button class="${state.exploreFilter===x?'on':''}" data-filter="${x}">${x}</button>`).join('')}</div><section class="feed-head"><div><p class="eyebrow">NEARBY FEED</p><h2>${list.length} things to do</h2></div><button class="add-find" id="add-find">＋</button></section><section class="feed">${list.map(discoveryCard).join('')||'<div class="empty-state"><h2>Nothing here yet.</h2><p>Add the first find.</p></div>'}</section><p class="sync-note">${list.length?'Live discoveries update automatically.':'Seeded nearby discoveries will appear here.'}</p></div>`;wireNav();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.exploreFilter=b.dataset.filter;render()});document.querySelectorAll('[data-discovery-save]').forEach(b=>b.onclick=()=>toggleDiscovery(b.dataset.discoverySave));$('add-find').onclick=showDiscoveryModal;startDiscoveryPolling();}
async function toggleDiscovery(id){const yes=!state.discoverySaved.includes(id);state.discoverySaved=yes?[...state.discoverySaved,id]:state.discoverySaved.filter(x=>x!==id);saveDiscoveryCache();render();if(navigator.onLine)try{await api(`/discoveries/${encodeURIComponent(id)}/save`,{method:'POST',body:JSON.stringify({saved:yes})})}catch{toast('Saved locally; sync will retry later.')}else toast(yes?'Saved offline.':'Removed from saved.');}
function showDiscoveryModal(){document.getElementById('discovery-modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="discovery-modal"><section class="add-modal"><button class="modal-close" id="close-discovery">×</button><p class="eyebrow">SHARE A FIND</p><h2>What's cool right now?</h2><label>Place / event / thing<input id="dn" maxlength="70" placeholder="pop-up food market"></label><label>Cost per person<input id="dc" type="number" min="0" value="0"></label><label>Distance in minutes<input id="dw" type="number" min="0" value="5"></label><label>Why go?<textarea id="db" maxlength="220" placeholder="Tell the group why it's worth going."></textarea></label><button class="cta" id="post-discovery">Post find</button></section></div>`);$('close-discovery').onclick=()=>$('discovery-modal').remove();$('post-discovery').onclick=async()=>{if(!navigator.onLine)return toast('Reconnect to post a live find.');try{const d=await api('/discoveries',{method:'POST',body:JSON.stringify({name:$('dn').value.trim(),cost:Number($('dc').value),distance:Number($('dw').value),blurb:$('db').value.trim(),category:'things'})});state.discoveries.unshift(d.discovery);saveDiscoveryCache();$('discovery-modal').remove();swoosh(true);toast('Your find is live!');render();}catch(e){toast(e.message)}};}

function renderHome() {
  $("app").innerHTML = `<div class="shell">${header("home")}
    <section class="hero">
      <p class="eyebrow">YOUR HANGOUT, SORTED</p>
      <h1>Where should we go?</h1>
      <p>Everyone brings a budget. Everyone gets a vote. Nobody has to make the decision alone.</p>
    </section>
    <section class="panel action-panel">
      <div class="action-icon">✦</div>
      <div><h2>Create a group</h2><p>Start a hangout and share its code with your friends.</p></div>
      <button class="solid" id="create-group">Create</button>
    </section>
    <section class="panel action-panel">
      <div class="action-icon">↗</div>
      <div><h2>Join a group</h2><p>Enter the code your friend gave you.</p></div>
      <button class="solid" id="show-join">Join</button>
    </section>
    <div id="join-area" hidden class="join-area">
      <input id="join-code" maxlength="6" placeholder="GROUP CODE" autocapitalize="characters">
      <button class="cta" id="join-group">Join group</button>
    </div>
    <section class="panel action-panel"><div class="action-icon">✦</div><div><h2>Explore nearby</h2><p>See live-ish finds from other explorers, even with spotty signal.</p></div><button class="solid" id="explore-now">Explore</button></section>
    <section class="how">
      <div><b>01</b><span>Budget</span><small>Add your max for the day.</small></div>
      <div><b>02</b><span>Swipe</span><small>Right = like, left = pass.</small></div>
      <div><b>03</b><span>Match</span><small>Majority decides the plan.</small></div>
    </section>
  </div>`;
  wireNav();
  $("explore-now").onclick = () => { state.screen="explore"; syncDiscoveries().then(render); };
  $("create-group").onclick = async () => {
    try {
      const d = await api("/groups", {method:"POST", body:JSON.stringify({})});
      state.groupCode = d.code; state.group = d.group; state.screen = "group"; startPolling(); render();
    } catch(e) { toast(e.message); }
  };
  $("show-join").onclick = () => { $("join-area").hidden = false; $("join-code").focus(); };
  $("join-group").onclick = async () => {
    const code = $("join-code").value.trim().toUpperCase();
    if (!code) return;
    try {
      const d = await api(`/groups/${encodeURIComponent(code)}/join`, {method:"POST"});
      state.groupCode = code; state.group = d.group; state.screen = "group"; startPolling(); render();
    } catch(e) { toast(e.message); }
  };
}

function memberRows() {
  const members = state.group?.members || [];
  return members.map(m => `<div class="member">
    <span class="mini-avatar">${esc(m.username.slice(0,1).toUpperCase())}</span>
    <span>${esc(m.username)}${m.username===state.user?" <em>(you)</em>":""}</span>
    <strong>${m.budget == null ? "—" : "$"+m.budget}</strong>
  </div>`).join("");
}

function renderGroup() {
  const g = state.group;
  $("app").innerHTML = `<div class="shell">${header("home")}
    <section class="hero compact">
      <p class="eyebrow">GROUP READY</p>
      <div class="code-line"><h1>${esc(g.code)}</h1><button class="ghost" id="copy-code">copy</button></div>
      <p>Share this code. Friends can join from their own phone on the same local server.</p>
    </section>
    <section class="panel">
      <div class="section-head"><div><p class="eyebrow">PEOPLE</p><h2>${g.members.length} member${g.members.length===1?"":"s"}</h2></div><span class="live-dot">● live</span></div>
      <div class="members">${memberRows()}</div>
    </section>
    <section class="panel">
      <p class="eyebrow">NEXT</p><h2>Everyone adds their budget</h2>
      <p class="hint">This is the maximum you want to spend today. The group total will be calculated automatically.</p>
      <button class="cta" id="my-budget">Enter my budget</button>
      ${g.members.length < 2 ? `<p class="waiting">Waiting for your friends to join… keep this page open.</p>` : `<button class="solid full" id="start-budget">Continue to budgets</button>`}
    </section>
  </div>`;
  wireNav();
  $("copy-code").onclick = async () => { try { await navigator.clipboard.writeText(g.code); toast("Group code copied."); } catch { toast(`Your code is ${g.code}`); } };
  $("my-budget").onclick = () => { state.screen="budget"; render(); };
  const sb = $("start-budget"); if (sb) sb.onclick = () => { state.screen="budget"; render(); };
}

function renderBudget() {
  const me = state.group.members.find(m => m.username === state.user);
  const total = state.group.members.reduce((a,m) => a + (Number(m.budget)||0), 0);
  $("app").innerHTML = `<div class="shell">${header("home")}
    <section class="hero compact">
      <p class="eyebrow">THE MONEY ROUND</p>
      <h1>What can everyone spend?</h1>
      <p>Put in your own budget. We'll make one satisfying <strong>ka-ching</strong> when the group total lands.</p>
    </section>
    <section class="panel budget-panel">
      <label class="money-label">YOUR BUDGET
        <div class="money-input"><span>$</span><input id="budget-input" type="number" min="0" max="10000" step="1" value="${me?.budget ?? ""}" placeholder="0"></div>
      </label>
      <div class="budget-presets">${[0,5,10,15,25,50].map(n=>`<button data-budget="${n}">$${n}</button>`).join("")}</div>
      <button class="cta" id="submit-budget">Lock in my budget</button>
      ${state.budgetReaction ? `<div class="budget-reaction" role="status"><strong>KA-CHING! 💰</strong><span>Your $${me?.budget ?? 0} is locked in.</span></div>` : ""}
    </section>
    <section class="total-card">
      <p>GROUP BUDGET</p><strong id="group-total">$${total}</strong>
      <div class="budget-members">${state.group.members.map(m=>`<span>${esc(m.username)} ${m.budget==null?"—":"$"+m.budget}</span>`).join("")}</div>
    </section>
    ${state.group.members.length >= 2 ? `<button class="solid full" id="go-swipe">Start swiping →</button>` : `<p class="waiting">Invite at least one friend to start the decision.</p>`}
  </div>`;
  wireNav();
  document.querySelectorAll("[data-budget]").forEach(b => b.onclick = () => $("budget-input").value = b.dataset.budget);
  $("submit-budget").onclick = async () => {
    const budget = Number($("budget-input").value);
    if (!Number.isFinite(budget) || budget < 0) return toast("Enter a valid budget.");
    try {
      const d = await api(`/groups/${state.group.code}/budget`, {method:"POST", body:JSON.stringify({budget})});
      state.group = d.group; kaChing(); state.budgetReaction = true; render(); clearTimeout(renderBudget._reaction); renderBudget._reaction = setTimeout(() => { state.budgetReaction = false; render(); }, 4000);
    } catch(e) { toast(e.message); }
  };
  const go = $("go-swipe");
  if (go) go.onclick = startSwiping;
}

function eligibleSpots() {
  const total = state.group.members.reduce((a,m)=>a+(Number(m.budget)||0),0);
  const avg = total / Math.max(1,state.group.members.length);
  const blocked = new Set(anti());
  return [...SPOTS, ...(state.group.customSpots || [])].filter(s => !blocked.has(s.id) && s.cost <= avg).sort((a,b)=>a.walk-b.walk);
}

function startSwiping() {
  if (state.group.members.some(m => m.budget == null)) return toast("Everyone needs to lock in a budget first.");
  const spots = eligibleSpots();
  if (spots.length < 2) return toast("There aren't enough activities within the group's budget yet.");
  state.screen="swipe"; state.cardIndex=0; state.customSpotCount=(state.group.customSpots||[]).length; render();
}

function renderSwipe() {
  const spots = eligibleSpots();
  const g = state.group;
  const total = g.members.reduce((a,m)=>a+(Number(m.budget)||0),0);
  const avg = total / Math.max(1,g.members.length);
  const current = spots[state.cardIndex];
  const remaining = Math.max(0, spots.length-state.cardIndex);
  $("app").innerHTML = `<div class="shell swipe-shell">${header("home")}
    <div class="swipe-head"><div><p class="eyebrow">GROUP ${esc(g.code)}</p><h1>Would you go?</h1></div><span class="counter">${Math.min(state.cardIndex+1,spots.length)} / ${spots.length}</span></div>
    <p class="hint">Swipe right to like · swipe left to pass</p>
    <section class="deck" id="deck">
      ${current ? `<article class="swipe-card" id="swipe-card"><div class="swipe-label like-label">LIKE</div><div class="swipe-label pass-label">NOPE</div>
        <div class="card-art">${iconFor(current)}</div>
        <div class="card-copy">
          <div class="card-tags"><span>$${current.cost} / person</span><span>${current.walk} min away</span></div>
          <h2>${esc(current.name)}</h2><p>${esc(current.blurb)}</p>
          <small>Fits average budget of $${Math.round(avg)}</small>
        </div>
      </article>` : `<div class="empty-state"><h2>All swiped!</h2><p>Check the group matches below.</p></div>`}
    </section>
    ${current ? `<div class="swipe-buttons">
      <button class="swipe-action pass" id="pass" aria-label="Dislike">×</button>
      <button class="add-action" id="add-spot" aria-label="Add a place or activity">+</button>
      <button class="swipe-action like" id="like" aria-label="Like">♥</button>
    </div>` : `<button class="cta" id="see-results">See group results</button>`}
    <div class="swipe-tip">${remaining ? `${remaining} option${remaining===1?"":"s"} left` : "Decision ready"}</div>
  </div>`;
  wireNav();
  const card=$("swipe-card");
  if (card) {
    card.onpointerdown = e => { if(state.swipeAnimating)return; card.setPointerCapture(e.pointerId); state.pointer={x:e.clientX,y:e.clientY}; card.classList.add("dragging"); };
    card.onpointermove = e => { if(!state.pointer||state.swipeAnimating)return; const dx=e.clientX-state.pointer.x; card.style.transform=`translateX(${dx}px) rotate(${Math.max(-12,Math.min(12,dx/18))}deg)`; card.classList.toggle("drag-right",dx>18); card.classList.toggle("drag-left",dx<-18); };
    card.onpointerup = e => { if(!state.pointer||state.swipeAnimating)return; const dx=e.clientX-state.pointer.x; state.pointer=null; card.classList.remove("dragging","drag-right","drag-left"); if(Math.abs(dx)>70) animateSwipe(current,dx>0); else card.style.transform=""; };
    card.onpointercancel = () => { state.pointer=null; card.classList.remove("dragging","drag-right","drag-left"); card.style.transform=""; };
    $("pass").onclick=()=>animateSwipe(current,false);
    $("like").onclick=()=>animateSwipe(current,true);
    $("add-spot").onclick=showAddSpot;
  } else $("see-results").onclick=()=>{state.screen="results";render();};
}

function animateSwipe(spot,like){if(!spot||state.swipeAnimating)return;state.swipeAnimating=true;swoosh(like);const card=$("swipe-card");if(card){card.classList.add("swiping");card.style.transform=`translateX(${like?130:-130}%) rotate(${like?16:-16}deg)`;}setTimeout(()=>{state.swipeAnimating=false;castVote(spot,like);},220);}
function showAddSpot(){const old=$("add-modal");if(old)old.remove();document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="add-modal"><section class="add-modal"><button class="modal-close" id="close-add">×</button><p class="eyebrow">ADD TO THE BALLOT</p><h2>Your own idea</h2><label>Place / activity<input id="new-name" maxlength="60" placeholder="e.g. beach picnic"></label><label>Cost per person<input id="new-cost" type="number" min="0" max="10000" step="1" value="0"></label><label>Distance in minutes<input id="new-walk" type="number" min="0" max="999" step="1" value="5"></label><label>Short description<textarea id="new-blurb" maxlength="180" placeholder="Why should the group consider it?"></textarea></label><button class="cta" id="save-new-spot">Add to group</button></section></div>`);$("close-add").onclick=()=>$("add-modal").remove();$("save-new-spot").onclick=async()=>{const name=$("new-name").value.trim(),cost=Number($("new-cost").value),walk=Number($("new-walk").value),blurb=$("new-blurb").value.trim()||"Added by someone in the group.";if(!name||!Number.isFinite(cost)||cost<0||!Number.isFinite(walk)||walk<0)return toast("Add a name, cost and distance.");try{const d=await api(`/groups/${state.group.code}/spots`,{method:"POST",body:JSON.stringify({name,cost,walk,blurb})});state.group=d.group;$("add-modal").remove();toast(`${name} added to the ballot.`);render();}catch(e){toast(e.message);}};}

async function castVote(spot, like) {
  try {
    const d=await api(`/groups/${state.group.code}/vote`,{method:"POST",body:JSON.stringify({spotId:spot.id,like})});
    if (like) saveList(STORE.saved(state.user), [...saved(), spot.id]);
    else saveList(STORE.anti(state.user), [...anti(), spot.id]);
    state.group=d.group;
    if (d.match) {
      state.screen="results"; toast(`Majority match: ${d.match.name}`);
    } else {
      state.cardIndex++;
      if (state.cardIndex>=eligibleSpots().length) state.screen="results";
    }
    render();
  } catch(e){toast(e.message);}
}

function iconFor(s) {
  const icons={piano:"♫",bolts:"✣",ferry:"☼",radio:"◉",chess:"♞",cart:"✦",bingo:"▦",tapes:"◒",gallery:"▧",noodles:"⌁",mural:"✺",mallfood:"◇",espresso:"☕",lookout:"△",rooftop:"⌂",busker:"♬",zine:"▤",fountain:"≈"};
  return `<span>${icons[s.id]||"✦"}</span>`;
}

function voteCounts(g) {
  const counts={};
  Object.values(g.votes||{}).forEach(choices=>Object.entries(choices||{}).forEach(([id,v])=>{if(v?.like) counts[id]=(counts[id]||0)+1;}));
  return counts;
}
function majority(g) {
  const counts=voteCounts(g);
  const threshold=Math.floor(g.members.length/2)+1;
  const winner=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return winner && winner[1]>=threshold ? {id:winner[0],votes:winner[1],threshold} : null;
}

function recommendations(g) {
  const total=g.members.reduce((a,m)=>a+(Number(m.budget)||0),0);
  const avg=total/Math.max(1,g.members.length);
  const match=majority(g);
  const liked=new Set(Object.keys(voteCounts(g)));
  const pool=[...SPOTS,...(g.customSpots||[])].filter(s=>s.cost<=avg && (liked.has(s.id) || !match)).sort((a,b)=>{
    const am=match && a.id===match.id? -1000:0, bm=match && b.id===match.id?-1000:0;
    return (am+a.walk+a.cost*.25)-(bm+b.walk+b.cost*.25);
  });
  const out=[];
  if(match){ const w=getPlace(match.id); if(w) out.push(w); }
  for(const s of pool) if(!out.some(x=>x.id===s.id)) out.push(s);
  return out.slice(0,3);
}

function renderResults() {
  const g=state.group, m=majority(g), recs=recommendations(g);
  const votes=Object.values(g.votes||{});
  const done=votes.filter(v=>v&&Object.keys(v).length).length>=g.members.length;
  $("app").innerHTML=`<div class="shell">${header("home")}
    <section class="result-hero">
      <p class="eyebrow">${m?"MAJORITY MATCH":"GROUP RESULT"}</p>
      <h1>${m?`You're going to ${esc(getPlace(m.id)?.name||"the winner")}.`:"Almost there."}</h1>
      <p>${m?`${m.votes} of ${g.members.length} people matched.`:done?"No option reached a majority. The top options are ranked below.":"Waiting for everyone's votes…"}</p>
    </section>
    <section class="panel">
      <div class="section-head"><div><p class="eyebrow">TOP 3</p><h2>Best fit for your day</h2></div><span class="budget-pill">$${g.members.reduce((a,x)=>a+(Number(x.budget)||0),0)} total</span></div>
      ${recs.map((s,i)=>`<article class="recommend"><b>${i+1}</b><div class="rec-art">${iconFor(s)}</div><div><h3>${esc(s.name)}</h3><p>$${s.cost}/person · ${s.walk} min away</p></div><button class="ghost" data-save-result="${s.id}">${saved().includes(s.id)?"saved":"save"}</button></article>`).join("")}
    </section>
    <section class="panel vote-summary"><p class="eyebrow">VOTES</p>${[...SPOTS,...(g.customSpots||[])].filter(s=>voteCounts(g)[s.id]).map(s=>{
      const n=voteCounts(g)[s.id]||0;
      return `<div class="vote-line"><span>${esc(s.name)}</span><strong>${n} ♥</strong></div>`;
    }).join("") || "<p class='hint'>Votes will appear here as friends respond.</p>"}</section>
    <button class="cta" id="new-swipe">Swipe again</button>
    <button class="ghost full" id="back-group">Back to group</button>
  </div>`;
  wireNav();
  document.querySelectorAll("[data-save-result]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.saveResult, ids=saved(); saveList(STORE.saved(state.user),ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]); render();
  });
  $("new-swipe").onclick=()=>{state.cardIndex=0;state.screen="swipe";render();};
  $("back-group").onclick=()=>{state.screen="group";render();};
}

function renderProfile() {
  const isSaved=state.profileTab==="saved", ids=isSaved?saved():anti();
  const places=ids.map(getPlace).filter(Boolean);
  $("app").innerHTML=`<div class="shell">${header("profile")}
    <section class="profile-head">
      <div class="big-avatar">${esc(state.user.slice(0,1).toUpperCase())}</div>
      <div><p class="eyebrow">YOUR PROFILE</p><h1>${esc(state.user)}</h1><p>${saved().length} saved · ${anti().length} passed</p></div>
    </section>
    <div class="profile-switch">
      <button class="${isSaved?"on":""}" data-profile="saved">Saved <span>${saved().length}</span></button>
      <button class="${!isSaved?"on":""}" data-profile="anti">Anti list <span>${anti().length}</span></button>
    </div>
    <section class="profile-feed">${places.length?places.map(s=>`<article class="list-card"><div class="list-icon">${iconFor(s)}</div><div><h3>${esc(s.name)}</h3><p>$${s.cost}/person · ${s.walk} min away</p></div><button class="ghost" data-remove="${s.id}">remove</button></article>`).join(""):`<div class="empty-state"><h2>${isSaved?"Nothing saved yet.":"Your anti list is empty."}</h2><p>${isSaved?"Swipe right on places you like.":"Swipe left when something is not your vibe."}</p></div>`}</section>
    <button class="ghost full logout" id="logout">Log out</button>
  </div>`;
  wireNav();
  document.querySelectorAll("[data-profile]").forEach(b=>b.onclick=()=>{state.profileTab=b.dataset.profile;render();});
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    const key=isSaved?STORE.saved(state.user):STORE.anti(state.user);
    saveList(key,list(key).filter(x=>x!==b.dataset.remove));render();
  });
  $("logout").onclick=()=>{localStorage.removeItem(STORE.token);localStorage.removeItem(STORE.user);state.token="";state.user="";state.group=null;stopPolling();render();};
}

function startPolling(){
  stopPolling();
  state.poller=setInterval(async()=>{
    if(!state.groupCode) return;
    try {
      const d=await api(`/groups/${encodeURIComponent(state.groupCode)}`);
      state.group=d.group;
      if(state.screen==="group"||state.screen==="budget"||state.screen==="results") render();
      if(state.screen==="swipe" && (state.group.customSpots||[]).length !== state.customSpotCount){ state.customSpotCount=(state.group.customSpots||[]).length; render(); }
      const m=majority(state.group);
      if(m && state.screen==="swipe"){ state.screen="results"; render(); }
    } catch {}
  },1000);
}
function stopPolling(){if(state.poller) clearInterval(state.poller);state.poller=null;}

window.addEventListener("online",()=>{state.offline=false;syncDiscoveries().then(()=>{if(state.screen==="explore")render();});});
window.addEventListener("offline",()=>{state.offline=true;stopDiscoveryPolling();loadDiscoveryCache();if(state.screen==="explore")render();toast("Offline mode: cached finds are still available.");});
if(state.token)syncDiscoveries().then(()=>{if(state.screen==="explore")render()});
render();
