
// Mon Carnet de Voyages — Explorer 3.0
// Fichier autonome : js/explorer.js
(() => {
  "use strict";

  let currentMode = "destinations";
  let destinationFilter = "all";
  let guidedTourTimer = null;
  let guidedTourIndex = -1;
  let timelinePlayTimer = null;
  let timelinePlayIndex = -1;
  let mapCardOriginalParent = null;
  let mapCardOriginalNextSibling = null;

  const byId = id => document.getElementById(id);

  function setVisible(element, visible){
    if(element) element.hidden = !visible;
  }

  function stageDate(stage){
    const first = stage.days?.[0]?.id || "";
    const last = stage.days?.[stage.days.length - 1]?.id || first;
    return { first, last };
  }

  function shortDate(value){
    if(!value) return {day:"—",month:""};
    const date = new Date(value + "T12:00:00");
    return {
      day:new Intl.DateTimeFormat("fr-CA",{day:"numeric"}).format(date),
      month:new Intl.DateTimeFormat("fr-CA",{month:"short"}).format(date).replace(".","")
    };
  }


  function timelineDayDescription(stage){
    const city=(stage.city||"").toLowerCase();
    if(city.includes("cinque")) return "Sentiers, villages colorés et premières vues sur la Méditerranée.";
    if(city.includes("florence")) return "Une journée d’art, d’architecture et de ruelles toscanes.";
    if(city.includes("toscane")) return "Routes panoramiques, vignobles, villages et rythme plus doux.";
    if(city.includes("venise")) return "Canaux, ponts, palais et découverte de la lagune.";
    if(city.includes("rome")) return "Histoire, monuments, places et derniers moments du voyage.";
    return "Une nouvelle étape à découvrir et à raconter.";
  }

  function renderExplorerTimeline(){
    const root = byId("explorerTimelineJourney");
    const summary = byId("explorerTimelineSummary");
    if(!root || typeof window.mapStageData !== "function") return;

    const stages = window.mapStageData();
    if(summary) summary.textContent = `${stages.length} étapes · ${window.itineraryDays?.length || 0} jours`;

    if(!stages.length){
      root.innerHTML = '<div class="card loading-card">Les étapes apparaîtront ici lorsque l’itinéraire sera chargé.</div>';
      return;
    }

    root.innerHTML = stages.map((stage,index)=>{
      const dates = stageDate(stage);
      const first = shortDate(dates.first);
      const last = shortDate(dates.last);
      const photos = stage.days.reduce((n,day)=>n+(Array.isArray(day.photos)?day.photos.length:0),0);
      const memories = stage.days.filter(day =>
        Number(day.rating||0) >= 4 ||
        String(day.favorite||day.journal||day.memoryText||"").trim()
      ).length;
      const places = stage.days.reduce((n,day)=>n+(Array.isArray(day.herePlaces)?day.herePlaces.length:0),0);
      const restaurants = stage.days.reduce((n,day)=>{
        const value=day.restaurants||day.restaurant;
        if(Array.isArray(value)) return n+value.filter(Boolean).length;
        return n+(String(value||"").trim()?1:0);
      },0);
      const visual = typeof window.explorerStageVisual === "function"
        ? window.explorerStageVisual(stage,index,stage.days.flatMap(day=>Array.isArray(day.photos)?day.photos.filter(Boolean):[]))
        : "linear-gradient(145deg,#315f50,#7e9a70)";

      return `
        <article class="explorer-v90-timeline-item explorer-v93-story-card" data-v90-stage="${index}" tabindex="0" role="button" style="--timeline-cover:${visual}">
          <div class="explorer-v93-story-visual">
            <span class="explorer-v93-story-number">${String(index+1).padStart(2,"0")}</span>
            <div>
              <span>${first.day} ${first.month}${dates.last!==dates.first?` — ${last.day} ${last.month}`:""}</span>
              <strong>${stage.city}</strong>
            </div>
          </div>
          <div class="explorer-v93-story-content">
            <span class="explorer-v93-story-label">Étape ${index+1}</span>
            <h3>${stage.city}</h3>
            <p>${timelineDayDescription(stage)}</p>
            <div class="explorer-v93-story-kpis">
              <span>📅 ${stage.days.length} jour${stage.days.length>1?"s":""}</span>
              <span>📸 ${photos} photo${photos>1?"s":""}</span>
              <span>❤️ ${memories} souvenir${memories>1?"s":""}</span>
              <span>🍝 ${restaurants} adresse${restaurants>1?"s":""}</span>
              <span>📌 ${places} lieu${places>1?"x":""}</span>
            </div>
            <button type="button" class="explorer-v93-open-stage">Ouvrir cette étape <b>→</b></button>
          </div>
        </article>`;
    }).join("");

    root.querySelectorAll("[data-v90-stage]").forEach(item=>{
      const open = () => {
        const index = Number(item.dataset.v90Stage) || 0;
        const stage = stages[index];
        root.querySelectorAll(".explorer-v93-story-card").forEach(card=>card.classList.toggle("active",card===item));
        updateTimelineProgress(index,stages.length);
        if(typeof window.setActiveExplorerStage === "function") window.setActiveExplorerStage(index);
        if(typeof window.renderMapStageDetails === "function") window.renderMapStageDetails(stage,index);
        if(window.tripMap) window.tripMap.flyTo(stage.coords,10,{duration:1.05});
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", event=>{
        if(event.key === "Enter" || event.key === " "){
          event.preventDefault();
          open();
        }
      });
    });

    updateTimelineProgress(0,stages.length);
  }

  function updateTimelineProgress(index,total){
    const percent=total>1?Math.round((index/(total-1))*100):100;
    const fill=byId("timelineProgressFill");
    const label=byId("timelineProgressLabel");
    const value=byId("timelineProgressPercent");
    if(fill) fill.style.width=`${percent}%`;
    if(label) label.textContent=`Étape ${Math.min(index+1,total)} sur ${total}`;
    if(value) value.textContent=`${percent} %`;
  }

  function stopTimelinePlay(){
    if(timelinePlayTimer) window.clearInterval(timelinePlayTimer);
    timelinePlayTimer=null;
    timelinePlayIndex=-1;
    const button=byId("timelineAutoPlay");
    if(button) button.textContent="▶ Lire le voyage";
    document.querySelectorAll(".explorer-v93-story-card").forEach(card=>card.classList.remove("active"));
  }

  function playNextTimelineStage(){
    const cards=[...document.querySelectorAll(".explorer-v93-story-card")];
    if(!cards.length){
      stopTimelinePlay();
      return;
    }
    timelinePlayIndex++;
    if(timelinePlayIndex>=cards.length){
      stopTimelinePlay();
      return;
    }
    const card=cards[timelinePlayIndex];
    cards.forEach(item=>item.classList.toggle("active",item===card));
    updateTimelineProgress(timelinePlayIndex,cards.length);
    card.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function toggleTimelinePlay(){
    if(timelinePlayTimer){
      stopTimelinePlay();
      return;
    }
    timelinePlayIndex=-1;
    playNextTimelineStage();
    timelinePlayTimer=window.setInterval(playNextTimelineStage,4200);
    const button=byId("timelineAutoPlay");
    if(button) button.textContent="⏸ Arrêter";
  }

  byId("timelineAutoPlay")?.addEventListener("click",toggleTimelinePlay);

  function moveMapCardToMode(){
    const mapCard = document.querySelector(".explorer-v81-map-card");
    const mapMode = byId("explorerMapMode");
    if(!mapCard || !mapMode) return;

    if(!mapCardOriginalParent){
      mapCardOriginalParent = mapCard.parentNode;
      mapCardOriginalNextSibling = mapCard.nextSibling;
    }
    mapMode.appendChild(mapCard);
    setTimeout(()=>window.tripMap?.invalidateSize(),120);
  }

  function restoreMapCard(){
    const mapCard = document.querySelector(".explorer-v81-map-card");
    if(!mapCard || !mapCardOriginalParent) return;
    if(mapCardOriginalNextSibling && mapCardOriginalNextSibling.parentNode === mapCardOriginalParent){
      mapCardOriginalParent.insertBefore(mapCard,mapCardOriginalNextSibling);
    }else{
      mapCardOriginalParent.appendChild(mapCard);
    }
    setTimeout(()=>window.tripMap?.invalidateSize(),120);
  }

  function applyExplorerMode(mode){
    currentMode = mode;
    if(mode!=="destinations") stopGuidedTour(false);
    if(mode!=="timeline") stopTimelinePlay();
    const timeline = byId("explorerTimelineMode");
    const mapMode = byId("explorerMapMode");
    const overview = document.querySelector(".explorer-v86-overview");
    const destinations = document.querySelector(".explorer-v83-destinations");
    const originalMapCard = document.querySelector(".explorer-v81-map-card");

    document.querySelectorAll("[data-explorer-mode]").forEach(button=>{
      const active = button.dataset.explorerMode === mode;
      button.classList.toggle("active",active);
      button.setAttribute("aria-selected",String(active));
    });

    if(mode === "timeline"){
      restoreMapCard();
      setVisible(timeline,true);
      setVisible(mapMode,false);
      if(overview) overview.hidden = true;
      if(destinations) destinations.hidden = true;
      if(originalMapCard) originalMapCard.hidden = true;
      renderExplorerTimeline();
    }else if(mode === "map"){
      setVisible(timeline,false);
      setVisible(mapMode,true);
      if(overview) overview.hidden = true;
      if(destinations) destinations.hidden = true;
      if(originalMapCard) originalMapCard.hidden = false;
      moveMapCardToMode();
    }else{
      restoreMapCard();
      setVisible(timeline,false);
      setVisible(mapMode,false);
      if(overview) overview.hidden = false;
      if(destinations) destinations.hidden = false;
      if(originalMapCard) originalMapCard.hidden = false;
    }

    window.localStorage.setItem("explorer_mode_v90",mode);
  }


  function destinationCards(){
    return [...document.querySelectorAll("#explorerCityCards [data-explorer-stage]")];
  }

  function visibleDestinationCards(){
    return destinationCards().filter(card=>!card.hidden);
  }

  function updateDestinationPremiumStatus(){
    const visible=visibleDestinationCards();
    const count=byId("explorerVisibleCount");
    if(count) count.textContent=`${visible.length} destination${visible.length===1?"":"s"}`;
    if(!guidedTourTimer){
      const counter=byId("explorerTourCounter");
      if(counter) counter.textContent=visible.length ? "Prête à explorer" : "Aucune destination";
    }
  }

  function applyDestinationFilter(filter){
    destinationFilter=filter||"all";
    stopGuidedTour(false);
    destinationCards().forEach(card=>{
      const match=destinationFilter==="all" || card.dataset.destinationCategory===destinationFilter;
      card.hidden=!match;
      card.classList.remove("explorer-v92-guided");
    });
    document.querySelectorAll("[data-destination-filter]").forEach(button=>{
      button.classList.toggle("active",button.dataset.destinationFilter===destinationFilter);
    });
    guidedTourIndex=-1;
    updateDestinationPremiumStatus();
    window.localStorage.setItem("explorer_destination_filter_v92",destinationFilter);
  }

  function highlightGuidedDestination(){
    const cards=visibleDestinationCards();
    if(!cards.length){
      stopGuidedTour();
      return;
    }
    guidedTourIndex=(guidedTourIndex+1)%cards.length;
    destinationCards().forEach(card=>card.classList.remove("explorer-v92-guided"));
    const card=cards[guidedTourIndex];
    card.classList.add("explorer-v92-guided");
    card.scrollIntoView({behavior:"smooth",block:"center"});
    const counter=byId("explorerTourCounter");
    const title=card.querySelector(".explorer-v91-copy>strong")?.textContent?.trim() || "Destination";
    if(counter) counter.textContent=`${guidedTourIndex+1} sur ${cards.length} · ${title}`;
  }

  function stopGuidedTour(updateButton=true){
    if(guidedTourTimer) window.clearInterval(guidedTourTimer);
    guidedTourTimer=null;
    destinationCards().forEach(card=>card.classList.remove("explorer-v92-guided"));
    const button=byId("explorerGuidedTour");
    if(button && updateButton) button.textContent="▶ Aperçu guidé";
    updateDestinationPremiumStatus();
  }

  function toggleGuidedTour(){
    const button=byId("explorerGuidedTour");
    if(guidedTourTimer){
      stopGuidedTour();
      return;
    }
    guidedTourIndex=-1;
    highlightGuidedDestination();
    guidedTourTimer=window.setInterval(highlightGuidedDestination,3800);
    if(button) button.textContent="⏸ Arrêter l’aperçu";
  }

  function refreshDestinationPremium(){
    const saved=window.localStorage.getItem("explorer_destination_filter_v92")||destinationFilter||"all";
    applyDestinationFilter(saved);
  }

  byId("explorerGuidedTour")?.addEventListener("click",toggleGuidedTour);

  document.addEventListener("click",event=>{
    const filter=event.target.closest("[data-destination-filter]");
    if(filter) applyDestinationFilter(filter.dataset.destinationFilter);
  });

  window.refreshDestinationPremiumV92=refreshDestinationPremium;

  document.addEventListener("click", event=>{
    const button = event.target.closest("[data-explorer-mode]");
    if(button) applyExplorerMode(button.dataset.explorerMode);
  });

  const originalShowPanel = window.showPanel;
  if(typeof originalShowPanel === "function"){
    window.showPanel = function(id){
      originalShowPanel(id);
      if(id === "map"){
        setTimeout(()=>{
          const saved = window.localStorage.getItem("explorer_mode_v90") || currentMode;
          applyExplorerMode(saved);
          renderExplorerTimeline();
        },120);
      }
    };
  }

  document.addEventListener("DOMContentLoaded",()=>{
    const saved = window.localStorage.getItem("explorer_mode_v90") || "destinations";
    applyExplorerMode(saved);
    window.setTimeout(refreshDestinationPremium,180);
  });

  // Exposé pour le rechargement après Firebase.
  window.renderExplorerTimelineV90 = renderExplorerTimeline;
})();
