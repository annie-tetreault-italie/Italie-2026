import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, doc, collection, query, orderBy,
  onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAF2wvWyL0mWBu-kpoUK6vCrrCV7VYh9x4",
  authDomain: "italie-2026-342a1.firebaseapp.com",
  projectId: "italie-2026-342a1",
  storageBucket: "italie-2026-342a1.firebasestorage.app",
  messagingSenderId: "450395285544",
  appId: "1:450395285544:web:b97e350611a45cf2c92d1d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const LS = {
  get(k, fallback){
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback }
    catch(e){ return fallback }
  },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};

const $ = id => document.getElementById(id);
const syncStatus = $("syncStatus");
let itineraryDays = [];

function setStatus(message, type=""){
  syncStatus.textContent = message;
  syncStatus.className = "sync-status" + (type ? " " + type : "");
}

function showPanel(id){
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav button").forEach(
    b=>b.classList.toggle("active", b.dataset.panel===id)
  );
  window.scrollTo({top:0,behavior:"smooth"});
}
window.showPanel = showPanel;

function updateCountdown(){
  const target = new Date("2026-09-28T00:00:00");
  let diff = target - new Date();
  if(diff < 0) diff = 0;
  const d=Math.floor(diff/86400000);
  const h=Math.floor(diff/3600000)%24;
  const m=Math.floor(diff/60000)%60;
  const s=Math.floor(diff/1000)%60;
  $("cdDays").textContent=d;
  $("cdHours").textContent=h;
  $("cdMin").textContent=m;
  $("cdSec").textContent=s;
}
setInterval(updateCountdown,1000);
updateCountdown();

function esc(s=""){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

function formatDateFr(dateText){
  if(!dateText) return "";
  const date = new Date(dateText + "T12:00:00");
  return new Intl.DateTimeFormat("fr-CA", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  }).format(date);
}

function firstValue(data, names){
  for(const name of names){
    const value = data[name];
    if(value !== undefined && value !== null && String(value).trim() !== ""){
      return value;
    }
  }
  return "";
}


function displayValue(value){
  if(Array.isArray(value)) return value.join(" · ");
  if(value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

function mapsLink(value){
  const text = String(value || "").trim();
  if(!text) return "";
  if(/^https?:\/\//i.test(text)) return text;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(text);
}

function openDayDetail(dayId){
  const day = itineraryDays.find(item => item.id === dayId);
  if(!day) return;

  const title = firstValue(day, ["title","name"]) || "Journée en Italie";
  $("dayDetailTitle").textContent = title;
  $("dayDetailDate").textContent = formatDateFr(day.id);

  const fields = [
    ["✈️", "Arrivée", firstValue(day, ["arrivalCity","arrival","flight"])],
    ["📍", "Ville", firstValue(day, ["city","destination"])],
    ["🚆", "Transport", firstValue(day, ["transport","train"])],
    ["🏨", "Hébergement", firstValue(day, ["hotel","accommodation","lodging"])],
    ["🎟️", "Activités", firstValue(day, ["activities","activity"])],
    ["🍝", "Restaurants", firstValue(day, ["restaurants","restaurant"])],
    ["🕐", "Horaire", firstValue(day, ["schedule","time","hours"])],
    ["💶", "Budget prévu", firstValue(day, ["budget","plannedBudget"])],
    ["📝", "Notes", firstValue(day, ["notes","description"])],
    ["📍", "Carte", firstValue(day, ["maps","map","address"])]
  ];

  const root = $("dayDetailContent");
  root.innerHTML = "";

  fields.forEach(([icon,label,value]) => {
    if(value === "" || value === undefined || value === null) return;

    const block = document.createElement("article");
    block.className = "detail-block" + (label === "Notes" ? " wide" : "");

    const heading = document.createElement("h3");
    heading.textContent = `${icon} ${label}`;
    block.appendChild(heading);

    const paragraph = document.createElement("p");
    paragraph.textContent = displayValue(value);
    block.appendChild(paragraph);

    if(label === "Carte"){
      const link = document.createElement("a");
      link.href = mapsLink(value);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Ouvrir dans Google Maps →";
      block.appendChild(link);
    }

    root.appendChild(block);
  });

  if(!root.children.length){
    root.innerHTML = '<div class="detail-block detail-empty wide">Cette journée existe dans Firebase, mais ses détails restent à compléter.</div>';
  }

  showPanel("dayDetail");
}
window.openDayDetail = openDayDetail;

/* ITINÉRAIRE FIREBASE :
   Trips / italy-2026 / Days / AAAA-MM-JJ */
const daysQuery = query(
  collection(db, "Trips", "italy-2026", "Days"),
  orderBy("__name__")
);

onSnapshot(daysQuery, snapshot => {
  const root = $("itineraryList");
  itineraryDays = [];
  root.innerHTML = "";

  if(snapshot.empty){
    root.innerHTML = '<div class="card loading-card">Aucune journée trouvée dans Firebase.</div>';
    return;
  }

  snapshot.forEach(dayDoc => {
    const data = dayDoc.data();
    const date = dayDoc.id;
    itineraryDays.push({ id: date, ...data });
    const title = firstValue(data, ["title", "name"]) || "Journée en Italie";
    const city = firstValue(data, ["city", "destination"]);
    const arrivalCity = firstValue(data, ["arrivalCity"]);
    const hotel = firstValue(data, ["hotel", "accommodation"]);
    const activities = firstValue(data, ["activities", "activity"]);
    const notes = firstValue(data, ["notes", "description"]);
    const transport = firstValue(data, ["transport", "train", "flight"]);

    const details = [];
    if(arrivalCity) details.push(`<div>✈️ Arrivée : ${esc(arrivalCity)}</div>`);
    if(city) details.push(`<div>📍 ${esc(city)}</div>`);
    if(transport) details.push(`<div>🚆 ${esc(transport)}</div>`);
    if(hotel) details.push(`<div>🏨 ${esc(hotel)}</div>`);
    if(activities){
      const text = Array.isArray(activities) ? activities.join(" · ") : activities;
      details.push(`<div>🎟️ ${esc(text)}</div>`);
    }
    if(notes) details.push(`<div>📝 ${esc(notes)}</div>`);

    const card = document.createElement("article");
    card.className = "card trip-card day-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Ouvrir les détails du ${formatDateFr(date)}`);
    card.innerHTML = `
      <div class="top">
        <div class="badge b1">📅</div>
        <div>
          <h3>${esc(title)}</h3>
          <div class="date">${esc(formatDateFr(date))}</div>
          <div class="day-number">${esc(date)}</div>
        </div>
      </div>
      ${details.length ? `<div class="details">${details.join("")}</div>` : ""}
      <div class="open-day">Voir la journée →</div>
    `;
    card.addEventListener("click", ()=>openDayDetail(date));
    card.addEventListener("keydown", event=>{
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        openDayDetail(date);
      }
    });
    root.appendChild(card);
  });

  renderDashboard();
  setStatus("✅ Itinéraire et données connectés à Firebase.", "ok");
}, error => {
  console.error("Lecture de l’itinéraire impossible :", error);
  $("itineraryList").innerHTML =
    '<div class="card loading-card">Impossible de lire l’itinéraire. Vérifie les règles Firestore.</div>';
  setStatus("⚠️ Firebase bloque la lecture de l’itinéraire.", "error");
});


function dashboardMoney(value){
  return new Intl.NumberFormat("fr-CA",{
    style:"currency", currency:"CAD"
  }).format(value || 0);
}

function renderDashboard(){
  const nowKey = new Date().toISOString().slice(0,10);
  const nextDay =
    itineraryDays.find(day => day.id >= nowKey) ||
    itineraryDays[0];

  if(nextDay){
    const title = firstValue(nextDay, ["title","name"]) || "Journée en Italie";
    const city = firstValue(nextDay, ["city","destination","arrivalCity"]);
    $("dashboardNextTitle").textContent = title;
    $("dashboardNextDetails").textContent =
      [formatDateFr(nextDay.id), city].filter(Boolean).join(" · ");
  }else{
    $("dashboardNextTitle").textContent = "Itinéraire à compléter";
    $("dashboardNextDetails").textContent = "Ajoute des journées dans Firebase";
  }

  const datedBookings = bookings
    .filter(item => item && item.date)
    .slice()
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const nextBooking =
    datedBookings.find(item => item.date >= nowKey) ||
    datedBookings[0] ||
    bookings[0];

  if(nextBooking){
    $("dashboardBookingTitle").textContent =
      `${nextBooking.type || "Réservation"} · ${nextBooking.name || ""}`;
    $("dashboardBookingDetails").textContent =
      [nextBooking.date, nextBooking.city].filter(Boolean).join(" · ") ||
      "Détails à compléter";
  }else{
    $("dashboardBookingTitle").textContent = "Aucune réservation";
    $("dashboardBookingDetails").textContent = "Ajoute tes hôtels, trains et activités";
  }

  const rate = parseFloat(eurRateValue) || 1.6;
  const total = expenses.reduce(
    (sum,item) => sum + (item.cur === "EUR" ? Number(item.amount || 0) * rate : Number(item.amount || 0)),
    0
  );
  $("dashboardBudget").textContent = dashboardMoney(total);
  $("dashboardExpenseCount").textContent =
    `${expenses.length} dépense${expenses.length === 1 ? "" : "s"}`;

  const allChecks = [...(checks.packing || []), ...(checks.todo || [])];
  const completed = allChecks.filter(item => item.done).length;
  const percent = allChecks.length ? Math.round(completed / allChecks.length * 100) : 0;
  $("dashboardPacking").textContent = `${percent} % terminé`;
  $("dashboardPackingDetails").textContent =
    `${completed} sur ${allChecks.length} éléments prêts`;
}

/* ÉTAT PARTAGÉ :
   italie / appState */
const stateRef = doc(db, "italie", "appState");
let applyingRemote = false;
let saveTimer = null;

const defaults = {
  packing:["Passeports","Cartes de crédit","Argent en euros","Ordinateur de travail",
    "Écouteurs","Bouchons d’oreilles","Costume de bain","Fer plat","Brosse","Advil",
    "Parfum","Gourde d’eau","Savon pour le corps","Shampooing / revitalisant",
    "Lingettes de toilette","Cure-oreilles","Éponge de douche","Polysporin",
    "Adaptateurs électriques","Médicaments","Chaussures confortables",
    "Lunettes de soleil","Chargeurs","Petite veste / coupe-vent"],
  todo:["Vérifier les passeports","Échanger de l’argent en euros",
    "Télécharger les billets et réservations","Aviser la banque du voyage",
    "Préparer les assurances voyage","Télécharger les cartes hors ligne",
    "Confirmer le train Rome → Cinque Terre"]
};

let bookings = LS.get("italie_bookings", []);
let expenses = LS.get("italie_expenses", []);
let checks = LS.get("italie_checks", null) || {
  packing:defaults.packing.map(t=>({t,done:false})),
  todo:defaults.todo.map(t=>({t,done:false}))
};
let notes = LS.get("italie_notes", "");
let eurRateValue = LS.get("italie_eurRate", 1.6);

function currentState(){
  return {
    bookings,
    expenses,
    checks,
    notes,
    eurRate: eurRateValue,
    updatedAt: new Date().toISOString()
  };
}

function saveLocal(){
  LS.set("italie_bookings", bookings);
  LS.set("italie_expenses", expenses);
  LS.set("italie_checks", checks);
  LS.set("italie_notes", notes);
  LS.set("italie_eurRate", eurRateValue);
}

function scheduleCloudSave(){
  saveLocal();
  if(applyingRemote) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try{
      await setDoc(stateRef, currentState(), {merge:true});
      setStatus("✅ Modifications synchronisées entre les appareils.", "ok");
    }catch(error){
      console.error("Sauvegarde Firebase impossible :", error);
      setStatus("⚠️ Sauvegardé seulement sur cet appareil. Vérifie les règles Firestore.", "error");
    }
  }, 250);
}

function renderBookings(){
  const root = $("bookingList");
  root.innerHTML = bookings.length ? "" :
    '<p class="subtle">Aucune réservation ajoutée pour le moment.</p>';
  bookings.forEach((b,i)=>{
    const el=document.createElement("div");
    el.className="item";
    el.innerHTML=`<div class="grow"><strong>${esc(b.type)} · ${esc(b.name)}</strong><br>
      <small>${esc(b.city||"")} ${b.date?"· "+esc(b.date):""}
      ${b.conf?" · Confirmation "+esc(b.conf):""}</small>
      ${b.notes?'<div style="margin-top:6px">'+esc(b.notes)+"</div>":""}</div>
      <button onclick="delBooking(${i})">✕</button>`;
    root.appendChild(el);
  });
  renderDashboard();
}

function addBooking(){
  const b={
    type:$("bookType").value,
    city:$("bookCity").value.trim(),
    name:$("bookName").value.trim(),
    date:$("bookDate").value,
    conf:$("bookConf").value.trim(),
    notes:$("bookNotes").value.trim()
  };
  if(!b.name){ alert("Ajoute au moins un nom."); return; }
  bookings.push(b);
  renderBookings();
  scheduleCloudSave();
  $("bookCity").value=$("bookName").value=$("bookDate").value=
    $("bookConf").value=$("bookNotes").value="";
}
window.addBooking = addBooking;

function delBooking(i){
  bookings.splice(i,1);
  renderBookings();
  scheduleCloudSave();
}
window.delBooking = delBooking;

function renderExpenses(){
  const rate=parseFloat(eurRateValue)||1.6;
  const total=expenses.reduce((s,e)=>s+(e.cur==="EUR"?e.amount*rate:e.amount),0);
  $("budgetTotal").textContent=new Intl.NumberFormat("fr-CA",{
    style:"currency",currency:"CAD"
  }).format(total);
  const root=$("expenseList");
  root.innerHTML=expenses.length ? "" :
    '<p class="subtle">Aucune dépense ajoutée pour le moment.</p>';
  expenses.forEach((e,i)=>{
    const amount=new Intl.NumberFormat("fr-CA",{
      style:"currency",currency:e.cur
    }).format(e.amount);
    const el=document.createElement("div");
    el.className="item";
    el.innerHTML=`<div class="grow"><strong>${esc(e.name)}</strong><br>
      <small>${esc(e.cat)} · ${amount}</small></div>
      <button onclick="delExpense(${i})">✕</button>`;
    root.appendChild(el);
  });
  renderDashboard();
}

function addExpense(){
  const amount=parseFloat($("expAmount").value);
  if(!$("expName").value.trim() || !Number.isFinite(amount)){
    alert("Entre une dépense et un montant.");
    return;
  }
  expenses.push({
    name:$("expName").value.trim(),
    cat:$("expCat").value,
    amount,
    cur:$("expCur").value
  });
  $("expName").value="";
  $("expAmount").value="";
  renderExpenses();
  scheduleCloudSave();
}
window.addExpense = addExpense;

function delExpense(i){
  expenses.splice(i,1);
  renderExpenses();
  scheduleCloudSave();
}
window.delExpense = delExpense;

function saveRate(){
  eurRateValue=parseFloat($("eurRate").value)||1.6;
  renderExpenses();
  scheduleCloudSave();
}
window.saveRate = saveRate;

function renderChecks(){
  for(const kind of ["packing","todo"]){
    const root=$(kind==="packing" ? "packingList" : "todoList");
    root.innerHTML="";
    checks[kind].forEach((x,i)=>{
      const row=document.createElement("div");
      row.className="check";
      row.innerHTML=`<input type="checkbox" ${x.done?"checked":""}
        onchange="toggleCheck('${kind}',${i},this.checked)">
        <div class="grow" style="${x.done?"text-decoration:line-through;color:#999":""}">
          ${esc(x.t)}
        </div>
        <button style="border:0;background:transparent;color:var(--terracotta)"
          onclick="delCheck('${kind}',${i})">✕</button>`;
      root.appendChild(row);
    });
  }
  renderDashboard();
}

function toggleCheck(kind,i,value){
  checks[kind][i].done=value;
  renderChecks();
  scheduleCloudSave();
}
window.toggleCheck = toggleCheck;

function addChecklist(kind,inputId){
  const input=$(inputId);
  const text=input.value.trim();
  if(!text) return;
  checks[kind].push({t:text,done:false});
  input.value="";
  renderChecks();
  scheduleCloudSave();
}
window.addChecklist = addChecklist;

function delCheck(kind,i){
  checks[kind].splice(i,1);
  renderChecks();
  scheduleCloudSave();
}
window.delCheck = delCheck;

function saveNotes(){
  notes=$("freeNotes").value;
  scheduleCloudSave();
  alert("Notes enregistrées et synchronisées.");
}
window.saveNotes = saveNotes;

function applyState(data){
  applyingRemote=true;
  if(Array.isArray(data.bookings)) bookings=data.bookings;
  if(Array.isArray(data.expenses)) expenses=data.expenses;
  if(data.checks?.packing && data.checks?.todo) checks=data.checks;
  if(typeof data.notes==="string") notes=data.notes;
  if(Number.isFinite(Number(data.eurRate))) eurRateValue=Number(data.eurRate);

  $("freeNotes").value=notes;
  $("eurRate").value=eurRateValue;
  renderBookings();
  renderExpenses();
  renderChecks();
  saveLocal();
  applyingRemote=false;
}

onSnapshot(stateRef, snapshot=>{
  if(snapshot.exists()){
    applyState(snapshot.data());
  }else{
    scheduleCloudSave();
  }
  setStatus("✅ Application synchronisée avec Firebase.", "ok");
}, error=>{
  console.error("Lecture de l’état impossible :", error);
  setStatus("⚠️ Mode local : Firebase bloque l’accès aux données partagées.", "error");
});

$("freeNotes").value=notes;
$("eurRate").value=eurRateValue;
renderBookings();
renderExpenses();
renderChecks();
renderDashboard();

document.addEventListener("touchend", function(e){
  const btn=e.target.closest("button[data-panel]");
  if(btn){
    e.preventDefault();
    showPanel(btn.dataset.panel);
  }
},{passive:false});
