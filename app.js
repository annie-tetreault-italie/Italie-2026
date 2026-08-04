// Mon Carnet de Voyages — Notes, étoiles et photo préférée
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
let todaySelectedDayId = "";

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
  if(id === "map") setTimeout(initTripMap, 80);
  if(id === "timeline") setTimeout(renderTimeline, 40);
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


function editorText(value){
  if(Array.isArray(value)) return value.map(item => displayValue(item)).filter(Boolean).join("\n");
  if(value && typeof value === "object") return Object.values(value).map(item => displayValue(item)).filter(Boolean).join("\n");
  return String(value ?? "");
}

function editorList(value){
  return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function fillDayEditor(day){
  $("editDayTitle").value = firstValue(day,["title","name"]);
  $("editDayCity").value = firstValue(day,["city","destination"]);
  $("editDayArrival").value = firstValue(day,["arrivalCity","arrival"]);
  $("editDayTransport").value = editorText(firstValue(day,["transport","train","flight"]));
  $("editDayHotel").value = editorText(firstValue(day,["hotel","accommodation","lodging"]));
  $("editDayActivities").value = editorText(firstValue(day,["activities","activity"]));
  $("editDayRestaurants").value = editorText(firstValue(day,["restaurants","restaurant"]));
  $("editDaySchedule").value = editorText(firstValue(day,["schedule","time","hours"]));
  $("editDayBudget").value = editorText(firstValue(day,["budget","plannedBudget"]));
  $("editDayMaps").value = editorText(firstValue(day,["maps","map","address"]));
  $("editDayNotes").value = editorText(firstValue(day,["notes","description"]));
  $("dayEditStatus").textContent = "";
}

function toggleDayEditor(show){
  const form = $("dayEditForm");
  form.hidden = !show;
  $("editDayButton").textContent = show ? "✏️ Modification en cours" : "✏️ Modifier cette journée";
  $("editDayButton").disabled = show;
  if(show) form.scrollIntoView({behavior:"smooth",block:"start"});
}

$("editDayButton").addEventListener("click",()=>{
  const day = itineraryDays.find(item => item.id === activeDayId);
  if(!day) return;
  fillDayEditor(day);
  toggleDayEditor(true);
});

$("cancelDayEdit").addEventListener("click",()=>toggleDayEditor(false));

$("dayEditForm").addEventListener("submit", async event => {
  event.preventDefault();
  if(!activeDayId) return;
  const status = $("dayEditStatus");
  const button = event.submitter;
  if(button) button.disabled = true;
  status.textContent = "Enregistrement…";
  try{
    const data = {
      title: $("editDayTitle").value.trim(),
      city: $("editDayCity").value.trim(),
      arrivalCity: $("editDayArrival").value.trim(),
      transport: $("editDayTransport").value.trim(),
      hotel: $("editDayHotel").value.trim(),
      activities: editorList($("editDayActivities").value),
      restaurants: editorList($("editDayRestaurants").value),
      schedule: editorList($("editDaySchedule").value),
      budget: $("editDayBudget").value.trim(),
      maps: $("editDayMaps").value.trim(),
      notes: $("editDayNotes").value.trim()
    };
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId), data, {merge:true});
    status.textContent = "✅ Journée enregistrée et synchronisée.";
    setTimeout(()=>toggleDayEditor(false),700);
  }catch(error){
    console.error("Modification de la journée impossible :",error);
    status.textContent = "⚠️ Enregistrement impossible. Vérifie la connexion ou les règles Firebase.";
  }finally{
    if(button) button.disabled = false;
  }
});


function dayCompletionPercent(day){
  const checks = [
    firstValue(day,["city","destination"]),
    firstValue(day,["transport","train","flight"]),
    firstValue(day,["hotel","accommodation","lodging"]),
    firstValue(day,["activities","activity"]),
    firstValue(day,["restaurants","restaurant"]),
    firstValue(day,["budget","plannedBudget"]),
    firstValue(day,["notes","description"]),
    firstValue(day,["maps","map","address"])
  ];
  const complete = checks.filter(value => displayValue(value).trim() !== "").length;
  return Math.round((complete / checks.length) * 100);
}

async function saveQuickDayPatch(patch){
  const status = $("quickEditStatus");
  status.textContent = "Enregistrement…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId), patch, {merge:true});
    status.textContent = "✅ Modification enregistrée.";
  }catch(error){
    console.error("Modification rapide impossible :", error);
    status.textContent = "⚠️ Enregistrement impossible.";
  }
}

const quickFieldLabels = {
  city:"Destination", hotel:"Hébergement", transport:"Transport",
  budget:"Budget prévu", notes:"Notes", maps:"Adresse ou lien Google Maps"
};

let quickModalMode = null;
let quickModalField = null;

function openQuickModal(mode, field){
  const day = itineraryDays.find(item=>item.id===activeDayId);
  if(!day) return;
  quickModalMode = mode;
  quickModalField = field;
  const modal = $("quickEditModal");
  const input = $("quickModalInput");
  const title = $("quickModalTitle");
  const label = $("quickModalLabel");

  if(mode === "add"){
    const isActivity = field === "activities";
    title.textContent = isActivity ? "Ajouter une activité" : "Ajouter un restaurant";
    label.textContent = isActivity ? "Nom de l’activité" : "Nom du restaurant";
    input.value = "";
  }else{
    const text = quickFieldLabels[field] || "Information";
    title.textContent = `Modifier : ${text}`;
    label.textContent = text;
    input.value = editorText(firstValue(day,[field]));
  }

  modal.hidden = false;
  requestAnimationFrame(()=>input.focus());
}

function closeQuickModal(){
  $("quickEditModal").hidden = true;
  quickModalMode = null;
  quickModalField = null;
}

async function saveQuickModal(){
  const input = $("quickModalInput");
  const value = input.value.trim();
  if(!quickModalField) return;
  const day = itineraryDays.find(item=>item.id===activeDayId);
  if(!day) return;

  if(quickModalMode === "add"){
    if(!value){ input.focus(); return; }
    const existing = valueItems(firstValue(day,[quickModalField]));
    await saveQuickDayPatch({[quickModalField]: [...existing, value]});
  }else{
    await saveQuickDayPatch({[quickModalField]: value});
  }
  closeQuickModal();
}

document.addEventListener("click", event=>{
  const fieldButton = event.target.closest("[data-quick-field]");
  if(fieldButton){
    event.preventDefault();
    openQuickModal("field", fieldButton.dataset.quickField);
    return;
  }
  const addButton = event.target.closest("[data-quick-add]");
  if(addButton){
    event.preventDefault();
    openQuickModal("add", addButton.dataset.quickAdd);
  }
});

$("quickModalSave").addEventListener("click", saveQuickModal);
$("quickModalCancel").addEventListener("click", closeQuickModal);
$("quickEditModal").addEventListener("click", event=>{
  if(event.target.id === "quickEditModal") closeQuickModal();
});
$("quickModalInput").addEventListener("keydown", event=>{
  if(event.key === "Enter") saveQuickModal();
  if(event.key === "Escape") closeQuickModal();
});


function memoryHasContent(day){
  return [day.journal, day.favorite, day.mood].some(value => String(value || "").trim()) || Number(day.rating || 0) > 0 || (Array.isArray(day.photos) && day.photos.length > 0);
}

function fillDayMemory(day){
  $("dayMemoryMood").value = String(day.mood || "");
  $("dayMemoryFavorite").value = String(day.favorite || "");
  $("dayMemoryJournal").value = String(day.journal || "");
  renderDayRating(Number(day.rating || 0));
  $("dayMemoryStatus").textContent = "";
  $("dayPhotoStatus").textContent = "";
  renderDayPhotos(day);
  const badge = $("memorySavedBadge");
  if(memoryHasContent(day)){
    badge.textContent = "Souvenir enregistré";
    badge.classList.add("saved");
  }else{
    badge.textContent = "À compléter";
    badge.classList.remove("saved");
  }
}


function currentDayPhotos(){
  const day = itineraryDays.find(item => item.id === activeDayId);
  return Array.isArray(day?.photos) ? day.photos.filter(Boolean) : [];
}

function renderDayPhotos(day){
  const root = $("dayPhotoGrid");
  if(!root) return;
  const photos = Array.isArray(day?.photos) ? day.photos.filter(Boolean) : [];
  root.innerHTML = "";
  if(!photos.length){
    root.innerHTML = '<div class="day-photo-empty">Aucune photo pour cette journée.</div>';
    return;
  }
  photos.forEach((src,index)=>{
    const item = document.createElement("figure");
    item.className = "day-photo-item" + (Number(day.favoritePhotoIndex) === index ? " favorite" : "");
    item.innerHTML = `<button type="button" class="day-photo-open" aria-label="Ouvrir la photo"><img src="${src}" alt="Souvenir du ${esc(formatDateFr(day.id))}"></button><button type="button" class="day-photo-favorite" aria-label="Choisir comme photo préférée" title="Photo préférée">${Number(day.favoritePhotoIndex) === index ? "❤️" : "🤍"}</button><button type="button" class="day-photo-delete" aria-label="Supprimer la photo">×</button>`;
    item.querySelector(".day-photo-open").addEventListener("click",()=>openPhotoViewer(photos,index,`${formatDateFr(day.id)} — ${day.location || day.title || "Souvenir"}`));
    item.querySelector(".day-photo-favorite").addEventListener("click",()=>setFavoriteDayPhoto(index));
    item.querySelector(".day-photo-delete").addEventListener("click",()=>deleteDayPhoto(index));
    root.appendChild(item);
  });
}


let photoViewerPhotos = [];
let photoViewerIndex = 0;
let photoViewerCaptionText = "";

function updatePhotoViewer(){
  const image = $("photoViewerImage");
  if(!image || !photoViewerPhotos.length) return;
  photoViewerIndex = (photoViewerIndex + photoViewerPhotos.length) % photoViewerPhotos.length;
  image.src = photoViewerPhotos[photoViewerIndex];
  $("photoViewerCaption").textContent = `${photoViewerCaptionText}${photoViewerPhotos.length > 1 ? ` · ${photoViewerIndex + 1} / ${photoViewerPhotos.length}` : ""}`;
  $("photoViewerPrev").hidden = photoViewerPhotos.length < 2;
  $("photoViewerNext").hidden = photoViewerPhotos.length < 2;
}

function openPhotoViewer(photos,index=0,caption="Photo souvenir"){
  photoViewerPhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  if(!photoViewerPhotos.length) return;
  photoViewerIndex = Number(index) || 0;
  photoViewerCaptionText = caption;
  const modal = $("photoViewerModal");
  modal.hidden = false;
  document.body.classList.add("photo-viewer-open");
  updatePhotoViewer();
  $("photoViewerClose")?.focus();
}

function closePhotoViewer(){
  const modal = $("photoViewerModal");
  if(modal) modal.hidden = true;
  document.body.classList.remove("photo-viewer-open");
  const image = $("photoViewerImage");
  if(image) image.src = "";
}

function changePhotoViewer(step){
  photoViewerIndex += step;
  updatePhotoViewer();
}

$("photoViewerClose")?.addEventListener("click",closePhotoViewer);
$("photoViewerPrev")?.addEventListener("click",()=>changePhotoViewer(-1));
$("photoViewerNext")?.addEventListener("click",()=>changePhotoViewer(1));
$("photoViewerModal")?.addEventListener("click",e=>{ if(e.target.matches("[data-close-photo-viewer]")) closePhotoViewer(); });
document.addEventListener("keydown",e=>{
  if($("photoViewerModal")?.hidden !== false) return;
  if(e.key === "Escape") closePhotoViewer();
  if(e.key === "ArrowLeft") changePhotoViewer(-1);
  if(e.key === "ArrowRight") changePhotoViewer(1);
});
let photoTouchStartX = 0;
$("photoViewerImage")?.addEventListener("touchstart",e=>{ photoTouchStartX = e.changedTouches[0]?.clientX || 0; },{passive:true});
$("photoViewerImage")?.addEventListener("touchend",e=>{
  const endX = e.changedTouches[0]?.clientX || 0;
  const delta = endX - photoTouchStartX;
  if(Math.abs(delta) > 45) changePhotoViewer(delta > 0 ? -1 : 1);
},{passive:true});

function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Lecture de la photo impossible"));
    reader.onload = ()=>{
      const image = new Image();
      image.onerror = ()=>reject(new Error("Image invalide"));
      image.onload = ()=>resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file){
  if(!file?.type?.startsWith("image/")) throw new Error("Choisis une image");
  const image = await imageFromFile(file);
  let maxSide = 900;
  let quality = 0.58;
  for(let attempt=0; attempt<3; attempt++){
    const scale = Math.min(1, maxSide / Math.max(image.width,image.height));
    const width = Math.max(1, Math.round(image.width*scale));
    const height = Math.max(1, Math.round(image.height*scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d",{alpha:false});
    ctx.drawImage(image,0,0,width,height);
    const dataUrl = canvas.toDataURL("image/jpeg",quality);
    if(dataUrl.length < 240000) return dataUrl;
    maxSide -= 150; quality -= 0.1;
  }
  throw new Error("La photo est encore trop lourde");
}

async function addSelectedDayPhoto(file){
  if(!activeDayId || !file) return;
  const status = $("dayPhotoStatus");
  const photos = currentDayPhotos();
  if(photos.length >= 3){
    status.textContent = "Maximum de 3 photos atteint pour cette journée.";
    return;
  }
  status.textContent = "Préparation de la photo…";
  try{
    const compressed = await compressPhoto(file);
    const nextPhotos = [...photos, compressed];
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId),{photos:nextPhotos},{merge:true});
    status.textContent = "✅ Photo ajoutée et synchronisée.";
  }catch(error){
    console.error("Ajout de photo impossible :",error);
    status.textContent = "⚠️ Photo impossible à ajouter. Essaie une autre image.";
  }finally{
    $("dayPhotoInput").value = "";
  }
}


async function setFavoriteDayPhoto(index){
  if(!activeDayId) return;
  const day = itineraryDays.find(item => item.id === activeDayId);
  const nextIndex = Number(day?.favoritePhotoIndex) === index ? -1 : index;
  const status = $("dayPhotoStatus");
  status.textContent = nextIndex >= 0 ? "Choix de la photo préférée…" : "Retrait du favori…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId),{favoritePhotoIndex:nextIndex},{merge:true});
    status.textContent = nextIndex >= 0 ? "✅ Photo préférée enregistrée." : "✅ Photo préférée retirée.";
  }catch(error){
    console.error("Photo préférée impossible :",error);
    status.textContent = "⚠️ Impossible d’enregistrer ce choix.";
  }
}

function renderDayRating(value){
  const root = $("dayRatingStars");
  if(!root) return;
  const rating = Math.max(0,Math.min(5,Number(value)||0));
  root.querySelectorAll("button").forEach(button=>{
    const star = Number(button.dataset.rating);
    button.classList.toggle("selected",star <= rating);
    button.setAttribute("aria-pressed",String(star === rating));
  });
  $("dayRatingLabel").textContent = rating ? `${rating} sur 5` : "Pas encore notée";
}

async function saveDayRating(value){
  if(!activeDayId) return;
  renderDayRating(value);
  const status = $("dayMemoryStatus");
  status.textContent = "Enregistrement de la note…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId),{rating:Number(value)},{merge:true});
    status.textContent = `✅ Journée notée ${value}/5.`;
  }catch(error){
    console.error("Note impossible :",error);
    status.textContent = "⚠️ Impossible d’enregistrer la note.";
  }
}

async function deleteDayPhoto(index){
  if(!activeDayId) return;
  const photos = currentDayPhotos();
  const nextPhotos = photos.filter((_,i)=>i!==index);
  const day = itineraryDays.find(item => item.id === activeDayId);
  let favoritePhotoIndex = Number(day?.favoritePhotoIndex);
  if(favoritePhotoIndex === index) favoritePhotoIndex = -1;
  else if(favoritePhotoIndex > index) favoritePhotoIndex -= 1;
  const status = $("dayPhotoStatus");
  status.textContent = "Suppression…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId),{photos:nextPhotos,favoritePhotoIndex},{merge:true});
    status.textContent = "✅ Photo supprimée.";
  }catch(error){
    console.error("Suppression impossible :",error);
    status.textContent = "⚠️ Suppression impossible.";
  }
}

$("addDayPhoto").addEventListener("click",()=>$("dayPhotoInput").click());
$("dayPhotoInput").addEventListener("change",event=>addSelectedDayPhoto(event.target.files?.[0]));
$("dayRatingStars").addEventListener("click",event=>{
  const button = event.target.closest("button[data-rating]");
  if(button) saveDayRating(Number(button.dataset.rating));
});

async function saveActiveDayMemory(){
  if(!activeDayId) return;
  const status = $("dayMemoryStatus");
  const button = $("saveDayMemory");
  status.textContent = "Enregistrement…";
  button.disabled = true;
  try{
    const patch = {
      mood: $("dayMemoryMood").value,
      favorite: $("dayMemoryFavorite").value.trim(),
      journal: $("dayMemoryJournal").value.trim()
    };
    await setDoc(doc(db,"Trips","italy-2026","Days",activeDayId), patch, {merge:true});
    status.textContent = "✅ Souvenir enregistré et synchronisé.";
  }catch(error){
    console.error("Souvenir impossible à enregistrer :", error);
    status.textContent = "⚠️ Enregistrement impossible.";
  }finally{
    button.disabled = false;
  }
}

function renderMemories(){
  const root = $("memoryList");
  const empty = $("memoryEmpty");
  if(!root || !empty) return;
  const days = itineraryDays.filter(memoryHasContent);
  $("memoryDayCount").textContent = days.filter(day => String(day.journal || "").trim()).length;
  $("memoryFavoriteCount").textContent = days.filter(day => String(day.favorite || "").trim()).length;
  $("memoryFiveStarCount").textContent = days.filter(day => Number(day.rating || 0) === 5).length;
  root.innerHTML = "";
  empty.hidden = days.length > 0;
  days.forEach(day => {
    const card = document.createElement("article");
    card.className = "memory-card card";
    card.innerHTML = `
      <div class="memory-card-date">${esc(formatDateFr(day.id))}</div>
      <div class="memory-card-top"><h2>${esc(cityForDay(day) || firstValue(day,["title","name"]) || "Journée en Italie")}</h2><span>${esc(day.mood || "📖")}</span></div>
      ${Number(day.rating || 0) ? `<div class="memory-rating" aria-label="${Number(day.rating)} étoiles">${"★".repeat(Number(day.rating))}${"☆".repeat(5-Number(day.rating))}</div>` : ""}
      ${Array.isArray(day.photos) && Number(day.favoritePhotoIndex) >= 0 && day.photos[Number(day.favoritePhotoIndex)] ? `<div class="memory-cover"><img src="${day.photos[Number(day.favoritePhotoIndex)]}" alt="Photo préférée de cette journée"><span>❤️ Photo préférée</span></div>` : ""}
      ${day.favorite ? `<div class="memory-favorite">❤️ ${esc(day.favorite)}</div>` : ""}
      ${Array.isArray(day.photos) && day.photos.length ? `<div class="memory-photo-strip">${day.photos.slice(0,3).map((src,index)=>`<button type="button" class="memory-photo-open" data-memory-day="${day.id}" data-memory-index="${index}" aria-label="Ouvrir la photo"><img src="${src}" alt="Photo souvenir"></button>`).join("")}</div>` : ""}
      ${day.journal ? `<p>${esc(day.journal)}</p>` : ""}
      <button type="button" class="btn secondary memory-open-day">Ouvrir cette journée</button>`;
    card.querySelector(".memory-open-day").addEventListener("click",()=>openDayDetail(day.id));
    root.appendChild(card);
  });
}

$("saveDayMemory").addEventListener("click", saveActiveDayMemory);

function openDayDetail(dayId){
  const day = itineraryDays.find(item => item.id === dayId);
  if(!day) return;
  activeDayId = dayId;
  toggleDayEditor(false);
  fillDayMemory(day);

  const title = firstValue(day, ["title","name"]) || "Journée en Italie";
  const city = cityForDay(day);
  $("dayDetailTitle").textContent = title;
  $("dayDetailDate").textContent = formatDateFr(day.id);
  const completion = dayCompletionPercent(day);
  $("dayCompletionPercent").textContent = completion + " %";
  $("dayCompletionFill").style.width = completion + "%";
  $("quickEditStatus").textContent = "";
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



// ===== Timeline vivante 3.1 =====
let timelineHighlightsOnly = false;
let timelinePlaybackTimer = null;
let timelinePlaybackIndex = 0;
const ITALY_SIGNATURE_QUOTE = "Aujourd’hui restera l’un de mes plus beaux souvenirs d’Italie.";

function timelineMemoryForDay(day){ return firstValue(day,["memoryText","journal","memory","favoriteMoment","notes"]); }
function timelineRating(day){ return Number(day.rating||day.dayRating||0); }
function timelineBudget(day){ return firstValue(day,["budget","dailyBudget"]); }
function timelineReflection(day){
  const saved = firstValue(day,["timelineReflection","reflection","dayQuote"]);
  if(saved) return saved;
  const city = String(cityForDay(day)||"").toLocaleLowerCase("fr-CA");
  return city.includes("cinque") || city.includes("manarola") ? ITALY_SIGNATURE_QUOTE : "";
}

function stopTimelinePlayback(){
  if(timelinePlaybackTimer) clearInterval(timelinePlaybackTimer);
  timelinePlaybackTimer = null;
  document.querySelectorAll('.timeline-day-card').forEach(card=>card.classList.remove('timeline-playing'));
  const button=$("timelinePlayButton");
  if(button) button.textContent="▶️ Revivre le voyage";
}

function startTimelinePlayback(){
  const cards=[...document.querySelectorAll('.timeline-day-card')];
  if(!cards.length) return;
  if(timelinePlaybackTimer){ stopTimelinePlayback(); return; }
  timelinePlaybackIndex=0;
  const button=$("timelinePlayButton");
  if(button) button.textContent="⏸️ Arrêter";
  const showCurrent=()=>{
    cards.forEach(card=>card.classList.remove('timeline-playing'));
    const card=cards[timelinePlaybackIndex];
    if(!card){ stopTimelinePlayback(); return; }
    card.classList.add('timeline-playing');
    card.scrollIntoView({behavior:"smooth",block:"center"});
    timelinePlaybackIndex += 1;
    if(timelinePlaybackIndex>=cards.length){
      setTimeout(stopTimelinePlayback,4200);
    }
  };
  showCurrent();
  timelinePlaybackTimer=setInterval(showCurrent,5000);
}

async function saveTimelineReflection(dayId, text, statusElement){
  const value=String(text||"").trim();
  if(statusElement) statusElement.textContent="Enregistrement…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",dayId),{timelineReflection:value},{merge:true});
    if(statusElement) statusElement.textContent="Enregistré ✓";
  }catch(error){
    console.error(error);
    if(statusElement) statusElement.textContent="Impossible d’enregistrer.";
  }
}

function renderTimeline(){
  stopTimelinePlayback();
  const root=$("timelineList"); if(!root) return;
  const days=timelineHighlightsOnly ? itineraryDays.filter(day=>timelineRating(day)>=5 || day.favoritePhotoIndex!==undefined || firstValue(day,["favoriteMoment","memoryFavorite"])) : itineraryDays;
  root.innerHTML=""; $("timelineEmpty").hidden=days.length>0;
  const now=new Date(); const todayId=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  let currentIndex=itineraryDays.findIndex(d=>d.id===todayId); if(currentIndex<0) currentIndex=itineraryDays.findIndex(d=>d.id>todayId); if(currentIndex<0) currentIndex=Math.max(0,itineraryDays.length-1);
  const percent=itineraryDays.length?Math.round(((currentIndex+1)/itineraryDays.length)*100):0;
  $("timelineProgressBar").style.width=percent+"%"; $("timelineProgressLabel").textContent=`Jour ${Math.min(currentIndex+1,itineraryDays.length||1)} sur ${itineraryDays.length||0}`; $("timelineProgressPercent").textContent=percent+" %";
  days.forEach((day,index)=>{
    const city=cityForDay(day)||"Italie"; const photos=Array.isArray(day.photos)?day.photos:[]; const places=Array.isArray(day.herePlaces)?day.herePlaces:[]; const memory=timelineMemoryForDay(day); const rating=timelineRating(day); const budget=timelineBudget(day); const reflection=timelineReflection(day);
    const activities=valueItems(firstValue(day,["activities","activity","schedule"])); const restaurants=valueItems(firstValue(day,["restaurants","restaurant"]));
    const card=document.createElement("article"); card.className="card timeline-day-card"+(rating>=5?" timeline-highlight":""); card.dataset.timelineDay=day.id;
    const cover=photos[0]||"assets/manarola-sunset.jpg";
    card.innerHTML=`<div class="timeline-day-cover" style="background-image:linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.72)),url('${cover}')"><div><div class="timeline-day-date">${esc(formatDateFr(day.id))}</div><h2>${esc(city)}</h2><div>Jour ${itineraryDays.findIndex(d=>d.id===day.id)+1} sur ${itineraryDays.length}</div></div></div><div class="timeline-day-body"><div class="timeline-day-kpis"><div><strong>${photos.length}</strong><span>📸 Photos</span></div><div><strong>${places.length}</strong><span>📌 Lieux</span></div><div><strong>${rating?"★".repeat(rating):"—"}</strong><span>Note</span></div><div><strong>${budget?esc(displayValue(budget)):"—"}</strong><span>💶 Budget</span></div></div>${memory?`<div class="timeline-memory"><strong>❤️ Mon souvenir</strong><br>${esc(displayValue(memory))}</div>`:""}${activities.length?`<p><strong>🥾 Activités :</strong> ${esc(activities.slice(0,3).join(" · "))}</p>`:""}${restaurants.length?`<p><strong>🍝 Restaurants :</strong> ${esc(restaurants.slice(0,3).join(" · "))}</p>`:""}${photos.length?`<div class="timeline-photo-strip">${photos.slice(0,8).map((src,i)=>`<button type="button" data-timeline-photo="${i}"><img src="${src}" alt="Souvenir du ${esc(formatDateFr(day.id))}"></button>`).join("")}</div>`:""}<section class="timeline-reflection"><div class="timeline-reflection-label">🌅 Ce que je retiens aujourd’hui</div><blockquote>${reflection?esc(reflection):"Ajoute une phrase qui résume cette journée."}</blockquote><button class="timeline-reflection-edit" type="button">✏️ Modifier la phrase</button><div class="timeline-reflection-form" hidden><textarea maxlength="260" aria-label="Phrase souvenir">${esc(reflection)}</textarea><div><button class="btn timeline-reflection-save" type="button">Enregistrer</button><button class="btn secondary timeline-reflection-cancel" type="button">Annuler</button></div><small class="timeline-reflection-status"></small></div></section><div class="timeline-day-actions"><button class="btn" type="button" data-open-timeline-day="${day.id}">Voir la journée</button><button class="btn secondary" type="button" data-map-timeline-day="${day.id}">📍 Voir sur la carte</button></div></div>`;
    card.querySelectorAll("[data-timeline-photo]").forEach(btn=>btn.addEventListener("click",()=>openPhotoViewer(photos,Number(btn.dataset.timelinePhoto)||0,`${formatDateFr(day.id)} — ${city}`)));
    card.querySelector("[data-open-timeline-day]")?.addEventListener("click",()=>openDayDetail(day.id));
    card.querySelector("[data-map-timeline-day]")?.addEventListener("click",()=>{ showPanel("map"); setTimeout(()=>{ const coords=coordinatesForDay(day); if(coords&&tripMap) tripMap.setView(coords,11); },180); });
    const edit=card.querySelector('.timeline-reflection-edit'); const form=card.querySelector('.timeline-reflection-form'); const area=card.querySelector('textarea'); const status=card.querySelector('.timeline-reflection-status');
    edit?.addEventListener('click',()=>{ form.hidden=false; edit.hidden=true; area.focus(); });
    card.querySelector('.timeline-reflection-cancel')?.addEventListener('click',()=>{ form.hidden=true; edit.hidden=false; area.value=reflection; status.textContent=""; });
    card.querySelector('.timeline-reflection-save')?.addEventListener('click',async()=>{ await saveTimelineReflection(day.id,area.value,status); });
    root.appendChild(card);
  });
}
$("timelineHighlightsButton")?.addEventListener("click",()=>{ timelineHighlightsOnly=!timelineHighlightsOnly; $("timelineHighlightsButton").textContent=timelineHighlightsOnly?"Voir toutes les journées":"⭐ Meilleurs moments"; renderTimeline(); });
$("timelineTodayButton")?.addEventListener("click",()=>{ renderTimeline(); const now=new Date(); const id=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; let target=document.querySelector(`[data-timeline-day="${id}"]`); if(!target){ target=document.querySelector('.timeline-day-card'); } target?.scrollIntoView({behavior:"smooth",block:"center"}); });
// Le bouton Timeline est géré par le lecteur Revivre 3.8.1.
window.renderTimeline=renderTimeline;
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
  renderMemories();
  renderTimeline();
  renderTripMapData();
  window.renderExplorerTimelineV90?.();
  setStatus("✅ Itinéraire détaillé synchronisé avec Firebase.", "ok");
}, error => {
  console.error("Lecture de l’itinéraire impossible :", error);
  $("itineraryList").innerHTML =
    '<div class="card loading-card">Impossible de lire l’itinéraire. Vérifie les règles Firestore.</div>';
  setStatus("⚠️ Firebase bloque la lecture de l’itinéraire.", "error");
});


function localDateKey(date = new Date()){
  const year = date.getFullYear();
  const month = String(date.getMonth()+1).padStart(2,"0");
  const day = String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function selectedTodayDay(){
  if(!itineraryDays.length) return null;
  const nowKey = localDateKey();
  if(todaySelectedDayId){
    const selected = itineraryDays.find(day => day.id === todaySelectedDayId);
    if(selected) return selected;
  }
  const exact = itineraryDays.find(day => day.id === nowKey);
  if(exact) return exact;
  const upcoming = itineraryDays.find(day => day.id > nowKey);
  return upcoming || itineraryDays[itineraryDays.length - 1];
}

function emptyTodayValue(text="À compléter"){
  return `<span class="today-empty-value">${esc(text)}</span>`;
}

function scheduleEntries(day){
  const schedule = day.schedule;
  if(Array.isArray(schedule)) return schedule.map(displayValue).filter(Boolean);
  if(schedule && typeof schedule === "object"){
    return Object.entries(schedule).map(([time,label]) => `${time} — ${displayValue(label)}`).filter(Boolean);
  }
  const scheduleItems = valueItems(schedule);
  if(scheduleItems.length) return scheduleItems;
  return valueItems(firstValue(day,["activities","activity"]));
}


function todayPremiumCityVisual(city=""){
  const c=String(city).toLocaleLowerCase("fr-CA");
  if(c.includes("cinque")||c.includes("manarola")||c.includes("vernazza")) return "assets/manarola-sunset.jpg";
  return "assets/toscane-accueil.jpg";
}
function todayPremiumQuote(city="",mode=""){
  const c=String(city).toLocaleLowerCase("fr-CA");
  if(mode==="Aperçu avant le départ") return "Chaque détail préparé aujourd’hui rendra le voyage encore plus doux.";
  if(c.includes("cinque")) return "Prenez le temps de regarder la mer et de savourer chaque village.";
  if(c.includes("florence")) return "Une journée parfaite pour marcher au cœur de la Renaissance.";
  if(c.includes("venise")) return "Laissez les ruelles et les canaux vous guider.";
  if(c.includes("toscane")) return "Ralentissez : les plus beaux souvenirs se cachent souvent sur la route.";
  if(c.includes("rome")) return "Aujourd’hui, l’histoire vous accompagne à chaque coin de rue.";
  return "Une belle journée vous attend. Profitez de chaque instant.";
}
function todayNextScheduleEntry(entries){
  if(!entries.length) return null;
  const now=new Date();
  const minutesNow=now.getHours()*60+now.getMinutes();
  const parsed=entries.map((entry,index)=>{
    const match=String(entry).match(/^\s*([0-2]?\d)[:h]([0-5]\d)\s*[—–-]?\s*(.*)$/i);
    return {raw:entry,index,minutes:match?Number(match[1])*60+Number(match[2]):null,label:match?(match[3]||entry):entry};
  });
  return parsed.find(item=>item.minutes!==null&&item.minutes>=minutesNow)||parsed[0];
}
function updateTodayPremium(day,mode,entries,linkedExpenses){
  const city=cityForDay(day)||"Italie";
  const hero=$("todayPremiumHero");
  if(hero) hero.style.backgroundImage=`linear-gradient(90deg,rgba(7,24,18,.76),rgba(7,24,18,.13) 72%),url("${todayPremiumCityVisual(city)}")`;
  const hour=new Date().getHours();
  $("todayPremiumGreeting").textContent=hour<12?"Bonjour Annie 👋":hour<18?"Bon après-midi Annie 👋":"Bonsoir Annie 👋";
  $("todayPremiumQuote").textContent=todayPremiumQuote(city,mode);
  $("todayPremiumActivityCount").textContent=`${entries.length} activité${entries.length===1?"":"s"}`;
  const next=todayNextScheduleEntry(entries);
  $("todayPremiumNextActivity").textContent=next?.label||"Journée libre";
  const spent=linkedExpenses.reduce((sum,item)=>sum+expenseCad(item),0);
  $("todayPremiumSpend").textContent=dashboardMoney(spent);
  const weatherKey=cityWeatherKey(city);
  const weather=weatherData?.[weatherKey];
  const pill=$("todayPremiumWeatherPill");
  if(pill){
    if(weather){
      const info=weatherCodeInfo(weather.current.weather_code);
      pill.textContent=`${info.icon} ${Math.round(weather.current.temperature_2m)} °C · ${info.label}`;
    }else pill.textContent="🌤️ Météo à venir";
  }
  const scrollNext=()=>{
    const events=[...document.querySelectorAll("#todaySchedule .today-event")];
    if(!events.length) return;
    const target=events[Math.min(next?.index||0,events.length-1)];
    events.forEach(item=>item.classList.remove("today-v941-next-highlight"));
    target.classList.add("today-v941-next-highlight");
    target.scrollIntoView({behavior:"smooth",block:"center"});
  };
  $("todayNextActivity").onclick=scrollNext;
  $("todayNextActivityInline").onclick=scrollNext;
}
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-today-scroll]");
  if(!button) return;
  $(button.dataset.todayScroll)?.scrollIntoView({behavior:"smooth",block:"center"});
});
$("todayOpenMemory")?.addEventListener("click",()=>{
  const day=selectedTodayDay();
  if(day) openDayDetail(day.id);
});

function renderToday(){
  const day = selectedTodayDay();
  const empty = $("todayEmpty");
  const content = $("todayContent");
  if(!empty || !content) return;
  if(!day){
    empty.hidden = false;
    content.hidden = true;
    return;
  }
  empty.hidden = true;
  content.hidden = false;
  todaySelectedDayId = day.id;
  setTimeout(renderSavedHerePlaces,0);
  const nowKey = localDateKey();
  const firstId = itineraryDays[0]?.id;
  const lastId = itineraryDays[itineraryDays.length-1]?.id;
  let mode = "Prochaine journée";
  if(day.id === nowKey) mode = "Aujourd’hui";
  else if(nowKey > lastId) mode = "Dernière journée du voyage";
  else if(nowKey < firstId) mode = "Aperçu avant le départ";
  $("todayModeLabel").textContent = mode;
  $("todayHeading").textContent = day.id === nowKey ? "Aujourd’hui" : "Ma journée";
  $("todayDateLabel").textContent = formatDateFr(day.id);
  $("todayCity").textContent = cityForDay(day) || "Destination à compléter";
  $("todayTitle").textContent = firstValue(day,["title","name"]) || "Journée en Italie";
  $("todayOpenDay").onclick = () => openDayDetail(day.id);

  const entries = scheduleEntries(day);
  $("todaySchedule").innerHTML = entries.length ? entries.map((entry,index)=>{
    const match = String(entry).match(/^\s*([0-2]?\d[:h][0-5]\d)\s*[—–-]?\s*(.*)$/i);
    const time = match ? match[1].replace("h",":") : "";
    const label = match ? match[2] : entry;
    return `<article class="today-event today-v942-event" data-today-event-index="${index}" data-today-event-time="${esc(time)}" data-today-event-label="${esc(label)}">
      <button type="button" class="today-v942-check" aria-label="Marquer ${esc(label)} comme terminée" aria-pressed="false"><span>✓</span></button>
      <span class="today-event-time">${time ? esc(time) : String(index+1).padStart(2,"0")}</span>
      <span class="today-v942-event-copy"><strong>${esc(label)}</strong><small>À venir</small></span>
      <span class="today-v942-event-status">À faire</span>
    </article>`;
  }).join("") : emptyTodayValue("Aucune activité inscrite");

  const hotel = firstValue(day,["hotel","accommodation"]);
  $("todayHotel").innerHTML = hotel ? esc(displayValue(hotel)) : emptyTodayValue();
  const transport = firstValue(day,["transport","train","flight"]);
  $("todayTransport").innerHTML = transport ? esc(displayValue(transport)) : emptyTodayValue();
  const notes = firstValue(day,["notes","description"]);
  $("todayNotes").innerHTML = notes ? esc(displayValue(notes)) : emptyTodayValue("Aucune note");

  const linkedBookings = bookings.filter(item => item && item.date === day.id).sort(compareBookings);
  $("todayBookings").innerHTML = linkedBookings.length ? linkedBookings.map(item => `
    <div class="today-mini-item"><strong>${esc(item.type || "Réservation")}</strong><span>${esc(item.name || "Détails à compléter")}${item.time ? ` · ${esc(item.time)}` : ""}</span></div>`).join("") : emptyTodayValue("Aucune réservation liée");

  const linkedExpenses = expenses.filter(item => item && item.date === day.id);
  const totalCad = linkedExpenses.reduce((sum,item)=>sum+expenseCad(item),0);
  $("todayBudget").innerHTML = `<strong>${dashboardMoney(totalCad)}</strong><span>${linkedExpenses.length} dépense${linkedExpenses.length===1?"":"s"} enregistrée${linkedExpenses.length===1?"":"s"}</span>`;
  updateTodayPremium(day,mode,entries,linkedExpenses);

  const index = itineraryDays.findIndex(item => item.id === day.id);
  const previous = $("todayPrevious");
  const next = $("todayNext");
  previous.disabled = index <= 0;
  next.disabled = index < 0 || index >= itineraryDays.length-1;
  previous.onclick = () => { if(index>0){ todaySelectedDayId=itineraryDays[index-1].id; renderToday(); window.scrollTo({top:0,behavior:"smooth"}); }};
  next.onclick = () => { if(index<itineraryDays.length-1){ todaySelectedDayId=itineraryDays[index+1].id; renderToday(); window.scrollTo({top:0,behavior:"smooth"}); }};

  document.dispatchEvent(new CustomEvent("today:rendered",{
    detail:{dayId:day.id,city:cityForDay(day)||"Italie",entries:[...entries]}
  }));
}
window.renderToday = renderToday;

function dashboardMoney(value){
  return new Intl.NumberFormat("fr-CA",{
    style:"currency", currency:"CAD"
  }).format(value || 0);
}

function renderHomePriorities(){
  const root = $("weeklyFocusList");
  const summary = $("weeklyFocusSummary");
  if(!root || !summary) return;

  const priorities = [];
  const days = daysUntilDeparture();

  automaticPreparationTasks
    .filter(task => !prepAutomatic[task.id] && days <= task.days)
    .slice(0, 2)
    .forEach(task => priorities.push({
      kind:"automatic", id:task.id, icon:task.icon, text:task.text
    }));

  (checks.todo || []).forEach((item,index) => {
    if(!item.done && priorities.length < 5){
      priorities.push({kind:"todo", index, icon:"✓", text:item.t});
    }
  });

  root.innerHTML = "";
  if(!priorities.length){
    summary.textContent = "Tout est à jour pour le moment.";
    root.innerHTML = '<div class="weekly-focus-empty">🎉 Aucune priorité urgente. Profite de ce moment!</div>';
    return;
  }

  summary.textContent = `${priorities.length} action${priorities.length === 1 ? "" : "s"} à faire en priorité.`;
  priorities.forEach(item => {
    const label = document.createElement("label");
    label.className = "weekly-focus-item";
    const action = item.kind === "automatic"
      ? `toggleAutomaticPrep('${item.id}',this.checked)`
      : `toggleCheck('todo',${item.index},this.checked)`;
    label.innerHTML = `<input type="checkbox" onchange="${action}"><span class="weekly-focus-icon">${item.icon}</span><span>${esc(item.text)}</span>`;
    root.appendChild(label);
  });
}



function premiumTripPhase(){
  const start=new Date("2026-09-28T00:00:00");
  const end=new Date("2026-10-16T23:59:59");
  const now=new Date();

  if(now<start){
    return {
      key:"before",
      icon:"✈️",
      label:"Avant le départ",
      title:"L’aventure commence bientôt",
      message:"Préparez chaque détail et profitez déjà de l’attente."
    };
  }

  if(now<=end){
    return {
      key:"during",
      icon:"📍",
      label:"Voyage en cours",
      title:"Profitez pleinement de votre journée",
      message:"Tout ce qu’il faut pour vivre l’Italie, aujourd’hui."
    };
  }

  return {
    key:"after",
    icon:"📖",
    label:"Après le voyage",
    title:"Revivez vos plus beaux souvenirs",
    message:"Vos photos, vos coups de cœur et votre histoire vous attendent."
  };
}

function applyPremiumTripPhase(){
  const phase=premiumTripPhase();
  document.body.dataset.tripPhase=phase.key;

  const icon=$("premiumPhaseIcon");
  const label=$("premiumPhaseLabel");
  const title=$("premiumCurrentCity");
  const message=$("premiumPhaseMessage");

  if(icon) icon.textContent=phase.icon;
  if(label) label.textContent=phase.label;
  if(title) title.textContent=phase.title;
  if(message) message.textContent=phase.message;

  return phase;
}


function renderCockpitExtras(phase,today){
  const phaseIcon=$("premiumPhaseIconCockpit");
  const phaseLabel=$("premiumPhaseLabelCockpit");
  if(phaseIcon) phaseIcon.textContent=phase.icon;
  if(phaseLabel) phaseLabel.textContent=phase.label;

  const weather=$("homeCockpitWeather");
  const weatherMini=document.querySelector("#homeWeatherStrip .home-weather-mini");
  if(weather){
    const temp=weatherMini?.querySelector("strong")?.textContent?.trim();
    const city=weatherMini?.querySelector("small")?.textContent?.trim();
    weather.textContent=temp ? `${temp}${city?` · ${city}`:""}` : "Voir les prévisions";
  }

  const tip=$("homeCockpitTip");
  const moment=$("homeCockpitMoment");
  const city=today ? cityForDay(today) : "";

  if(phase.key==="before"){
    if(tip) tip.textContent="Vérifiez vos documents, vos réservations et votre liste de valise.";
    if(moment) moment.textContent="L’attente fait déjà partie de l’aventure.";
  }else if(phase.key==="during"){
    if(tip) tip.textContent=city
      ? `Prenez le temps de vivre pleinement votre journée à ${city}.`
      : "Gardez vos billets et votre programme du jour à portée de main.";
    if(moment) moment.textContent="Enregistrez une photo ou un coup de cœur avant ce soir.";
  }else{
    if(tip) tip.textContent="Choisissez vos plus belles photos pour compléter votre carnet.";
    if(moment) moment.textContent="Vos souvenirs sont prêts à être revécus.";
  }
}

function renderPremiumHome(){
  const phase=applyPremiumTripPhase();
  const today=selectedTodayDay();
  const first=itineraryDays[0], last=itineraryDays[itineraryDays.length-1];
  const nowKey=localDateKey();
  const tripStarted=first && nowKey>=first.id;
  const tripFinished=last && nowKey>last.id;

  let progress=0;
  let title="Préparation en cours";
  let left=`${itineraryDays.length || 18} jours de voyage`;
  let right="Départ le 28 septembre";

  if(tripStarted && !tripFinished){
    const idx=Math.max(0,itineraryDays.findIndex(d=>d.id>=nowKey));
    progress=Math.round(((idx+1)/Math.max(1,itineraryDays.length))*100);
    title=`Jour ${idx+1} sur ${itineraryDays.length}`;
    left=`${idx+1} jours commencés`;
    right=`${Math.max(0,itineraryDays.length-idx-1)} jours restants`;
  }else if(tripFinished){
    progress=100;
    title="Voyage terminé";
    left="De magnifiques souvenirs";
    right="À revivre quand vous voulez";
  }else{
    const prep=Number(($("preparationPercent")?.textContent||"0").replace(/\D/g,""))||0;
    progress=prep;
  }

  $("premiumProgressPercent").textContent=`${progress} %`;
  $("premiumProgressBar").style.width=`${progress}%`;
  $("premiumProgressTitle").textContent=title;
  $("premiumProgressLeft").textContent=left;
  $("premiumProgressRight").textContent=right;

  if(today){
    const city=cityForDay(today)||"Italie";
    $("premiumCurrentDate").textContent=tripStarted && !tripFinished
      ? `${formatDateFr(today.id)} · ${city}`
      : "28 septembre au 16 octobre 2026";

    $("premiumTodayTitle").textContent=
      phase.key==="before" ? "Préparer le voyage" :
      phase.key==="during" ? city :
      "Revivre le voyage";

    const items=[];
    const hotel=firstValue(today,["hotel","accommodation"]);
    const transport=firstValue(today,["transport","train","flight"]);
    const acts=valueItems(firstValue(today,["activities","activity","schedule"]));

    if(hotel) items.push(["🏨",displayValue(hotel)]);
    if(transport) items.push(["🚆",displayValue(transport)]);
    if(acts[0]) items.push(["🥾",acts[0]]);

    if(!items.length){
      items.push(
        phase.key==="before"
          ? ["✨","Consultez la prochaine journée et complétez les détails"]
          : phase.key==="during"
            ? ["📍","Ouvrez la journée pour voir le programme complet"]
            : ["📖","Ouvrez vos souvenirs et revivez cette étape"]
      );
    }

    $("premiumTodayDetails").innerHTML=items
      .map(i=>`<div><span>${i[0]}</span><span>${esc(i[1])}</span></div>`)
      .join("");
  }

  const spent=expenses.reduce((sum,item)=>sum+expenseCad(item),0);
  const planned=Number(plannedBudgetValue)||0;
  $("premiumBudgetRemaining").textContent=dashboardMoney(Math.max(0,planned-spent));
  $("premiumPhotoCount").textContent=itineraryDays.reduce(
    (n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0
  );
  $("premiumFavoriteCount").textContent=itineraryDays.filter(
    d=>Number.isInteger(Number(d.favoritePhotoIndex))&&Number(d.favoritePhotoIndex)>=0
  ).length;
  $("premiumPlaceCount").textContent=itineraryDays.reduce(
    (n,d)=>n+(Array.isArray(d.herePlaces)?d.herePlaces.length:0),0
  );

  renderCockpitExtras(phase,today);
}

function renderDashboard(){
  renderToday();
  renderHomePriorities();
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

  const confirmedStatuses = new Set(["Réservé","Payé"]);
  const confirmedBookings = bookings.filter(item => item && confirmedStatuses.has(item.status)).length;
  const confirmedLabel = confirmedBookings === 1 ? "confirmée" : "confirmées";
  const bookingLabel = bookings.length === 1 ? "réservation" : "réservations";
  $("dashboardConfirmedBookings").textContent = `${confirmedBookings} ${confirmedLabel}`;
  $("dashboardConfirmedDetails").textContent = `Sur ${bookings.length} ${bookingLabel}`;

  const detailedDays = itineraryDays.filter(dayIsDetailed).length;
  const dayScore = itineraryDays.length ? detailedDays / itineraryDays.length : 0;
  const bookingScore = bookings.length ? confirmedBookings / bookings.length : 0;
  const checklistScore = allChecks.length ? completed / allChecks.length : 0;
  const budgetScore = Number(plannedBudgetValue) > 0 ? 1 : 0;
  const preparationPercent = Math.round((dayScore * 35) + (bookingScore * 30) + (checklistScore * 25) + (budgetScore * 10));
  $("preparationPercent").textContent = `${preparationPercent} %`;
  $("preparationProgressBar").style.width = `${preparationPercent}%`;
  $("preparationSummary").textContent = preparationPercent >= 80
    ? "Le voyage est presque prêt. Il reste seulement quelques détails à finaliser."
    : preparationPercent >= 45
      ? "La préparation avance bien. Continue les réservations et les listes."
      : "Commence par compléter l’itinéraire, les réservations et les préparatifs.";

  const detailItems = [
    ["🗓️", `${detailedDays}/${itineraryDays.length || 0} journées détaillées`, dayScore],
    ["🎟️", `${confirmedBookings}/${bookings.length || 0} réservations confirmées`, bookingScore],
    ["🧳", `${completed}/${allChecks.length || 0} préparatifs terminés`, checklistScore],
    ["💶", Number(plannedBudgetValue) > 0 ? "Budget défini" : "Budget à définir", budgetScore]
  ];
  $("preparationDetails").innerHTML = detailItems.map(([icon,label,score]) =>
    `<div class="preparation-item ${score >= 1 ? "complete" : ""}"><span>${icon}</span><strong>${esc(label)}</strong></div>`
  ).join("");

  const startButton = $("startDayButton");
  if(startButton){
    const firstId = itineraryDays[0]?.id || "";
    const lastId = itineraryDays[itineraryDays.length-1]?.id || "";
    startButton.textContent = nowKey < firstId
      ? "▶️ Voir ma prochaine journée"
      : nowKey > lastId && lastId
        ? "📖 Revoir mon voyage"
        : "▶️ Commencer ma journée";
  }
  renderPremiumHome();
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
let prepAutomatic = LS.get("italie_prepAutomatic", {});

const automaticPreparationTasks = [
  {id:"passport", icon:"🛂", days:120, text:"Vérifier la validité des passeports"},
  {id:"insurance", icon:"🛡️", days:90, text:"Choisir ou confirmer l’assurance voyage"},
  {id:"car", icon:"🚗", days:60, text:"Confirmer la voiture de location en Toscane"},
  {id:"bookings", icon:"🎟️", days:30, text:"Télécharger les billets et confirmations"},
  {id:"bank", icon:"💳", days:14, text:"Aviser la banque et vérifier les cartes"},
  {id:"euros", icon:"💶", days:10, text:"Préparer ou commander des euros"},
  {id:"offline", icon:"🗺️", days:7, text:"Télécharger les cartes hors ligne"},
  {id:"packing", icon:"🧳", days:5, text:"Finaliser les valises"},
  {id:"weather", icon:"🌤️", days:3, text:"Vérifier la météo et ajuster les vêtements"},
  {id:"checkin", icon:"✈️", days:1, text:"Faire le check-in du vol dès qu’il ouvre"},
  {id:"charge", icon:"🔋", days:1, text:"Charger les appareils et la batterie externe"}
];

function currentState(){
  return {
    bookings,
    expenses,
    checks,
    notes,
    eurRate: eurRateValue,
    plannedBudget: plannedBudgetValue,
    prepAutomatic,
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
  LS.set("italie_prepAutomatic", prepAutomatic);
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

let editingBookingId = null;
let activeBookingId = null;
function bookingById(id){return bookings.find(item=>item&&item.id===id)}
function bookingIndexById(id){return bookings.findIndex(item=>item&&item.id===id)}
function bookingDateText(date,time){return [date?formatDateFr(date):"",time||""].filter(Boolean).join(" · ")}
function bookingMapUrl(b){const q=[b.address,b.name,b.city].filter(Boolean).join(", ");return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:""}
function normalizedPhone(v){return String(v||"").replace(/[^\d+]/g,"")}


// ===== Documents hors ligne des réservations — 0.9.7.0 =====
const BOOKING_DOC_DB="mon-carnet-booking-documents";
const BOOKING_DOC_STORE="documents";
const BOOKING_DOC_MAX_FILES=8;
const BOOKING_DOC_MAX_BYTES=8*1024*1024;
function bookingDocumentDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(BOOKING_DOC_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(BOOKING_DOC_STORE)){const store=db.createObjectStore(BOOKING_DOC_STORE,{keyPath:"id"});store.createIndex("bookingId","bookingId",{unique:false})}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("IndexedDB indisponible"))})}
async function bookingDocumentsFor(bookingId){const db=await bookingDocumentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(BOOKING_DOC_STORE,"readonly"),index=tx.objectStore(BOOKING_DOC_STORE).index("bookingId"),request=index.getAll(bookingId);request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)));request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close()})}
async function saveBookingDocument(record){const db=await bookingDocumentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(BOOKING_DOC_STORE,"readwrite");tx.objectStore(BOOKING_DOC_STORE).put(record);tx.oncomplete=()=>{db.close();resolve(record)};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function deleteBookingDocumentRecord(id){const db=await bookingDocumentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(BOOKING_DOC_STORE,"readwrite");tx.objectStore(BOOKING_DOC_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function deleteAllBookingDocuments(bookingId){const docs=await bookingDocumentsFor(bookingId);await Promise.all(docs.map(item=>deleteBookingDocumentRecord(item.id)))}
function bookingDocumentIcon(type="",name=""){if(type==="application/pdf"||String(name).toLowerCase().endsWith(".pdf"))return"📄";if(String(type).startsWith("image/"))return"🖼️";return"📎"}
function bookingDocumentSize(bytes=0){if(bytes<1024)return`${bytes} o`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} Ko`;return`${(bytes/1024/1024).toFixed(1)} Mo`}
function bookingDocumentDate(timestamp){return new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"short",year:"numeric"}).format(new Date(timestamp||Date.now()))}
async function renderBookingDocuments(bookingId){const root=$("bookingDocumentsList"),status=$("bookingDocumentStatus");if(!root)return;root.innerHTML='<div class="booking-document-empty">Chargement des documents…</div>';try{const docs=await bookingDocumentsFor(bookingId);if(activeBookingId!==bookingId)return;root.innerHTML="";if(!docs.length){root.innerHTML='<div class="booking-document-empty">Aucun document ajouté. Les billets et confirmations pourront être consultés même sans connexion.</div>';return}docs.forEach(item=>{const row=document.createElement("article");row.className="booking-document-item";row.innerHTML=`<div class="booking-document-icon">${bookingDocumentIcon(item.type,item.name)}</div><div class="booking-document-copy"><strong title="${esc(item.name)}">${esc(item.name)}</strong><small>${esc(bookingDocumentSize(item.size))} · ${esc(bookingDocumentDate(item.createdAt))}</small></div><div class="booking-document-actions"><button type="button" data-doc-open>👁 Ouvrir</button><button type="button" data-doc-share>📤 Partager</button><button type="button" class="danger" data-doc-delete>🗑️</button></div>`;row.querySelector("[data-doc-open]").onclick=()=>openBookingDocument(item);row.querySelector("[data-doc-share]").onclick=()=>shareBookingDocument(item);row.querySelector("[data-doc-delete]").onclick=()=>removeBookingDocument(item);root.appendChild(row)});if(status)status.textContent=`${docs.length} document${docs.length>1?"s":""} disponible${docs.length>1?"s":""} hors ligne.`}catch(error){console.error("Lecture des documents impossible",error);root.innerHTML='<div class="booking-document-empty">⚠️ Les documents ne peuvent pas être lus sur ce navigateur.</div>'}}
function bookingDocumentUrl(item){return URL.createObjectURL(item.blob)}
function openBookingDocument(item){const url=bookingDocumentUrl(item);const popup=window.open(url,"_blank","noopener");if(!popup){const a=document.createElement("a");a.href=url;a.download=item.name||"document";a.click()}setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function shareBookingDocument(item){const file=new File([item.blob],item.name,{type:item.type||item.blob?.type||"application/octet-stream"});if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:item.name});return}catch(error){if(error?.name==="AbortError")return}}const url=bookingDocumentUrl(item);const a=document.createElement("a");a.href=url;a.download=item.name||"document";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function removeBookingDocument(item){if(!confirm(`Supprimer le document « ${item.name} » ?`))return;const status=$("bookingDocumentStatus");if(status)status.textContent="Suppression…";try{await deleteBookingDocumentRecord(item.id);await renderBookingDocuments(item.bookingId)}catch(error){console.error(error);if(status)status.textContent="⚠️ Suppression impossible."}}
async function addBookingDocuments(files){const bookingId=activeBookingId,status=$("bookingDocumentStatus"),input=$("bookingDocumentInput");if(!bookingId||!files?.length)return;try{const existing=await bookingDocumentsFor(bookingId);const available=Math.max(0,BOOKING_DOC_MAX_FILES-existing.length);if(!available){status.textContent=`Maximum de ${BOOKING_DOC_MAX_FILES} documents atteint.`;return}const selected=[...files].slice(0,available);for(const file of selected){if(!(file.type==="application/pdf"||file.type.startsWith("image/"))){status.textContent=`⚠️ ${file.name} n’est pas un PDF ou une image.`;continue}if(file.size>BOOKING_DOC_MAX_BYTES){status.textContent=`⚠️ ${file.name} dépasse 8 Mo.`;continue}status.textContent=`Ajout de ${file.name}…`;await saveBookingDocument({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,bookingId,name:file.name||"document",type:file.type,size:file.size,createdAt:Date.now(),blob:file})}await renderBookingDocuments(bookingId)}catch(error){console.error("Ajout de document impossible",error);status.textContent="⚠️ Impossible d’ajouter ce document."}finally{if(input)input.value=""}}
// Le sélecteur est un <label for="bookingDocumentInput"> : l’ouverture du
// dialogue de fichiers est donc native et ne dépend plus d’un clic JavaScript.
window.addBookingDocuments = addBookingDocuments;
const bookingDocumentInput = $("bookingDocumentInput");
bookingDocumentInput?.addEventListener("change", event => {
  const files = event.currentTarget?.files;
  addBookingDocuments(files);
});
$("bookingAddDocument")?.addEventListener("click", () => bookingDocumentInput?.click());

// ===== Centre de voyage intelligent — Hôtel Premium 1.0.0 =====
function bookingNights(b){
  if(!b?.date || !b?.endDate) return 0;
  const start=new Date(b.date+"T12:00:00"), end=new Date(b.endDate+"T12:00:00");
  return Math.max(0,Math.round((end-start)/86400000));
}
function bookingStarsText(value){
  const n=Math.max(0,Math.min(5,Number(value)||0));
  return n ? "★".repeat(n)+"☆".repeat(5-n) : "";
}
function bookingDateTime(b,end=false){
  const date=end?b.endDate:b.date, time=end?b.endTime:b.time;
  if(!date) return null;
  const parts=date.split("-").map(Number);
  const hm=(time||"00:00").split(":").map(Number);
  return new Date(parts[0],parts[1]-1,parts[2],hm[0]||0,hm[1]||0,0,0);
}
function hotelSmartMessage(b){
  const now=new Date(), checkIn=bookingDateTime(b,false), checkOut=bookingDateTime(b,true);
  if(checkOut && now>checkOut) return {state:"done",icon:"✅",text:"Séjour terminé — vos documents restent disponibles."};
  if(checkOut && now.toDateString()===checkOut.toDateString() && now<checkOut){
    return {state:"urgent",icon:"⏰",text:`Départ avant ${b.endTime||"l’heure prévue"}.`};
  }
  if(checkIn && now<checkIn){
    const mins=Math.max(0,Math.round((checkIn-now)/60000));
    if(mins<24*60){
      const h=Math.floor(mins/60), m=mins%60;
      return {state:"soon",icon:"⏳",text:`Check-in dans ${h?`${h} h `:""}${m} min.`};
    }
    return {state:"planned",icon:"🏨",text:`Arrivée prévue le ${formatDateFr(b.date)}${b.time?` à ${b.time}`:""}.`};
  }
  if(checkIn && (!checkOut || now<checkOut)) return {state:"available",icon:"🟢",text:"Check-in disponible maintenant."};
  return {state:"planned",icon:"🏨",text:"Séjour hôtel prêt à consulter."};
}
function renderHotelPremium(b){
  const block=$("hotelPremiumBlock"); if(!block) return;
  const isHotel=b.type==="Hôtel";
  block.hidden=!isHotel;
  document.querySelector(".booking-detail-sheet")?.classList.toggle("hotel-mode",isHotel);
  if(!isHotel) return;
  const cover=$("hotelPremiumCover");
  const photo=safeLink(b.photo)||"assets/toscane-accueil.jpg";
  cover.style.backgroundImage=`linear-gradient(180deg,rgba(7,20,16,.04),rgba(7,20,16,.78)),url("${String(photo).replace(/"/g,"%22")}")`;
  $("hotelPremiumStars").textContent=bookingStarsText(b.stars)||"Hôtel Premium";
  $("hotelPremiumName").textContent=b.name||"Hôtel";
  $("hotelPremiumCity").textContent=b.city?`📍 ${b.city}`:"Destination à préciser";
  const nights=bookingNights(b);
  $("hotelPremiumStay").textContent=[nights?`${nights} nuit${nights>1?"s":""}`:"Séjour",b.room||""].filter(Boolean).join(" · ");
  const msg=hotelSmartMessage(b), banner=$("hotelSmartBanner");
  banner.className=`hotel-smart-banner ${msg.state}`;
  banner.innerHTML=`<span>${msg.icon}</span><strong>${esc(msg.text)}</strong>`;
  const metrics=[
    ["🕒","Check-in",b.time||"À préciser"],
    ["🕚","Check-out",b.endTime||"À préciser"],
    ["🌙","Séjour",nights?`${nights} nuit${nights>1?"s":""}`:"À calculer"],
    ["👥","Voyageurs",b.travelers?String(b.travelers):"À préciser"],
    ["🛏️","Chambre",b.room||"À préciser"],
    ["💶","Total",bookingMoney(b)||"À préciser"]
  ];
  $("hotelPremiumMetrics").innerHTML=metrics.map(([icon,label,value])=>`<article><span>${icon}</span><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join("");
  const checks=[
    ["Confirmation",Boolean(b.conf)],
    ["Paiement",b.status==="Payé"],
    ["Adresse",Boolean(b.address)],
    ["Téléphone",Boolean(b.phone)],
    ["Dates et heures",Boolean(b.date&&b.endDate&&b.time&&b.endTime)],
    ["Chambre / voyageurs",Boolean(b.room&&b.travelers)]
  ];
  const done=checks.filter(([,ok])=>ok).length, percent=Math.round(done/checks.length*100);
  $("hotelReadinessPercent").textContent=`${percent} %`;
  $("hotelReadinessFill").style.width=`${percent}%`;
  $("hotelReadinessItems").innerHTML=checks.map(([label,ok])=>`<span class="${ok?"ready":"missing"}">${ok?"✓":"!"} ${esc(label)}</span>`).join("");
}
function toggleHotelBookingFields(){
  const section=$("hotelBookingFields"); if(!section) return;
  section.hidden=$("bookType")?.value!=="Hôtel";
}

function createBookingCard(b,i,compact=false){
 const el=document.createElement("article");el.className="booking-card"+(compact?" compact":"");el.tabIndex=0;el.setAttribute("role","button");el.setAttribute("aria-label",`Ouvrir la réservation ${b.name||""}`);
 const link=safeLink(b.link),website=safeLink(b.website);
 el.innerHTML=`<div class="booking-icon">${bookingIcon(b.type)}</div><div class="booking-main"><div class="booking-topline"><strong>${esc(b.name||"Réservation")}</strong><span class="booking-status ${statusClass(b.status||"Réservé")}">${esc(b.status||"Réservé")}</span></div><div class="booking-meta">${[b.type,b.date?formatDateFr(b.date):"",b.time,b.city].filter(Boolean).map(esc).join(" · ")}</div>${b.conf?`<div class="confirmation">Confirmation : <strong>${esc(b.conf)}</strong></div>`:""}${b.notes&&compact?`<p>${esc(b.notes)}</p>`:""}${compact?`<div class="booking-actions">${bookingMoney(b)?`<span class="booking-price">${esc(bookingMoney(b))}</span>`:""}<span class="booking-open-hint">Voir la réservation →</span></div>`:`<div class="booking-card-actions"><button class="booking-card-open" type="button">👁 Voir</button><button class="booking-card-edit" type="button">✏️ Modifier</button>${link?`<a href="${esc(link)}" target="_blank" rel="noopener">🎟️ Billet</a>`:""}${website?`<a href="${esc(website)}" target="_blank" rel="noopener">🌐 Site</a>`:""}<button class="booking-card-delete" type="button">🗑️ Supprimer</button></div>`}</div>`;
 const open=()=>openBookingDetail(b.id);el.addEventListener("click",e=>{if(e.target.closest("button,a"))return;open()});el.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest("button,a")){e.preventDefault();open()}});el.querySelector(".booking-card-open")?.addEventListener("click",open);el.querySelector(".booking-card-edit")?.addEventListener("click",()=>startBookingEdit(b.id));el.querySelector(".booking-card-delete")?.addEventListener("click",()=>delBookingById(b.id));return el
}
function renderBookingSummary(){const paid=bookings.filter(b=>b.status==="Payé").length;const totals=bookings.reduce((s,b)=>{const p=Number(b.price)||0;if((b.currency||"CAD")==="EUR")s.eur+=p;else s.cad+=p;return s},{cad:0,eur:0});$("bookingCount").textContent=bookings.length;$("bookingPaidCount").textContent=paid;const parts=[];if(totals.cad)parts.push(new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(totals.cad));if(totals.eur)parts.push(new Intl.NumberFormat("fr-CA",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(totals.eur));$("bookingTotal").textContent=parts.join(" + ")||"0 $"}
function renderBookings(){renderBookingSummary();const root=$("bookingList");root.innerHTML="";const filtered=bookings.map((b,i)=>({b,i})).filter(({b})=>{const text=[b.type,b.name,b.city,b.date,b.conf,b.notes,b.status,b.address,b.phone,b.email,b.room].join(" ").toLocaleLowerCase("fr-CA");return(!bookingSearchText||text.includes(bookingSearchText))&&(!bookingStatusValue||b.status===bookingStatusValue)}).sort((x,y)=>compareBookings(x.b,y.b));if(!filtered.length)root.innerHTML='<p class="subtle">Aucune réservation ne correspond à ce filtre.</p>';else filtered.forEach(({b,i})=>root.appendChild(createBookingCard(b,i)));renderDashboard()}
function bookingFormData(){return{type:$("bookType").value,status:$("bookStatus").value,city:$("bookCity").value.trim(),name:$("bookName").value.trim(),date:$("bookDate").value,time:$("bookTime").value,endDate:$("bookEndDate").value,endTime:$("bookEndTime").value,conf:$("bookConf").value.trim(),price:Number($("bookPrice").value)||0,currency:$("bookCurrency").value,address:$("bookAddress").value.trim(),phone:$("bookPhone").value.trim(),website:$("bookWebsite").value.trim(),email:$("bookEmail").value.trim(),stars:Number($("bookStars").value)||0,room:$("bookRoom").value.trim(),travelers:Number($("bookTravelers").value)||0,taxes:Number($("bookTaxes").value)||0,photo:$("bookPhoto").value.trim(),link:$("bookLink").value.trim(),notes:$("bookNotes").value.trim()}}
function resetBookingForm(){["bookCity","bookName","bookDate","bookTime","bookEndDate","bookEndTime","bookConf","bookPrice","bookAddress","bookPhone","bookWebsite","bookEmail","bookRoom","bookTravelers","bookTaxes","bookPhoto","bookLink","bookNotes"].forEach(id=>$(id).value="");$("bookStars").value="";$("bookType").value="Hôtel";$("bookStatus").value="À réserver";$("bookCurrency").value="CAD";editingBookingId=null;$("bookingSubmitButton").textContent="Ajouter la réservation";$("bookingCancelEdit").hidden=true;toggleHotelBookingFields()}
function saveBooking(){const data=bookingFormData();if(!data.name){alert("Ajoute au moins un nom ou une compagnie.");return}if(editingBookingId){const i=bookingIndexById(editingBookingId);if(i<0){resetBookingForm();return}bookings[i]={...bookings[i],...data,id:editingBookingId}}else bookings.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),...data});resetBookingForm();renderBookings();scheduleCloudSave()}
window.saveBooking=saveBooking;window.addBooking=saveBooking;
function startBookingEdit(id){const b=bookingById(id);if(!b)return;editingBookingId=id;$("bookType").value=b.type||"Hôtel";$("bookStatus").value=b.status||"À réserver";$("bookCity").value=b.city||"";$("bookName").value=b.name||"";$("bookDate").value=b.date||"";$("bookTime").value=b.time||"";$("bookEndDate").value=b.endDate||"";$("bookEndTime").value=b.endTime||"";$("bookConf").value=b.conf||"";$("bookPrice").value=Number(b.price)||"";$("bookCurrency").value=b.currency||"CAD";$("bookAddress").value=b.address||"";$("bookPhone").value=b.phone||"";$("bookWebsite").value=b.website||"";$("bookEmail").value=b.email||"";$("bookStars").value=Number(b.stars)||"";$("bookRoom").value=b.room||"";$("bookTravelers").value=Number(b.travelers)||"";$("bookTaxes").value=Number(b.taxes)||"";$("bookPhoto").value=b.photo||"";$("bookLink").value=b.link||"";$("bookNotes").value=b.notes||"";toggleHotelBookingFields();$("bookingSubmitButton").textContent="Enregistrer les modifications";$("bookingCancelEdit").hidden=false;closeBookingDetail();document.querySelector(".booking-form")?.scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>$("bookName")?.focus(),350)}
window.startBookingEdit=startBookingEdit;function cancelBookingEdit(){resetBookingForm()}window.cancelBookingEdit=cancelBookingEdit;
function closeBookingDetail(){$("bookingDetailModal").hidden=true;document.body.classList.remove("booking-modal-open");activeBookingId=null}window.closeBookingDetail=closeBookingDetail;
function addBookingFact(root,label,value,icon=""){if(!value)return;const item=document.createElement("div");item.className="booking-detail-fact";item.innerHTML=`<span>${icon} ${esc(label)}</span><strong>${esc(value)}</strong>`;root.appendChild(item)}
function openBookingDetail(id){const b=bookingById(id);if(!b)return;activeBookingId=id;$("bookingDetailIcon").textContent=bookingIcon(b.type);$("bookingDetailType").textContent=b.type||"Réservation";$("bookingDetailTitle").textContent=b.name||"Réservation";$("bookingDetailLocation").textContent=[b.city,b.address].filter(Boolean).join(" · ");$("bookingDetailStatus").textContent=b.status||"Réservé";$("bookingDetailStatus").className=`booking-status ${statusClass(b.status||"Réservé")}`;const facts=$("bookingDetailFacts");facts.innerHTML="";addBookingFact(facts,"Début",bookingDateText(b.date,b.time),"📅");addBookingFact(facts,"Fin / départ",bookingDateText(b.endDate,b.endTime),"📅");addBookingFact(facts,"Prix",bookingMoney(b),"💶");addBookingFact(facts,"Adresse",b.address,"📍");addBookingFact(facts,"Téléphone",b.phone,"☎️");addBookingFact(facts,"Courriel",b.email,"✉️");addBookingFact(facts,"Taxes / frais",b.taxes?new Intl.NumberFormat("fr-CA",{style:"currency",currency:b.currency||"CAD"}).format(Number(b.taxes)):"","🧾");renderHotelPremium(b);$("bookingConfirmationBlock").hidden=!b.conf;$("bookingDetailConfirmation").textContent=b.conf||"";$("bookingDetailNotesBlock").hidden=!b.notes;$("bookingDetailNotes").textContent=b.notes||"";const quick=$("bookingQuickActions");quick.innerHTML="";const maps=bookingMapUrl(b),phone=normalizedPhone(b.phone),website=safeLink(b.website),link=safeLink(b.link),email=String(b.email||"").trim();if(maps)quick.insertAdjacentHTML("beforeend",`<a href="${esc(maps)}" target="_blank" rel="noopener">📍 Ouvrir dans Maps</a>`);if(phone)quick.insertAdjacentHTML("beforeend",`<a href="tel:${esc(phone)}">☎️ Appeler</a>`);if(website)quick.insertAdjacentHTML("beforeend",`<a href="${esc(website)}" target="_blank" rel="noopener">🌐 Site Web</a>`);if(email)quick.insertAdjacentHTML("beforeend",`<a href="mailto:${esc(email)}">✉️ Courriel</a>`);if(link)quick.insertAdjacentHTML("beforeend",`<a href="${esc(link)}" target="_blank" rel="noopener">🎟️ Réservation / billet</a>`);if(b.date)quick.insertAdjacentHTML("beforeend",'<button type="button" data-booking-day>📅 Voir la journée</button>');quick.querySelector("[data-booking-day]")?.addEventListener("click",()=>{closeBookingDetail();openDayDetail(b.date)});$("bookingEditButton").onclick=()=>startBookingEdit(id);$("bookingDeleteButton").onclick=()=>delBookingById(id);$("bookingShareButton").onclick=()=>shareBooking(id);$("bookingCopyConfirmation").onclick=()=>copyBookingConfirmation(id);$("bookingDetailModal").hidden=false;document.body.classList.add("booking-modal-open");$("bookingDocumentStatus").textContent="";renderBookingDocuments(id)}
window.openBookingDetail=openBookingDetail;
async function copyBookingConfirmation(id){const b=bookingById(id);if(!b?.conf)return;try{await navigator.clipboard.writeText(b.conf);$("bookingCopyConfirmation").textContent="✅ Copié";setTimeout(()=>$("bookingCopyConfirmation").textContent="📋 Copier",1200)}catch(e){prompt("Copiez le numéro de confirmation :",b.conf)}}
async function shareBooking(id){const b=bookingById(id);if(!b)return;const text=[`${bookingIcon(b.type)} ${b.name||"Réservation"}`,b.date?bookingDateText(b.date,b.time):"",b.endDate?`Fin : ${bookingDateText(b.endDate,b.endTime)}`:"",b.city||"",b.address||"",b.conf?`Confirmation : ${b.conf}`:"",b.type==="Hôtel"&&b.room?`Chambre : ${b.room}`:"",b.type==="Hôtel"&&b.travelers?`Voyageurs : ${b.travelers}`:"",safeLink(b.link)||safeLink(b.website)||""].filter(Boolean).join("\n");if(navigator.share){try{await navigator.share({title:b.name||"Réservation",text})}catch(e){}}else try{await navigator.clipboard.writeText(text);alert("Les détails de la réservation ont été copiés.")}catch(e){prompt("Copiez les détails de la réservation :",text)}}
function delBookingById(id){const b=bookingById(id);if(!b)return;if(!confirm(`Supprimer la réservation « ${b.name||"Réservation"} » ?`))return;const i=bookingIndexById(id);if(i>=0)bookings.splice(i,1);deleteAllBookingDocuments(id).catch(error=>console.warn("Suppression des documents impossible",error));if(editingBookingId===id)resetBookingForm();closeBookingDetail();renderBookings();scheduleCloudSave()}
window.delBookingById=delBookingById;function delBooking(i){const b=bookings[i];if(b)delBookingById(b.id)}window.delBooking=delBooking;
document.addEventListener("click",e=>{if(e.target.closest("[data-close-booking-detail]"))closeBookingDetail()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("bookingDetailModal").hidden)closeBookingDetail()});
$("bookingSearch").addEventListener("input",e=>{bookingSearchText=e.target.value.trim().toLocaleLowerCase("fr-CA");renderBookings()});$("bookingStatusFilter").addEventListener("change",e=>{bookingStatusValue=e.target.value;renderBookings()});
$("bookType")?.addEventListener("change",toggleHotelBookingFields);
toggleHotelBookingFields();

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
function daysUntilDeparture(){
  const today=new Date();
  today.setHours(0,0,0,0);
  const departure=new Date("2026-09-28T00:00:00");
  return Math.ceil((departure-today)/86400000);
}

function renderPreparationAssistant(){
  const root=$("prepAutomaticList");
  if(!root) return;
  const days=daysUntilDeparture();
  $("prepDaysLeft").textContent=days>0?days:0;
  const title=$("prepAssistantTitle");
  const subtitle=$("prepAssistantSubtitle");
  if(days>0){
    title.textContent="Avant le départ";
    subtitle.textContent=days>30?"Les prochaines tâches apparaîtront au bon moment.":"Voici ce qui mérite ton attention maintenant.";
  }else{
    title.textContent="Voyage en cours ou terminé";
    subtitle.textContent="Tes rappels de préparation restent disponibles comme référence.";
  }
  const visible=automaticPreparationTasks.filter(task=>days<=task.days || prepAutomatic[task.id]);
  root.innerHTML="";
  if(!visible.length){
    root.innerHTML='<p class="subtle">Aucune action urgente pour le moment. Tout est sous contrôle.</p>';
    return;
  }
  visible.forEach(task=>{
    const done=Boolean(prepAutomatic[task.id]);
    const row=document.createElement("label");
    row.className="prep-auto-item"+(done?" complete":"");
    const timing=days>task.days?`Dans ${days-task.days} jours`:(days>0?"À faire maintenant":"À vérifier");
    row.innerHTML=`<input type="checkbox" ${done?"checked":""} onchange="toggleAutomaticPrep('${task.id}',this.checked)"><span class="prep-auto-icon">${task.icon}</span><span class="prep-auto-copy"><strong>${esc(task.text)}</strong><small>${done?"Terminé":timing}</small></span>`;
    root.appendChild(row);
  });
}

function toggleAutomaticPrep(id,value){
  prepAutomatic[id]=Boolean(value);
  renderPreparationAssistant();
  renderDashboard();
  scheduleCloudSave();
}
window.toggleAutomaticPrep=toggleAutomaticPrep;

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
  renderPreparationAssistant();
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
  if(data.prepAutomatic && typeof data.prepAutomatic==="object") prepAutomatic=data.prepAutomatic;

  $("freeNotes").value=notes;
  $("eurRate").value=eurRateValue;
  $("plannedBudget").value=plannedBudgetValue;
  renderBookings();
  renderExpenses();
  renderChecks();
  renderToday();
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
renderPreparationAssistant();
renderDashboard();


// Position actuelle — localisation privée sur l’appareil
let currentLocationWatchId = null;
let currentPositionSnapshot = null;

function setCurrentLocationMessage(message, state=""){
  const status=$("currentLocationStatus");
  const pulse=$("currentLocationPulse");
  if(status) status.textContent=message;
  if(pulse) pulse.className="location-pulse"+(state?" "+state:"");
}

function formatLocationTime(timestamp){
  return new Intl.DateTimeFormat("fr-CA",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(timestamp));
}

function renderCurrentPosition(position){
  currentPositionSnapshot = position;
  const {latitude,longitude,accuracy}=position.coords;
  $("currentLatitude").textContent=latitude.toFixed(6);
  $("currentLongitude").textContent=longitude.toFixed(6);
  $("currentAccuracy").textContent=`± ${Math.round(accuracy)} m`;
  $("currentLocationTime").textContent=formatLocationTime(position.timestamp);
  $("currentLocationDetails").hidden=false;
  const mapLink=$("openCurrentLocationMap");
  mapLink.href=`https://www.google.com/maps?q=${encodeURIComponent(latitude+","+longitude)}`;
  mapLink.hidden=false;
  $("saveHereButton").hidden=false;
  $("stopLocationButton").hidden=false;
  $("locateMeButton").textContent="🔄 Actualiser ma position";
  setCurrentLocationMessage("Position trouvée. Le suivi se met à jour lorsque tu te déplaces.","active");
  updateMapCurrentPosition(latitude, longitude, accuracy);
}

function currentLocationError(error){
  const messages={
    1:"La permission de localisation a été refusée. Autorise-la dans les réglages du navigateur.",
    2:"Ta position est temporairement indisponible.",
    3:"La recherche de ta position a pris trop de temps. Réessaie."
  };
  setCurrentLocationMessage(messages[error.code]||"Impossible d’obtenir ta position.","error");
  $("locateMeButton").disabled=false;
}

function startCurrentLocation(){
  if(!navigator.geolocation){
    setCurrentLocationMessage("La localisation n’est pas prise en charge par ce navigateur.","error");
    return;
  }
  if(currentLocationWatchId!==null){
    navigator.geolocation.clearWatch(currentLocationWatchId);
    currentLocationWatchId=null;
  }
  $("locateMeButton").disabled=true;
  setCurrentLocationMessage("Recherche de ta position…","active");
  currentLocationWatchId=navigator.geolocation.watchPosition(
    position=>{
      $("locateMeButton").disabled=false;
      renderCurrentPosition(position);
    },
    currentLocationError,
    {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
  );
}

function stopCurrentLocation(){
  if(currentLocationWatchId!==null){
    navigator.geolocation.clearWatch(currentLocationWatchId);
    currentLocationWatchId=null;
  }
  $("stopLocationButton").hidden=true;
  $("locateMeButton").disabled=false;
  $("locateMeButton").textContent="📍 Afficher ma position";
  setCurrentLocationMessage("Suivi arrêté. La dernière position reste affichée.");
}


function renderSavedHerePlaces(){
  const root=$("savedHereList");
  if(!root) return;
  const day=itineraryDays.find(item=>item.id===todaySelectedDayId);
  const places=Array.isArray(day?.herePlaces)?day.herePlaces:[];
  if(!places.length){
    root.innerHTML="";
    return;
  }
  root.innerHTML=`<h3>📌 Endroits enregistrés aujourd’hui</h3>${places.slice().reverse().map(place=>`
    <article class="saved-here-item">
      <div><strong>${esc(place.name||"Endroit sans nom")}</strong><small>${esc(place.time||"")}${place.note?` · ${esc(place.note)}`:""}</small></div>
      <a href="https://www.google.com/maps?q=${encodeURIComponent(place.latitude+","+place.longitude)}" target="_blank" rel="noopener">Voir sur la carte</a>
    </article>`).join("")}`;
}

function openHereModal(){
  if(!currentPositionSnapshot){
    setCurrentLocationMessage("Affiche d’abord ta position actuelle.","error");
    return;
  }
  const modal=$("hereModal");
  $("herePlaceName").value="";
  $("herePlaceNote").value="";
  $("hereModalStatus").textContent="";
  modal.hidden=false;
  setTimeout(()=>$("herePlaceName").focus(),50);
}

function closeHereModal(){ $("hereModal").hidden=true; }

async function saveHerePlace(){
  if(!currentPositionSnapshot || !todaySelectedDayId) return;
  const name=$("herePlaceName").value.trim();
  const note=$("herePlaceNote").value.trim();
  if(!name){
    $("hereModalStatus").textContent="Écris un nom pour cet endroit.";
    return;
  }
  const day=itineraryDays.find(item=>item.id===todaySelectedDayId);
  const existing=Array.isArray(day?.herePlaces)?day.herePlaces:[];
  const {latitude,longitude,accuracy}=currentPositionSnapshot.coords;
  const timestamp=Date.now();
  const place={
    name,note,latitude,longitude,accuracy:Math.round(accuracy||0),timestamp,
    time:new Intl.DateTimeFormat("fr-CA",{hour:"2-digit",minute:"2-digit"}).format(new Date(timestamp))
  };
  $("hereModalSave").disabled=true;
  $("hereModalStatus").textContent="Enregistrement…";
  try{
    await setDoc(doc(db,"Trips","italy-2026","Days",todaySelectedDayId),{herePlaces:[...existing,place]},{merge:true});
    $("hereModalStatus").textContent="✅ Endroit enregistré.";
    setTimeout(closeHereModal,500);
  }catch(error){
    console.error("Enregistrement de l’endroit impossible :",error);
    $("hereModalStatus").textContent="⚠️ Impossible d’enregistrer. Réessaie.";
  }finally{
    $("hereModalSave").disabled=false;
  }
}

$("saveHereButton")?.addEventListener("click",openHereModal);
$("hereModalSave")?.addEventListener("click",saveHerePlace);
$("hereModalCancel")?.addEventListener("click",closeHereModal);
$("hereModal")?.addEventListener("click",e=>{if(e.target.id==="hereModal") closeHereModal();});

$("locateMeButton")?.addEventListener("click",startCurrentLocation);
$("stopLocationButton")?.addEventListener("click",stopCurrentLocation);
window.addEventListener("pagehide",()=>{
  if(currentLocationWatchId!==null) navigator.geolocation.clearWatch(currentLocationWatchId);
});



// Carte interactive du voyage
let tripMap = null;
let tripRouteLayer = null;
let tripMarkersLayer = null;
let hereMarkersLayer = null;
let mapCurrentMarker = null;
let mapCurrentAccuracy = null;

const ITALY_CITY_COORDS = {
  "rome":[41.9028,12.4964], "roma":[41.9028,12.4964],
  "cinque terre":[44.1461,9.6439], "monterosso":[44.1462,9.6546],
  "vernazza":[44.1349,9.6849], "corniglia":[44.1203,9.7095],
  "manarola":[44.1075,9.7274], "riomaggiore":[44.0999,9.7387],
  "florence":[43.7696,11.2558], "firenze":[43.7696,11.2558],
  "venise":[45.4408,12.3155], "venezia":[45.4408,12.3155],
  "toscane":[43.3188,11.3308], "tuscany":[43.3188,11.3308],
  "greve in chianti":[43.5851,11.3167], "panzano":[43.5447,11.3141],
  "sienne":[43.3188,11.3308], "siena":[43.3188,11.3308],
  "pise":[43.7228,10.4017], "pisa":[43.7228,10.4017],
  "milan":[45.4642,9.1900], "milano":[45.4642,9.1900],
  "naples":[40.8518,14.2681], "napoli":[40.8518,14.2681]
};

function normalizedPlaceName(value=""){
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function coordinatesForDay(day){
  const lat=Number(day.latitude ?? day.lat);
  const lng=Number(day.longitude ?? day.lng ?? day.lon);
  if(Number.isFinite(lat)&&Number.isFinite(lng)) return [lat,lng];
  const city=normalizedPlaceName(cityForDay(day));
  if(ITALY_CITY_COORDS[city]) return ITALY_CITY_COORDS[city];
  const found=Object.keys(ITALY_CITY_COORDS).find(key=>city.includes(key)||key.includes(city));
  return found?ITALY_CITY_COORDS[found]:null;
}
function mapStageData(){
  const groups=[];
  itineraryDays.forEach(day=>{
    const city=cityForDay(day);
    const coords=coordinatesForDay(day);
    if(!city||!coords) return;
    const key=normalizedPlaceName(city);
    let group=groups.find(item=>item.key===key);
    if(!group){ group={key,city:String(city),coords,days:[]}; groups.push(group); }
    group.days.push(day);
  });
  return groups;
}
function allHerePlaces(){
  return itineraryDays.flatMap(day=>(Array.isArray(day.herePlaces)?day.herePlaces:[]).map(place=>({...place,dayId:day.id,city:cityForDay(day)})));
}
function initTripMap(){
  const root=$("tripMap");
  if(!root) return;
  if(!window.L){ $("mapStatus").textContent="La carte n’a pas pu charger. Vérifie ta connexion Internet."; return; }
  if(!tripMap){
    tripMap=L.map(root,{zoomControl:true}).setView([43.7,11.7],6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19, attribution:"&copy; OpenStreetMap"
    }).addTo(tripMap);
    tripRouteLayer=L.layerGroup().addTo(tripMap);
    tripMarkersLayer=L.layerGroup().addTo(tripMap);
    hereMarkersLayer=L.layerGroup().addTo(tripMap);
  }
  setTimeout(()=>tripMap.invalidateSize(),100);
  renderTripMapData(true);
}
function stagePopup(stage,index){
  const first=stage.days[0], last=stage.days[stage.days.length-1];
  const photos=stage.days.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0);
  const hotels=[...new Set(stage.days.map(d=>displayValue(firstValue(d,["hotel","accommodation"]))).filter(Boolean))];
  return `<div class="map-popup"><strong>${index+1}. ${esc(stage.city)}</strong><span>${esc(formatDateFr(first.id))}${last.id!==first.id?` au ${esc(formatDateFr(last.id))}`:""}</span>${hotels.length?`<span>🏨 ${esc(hotels[0])}</span>`:""}<span>📸 ${photos} photo${photos===1?"":"s"}</span><button type="button" onclick="openDayDetail('${first.id}')">Voir la journée →</button></div>`;
}


function explorerStageVisual(stage,index,photos){
  const city=normalizedPlaceName(stage.city);
  if(photos.length) return `url("${String(photos[0]).replace(/"/g,"%22")}")`;
  if(city.includes("cinque")||city.includes("manarola")||city.includes("vernazza")) return "linear-gradient(145deg,#315f6c,#d28b62)";
  if(city.includes("florence")||city.includes("firenze")) return "linear-gradient(145deg,#7a5a3a,#c99761)";
  if(city.includes("venise")||city.includes("venezia")) return "linear-gradient(145deg,#3f7182,#d7a46b)";
  if(city.includes("toscane")||city.includes("chianti")||city.includes("sienne")) return "linear-gradient(145deg,#536d3b,#c89c59)";
  if(city.includes("rome")||city.includes("roma")) return "linear-gradient(145deg,#66504a,#c77a58)";
  return index%2 ? "linear-gradient(145deg,#3d6f75,#b77b58)" : "linear-gradient(145deg,#315f50,#7e9a70)";
}


let explorerFeaturedIndex = 0;
let explorerFeaturedStages = [];

function explorerTripProgress(){
  const start=new Date("2026-09-28T00:00:00");
  const end=new Date("2026-10-16T23:59:59");
  const now=new Date();
  if(now<start) return {percent:0,label:"Avant le départ"};
  if(now>end) return {percent:100,label:"Voyage terminé"};
  const percent=Math.max(0,Math.min(100,Math.round((now-start)/(end-start)*100)));
  return {percent,label:"Voyage en cours"};
}

function explorerFeaturedStageIndex(stages){
  if(!stages.length) return 0;
  const today=localDateKey();
  let index=stages.findIndex(stage=>stage.days.some(day=>day.id===today));
  if(index<0) index=stages.findIndex(stage=>stage.days.some(day=>day.id>today));
  return index<0 ? stages.length-1 : index;
}

function renderExplorerFeatured(index=explorerFeaturedIndex){
  const stages=explorerFeaturedStages;
  if(!stages.length) return;
  explorerFeaturedIndex=(Number(index)+stages.length)%stages.length;
  const stage=stages[explorerFeaturedIndex];
  const photos=stage.days.flatMap(day=>Array.isArray(day.photos)?day.photos.filter(Boolean):[]);
  const activities=uniqueStageItems(stage,["activities","activity","schedule"]);
  const restaurants=uniqueStageItems(stage,["restaurants","restaurant"]);
  const memories=stage.days.filter(day=>memoryHasContent(day));
  const visual=explorerStageVisual(stage,explorerFeaturedIndex,photos);
  const featured=$("explorerFeaturedVisual");
  if(featured){
    featured.style.backgroundImage=`linear-gradient(180deg,rgba(7,20,16,.06),rgba(7,20,16,.84)),${visual}`;
  }
  const today=localDateKey();
  const isCurrent=stage.days.some(day=>day.id===today);
  const isPast=stage.days.every(day=>day.id<today);
  $("explorerFeaturedLabel").textContent=isCurrent?"Étape d’aujourd’hui":isPast?"Souvenir du voyage":"Prochaine étape";
  $("explorerFeaturedCity").textContent=stage.city;
  $("explorerFeaturedDates").textContent=stageDateRange(stage);
  $("explorerFeaturedStats").innerHTML=`
    <span>📅 ${stage.days.length} jour${stage.days.length>1?"s":""}</span>
    <span>🥾 ${activities.length} activité${activities.length>1?"s":""}</span>
    <span>🍝 ${restaurants.length} adresse${restaurants.length>1?"s":""}</span>
    <span>❤️ ${memories.length} souvenir${memories.length>1?"s":""}</span>`;
  $("explorerFeaturedCounter").textContent=`${explorerFeaturedIndex+1} / ${stages.length}`;
  setActiveExplorerStage(explorerFeaturedIndex);
}

function renderExplorerOverview(stages){
  explorerFeaturedStages=stages;
  if(!stages.length) return;
  explorerFeaturedIndex=explorerFeaturedStageIndex(stages);
  const progress=explorerTripProgress();
  const totalFavorites=itineraryDays.filter(day=>Number(day.rating||0)>=4||String(day.favorite||"").trim()).length;
  const totalNights=Math.max(0,itineraryDays.length-1);
  $("explorerJourneySummary").textContent=`${stages.length} étapes, ${itineraryDays.length} journées et une aventure à vivre du 28 septembre au 16 octobre 2026.`;
  $("explorerJourneyProgressLabel").textContent=progress.label;
  $("explorerJourneyProgressPercent").textContent=`${progress.percent} %`;
  $("explorerJourneyProgressFill").style.width=`${progress.percent}%`;
  $("explorerOverviewCities").textContent=stages.length;
  $("explorerOverviewNights").textContent=totalNights;
  $("explorerOverviewFavorites").textContent=totalFavorites;
  renderExplorerFeatured(explorerFeaturedIndex);
}

$("explorerFeaturedPrev")?.addEventListener("click",()=>renderExplorerFeatured(explorerFeaturedIndex-1));
$("explorerFeaturedNext")?.addEventListener("click",()=>renderExplorerFeatured(explorerFeaturedIndex+1));
$("explorerFeaturedOpen")?.addEventListener("click",()=>{
  const stage=explorerFeaturedStages[explorerFeaturedIndex];
  if(!stage) return;
  renderMapStageDetails(stage,explorerFeaturedIndex);
  if(tripMap) tripMap.flyTo(stage.coords,10,{duration:1.05});
});


function explorerDestinationStory(stage,index){
  const city=normalizedPlaceName(stage.city);
  if(city.includes("cinque")||city.includes("manarola")||city.includes("vernazza")){
    return {icon:"🌊",eyebrow:"Villages suspendus entre mer et montagne",story:"Sentiers côtiers, maisons colorées et couchers de soleil sur la Méditerranée."};
  }
  if(city.includes("florence")||city.includes("firenze")){
    return {icon:"🏛️",eyebrow:"Art, architecture et douceur toscane",story:"Une étape au cœur de la Renaissance, entre chefs-d’œuvre, ruelles et gelato."};
  }
  if(city.includes("venise")||city.includes("venezia")){
    return {icon:"🚤",eyebrow:"Canaux, palais et lumière sur la lagune",story:"Une ville unique à découvrir à pied, en vaporetto et au fil de l’eau."};
  }
  if(city.includes("toscane")||city.includes("chianti")||city.includes("sienne")){
    return {icon:"🍇",eyebrow:"Routes panoramiques et villages de pierre",story:"Vignobles, cyprès, marchés et longues journées au rythme de la campagne."};
  }
  if(city.includes("rome")||city.includes("roma")){
    return {icon:"🏟️",eyebrow:"Deux mille ans d’histoire à ciel ouvert",story:"Places mythiques, fontaines, ruines antiques et soirées romaines."};
  }
  return {icon:"📍",eyebrow:"Une nouvelle étape de votre histoire",story:"Découvrez les journées, les lieux, les photos et les souvenirs de cette destination."};
}

function explorerDestinationCategory(stage){
  const city=normalizedPlaceName(stage.city);
  if(city.includes("cinque")||city.includes("manarola")||city.includes("vernazza")) return "sea";
  if(city.includes("toscane")||city.includes("chianti")||city.includes("sienne")) return "country";
  return "city";
}

function renderExplorerCityCards(stages){
  const root=$("explorerCityCards");
  if(!root) return;

  const totalPhotos=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0);
  const totalMemories=itineraryDays.filter(d=>memoryHasContent(d)).length;

  $("explorerStageCount") && ($("explorerStageCount").textContent=stages.length);
  $("explorerDayCount") && ($("explorerDayCount").textContent=itineraryDays.length);
  $("explorerPhotoCount") && ($("explorerPhotoCount").textContent=totalPhotos);
  $("explorerMemoryCount") && ($("explorerMemoryCount").textContent=totalMemories);
  $("explorerJourneyLabel") && ($("explorerJourneyLabel").textContent=`${stages.length} étapes · ${itineraryDays.length} jours`);

  if(!stages.length){
    root.innerHTML='<div class="card loading-card">Les étapes apparaîtront ici dès que les villes seront ajoutées à l’itinéraire.</div>';
    return;
  }

  root.innerHTML=stages.map((stage,index)=>{
    const stagePhotos=stage.days.flatMap(d=>Array.isArray(d.photos)?d.photos.filter(Boolean):[]);
    const restaurants=uniqueStageItems(stage,["restaurants","restaurant"]).length;
    const activities=uniqueStageItems(stage,["activities","activity","schedule"]).length;
    const favorites=stage.days.filter(d=>Number(d.rating||0)>=4||String(d.favorite||"").trim()).length;
    const places=stage.days.reduce((n,d)=>n+(Array.isArray(d.herePlaces)?d.herePlaces.length:0),0);
    const first=stage.days[0],last=stage.days[stage.days.length-1];
    const visual=explorerStageVisual(stage,index,stagePhotos);
    const story=explorerDestinationStory(stage,index);
    const firstShort=formatShortDate(first.id);
    const lastShort=formatShortDate(last.id);

    const category=explorerDestinationCategory(stage);
    return `<article class="explorer-v91-destination-card ${stagePhotos.length?"has-photo":"no-photo"}" data-explorer-stage="${index}" data-destination-category="${category}" style="--explorer-cover:${visual}">
      <button type="button" class="explorer-v91-card-main" aria-label="Explorer ${esc(stage.city)}">
        <span class="explorer-v91-overlay"></span>
        <span class="explorer-v91-topline">
          <span class="explorer-v91-step">Étape ${String(index+1).padStart(2,"0")}</span>
          <span class="explorer-v91-dates">${esc(firstShort.day)} ${esc(firstShort.month)}${last.id!==first.id?` — ${esc(lastShort.day)} ${esc(lastShort.month)}`:""}</span>
        </span>
        <span class="explorer-v91-copy">
          <span class="explorer-v91-icon">${story.icon}</span>
          <span class="explorer-v91-eyebrow">${esc(story.eyebrow)}</span>
          <strong>${esc(stage.city)}</strong>
          <span class="explorer-v91-story">${esc(story.story)}</span>
          <span class="explorer-v91-kpis">
            <span><b>${stage.days.length}</b> jour${stage.days.length>1?"s":""}</span>
            <span><b>${stagePhotos.length}</b> photo${stagePhotos.length>1?"s":""}</span>
            <span><b>${activities}</b> activité${activities>1?"s":""}</span>
            <span><b>${restaurants}</b> adresse${restaurants>1?"s":""}</span>
            <span><b>${favorites}</b> coup${favorites>1?"s":""} de cœur</span>
            <span><b>${places}</b> lieu${places>1?"x":""}</span>
          </span>
          <span class="explorer-v91-open"><span>Explorer cette étape</span><b>→</b></span>
        </span>
      </button>
    </article>`;
  }).join("");

  root.querySelectorAll("[data-explorer-stage]").forEach(card=>{
    card.querySelector(".explorer-v91-card-main")?.addEventListener("click",()=>{
      const index=Number(card.dataset.explorerStage)||0;
      const stage=stages[index];
      setActiveExplorerStage(index);
      renderMapStageDetails(stage,index);
      if(tripMap) tripMap.flyTo(stage.coords,10,{duration:1.05});
    });
  });

  window.refreshDestinationPremiumV92?.();
}


function explorerStageIcon(stage){
  const city=normalizedPlaceName(stage.city);
  if(city.includes("cinque")||city.includes("manarola")||city.includes("vernazza")) return "🌊";
  if(city.includes("florence")||city.includes("firenze")) return "🏛️";
  if(city.includes("venise")||city.includes("venezia")) return "🚤";
  if(city.includes("toscane")||city.includes("chianti")||city.includes("sienne")) return "🍇";
  if(city.includes("rome")||city.includes("roma")) return "🏟️";
  return "📍";
}

function renderExplorerRouteStrip(stages){
  const root=$("explorerRouteStrip");
  if(!root) return;
  if(!stages.length){
    root.innerHTML="";
    return;
  }
  root.innerHTML=stages.map((stage,index)=>`
    <button type="button" data-route-stage="${index}" aria-label="Voir ${esc(stage.city)} sur la carte">
      <span class="explorer-v84-route-number">${index+1}</span>
      <span class="explorer-v84-route-icon">${explorerStageIcon(stage)}</span>
      <span class="explorer-v84-route-copy">
        <strong>${esc(stage.city)}</strong>
        <small>${stage.days.length} jour${stage.days.length>1?"s":""}</small>
      </span>
    </button>`).join("");
  root.querySelectorAll("[data-route-stage]").forEach(button=>button.addEventListener("click",()=>{
    const index=Number(button.dataset.routeStage)||0;
    const stage=stages[index];
    root.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));
    document.querySelectorAll(".explorer-city-card").forEach((card,cardIndex)=>card.classList.toggle("selected",cardIndex===index));
    if(tripMap){
      tripMap.flyTo(stage.coords,10,{duration:1.1});
    }
    renderMapStageDetails(stage,index);
  }));
  const summary=$("explorerRouteSummary");
  if(summary) summary.textContent=`${stages.length} étapes · ${itineraryDays.length} jours`;
}

function setActiveExplorerStage(index){
  document.querySelectorAll("#explorerRouteStrip [data-route-stage]").forEach(
    button=>button.classList.toggle("active",Number(button.dataset.routeStage)===index)
  );
  document.querySelectorAll(".explorer-city-card").forEach(
    (card,cardIndex)=>{
      const selected=cardIndex===index;
      card.classList.toggle("selected",selected);
      if(selected){
        card.classList.remove("explorer-v85-pulse");
        requestAnimationFrame(()=>card.classList.add("explorer-v85-pulse"));
      }
    }
  );
}

function toggleExplorerMapFullscreen(){
  const card=document.querySelector(".explorer-v81-map-card");
  const button=$("mapFullscreenButton");
  if(!card||!button) return;
  const open=card.classList.toggle("explorer-v84-fullscreen");
  document.body.classList.toggle("explorer-map-open",open);
  button.textContent=open?"✕ Fermer":"⛶ Agrandir";
  setTimeout(()=>tripMap?.invalidateSize(),180);
}

$("mapFullscreenButton")?.addEventListener("click",toggleExplorerMapFullscreen);
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && document.querySelector(".explorer-v81-map-card.explorer-v84-fullscreen")){
    toggleExplorerMapFullscreen();
  }
});

function renderTripMapData(fit=false){
  const stages=mapStageData();
  const places=allHerePlaces();
  renderExplorerRouteStrip(stages);
  renderExplorerOverview(stages);
  renderExplorerCityCards(stages);
  $("mapStageCount") && ($("mapStageCount").textContent=stages.length);
  $("mapHereCount") && ($("mapHereCount").textContent=places.length);
  $("mapPhotoCount") && ($("mapPhotoCount").textContent=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0));
  $("mapMemoryCount") && ($("mapMemoryCount").textContent=itineraryDays.filter(d=>d.memoryText||d.journal||d.memory||d.favoriteMoment).length);
  renderMapPlacesList(places);
  if(!tripMap||!tripMarkersLayer) return;
  tripMarkersLayer.clearLayers(); hereMarkersLayer.clearLayers(); tripRouteLayer.clearLayers();
  const route=[];
  stages.forEach((stage,index)=>{
    route.push(stage.coords);
    const stageIcon=L.divIcon({
      className:"explorer-v84-marker-shell",
      html:`<span class="explorer-v84-marker"><b>${index+1}</b><i>${explorerStageIcon(stage)}</i></span>`,
      iconSize:[48,56],
      iconAnchor:[24,52],
      popupAnchor:[0,-48]
    });
    const marker=L.marker(stage.coords,{title:stage.city,icon:stageIcon}).addTo(tripMarkersLayer).bindPopup(stagePopup(stage,index));
    marker.on("click",()=>{
      setActiveExplorerStage(index);
      renderMapStageDetails(stage,index);
      tripMap?.flyTo(stage.coords,10,{duration:.9});
    });
  });
  if(route.length>1) L.polyline(route,{color:"#1f6b52",weight:5,opacity:.88,dashArray:"10 10",className:"explorer-v84-route-line"}).addTo(tripRouteLayer);
  places.forEach(place=>{
    const lat=Number(place.latitude),lng=Number(place.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
    const icon=L.divIcon({className:"here-map-icon",html:"<span>📌</span>",iconSize:[34,34],iconAnchor:[17,32]});
    L.marker([lat,lng],{icon,title:place.name||"Je suis ici"}).addTo(hereMarkersLayer).bindPopup(`<div class="map-popup"><strong>📌 ${esc(place.name||"Je suis ici")}</strong><span>${esc(formatDateFr(place.dayId))}${place.time?` · ${esc(place.time)}`:""}</span>${place.note?`<p>${esc(place.note)}</p>`:""}<a href="https://www.google.com/maps?q=${encodeURIComponent(lat+","+lng)}" target="_blank" rel="noopener">Ouvrir dans Google Maps</a></div>`);
  });
  $("mapStatus").textContent=stages.length?`${stages.length} étape${stages.length===1?"":"s"} et ${places.length} endroit${places.length===1?"":"s"} personnel${places.length===1?"":"s"} affichés.`:"Ajoute des destinations dans l’itinéraire pour les voir sur la carte.";
  if(fit) fitTripMap();
}

function stageDateRange(stage){
  const first=stage.days[0], last=stage.days[stage.days.length-1];
  return `${formatDateFr(first.id)}${last.id!==first.id?` au ${formatDateFr(last.id)}`:""}`;
}
function uniqueStageItems(stage, fields){
  const items=[];
  stage.days.forEach(day=>valueItems(firstValue(day,fields)).forEach(item=>{
    if(item && !items.some(existing=>existing.toLocaleLowerCase("fr-CA")===item.toLocaleLowerCase("fr-CA"))) items.push(item);
  }));
  return items;
}
function renderStageList(icon,title,items){
  if(!items.length) return "";
  return `<section class="stage-info-block"><h3>${icon} ${esc(title)}</h3><ul>${items.map(item=>`<li>${esc(item)}</li>`).join("")}</ul></section>`;
}

function renderMapStageDetails(stage,index){
  const root=$("mapStageDetails"); if(!root) return;
  const hotels=uniqueStageItems(stage,["hotel","accommodation"]);
  const restaurants=uniqueStageItems(stage,["restaurants","restaurant"]);
  const activities=uniqueStageItems(stage,["activities","activity","schedule"]);
  const transports=uniqueStageItems(stage,["transport","train","flight"]);
  const memories=stage.days.map(day=>firstValue(day,["memoryText","journal","memory","favoriteMoment","favorite"])).filter(Boolean);
  const places=stage.days.flatMap(day=>(Array.isArray(day.herePlaces)?day.herePlaces:[]).map(place=>({...place,dayId:day.id})));
  const photos=stage.days.flatMap(day=>(Array.isArray(day.photos)?day.photos:[]).map((src,photoIndex)=>({src,dayId:day.id,photoIndex})));
  const ratings=stage.days.map(day=>Number(day.rating||day.dayRating||0)).filter(n=>n>0);
  const average=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
  const budgetValues=stage.days.map(day=>firstValue(day,["budget","dailyBudget"])).filter(Boolean);
  const cover=photos[0]?.src || "assets/toscane-accueil.jpg";
  const weatherKey=typeof cityWeatherKey==="function" ? cityWeatherKey(stage.city) : "";
  const weather=(typeof weatherData!=="undefined" && weatherKey) ? weatherData?.[weatherKey] : null;
  const weatherInfo=weather && typeof weatherCodeInfo==="function" ? weatherCodeInfo(weather.current.weather_code) : null;
  const citySummary=[
    `${stage.days.length} journée${stage.days.length>1?"s":""}`,
    activities.length ? `${activities.length} activité${activities.length>1?"s":""}` : "",
    restaurants.length ? `${restaurants.length} adresse${restaurants.length>1?"s":""} gourmande${restaurants.length>1?"s":""}` : "",
    photos.length ? `${photos.length} photo${photos.length>1?"s":""}` : ""
  ].filter(Boolean).join(" · ");

  root.innerHTML=`<article class="card stage-detail-card explorer-v82-city-sheet">
    <header class="explorer-v82-cover" style="background-image:linear-gradient(180deg,rgba(7,20,16,.08),rgba(7,20,16,.82)),url('${cover}')">
      <button type="button" class="explorer-v82-close" aria-label="Fermer la fiche">×</button>
      <div class="explorer-v82-cover-copy">
        <span class="stage-number">Étape ${index+1} sur ${mapStageData().length}</span>
        <h2>${esc(stage.city)}</h2>
        <p>${esc(stageDateRange(stage))}</p>
        <div class="explorer-v82-cover-pills">
          <span>📅 ${stage.days.length} jour${stage.days.length>1?"s":""}</span>
          <span>📸 ${photos.length} photo${photos.length>1?"s":""}</span>
          <span>❤️ ${memories.length} souvenir${memories.length>1?"s":""}</span>
          ${weather?`<span>${weatherInfo.icon} ${Math.round(weather.current.temperature_2m)} °C</span>`:""}
        </div>
      </div>
    </header>

    <div class="explorer-v82-body">
      <div class="explorer-v82-title-row">
        <div><span class="eyebrow">Votre séjour à ${esc(stage.city)}</span><h3>Explorer cette étape</h3><p>${esc(citySummary)}</p></div>
        <div class="stage-rating">${average?"★".repeat(average)+"☆".repeat(5-average):"À noter pendant le voyage"}</div>
      </div>

      <nav class="explorer-v82-tabs" aria-label="Sections de la fiche">
        <button type="button" data-city-scroll="cityOverview">Aperçu</button>
        <button type="button" data-city-scroll="cityIdeas">À faire</button>
        <button type="button" data-city-scroll="cityFood">Adresses</button>
        <button type="button" data-city-scroll="cityPhotos">Photos</button>
        <button type="button" data-city-scroll="cityMemories">Souvenirs</button>
      </nav>

      <section id="cityOverview" class="explorer-v82-overview">
        <article><span>🏨</span><small>Hébergement</small><strong>${esc(hotels[0]||"À compléter")}</strong></article>
        <article><span>🚆</span><small>Transport</small><strong>${esc(transports[0]||"À compléter")}</strong></article>
        <article><span>📌</span><small>Lieux enregistrés</small><strong>${places.length}</strong></article>
        <article><span>⭐</span><small>Note moyenne</small><strong>${average?`${average}/5`:"—"}</strong></article>
      </section>

      <div class="explorer-v82-content-grid">
        <section id="cityIdeas" class="explorer-v82-content-card">
          <div class="explorer-v82-section-head"><span>🥾</span><div><small>Découvrir</small><h3>Activités et moments prévus</h3></div></div>
          ${activities.length?`<ul>${activities.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:'<p class="subtle">Ajoutez des activités dans les journées de cette étape.</p>'}
        </section>

        <section id="cityFood" class="explorer-v82-content-card">
          <div class="explorer-v82-section-head"><span>🍝</span><div><small>Savourer</small><h3>Restaurants et bonnes adresses</h3></div></div>
          ${restaurants.length?`<ul>${restaurants.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:'<p class="subtle">Les restaurants ajoutés à l’itinéraire apparaîtront ici.</p>'}
        </section>

        <section class="explorer-v82-content-card">
          <div class="explorer-v82-section-head"><span>🏨</span><div><small>Séjourner</small><h3>Hébergement et déplacements</h3></div></div>
          ${hotels.length||transports.length?`<div class="explorer-v82-mini-list">${hotels.map(item=>`<div><span>🏡</span><strong>${esc(item)}</strong></div>`).join("")}${transports.map(item=>`<div><span>🚆</span><strong>${esc(item)}</strong></div>`).join("")}</div>`:'<p class="subtle">Les détails de séjour restent à compléter.</p>'}
        </section>

        <section class="explorer-v82-content-card">
          <div class="explorer-v82-section-head"><span>🌤️</span><div><small>Conditions</small><h3>Météo de l’étape</h3></div></div>
          ${weather?`<div class="explorer-v82-weather"><strong>${weatherInfo.icon} ${Math.round(weather.current.temperature_2m)} °C</strong><span>${esc(weatherInfo.label)}</span><small>Ressenti ${Math.round(weather.current.apparent_temperature)} °C · Vent ${Math.round(weather.current.wind_speed_10m)} km/h</small></div>`:'<p class="subtle">La météo apparaîtra lorsque les données seront disponibles.</p>'}
        </section>
      </div>

      <section id="cityPhotos" class="explorer-v82-gallery">
        <div class="explorer-v82-section-title"><div><span class="eyebrow">Galerie de l’étape</span><h3>Les images de ${esc(stage.city)}</h3></div><strong>${photos.length} photo${photos.length>1?"s":""}</strong></div>
        ${photos.length?`<div class="explorer-v82-photo-grid">${photos.slice(0,12).map((photo,i)=>`<button type="button" data-stage-photo-index="${i}"><img src="${photo.src}" alt="Photo de ${esc(stage.city)}"><span>${i===0?"Photo principale":`Photo ${i+1}`}</span></button>`).join("")}</div>`:'<div class="explorer-v82-empty">📷 Les photos prises pendant le voyage seront regroupées automatiquement ici.</div>'}
      </section>

      <section id="cityMemories" class="explorer-v82-memories">
        <div class="explorer-v82-section-title"><div><span class="eyebrow">Carnet vivant</span><h3>Souvenirs de cette étape</h3></div></div>
        ${memories.length?`<div class="explorer-v82-memory-list">${memories.map((memory,i)=>`<blockquote><span>“</span>${esc(displayValue(memory))}</blockquote>`).join("")}</div>`:'<div class="explorer-v82-empty">❤️ Vos coups de cœur et notes de voyage apparaîtront ici.</div>'}
      </section>

      ${places.length?`<section class="stage-place-section explorer-v82-places"><h3>📌 Endroits enregistrés</h3>${places.map(place=>`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(place.latitude+","+place.longitude)}"><strong>${esc(place.name||"Endroit")}</strong><span>${esc(formatDateFr(place.dayId))}${place.time?` · ${esc(place.time)}`:""}</span></a>`).join("")}</section>`:""}

      <div class="stage-detail-actions explorer-v82-actions">
        <button type="button" class="btn" id="openStageFirstDay">Voir la première journée</button>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stage.coords[0]+","+stage.coords[1])}">🧭 Itinéraire Google Maps</a>
      </div>
    </div>
  </article>`;

  $("openStageFirstDay")?.addEventListener("click",()=>openDayDetail(stage.days[0].id));
  root.querySelectorAll("[data-stage-photo-index]").forEach(button=>button.addEventListener("click",()=>openPhotoViewer(photos.map(p=>p.src),Number(button.dataset.stagePhotoIndex)||0,stage.city)));
  root.querySelectorAll("[data-city-scroll]").forEach(button=>button.addEventListener("click",()=>{
    root.querySelector("#"+button.dataset.cityScroll)?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  root.querySelector(".explorer-v82-close")?.addEventListener("click",()=>{
    root.innerHTML="";
    document.querySelector(".explorer-v81-map-card")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  root.classList.remove("explorer-v85-revealed");
  requestAnimationFrame(()=>{
    root.classList.add("explorer-v85-revealed");
    root.scrollIntoView({behavior:"smooth",block:"start"});
  });
}

function openMapTodayStage(){
  const stages=mapStageData(); if(!stages.length) return;
  const now=new Date();
  const todayId=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  let index=stages.findIndex(stage=>stage.days.some(day=>day.id===todayId));
  if(index<0){
    index=stages.findIndex(stage=>stage.days.some(day=>day.id>todayId));
    if(index<0) index=stages.length-1;
  }
  const stage=stages[index]; renderMapStageDetails(stage,index);
  if(tripMap){ tripMap.setView(stage.coords,10); }
}

function fitTripMap(){
  if(!tripMap) return;
  const points=[...mapStageData().map(s=>s.coords),...allHerePlaces().map(p=>[Number(p.latitude),Number(p.longitude)]).filter(c=>c.every(Number.isFinite))];
  if(currentPositionSnapshot) points.push([currentPositionSnapshot.coords.latitude,currentPositionSnapshot.coords.longitude]);
  if(points.length===1) tripMap.setView(points[0],11);
  else if(points.length>1) tripMap.fitBounds(points,{padding:[35,35]});
  else tripMap.setView([43.7,11.7],6);
}
function updateMapCurrentPosition(latitude,longitude,accuracy=0){
  if(!tripMap) return;
  if(mapCurrentMarker) mapCurrentMarker.setLatLng([latitude,longitude]);
  else mapCurrentMarker=L.marker([latitude,longitude],{title:"Ma position actuelle"}).addTo(tripMap).bindPopup("<strong>📍 Ma position actuelle</strong>");
  if(mapCurrentAccuracy) mapCurrentAccuracy.setLatLng([latitude,longitude]).setRadius(accuracy||0);
  else mapCurrentAccuracy=L.circle([latitude,longitude],{radius:accuracy||0,color:"#2878d0",fillOpacity:.08,weight:1}).addTo(tripMap);
}
function renderMapPlacesList(places){
  const root=$("mapPlacesList"); if(!root) return;
  if(!places.length){ root.innerHTML='<div class="card loading-card">Les endroits enregistrés avec « Je suis ici » apparaîtront ici.</div>'; return; }
  root.innerHTML=`<h2>📌 Mes endroits enregistrés</h2><div class="map-place-grid">${places.slice().reverse().map(place=>`<article class="card map-place-card"><div><strong>${esc(place.name||"Endroit")}</strong><span>${esc(formatDateFr(place.dayId))}${place.city?` · ${esc(place.city)}`:""}</span>${place.note?`<p>${esc(place.note)}</p>`:""}</div><a href="https://www.google.com/maps?q=${encodeURIComponent(place.latitude+","+place.longitude)}" target="_blank" rel="noopener">Voir →</a></article>`).join("")}</div>`;
}
$("mapFitButton")?.addEventListener("click",fitTripMap);
$("mapTodayButton")?.addEventListener("click",openMapTodayStage);
$("mapLocateButton")?.addEventListener("click",()=>{ startCurrentLocation(); setTimeout(()=>{ if(currentPositionSnapshot&&tripMap){ const c=currentPositionSnapshot.coords; updateMapCurrentPosition(c.latitude,c.longitude,c.accuracy); tripMap.setView([c.latitude,c.longitude],14); } },800); });
window.renderTripMapData=renderTripMapData;


document.addEventListener("click",e=>{
  const button = e.target.closest(".memory-photo-open");
  if(!button) return;
  const day = itineraryDays.find(item=>item.id===button.dataset.memoryDay);
  if(!day) return;
  openPhotoViewer(day.photos,Number(button.dataset.memoryIndex)||0,`${formatDateFr(day.id)} — ${day.location || day.title || "Souvenir"}`);
});

document.addEventListener("touchend", function(e){
  const btn=e.target.closest("button[data-panel]");
  if(btn){
    e.preventDefault();
    showPanel(btn.dataset.panel);
  }
},{passive:false});

// ===== Premium 3.8.1 — Revivre le voyage réellement fonctionnel =====
let REPLAY_INTERVAL = 7000;
let replayIndex = 0;
let replayTimer = null;
let replayPaused = false;
let replayPhotoTimer = null;
let replayPhotoIndex = 0;
let replaySpeedIndex = 0;
const REPLAY_SPEEDS = [{label:"1×",ms:7000},{label:"1,5×",ms:4800},{label:"2×",ms:3400}];

function replayFallbackDays(){
  const cities=["Cinque Terre","Cinque Terre","Cinque Terre","Cinque Terre","Florence","Venise","Venise","Toscane","Toscane","Toscane","Toscane","Toscane","Toscane","Toscane","Toscane","Rome","Rome","Rome"];
  const base=new Date("2026-09-28T12:00:00");
  return cities.map((city,index)=>{ const d=new Date(base); d.setDate(base.getDate()+index); return {id:d.toISOString().slice(0,10),location:city,title:city,photos:[],herePlaces:[]}; });
}
function replayDays(){ return itineraryDays.length ? itineraryDays : replayFallbackDays(); }
function replayPhotoSource(photo){
  if(typeof photo==="string") return photo;
  if(!photo || typeof photo!=="object") return "";
  return photo.url || photo.src || photo.dataUrl || photo.data || photo.downloadURL || "";
}
function replayDefaultCover(){ return "assets/manarola-sunset.jpg"; }
function replayPhotosForDay(day){
  const photos=Array.isArray(day?.photos)?day.photos:[];
  const sources=photos.map(replayPhotoSource).filter(Boolean);
  return sources.length?sources:[replayDefaultCover(day)];
}
function setReplayBackdrop(src){
  const backdrop=$("replayBackdrop"); if(!backdrop) return;
  const safe=String(src||"assets/manarola-sunset.jpg").replace(/"/g,"%22");
  backdrop.style.opacity="0";
  window.setTimeout(()=>{backdrop.style.backgroundImage=`url("${safe}")`;backdrop.style.opacity="1";},120);
}
function startReplayPhotoCycle(day){
  clearInterval(replayPhotoTimer);
  const photos=replayPhotosForDay(day); replayPhotoIndex=0;
  const dots=$("replayPhotoDots");
  if(dots) dots.innerHTML=photos.length>1?photos.map((_,i)=>`<button type="button" class="${i===0?"active":""}" aria-label="Photo ${i+1}"></button>`).join(""):"";
  setReplayBackdrop(photos[0]);
  if(photos.length>1) replayPhotoTimer=setInterval(()=>{
    if(replayPaused) return;
    replayPhotoIndex=(replayPhotoIndex+1)%photos.length;
    setReplayBackdrop(photos[replayPhotoIndex]);
    dots?.querySelectorAll("button").forEach((dot,i)=>dot.classList.toggle("active",i===replayPhotoIndex));
  },2300);
}
function replayPlacesForDay(day){ return Array.isArray(day?.herePlaces)?day.herePlaces.length:0; }
function replayMemoryText(day){ return timelineReflection(day)||timelineMemoryForDay(day)||"Une nouvelle journée à garder en mémoire."; }
function replayCities(days=replayDays()){
  const result=[]; days.forEach(day=>{const city=cityForDay(day)||day.location||"Italie";if(result[result.length-1]!==city)result.push(city);}); return result;
}
function replayStats(){
  const days=replayDays();
  return {
    photoCount:days.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0),
    places:days.reduce((n,d)=>n+replayPlacesForDay(d),0),
    favorites:days.filter(d=>timelineRating(d)>=4||firstValue(d,["favoriteMoment","favorite","memoryFavorite"])).length,
    memories:days.filter(d=>timelineMemoryForDay(d)||timelineReflection(d)).length
  };
}
function renderReplayRoute(day,days){
  const cities=replayCities(days), active=cityForDay(day)||day.location||"Italie", activeIndex=Math.max(0,cities.indexOf(active));
  const root=$("replayRouteList"); if(!root)return;
  root.innerHTML=cities.map((city,index)=>`<div class="replay-route-step ${index<activeIndex?"done":index===activeIndex?"active":""}"><i></i><span>${esc(city)}</span></div>`).join("");
}
function weatherPlaceIdForCity(city){
  const value=String(city||"").toLocaleLowerCase("fr-CA");
  if(value.includes("cinque")||value.includes("vernazza")||value.includes("manarola")||value.includes("monterosso"))return "cinque-terre";
  if(value.includes("florence")||value.includes("firenze"))return "florence";
  if(value.includes("venise")||value.includes("venezia"))return "venise";
  if(value.includes("toscane")||value.includes("chianti")||value.includes("sienne")||value.includes("siena"))return "toscane";
  if(value.includes("rome")||value.includes("roma"))return "rome"; return "";
}
function renderReplayDay(index){
  const days=replayDays(); if(!days.length)return;
  replayIndex=Math.max(0,Math.min(index,days.length-1));
  const day=days[replayIndex], city=cityForDay(day)||day.location||"Italie";
  startReplayPhotoCycle(day);
  $("replayDate").textContent=formatDateFr(day.id);
  $("replayCity").textContent=city;
  $("replayTitle").textContent=firstValue(day,["title","location","arrival"])||"Une journée en Italie";
  $("replayQuote").textContent=`“${replayMemoryText(day)}”`;
  const photos=Array.isArray(day.photos)?day.photos.length:0, places=replayPlacesForDay(day), rating=timelineRating(day);
  const placeKey=weatherPlaceIdForCity(city), weather=placeKey&&typeof weatherData!=="undefined"?weatherData?.[placeKey]:null;
  const weatherInfo=weather?weatherCodeInfo(weather.current.weather_code):null;
  $("replayWeather").textContent=weather?`${weatherInfo.icon} ${Math.round(weather.current.temperature_2m)} °C · ${weatherInfo.label}`:"";
  $("replayKpis").innerHTML=`<span>📸 ${photos} photo${photos>1?"s":""}</span><span>📍 ${places} lieu${places>1?"x":""}</span>${rating?`<span>⭐ ${rating}/5</span>`:""}${timelineBudget(day)?`<span>💶 ${esc(displayValue(timelineBudget(day)))}</span>`:""}`;
  $("replayCounter").textContent=`${replayIndex+1} / ${days.length}`;
  $("replayProgressFill").style.width=`${((replayIndex+1)/days.length)*100}%`;
  renderReplayRoute(day,days);
  const content=$("replayContent"); content.style.animation="none"; requestAnimationFrame(()=>content.style.animation="replaySlide .6s ease both");
}
function replaySchedule(){
  clearTimeout(replayTimer); if(replayPaused)return;
  replayTimer=setTimeout(()=>{const days=replayDays();if(replayIndex>=days.length-1)showReplayFinale();else{renderReplayDay(replayIndex+1);replaySchedule();}},REPLAY_INTERVAL);
}
function openTripReplay(){
  stopTimelinePlayback(); replayPaused=false;
  $("replayFinale")?.classList.remove("show");
  $("tripReplay")?.classList.add("open"); $("tripReplay")?.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden"; $("replayToggle").textContent="⏸";
  renderReplayDay(0); replaySchedule();
}
function closeTripReplay(){clearTimeout(replayTimer);clearInterval(replayPhotoTimer);$("tripReplay")?.classList.remove("open");$("tripReplay")?.setAttribute("aria-hidden","true");document.body.style.overflow="";}
function toggleTripReplay(){replayPaused=!replayPaused;$("replayToggle").textContent=replayPaused?"▶":"⏸";if(replayPaused)clearTimeout(replayTimer);else replaySchedule();}
function showReplayFinale(){clearTimeout(replayTimer);clearInterval(replayPhotoTimer);const s=replayStats();$("replayFinalStats").innerHTML=`<div><strong>${s.photoCount}</strong><span>photos</span></div><div><strong>${s.favorites}</strong><span>coups de cœur</span></div><div><strong>${s.places}</strong><span>lieux</span></div><div><strong>${s.memories}</strong><span>journées racontées</span></div>`;$("replayFinale").classList.add("show");}

$("timelinePlayButton")?.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();openTripReplay();},true);
$("replayClose")?.addEventListener("click",closeTripReplay);
$("replayToggle")?.addEventListener("click",toggleTripReplay);
$("replayPrevious")?.addEventListener("click",()=>{$("replayFinale").classList.remove("show");renderReplayDay(replayIndex-1);replaySchedule();});
$("replayNext")?.addEventListener("click",()=>{const days=replayDays();if(replayIndex>=days.length-1)showReplayFinale();else{renderReplayDay(replayIndex+1);replaySchedule();}});
$("replayRestart")?.addEventListener("click",()=>{$("replayFinale").classList.remove("show");replayPaused=false;$("replayToggle").textContent="⏸";renderReplayDay(0);replaySchedule();});
$("replaySpeed")?.addEventListener("click",()=>{replaySpeedIndex=(replaySpeedIndex+1)%REPLAY_SPEEDS.length;const speed=REPLAY_SPEEDS[replaySpeedIndex];REPLAY_INTERVAL=speed.ms;$("replaySpeed").textContent=speed.label;replaySchedule();});
$("replayPhotoDots")?.addEventListener("click",event=>{const dot=event.target.closest("button");if(!dot)return;const dots=[...$("replayPhotoDots").querySelectorAll("button")],next=dots.indexOf(dot);if(next<0)return;const day=replayDays()[replayIndex],photos=replayPhotosForDay(day);replayPhotoIndex=next;setReplayBackdrop(photos[next]);dots.forEach((item,i)=>item.classList.toggle("active",i===next));});
document.addEventListener("keydown",event=>{if(!$("tripReplay")?.classList.contains("open"))return;if(event.key==="Escape")closeTripReplay();if(event.key==="ArrowRight")$("replayNext").click();if(event.key==="ArrowLeft")$("replayPrevious").click();if(event.key===" "){event.preventDefault();toggleTripReplay();}});

// ===== Premium 3.6 — Mes voyages stables =====
const TRIPS_STORAGE_KEY = "mon-carnet-voyages";
const COUNTRY_META = {
  "Vietnam": {flag:"🇻🇳", cover:"linear-gradient(135deg,#234,#6a8f72)"},
  "Japon": {flag:"🇯🇵", cover:"linear-gradient(135deg,#a84d5b,#f0b9c2)"},
  "Thaïlande": {flag:"🇹🇭", cover:"linear-gradient(135deg,#147a8c,#f0b14b)"},
  "Italie": {flag:"🇮🇹", cover:"url('assets/manarola-sunset.jpg')"},
  "France": {flag:"🇫🇷", cover:"linear-gradient(135deg,#334e7d,#e8cfa8)"},
  "Espagne": {flag:"🇪🇸", cover:"linear-gradient(135deg,#bd523f,#e9b74e)"},
  "Portugal": {flag:"🇵🇹", cover:"linear-gradient(135deg,#1e765c,#d99b43)"},
  "Canada": {flag:"🇨🇦", cover:"linear-gradient(135deg,#b02e35,#f4eee7)"},
  "Autre": {flag:"🌍", cover:"linear-gradient(135deg,#345e57,#d39b72)"}
};
function loadTrips(){
  const stored=LS.get(TRIPS_STORAGE_KEY,[]);
  const italy={id:"italy-2026",name:"Italie 2026",country:"Italie",start:"2026-09-28",end:"2026-10-16",budget:"",travelers:3,style:"Découverte",status:"planned",active:true};
  return [italy,...stored.filter(t=>t && t.id!=="italy-2026")];
}
function saveTrips(trips){ LS.set(TRIPS_STORAGE_KEY,trips.filter(t=>t.id!=="italy-2026")); }
function tripDuration(trip){
  if(!trip.start||!trip.end) return "Dates à choisir";
  const days=Math.max(1,Math.round((new Date(trip.end+'T12:00:00')-new Date(trip.start+'T12:00:00'))/86400000)+1);
  return `${days} jour${days>1?'s':''}`;
}
function renderTrips(){
  const root=$("tripsGrid"); if(!root) return;
  const trips=loadTrips();
  const customTrips=trips.filter(t=>t.id!=="italy-2026");
  const count=$("tripLibraryCount"); if(count) count.textContent=`${trips.length} carnet${trips.length>1?'s':''}`;
  root.innerHTML=trips.map(trip=>{
    const meta=COUNTRY_META[trip.country]||COUNTRY_META.Autre;
    const bg=meta.cover.startsWith('url')?`background-image:${meta.cover}`:`background:${meta.cover}`;
    const isItaly=trip.id==="italy-2026";
    return `<article class="trip-library-card ${trip.active?'active-trip':''}" data-trip-id="${esc(trip.id)}">
      <div class="trip-library-cover" style="${bg}"><span>${meta.flag}</span><em>${trip.active?'Voyage actif':tripStatusMeta(trip.status).label}</em></div>
      <div class="trip-library-body"><h3>${esc(trip.name)}</h3><p>${esc(trip.country)} · ${esc(tripDuration(trip))}</p>
      <div class="trip-library-meta"><span>👥 ${Number(trip.travelers)||1}</span><span>✨ ${esc(trip.style||'Découverte')}</span>${trip.budget?`<span>💰 ${Number(trip.budget).toLocaleString('fr-CA')} $</span>`:''}</div>
      <div class="trip-library-actions">
        ${isItaly?`<button class="btn" data-open-trip="${esc(trip.id)}">Ouvrir</button>`:`<button class="btn secondary" data-preview-trip="${esc(trip.id)}">Voir</button><button class="btn secondary" data-edit-trip="${esc(trip.id)}">✏️ Modifier</button><button class="btn secondary" data-duplicate-trip="${esc(trip.id)}">⧉ Dupliquer</button><button class="icon-danger" data-delete-trip="${esc(trip.id)}" aria-label="Supprimer">🗑️</button>`}
      </div></div>
    </article>`;
  }).join('');
  if(!customTrips.length){
    root.insertAdjacentHTML('beforeend','<article class="trip-library-empty"><div>✨</div><h3>Ton prochain voyage commence ici</h3><p>Crée un carnet pour le Vietnam, le Japon, la Thaïlande ou toute autre destination.</p><button class="btn" type="button" data-empty-create>Créer mon prochain voyage</button></article>');
  }
  root.querySelectorAll('[data-open-trip]').forEach(btn=>btn.addEventListener('click',()=>showPanel('home')));
  root.querySelectorAll('[data-preview-trip]').forEach(btn=>btn.addEventListener('click',()=>{
    const trip=trips.find(t=>t.id===btn.dataset.previewTrip); if(!trip) return;
    const budget=trip.budget?`${Number(trip.budget).toLocaleString('fr-CA')} $ CA`:'Non indiqué';
    alert(`${trip.name}\n\nDestination : ${trip.country}\nDurée : ${tripDuration(trip)}\nVoyageurs : ${trip.travelers||1}\nStyle : ${trip.style||'Découverte'}\nBudget : ${budget}`);
  }));
  root.querySelectorAll('[data-edit-trip]').forEach(btn=>btn.addEventListener('click',()=>{
    const trip=trips.find(t=>t.id===btn.dataset.editTrip); if(trip) openCreateTrip(trip);
  }));
  root.querySelectorAll('[data-duplicate-trip]').forEach(btn=>btn.addEventListener('click',()=>{
    const trip=trips.find(t=>t.id===btn.dataset.duplicateTrip); if(!trip) return;
    const copy={...trip,id:`trip-${Date.now()}`,name:`${trip.name} — copie`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    trips.push(copy); saveTrips(trips); renderTrips(); renderWorldDashboard();
  }));
  root.querySelectorAll('[data-delete-trip]').forEach(btn=>btn.addEventListener('click',()=>{
    const trip=trips.find(t=>t.id===btn.dataset.deleteTrip); if(!trip||!confirm(`Supprimer « ${trip.name} »?`)) return;
    saveTrips(trips.filter(t=>t.id!==trip.id)); renderTrips(); renderWorldDashboard();
  }));
  root.querySelector('[data-empty-create]')?.addEventListener('click',()=>openCreateTrip());
}
let editingTripId="";
function fillTripForm(trip=null){
  editingTripId=trip?.id||"";
  $("createTripTitle").textContent=trip?"✏️ Modifier le voyage":"🌍 Créer un nouveau voyage";
  $("saveNewTrip").textContent=trip?"Enregistrer les changements":"Créer le voyage";
  $("newTripName").value=trip?.name||"";
  $("newTripCountry").value=trip?.country||"Vietnam";
  $("newTripStart").value=trip?.start||"";
  $("newTripEnd").value=trip?.end||"";
  $("newTripBudget").value=trip?.budget||"";
  $("newTripTravelers").value=trip?.travelers||2;
  $("newTripStyle").value=trip?.style||"Découverte";
  $("newTripStatus").value=trip?.status||"planned";
}
function openCreateTrip(trip=null){
  fillTripForm(trip); $("createTripModal").hidden=false; $("createTripStatus").textContent=""; $("newTripName").focus();
}
function closeCreateTrip(){ $("createTripModal").hidden=true; editingTripId=""; }
function createTrip(){
  const name=$("newTripName").value.trim(); const country=$("newTripCountry").value;
  const start=$("newTripStart").value; const end=$("newTripEnd").value;
  const status=$("createTripStatus");
  if(!name){ status.textContent="Écris le nom du voyage."; return; }
  if(start&&end&&end<start){ status.textContent="La date de retour doit être après le départ."; return; }
  const trips=loadTrips();
  const values={name,country,start,end,budget:$("newTripBudget").value,travelers:Number($("newTripTravelers").value)||1,style:$("newTripStyle").value,status:$("newTripStatus").value||"planned",updatedAt:new Date().toISOString()};
  if(editingTripId){
    const index=trips.findIndex(t=>t.id===editingTripId);
    if(index<0){ status.textContent="Ce voyage est introuvable."; return; }
    trips[index]={...trips[index],...values};
  }else{
    trips.push({id:`trip-${Date.now()}`,...values,createdAt:new Date().toISOString()});
  }
  saveTrips(trips); renderTrips(); renderWorldDashboard(); closeCreateTrip(); fillTripForm();
}
$("openCreateTrip")?.addEventListener("click",()=>openCreateTrip());
$("saveNewTrip")?.addEventListener("click",createTrip);
$("cancelNewTrip")?.addEventListener("click",closeCreateTrip);
$("createTripModal")?.addEventListener("click",e=>{if(e.target.id==="createTripModal") closeCreateTrip();});
document.addEventListener("keydown",e=>{if(e.key==="Escape" && $("createTripModal") && !$("createTripModal").hidden) closeCreateTrip();});
renderTrips();


// ===== Premium 4.0 — Carte du monde et thème =====
const TRIP_STATUS_META={done:{label:"Réalisé",icon:"✅"},planned:{label:"Prévu",icon:"✈️"},dream:{label:"Rêve",icon:"❤️"}};
function tripStatusMeta(status){return TRIP_STATUS_META[status]||TRIP_STATUS_META.planned;}
const COUNTRY_POSITIONS={
  "Canada":{x:18,y:25},"Italie":{x:52,y:31},"France":{x:49,y:29},"Espagne":{x:47,y:34},"Portugal":{x:45,y:35},
  "Vietnam":{x:78,y:43},"Japon":{x:88,y:31},"Thaïlande":{x:75,y:47},"Autre":{x:58,y:50}
};
function renderWorldDashboard(){
  const trips=loadTrips().map(t=>({...t,status:t.status||"planned"}));
  const countries=new Set(trips.map(t=>t.country).filter(Boolean));
  if($("worldCountryCount")) $("worldCountryCount").textContent=countries.size;
  if($("worldDoneCount")) $("worldDoneCount").textContent=trips.filter(t=>t.status==="done").length;
  if($("worldPlannedCount")) $("worldPlannedCount").textContent=trips.filter(t=>t.status==="planned").length;
  if($("worldDreamCount")) $("worldDreamCount").textContent=trips.filter(t=>t.status==="dream").length;
  const markers=$("worldMarkers");
  if(markers){
    markers.innerHTML=trips.map((trip,index)=>{const meta=COUNTRY_META[trip.country]||COUNTRY_META.Autre;const pos=COUNTRY_POSITIONS[trip.country]||{x:55+(index%5)*5,y:48+(index%3)*5};const status=trip.status||"planned";return `<button class="world-marker ${status}" style="left:${pos.x}%;top:${pos.y}%" data-world-trip="${esc(trip.id)}" aria-label="${esc(trip.name)}"><span class="world-marker-pin"><span>${meta.flag}</span></span><span class="world-marker-label">${esc(trip.name)}</span></button>`;}).join("");
    markers.querySelectorAll("[data-world-trip]").forEach(btn=>btn.addEventListener("click",()=>{showPanel("trips");setTimeout(()=>document.querySelector(`[data-trip-id="${btn.dataset.worldTrip}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}),100);}));
  }
  const list=$("worldTripList");
  if(list){list.innerHTML=trips.map(trip=>{const meta=COUNTRY_META[trip.country]||COUNTRY_META.Autre;const status=trip.status||"planned";const s=tripStatusMeta(status);return `<div class="world-trip-item"><span class="flag">${meta.flag}</span><div><strong>${esc(trip.name)}</strong><small>${esc(trip.country)} · ${esc(tripDuration(trip))}</small></div><span class="world-status ${status}">${s.icon} ${s.label}</span></div>`;}).join("");}
}
const THEME_KEY="mon-carnet-theme";
function applyTheme(theme){document.body.classList.toggle("dark-mode",theme==="dark");const b=$("themeToggle");if(b)b.textContent=theme==="dark"?"☀️":"🌙";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#101916":"#f7f0e6");}
applyTheme(LS.get(THEME_KEY,"light"));
$("themeToggle")?.addEventListener("click",()=>{const next=document.body.classList.contains("dark-mode")?"light":"dark";LS.set(THEME_KEY,next);applyTheme(next);});
renderWorldDashboard();


// ===== Premium 3.7 — Météo en temps réel et prévisions =====
const WEATHER_CACHE_KEY = "mon-carnet-weather-v37";
const WEATHER_TTL = 15 * 60 * 1000;
const WEATHER_PLACES = [
  {id:"cinque-terre", name:"Cinque Terre", lat:44.1461, lon:9.6439},
  {id:"florence", name:"Florence", lat:43.7696, lon:11.2558},
  {id:"venice", name:"Venise", lat:45.4408, lon:12.3155},
  {id:"tuscany", name:"Toscane", lat:43.3188, lon:11.3308},
  {id:"rome", name:"Rome", lat:41.9028, lon:12.4964}
];
let weatherData = {};
function weatherCodeInfo(code){
  const n=Number(code);
  if(n===0) return {icon:"☀️",label:"Ensoleillé"};
  if([1,2].includes(n)) return {icon:"🌤️",label:"Partiellement nuageux"};
  if(n===3) return {icon:"☁️",label:"Nuageux"};
  if([45,48].includes(n)) return {icon:"🌫️",label:"Brouillard"};
  if([51,53,55,56,57].includes(n)) return {icon:"🌦️",label:"Bruine"};
  if([61,63,65,66,67,80,81,82].includes(n)) return {icon:"🌧️",label:"Pluie"};
  if([71,73,75,77,85,86].includes(n)) return {icon:"🌨️",label:"Neige"};
  if([95,96,99].includes(n)) return {icon:"⛈️",label:"Orage"};
  return {icon:"🌤️",label:"Variable"};
}
function cityWeatherKey(city=""){
  const c=String(city).toLocaleLowerCase("fr-CA");
  if(c.includes("cinque")||c.includes("vernazza")||c.includes("manarola")||c.includes("monterosso")||c.includes("riomaggiore")) return "cinque-terre";
  if(c.includes("florence")||c.includes("firenze")) return "florence";
  if(c.includes("venise")||c.includes("venezia")) return "venice";
  if(c.includes("toscane")||c.includes("chianti")||c.includes("sienne")||c.includes("siena")||c.includes("panzano")) return "tuscany";
  if(c.includes("rome")||c.includes("roma")) return "rome";
  return "rome";
}
async function fetchPlaceWeather(place){
  const params=new URLSearchParams({latitude:String(place.lat),longitude:String(place.lon),timezone:"auto",forecast_days:"7",current:"temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max"});
  const url=`https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{signal:controller.signal,cache:"no-store"});
      if(!response.ok) throw new Error(`Météo ${place.name}: ${response.status}`);
      const data=await response.json();
      if(!data?.current||!data?.daily) throw new Error(`Réponse météo incomplète pour ${place.name}`);
      return data;
    }catch(err){lastError=err; if(attempt===0) await new Promise(r=>setTimeout(r,700));}
    finally{clearTimeout(timer);}
  }
  throw lastError||new Error(`Météo indisponible pour ${place.name}`);
}
function cachedWeather(){
  const cache=LS.get(WEATHER_CACHE_KEY,null);
  if(!cache||!cache.savedAt||Date.now()-cache.savedAt>WEATHER_TTL) return null;
  return cache.data||null;
}
async function loadWeather(force=false){
  const cached=!force&&cachedWeather();
  if(cached){weatherData=cached;renderAllWeather();return;}
  const error=$("weatherError"); if(error) error.hidden=true;
  try{
    const settled=await Promise.allSettled(WEATHER_PLACES.map(async place=>[place.id,await fetchPlaceWeather(place)]));
    const successful=settled.filter(r=>r.status==="fulfilled").map(r=>r.value);
    const failed=settled.filter(r=>r.status==="rejected");
    if(successful.length){
      weatherData=Object.fromEntries(successful);
      LS.set(WEATHER_CACHE_KEY,{savedAt:Date.now(),data:weatherData});
      renderAllWeather(failed.length>0);
      if(error){error.hidden=failed.length===0; if(failed.length) error.textContent=`Certaines villes n'ont pas chargé. Appuie sur Actualiser.`;}
      return;
    }
    throw failed[0]?.reason||new Error("Aucune donnée météo reçue");
  }catch(err){
    console.error("Chargement météo",err);
    const fallback=LS.get(WEATHER_CACHE_KEY,null)?.data;
    if(fallback){weatherData=fallback;renderAllWeather(true);if(error){error.hidden=false;error.textContent="Dernières données météo affichées. Appuie sur Actualiser pour réessayer.";}} else {if(error){error.hidden=false;error.textContent="La météo ne peut pas se connecter pour le moment. Appuie sur Actualiser dans quelques secondes.";} renderWeatherUnavailable();}
  }
}
function renderWeatherUnavailable(){
  const strip=$("homeWeatherStrip"); if(strip) strip.innerHTML='<div class="weather-loading weather-offline">Météo indisponible pour le moment.</div>';
  const details=$("todayWeatherDetails"); if(details) details.innerHTML='<div class="weather-offline">Connexion requise</div>';
}
function formatWeatherTime(iso){if(!iso)return"—";return new Intl.DateTimeFormat("fr-CA",{hour:"2-digit",minute:"2-digit"}).format(new Date(iso));}
function renderHomeWeather(){
  const root=$("homeWeatherStrip"); if(!root) return;
  root.innerHTML=WEATHER_PLACES.map(place=>{const w=weatherData[place.id];if(!w)return'';const info=weatherCodeInfo(w.current.weather_code);return `<button class="home-weather-mini" type="button" data-weather-place="${place.id}"><span>${info.icon} ${esc(place.name)}</span><strong>${Math.round(w.current.temperature_2m)} °C</strong><small>${esc(info.label)}</small></button>`;}).join('');
  root.querySelectorAll('[data-weather-place]').forEach(btn=>btn.addEventListener('click',()=>showPanel('conditions')));
}
function renderWeatherCities(){
  const root=$("weatherCitiesGrid"); if(!root) return;
  root.innerHTML=WEATHER_PLACES.map(place=>{const w=weatherData[place.id];if(!w)return'';const current=weatherCodeInfo(w.current.weather_code);const days=(w.daily.time||[]).map((date,i)=>{const info=weatherCodeInfo(w.daily.weather_code[i]);const label=new Intl.DateTimeFormat("fr-CA",{weekday:"short"}).format(new Date(date+'T12:00:00')).replace('.','');return `<div class="weather-day"><strong>${esc(label)}</strong><span class="weather-icon">${info.icon}</span><span>${Math.round(w.daily.temperature_2m_max[i])}°</span><small>${Math.round(w.daily.temperature_2m_min[i])}° · 💧${Math.round(w.daily.precipitation_probability_max[i]||0)}%</small></div>`;}).join('');return `<article class="card weather-city-card"><div class="weather-city-current"><div><span class="eyebrow">${current.icon} Maintenant</span><h2>${esc(place.name)}</h2><p>${esc(current.label)}</p><div class="weather-current-meta"><span>Ressenti ${Math.round(w.current.apparent_temperature)}°</span><span>💨 ${Math.round(w.current.wind_speed_10m)} km/h</span><span>💧 ${Math.round(w.current.relative_humidity_2m)} %</span><span>UV ${Math.round(w.daily.uv_index_max[0]||0)}</span></div></div><div class="weather-current-temp">${Math.round(w.current.temperature_2m)} °C</div></div><div class="weather-forecast-list">${days}</div></article>`;}).join('');
}
function renderTodayWeather(){
  if(!itineraryDays.length) return;
  const day=itineraryDays.find(d=>d.id===todaySelectedDayId)||itineraryDays[0]; const city=cityForDay(day)||"Rome"; const key=cityWeatherKey(city); const w=weatherData[key];
  const title=$("todayWeatherTitle"),summary=$("todayWeatherSummary"),details=$("todayWeatherDetails"); if(!title||!summary||!details)return;
  if(!w){title.textContent=city;summary.textContent="Météo indisponible";details.innerHTML="";return;}
  const info=weatherCodeInfo(w.current.weather_code);title.textContent=`${info.icon} ${Math.round(w.current.temperature_2m)} °C à ${city}`;summary.textContent=info.label;
  details.innerHTML=`<div><span>Ressenti</span><strong>${Math.round(w.current.apparent_temperature)} °C</strong></div><div><span>Pluie</span><strong>${Math.round(w.daily.precipitation_probability_max[0]||0)} %</strong></div><div><span>Vent</span><strong>${Math.round(w.current.wind_speed_10m)} km/h</strong></div><div><span>Lever</span><strong>${formatWeatherTime(w.daily.sunrise[0])}</strong></div><div><span>Coucher</span><strong>${formatWeatherTime(w.daily.sunset[0])}</strong></div>`;
}
function addTimelineWeather(){
  document.querySelectorAll('.timeline-day-card').forEach(card=>{if(card.querySelector('.timeline-weather-pill'))return;const day=itineraryDays.find(d=>d.id===card.dataset.timelineDay);if(!day)return;const w=weatherData[cityWeatherKey(cityForDay(day))];if(!w)return;const info=weatherCodeInfo(w.current.weather_code);const cover=card.querySelector('.timeline-day-cover>div');if(cover)cover.insertAdjacentHTML('beforeend',`<div class="timeline-weather-pill">${info.icon} ${Math.round(w.current.temperature_2m)} °C</div>`);});
}
function renderAllWeather(stale=false){renderHomeWeather();renderWeatherCities();renderTodayWeather();addTimelineWeather();const updated=$("weatherUpdatedAt");if(updated)updated.textContent=`${stale?'Dernières données disponibles':'Mise à jour'} : ${new Intl.DateTimeFormat('fr-CA',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`;}
$("refreshAllWeather")?.addEventListener("click",()=>loadWeather(true));
$("refreshTodayWeather")?.addEventListener("click",()=>loadWeather(true));
const originalShowPanel=window.showPanel;
window.showPanel=function(id){originalShowPanel(id);if(id==="conditions"||id==="today")setTimeout(()=>{renderAllWeather();},80);if(id==="world")setTimeout(renderWorldDashboard,40);};
loadWeather();
setInterval(()=>loadWeather(true),WEATHER_TTL);

// Exposition minimale pour Explorer 3.0
window.mapStageData = mapStageData;
window.renderMapStageDetails = renderMapStageDetails;
window.setActiveExplorerStage = setActiveExplorerStage;
Object.defineProperty(window,"itineraryDays",{get:()=>itineraryDays});
Object.defineProperty(window,"tripMap",{get:()=>tripMap});

window.explorerStageVisual = explorerStageVisual;
