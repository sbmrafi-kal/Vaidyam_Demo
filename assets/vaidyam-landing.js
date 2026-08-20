/**
 * assets/vaidyam-landing.js
 * Standalone Client-Side Controllers for Vaidyam Medical Journal
 * Strictly decoupled from Liquid templates.
 */

(function () {
  'use strict';

  // 1. 18 Columns Dossier Preview Controller
  window.updatePreview = function (num, title, tag, desc, read, author, format) {
    var pNum = document.getElementById('prev-num');
    var pTitle = document.getElementById('prev-title');
    var pTag = document.getElementById('prev-tag');
    var pDesc = document.getElementById('prev-desc');
    var pRead = document.getElementById('prev-read');
    var pAuthor = document.getElementById('prev-author');
    var pFormat = document.getElementById('prev-format');

    if (pNum) pNum.innerText = num;
    if (pTitle) pTitle.innerText = title;
    if (pTag) pTag.innerText = tag;
    if (pDesc) pDesc.innerText = desc;
    if (pRead) pRead.innerText = read;
    if (pAuthor) pAuthor.innerText = author;
    if (pFormat) pFormat.innerText = format;

    var entries = document.querySelectorAll('.v-columns__entry');
    entries.forEach(function (entry) {
      entry.classList.remove('v-columns__entry--active');
    });

    if (window.event && window.event.currentTarget) {
      window.event.currentTarget.classList.add('v-columns__entry--active');
    }
  };

  // 2. Video Player Embed Controller
  window.playJournalVideo = function () {
    var container = document.getElementById('video-embed-frame');
    var iframe = document.getElementById('video-player-iframe');
    var btn = document.getElementById('video-play-btn');
    var poster = document.getElementById('video-poster-img');

    if (iframe) iframe.src = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0";
    if (container) {
      container.classList.remove('v-video__frame--hidden');
      container.classList.remove('hidden');
    }
    if (btn) {
      btn.classList.add('v-video__overlay--hidden');
      btn.classList.add('hidden');
    }
    if (poster) poster.classList.add('hidden');
  };

  // 3. Modal Toggle Controller
  window.toggleModal = function (modalId, show) {
    var modal = document.getElementById(modalId);
    if (!modal) return;

    if (show) {
      modal.classList.remove('v-modal--hidden');
      modal.classList.remove('hidden');
      modal.classList.add('v-modal--flex');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    } else {
      modal.classList.add('v-modal--hidden');
      modal.classList.add('hidden');
      modal.classList.remove('v-modal--flex');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  };

  // 4. Keyboard & Global Accessibility Listeners
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      window.toggleModal('look-inside-modal', false);
    }
  });

  // 5. Mobile Nav Helper
  window.toggleMobileNav = function (navId) {
    var nav = document.getElementById(navId);
    if (!nav) return;
    nav.classList.toggle('v-masthead__mobile-nav--active');
  };

})();
