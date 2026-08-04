
// Mon Carnet de Voyages — Livre de Voyage 0.9.5.3
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let selectedChapter = -1;

  function getStages(){
    return typeof window.mapStageData === "function" ? window.mapStageData() : [];
  }

  function getDays(){
    return Array.isArray(window.itineraryDays) ? window.itineraryDays : [];
  }

  function chapterIcon(city=""){
    const c=String(city).toLowerCase();
    if(c.includes("cinque")) return "🌊";
    if(c.includes("florence")) return "🏛️";
    if(c.includes("toscane")||c.includes("chianti")) return "🍇";
    if(c.includes("venise")) return "🚤";
    if(c.includes("rome")) return "🏟️";
    return "📍";
  }

  function chapterSubtitle(city=""){
    const c=String(city).toLowerCase();
    if(c.includes("cinque")) return "Notre arrivée au bord de la Méditerranée";
    if(c.includes("florence")) return "Au cœur de la Renaissance";
    if(c.includes("toscane")) return "Les collines et les routes de campagne";
    if(c.includes("venise")) return "La lumière de la lagune";
    if(c.includes("rome")) return "La ville éternelle";
    return "Une nouvelle étape de notre histoire";
  }

  function chapterQuote(city=""){
    const c=String(city).toLowerCase();
    if(c.includes("cinque")) return "Notre aventure commence entre les falaises et la Méditerranée.";
    if(c.includes("florence")) return "La Renaissance se découvre ici au détour de chaque rue.";
    if(c.includes("toscane")) return "Les routes bordées de cyprès invitent à ralentir.";
    if(c.includes("venise")) return "La lumière de la lagune transforme chaque promenade.";
    if(c.includes("rome")) return "L’histoire accompagne chacun de nos pas.";
    return "Une nouvelle page de notre histoire s’ouvre ici.";
  }

  function chapterIntro(city=""){
    const c=String(city).toLowerCase();
    if(c.includes("cinque")) return "Les villages colorés, les sentiers et la mer ouvrent le premier chapitre de ce voyage.";
    if(c.includes("florence")) return "Les places, les musées et les palais racontent une ville qui a changé l’histoire de l’art.";
    if(c.includes("toscane")) return "Vignobles, villages de pierre et routes panoramiques donnent à cette étape un rythme plus doux.";
    if(c.includes("venise")) return "Canaux, ponts et palais composent une ville qui ne ressemble à aucune autre.";
    if(c.includes("rome")) return "Monuments, fontaines et ruines antiques accompagnent les derniers jours du voyage.";
    return "Cette destination rassemble les moments, les photos et les découvertes de cette étape.";
  }

  function chapterVisual(city=""){
    const c=String(city).toLowerCase();
    if(c.includes("cinque")) return "../assets/manarola-sunset.jpg";
    return "../assets/toscane-accueil.jpg";
  }

  function stageDates(stage){
    const first=stage?.days?.[0]?.id;
    const last=stage?.days?.[stage.days.length-1]?.id || first;
    if(!first) return "";
    const fmt=value=>new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"long"}).format(new Date(value+"T12:00:00"));
    return first===last ? fmt(first) : `${fmt(first)} — ${fmt(last)}`;
  }

  function updateBookCover(){
    const allDays = getDays();
    const allStages = getStages();
    const photos = allDays.reduce((total, day) => total + (Array.isArray(day.photos) ? day.photos.length : 0), 0);
    const memories = allDays.filter(day =>
      Number(day.rating || 0) > 0 ||
      String(day.favorite || day.journal || day.memoryText || "").trim()
    ).length;

    if($("bookCoverDays")) $("bookCoverDays").textContent = `${allDays.length || 18} jours`;
    if($("bookCoverDestinations")) $("bookCoverDestinations").textContent = `${allStages.length || 5} étapes`;
    if($("bookCoverPhotos")) $("bookCoverPhotos").textContent = photos;
    if($("bookCoverMemories")) $("bookCoverMemories").textContent = memories;
    if($("bookCoverChapters")) $("bookCoverChapters").textContent = allStages.length || 5;
  }

  function updateProgress(index,total){
    const safeTotal=Math.max(total,1);
    const progress=index<0 ? 0 : Math.round(((index+1)/safeTotal)*100);
    if($("bookProgressLabel")) $("bookProgressLabel").textContent=index<0 ? `Chapitre 0 sur ${safeTotal}` : `Chapitre ${index+1} sur ${safeTotal}`;
    if($("bookProgressFill")) $("bookProgressFill").style.width=`${progress}%`;
  }

  function renderList(root, values, emptyText){
    if(!root) return;
    root.innerHTML = values.length
      ? values.map(value=>`<div>${String(value)}</div>`).join("")
      : `<div class="memories-v953-empty">${emptyText}</div>`;
  }

  function openChapter(index){
    const stages=getStages();
    const stage=stages[index];
    if(!stage) return;

    selectedChapter=index;
    updateProgress(index,stages.length);

    document.querySelectorAll(".memories-v952-chapter").forEach((item,i)=>item.classList.toggle("active",i===index));

    const chapter=$("travelBookChapter");
    const toc=$("travelBookToc");
    chapter.hidden=false;
    toc.hidden=true;

    const photos=stage.days.flatMap(day=>Array.isArray(day.photos)?day.photos.filter(Boolean):[]);
    const favorites=stage.days.map(day=>String(day.favorite||"").trim()).filter(Boolean);
    const journals=stage.days.map(day=>String(day.journal||day.memoryText||"").trim()).filter(Boolean);
    const restaurants=stage.days.flatMap(day=>{
      const value=day.restaurants||day.restaurant||[];
      return Array.isArray(value)?value.filter(Boolean):(String(value).trim()?[String(value).trim()]:[]);
    });
    const places=stage.days.reduce((total,day)=>total+(Array.isArray(day.herePlaces)?day.herePlaces.length:0),0);

    $("bookChapterEyebrow").textContent=`${chapterIcon(stage.city)} Chapitre ${index+1}`;
    $("bookChapterTitle").textContent=stage.city;
    $("bookChapterDates").textContent=stageDates(stage);
    $("bookChapterQuote").textContent=chapterQuote(stage.city);
    $("bookChapterDays").textContent=stage.days.length;
    $("bookChapterPhotos").textContent=photos.length;
    $("bookChapterMemories").textContent=favorites.length+journals.length;
    $("bookChapterPlaces").textContent=restaurants.length+places;
    $("bookChapterIntroTitle").textContent=`Bienvenue à ${stage.city}`;
    $("bookChapterIntro").textContent=chapterIntro(stage.city);
    $("bookChapterKeepsake").textContent=favorites[0]||journals[0]||"Ce moment apparaîtra lorsque vous aurez ajouté un coup de cœur à cette étape.";

    const hero=chapter.querySelector(".memories-v953-chapter-hero");
    hero.style.backgroundImage=`linear-gradient(180deg,rgba(5,19,14,.02),rgba(5,19,14,.86)),url("${chapterVisual(stage.city)}")`;

    const gallery=$("bookChapterGallery");
    $("bookChapterGalleryText").textContent=photos.length?`${photos.length} photo${photos.length>1?"s":""} enregistrée${photos.length>1?"s":""} dans cette étape.`:"Les photos de cette étape apparaîtront ici.";
    gallery.innerHTML=photos.slice(0,6).map(src=>`<img src="${src}" alt="Souvenir de ${stage.city}">`).join("");

    renderList($("bookChapterFavorites"),favorites,"Aucun coup de cœur enregistré pour cette étape.");
    renderList($("bookChapterRestaurants"),restaurants,"Aucune adresse enregistrée pour cette étape.");
    renderList($("bookChapterJournal"),journals,"Aucune note de journal enregistrée pour cette étape.");

    $("bookPreviousChapter").disabled=index===0;
    $("bookNextChapter").disabled=index===stages.length-1;
    $("bookPreviousChapter").onclick=()=>openChapter(index-1);
    $("bookNextChapter").onclick=()=>openChapter(index+1);

    chapter.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function renderToc(){
    const root=$("travelBookChapters");
    if(!root) return;
    const stages=getStages();

    root.innerHTML=stages.map((stage,index)=>`
      <button type="button" class="memories-v952-chapter" data-book-chapter="${index}">
        <span class="memories-v952-chapter-number">${String(index+1).padStart(2,"0")}</span>
        <span class="memories-v952-chapter-copy">
          <span>${chapterIcon(stage.city)} Chapitre ${index+1}</span>
          <strong>${stage.city}</strong>
          <small>${stageDates(stage)} · ${chapterSubtitle(stage.city)}</small>
        </span>
        <span class="memories-v952-chapter-arrow">→</span>
      </button>
    `).join("") || '<div class="memories-v952-placeholder">Les chapitres apparaîtront lorsque l’itinéraire sera chargé.</div>';

    root.querySelectorAll("[data-book-chapter]").forEach(button=>{
      button.addEventListener("click",()=>openChapter(Number(button.dataset.bookChapter)||0));
    });

    updateProgress(selectedChapter,stages.length);
  }


  function collectMoments(){
    const stages=getStages();
    const moments=[];

    stages.forEach((stage,stageIndex)=>{
      stage.days.forEach(day=>{
        const favorite=String(day.favorite||"").trim();
        const journal=String(day.journal||day.memoryText||"").trim();
        const rating=Number(day.rating||0);

        if(favorite){
          moments.push({
            type:"favorite",
            icon:"❤️",
            city:stage.city,
            stageIndex,
            dayId:day.id,
            title:favorite,
            text:journal || chapterSubtitle(stage.city),
            rating
          });
        }else if(rating>=4 && journal){
          moments.push({
            type:"rating",
            icon:"⭐",
            city:stage.city,
            stageIndex,
            dayId:day.id,
            title:`Une journée notée ${rating}/5`,
            text:journal,
            rating
          });
        }else if(journal){
          moments.push({
            type:"journal",
            icon:"📝",
            city:stage.city,
            stageIndex,
            dayId:day.id,
            title:"Une phrase à garder",
            text:journal,
            rating
          });
        }
      });
    });

    return moments.sort((a,b)=>(b.rating||0)-(a.rating||0));
  }

  function renderMoments(){
    const moments=collectMoments();
    const root=$("bookMomentsGrid");
    if(!root) return;

    if($("bookMomentsCount")){
      $("bookMomentsCount").textContent=`${moments.length} moment${moments.length===1?"":"s"}`;
    }

    const featured=moments[0];
    if(featured){
      $("bookFeaturedMomentTitle").textContent=featured.title;
      $("bookFeaturedMomentText").textContent=featured.text;
      $("bookFeaturedMomentMeta").textContent=`${featured.city} · ${featured.dayId}`;
      $("bookJourneyReflection").textContent=`de ${featured.city}, de ${featured.title.toLowerCase()} et de tous les petits instants qui ont rendu ce voyage unique.`;
    }else{
      $("bookFeaturedMomentTitle").textContent="Votre plus beau moment apparaîtra ici";
      $("bookFeaturedMomentText").textContent="Ajoutez un coup de cœur dans Aujourd’hui pour enrichir cette page.";
      $("bookFeaturedMomentMeta").textContent="Italie 2026";
      $("bookJourneyReflection").textContent="des découvertes, des paysages et des souvenirs que vous choisirez de conserver.";
    }

    root.innerHTML=moments.length
      ? moments.slice(0,9).map(moment=>`
          <article class="memories-v954-card">
            <span>${moment.icon}</span>
            <small>${moment.city}</small>
            <strong>${moment.title}</strong>
            <p>${moment.text}</p>
          </article>
        `).join("")
      : '<div class="memories-v954-empty">Les moments inoubliables apparaîtront lorsque vous aurez ajouté des coups de cœur, des notes ou des évaluations dans Aujourd’hui.</div>';
  }

  function openMoments(){
    $("travelBookToc").hidden=true;
    $("travelBookChapter").hidden=true;
    $("travelBookMoments").hidden=false;
    renderMoments();
    $("travelBookMoments").scrollIntoView({behavior:"smooth",block:"start"});
  }


  function allBookDays(){
    return getStages().flatMap(stage=>Array.isArray(stage.days)?stage.days:[]);
  }

  function valueList(day, keys){
    for(const key of keys){
      const value=day?.[key];
      if(Array.isArray(value)) return value.filter(Boolean);
      if(String(value||"").trim()) return [String(value).trim()];
    }
    return [];
  }

  function computeTravelNumbers(){
    const stages=getStages();
    const days=allBookDays();

    const photos=days.reduce((total,day)=>total+(Array.isArray(day.photos)?day.photos.filter(Boolean).length:0),0);
    const favorites=days.filter(day=>String(day.favorite||"").trim()).length;
    const memories=days.filter(day=>
      Number(day.rating||0)>0 ||
      String(day.favorite||day.journal||day.memoryText||"").trim()
    ).length;
    const restaurants=days.reduce((total,day)=>total+valueList(day,["restaurants","restaurant"]).length,0);
    const activities=days.reduce((total,day)=>total+valueList(day,["activities","activity","schedule"]).length,0);
    const places=days.reduce((total,day)=>total+(Array.isArray(day.herePlaces)?day.herePlaces.length:0),0);

    const rankedStages=stages.map(stage=>{
      const score=stage.days.reduce((total,day)=>{
        const rating=Number(day.rating||0);
        const favorite=String(day.favorite||"").trim()?4:0;
        const journal=String(day.journal||day.memoryText||"").trim()?1:0;
        const dayPhotos=Array.isArray(day.photos)?Math.min(day.photos.filter(Boolean).length,5)*.25:0;
        return total+rating+favorite+journal+dayPhotos;
      },0);
      return {stage,score};
    }).sort((a,b)=>b.score-a.score);

    const rankedDays=days.map(day=>{
      const score=
        Number(day.rating||0)*2 +
        (String(day.favorite||"").trim()?5:0) +
        (String(day.journal||day.memoryText||"").trim()?2:0) +
        (Array.isArray(day.photos)?Math.min(day.photos.filter(Boolean).length,6)*.4:0);
      return {day,score};
    }).sort((a,b)=>b.score-a.score);

    const moments=collectMoments();
    const favoriteDestination=rankedStages[0]?.score>0 ? rankedStages[0].stage.city : "À découvrir";
    const bestDay=rankedDays[0]?.score>0
      ? `${rankedDays[0].day.city||rankedDays[0].day.title||"Une journée spéciale"} · ${rankedDays[0].day.id}`
      : "À découvrir";
    const signature=moments[0]?.title || "À écrire";

    const reflectionParts=[];
    if(favoriteDestination!=="À découvrir") reflectionParts.push(`de ${favoriteDestination}`);
    if(moments[0]?.title) reflectionParts.push(`de ${moments[0].title.toLowerCase()}`);
    if(photos) reflectionParts.push(`de ${photos} photos qui garderont chaque détail vivant`);
    const reflection=reflectionParts.length
      ? reflectionParts.join(", ").replace(/, ([^,]*)$/, " et $1")
      : "des découvertes, des paysages et des moments qui deviendront des souvenirs";

    return {
      stages,days,photos,favorites,memories,restaurants,activities,places,
      favoriteDestination,bestDay,signature,reflection
    };
  }

  function renderTravelNumbers(){
    const data=computeTravelNumbers();
    const root=$("bookNumbersStats");
    if(!root) return;

    const stats=[
      ["📅",data.days.length||18,"jours d’aventure"],
      ["📍",data.stages.length||5,"destinations"],
      ["📷",data.photos,"photos"],
      ["❤️",data.favorites||data.memories,"coups de cœur et souvenirs"],
      ["🍝",data.restaurants,"adresses gourmandes"],
      ["🧭",data.activities+data.places,"activités et lieux"]
    ];

    root.innerHTML=stats.map(([icon,value,label])=>`
      <article class="memories-v955-stat">
        <span>${icon}</span>
        <strong>${value}</strong>
        <small>${label}</small>
      </article>
    `).join("");

    if($("bookFavoriteDestination")) $("bookFavoriteDestination").textContent=data.favoriteDestination;
    if($("bookBestDay")) $("bookBestDay").textContent=data.bestDay;
    if($("bookSignatureMoment")) $("bookSignatureMoment").textContent=data.signature;
    if($("bookNumbersReflection")) $("bookNumbersReflection").textContent=`${data.reflection}.`;
  }

  function openNumbers(){
    $("travelBookToc").hidden=true;
    $("travelBookChapter").hidden=true;
    $("travelBookMoments").hidden=true;
    $("travelBookNumbers").hidden=false;
    renderTravelNumbers();
    $("travelBookNumbers").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function openBook(){
    const content = $("travelBookContent");
    if(!content) return;
    content.hidden = false;
    requestAnimationFrame(() => {
      content.classList.add("is-open");
      renderToc();
      content.scrollIntoView({behavior:"smooth", block:"start"});
    });
  }

  $("openTravelBook")?.addEventListener("click", openBook);
  $("bookBackToToc")?.addEventListener("click",()=>{
    $("travelBookChapter").hidden=true;
    $("travelBookToc").hidden=false;
    $("travelBookToc").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("momentsBackToToc")?.addEventListener("click",()=>{
    $("travelBookMoments").hidden=true;
    $("travelBookToc").hidden=false;
    $("travelBookToc").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("numbersBackToToc")?.addEventListener("click",()=>{
    $("travelBookNumbers").hidden=true;
    $("travelBookToc").hidden=false;
    $("travelBookToc").scrollIntoView({behavior:"smooth",block:"start"});
  });

  document.addEventListener("click",event=>{
    const special=event.target.closest("[data-book-special]");
    if(!special) return;

    if(special.dataset.bookSpecial==="moments"){
      openMoments();
      return;
    }

    if(special.dataset.bookSpecial==="numbers"){
      openNumbers();
      return;
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    updateBookCover();
    window.setTimeout(()=>{
      updateBookCover();
      renderToc();
      renderMoments();
      renderTravelNumbers();
    }, 700);
  });

  document.addEventListener("today:rendered", () => {
    updateBookCover();
    renderToc();
    renderMoments();
    renderTravelNumbers();
  });

  window.updateTravelBookCover = updateBookCover;
})();
