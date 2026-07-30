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

let reviveScenes = [];
let reviveSceneIndex = 0;
let reviveTimer = null;
let revivePaused = false;

function reviveImageForDay(day){
  const photos=Array.isArray(day.photos)?day.photos.filter(Boolean):[];
  return photos[0]||"assets/manarola-sunset.jpg";
}
function reviveCities(){
  const cities=[];
  itineraryDays.forEach(day=>{ const city=cityForDay(day)||"Italie"; if(cities[cities.length-1]!==city) cities.push(city); });
  return cities;
}
function buildReviveScenes(){
  const scenes=itineraryDays.map((day,index)=>({
    type:"day",day,index,city:cityForDay(day)||"Italie",image:reviveImageForDay(day),
    quote:timelineReflection(day)||timelineMemoryForDay(day)||"Une nouvelle journée à raconter.",
    photos:Array.isArray(day.photos)?day.photos:[],places:Array.isArray(day.herePlaces)?day.herePlaces:[],rating:timelineRating(day)
  }));
  const totalPhotos=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0);
  const totalPlaces=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.herePlaces)?d.herePlaces.length:0),0);
  const favorites=itineraryDays.filter(d=>timelineRating(d)>=5 || d.favoritePhotoIndex!==undefined).length;
  scenes.push({type:"final",image:"assets/manarola-sunset.jpg",totalPhotos,totalPlaces,favorites,days:itineraryDays.length});
  return scenes;
}
function renderReviveRoute(scene){
  const root=$("reviveRoute"); if(!root) return;
  const cities=reviveCities();
  let currentCity=scene.type==="day"?scene.city:cities[cities.length-1];
  let active=cities.lastIndexOf(currentCity); if(active<0) active=0;
  root.innerHTML=cities.map((city,i)=>`<div class="revive-route-step ${i<active?"done":i===active?"active":""}"><span>${esc(city)}</span></div>`).join("");
}
function renderReviveScene(){
  const scene=reviveScenes[reviveSceneIndex]; if(!scene) return;
  const bg=$("reviveBackground"),content=$("reviveContent");
  bg.style.opacity="0";
  setTimeout(()=>{ bg.style.backgroundImage=`url('${scene.image}')`; bg.style.opacity="1"; },120);
  content.style.animation="none"; void content.offsetWidth; content.style.animation="reviveTextIn .75s ease";
  if(scene.type==="final"){
    content.className="revive-content revive-final";
    content.innerHTML=`<span class="revive-eyebrow">Fin du voyage</span><h1>Merci Italie ❤️</h1><div class="revive-date">Des souvenirs à garder pour toujours</div><div class="revive-final-grid"><div><strong>${scene.days}</strong><span>journées</span></div><div><strong>${scene.totalPhotos}</strong><span>photos</span></div><div><strong>${scene.totalPlaces}</strong><span>lieux enregistrés</span></div><div><strong>${scene.favorites}</strong><span>journées favorites</span></div></div>`;
  }else{
    content.className="revive-content";
    content.innerHTML=`<span class="revive-eyebrow">Jour ${scene.index+1} sur ${itineraryDays.length}</span><h1>${esc(scene.city)}</h1><div class="revive-date">${esc(formatDateFr(scene.day.id))}</div><blockquote class="revive-quote">« ${esc(displayValue(scene.quote))} »</blockquote><div class="revive-summary"><span>📸 ${scene.photos.length} photo${scene.photos.length!==1?"s":""}</span><span>📌 ${scene.places.length} lieu${scene.places.length!==1?"x":""}</span><span>${scene.rating?"⭐ "+scene.rating+"/5":"⭐ Pas encore notée"}</span></div>`;
  }
  $("reviveCounter").textContent=`${reviveSceneIndex+1} / ${reviveScenes.length}`;
  $("reviveProgress").style.width=`${Math.round(((reviveSceneIndex+1)/reviveScenes.length)*100)}%`;
  renderReviveRoute(scene);
}
function scheduleRevive(){
  clearTimeout(reviveTimer);
  if(revivePaused) return;
  reviveTimer=setTimeout(()=>{
    if(reviveSceneIndex<reviveScenes.length-1){ reviveSceneIndex++; renderReviveScene(); scheduleRevive(); }
    else { revivePaused=true; $("revivePause").textContent="▶ Rejouer"; $("reviveModal").classList.add("is-paused"); }
  },6500);
}
function startTimelinePlayback(){
  if(!itineraryDays.length) return;
  reviveScenes=buildReviveScenes(); reviveSceneIndex=0; revivePaused=false;
  const modal=$("reviveModal"); modal.hidden=false; modal.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden";
  $("revivePause").textContent="⏸ Pause"; modal.classList.remove("is-paused");
  renderReviveScene(); scheduleRevive();
}
function stopTimelinePlayback(){
  clearTimeout(reviveTimer); reviveTimer=null; revivePaused=false;
  const modal=$("reviveModal"); if(modal){ modal.hidden=true; modal.setAttribute("aria-hidden","true"); modal.classList.remove("is-paused"); }
  document.body.style.overflow="";
}
function moveRevive(delta){
  reviveSceneIndex=Math.max(0,Math.min(reviveScenes.length-1,reviveSceneIndex+delta)); renderReviveScene(); scheduleRevive();
}
$("reviveClose")?.addEventListener("click",stopTimelinePlayback);
$("revivePrev")?.addEventListener("click",()=>moveRevive(-1));
$("reviveNext")?.addEventListener("click",()=>moveRevive(1));
$("revivePause")?.addEventListener("click",()=>{
  if(reviveSceneIndex===reviveScenes.length-1 && revivePaused){ reviveSceneIndex=0; revivePaused=false; }
  else revivePaused=!revivePaused;
  $("revivePause").textContent=revivePaused?"▶ Continuer":"⏸ Pause";
  $("reviveModal").classList.toggle("is-paused",revivePaused);
  renderReviveScene(); scheduleRevive();
});
document.addEventListener("keydown",e=>{ if($("reviveModal")?.hidden===false){ if(e.key==="Escape") stopTimelinePlayback(); if(e.key==="ArrowRight") moveRevive(1); if(e.key==="ArrowLeft") moveRevive(-1); } });

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
$("timelinePlayButton")?.addEventListener("click",startTimelinePlayback);
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
    return `<div class="today-event"><span class="today-event-time">${time ? esc(time) : String(index+1).padStart(2,"0")}</span><span>${esc(label)}</span></div>`;
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

  const index = itineraryDays.findIndex(item => item.id === day.id);
  const previous = $("todayPrevious");
  const next = $("todayNext");
  previous.disabled = index <= 0;
  next.disabled = index < 0 || index >= itineraryDays.length-1;
  previous.onclick = () => { if(index>0){ todaySelectedDayId=itineraryDays[index-1].id; renderToday(); window.scrollTo({top:0,behavior:"smooth"}); }};
  next.onclick = () => { if(index<itineraryDays.length-1){ todaySelectedDayId=itineraryDays[index+1].id; renderToday(); window.scrollTo({top:0,behavior:"smooth"}); }};
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


function renderPremiumHome(){
  const today=selectedTodayDay();
  const first=itineraryDays[0], last=itineraryDays[itineraryDays.length-1];
  const nowKey=localDateKey();
  const tripStarted=first && nowKey>=first.id;
  const tripFinished=last && nowKey>last.id;
  let progress=0, title="Préparation en cours", left=`${itineraryDays.length || 18} jours de voyage`, right="Départ le 28 septembre";
  if(tripStarted && !tripFinished){
    const idx=Math.max(0,itineraryDays.findIndex(d=>d.id>=nowKey)); progress=Math.round(((idx+1)/Math.max(1,itineraryDays.length))*100); title=`Jour ${idx+1} sur ${itineraryDays.length}`; left=`${idx+1} jours commencés`; right=`${Math.max(0,itineraryDays.length-idx-1)} jours restants`;
  }else if(tripFinished){progress=100;title="Voyage terminé";left="De magnifiques souvenirs";right="À revivre quand tu veux";}
  else { const prep=Number(($("preparationPercent")?.textContent||"0").replace(/\D/g,""))||0; progress=prep; }
  $("premiumProgressPercent").textContent=`${progress} %`; $("premiumProgressBar").style.width=`${progress}%`; $("premiumProgressTitle").textContent=title; $("premiumProgressLeft").textContent=left; $("premiumProgressRight").textContent=right;
  if(today){
    const city=cityForDay(today)||"Italie"; $("premiumCurrentCity").textContent=tripStarted?city:"Ton voyage approche"; $("premiumCurrentDate").textContent=tripStarted?formatDateFr(today.id):"28 septembre au 16 octobre 2026"; $("premiumTodayTitle").textContent=tripStarted?city:"Préparer le voyage";
    const items=[]; const hotel=firstValue(today,["hotel","accommodation"]); const transport=firstValue(today,["transport","train","flight"]); const acts=valueItems(firstValue(today,["activities","activity","schedule"])); if(hotel)items.push(["🏨",displayValue(hotel)]); if(transport)items.push(["🚆",displayValue(transport)]); if(acts[0])items.push(["🥾",acts[0]]); $("premiumTodayDetails").innerHTML=(items.length?items:[["✨","Consulte ta journée et complète les détails"]]).map(i=>`<div><span>${i[0]}</span><span>${esc(i[1])}</span></div>`).join("");
  }
  const spent=expenses.reduce((sum,item)=>sum+expenseCad(item),0); const planned=Number(plannedBudgetValue)||0; $("premiumBudgetRemaining").textContent=dashboardMoney(Math.max(0,planned-spent));
  $("premiumPhotoCount").textContent=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.photos)?d.photos.length:0),0); $("premiumFavoriteCount").textContent=itineraryDays.filter(d=>Number.isInteger(Number(d.favoritePhotoIndex))&&Number(d.favoritePhotoIndex)>=0).length; $("premiumPlaceCount").textContent=itineraryDays.reduce((n,d)=>n+(Array.isArray(d.herePlaces)?d.herePlaces.length:0),0);
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
function renderTripMapData(fit=false){
  const stages=mapStageData();
  const places=allHerePlaces();
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
    const marker=L.marker(stage.coords,{title:stage.city}).addTo(tripMarkersLayer).bindPopup(stagePopup(stage,index));
    marker.on("click",()=>renderMapStageDetails(stage,index));
  });
  if(route.length>1) L.polyline(route,{color:"#1f6b52",weight:4,opacity:.75,dashArray:"9 8"}).addTo(tripRouteLayer);
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
  const memories=stage.days.map(day=>firstValue(day,["memoryText","journal","memory","favoriteMoment"])).filter(Boolean);
  const places=stage.days.flatMap(day=>(Array.isArray(day.herePlaces)?day.herePlaces:[]).map(place=>({...place,dayId:day.id})));
  const photos=stage.days.flatMap(day=>(Array.isArray(day.photos)?day.photos:[]).map((src,photoIndex)=>({src,dayId:day.id,photoIndex})));
  const ratings=stage.days.map(day=>Number(day.rating||day.dayRating||0)).filter(n=>n>0);
  const average=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
  const budgetValues=stage.days.map(day=>firstValue(day,["budget","dailyBudget"])).filter(Boolean);
  root.innerHTML=`<article class="card stage-detail-card">
    <div class="stage-detail-head"><div><span class="stage-number">Étape ${index+1}</span><h2>📍 ${esc(stage.city)}</h2><p>${esc(stageDateRange(stage))}</p></div><div class="stage-rating">${average?"★".repeat(average)+"☆".repeat(5-average):"Pas encore notée"}</div></div>
    <div class="stage-kpis"><span><strong>${stage.days.length}</strong> journée${stage.days.length>1?"s":""}</span><span><strong>${photos.length}</strong> photo${photos.length>1?"s":""}</span><span><strong>${places.length}</strong> lieu${places.length>1?"x":""}</span></div>
    <div class="stage-info-grid">${renderStageList("🏨","Hébergement",hotels)}${renderStageList("🍝","Restaurants",restaurants)}${renderStageList("🥾","Activités",activities)}${renderStageList("🚆","Transports",transports)}${budgetValues.length?renderStageList("💶","Budget",budgetValues.map(displayValue)):""}${renderStageList("📝","Souvenirs",memories.map(displayValue))}</div>
    ${photos.length?`<section class="stage-photo-section"><h3>📸 Photos de l’étape</h3><div class="stage-photo-grid">${photos.slice(0,12).map((photo,i)=>`<button type="button" class="stage-photo-button" data-stage-photo-index="${i}"><img src="${photo.src}" alt="Photo de ${esc(stage.city)}"></button>`).join("")}</div></section>`:""}
    ${places.length?`<section class="stage-place-section"><h3>📌 Je suis ici</h3>${places.map(place=>`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(place.latitude+","+place.longitude)}"><strong>${esc(place.name||"Endroit")}</strong><span>${esc(formatDateFr(place.dayId))}${place.time?` · ${esc(place.time)}`:""}</span></a>`).join("")}</section>`:""}
    <div class="stage-detail-actions"><button type="button" class="btn" id="openStageFirstDay">Voir la première journée</button><a class="btn secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stage.coords[0]+","+stage.coords[1])}">🧭 Itinéraire Google Maps</a></div>
  </article>`;
  $("openStageFirstDay")?.addEventListener("click",()=>openDayDetail(stage.days[0].id));
  root.querySelectorAll(".stage-photo-button").forEach(button=>button.addEventListener("click",()=>openPhotoViewer(photos.map(p=>p.src),Number(button.dataset.stagePhotoIndex)||0,stage.city)));
  root.scrollIntoView({behavior:"smooth",block:"start"});
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
