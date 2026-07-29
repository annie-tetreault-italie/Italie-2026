// Italie 2026 — Version 4.0 stable
window.__ITALIE_APP_STARTED__ = true;

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
let activeDayId = "";
let itinerarySearchText = "";
let itineraryCityValue = "";
let bookingSearchText = "";
let bookingStatusValue = "";
let expenseSearchText = "";
let expenseCategoryValue = "";

function setStatus(message, type=""){
  if(!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.className = "sync-status" + (type ? " " + type : "");
}

function showPanel(id){
  const target = $(id);
  if(!target){
    console.warn("Panneau introuvable :", id);
    return;
  }
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  target.classList.add("active");
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
  if(value && typeof value === "object"){
    return Object.values(value).filter(Boolean).join(" · ");
  }
  return String(value ?? "");
}

function valueItems(value){
  if(value === "" || value === undefined || value === null) return [];
  if(Array.isArray(value)) return value.map(item => displayValue(item)).filter(Boolean);
  if(value && typeof value === "object") return Object.values(value).map(item => displayValue(item)).filter(Boolean);
  return String(value).split(/\n|\s*·\s*/).map(item => item.trim()).filter(Boolean);
}

function mapsLink(value){
  const text = String(value || "").trim();
  if(!text) return "";
  if(/^https?:\/\//i.test(text)) return text;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(text);
}

function cityForDay(day){
  return firstValue(day, ["city","destination","arrivalCity"]);
}

function daySearchText(day){
  return Object.values(day).map(value => displayValue(value)).join(" ").toLocaleLowerCase("fr-CA");
}

function dayIsDetailed(day){
  return ["transport","train","hotel","accommodation","activities","restaurants","schedule","budget","notes","maps","address"]
    .some(field => day[field] !== undefined && day[field] !== null && displayValue(day[field]).trim() !== "");
}

function formatShortDate(dateText){
  const date = new Date(dateText + "T12:00:00");
  return {
    day:new Intl.DateTimeFormat("fr-CA",{day:"numeric"}).format(date),
    month:new Intl.DateTimeFormat("fr-CA",{month:"short"}).format(date).replace(".",""),
    weekday:new Intl.DateTimeFormat("fr-CA",{weekday:"short"}).format(date).replace(".","")
  };
}

function renderDateStrip(){
  const root = $("itineraryDateStrip");
  root.innerHTML = "";
  itineraryDays.forEach(day => {
    const short = formatShortDate(day.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-chip" + (day.id === activeDayId ? " active" : "");
    button.innerHTML = `<span>${esc(short.weekday)}</span><strong>${esc(short.day)}</strong><small>${esc(short.month)}</small>`;
    button.addEventListener("click",()=>{
      const card = document.querySelector(`[data-day-id="${day.id}"]`);
      if(card) card.scrollIntoView({behavior:"smooth",block:"center"});
    });
    root.appendChild(button);
  });
}

function updateItinerarySummary(){
  const cities = new Set(itineraryDays.map(cityForDay).filter(Boolean).map(city => String(city).trim().toLocaleLowerCase("fr-CA")));
  $("itineraryDayCount").textContent = itineraryDays.length;
  $("itineraryCityCount").textContent = cities.size;
  $("itineraryFilledCount").textContent = itineraryDays.filter(dayIsDetailed).length;

  const select = $("itineraryCityFilter");
  const current = select.value;
  const cityNames = [...new Set(itineraryDays.map(cityForDay).filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,"fr"));
  select.innerHTML = '<option value="">Toutes les villes</option>' + cityNames.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join("");
  if(cityNames.includes(current)) select.value = current;
}

function renderItinerary(){
  const root = $("itineraryList");
  const empty = $("itineraryEmpty");
  root.innerHTML = "";

  const filtered = itineraryDays.filter(day => {
    const matchesSearch = !itinerarySearchText || daySearchText(day).includes(itinerarySearchText);
    const matchesCity = !itineraryCityValue || cityForDay(day) === itineraryCityValue;
    return matchesSearch && matchesCity;
  });

  empty.hidden = filtered.length > 0;

  filtered.forEach((day,index) => {
    const date = day.id;
    const title = firstValue(day, ["title", "name"]) || "Journée en Italie";
    const city = cityForDay(day);
    const arrivalCity = firstValue(day, ["arrivalCity"]);
    const hotel = firstValue(day, ["hotel", "accommodation"]);
    const activities = valueItems(firstValue(day, ["activities", "activity"]));
    const restaurants = valueItems(firstValue(day, ["restaurants", "restaurant"]));
    const transport = firstValue(day, ["transport", "train", "flight"]);

    const details = [];
    if(arrivalCity) details.push(`<span>✈️ ${esc(arrivalCity)}</span>`);
    if(city) details.push(`<span>📍 ${esc(city)}</span>`);
    if(transport) details.push(`<span>🚆 ${esc(displayValue(transport))}</span>`);
    if(hotel) details.push(`<span>🏨 ${esc(displayValue(hotel))}</span>`);

    const card = document.createElement("article");
    card.className = "card trip-card day-card";
    card.dataset.dayId = date;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Ouvrir les détails du ${formatDateFr(date)}`);
    const short = formatShortDate(date);
    card.innerHTML = `
      <div class="day-card-layout">
        <div class="day-date-badge"><span>${esc(short.weekday)}</span><strong>${esc(short.day)}</strong><small>${esc(short.month)}</small></div>
        <div class="day-card-main">
          <div class="day-position">Jour ${index + 1} sur ${itineraryDays.length}</div>
          <h3>${esc(title)}</h3>
          <div class="date">${esc(formatDateFr(date))}</div>
          ${details.length ? `<div class="day-tags">${details.join("")}</div>` : ""}
          <div class="day-counts">
            ${activities.length ? `<span>🎟️ ${activities.length} activité${activities.length > 1 ? "s" : ""}</span>` : ""}
            ${restaurants.length ? `<span>🍝 ${restaurants.length} restaurant${restaurants.length > 1 ? "s" : ""}</span>` : ""}
          </div>
          <div class="open-day">Ouvrir la fiche complète →</div>
        </div>
      </div>`;
    card.addEventListener("click", ()=>openDayDetail(date));
    card.addEventListener("keydown", event=>{
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        openDayDetail(date);
      }
    });
    root.appendChild(card);
  });
  renderDateStrip();
}

function renderDetailBlock(icon,label,value,wide=false){
  const items = valueItems(value);
  if(!items.length) return null;
  const block = document.createElement("article");
  block.className = "detail-block" + (wide ? " wide" : "");
  block.innerHTML = `<h3>${icon} ${esc(label)}</h3>`;
  if(items.length === 1){
    const paragraph = document.createElement("p");
    paragraph.textContent = items[0];
    block.appendChild(paragraph);
  }else{
    const list = document.createElement("ul");
    list.className = "detail-list";
    items.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    block.appendChild(list);
  }
  return block;
}

function openDayDetail(dayId){
  const day = itineraryDays.find(item => item.id === dayId);
  if(!day) return;
  activeDayId = dayId;

  const title = firstValue(day, ["title","name"]) || "Journée en Italie";
  const city = cityForDay(day);
  $("dayDetailTitle").textContent = title;
  $("dayDetailDate").textContent = formatDateFr(day.id);
  $("dayDetailOverview").innerHTML = [
    city ? `<span>📍 ${esc(city)}</span>` : "",
    firstValue(day,["hotel","accommodation"]) ? `<span>🏨 Hébergement prévu</span>` : "",
    valueItems(firstValue(day,["activities","activity"])).length ? `<span>🎟️ ${valueItems(firstValue(day,["activities","activity"])).length} activité(s)</span>` : ""
  ].filter(Boolean).join("");

  const fields = [
    ["✈️", "Arrivée", firstValue(day, ["arrivalCity","arrival","flight"]), false],
    ["📍", "Ville", firstValue(day, ["city","destination"]), false],
    ["🚆", "Transport", firstValue(day, ["transport","train"]), false],
    ["🏨", "Hébergement", firstValue(day, ["hotel","accommodation","lodging"]), false],
    ["🎟️", "Activités", firstValue(day, ["activities","activity"]), true],
    ["🍝", "Restaurants", firstValue(day, ["restaurants","restaurant"]), true],
    ["🕐", "Horaire", firstValue(day, ["schedule","time","hours"]), true],
    ["💶", "Budget prévu", firstValue(day, ["budget","plannedBudget"]), false],
    ["📝", "Notes", firstValue(day, ["notes","description"]), true]
  ];

  const root = $("dayDetailContent");
  root.innerHTML = "";
  fields.forEach(([icon,label,value,wide]) => {
    const block = renderDetailBlock(icon,label,value,wide);
    if(block) root.appendChild(block);
  });

  const linkedBookings = bookings.filter(item => item && item.date === day.id);
  if(linkedBookings.length){
    const block = document.createElement("article");
    block.className = "detail-block wide linked-bookings";
    block.innerHTML = `<h3>🎟️ Réservations de cette journée</h3>`;
    linkedBookings.sort(compareBookings).forEach(item => block.appendChild(createBookingCard(item, bookings.indexOf(item), true)));
    root.appendChild(block);
  }

  const linkedExpenses = expenses.filter(item => item && item.date === day.id);
  if(linkedExpenses.length){
    const block=document.createElement("article");
    block.className="detail-block wide";
    const total=linkedExpenses.reduce((sum,item)=>sum+expenseCad(item),0);
    block.innerHTML=`<h3>💶 Dépenses de cette journée</h3><div class="day-budget-summary"><div><span>Total dépensé</span><strong>${esc(moneyCAD(total))}</strong></div><div><span>Nombre de dépenses</span><strong>${linkedExpenses.length}</strong></div></div>`;
    linkedExpenses.forEach(item=>{const p=document.createElement("p");p.textContent=`${expenseIcon(item.cat)} ${item.name} — ${expenseOriginalMoney(item)}`;block.appendChild(p)});
    root.appendChild(block);
  }

  const mapValue = firstValue(day, ["maps","map","address"]);
  if(mapValue){
    const mapBlock = renderDetailBlock("🗺️","Carte et adresse",mapValue,true);
    const link = document.createElement("a");
    link.href = mapsLink(mapValue);
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "map-button";
    link.textContent = "Ouvrir dans Google Maps →";
    mapBlock.appendChild(link);
    root.appendChild(mapBlock);
  }

  if(!root.children.length){
    root.innerHTML = '<div class="detail-block detail-empty wide">Cette journée existe dans Firebase, mais ses détails restent à compléter.</div>';
  }

  const index = itineraryDays.findIndex(item => item.id === dayId);
  const previous = itineraryDays[index - 1];
  const next = itineraryDays[index + 1];
  const previousButton = $("previousDayButton");
  const nextButton = $("nextDayButton");
  previousButton.disabled = !previous;
  nextButton.disabled = !next;
  previousButton.onclick = previous ? ()=>openDayDetail(previous.id) : null;
  nextButton.onclick = next ? ()=>openDayDetail(next.id) : null;

  renderDateStrip();
  showPanel("dayDetail");
}
window.openDayDetail = openDayDetail;

$("itinerarySearch").addEventListener("input", event => {
  itinerarySearchText = event.target.value.trim().toLocaleLowerCase("fr-CA");
  renderItinerary();
});

$("itineraryCityFilter").addEventListener("change", event => {
  itineraryCityValue = event.target.value;
  renderItinerary();
});

/* ITINÉRAIRE FIREBASE :
   Trips / italy-2026 / Days / AAAA-MM-JJ */
const daysQuery = query(
  collection(db, "Trips", "italy-2026", "Days"),
  orderBy("__name__")
);

onSnapshot(daysQuery, snapshot => {
  itineraryDays = [];

  if(snapshot.empty){
    $("itineraryList").innerHTML = '<div class="card loading-card">Aucune journée trouvée dans Firebase.</div>';
    updateItinerarySummary();
    return;
  }

  snapshot.forEach(dayDoc => {
    itineraryDays.push({ id: dayDoc.id, ...dayDoc.data() });
  });

  updateItinerarySummary();
  renderItinerary();
  renderDashboard();
  setStatus("✅ Itinéraire détaillé synchronisé avec Firebase.", "ok");
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
let plannedBudgetValue = LS.get("italie_plannedBudget", 0);

function currentState(){
  return {
    bookings,
    expenses,
    checks,
    notes,
    eurRate: eurRateValue,
    plannedBudget: plannedBudgetValue,
    updatedAt: new Date().toISOString()
  };
}

function saveLocal(){
  LS.set("italie_bookings", bookings);
  LS.set("italie_expenses", expenses);
  LS.set("italie_checks", checks);
  LS.set("italie_notes", notes);
  LS.set("italie_eurRate", eurRateValue);
  LS.set("italie_plannedBudget", plannedBudgetValue);
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

function bookingIcon(type=""){
  return ({"Hôtel":"🏨","Train":"🚆","Vol":"✈️","Voiture":"🚗","Activité":"🎟️","Restaurant":"🍝","Autre":"📌"})[type] || "📌";
}

function compareBookings(a,b){
  return `${a.date||"9999"} ${a.time||"99:99"}`.localeCompare(`${b.date||"9999"} ${b.time||"99:99"}`);
}

function bookingMoney(item){
  const price=Number(item.price);
  if(!Number.isFinite(price) || price<=0) return "";
  return new Intl.NumberFormat("fr-CA",{style:"currency",currency:item.currency||"CAD"}).format(price);
}

function statusClass(status=""){
  return "status-" + status.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]+/g,"-").replace(/^-|-$/g,"");
}

function safeLink(value){
  const text=String(value||"").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function createBookingCard(b,i,compact=false){
  const el=document.createElement("article");
  el.className="booking-card" + (compact ? " compact" : "");
  const link=safeLink(b.link);
  el.innerHTML=`
    <div class="booking-icon">${bookingIcon(b.type)}</div>
    <div class="booking-main">
      <div class="booking-topline"><strong>${esc(b.name||"Réservation")}</strong><span class="booking-status ${statusClass(b.status||"Réservé")}">${esc(b.status||"Réservé")}</span></div>
      <div class="booking-meta">${[b.type,b.date?formatDateFr(b.date):"",b.time,b.city].filter(Boolean).map(esc).join(" · ")}</div>
      ${b.conf?`<div class="confirmation">Confirmation : <strong>${esc(b.conf)}</strong></div>`:""}
      ${b.notes?`<p>${esc(b.notes)}</p>`:""}
      <div class="booking-actions">
        ${bookingMoney(b)?`<span class="booking-price">${esc(bookingMoney(b))}</span>`:""}
        ${link?`<a href="${esc(link)}" target="_blank" rel="noopener">Ouvrir le lien →</a>`:""}
        ${b.date?`<button type="button" onclick="openDayDetail('${esc(b.date)}')">Voir la journée</button>`:""}
      </div>
    </div>
    ${compact?"":`<button class="delete-booking" type="button" onclick="delBooking(${i})" aria-label="Supprimer">✕</button>`}`;
  return el;
}

function renderBookingSummary(){
  const paid=bookings.filter(b=>b.status==="Payé").length;
  const totals=bookings.reduce((sum,b)=>{
    const price=Number(b.price)||0;
    if((b.currency||"CAD")==="EUR") sum.eur+=price; else sum.cad+=price;
    return sum;
  },{cad:0,eur:0});
  $("bookingCount").textContent=bookings.length;
  $("bookingPaidCount").textContent=paid;
  const parts=[];
  if(totals.cad) parts.push(new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(totals.cad));
  if(totals.eur) parts.push(new Intl.NumberFormat("fr-CA",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(totals.eur));
  $("bookingTotal").textContent=parts.join(" + ") || "0 $";
}

function renderBookings(){
  renderBookingSummary();
  const root = $("bookingList");
  root.innerHTML="";
  const filtered=bookings.map((b,i)=>({b,i})).filter(({b})=>{
    const text=[b.type,b.name,b.city,b.date,b.conf,b.notes,b.status].join(" ").toLocaleLowerCase("fr-CA");
    return (!bookingSearchText || text.includes(bookingSearchText)) && (!bookingStatusValue || b.status===bookingStatusValue);
  }).sort((x,y)=>compareBookings(x.b,y.b));
  if(!filtered.length){
    root.innerHTML='<p class="subtle">Aucune réservation ne correspond à ce filtre.</p>';
  }else{
    filtered.forEach(({b,i})=>root.appendChild(createBookingCard(b,i)));
  }
  renderDashboard();
}

function addBooking(){
  const b={
    id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type:$("bookType").value,
    status:$("bookStatus").value,
    city:$("bookCity").value.trim(),
    name:$("bookName").value.trim(),
    date:$("bookDate").value,
    time:$("bookTime").value,
    conf:$("bookConf").value.trim(),
    price:Number($("bookPrice").value)||0,
    currency:$("bookCurrency").value,
    link:$("bookLink").value.trim(),
    notes:$("bookNotes").value.trim()
  };
  if(!b.name){ alert("Ajoute au moins un nom ou une compagnie."); return; }
  bookings.push(b);
  ["bookCity","bookName","bookDate","bookTime","bookConf","bookPrice","bookLink","bookNotes"].forEach(id=>$(id).value="");
  $("bookStatus").value="À réserver";
  renderBookings();
  scheduleCloudSave();
}
window.addBooking = addBooking;

function delBooking(i){
  if(!confirm("Supprimer cette réservation?")) return;
  bookings.splice(i,1);
  renderBookings();
  scheduleCloudSave();
}
window.delBooking = delBooking;

$("bookingSearch").addEventListener("input",event=>{
  bookingSearchText=event.target.value.trim().toLocaleLowerCase("fr-CA");
  renderBookings();
});
$("bookingStatusFilter").addEventListener("change",event=>{
  bookingStatusValue=event.target.value;
  renderBookings();
});

function moneyCAD(value){
  return new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD",maximumFractionDigits:2}).format(Number(value)||0);
}
function expenseCad(e){
  const amount=Number(e.amount)||0;
  return e.cur==="EUR" ? amount*(Number(eurRateValue)||1.6) : amount;
}
function expenseIcon(cat=""){
  return ({"Hébergement":"🏨","Transport":"🚆","Restaurants":"🍝","Cafés":"☕","Activités":"🎟️","Épicerie":"🛒","Magasinage":"🛍️","Essence":"⛽","Divers":"📌","Repas":"🍝","Activité":"🎟️","Autre":"📌"})[cat]||"💶";
}
function expenseOriginalMoney(e){
  return new Intl.NumberFormat("fr-CA",{style:"currency",currency:e.cur||"CAD"}).format(Number(e.amount)||0);
}
function renderBreakdown(rootId, field){
  const root=$(rootId); root.innerHTML="";
  const totals={};
  expenses.forEach(e=>{const key=String(e[field]||"Non précisé").trim()||"Non précisé";totals[key]=(totals[key]||0)+expenseCad(e)});
  const rows=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){root.innerHTML='<p class="subtle">Aucune donnée pour le moment.</p>';return;}
  const grand=rows.reduce((s,r)=>s+r[1],0)||1;
  rows.forEach(([name,total])=>{
    const row=document.createElement("div"); row.className="breakdown-row";
    row.innerHTML=`<span>${field==="cat"?expenseIcon(name)+" ":""}${esc(name)}</span><strong>${esc(moneyCAD(total))}</strong><small>${Math.round(total/grand*100)} % des dépenses</small>`;
    root.appendChild(row);
  });
}
function updateCategoryFilter(){
  const select=$("expenseCategoryFilter"), current=select.value;
  const cats=[...new Set(expenses.map(e=>e.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  select.innerHTML='<option value="">Toutes les catégories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("");
  if(cats.includes(current)) select.value=current;
}

function renderBudgetChart(){
  const donut=$("expenseDonut"), legend=$("donutLegend"), totalEl=$("donutTotal");
  const totals={};
  expenses.forEach(e=>{const key=e.cat||"Divers";totals[key]=(totals[key]||0)+expenseCad(e)});
  const rows=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const grand=rows.reduce((s,r)=>s+r[1],0);
  totalEl.textContent=moneyCAD(grand);
  legend.innerHTML="";
  if(!grand){donut.style.background="#eadfd2";legend.innerHTML='<p class="subtle">Ajoute une dépense pour afficher le graphique.</p>';return;}
  const colors=["#1f5a4b","#c56f4c","#9c8f56","#5c8191","#836a78","#d6a85f","#6f8c68","#b56f7b","#7f786e"];
  let start=0; const stops=[];
  rows.forEach(([name,total],i)=>{const end=start+(total/grand*100);stops.push(`${colors[i%colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`);start=end;const item=document.createElement("div");item.className="legend-item";item.innerHTML=`<span class="legend-dot" style="background:${colors[i%colors.length]}"></span><span>${expenseIcon(name)} ${esc(name)}</span><strong>${Math.round(total/grand*100)} %</strong>`;legend.appendChild(item)});
  donut.style.background=`conic-gradient(${stops.join(",")})`;
}
function renderBudgetInsights(spent,planned){
  const root=$("budgetInsights");
  const days=[...new Set(expenses.map(e=>e.date).filter(Boolean))];
  const average=days.length?spent/days.length:0;
  const top=[...expenses].sort((a,b)=>expenseCad(b)-expenseCad(a))[0];
  const remaining=planned-spent;
  root.innerHTML=`<div class="insight-row"><span>📅 Moyenne par journée</span><strong>${moneyCAD(average)}</strong></div><div class="insight-row"><span>🧾 Plus grosse dépense</span><strong>${top?esc(top.name)+" · "+moneyCAD(expenseCad(top)):"—"}</strong></div><div class="insight-row"><span>${remaining>=0?"✅":"⚠️"} Situation</span><strong>${planned? (remaining>=0?moneyCAD(remaining)+" disponibles":moneyCAD(Math.abs(remaining))+" au-dessus"):"Budget à définir"}</strong></div>`;
}
function editExpense(i){
  const e=expenses[i]; if(!e)return;
  $("expDate").value=e.date||""; $("expCity").value=e.city||""; $("expName").value=e.name||""; $("expCat").value=e.cat||"Divers"; $("expAmount").value=e.amount||""; $("expCur").value=e.cur||"CAD"; $("expPayment").value=e.payment||"Carte de crédit"; $("expNotes").value=e.notes||"";
  expenses.splice(i,1); renderExpenses(); scheduleCloudSave();
  document.querySelector(".budget-form").scrollIntoView({behavior:"smooth",block:"start"});
  $("expName").focus();
}
window.editExpense=editExpense;

function renderExpenses(){
  const spent=expenses.reduce((s,e)=>s+expenseCad(e),0);
  const planned=Number(plannedBudgetValue)||0;
  const remaining=planned-spent;
  const percent=planned>0?Math.round(spent/planned*100):0;
  $("budgetPlannedCard").textContent=moneyCAD(planned);
  $("budgetSpentCard").textContent=moneyCAD(spent);
  $("budgetRemainingCard").textContent=moneyCAD(remaining);
  $("budgetPercentCard").textContent=`${percent} %`;
  $("budgetProgressBar").style.width=`${Math.min(Math.max(percent,0),100)}%`;
  $("budgetProgressBar").style.background=percent>100?"var(--terracotta)":"var(--green)";
  updateCategoryFilter(); renderBreakdown("categoryBreakdown","cat"); renderBreakdown("cityBreakdown","city"); renderBudgetChart(); renderBudgetInsights(spent,planned);
  const root=$("expenseList"); root.innerHTML="";
  const filtered=expenses.map((e,i)=>({e,i})).filter(({e})=>{
    const text=[e.name,e.cat,e.city,e.date,e.payment,e.notes].join(" ").toLocaleLowerCase("fr-CA");
    return (!expenseSearchText||text.includes(expenseSearchText))&&(!expenseCategoryValue||e.cat===expenseCategoryValue);
  }).sort((a,b)=>String(b.e.date||"").localeCompare(String(a.e.date||"")));
  if(!filtered.length){root.innerHTML='<p class="subtle">Aucune dépense ne correspond à ce filtre.</p>';}
  filtered.forEach(({e,i})=>{
    const el=document.createElement("article"); el.className="expense-card";
    const cad=e.cur==="EUR"?` · ${moneyCAD(expenseCad(e))}`:"";
    el.innerHTML=`<div class="expense-icon">${expenseIcon(e.cat)}</div><div><div class="expense-title">${esc(e.name||"Dépense")}</div><div class="expense-meta">${[e.date?formatDateFr(e.date):"",e.city,e.cat,e.payment].filter(Boolean).map(esc).join(" · ")}</div>${e.notes?`<div class="expense-note">${esc(e.notes)}</div>`:""}<div class="expense-actions"><button onclick="editExpense(${i})">✏️ Modifier</button><button class="danger" onclick="delExpense(${i})">🗑️ Supprimer</button></div></div><div class="expense-amount">${esc(expenseOriginalMoney(e))}${esc(cad)}</div>`;
    root.appendChild(el);
  });
  renderDashboard();
}
function addExpense(){
  const amount=parseFloat($("expAmount").value);
  if(!$("expName").value.trim()||!Number.isFinite(amount)){alert("Entre une dépense et un montant.");return;}
  expenses.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:$("expDate").value,city:$("expCity").value.trim(),name:$("expName").value.trim(),cat:$("expCat").value,amount,cur:$("expCur").value,payment:$("expPayment").value,notes:$("expNotes").value.trim()});
  ["expName","expAmount","expNotes"].forEach(id=>$(id).value=""); renderExpenses(); scheduleCloudSave();
}
window.addExpense=addExpense;
function delExpense(i){if(!confirm("Supprimer cette dépense?"))return;expenses.splice(i,1);renderExpenses();scheduleCloudSave();}
window.delExpense=delExpense;
function saveBudgetSettings(){
  plannedBudgetValue=parseFloat($("plannedBudget").value)||0;
  eurRateValue=parseFloat($("eurRate").value)||1.6;
  renderExpenses();scheduleCloudSave();
}
window.saveBudgetSettings=saveBudgetSettings;
$("expenseSearch").addEventListener("input",e=>{expenseSearchText=e.target.value.trim().toLocaleLowerCase("fr-CA");renderExpenses()});
$("expenseCategoryFilter").addEventListener("change",e=>{expenseCategoryValue=e.target.value;renderExpenses()});
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
  if(Number.isFinite(Number(data.plannedBudget))) plannedBudgetValue=Number(data.plannedBudget);

  $("freeNotes").value=notes;
  $("eurRate").value=eurRateValue;
  $("plannedBudget").value=plannedBudgetValue;
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
