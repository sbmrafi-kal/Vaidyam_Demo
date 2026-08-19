/* =====================================================================
   KA GLOSSARY TERMS COMPONENT LOGIC
   Modular JavaScript controller for Kerala Ayurveda Glossary Cards
   ===================================================================== */

(function() {
  'use strict';

  function initGlossaryState() {
    let cards = document.querySelectorAll('.ka-article-glossary-card, #glossary');
    let isDesktop = window.innerWidth >= 768;
    cards.forEach(function(card) {
      if (isDesktop) {
        card.classList.add('is-expanded');
      } else {
        card.classList.remove('is-expanded');
      }
      let btn = card.querySelector('.ka-glossary-toggle-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', isDesktop ? 'true' : 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlossaryState);
  } else {
    initGlossaryState();
  }

  function bindGlossaryToggles() {
    if (window._kaGlossaryToggleInitialized) return;
    window._kaGlossaryToggleInitialized = true;

    document.addEventListener('click', function(e) {
      let trigger = e.target.closest('.ka-glossary-header, .ka-glossary-toggle-btn');
      if (!trigger) return;
      let card = trigger.closest('.ka-article-glossary-card, #glossary');
      if (!card) return;

      e.preventDefault();
      let isExpanded = card.classList.toggle('is-expanded');
      let btn = card.querySelector('.ka-glossary-toggle-btn');
      if (btn) btn.setAttribute('aria-expanded', String(isExpanded));
      if (isExpanded && window.innerWidth < 1024) {
        setTimeout(function() {
          let headerEl = document.querySelector('.theme-header-custom, header, .header-wrapper');
          let navOffset = (headerEl ? headerEl.offsetHeight : 60) + 16;
          let rect = card.getBoundingClientRect();
          let scrollTarget = window.pageYOffset + rect.top - navOffset;
          window.scrollTo({
            top: Math.max(0, scrollTarget),
            behavior: 'smooth'
          });
        }, 120);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindGlossaryToggles);
  } else {
    bindGlossaryToggles();
  }
})();
