"use strict";

// El menú solo se colapsa cuando JS está disponible; sin JS los enlaces se ven.
(() => {
  const toggle = document.querySelector("#menu-toggle");
  const nav = document.querySelector("#nav-list");
  if (!toggle || !nav || typeof window.matchMedia !== "function") return;
  const mobile = window.matchMedia("(max-width: 640px)");

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    nav.hidden = mobile.matches && !open;
  }

  function syncViewport() {
    const focusInNav = nav.contains(document.activeElement);
    const focusOnToggle = document.activeElement === toggle;
    toggle.hidden = !mobile.matches;
    setOpen(!mobile.matches);
    if (mobile.matches && focusInNav) toggle.focus();
    if (!mobile.matches && focusOnToggle) nav.querySelector("a").focus();
  }

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  function closeWithEscape(event) {
    if (event.key !== "Escape" || !mobile.matches || nav.hidden) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus();
  }
  nav.addEventListener("keydown", closeWithEscape);
  toggle.addEventListener("keydown", closeWithEscape);
  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (!link || !mobile.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    setOpen(false);
    // El foco abandona el menú oculto; la navegación nativa conserva URL e historial.
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
  mobile.addEventListener("change", syncViewport);
  syncViewport();
})();

// Abrir créditos al entrar por URL, cambiar el hash o pulsar el mismo enlace otra vez.
(() => {
  const credits = document.querySelector("#creditos");
  if (!credits) return;
  function openCredits(moveFocus = false) {
    credits.open = true;
    if (moveFocus) credits.querySelector("summary").focus({ preventScroll: true });
  }
  if (window.location.hash === "#creditos") openCredits();
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#creditos") openCredits(true);
  });
  document.querySelectorAll('a[href="#creditos"]').forEach(link => {
    link.addEventListener("click", (event) => {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) openCredits(true);
    });
  });
})();

// Mejora progresiva: el HTML conserva las seis etapas sin depender de JavaScript.
(() => {
  const controls = document.querySelector("#timeline-controls");
  const help = document.querySelector("#timeline-help");
  const stages = Array.from(document.querySelectorAll(".stage"));

  if (!controls || !help || stages.length === 0) return;

  controls.setAttribute("role", "tablist");
  controls.setAttribute("aria-label", "Etapas de la trayectoria");
  controls.setAttribute("aria-describedby", "timeline-help");

  // Cada botón apunta a su artículo mediante aria-controls.
  const buttons = stages.map((stage, index) => {
    const button = document.createElement("button");
    const year = document.createElement("strong");
    const club = document.createElement("span");
    button.type = "button";
    button.id = `selector-${stage.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", stage.id);
    button.setAttribute("aria-label", `${stage.dataset.year}: ${stage.dataset.club}`);
    year.textContent = stage.dataset.year;
    club.textContent = stage.dataset.club;
    button.append(year, club);
    button.addEventListener("click", () => selectStage(index));
    button.addEventListener("keydown", (event) => {
      let nextIndex;
      switch (event.key) {
        case "ArrowRight": nextIndex = (index + 1) % stages.length; break;
        case "ArrowLeft": nextIndex = (index - 1 + stages.length) % stages.length; break;
        case "Home": nextIndex = 0; break;
        case "End": nextIndex = stages.length - 1; break;
        default: return;
      }
      event.preventDefault();
      selectStage(nextIndex);
      buttons[nextIndex].focus();
    });
    stage.setAttribute("role", "tabpanel");
    stage.setAttribute("aria-labelledby", button.id);
    stage.tabIndex = 0;
    controls.append(button);
    return button;
  });

  function selectStage(selectedIndex) {
    stages.forEach((stage, index) => {
      const selected = index === selectedIndex;
      stage.hidden = !selected;
      buttons[index].setAttribute("aria-selected", String(selected));
      // Tab entra por la etapa activa; las flechas recorren las demás.
      buttons[index].tabIndex = selected ? 0 : -1;
    });
  }

  selectStage(0);
  controls.hidden = false;
  help.hidden = false;
})();
