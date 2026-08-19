/* =====================================================================
   KA READ ALOUD COMPONENT LOGIC
   Modular JavaScript controller for Kerala Ayurveda Read Aloud Player
   ===================================================================== */

(function() {
  'use strict';

  // Cancel any lingering audio synthesis from previous page sessions or hard refresh
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }

  function cleanupSpeech() {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  window.addEventListener('beforeunload', cleanupSpeech);
  window.addEventListener('pagehide', cleanupSpeech);

  function initKaReadAloudScript() {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    let chatbotBtn = document.getElementById('ka-chatbot-trigger') || document.querySelector('.ka-chatbot-trigger');
    if (chatbotBtn && window.getComputedStyle(chatbotBtn).display !== 'none') {
      document.body.classList.add('has-ask-guruji');
    }

    let trigger = document.getElementById('vaidyam-read-aloud-trigger');
    let modal = document.getElementById('vaidyam-read-aloud-modal');
    let contentBox = document.getElementById('vaidyam-read-aloud-modal-content');
    let closeBtn = modal ? modal.querySelector('.vaidyam-read-aloud-modal-close') : null;
    let overlay = modal ? modal.querySelector('.vaidyam-read-aloud-modal-overlay') : null;
    let optionBtns = modal ? modal.querySelectorAll('.vaidyam-read-aloud-option-btn') : [];
    let backBtn = modal ? modal.querySelector('.vaidyam-read-aloud-back-btn') : null;
    let tocList = modal ? modal.querySelector('.vaidyam-read-aloud-toc-list') : null;

    let player = document.getElementById('vaidyam-read-aloud-player');
    let playBtn = player ? player.querySelector('.vaidyam-read-aloud-play-btn') : null;
    let stopBtn = player ? player.querySelector('.vaidyam-read-aloud-stop-btn') : null;
    let speedBtn = player ? player.querySelector('.vaidyam-read-aloud-speed-btn') : null;
    let speedDropdown = player ? player.querySelector('.vaidyam-read-aloud-speed-dropdown') : null;
    let statusText = player ? player.querySelector('.vaidyam-read-aloud-status-text') : null;
    let statusDot = player ? player.querySelector('.vaidyam-read-aloud-status-dot') : null;
    let progressSlider = player ? player.querySelector('.vaidyam-read-aloud-progress-slider') : null;
    let rewindBtn = player ? player.querySelector('.vaidyam-read-aloud-rewind-btn') : null;
    let forwardBtn = player ? player.querySelector('.vaidyam-read-aloud-forward-btn') : null;

    // Mobile Player Elements
    let mobileCard = document.getElementById('ka-mobile-player-card');
    let mpPlayBtn = document.getElementById('ka-mp-play');
    let mpRewindBtn = document.getElementById('ka-mp-rewind');
    let mpForwardBtn = document.getElementById('ka-mp-forward');
    let mpRange = document.getElementById('ka-mp-range');
    let mpWaveActiveSvg = document.getElementById('ka-mp-wave-active-svg');
    let mpTimeCurrent = document.getElementById('ka-mp-time-current');
    let mpTimeTotal = document.getElementById('ka-mp-time-total');
    let mpExpandBtn = document.getElementById('ka-mp-expand');
    let mpExpandedContent = document.getElementById('ka-mp-expanded');

    let currentSpeed = 1.0;
    let currentVolume = 1.0;
    let isShowingTotalTimeMode = false;
    let isPlaying = false;
    let isSeeking = false;
    let isSpeechPaused = false;
    let isChangingSpeed = false;
    let speakQueue = [];
    let pausedCharIndex = 0;
    let currentQueueIndex = 0;
    let synth = window.speechSynthesis;
    let currentUtterance = null;
    let endTimeout = null;
    let seekTimeout = null;
    let pauseTimer = null;
    let fallbackInterval = null;
    let hasReceivedOnBoundary = false;

    // Global Modal Exporter
    window.openKaReadAloudModal = function() {
      let targetModal = modal || document.getElementById('vaidyam-read-aloud-modal');
      let targetContent = contentBox || document.getElementById('vaidyam-read-aloud-modal-content');
      if (targetModal) {
        targetModal.classList.add('is-active');
        targetModal.setAttribute('aria-hidden', 'false');
        if (targetContent) targetContent.classList.remove('toc-active');
      }
    };

    function closeModal() {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      let targetModal = modal || document.getElementById('vaidyam-read-aloud-modal');
      if (targetModal) {
        targetModal.classList.remove('is-active');
        targetModal.setAttribute('aria-hidden', 'true');
      }
    }
    window.closeKaReadAloudModal = closeModal;

    if (synth) {
      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = function () {
          synth.getVoices();
        };
      }
      synth.getVoices();
    }

    function stackButtons() {
      let activeTrigger = trigger || document.getElementById('vaidyam-read-aloud-trigger');
      if (!activeTrigger) return;
      let chatbotBtn = document.getElementById('ka-chatbot-trigger');
      let isChatbotVisible = chatbotBtn && !chatbotBtn.classList.contains('ka-hidden') && window.getComputedStyle(chatbotBtn).display !== 'none';
      activeTrigger.classList.toggle('is-stacked', isChatbotVisible);
    }
    stackButtons();
    window.addEventListener('resize', stackButtons, { passive: true });
    setTimeout(stackButtons, 1000);

    function checkTriggerVisibility() {
      let activeTrigger = trigger || document.getElementById('vaidyam-read-aloud-trigger');
      let activePlayer = player || document.getElementById('vaidyam-read-aloud-player');
      let activeMobileCard = mobileCard || document.getElementById('ka-mobile-player-card');
      if (!activeTrigger) return;

      let isPlayerActive = (isPlaying || (activePlayer && activePlayer.classList.contains('is-active')) || (activeMobileCard && activeMobileCard.classList.contains('is-active')));
      if (isPlayerActive) {
        activeTrigger.classList.add('ka-hidden');
        return;
      }

      // Condition 1: Must reach Key Takeaways card >= 50% of the viewport (NEVER Table of Contents or hero)
      let keyTakeaways = document.querySelector('.ka-key-takeaways-wrapper') || 
                         document.querySelector('#at-a-glance') || 
                         document.querySelector('.ka-key-takeaways-box');
      
      let hasReachedKeyTakeaways = false;
      if (keyTakeaways) {
        let ktRect = keyTakeaways.getBoundingClientRect();
        hasReachedKeyTakeaways = (ktRect.top <= window.innerHeight * 0.5);
      } else {
        hasReachedKeyTakeaways = (window.pageYOffset >= 650);
      }

      // Condition 2: Disappear when recommend products card comes >= 30% of viewport
      let recProducts = document.querySelector('.ka-article-products, #products, .ka-product-recommendations, .ka-article-product-grid-shell, .ka-article-product-recommendations');
      let isPastRecommendProducts = false;
      if (recProducts) {
        let prodRect = recProducts.getBoundingClientRect();
        isPastRecommendProducts = (prodRect.top <= window.innerHeight * 0.70);
      } else {
        let articleBody = document.querySelector('.ka-article-body') || document.querySelector('.ka-article-content');
        if (articleBody) {
          let bodyRect = articleBody.getBoundingClientRect();
          isPastRecommendProducts = (bodyRect.bottom <= window.innerHeight * 0.30);
        }
      }

      let footer = document.querySelector('footer');
      let footerRect = footer ? footer.getBoundingClientRect() : null;
      let isFooterOverlapping = footerRect && (footerRect.top <= window.innerHeight);

      let shouldShowTrigger = hasReachedKeyTakeaways && !isPastRecommendProducts && !isFooterOverlapping;

      activeTrigger.classList.toggle('ka-hidden', !shouldShowTrigger);
      activeTrigger.classList.toggle('is-past-body', !shouldShowTrigger);
    }
    checkTriggerVisibility();
    window.addEventListener('scroll', checkTriggerVisibility, { passive: true });
    window.addEventListener('resize', checkTriggerVisibility, { passive: true });

    if (trigger) {
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.openKaReadAloudModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    optionBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        let mode = btn.getAttribute('data-mode') || 'entire';
        if (mode === 'section') {
          buildTocList();
          if (contentBox) contentBox.classList.add('toc-active');
        } else {
          closeModal();
          startReadAloud(mode);
        }
      });
    });

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (contentBox) contentBox.classList.remove('toc-active');
      });
    }

    function buildTocList() {
      if (!tocList) return;
      tocList.innerHTML = '';

      let excludedSelector = '.ka-author-reviewer-component, .ka-expert-card, .ka-expert-section-container, .vaidyam-why-trust-card, .ka-why-trust-inner, .ka-why-trust-header, .vaidyam-trust-breaker-card, #vaidyam-trust-breaker, .vaidyam-trust-breaker-inner, .ka-consult-breaker-card, .ka-consult-breaker-inner, .ka-consult-breaker-content, .ka-apothecary-card, .ka-consultation-card, .vaidyam-article-toc, #vaidyam-article-toc, .vaidyam-article-toc-card, .ka-article-sidebar, .ka-blog-product-card, .ka-article-products, footer';

      // 1. First check if explicit Table of Contents links exist on the page
      let tocLinks = Array.from(document.querySelectorAll('.vaidyam-article-toc-list a, .vaidyam-article-toc-item a, #vaidyam-article-toc a, .ka-toc-card a'));
      if (tocLinks.length > 0) {
        let addedCount = 0;
        tocLinks.forEach(function (a) {
          let href = a.getAttribute('href');
          if (href && href.indexOf('#') === 0) {
            let targetH = document.querySelector(href);
            if (targetH) {
              addedCount++;
              let btn = document.createElement('button');
              btn.className = 'vaidyam-read-aloud-toc-btn';
              btn.textContent = addedCount + '. ' + (a.textContent || targetH.textContent || '').trim();
              btn.addEventListener('click', function () {
                closeModal();
                startReadAloud('section', targetH);
              });
              tocList.appendChild(btn);
            }
          }
        });
        if (addedCount > 0) return;
      }

      // 2. Fallback: Filter all h2/h3 inside .ka-article-body excluding reviewer, expert, and trust card blocks
      let headings = Array.from(document.querySelectorAll('.ka-article-body h2, .ka-article-body h3')).filter(function (h) {
        return !h.closest(excludedSelector);
      });

      if (headings.length === 0) {
        tocList.innerHTML = '<p class="vaidyam-read-aloud-empty-msg">No section headings found in this article.</p>';
        return;
      }

      headings.forEach(function (h, idx) {
        let btn = document.createElement('button');
        btn.className = 'vaidyam-read-aloud-toc-btn';
        btn.textContent = (idx + 1) + '. ' + (h.textContent || '').trim();
        btn.addEventListener('click', function () {
          closeModal();
          startReadAloud('section', h);
        });
        tocList.appendChild(btn);
      });
    }

    function getSegments(mode, startHeading) {
      let segments = [];
      let articleBody = document.querySelector('.ka-article-body') || 
                         document.querySelector('.ka-article-content') || 
                         document.querySelector('.article-template__content') || 
                         document.querySelector('article') || 
                         document.body;
      if (!articleBody) return segments;

      if (mode === 'takeaways') {
        let takeawayCard = document.querySelector('.ka-key-takeaways-wrapper, #at-a-glance, .vaidyam-key-takeaways-card, .vaidyam-article-at-a-glance, .vaidyam-article-hero__takeaways');
        if (takeawayCard) {
          let items = Array.from(takeawayCard.querySelectorAll('.ka-key-takeaways-heading, .ka-key-takeaways-rte p, .ka-key-takeaways-rte li, p, li'));
          if (items.length === 0) items = [takeawayCard];
          items.forEach(function (el) {
            let txt = (el.textContent || '').trim();
            if (txt.length > 2) segments.push({ element: el, text: txt });
          });
          if (segments.length > 0) return segments;
        }

        let keyItems = Array.from(document.querySelectorAll('.ka-key-takeaways-item, .ka-key-takeaways-list li, .ka-key-takeaways-box p, .ka-key-takeaways-box li, .ka-takeaway-item, .ka-hero-takeaways li, .ka-hero-takeaways p, .ka-takeaways-card li'));
        keyItems.forEach(function (el) {
          let txt = (el.textContent || '').trim();
          if (txt.length > 2) segments.push({ element: el, text: txt });
        });
        return segments;
      }

      let allElements = Array.from(articleBody.querySelectorAll('h1, h2, h3, h4, p, li, .ka-key-takeaways-item, .ka-key-takeaways-box p'));

      // Exclude reviewer cards, disabled read-aloud breakers (x_read=false), table of contents, sidebar, and product cards
      let excludedSelector = '[data-read-aloud="false"], [data-read-aloud="false"] *, .ka-author-reviewer-component, .ka-expert-card, .ka-expert-section-container, .vaidyam-why-trust-card[data-read-aloud="false"], .vaidyam-why-trust-card[data-read-aloud="false"] *, .ka-consult-breaker-card[data-read-aloud="false"], .ka-consult-breaker-card[data-read-aloud="false"] *, .ka-article-did-you-know[data-read-aloud="false"], .ka-article-infographic[data-read-aloud="false"], .ka-apothecary-card, .vaidyam-article-toc, #vaidyam-article-toc, .vaidyam-article-toc-card, .vaidyam-article-toc-header, .vaidyam-article-toc-content, .vaidyam-article-toc-list, .vaidyam-article-toc-item, #toc, .ka-toc-card, .ka-article-sidebar, .ka-blog-product-card, .ka-article-products, footer';

      allElements = allElements.filter(function (el) {
        if (el.closest(excludedSelector)) return false;
        if (el.closest('[data-read-aloud="false"], [data-read-aloud="False"]')) return false;
        let cCard = el.closest('.ka-consult-breaker-card, .ka-consultation-card, #ka-consult-breaker');
        if (cCard && (cCard.getAttribute('data-read-aloud') === 'false' || cCard.dataset.readAloud === 'false' || cCard.getAttribute('data-read-aloud') === 'False')) return false;
        let tCard = el.closest('.vaidyam-trust-breaker-card, #vaidyam-trust-breaker');
        if (tCard && (tCard.getAttribute('data-read-aloud') === 'false' || tCard.dataset.readAloud === 'false' || tCard.getAttribute('data-read-aloud') === 'False')) return false;
        let wCard = el.closest('.vaidyam-why-trust-card');
        if (wCard && (wCard.getAttribute('data-read-aloud') === 'false' || wCard.dataset.readAloud === 'false' || wCard.getAttribute('data-read-aloud') === 'False')) return false;
        let dykCard = el.closest('.ka-article-did-you-know');
        if (dykCard && (dykCard.getAttribute('data-read-aloud') === 'false' || dykCard.dataset.readAloud === 'false' || dykCard.getAttribute('data-read-aloud') === 'False')) return false;
        if (el.closest('.ka-product-recommendations, .ka-article-products, #products, .vaidyam-article-faqs, #faq, .vaidyam-article-sources, #sources, .vaidyam-article-comments, #comments, .vaidyam-related-articles-section, #related, .ka-expert-card, .ka-author-reviewer-component')) return false;
        return true;
      });

      if (mode === 'section' && startHeading) {
        let startIndex = allElements.indexOf(startHeading);
        if (startIndex !== -1) {
          allElements = allElements.slice(startIndex);
          let nextH2Index = -1;
          for (let i = 1; i < allElements.length; i++) {
            if (allElements[i].tagName.toLowerCase() === 'h2') {
              nextH2Index = i;
              break;
            }
          }
          if (nextH2Index !== -1) {
            allElements = allElements.slice(0, nextH2Index);
          }
        }
      }

      allElements.forEach(function (el) {
        let txt = (el.textContent || '').trim();
        let isNested = segments.some(function(s) { return s.element.contains(el); });
        if (txt.length > 2 && !isNested) {
          segments.push({ element: el, text: txt });
        }
      });

      return segments;
    }

    function prepareElementWords(item) {
      let el = item.element;
      if (!el || el.hasAttribute('data-original-html')) return;

      el.setAttribute('data-original-html', el.innerHTML);

      let wordCounter = 0;
      let words = [];

      function processNode(node) {
        if (node.nodeType === 3) {
          let textContent = node.nodeValue;
          if (!textContent || !textContent.trim()) return;

          let fragment = document.createDocumentFragment();
          let regex = /\S+/g;
          let match;
          let lastIdx = 0;

          while ((match = regex.exec(textContent)) !== null) {
            let matchText = match[0];
            let matchIndex = match.index;

            if (matchIndex > lastIdx) {
              fragment.appendChild(document.createTextNode(textContent.substring(lastIdx, matchIndex)));
            }

            let wordSpan = document.createElement('span');
            wordSpan.className = 'ka-read-word';
            wordSpan.setAttribute('data-word-idx', wordCounter);
            wordSpan.textContent = matchText;
            fragment.appendChild(wordSpan);

            words.push({
              word: matchText,
              globalIdx: wordCounter
            });

            wordCounter++;
            lastIdx = regex.lastIndex;
          }

          if (lastIdx < textContent.length) {
            fragment.appendChild(document.createTextNode(textContent.substring(lastIdx)));
          }

          if (node.parentNode) {
            node.parentNode.replaceChild(fragment, node);
          }
        } else if (node.nodeType === 1) {
          let children = Array.from(node.childNodes);
          children.forEach(function (child) {
            processNode(child);
          });
        }
      }

      processNode(el);

      // Build canonical text with exact 1-to-1 character ranges for speech utterance
      let canonicalText = "";
      for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (i === 0) {
          w.start = 0;
          w.end = w.word.length;
          canonicalText = w.word;
        } else {
          w.start = canonicalText.length + 1;
          w.end = w.start + w.word.length;
          canonicalText += " " + w.word;
        }
      }

      item.text = canonicalText;
      item.words = words;
      item.wordSpans = el.querySelectorAll('.ka-read-word');

      if (typeof window.initGlossaryTooltips === 'function') {
        try { window.initGlossaryTooltips(); } catch (e) {}
      }
    }

    function restoreAllElements() {
      document.querySelectorAll('[data-original-html]').forEach(function (el) {
        el.innerHTML = el.getAttribute('data-original-html');
        el.removeAttribute('data-original-html');
      });
      document.querySelectorAll('.ka-reading-active, .ka-reading-read, .ka-reading-unread').forEach(function (el) {
        el.classList.remove('ka-reading-active', 'ka-reading-read', 'ka-reading-unread');
      });
      if (typeof window.initGlossaryTooltips === 'function') {
        try { window.initGlossaryTooltips(); } catch (e) {}
      }
    }

    function highlightActiveWord(item, charIndex) {
      if (!item || !item.words || !item.wordSpans || item.words.length === 0) return;

      let activeIdx = 0;
      for (let i = 0; i < item.words.length; i++) {
        let w = item.words[i];
        let nextStart = (i < item.words.length - 1) ? item.words[i + 1].start : Infinity;
        if (charIndex >= w.start && charIndex < nextStart) {
          activeIdx = i;
          break;
        } else if (charIndex < w.start) {
          activeIdx = Math.max(0, i - 1);
          break;
        }
      }

      if (activeIdx >= item.words.length) {
        activeIdx = item.words.length - 1;
      }

      pausedCharIndex = item.words[activeIdx].start;

      // Update current live elapsed time based on current word's global offset
      if (segmentWordOffsets && segmentWordOffsets[currentQueueIndex] !== undefined) {
        let currentGlobalWordIdx = segmentWordOffsets[currentQueueIndex] + activeIdx;
        liveElapsedSecondsAt1x = Math.max(0, currentGlobalWordIdx / 2.6);
        syncMobilePlayerUI();
      }

      for (let idx = 0; idx < item.wordSpans.length; idx++) {
        let span = item.wordSpans[idx];
        if (idx < activeIdx) {
          if (!span.classList.contains('ka-word-read')) {
            span.classList.remove('ka-word-active', 'ka-word-unread');
            span.classList.add('ka-word-read');
          }
        } else if (idx === activeIdx) {
          if (!span.classList.contains('ka-word-active')) {
            span.classList.remove('ka-word-read', 'ka-word-unread');
            span.classList.add('ka-word-active');
          }
        } else {
          if (!span.classList.contains('ka-word-unread')) {
            span.classList.remove('ka-word-read', 'ka-word-active');
            span.classList.add('ka-word-unread');
          }
        }
      }

      let activeSpan = item.wordSpans[activeIdx];
      let timeSinceUserScroll = Date.now() - userScrollTimestamp;
      if (activeSpan && timeSinceUserScroll > 5000) {
        let rect = activeSpan.getBoundingClientRect();
        if (rect.top < 140 || rect.bottom > window.innerHeight - 160) {
          activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    let userScrollTimestamp = 0;
    function registerUserScroll() {
      userScrollTimestamp = Date.now();
    }
    window.addEventListener('wheel', registerUserScroll, { passive: true });
    window.addEventListener('touchmove', registerUserScroll, { passive: true });
    window.addEventListener('keydown', function(e) {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Space'].includes(e.code)) {
        registerUserScroll();
      }
    }, { passive: true });

    let liveTimerInterval = null;
    let totalWordsCount = 0;
    let segmentWordOffsets = [];
    let liveElapsedSecondsAt1x = 0;

    function startBgKeepAlive() {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.metadata = new MediaMetadata({
            title: document.title || 'Journal Article Read Aloud',
            artist: 'Kerala Ayurveda',
            album: 'Audio Journal'
          });
        } catch(e) {}
      }
    }

    function stopBgKeepAlive() {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch(e) {}
      }
    }

    function startLiveTimer() {
      stopLiveTimer();
      startBgKeepAlive();
      liveTimerInterval = setInterval(function() {
        if (isPlaying && !isSpeechPaused && synth) {
          if (synth.speaking && synth.paused) {
            synth.resume();
          }
          liveElapsedSecondsAt1x += 0.25;
          syncMobilePlayerUI();
        }
      }, 250);
    }

    function stopLiveTimer() {
      if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
      }
      stopBgKeepAlive();
    }

    function formatTime(seconds) {
      let mins = Math.floor(seconds / 60);
      let secs = Math.floor(seconds % 60);
      return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    let isMpScrubbing = false;
    function renderMpScrubber(pct, isDragging) {
      let container = document.getElementById('ka-mp-bar-container');
      let svg = document.getElementById('ka-mp-bar-svg');
      let svgTrack = document.getElementById('ka-mp-svg-track');
      let svgFill = document.getElementById('ka-mp-svg-fill');
      let thumbDot = document.getElementById('ka-mp-thumb-dot');

      if (!container || !svg || !svgTrack || !svgFill || !thumbDot) return;

      let W = container.clientWidth || container.offsetWidth || 200;
      svg.setAttribute('viewBox', '0 0 ' + W.toFixed(1) + ' 24');

      let Y_base = 12;

      let clampPct = Math.min(100, Math.max(0, pct));
      let X = (clampPct / 100) * W;

      if (isDragging) {
        container.classList.add('is-dragging');
        let Y_knob = 4;
        let R = Math.min(55, Math.max(25, W * 0.28));

        let leftFactor = Math.min(1, Math.max(0, X / R));
        let rightFactor = Math.min(1, Math.max(0, (W - X) / R));

        let startY = Y_knob + (Y_base - Y_knob) * leftFactor;
        let endY = Y_knob + (Y_base - Y_knob) * rightFactor;

        var X_start = Math.max(0, X - R);
        var X_end = Math.min(W, X + R);

        var fillD = "M 0," + startY.toFixed(1);
        if (X > 0) {
          if (X_start > 0) {
            fillD += " L " + X_start.toFixed(1) + "," + Y_base;
            fillD += " C " + (X_start + (X - X_start) * 0.5).toFixed(1) + "," + Y_base + " " +
                            (X_start + (X - X_start) * 0.65).toFixed(1) + "," + Y_knob + " " +
                            X.toFixed(1) + "," + Y_knob;
          } else {
            fillD += " C " + (X * 0.5).toFixed(1) + "," + startY.toFixed(1) + " " +
                            (X * 0.75).toFixed(1) + "," + Y_knob + " " +
                            X.toFixed(1) + "," + Y_knob;
          }
        }

        var trackD = "M 0," + startY.toFixed(1);
        if (X_start > 0) {
          trackD += " L " + X_start.toFixed(1) + "," + Y_base;
          trackD += " C " + (X_start + (X - X_start) * 0.5).toFixed(1) + "," + Y_base + " " +
                            (X_start + (X - X_start) * 0.65).toFixed(1) + "," + Y_knob + " " +
                            X.toFixed(1) + "," + Y_knob;
        } else if (X > 0) {
          trackD += " C " + (X * 0.5).toFixed(1) + "," + startY.toFixed(1) + " " +
                            (X * 0.75).toFixed(1) + "," + Y_knob + " " +
                            X.toFixed(1) + "," + Y_knob;
        }

        if (X_end < W) {
          trackD += " C " + (X + (X_end - X) * 0.35).toFixed(1) + "," + Y_knob + " " +
                            (X + (X_end - X) * 0.5).toFixed(1) + "," + Y_base + " " +
                            X_end.toFixed(1) + "," + Y_base;
          trackD += " L " + W.toFixed(1) + "," + Y_base;
        } else {
          var distRight = W - X;
          if (distRight > 0) {
            trackD += " C " + (X + distRight * 0.35).toFixed(1) + "," + Y_knob + " " +
                              (X + distRight * 0.5).toFixed(1) + "," + endY.toFixed(1) + " " +
                              W.toFixed(1) + "," + endY.toFixed(1);
          }
        }

        svgTrack.setAttribute('d', trackD);
        svgFill.setAttribute('d', fillD);
        thumbDot.style.left = X.toFixed(1) + 'px';
        thumbDot.style.top = Y_knob + 'px';
      } else {
        container.classList.remove('is-dragging');
        var straightTrack = "M 0," + Y_base + " L " + W.toFixed(1) + "," + Y_base;
        var straightFill = "M 0," + Y_base + " L " + X.toFixed(1) + "," + Y_base;

        svgTrack.setAttribute('d', straightTrack);
        svgFill.setAttribute('d', straightFill);
        thumbDot.style.left = X.toFixed(1) + 'px';
        thumbDot.style.top = Y_base + 'px';
      }
    }

    function syncMobilePlayerUI() {
      let speedMultiplier = currentSpeed || 1.0;
      let estTotalSecs = Math.max(1, Math.round((totalWordsCount / 2.6) / speedMultiplier));
      let estCurrentSecs = Math.min(estTotalSecs, Math.max(0, Math.round(liveElapsedSecondsAt1x / speedMultiplier)));
      let estRemainingSecs = Math.max(0, estTotalSecs - estCurrentSecs);

      let pct = Math.min(100, Math.max(0, (estCurrentSecs / estTotalSecs) * 100));

      if (mpRange && !isMpScrubbing) mpRange.value = pct;
      if (!isMpScrubbing) {
        renderMpScrubber(pct, false);
      }
      if (mpWaveActiveSvg) mpWaveActiveSvg.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';

      if (mpTimeCurrent) mpTimeCurrent.textContent = formatTime(estCurrentSecs);
      if (mpTimeTotal) {
        if (isShowingTotalTimeMode) {
          mpTimeTotal.textContent = formatTime(estTotalSecs);
        } else {
          mpTimeTotal.textContent = '-' + formatTime(estRemainingSecs);
        }
      }

      let deskTimeDisplay = document.getElementById('ka-desk-time');
      if (deskTimeDisplay) deskTimeDisplay.textContent = formatTime(estCurrentSecs) + ' / ' + formatTime(estTotalSecs);

      let speedText = (currentSpeed || 1.0) + 'x';
      if (speedBtn) speedBtn.textContent = speedText;
      let mpSpeedBtn = document.getElementById('ka-mp-speed-btn');
      if (mpSpeedBtn) mpSpeedBtn.textContent = speedText;

      let isPausedState = !isPlaying || isSpeechPaused;
      [playBtn, mpPlayBtn].forEach(function(btn) {
        if (!btn) return;
        btn.classList.toggle('is-paused', isPausedState);
      });
    }

    function updatePlayerVisibility() {
      if (!isPlaying) return;
      let activePlayer = player || document.getElementById('vaidyam-read-aloud-player');
      let activeMobileCard = mobileCard || document.getElementById('ka-mobile-player-card');
      let isMobile = window.innerWidth < 990;

      if (isMobile) {
        if (activeMobileCard) {
          activeMobileCard.classList.add('is-active');
          activeMobileCard.style.display = 'flex';
        }
        if (activePlayer) {
          activePlayer.classList.remove('is-active');
          activePlayer.style.display = 'none';
        }
      } else {
        if (activePlayer) {
          activePlayer.classList.add('is-active', 'is-entering');
          activePlayer.style.display = 'flex';
          setTimeout(function() {
            if (activePlayer) activePlayer.classList.remove('is-entering');
          }, 550);
        }
        if (activeMobileCard) {
          activeMobileCard.classList.remove('is-active');
          activeMobileCard.style.display = 'none';
        }
      }
    }

    window.addEventListener('resize', updatePlayerVisibility);

    function startReadAloud(mode, startHeading) {
      if (synth) {
        try {
          synth.cancel();
          if (synth.paused) synth.resume();
        } catch(e) {}
      }

      speakQueue = getSegments(mode, startHeading);
      if (!speakQueue || speakQueue.length === 0) {
        speakQueue = getSegments('entire', null);
      }
      if (!speakQueue || speakQueue.length === 0) {
        return;
      }

      totalWordsCount = 0;
      segmentWordOffsets = [];
      speakQueue.forEach(function (item) {
        prepareElementWords(item);
        segmentWordOffsets.push(totalWordsCount);
        let wordCount = (item.words && item.words.length) ? item.words.length : Math.ceil((item.text || '').length / 5);
        totalWordsCount += wordCount;
      });

      if (progressSlider) {
        progressSlider.max = Math.max(1, speakQueue.length - 1);
        progressSlider.value = 0;
      }

      currentQueueIndex = 0;
      liveElapsedSecondsAt1x = 0;
      isPlaying = true;
      isSpeechPaused = false;

      document.body.classList.add('vaidyam-read-aloud-active');
      updatePlayerVisibility();
      checkTriggerVisibility();
      syncMobilePlayerUI();
      startLiveTimer();
      setTimeout(function () {
        playNextSegment();
      }, 60);
    }

    function getIndianFemaleVoice() {
      if (!synth) return null;
      let voices = synth.getVoices();
      if (!voices || voices.length === 0) return null;

      let femaleKeywords = [
        'google', 'natural', 'neural', 'enhanced', 'premium', 'online', 'siri', 'wavenet',
        'female', 'woman', 'girl', 'samantha', 'karen', 'tessa', 'veena', 'neerja',
        'heera', 'sangeeta', 'isha', 'priya', 'victoria', 'moira', 'fiona', 'hazel',
        'zira', 'ava', 'aria', 'jenny', 'serena', 'allison', 'stephanie', 'zoe'
      ];
      let roboticKeywords = ['compact', 'espeak', 'desktop', 'speech-dispatcher', 'building block'];
      let premiumKeywords = ['google', 'natural', 'neural', 'online', 'enhanced', 'premium', 'siri', 'wavenet'];

      let enVoices = voices.filter(function (v) {
        var lang = (v.lang || '').toLowerCase();
        return lang.startsWith('en') || lang.replace('-', '_') === 'en_in';
      });

      if (enVoices.length === 0) enVoices = voices;

      function getVoiceScore(v) {
        let name = (v.name || '').toLowerCase();
        let lang = (v.lang || '').toLowerCase();
        let score = 0;

        if (roboticKeywords.some(function (rk) { return name.includes(rk); })) {
          score -= 200;
        }

        if (premiumKeywords.some(function (pk) { return name.includes(pk); })) {
          score += 150;
        }

        if (v.localService === false) {
          score += 80;
        }

        if (lang.includes('in') || name.includes('india') || name.includes('veena') || name.includes('neerja')) {
          score += 100;
        }

        if (femaleKeywords.some(function (fk) { return name.includes(fk); })) {
          score += 60;
        }

        return score;
      }

      let sortedVoices = enVoices.slice().sort(function (a, b) {
        return getVoiceScore(b) - getVoiceScore(a);
      });

      return sortedVoices[0] || voices[0];
    }

    function getEngineRate(speedVal) {
      if (speedVal === 1.0) return 0.95;
      if (speedVal === 1.25) return 1.18;
      if (speedVal === 1.5) return 1.40;
      if (speedVal === 2.0) return 1.80;
      if (speedVal === 2.5) return 2.25;
      return speedVal;
    }

    function playNextSegment(isResume) {
      if (!isPlaying) return;
      if (currentQueueIndex >= speakQueue.length) {
        stopReadAloud();
        if (statusText) statusText.textContent = 'Finished';
        return;
      }

      clearInterval(fallbackInterval);
      hasReceivedOnBoundary = false;
      let currentItem = speakQueue[currentQueueIndex];

      if (!isResume && segmentWordOffsets && segmentWordOffsets[currentQueueIndex] !== undefined) {
        let segSecs = segmentWordOffsets[currentQueueIndex] / 2.6;
        if (segSecs > liveElapsedSecondsAt1x) {
          liveElapsedSecondsAt1x = segSecs;
        }
      }

      if (progressSlider) progressSlider.value = currentQueueIndex;
      syncMobilePlayerUI();

      speakQueue.forEach(function (item, idx) {
        if (!item.element) return;
        if (idx < currentQueueIndex) {
          item.element.classList.remove('ka-reading-active', 'ka-reading-unread');
          item.element.classList.add('ka-reading-read');
        } else if (idx === currentQueueIndex) {
          item.element.classList.remove('ka-reading-read', 'ka-reading-unread');
          item.element.classList.add('ka-reading-active');
        } else {
          item.element.classList.remove('ka-reading-read', 'ka-reading-active');
          item.element.classList.add('ka-reading-unread');
        }
      });

      if (!isResume) {
        pausedCharIndex = 0;
        if (currentItem.wordSpans) {
          currentItem.wordSpans.forEach(function (span) {
            span.classList.remove('ka-word-active', 'ka-word-read');
            span.classList.add('ka-word-unread');
          });
        }
        let timeSinceUserScroll = Date.now() - userScrollTimestamp;
        if (currentItem.element && timeSinceUserScroll > 5000) {
          currentItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        highlightActiveWord(currentItem, pausedCharIndex);
      }

      if (statusText) statusText.textContent = 'Listening...';
      if (statusDot) statusDot.classList.add('is-reading');

      let textToSpeak = currentItem.text;
      let resumeOffset = 0;
      if (isResume && pausedCharIndex > 0 && currentItem.words && currentItem.words.length > 0) {
        let startWordIdx = 0;
        for (let i = 0; i < currentItem.words.length; i++) {
          if (currentItem.words[i].end >= pausedCharIndex) {
            startWordIdx = i;
            break;
          }
        }
        let wordStartChar = currentItem.words[startWordIdx] ? currentItem.words[startWordIdx].start : pausedCharIndex;
        textToSpeak = currentItem.canonicalText ? currentItem.canonicalText.substring(wordStartChar) : currentItem.text.substring(wordStartChar);
        resumeOffset = wordStartChar;
      }

      currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
      currentUtterance.voice = getIndianFemaleVoice();
      currentUtterance.rate = getEngineRate(currentSpeed);
      currentUtterance.pitch = 1.06;
      if (typeof currentVolume === 'number') {
        currentUtterance.volume = currentVolume;
      }

      currentUtterance.onboundary = function (event) {
        if (event.name === 'word') {
          hasReceivedOnBoundary = true;
          let trueCharIndex = event.charIndex + resumeOffset;
          pausedCharIndex = trueCharIndex;
          highlightActiveWord(currentItem, trueCharIndex);
        }
      };

      currentUtterance.onend = function () {
        clearInterval(fallbackInterval);
        if (!isPlaying || isSpeechPaused || isChangingSpeed || isSeeking) return;

        if (currentQueueIndex < speakQueue.length - 1) {
          currentQueueIndex++;
          pausedCharIndex = 0;
          playNextSegment();
        } else {
          stopReadAloud();
        }
      };

      currentUtterance.onerror = function () {
        clearInterval(fallbackInterval);
        if (!isPlaying || isSpeechPaused || isChangingSpeed || isSeeking) return;

        if (currentQueueIndex < speakQueue.length - 1) {
          currentQueueIndex++;
          pausedCharIndex = 0;
          playNextSegment();
        } else {
          stopReadAloud();
        }
      };

      hasReceivedOnBoundary = false;

      let fallbackTimePerChar = (78 / getEngineRate(currentSpeed));
      let simulatedCharIndex = resumeOffset;
      clearInterval(fallbackInterval);
      fallbackInterval = setInterval(function () {
        if (!hasReceivedOnBoundary && synth && synth.speaking && !isSpeechPaused) {
          simulatedCharIndex += 6;
          if (simulatedCharIndex <= currentItem.text.length) {
            highlightActiveWord(currentItem, simulatedCharIndex);
          }
        }
      }, fallbackTimePerChar * 6);

      let estMs = Math.ceil((textToSpeak.length * 85) / (currentSpeed || 1.0)) + 3500;
      clearTimeout(endTimeout);
      endTimeout = setTimeout(function () {
        if (isPlaying && synth && !synth.speaking && !isSpeechPaused && !isSeeking) {
          if (currentQueueIndex < speakQueue.length - 1) {
            currentQueueIndex++;
            playNextSegment();
          } else {
            stopReadAloud();
          }
        }
      }, estMs);

      if (synth) {
        try {
          if (synth.paused) synth.resume();
        } catch(e) {}
      }
      window.__currentKaUtterance = currentUtterance;
      synth.speak(currentUtterance);
    }

    function togglePlayPause() {
      if (!isPlaying) return;

      if (!isSpeechPaused) {
        isSpeechPaused = true;
        stopLiveTimer();
        clearTimeout(endTimeout);
        clearInterval(fallbackInterval);
        if (currentUtterance) {
          currentUtterance.onend = null;
          currentUtterance.onerror = null;
          currentUtterance.onboundary = null;
        }
        if (synth) {
          try {
            synth.cancel();
          } catch(e) {}
        }

        if (statusDot) statusDot.classList.remove('is-reading');
        if (statusText) statusText.textContent = 'Paused';
        syncMobilePlayerUI();
      } else {
        isSpeechPaused = false;
        startLiveTimer();
        setTimeout(function () {
          let currentItem = speakQueue[currentQueueIndex];
          if (currentItem) {
            playNextSegment(true);
          }
        }, 50);
      }
    }

    function stopReadAloud() {
      isPlaying = false;
      isSpeechPaused = false;
      stopLiveTimer();
      clearTimeout(pauseTimer);
      liveElapsedSecondsAt1x = 0;
      clearTimeout(endTimeout);
      clearInterval(fallbackInterval);
      if (currentUtterance) {
        currentUtterance.onend = null;
        currentUtterance.onerror = null;
        currentUtterance.onboundary = null;
      }
      if (synth) {
        try { synth.cancel(); } catch (e) {}
      }
      isPlaying = false;
      isSpeechPaused = false;
      currentUtterance = null;
      clearTimeout(endTimeout);
      clearTimeout(seekTimeout);
      clearInterval(fallbackInterval);
      clearInterval(liveTimerInterval);
      stopBgKeepAlive();

      restoreAllElements();
      document.body.classList.remove('vaidyam-read-aloud-active');

      let activePlayer = player || document.getElementById('vaidyam-read-aloud-player');
      let activeMobileCard = mobileCard || document.getElementById('ka-mobile-player-card');

      if (activePlayer) {
        activePlayer.classList.remove('is-active');
        activePlayer.style.display = 'none';
      }
      if (activeMobileCard) {
        activeMobileCard.classList.remove('is-active');
        activeMobileCard.style.display = 'none';
      }
      if (statusDot) statusDot.classList.remove('is-reading');
      
      checkTriggerVisibility();
      syncMobilePlayerUI();
    }
    window.stopKaReadAloud = stopReadAloud;

    function skipSeconds(seconds) {
      if (!speakQueue || speakQueue.length === 0) return;

      let speedMultiplier = currentSpeed || 1.0;
      let totalSecsAt1x = Math.max(1, Math.round((totalWordsCount || 300) / 2.6));
      let currentSecsAt1x = liveElapsedSecondsAt1x;
      let targetSecsAt1x = Math.max(0, Math.min(totalSecsAt1x, currentSecsAt1x + (seconds * speedMultiplier)));

      let targetGlobalWord = Math.round(targetSecsAt1x * 2.6);

      let targetQIdx = 0;
      let targetWordIdx = 0;

      for (let i = 0; i < speakQueue.length; i++) {
        let segStart = segmentWordOffsets[i] || 0;
        let segWords = (speakQueue[i].words ? speakQueue[i].words.length : 1);
        let segEnd = segStart + segWords;

        if (targetGlobalWord >= segStart && targetGlobalWord <= segEnd) {
          targetQIdx = i;
          targetWordIdx = Math.min(segWords - 1, Math.max(0, targetGlobalWord - segStart));
          break;
        } else if (targetGlobalWord < segStart) {
          targetQIdx = Math.max(0, i - 1);
          targetWordIdx = 0;
          break;
        }
      }

      triggerSeek(targetQIdx, targetWordIdx, targetSecsAt1x);
    }

    function animateBlackHoleClose(onComplete) {
      isPlaying = false;
      isSpeechPaused = false;
      stopLiveTimer();
      clearTimeout(endTimeout);
      clearInterval(fallbackInterval);
      if (currentUtterance) {
        currentUtterance.onend = null;
        currentUtterance.onerror = null;
        currentUtterance.onboundary = null;
      }
      if (synth) {
        try {
          synth.cancel();
        } catch(e) {}
      }

      let activeMobileCard = mobileCard || document.getElementById('ka-mobile-player-card');
      let activePlayer = player || document.getElementById('vaidyam-read-aloud-player');

      let targetCard = null;
      if (activeMobileCard && activeMobileCard.classList.contains('is-active')) {
        targetCard = activeMobileCard;
      } else if (activePlayer && activePlayer.classList.contains('is-active')) {
        targetCard = activePlayer;
      }

      if (targetCard) {
        targetCard.classList.add('is-being-swallowed');
      }

      setTimeout(function() {
        if (targetCard) {
          targetCard.classList.remove('is-being-swallowed', 'is-active');
        }
        if (activeMobileCard) activeMobileCard.classList.remove('is-active');
        if (activePlayer) activePlayer.classList.remove('is-active');
        if (onComplete) onComplete();
        stopReadAloud();
        checkTriggerVisibility();
      }, 300);
    }

    if (playBtn) playBtn.addEventListener('click', togglePlayPause);
    if (mpPlayBtn) mpPlayBtn.addEventListener('click', togglePlayPause);

    // Document-level delegated handler for Stop & Close buttons
    document.addEventListener('click', function(e) {
      let closeTarget = e.target.closest('#ka-mp-stop, .ka-mp-inline-close-btn, .vaidyam-read-aloud-stop-btn');
      if (closeTarget) {
        e.preventDefault();
        e.stopPropagation();
        stopReadAloud();
      }

      let modalCloseTarget = e.target.closest('.vaidyam-read-aloud-modal-close, .vaidyam-read-aloud-modal-overlay');
      if (modalCloseTarget) {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    });

    function triggerSeek(newQueueIndex, newWordIndex, targetSecsAt1x) {
      isSeeking = true;
      userScrollTimestamp = 0;
      clearTimeout(pauseTimer);
      clearTimeout(endTimeout);
      clearInterval(fallbackInterval);
      if (currentUtterance) {
        currentUtterance.onend = null;
        currentUtterance.onerror = null;
        currentUtterance.onboundary = null;
      }
      if (synth) {
        try {
          synth.cancel();
          if (synth.paused) synth.resume();
        } catch(e) {}
      }

      currentQueueIndex = Math.min(speakQueue.length - 1, Math.max(0, newQueueIndex));
      let seg = speakQueue[currentQueueIndex];
      let charIdx = 0;
      if (seg && seg.words && seg.words[newWordIndex]) {
        charIdx = seg.words[newWordIndex].start;
      }
      pausedCharIndex = charIdx;
      isSpeechPaused = false;
      liveElapsedSecondsAt1x = targetSecsAt1x !== undefined ? targetSecsAt1x : (segmentWordOffsets[currentQueueIndex] || 0) / 2.6;

      syncMobilePlayerUI();
      setTimeout(function() {
        isSeeking = false;
        playNextSegment(true);
      }, 100);
    }

    if (rewindBtn) {
      rewindBtn.addEventListener('click', function(e) {
        e.preventDefault();
        skipSeconds(-15);
      });
    }

    if (mpRewindBtn) {
      mpRewindBtn.addEventListener('click', function(e) {
        e.preventDefault();
        skipSeconds(-15);
      });
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', function(e) {
        e.preventDefault();
        skipSeconds(15);
      });
    }

    if (mpForwardBtn) {
      mpForwardBtn.addEventListener('click', function(e) {
        e.preventDefault();
        skipSeconds(15);
      });
    }

    function applySpeedChange(speedVal) {
      currentSpeed = speedVal;
      let speedText = speedVal + 'x';
      if (speedBtn) speedBtn.textContent = speedText;
      let mpSpeedBtn = document.getElementById('ka-mp-speed-btn');
      if (mpSpeedBtn) mpSpeedBtn.textContent = speedText;
      if (speedDropdown) speedDropdown.classList.remove('is-open');

      syncMobilePlayerUI();

      if (isPlaying && !isSpeechPaused) {
        clearTimeout(endTimeout);
        clearInterval(fallbackInterval);
        if (currentUtterance) {
          currentUtterance.onend = null;
          currentUtterance.onerror = null;
          currentUtterance.onboundary = null;
        }
        if (synth) {
          try {
            synth.cancel();
            if (synth.paused) synth.resume();
          } catch(e) {}
        }
        setTimeout(function () {
          playNextSegment(true);
        }, 100);
      }
    }

    let mpSpeedBtn = document.getElementById('ka-mp-speed-btn');
    if (mpSpeedBtn) {
      mpSpeedBtn.addEventListener('click', function(e) {
        e.preventDefault();
        let speeds = [1.0, 1.25, 1.5];
        let currIdx = speeds.indexOf(currentSpeed);
        let nextIdx = (currIdx === -1) ? 1 : (currIdx + 1) % speeds.length;
        applySpeedChange(speeds[nextIdx]);
      });
    }

    if (speedBtn && speedDropdown) {
      speedBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        speedDropdown.classList.toggle('is-open');
      });

      document.addEventListener('click', function (e) {
        if (!e.target.closest('.vaidyam-read-aloud-speed-wrap')) {
          speedDropdown.classList.remove('is-open');
        }
      });

      speedDropdown.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          let speedVal = parseFloat(btn.getAttribute('data-speed'));
          applySpeedChange(speedVal);
        });
      });
    }

    function toggleMute() {
      let isCurrentlyMuted = (currentVolume === 0);
      currentVolume = isCurrentlyMuted ? 1.0 : 0.0;

      let volButtons = document.querySelectorAll('#ka-desk-vol-toggle, #ka-mp-mute, .ka-mp-mute-btn, .vaidyam-read-aloud-vol-trigger, #ka-mp-vol-high, #ka-mp-vol-mute');
      volButtons.forEach(function(btn) {
        btn.classList.toggle('is-muted', currentVolume === 0);
      });

      if (currentUtterance) {
        currentUtterance.volume = currentVolume;
      }

      // Web Speech API in-flight utterances ignore volume changes until restarted;
      // seamlessly restart playback immediately at the active word with new volume
      if (isPlaying && !isSpeechPaused) {
        clearTimeout(endTimeout);
        clearInterval(fallbackInterval);
        if (currentUtterance) {
          currentUtterance.onend = null;
          currentUtterance.onerror = null;
          currentUtterance.onboundary = null;
        }
        if (synth) {
          try {
            synth.cancel();
            if (synth.paused) synth.resume();
          } catch(e) {}
        }
        setTimeout(function () {
          playNextSegment(true);
        }, 10);
      }
    }

    if (mpTimeTotal) {
      mpTimeTotal.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        isShowingTotalTimeMode = !isShowingTotalTimeMode;
        syncMobilePlayerUI();
      });
    }

    document.addEventListener('click', function (e) {
      let muteTarget = e.target.closest('#ka-desk-vol-toggle, #ka-mp-mute, #ka-mp-vol-high, #ka-mp-vol-mute, #ka-mp-vol-down, .ka-mp-mute-btn, .vaidyam-read-aloud-vol-trigger, .ka-mp-volume-wrap');
      if (muteTarget) {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
      }
    });

    setInterval(function() {
      if (isPlaying && !isSpeechPaused && synth && synth.speaking) {
        synth.resume();
      }
    }, 4000);

    if (mpExpandBtn && mpExpandedContent) {
      mpExpandBtn.addEventListener('click', function(e) {
        e.preventDefault();
        let isOpen = mpExpandedContent.classList.toggle('is-open');
        mpExpandBtn.classList.toggle('is-expanded', isOpen);
      });
    }

    if (mpRange) {
      function handleDragStart() {
        isMpScrubbing = true;
        renderMpScrubber(parseFloat(mpRange.value), true);
      }

      function handleDragEnd() {
        if (isMpScrubbing) {
          isMpScrubbing = false;
          renderMpScrubber(parseFloat(mpRange.value), false);
        }
      }

      mpRange.addEventListener('pointerdown', handleDragStart);
      mpRange.addEventListener('touchstart', handleDragStart, { passive: true });
      mpRange.addEventListener('mousedown', handleDragStart);

      window.addEventListener('pointerup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('touchcancel', handleDragEnd);
      window.addEventListener('mouseup', handleDragEnd);
      mpRange.addEventListener('change', handleDragEnd);

      mpRange.addEventListener('input', function() {
        let val = parseFloat(mpRange.value);
        isMpScrubbing = true;
        renderMpScrubber(val, true);

        if (!isPlaying || !speakQueue || speakQueue.length === 0) return;
        clearTimeout(seekTimeout);
        let targetIdx = Math.min(speakQueue.length - 1, Math.max(0, Math.round((val / 100) * (speakQueue.length - 1))));
        isSeeking = true;
        currentQueueIndex = targetIdx;
        pausedCharIndex = 0;
        isSpeechPaused = false;

        let totalSecsAt1x = Math.max(1, Math.round((totalWordsCount || 300) / 2.6));
        if (val >= 99.0) {
          liveElapsedSecondsAt1x = totalSecsAt1x;
        } else {
          liveElapsedSecondsAt1x = totalSecsAt1x * (val / 100);
        }

        let speedMultiplier = currentSpeed || 1.0;
        let estTotalSecs = Math.max(1, Math.round(totalSecsAt1x / speedMultiplier));
        let estCurrentSecs = Math.min(estTotalSecs, Math.round(liveElapsedSecondsAt1x / speedMultiplier));
        let estRemainingSecs = Math.max(0, estTotalSecs - estCurrentSecs);

        if (mpTimeCurrent) mpTimeCurrent.textContent = formatTime(estCurrentSecs);
        if (mpTimeTotal) {
          if (isShowingTotalTimeMode) {
            mpTimeTotal.textContent = formatTime(estTotalSecs);
          } else {
            mpTimeTotal.textContent = '-' + formatTime(estRemainingSecs);
          }
        }

        clearTimeout(endTimeout);
        clearInterval(fallbackInterval);
        if (synth) synth.cancel();
        seekTimeout = setTimeout(function() {
          isSeeking = false;
          if (val >= 99.5) {
            stopReadAloud();
            if (statusText) statusText.textContent = 'Finished';
            if (mpTimeCurrent) mpTimeCurrent.textContent = formatTime(estTotalSecs);
            if (mpTimeTotal) mpTimeTotal.textContent = '-0:00';
            if (mpRange) mpRange.value = 100;
            renderMpScrubber(100, false);
            return;
          }
          playNextSegment();
        }, 150);
      });
    }

    document.addEventListener('mouseup', function (e) {
      if (!isPlaying) return;
      let target = e.target.closest('p, h2, h3, h4, li, .ka-key-takeaways-item');
      if (!target) return;

      let queueIdx = -1;
      for (let i = 0; i < speakQueue.length; i++) {
        if (speakQueue[i].element === target) {
          queueIdx = i;
          break;
        }
      }

      if (queueIdx !== -1) {
        let wordSpan = e.target.closest('.ka-read-word');
        if (!wordSpan && window.getSelection) {
          let sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let rangeNode = sel.getRangeAt(0).startContainer;
            if (rangeNode) {
              wordSpan = rangeNode.nodeType === 3 ? (rangeNode.parentElement ? rangeNode.parentElement.closest('.ka-read-word') : null) : rangeNode.closest('.ka-read-word');
            }
          }
        }

        let wordIdx = 0;
        if (wordSpan && speakQueue[queueIdx].words) {
          let parsedIdx = parseInt(wordSpan.getAttribute('data-word-idx'));
          if (!isNaN(parsedIdx)) wordIdx = parsedIdx;
        } else if (speakQueue[queueIdx].words && window.getSelection) {
          let selText = (window.getSelection().toString() || '').trim().split(/\s+/)[0];
          if (selText && selText.length > 1) {
            for (let wIdx = 0; wIdx < speakQueue[queueIdx].words.length; wIdx++) {
              let wObj = speakQueue[queueIdx].words[wIdx];
              if (wObj.word.indexOf(selText) !== -1 || selText.indexOf(wObj.word) !== -1) {
                wordIdx = wIdx;
                break;
              }
            }
          }
        }

        clearTimeout(seekTimeout);
        isSeeking = true;
        currentQueueIndex = queueIdx;
        pausedCharIndex = (speakQueue[queueIdx].words && speakQueue[queueIdx].words[wordIdx]) ? speakQueue[queueIdx].words[wordIdx].start : 0;
        isSpeechPaused = false;
        clearTimeout(endTimeout);
        clearInterval(fallbackInterval);
        if (progressSlider) progressSlider.value = queueIdx;
        if (synth) synth.cancel();
        seekTimeout = setTimeout(function () {
          isSeeking = false;
          playNextSegment(true);
        }, 80);
      }
    });

    document.addEventListener('visibilitychange', function() {
      if (document.hidden && isPlaying) {
        isSpeechPaused = true;
        clearInterval(fallbackInterval);
        clearTimeout(endTimeout);
        if (synth) synth.cancel();
        if (statusText) statusText.textContent = 'Paused';
        if (statusDot) statusDot.classList.remove('is-reading');
        syncMobilePlayerUI();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKaReadAloudScript);
  } else {
    initKaReadAloudScript();
  }

  document.addEventListener('click', function(e) {
    let btn = e.target.closest('#vaidyam-read-aloud-trigger, .vaidyam-read-aloud-floating-btn, .vaidyam-read-aloud-btn, [data-action="read-aloud"]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.openKaReadAloudModal === 'function') {
        window.openKaReadAloudModal();
      } else {
        let modal = document.getElementById('vaidyam-read-aloud-modal');
        if (modal) {
          modal.classList.add('is-active');
        }
      }
    }

    let stopBtn = e.target.closest('.vaidyam-read-aloud-stop-btn, #ka-mp-stop, .ka-mp-inline-close-btn');
    if (stopBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.stopKaReadAloud === 'function') {
        window.stopKaReadAloud();
      } else {
        if ('speechSynthesis' in window) {
          try { window.speechSynthesis.cancel(); } catch(err) {}
        }
        let p = document.getElementById('vaidyam-read-aloud-player');
        let m = document.getElementById('ka-mobile-player-card');
        if (p) p.classList.remove('is-active');
        if (m) m.classList.remove('is-active');
        document.body.classList.remove('vaidyam-read-aloud-active');
      }
    }

    let modalCloseBtn = e.target.closest('.vaidyam-read-aloud-modal-close, .vaidyam-read-aloud-modal-overlay');
    if (modalCloseBtn) {
      e.preventDefault();
      e.stopPropagation();
      let modal = document.getElementById('vaidyam-read-aloud-modal');
      if (modal) modal.classList.remove('is-active');
    }
  });
})();
