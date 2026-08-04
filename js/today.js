
// Mon Carnet de Voyages — Aujourd'hui 0.9.4.2
(() => {
  "use strict";

  let currentDayId = "";
  let timer = null;
  let currentCity = "Italie";

  const $ = id => document.getElementById(id);
  const stateKey = dayId => `today_schedule_done_${dayId}`;

  function loadDone(dayId){
    try{
      const value = JSON.parse(localStorage.getItem(stateKey(dayId)) || "[]");
      return new Set(Array.isArray(value) ? value.map(Number) : []);
    }catch{
      return new Set();
    }
  }

  function saveDone(dayId, done){
    localStorage.setItem(stateKey(dayId), JSON.stringify([...done]));
  }

  function minutesFromTime(value){
    const match = String(value || "").match(/^([0-2]?\d):([0-5]\d)$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function formatCountdown(delta){
    if(delta === null) return "Consultez les détails de cette activité.";
    if(delta <= 0 && delta > -60) return "Commence maintenant";
    if(delta < 0) return "Horaire dépassé";
    const hours = Math.floor(delta / 60);
    const minutes = delta % 60;
    if(hours) return `Dans ${hours} h${minutes ? ` ${minutes} min` : ""}`;
    return `Dans ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  function refreshProgram(){
    const events = [...document.querySelectorAll("#todaySchedule .today-v942-event")];
    if(!events.length || !currentDayId) return;

    const done = loadDone(currentDayId);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parsed = events.map((event, index) => ({
      event,
      index,
      time: minutesFromTime(event.dataset.todayEventTime),
      label: event.dataset.todayEventLabel || "Activité"
    }));

    let current = parsed.find(item => !done.has(item.index) && item.time !== null && item.time >= nowMinutes);
    if(!current) current = parsed.find(item => !done.has(item.index)) || null;

    parsed.forEach(item => {
      const complete = done.has(item.index);
      const isCurrent = current?.index === item.index;
      item.event.classList.toggle("is-complete", complete);
      item.event.classList.toggle("is-current", isCurrent);
      const button = item.event.querySelector(".today-v942-check");
      const status = item.event.querySelector(".today-v942-event-status");
      const detail = item.event.querySelector(".today-v942-event-copy small");
      if(button){
        button.setAttribute("aria-pressed", String(complete));
        button.setAttribute("aria-label", `${complete ? "Rouvrir" : "Terminer"} ${item.label}`);
      }
      if(status) status.textContent = complete ? "Terminé" : isCurrent ? "Prochaine" : "À faire";
      if(detail){
        if(complete) detail.textContent = "Activité terminée";
        else if(item.time !== null) detail.textContent = formatCountdown(item.time - nowMinutes);
        else detail.textContent = isCurrent ? "À faire maintenant" : "Prévue aujourd’hui";
      }
    });

    const completed = done.size;
    const total = events.length;
    const percent = total ? Math.round(completed / total * 100) : 0;
    $("todayProgressFill").style.width = `${percent}%`;
    $("todayProgressPercent").textContent = `${percent} %`;
    $("todayProgressText").textContent = `${completed} activité${completed === 1 ? "" : "s"} sur ${total} terminée${completed === 1 ? "" : "s"}`;

    const nowTitle = $("todayNowTitle");
    const nowCountdown = $("todayNowCountdown");
    const nowLabel = $("todayNowLabel");
    const completeMessage = $("todayCompleteMessage");

    if(current){
      nowLabel.textContent = current.time !== null && current.time <= nowMinutes ? "EN CE MOMENT" : "PROCHAINE ACTIVITÉ";
      nowTitle.textContent = current.label;
      nowCountdown.textContent = current.time !== null ? formatCountdown(current.time - nowMinutes) : "Prête quand vous l’êtes.";
      $("todayNowAction").textContent = "Voir";
      $("todayNowAction").onclick = () => current.event.scrollIntoView({behavior:"smooth", block:"center"});
      if(completeMessage) completeMessage.hidden = true;
    }else{
      nowLabel.textContent = "JOURNÉE TERMINÉE";
      nowTitle.textContent = "Bravo, tout est terminé 🎉";
      nowCountdown.textContent = "Prenez quelques secondes pour garder votre plus beau souvenir.";
      $("todayNowAction").textContent = "Souvenir";
      $("todayNowAction").onclick = () => $("todayOpenMemory")?.click();
      if(completeMessage) completeMessage.hidden = false;
    }

    $("todayPremiumActivityCount").textContent = `${completed}/${total} terminée${completed === 1 ? "" : "s"}`;
    $("todayPremiumNextActivity").textContent = current?.label || "Journée terminée";
  }

  function bindProgram(){
    document.querySelectorAll("#todaySchedule .today-v942-check").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const card = button.closest(".today-v942-event");
        const index = Number(card?.dataset.todayEventIndex);
        if(!Number.isFinite(index) || !currentDayId) return;
        const done = loadDone(currentDayId);
        done.has(index) ? done.delete(index) : done.add(index);
        saveDone(currentDayId, done);
        refreshProgram();
      });
    });

    $("todayCompleteMemory")?.addEventListener("click", () => $("todayOpenMemory")?.click());
  }

  document.addEventListener("today:rendered", event => {
    currentDayId = event.detail?.dayId || "";
    currentCity = event.detail?.city || "Italie";
    const quickLabel = $("todayQuickDayLabel");
    if(quickLabel) quickLabel.textContent = currentCity;
    bindProgram();
    refreshProgram();
    if(timer) clearInterval(timer);
    timer = setInterval(refreshProgram, 60000);
  });


  function openCurrentDayTarget(target){
    if(!currentDayId || typeof window.openDayDetail !== "function") return;
    window.openDayDetail(currentDayId);

    window.setTimeout(() => {
      const targets = {
        favorite: document.getElementById("dayMemoryFavorite"),
        note: document.getElementById("dayMemoryJournal"),
        photo: document.getElementById("addDayPhoto")
      };
      const element = targets[target];
      if(!element) return;
      element.scrollIntoView({behavior:"smooth", block:"center"});
      element.classList.remove("today-v943-feedback");
      requestAnimationFrame(() => element.classList.add("today-v943-feedback"));
      if(target === "photo") element.click();
      else element.focus();
    }, 220);
  }

  function openExpenseQuick(){
    if(typeof window.showPanel !== "function") return;
    window.showPanel("budget");
    window.setTimeout(() => {
      const date = document.getElementById("expDate");
      const city = document.getElementById("expCity");
      const name = document.getElementById("expName");
      if(date) date.value = currentDayId;
      if(city && !city.value.trim()) city.value = currentCity;
      const form = document.querySelector(".budget-form");
      form?.scrollIntoView({behavior:"smooth", block:"start"});
      name?.focus();
    }, 180);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-today-quick]");
    if(!button) return;
    const action = button.dataset.todayQuick;
    if(action === "expense") openExpenseQuick();
    else openCurrentDayTarget(action);
  });

  window.addEventListener("beforeunload", () => {
    if(timer) clearInterval(timer);
  });
})();
