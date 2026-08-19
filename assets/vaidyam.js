/**
 * ka-blog-redesign.js
 * Kerala Ayurveda Blog Redesign — Vanilla JS behaviors
 * Scoped to .ka-blog-wrapper containers
 *
 * Includes:
 *  1. Blog subnav smooth-scroll
 *  2. Article TOC — desktop active tracking + mobile accordion
 *  3. FAQ accordion (progressive enhancement on <details>)
 *  4. Read time calculation fallback
 */

(function () {
  'use strict';

  // Failsafe client-side routing for query param based care_path / topic triggers
  try {
    var searchParams = new URLSearchParams(window.location.search);
    var cpParam = searchParams.get('care_path');
    var tpParam = searchParams.get('topic');
    var isLandingDOM = document.querySelector('.ka-blog-wrapper--landing');
    if (isLandingDOM && (cpParam || tpParam)) {
      var activeParam = cpParam || tpParam;
      var curPath = window.location.pathname.replace(/\/+$/, '');
      if (!curPath.includes('/tagged/')) {
        window.location.replace(curPath + '/tagged/' + encodeURIComponent(activeParam) + window.location.search);
      }
    }
  } catch (e) {}

  var isTOCScrollLocked = false;

  // Custom high-performance premium scroll transition helper using requestAnimationFrame and easeOutQuart
  function smoothScrollTo(targetY, duration, isLinear) {
    let startY = window.pageYOffset || document.documentElement.scrollTop;
    let difference = targetY - startY;
    let startTime = null;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      let progress = (timestamp - startTime) / duration;
      if (progress > 1) progress = 1;

      let ease = isLinear ? progress : easeOutQuart(progress);
      window.scrollTo(0, startY + difference * ease);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  // ============================================================
  // 1. BLOG SUBNAV — Smooth scroll for anchor links
  // ============================================================
  function initSubnav() {
    let subnavContainers = document.querySelectorAll('.ka-blog-subnav, .ka-blog-breadcrumb-subnav');
    if (subnavContainers.length === 0) return;

    let links = [];
    subnavContainers.forEach(function (container) {
      container.querySelectorAll('a[href*="#"]').forEach(function (link) {
        links.push(link);
      });
    });

    let isScrollLocked = false;

    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        let hash = link.getAttribute('href');
        if (!hash) return;

        let hashIndex = hash.indexOf('#');
        if (hashIndex === -1) return;

        let targetId = hash.substring(hashIndex + 1);
        let target = document.getElementById(targetId);
        if (!target) return;

        e.preventDefault();

        isScrollLocked = true;

        let headerHeight = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height')
        ) || 60;

        let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
        let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;

        let targetPosition =
          target.getBoundingClientRect().top + window.pageYOffset;
        let offsetPosition = targetPosition - headerHeight - subnavHeight - 20;

        smoothScrollTo(offsetPosition, 350);

        let targetHref = link.getAttribute('href');
        links.forEach(function (l) {
          if (l.getAttribute('href') === targetHref) {
            l.classList.add('active');
          } else {
            l.classList.remove('active');
          }
        });

        setTimeout(function () {
          isScrollLocked = false;
        }, 1200);
      });
    });

    // Scroll-Spy tracking
    let sections = [];
    links.forEach(function (link) {
      let hash = link.getAttribute('href');
      if (!hash) return;
      let hashIndex = hash.indexOf('#');
      if (hashIndex === -1) return;
      let targetId = hash.substring(hashIndex + 1);
      let target = document.getElementById(targetId);
      if (target) {
        let existing = sections.find(function (s) { return s.target === target; });
        if (existing) {
          existing.links.push(link);
        } else {
          sections.push({
            links: [link],
            target: target
          });
        }
      }
    });

    function updateActiveLink() {
      if (isScrollLocked) return;

      let scrollPos = window.scrollY || window.pageYOffset;
      let headerHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--header-height')
      ) || 60;
      let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
      let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;
      let threshold = headerHeight + subnavHeight + 25;

      let activeSection = null;

      sections.forEach(function (section) {
        let rect = section.target.getBoundingClientRect();
        if (rect.top <= threshold) {
          activeSection = section;
        } else if (!activeSection) {
          activeSection = section;
        }
      });

      // Fallback for top of page
      if (scrollPos < 100 && sections.length > 0) {
        links.forEach(function (l) {
          if (l.getAttribute('href') === '#overview') {
            l.classList.add('active');
          } else {
            l.classList.remove('active');
          }
        });
        return;
      }

      if (activeSection) {
        links.forEach(function (l) {
          l.classList.remove('active');
        });
        activeSection.links.forEach(function (l) {
          l.classList.add('active');
        });
      }
    }

    let isNavTicking = false;
    function onNavScrollThrottled() {
      if (!isNavTicking) {
        requestAnimationFrame(function () {
          updateActiveLink();
          isNavTicking = false;
        });
        isNavTicking = true;
      }
    }

    window.addEventListener('scroll', onNavScrollThrottled, { passive: true });
    window.addEventListener('load', function () {
      setTimeout(updateActiveLink, 100);
    });
    updateActiveLink();
  }

  // ============================================================
  // 2. ARTICLE TOC — 100% Dynamic extraction from article content
  // ============================================================
  function initArticleTOC() {
    let articleContent = document.querySelector('.ka-article-content') || document.querySelector('.ka-article-body');
    if (!articleContent) return;

    // Convert paragraph-wrapped strong headings in rich text into genuine H2 elements
    let strongPs = articleContent.querySelectorAll('.ka-article-body p, .ka-article-content p, .prose p, p');
    strongPs.forEach(function (p) {
      if (p.closest('.vaidyam-article-card, .vaidyam-why-trust-card, .vaidyam-trust-breaker-card, .ka-consult-breaker-card, .ka-key-takeaways-wrapper, .ka-at-a-glance-card, .ka-article-products, .ka-author-reviewer-component, .ka-expert-card, .vaidyam-article-faqs, .vaidyam-article-sources, .vaidyam-article-disclaimer, .vaidyam-article-comments-card, .ka-article-did-you-know')) return;
      if (p.children.length === 1 && (p.firstElementChild.tagName === 'STRONG' || p.firstElementChild.tagName === 'B')) {
        let text = p.textContent.trim();
        if (text.length > 0 && text.length < 180 && !text.endsWith('.')) {
          let h2 = document.createElement('h2');
          h2.textContent = text;
          h2.id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          p.replaceWith(h2);
        }
      }
    });

    let sidebarToc = document.querySelector('.ka-article-sidebar');
    let mobileToc = document.querySelector('.vaidyam-article-toc-mobile');

    // Strictly query H2 content headings inside article body or main content sections
    let rawHeadings = articleContent.querySelectorAll('.ka-article-body h2, .ka-article-section h2');
    if (!rawHeadings || rawHeadings.length === 0) {
      rawHeadings = articleContent.querySelectorAll('h2');
    }

    let headings = Array.prototype.slice.call(rawHeadings).filter(function (heading) {
      if (!heading || heading.tagName !== 'H2') return false;

      // Exclude card internals, hero, modals, or ancillary headers
      if (heading.closest('.ka-ingredients-container') || 
          heading.closest('.ka-ingredient-card') ||
          heading.closest('.ka-author-reviewer-component') ||
          heading.closest('.ka-expert-card') ||
          heading.closest('.ka-expert-section-container') ||
          heading.closest('.ka-author-card') ||
          heading.closest('.vaidyam-why-trust-card') ||
          heading.closest('.vaidyam-trust-breaker') ||
          heading.closest('.ka-consult-breaker') ||
          heading.closest('.ka-consult-cta') ||
          heading.closest('.ka-consultation-card') ||
          heading.closest('.ka-apothecary-card') ||
          heading.closest('.ka-key-takeaways-wrapper') ||
          heading.closest('#at-a-glance') ||
          heading.closest('.vaidyam-article-at-a-glance') ||
          heading.closest('.ka-article-faq') ||
          heading.closest('#faq') ||
          heading.closest('.ka-article-products') ||
          heading.closest('#products') ||
          heading.closest('.ka-product-recommendations') ||
          heading.closest('.vaidyam-article-sources') ||
          heading.closest('#sources') ||
          heading.closest('.vaidyam-article-disclaimer') ||
          heading.closest('#disclaimer') ||
          heading.closest('.vaidyam-related-articles-section') ||
          heading.closest('.ka-comments-section') ||
          heading.closest('.ka-article-sidebar') ||
          heading.closest('.vaidyam-article-toc-mobile') ||
          heading.closest('.vaidyam-article-hero') ||
          heading.closest('footer') ||
          heading.classList.contains('vaidyam-article-toc-toggle')) {
        return false;
      }

      let text = heading.textContent.toLowerCase().trim();
      if (!text) return false;

      // Exclude known breaker or ancillary titles
      if (text.indexOf('try this today') > -1 || 
          text.indexOf('words to know') > -1 ||
          text.indexOf('legacy you can trust') > -1 ||
          text.indexOf('why trust') > -1 ||
          text.indexOf('did you know') > -1 ||
          text.indexOf('frequently asked') > -1 ||
          text.indexOf('reviewed by') > -1 ||
          text.indexOf('about the author') > -1 ||
          text.indexOf('key takeaways') > -1 ||
          text.indexOf('at a glance') > -1) {
        return false;
      }
      return true;
    });

    // Ensure all headings have clean, valid IDs
    let seenIds = {};
    headings.forEach(function (heading, index) {
      if (!heading.id) {
        let slug = heading.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        if (!slug) {
          slug = 'section-' + (index + 1);
        }
        let uniqueSlug = slug;
        let count = 1;
        while (seenIds[uniqueSlug] || document.getElementById(uniqueSlug)) {
          uniqueSlug = slug + '-' + count;
          count++;
        }
        heading.id = uniqueSlug;
        seenIds[uniqueSlug] = true;
      } else {
        seenIds[heading.id] = true;
      }
    });

    if (!headings.length) {
      if (sidebarToc) sidebarToc.classList.add('ka-hidden');
      if (mobileToc) mobileToc.classList.add('ka-hidden');
      let bar = document.getElementById('kaScrubberBar');
      if (bar) bar.classList.add('ka-hidden');
      let layoutContainer = document.querySelector('.ka-article-layout');
      if (layoutContainer) layoutContainer.classList.add('ka-article-layout--no-toc');
      return;
    } else {
      if (sidebarToc) sidebarToc.classList.remove('ka-hidden');
      if (mobileToc) mobileToc.classList.remove('ka-hidden');
      let bar = document.getElementById('kaScrubberBar');
      if (bar) bar.classList.remove('ka-hidden');
      let layoutContainer = document.querySelector('.ka-article-layout');
      if (layoutContainer) layoutContainer.classList.remove('ka-article-layout--no-toc');
    }

    isTOCScrollLocked = false;
    let tocLinks = [];
    let mobileTocLinks = [];

    // Build TOC list items
    function buildTocLinks(container, listSelector) {
      let list = container.querySelector(listSelector);
      if (!list) return;

      list.innerHTML = ''; // Fresh dynamic population

      headings.forEach(function (heading) {
        let text = heading.textContent.trim();
        if (!text) return;

        let capitalizedText = text.charAt(0).toUpperCase() + text.slice(1);
        try { heading.dataset.tocTitle = capitalizedText; } catch (e) {}

        let li = document.createElement('li');
        li.style.listStyle = 'none';
        li.style.listStyleType = 'none';
        li.style.padding = '0';
        li.style.margin = '0';
        let a = document.createElement('a');
        a.textContent = capitalizedText;
        a.href = '#' + heading.id;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          isTOCScrollLocked = true;

          let targetHref = '#' + heading.id;
          let allLinks = document.querySelectorAll('.ka-article-sidebar__list a, .vaidyam-article-toc-mobile__list a, .vaidyam-article-toc-card a');
          let allLis = document.querySelectorAll('.ka-article-sidebar__list li, .vaidyam-article-toc-mobile__list li, .vaidyam-article-toc-card li');
          allLinks.forEach(function(l) { l.classList.remove('active'); });
          allLis.forEach(function(liEl) { liEl.classList.remove('active'); });

          if (tocLinks && tocLinks.length) {
            tocLinks.forEach(function (link) {
              if (link.getAttribute('href') === targetHref) {
                link.classList.add('active');
                if (link.parentElement) link.parentElement.classList.add('active');
              }
            });
          }
          if (mobileTocLinks && mobileTocLinks.length) {
            mobileTocLinks.forEach(function (link) {
              if (link.getAttribute('href') === targetHref) {
                link.classList.add('active');
                if (link.parentElement) link.parentElement.classList.add('active');
              }
            });
          }

          scrollToHeading(heading);

          setTimeout(function () {
            isTOCScrollLocked = false;
          }, 800);

          if (mobileToc) {
            let toggle = mobileToc.querySelector('.vaidyam-article-toc-mobile__toggle');
            let content = mobileToc.querySelector('.vaidyam-article-toc-mobile__content');
            if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
              toggle.setAttribute('aria-expanded', 'false');
              if (content) content.classList.remove('is-open');
            }
          }
        });
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    if (sidebarToc) {
      buildTocLinks(sidebarToc, '.ka-article-sidebar__list');
      tocLinks = sidebarToc.querySelectorAll('a[href^="#"]');
    }

    if (mobileToc) {
      buildTocLinks(mobileToc, '.vaidyam-article-toc-mobile__list');
      mobileTocLinks = mobileToc.querySelectorAll('a[href^="#"]');

      let toggle = mobileToc.querySelector('.vaidyam-article-toc-mobile__toggle');
      let content = mobileToc.querySelector('.vaidyam-article-toc-mobile__content');
      if (toggle && content) {
        toggle.addEventListener('click', function () {
          let expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          if (!expanded) {
            mobileToc.classList.add('is-open');
            content.classList.add('is-open');
            scrollAccordionIntoView(mobileToc);
          } else {
            mobileToc.classList.remove('is-open');
            content.classList.remove('is-open');
          }
        });
      }
    }

    function scrollToHeading(heading) {
      let headerEl = document.querySelector('.theme-header-custom');
      let headerHeight = headerEl ? headerEl.offsetHeight : 0;
      let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
      let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 0;
      let extraGap = 20;

      let elementPosition = heading.getBoundingClientRect().top + window.pageYOffset;
      let offsetPosition = elementPosition - headerHeight - subnavHeight - extraGap;

      smoothScrollTo(Math.max(0, offsetPosition), 400);
      try {
        history.pushState(null, null, '#' + heading.id);
      } catch (e) {}
    }

    function updateActiveSectionOnScroll() {
      if (isTOCScrollLocked || headings.length === 0) return;

      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      let viewportMid = scrollTop + (window.innerHeight * 0.5);

      let scrubberSpans = document.querySelectorAll('#kaScrubberNumsTrack span');
      let activeIndex = -1;

      for (let i = 0; i < headings.length; i++) {
        let headingTop = headings[i].getBoundingClientRect().top + scrollTop;
        if (headingTop <= viewportMid) {
          activeIndex = i;
        } else {
          break;
        }
      }

      if (headings.length > 0) {
        let firstHeadingTop = headings[0].getBoundingClientRect().top + scrollTop;
        if (viewportMid < firstHeadingTop) {
          activeIndex = -1;
        }
      }

      let allLinks = document.querySelectorAll('.ka-article-sidebar__list a, .vaidyam-article-toc-mobile__list a, .vaidyam-article-toc-card a');
      let allLis = document.querySelectorAll('.ka-article-sidebar__list li, .vaidyam-article-toc-mobile__list li, .vaidyam-article-toc-card li');
      allLinks.forEach(function (l) { l.classList.remove('active'); });
      allLis.forEach(function (liEl) { liEl.classList.remove('active'); });

      for (let k = 0; k < headings.length; k++) {
        let targetHref = '#' + headings[k].id;
        let isActive = (k === activeIndex);

        if (scrubberSpans[k]) {
          scrubberSpans[k].classList.toggle('active', isActive);
        }

        if (isActive) {
          if (tocLinks && tocLinks.length) {
            tocLinks.forEach(function (l) {
              if (l.getAttribute('href') === targetHref) {
                l.classList.add('active');
                if (l.parentElement) l.parentElement.classList.add('active');
              }
            });
          }
          if (mobileTocLinks && mobileTocLinks.length) {
            mobileTocLinks.forEach(function (l) {
              if (l.getAttribute('href') === targetHref) {
                l.classList.add('active');
                if (l.parentElement) l.parentElement.classList.add('active');
              }
            });
          }
        }
      }

      if (typeof window.highlightNiagaraItem === 'function') {
        window.highlightNiagaraItem(activeIndex, 0);
      }
    }

    let isSectionTicking = false;
    function onSectionScrollThrottled() {
      if (!isSectionTicking) {
        requestAnimationFrame(function () {
          updateActiveSectionOnScroll();
          isSectionTicking = false;
        });
        isSectionTicking = true;
      }
    }

    window.addEventListener('scroll', onSectionScrollThrottled, { passive: true });
    updateActiveSectionOnScroll();

    initNiagaraScrubber(headings);
  }

  function initNiagaraScrubber(headings, manualEntries) {
    let bar = document.getElementById('kaScrubberBar');
    let track = document.getElementById('kaScrubberNumsTrack');
    let bubble = document.getElementById('kaScrubberBubble');
    let bubbleTitle = bubble ? bubble.querySelector('.bubble-title') : null;
    let bubbleNum = bubble ? bubble.querySelector('.bubble-num') : null;
    
    if (!bar || !track || !bubble) return;
    
    window.highlightNiagaraItem = function(idx, shift) {
      try { highlightItem(idx, shift); } catch(e) {}
    };
    
    track.innerHTML = '';
    
    headings.forEach(function (heading, index) {
      let idxNum = String(index + 1).padStart(2, '0');
      let barSpan = document.createElement('span');
      barSpan.textContent = idxNum;
      barSpan.setAttribute('data-index', index);
      barSpan.setAttribute('title', heading.textContent.trim());
      barSpan.style.setProperty('--i', index);
      barSpan.style.setProperty('--inv-i', headings.length - 1 - index);

      // Direct click on any segment bar scrolls smoothly to that heading
      barSpan.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollToHeading(heading);
      });

      track.appendChild(barSpan);
    });

    let barSpans = track.querySelectorAll('span');
    let totalItems = headings.length;
    let activeIdx = -1;
    let lastShiftX = -1;
    let abortPreviewFn = null;

    let hasInteractedWithScrubber = false;
    let alreadySeenDemo = false;
    try {
      alreadySeenDemo = (sessionStorage.getItem('ka_niagara_demo_shown') === 'true');
    } catch (e) {}
    // ── Create demo pill dynamically (styled via vaidyam-article.css) ──
    let demoPill = document.getElementById('kaScrubberDemoPill');
    if (!demoPill) {
      demoPill = document.createElement('div');
      demoPill.id = 'kaScrubberDemoPill';
      demoPill.setAttribute('role', 'button');
      demoPill.setAttribute('tabindex', '0');
      demoPill.setAttribute('aria-label', 'Try This navigation preview');
      demoPill.innerHTML = '<span class="ka-demo-pill-inner">Try This <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>';
      document.body.appendChild(demoPill);
    }

    let autoDismissTimer = null;
    let hasPillShown = false;
    let isDemoRunning = false;
    let isDragging = false;

    // Dynamic frosted glass backdrop overlay (styled via vaidyam-article.css)
    let demoOverlay = document.getElementById('kaScrubberDemoOverlay');
    if (!demoOverlay) {
      demoOverlay = document.createElement('div');
      demoOverlay.id = 'kaScrubberDemoOverlay';
      document.body.appendChild(demoOverlay);
    }

    function showScrubberDemoPill() {
      if (hasPillShown) return;
      if (window.innerWidth >= 990) return;
      hasPillShown = true;

      // Position capsule pill EXACTLY aligned with the 1st active green bar of the Niagara scrubber
      let targetSpan = track.querySelector('span.active') || track.querySelector('span.bullet-inserted') || (barSpans && barSpans[0]) || track.querySelector('span');
      if (targetSpan) {
        let spanRect = targetSpan.getBoundingClientRect();
        if (spanRect.top > 0) {
          demoPill.style.top = (spanRect.top + (spanRect.height / 2)) + 'px';
        } else {
          let trackRect = track.getBoundingClientRect();
          demoPill.style.top = (trackRect.top + 10) + 'px';
        }
      }

      // Reveal pill via CSS class
      demoPill.classList.remove('fade-out');
      demoPill.classList.add('is-visible');

      // Auto-dismiss after 4.5 seconds if user doesn't click
      autoDismissTimer = setTimeout(function() {
        if (!isDemoRunning) dismissPill();
      }, 4500);
    }

    function dismissPill() {
      demoPill.classList.remove('is-visible');
      demoPill.classList.add('fade-out');
    }

    if (demoPill) {
      function onPillClick(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        runScrubberDemoAnimation();
      }
      demoPill.addEventListener('click', onPillClick);
      demoPill.addEventListener('touchend', onPillClick, { passive: false });
    }

    function runScrubberDemoAnimation() {
      if (isDemoRunning || !headings || headings.length === 0) return;
      isDemoRunning = true;
      isDragging = true;
      isTOCScrollLocked = true;

      dismissPill();

      let initialY = window.pageYOffset || document.documentElement.scrollTop;
      let headerHeight = 60;
      let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
      let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;

      // 1. Detect current section in viewport
      let currentVisibleIdx = 0;
      for (let i = headings.length - 1; i >= 0; i--) {
        let hRect = headings[i].getBoundingClientRect();
        if (hRect.top <= window.innerHeight * 0.45) {
          currentVisibleIdx = i;
          break;
        }
      }

      let startIdx = currentVisibleIdx;
      // Strictly 2 titles: Current -> Next (or Current -> Previous if at the bottom)
      let targetIdx = startIdx;
      if (headings.length > 1) {
        if (startIdx < headings.length - 1) {
          targetIdx = startIdx + 1;
        } else {
          targetIdx = startIdx - 1;
        }
      }

      let hTarget = headings[targetIdx];
      let targetY = hTarget ? Math.max(0, hTarget.getBoundingClientRect().top + initialY - headerHeight - subnavHeight - 24) : initialY;

      function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }
      function easeOutBack(t) {
        let c1 = 1.70158;
        let c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      }

      let wrapper = document.querySelector('.ka-blog-wrapper') || document.querySelector('.ka-journal-article-section');
      if (wrapper) wrapper.classList.add('ka-bg-blurred');
      if (demoOverlay) demoOverlay.classList.add('is-active');
      bar.classList.add('is-active', 'is-demoing');
      if (bubble) bubble.classList.add('is-active');

      let pullDuration = 280;
      let dragDuration = 600;
      let holdDuration = 400;
      let returnDuration = 550;
      let releaseDuration = 250;

      // Step 1: Thumb Touch & Pull Out on startIdx
      let step1Start = null;
      function animateDemoPull(ts1) {
        if (!isDemoRunning) return;
        if (!step1Start) step1Start = ts1;
        let elapsed1 = ts1 - step1Start;
        let p1 = Math.min(1, elapsed1 / pullDuration);
        let shift1 = 48 * easeOutBack(p1);

        highlightItem(startIdx, shift1);

        if (p1 < 1) {
          requestAnimationFrame(animateDemoPull);
        } else {
          // Step 2: Thumb drag forward (startIdx -> targetIdx) and smooth page scroll preview
          let step2Start = null;
          function animateDemoDragForward(ts2) {
            if (!isDemoRunning) return;
            if (!step2Start) step2Start = ts2;
            let elapsed2 = ts2 - step2Start;
            let p2 = Math.min(1, elapsed2 / dragDuration);
            let ease2 = easeInOutCubic(p2);

            let currY = initialY + (targetY - initialY) * ease2;
            window.scrollTo(0, currY);

            let currentActiveIdx = (p2 < 0.5) ? startIdx : targetIdx;
            let shift2 = 48 + (6 * Math.sin(p2 * Math.PI));

            highlightItem(currentActiveIdx, shift2);

            if (p2 < 1) {
              requestAnimationFrame(animateDemoDragForward);
            } else {
              // Step 3: Brief Hold on destination so user sees target title preview
              setTimeout(function() {
                if (!isDemoRunning) return;

                // Step 4: Thumb drag RETURN back to startIdx and smooth page scroll back
                let step4Start = null;
                let fromY = window.pageYOffset || document.documentElement.scrollTop;

                function animateDemoDragReturn(ts4) {
                  if (!isDemoRunning) return;
                  if (!step4Start) step4Start = ts4;
                  let elapsed4 = ts4 - step4Start;
                  let p4 = Math.min(1, elapsed4 / returnDuration);
                  let ease4 = easeInOutCubic(p4);

                  let retY = fromY + (initialY - fromY) * ease4;
                  window.scrollTo(0, retY);

                  let returnActiveIdx = (p4 < 0.5) ? targetIdx : startIdx;
                  let shift4 = 48 + (6 * Math.sin(p4 * Math.PI));

                  highlightItem(returnActiveIdx, shift4);

                  if (p4 < 1) {
                    requestAnimationFrame(animateDemoDragReturn);
                  } else {
                    // Step 5: Spring Release back into resting rail
                    let step5Start = null;
                    function animateDemoRelease(ts5) {
                      if (!isDemoRunning) return;
                      if (!step5Start) step5Start = ts5;
                      let elapsed5 = ts5 - step5Start;
                      let p5 = Math.min(1, elapsed5 / releaseDuration);
                      let shift5 = 48 * (1 - p5);

                      highlightItem(startIdx, shift5);

                      if (p5 < 1) {
                        requestAnimationFrame(animateDemoRelease);
                      } else {
                        // Complete & Reset cleanly
                        window.scrollTo(0, initialY);
                        isDemoRunning = false;
                        isDragging = false;
                        isTOCScrollLocked = false;

                        bar.classList.remove('is-active', 'is-demoing');
                        if (bubble) {
                          bubble.classList.remove('is-active');
                          bubble.style.maxWidth = '';
                        }
                        if (bubbleTitle) {
                          bubbleTitle.textContent = '';
                        }
                        if (demoOverlay) demoOverlay.classList.remove('is-active');
                        if (wrapper) wrapper.classList.remove('ka-bg-blurred');

                        barSpans.forEach(function (span) {
                          span.style.transform = '';
                          span.style.color = '';
                          span.style.backgroundColor = '';
                          span.style.opacity = '';
                          span.classList.remove('active', 'active-scrub', 'near-scrub-1', 'near-scrub-2', 'dimmed-scrub');
                        });
                        activeIdx = -1;
                        lastShiftX = -1;

                        try { highlightItem(startIdx, 0); } catch(e) {}
                      }
                    }
                    requestAnimationFrame(animateDemoRelease);
                  }
                }
                requestAnimationFrame(animateDemoDragReturn);
              }, holdDuration);
            }
          }
          requestAnimationFrame(animateDemoDragForward);
        }
      }
      requestAnimationFrame(animateDemoPull);
    }

    function triggerNiagaraOnboardingDemo() {
      runScrubberDemoAnimation();
    }

    function checkKeyTakeawaysWave() {
      return; // Key Takeaways wave pulse animation disabled
    }

    track.addEventListener('touchstart', function () {
      hasInteractedWithScrubber = true;
      if (isDemoRunning) {
        isDemoRunning = false;
        isDragging = false;
        if (demoOverlay) demoOverlay.classList.remove('is-active');
        if (wrapper) wrapper.classList.remove('ka-bg-blurred');
        if (bar) bar.classList.remove('is-active', 'is-demoing');
        if (bubble) {
          bubble.classList.remove('is-active');
          bubble.style.maxWidth = '';
        }
      }
      let barSpansList = track.querySelectorAll('span');
      barSpansList.forEach(function (span) {
        span.classList.remove('is-waving');
      });
    }, { passive: true });

    function updateScrubberBulletProgress() {
      if (isDemoRunning || isDragging) return;
      let tocCard = document.querySelector('.vaidyam-article-toc-mobile') || 
                    document.querySelector('.vaidyam-article-toc-card') || 
                    document.querySelector('.ka-article-summary-card') || 
                    document.querySelector('.ka-article-body');
      
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      let viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Target scroll position: when TOC card reaches middle of viewport
      let targetScroll = 350; // fallback
      if (tocCard) {
        let cardTop = tocCard.getBoundingClientRect().top + scrollTop;
        targetScroll = Math.max(120, cardTop - (viewportHeight / 2));
      }

      let rawProgress = scrollTop / targetScroll;
      let entranceProgress = Math.max(0, Math.min(1, rawProgress));

      let barSpansList = track.querySelectorAll('span');
      let totalSpans = barSpansList.length;

      if (totalSpans > 0) {
        // 1. Entrance visible count (top to bottom)
        let visibleCount = Math.floor(entranceProgress * (totalSpans + 1));
        if (entranceProgress >= 1) {
          visibleCount = totalSpans;
        }

        // 2. Exit condition: Last body section content leaves lower screen area (65% of viewport height)
        let articleBody = document.querySelector('.ka-article-body');
        let removedCount = 0;
        let bodyRect = articleBody ? articleBody.getBoundingClientRect() : null;

        if (bodyRect) {
          let exitThreshold = viewportHeight * 0.65;

          if (bodyRect.bottom < exitThreshold) {
            let exitDistance = exitThreshold - bodyRect.bottom;
            let exitSpanStep = Math.max(20, viewportHeight * 0.05); // smooth step per bar
            removedCount = Math.min(totalSpans, Math.ceil(exitDistance / exitSpanStep));
          }
        }

        // Effective visible count from the top
        let effectiveVisibleCount = Math.max(0, visibleCount - removedCount);

        barSpansList.forEach(function (span, i) {
          let heading = headings[i];
          let isHeadingVisible = false;
          if (heading) {
            let hRect = heading.getBoundingClientRect();
            if (hRect.top <= viewportHeight * 0.75) {
              isHeadingVisible = true;
            }
          }
          if (isHeadingVisible || i < effectiveVisibleCount) {
            span.classList.add('bullet-inserted');
          } else {
            span.classList.remove('bullet-inserted');
          }
        });

        // Calculate and dynamically activate the current section rightbar
        let activeHeadingIdx = -1;
        for (let i = 0; i < headings.length; i++) {
          let h = headings[i];
          if (h) {
            let hRect = h.getBoundingClientRect();
            if (hRect.top <= viewportHeight * 0.45) {
              activeHeadingIdx = i;
            }
          }
        }
        if (activeHeadingIdx >= 0 && !isDragging && !isDemoRunning) {
          highlightItem(activeHeadingIdx, 0);
        }

        // Hide whole bar container when all section bars have faded away past body content
        if (articleBody && (removedCount >= totalSpans || (bodyRect && bodyRect.bottom <= 50))) {
          bar.classList.add('is-past-body');
          if (demoPill && demoPill.classList.contains('is-visible') && !isDemoRunning) {
            dismissPill();
          }
        } else {
          bar.classList.remove('is-past-body');
        }

        // Fast-scroll auto-dismiss: if user scrolls fast past the 1st section or past bars
        if (removedCount > 0 && demoPill && demoPill.classList.contains('is-visible') && !isDemoRunning) {
          dismissPill();
        }
      }

      checkKeyTakeawaysWave();
    }

    let isScrubberTicking = false;
    function onScrubberScrollThrottled() {
      if (!isScrubberTicking) {
        requestAnimationFrame(function () {
          updateScrubberBulletProgress();
          isScrubberTicking = false;
        });
        isScrubberTicking = true;
      }
    }

    window.addEventListener('scroll', onScrubberScrollThrottled, { passive: true });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 990) {
        if (demoPill) {
          demoPill.classList.remove('is-visible');
          demoPill.classList.add('fade-out');
        }
        if (demoOverlay) {
          demoOverlay.classList.remove('is-active');
        }
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
      }
    }, { passive: true });
    updateScrubberBulletProgress(); // Initial check on load
    
    function highlightItem(index, shiftX) {
      shiftX = shiftX || 0;
      if (!isDragging && index === activeIdx && shiftX === lastShiftX) return;
      activeIdx = index;
      lastShiftX = shiftX;
      
      barSpans.forEach(function (span, i) {
        let diff = Math.abs(i - index);
        if (!isDragging) {
          if (diff === 0 && index >= 0) {
            span.style.transform = 'scaleX(1.15)';
            span.style.color = '#FFFFFF';
            span.style.backgroundColor = '#1E4B3C';
            span.style.opacity = '1';
            span.classList.add('active');
            if (i === 0) {
              showScrubberDemoPill();
            }
          } else {
            span.style.transform = 'scaleX(1)';
            span.style.color = 'transparent';
            span.style.backgroundColor = '';
            span.style.opacity = '';
            span.classList.remove('active');
          }
        } else {
          let baseScale = (window.innerWidth / 375) * 1.5;
          let scaleVal = Math.min(1.8, Math.max(1.3, baseScale));
          if (diff === 0) {
            span.style.transform = 'translateX(' + (-shiftX - 45) + 'px) scale(' + scaleVal + ')';
            span.style.color = '#FFFFFF';
            span.style.backgroundColor = '#1E4B3C';
            span.style.opacity = '1';
            span.classList.add('active');
          } else if (diff === 1) {
            span.style.transform = 'translateX(' + (-shiftX * 0.5 - 22) + 'px) scale(1.3)';
            span.style.color = '#1E4B3C';
            span.style.backgroundColor = 'transparent';
            span.style.opacity = '0.6';
            span.classList.remove('active');
          } else if (diff === 2) {
            span.style.transform = 'translateX(' + (-shiftX * 0.2 - 10) + 'px) scale(1.1)';
            span.style.color = '#1E4B3C';
            span.style.backgroundColor = 'transparent';
            span.style.opacity = '0.4';
            span.classList.remove('active');
          } else {
            span.style.transform = 'translateX(0) scale(1)';
            span.style.color = '#1E4B3C';
            span.style.backgroundColor = 'transparent';
            span.style.opacity = '0.4';
            span.classList.remove('active');
          }
        }
      });
      
      if (headings[index] && index >= 0) {
        let bubbleNum = bubble.querySelector('.bubble-num');
        let bubbleTitle = bubble.querySelector('.bubble-title');
        
        if (bubbleNum) bubbleNum.textContent = String(index + 1).padStart(2, '0');
        if (bubbleTitle) {
          let text = "";
          if (manualEntries && manualEntries[index]) {
            let entry = manualEntries[index];
            if (typeof entry === 'string') {
              let parts = entry.split('•');
              text = parts[0].trim();
            } else if (typeof entry === 'object' && entry !== null) {
              text = String(entry.title || entry.heading || entry.label || entry.name || '').trim();
            }
          }
          if (!text && headings[index]) {
            let h = headings[index];
            text = (h.dataset && h.dataset.tocTitle) || h.tocDisplayName || h.tocTitle || h.innerText || h.textContent || '';
            text = text.trim();
          }
          if (text) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
          }
          bubbleTitle.textContent = text;
        }
        
        let activeSpan = barSpans[index];
        if (activeSpan) {
          let rect = activeSpan.getBoundingClientRect();
          if (rect && rect.top > 0) {
            bubble.style.top = (rect.top + (rect.height / 2)) + 'px';
          } else {
            let trackRect = track.getBoundingClientRect();
            let pct = (index + 0.5) / Math.max(1, headings.length);
            bubble.style.top = (trackRect.top + (trackRect.height * pct)) + 'px';
          }
        } else {
          let trackRect2 = track.getBoundingClientRect();
          let pct2 = (index + 0.5) / Math.max(1, headings.length);
          bubble.style.top = (trackRect2.top + (trackRect2.height * pct2)) + 'px';
        }

        if (isDragging) {
          let safeRightMargin = (window.innerWidth >= 768) ? 220 : 135;
          let dynamicMaxWidth = Math.max(100, window.innerWidth - shiftX - safeRightMargin);
          bubble.style.maxWidth = dynamicMaxWidth + 'px';
          bubble.classList.add('is-active');
        } else if (isDemoRunning) {
          let demoRightMargin = (window.innerWidth >= 768) ? 220 : 135;
          bubble.style.maxWidth = (window.innerWidth - demoRightMargin) + 'px';
          bubble.classList.add('is-active');
        } else {
          bubble.style.maxWidth = '';
          bubble.classList.remove('is-active');
          if (bubbleTitle) bubbleTitle.textContent = '';
        }

      } else if (index < 0) {
        bubble.style.maxWidth = '';
        bubble.classList.remove('is-active');
        if (bubbleTitle) bubbleTitle.textContent = '';
      }
    }

    function getTipStorage(name) {
      try {
        let val = localStorage.getItem(name);
        if (val) return val;
        let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        if (match) return match[2];
      } catch (e) {}
      return null;
    }

    function setTipStorage(name, value) {
      try {
        localStorage.setItem(name, value);
        document.cookie = name + "=" + (value || "") + "; path=/; SameSite=Lax";
      } catch (e) {}
    }

    if (window.location.search.indexOf('reset_tip') > -1 || window.location.search.indexOf('test_tip') > -1) {
      try {
        localStorage.removeItem('hasSeenScrollTip');
        document.cookie = "hasSeenScrollTip=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      } catch (e) {}
    }

    let glassTip = document.getElementById('kaScrubberGlassTip');
    let hasSeenScrollTip = (getTipStorage('hasSeenScrollTip') === 'true');
    let glassTipTimer = null;
    let glassTipTriggerY = 0;

    function dismissGlassTip() {
      if (glassTip) {
        glassTip.classList.remove('is-visible');
      }
      if (glassTipTimer) {
        clearTimeout(glassTipTimer);
        glassTipTimer = null;
      }
    }

    function triggerGlassTip() {
      if (hasSeenScrollTip || !glassTip) return;
      hasSeenScrollTip = true;
      setTipStorage('hasSeenScrollTip', 'true');

      glassTipTriggerY = window.pageYOffset || document.documentElement.scrollTop;

      let barSpansList = track.querySelectorAll('span');
      if (barSpansList.length > 0) {
        let r = barSpansList[0].getBoundingClientRect();
        if (r && r.top > 0) {
          glassTip.style.top = (r.top + (r.height / 2)) + 'px';
        } else {
          let tRect = track.getBoundingClientRect();
          glassTip.style.top = (tRect.top + 16) + 'px';
        }
      } else {
        let tRect2 = track.getBoundingClientRect();
        glassTip.style.top = (tRect2.top + 16) + 'px';
      }

      glassTip.classList.add('is-visible');

      glassTipTimer = setTimeout(function () {
        dismissGlassTip();
      }, 3000);
    }

    if (glassTip) {
      function onGlassTipClick(e) {
        e.preventDefault();
        e.stopPropagation();
        dismissGlassTip();
        triggerNiagaraOnboardingDemo();
      }
      glassTip.addEventListener('click', onGlassTipClick);
      glassTip.addEventListener('touchstart', onGlassTipClick, { passive: false });
    }

    window.addEventListener('scroll', function () {
      if (glassTip && glassTip.classList.contains('is-visible')) {
        dismissGlassTip();
      }
    }, { passive: true });
    
    function handleDragStart() {
      if (isDragging) return;
      isDragging = true;
      hasInteractedWithScrubber = true;
      if (isDemoRunning) isDemoRunning = false;

      bar.classList.add('is-active');
      bubble.classList.add('is-active');
      let wrapper = document.querySelector('.ka-blog-wrapper');
      if (wrapper) {
        wrapper.classList.add('ka-bg-blurred');
      }
      if (demoOverlay) {
        demoOverlay.classList.add('is-active');
      }
      document.body.classList.add('ka-scrubbing-active');
      
      if (typeof abortPreviewFn === 'function') {
        abortPreviewFn();
      }
      dismissGlassTip();
      activeIdx = -1;
      lastShiftX = -1;
    }
    
    function getPointY(e) {
      if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
      if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
      return e.clientY || 0;
    }

    function getPointX(e) {
      if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
      return e.clientX || 0;
    }

    function handleDragMove(e) {
      if (!isDragging) return;
      
      let touchY = getPointY(e);
      let touchX = getPointX(e);
      
      // Calculate how far left the user has dragged from the right edge
      let dragLeft = Math.max(0, window.innerWidth - touchX);
      let maxDragLeft = Math.min(120, Math.round(window.innerWidth * 0.4));
      let shiftX = Math.min(dragLeft, maxDragLeft);
      
      let trackRect = track.getBoundingClientRect();
      let relativeY = touchY - trackRect.top;
      let percentage = Math.max(0, Math.min(1, relativeY / trackRect.height));
      let index = Math.floor(percentage * totalItems);
      if (index >= totalItems) index = totalItems - 1;
      if (index < 0) index = 0;
      
      highlightItem(index, shiftX);
      if (e.cancelable) {
        e.preventDefault();
      }
    }
    
    function handleDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      
      bar.classList.remove('is-active');
      bubble.classList.remove('is-active');
      bubble.style.maxWidth = '';
      let wrapper = document.querySelector('.ka-blog-wrapper');
      if (wrapper) {
        wrapper.classList.remove('ka-bg-blurred');
      }
      if (demoOverlay) {
        demoOverlay.classList.remove('is-active');
      }
      document.body.classList.remove('ka-scrubbing-active');
      
      let targetIndex = activeIdx;
      
      // Reset transforms
      barSpans.forEach(function (span) {
        span.style.transform = '';
        span.style.color = '';
        span.style.backgroundColor = '';
        span.style.opacity = '';
        span.classList.remove('active', 'active-scrub', 'near-scrub-1', 'near-scrub-2', 'dimmed-scrub');
      });
      activeIdx = -1;
      lastShiftX = -1;
      
      if (targetIndex >= 0 && targetIndex < totalItems && headings[targetIndex]) {
        let targetHeading = headings[targetIndex];
        
        let headerHeight = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height')
        ) || 60;
        
        let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
        let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;
        
        let targetPosition = targetHeading.getBoundingClientRect().top + window.pageYOffset;
        let offsetPosition = targetPosition - headerHeight - subnavHeight - 24;
        
        smoothScrollTo(offsetPosition, 400);
      }
    }
    
    function onPointerDown(e) {
      let touchX = getPointX(e);
      let touchY = getPointY(e);

      let isDirectTarget = e.target && e.target.closest && e.target.closest('#kaScrubberBar, #kaScrubberNumsTrack, .ka-niagara-scrubber-bar');
      let isRightEdge = (window.innerWidth - touchX <= 40);

      if (!isDirectTarget && !isRightEdge) return;

      let trackRect = track.getBoundingClientRect();
      let topBound = trackRect.top - (window.innerHeight * 0.20);
      let bottomBound = trackRect.bottom + (window.innerHeight * 0.30);

      if (touchY < topBound || touchY > bottomBound) return;

      if (e.target && e.target.closest && e.target.closest('button, input, a, select, textarea') && !isDirectTarget) return;

      handleDragStart();
      handleDragMove(e);
    }

    window.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('mousedown', onPointerDown);
    
    window.addEventListener('touchmove', function (e) {
      if (isDragging) handleDragMove(e);
    }, { passive: false });
    window.addEventListener('mousemove', function (e) {
      if (isDragging) handleDragMove(e);
    });
    
    window.addEventListener('touchend', function (e) {
      if (isDragging) handleDragEnd();
    });
    window.addEventListener('mouseup', function (e) {
      if (isDragging) handleDragEnd();
    });
    
    window.addEventListener('touchcancel', function (e) {
      if (isDragging) handleDragEnd();
    });
  }

  // Scroll Progress Bar Tracker
  function initMobileScrollProgressBar() {
    let bars = document.querySelectorAll('.ka-mobile-scroll-progress-bar, .ka-scroll-progress-bar');
    let article = document.querySelector('.ka-article-content') || document.querySelector('.ka-article-body');
    
    if (!bars.length || !article) return;
    
    window.addEventListener('scroll', function () {
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      let startY = article.getBoundingClientRect().top + scrollTop;
      let endY = startY + article.offsetHeight;
      
      let totalScrollable = endY - startY - window.innerHeight;
      if (totalScrollable <= 0) {
        bars.forEach(function(b) { b.style.width = '0%'; });
        return;
      }
      
      let scrolled = scrollTop - startY;
      let percentage = (scrolled / totalScrollable) * 100;
      percentage = Math.max(0, Math.min(100, percentage));
      
      bars.forEach(function(b) { b.style.width = percentage + '%'; });
    }, { passive: true });
  }

  function scrollToHeading(heading) {
    let headerHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height')
    ) || 60;
    let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
    let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;

    let targetPosition =
      heading.getBoundingClientRect().top + window.pageYOffset;
    let offsetPosition = targetPosition - headerHeight - subnavHeight - 24;

    smoothScrollTo(offsetPosition, 350);
  }

  // ============================================================
  // 3. FAQ ACCORDION — Progressive enhancement
  //    Uses native <details>/<summary>, adds smooth open/close
  // ============================================================
  function initFAQ() {
    let faqSection = document.querySelector('.ka-article-faq');
    if (!faqSection) return;

    let details = faqSection.querySelectorAll('details');
    details.forEach(function (detail) {
      let summary = detail.querySelector('summary');
      if (!summary) return;

      summary.setAttribute(
        'aria-expanded',
        detail.hasAttribute('open') ? 'true' : 'false'
      );

      detail.addEventListener('toggle', function () {
        summary.setAttribute('aria-expanded', detail.open ? 'true' : 'false');
      });
    });
  }

  // ============================================================
  // 4. READ TIME — Calculate from article content word count
  // ============================================================
  function initReadTime() {
    let readTimeEl = document.querySelector('[data-ka-read-time]');
    if (!readTimeEl) return;

    // Only calculate if no explicit read time was set
    if (readTimeEl.textContent.trim()) return;

    let articleContent = document.querySelector('.ka-article-content');
    if (!articleContent) return;

    let text = articleContent.textContent || '';
    let wordCount = text.split(/\s+/).filter(function (w) {
      return w.length > 0;
    }).length;
    let minutes = Math.max(1, Math.ceil(wordCount / 200));
    readTimeEl.textContent = minutes + ' min read';
  }

  // ============================================================
  // 5. TOPIC CAROUSEL — Wheel scroll translation & dots sync
  // ============================================================
  function initTopicCarousel() {
    let outer = document.querySelector('.ka-blog-topic-carousel-outer');
    if (!outer) return;

    let container = outer.querySelector('.ka-blog-topic-carousel-container');
    let decks = outer.querySelectorAll('.ka-blog-topic-deck');
    let dots = outer.querySelectorAll('.ka-blog-topic-dot');
    let prevBtn = outer.querySelector('.ka-blog-topic-arrow--prev');
    let nextBtn = outer.querySelector('.ka-blog-topic-arrow--next');
    if (!container || !decks.length) return;

    function updateActiveState() {
      let scrollLeft = container.scrollLeft;
      let activeIndex = 0;
      let minDiff = Infinity;
      decks.forEach(function (deck, idx) {
        let diff = Math.abs(scrollLeft - deck.offsetLeft);
        if (diff < minDiff) {
          minDiff = diff;
          activeIndex = idx;
        }
      });
      let decksCount = decks.length;

      dots.forEach(function (dot, idx) {
        if (idx === activeIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      decks.forEach(function (deck, idx) {
        if (idx === activeIndex) {
          deck.classList.add('active');
        } else {
          deck.classList.remove('active');
        }
      });

      // Update arrows disabled state
      if (prevBtn) {
        prevBtn.disabled = (activeIndex === 0);
      }
      if (nextBtn) {
        nextBtn.disabled = (activeIndex === decksCount - 1);
      }
    }

    function scrollToTopicsTopOnMobile() {
      if (window.innerWidth < 980) {
        let topicsSec = document.getElementById('topics');
        if (topicsSec) {
          let headerHeight = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--header-height')
          ) || 60;
          let targetPosition = topicsSec.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
          smoothScrollTo(targetPosition, 350);
        }
      }
    }

    // Scroll listener on container
    container.addEventListener('scroll', updateActiveState);

    // Initial check
    setTimeout(updateActiveState, 100);

    // Dot clicks
    dots.forEach(function (dot) {
      dot.addEventListener('click', function (e) {
        e.preventDefault();
        let index = parseInt(dot.getAttribute('data-index'));
        let targetDeck = decks[index];
        if (targetDeck) {
          container.scrollTo({
            left: targetDeck.offsetLeft,
            behavior: 'smooth'
          });
          scrollToTopicsTopOnMobile();
        }
      });
    });

    // Arrow clicks
    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        let scrollLeft = container.scrollLeft;
        let activeIndex = 0;
        let minDiff = Infinity;
        decks.forEach(function (deck, idx) {
          let diff = Math.abs(scrollLeft - deck.offsetLeft);
          if (diff < minDiff) {
            minDiff = diff;
            activeIndex = idx;
          }
        });
        let targetIndex = Math.max(0, activeIndex - 1);
        let targetDeck = decks[targetIndex];
        if (targetDeck) {
          container.scrollTo({
            left: targetDeck.offsetLeft,
            behavior: 'smooth'
          });
          scrollToTopicsTopOnMobile();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        let scrollLeft = container.scrollLeft;
        let activeIndex = 0;
        let minDiff = Infinity;
        decks.forEach(function (deck, idx) {
          let diff = Math.abs(scrollLeft - deck.offsetLeft);
          if (diff < minDiff) {
            minDiff = diff;
            activeIndex = idx;
          }
        });
        let targetIndex = Math.min(decks.length - 1, activeIndex + 1);
        let targetDeck = decks[targetIndex];
        if (targetDeck) {
          container.scrollTo({
            left: targetDeck.offsetLeft,
            behavior: 'smooth'
          });
          scrollToTopicsTopOnMobile();
        }
      });
    }

    // Handle resize
    window.addEventListener('resize', updateActiveState);
  }

  // ============================================================
  // 5.1. HERO SEARCH & EXPLORE TOPICS REDIRECT
  // ============================================================
  function initHeroSearchExploreRedirect() {
    let exploreBtn = document.querySelector('.ka-blog-hero-actions a[href="#topics"]');
    let searchInput = document.querySelector('.ka-blog-hero-search input[name="q"]');
    if (!exploreBtn || !searchInput) return;

    exploreBtn.addEventListener('click', function (e) {
      let query = searchInput.value.trim();
      if (query) {
        e.preventDefault();
        e.stopImmediatePropagation();
        let scopedQuery = 'title:(' + query + ') OR body:(' + query + ') OR tag:(' + query + ')';
        window.location.href = '/search?type=article&q=' + encodeURIComponent(scopedQuery) + '&options[prefix]=last';
      }
    }, true);
  }

  // ============================================================
  // 5.2. SCOPED SEARCH INTERCEPTOR (Title, Description, or Tags/Topics)
  // ============================================================
  function initScopedSearch() {
    document.addEventListener('submit', function(e) {
      let form = e.target;
      if (form && (form.classList.contains('search') || form.classList.contains('ka-blog-hero-search') || form.action.includes('/search'))) {
        let qInput = form.querySelector('input[name="q"]');
        if (qInput && qInput.value.trim()) {
          let query = qInput.value.trim();
          if (!query.includes('title:(') && !query.includes('body:(') && query !== '*') {
            e.preventDefault();
            let scopedQuery = 'title:(' + query + ') OR body:(' + query + ') OR tag:(' + query + ')';
            let searchUrl = form.action || '/search';
            let url = new URL(searchUrl, window.location.origin);
            url.searchParams.set('q', scopedQuery);
            url.searchParams.set('options[prefix]', 'last');
            let inputs = form.querySelectorAll('input[type="hidden"]');
            inputs.forEach(function(input) {
              if (input.name !== 'q') {
                url.searchParams.set(input.name, input.value);
              }
            });
            window.location.href = url.toString();
          }
        }
      }
    });
  }

  // ============================================================
  // 6. AJAX FILTERING & PAGINATION
  // ============================================================
  function loadAjaxContent(url, scrollToId, isPopState) {
    let grid = document.querySelector('.ka-blog-article-grid');
    let pagination = document.querySelector('.ka-blog-pagination');
    let filterBar = document.querySelector('.ka-blog-filter-bar');
    let breadcrumbWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
    
    if (grid) grid.classList.add('is-loading');
    if (pagination) pagination.classList.add('is-loading');
    if (filterBar) filterBar.classList.add('is-loading');
    if (breadcrumbWrap) breadcrumbWrap.classList.add('is-loading');

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Network response not ok');
        return response.text();
      })
      .then(function (html) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        
        let newGrid = doc.querySelector('.ka-blog-article-grid');
        let newPagination = doc.querySelector('.ka-blog-pagination');
        let newFilterBar = doc.querySelector('.ka-blog-filter-bar');
        let newBreadcrumbWrap = doc.querySelector('.theme-header-custom__breadcrumbs-wrap');
        
        if (grid && newGrid) {
          grid.innerHTML = newGrid.innerHTML;
        } else if (grid && !newGrid) {
          grid.innerHTML = '';
        }
        
        if (pagination && newPagination) {
          pagination.innerHTML = newPagination.innerHTML;
          pagination.classList.remove('ka-hidden');
        } else if (pagination) {
          pagination.innerHTML = '';
          pagination.classList.add('ka-hidden');
        } else if (!pagination && newPagination) {
          let pagContainer = document.createElement('nav');
          pagContainer.className = 'ka-blog-pagination';
          pagContainer.setAttribute('aria-label', 'Blog pagination');
          pagContainer.innerHTML = newPagination.innerHTML;
          grid.parentNode.insertBefore(pagContainer, grid.nextSibling);
        }
        
        if (filterBar && newFilterBar) {
          filterBar.innerHTML = newFilterBar.innerHTML;
        }
        
        if (breadcrumbWrap && newBreadcrumbWrap) {
          breadcrumbWrap.innerHTML = newBreadcrumbWrap.innerHTML;
        }
        
        if (grid) grid.classList.remove('is-loading');
        
        let currentPagination = document.querySelector('.ka-blog-pagination');
        if (currentPagination) currentPagination.classList.remove('is-loading');
        
        if (filterBar) filterBar.classList.remove('is-loading');
        if (breadcrumbWrap) breadcrumbWrap.classList.remove('is-loading');
        
        if (!isPopState) {
          history.pushState(null, '', url);
        }
        
        if (scrollToId) {
          let targetEl = document.getElementById(scrollToId);
          if (targetEl) {
            let headerHeight = parseInt(
              getComputedStyle(document.documentElement).getPropertyValue('--header-height')
            ) || 60;
            let subnav = document.querySelector('.ka-blog-subnav');
            let subnavHeight = subnav ? subnav.offsetHeight : 50;
            
            let targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
            let offsetPosition = targetPosition - headerHeight - subnavHeight - 20;
            
            smoothScrollTo(offsetPosition, 350);
          }
        }
      })
      .catch(function (err) {
        console.error('AJAX Load failed:', err);
        window.location.href = url;
      });
  }

  function initAjaxFiltering() {
    document.addEventListener('click', function (e) {
      let target = e.target;
      if (target.closest('.ka-journal-search')) return;

      let isFilterLink = target.closest('.ka-blog-filter-bar a');
      let isPaginationLink = target.closest('.ka-blog-pagination a');
      
      if (!isFilterLink && !isPaginationLink) return;
      
      let link = isFilterLink || isPaginationLink;
      let url = link.getAttribute('href');
      if (!url) return;
      
      e.preventDefault();
      
      let scrollToId = null;
      if (isFilterLink) {
        scrollToId = 'articles';
      } else if (isPaginationLink) {
        if (url.indexOf('#articles') !== -1) {
          scrollToId = 'articles';
        } else if (url.indexOf('#latest') !== -1) {
          scrollToId = 'latest';
        } else {
          scrollToId = 'latest';
        }
      }
      
      loadAjaxContent(url, scrollToId, false);
    });

    window.addEventListener('popstate', function (e) {
      if (document.querySelector('.ka-journal-search')) {
        loadSearchAjax(window.location.href, true);
      } else if (document.querySelector('.ka-blog-wrapper--landing') && window.location.pathname.includes('/pages/journal-search')) {
        transitionToSearchPage(window.location.href, '', true);
      } else {
        loadAjaxContent(window.location.href, null, true);
      }
    });
  }

  function loadSearchAjax(url, isPopState, isUserAction) {
    let container = document.querySelector('.ka-journal-search');
    if (!container) return;

    let resultsArea = document.getElementById('ProductGridContainer') || document.querySelector('.ka-search-results');
    if (resultsArea) {
      let cardsGrid = resultsArea.querySelector('.ka-blog-article-grid--search, .ka-search-results-grid, ul');
      if (cardsGrid) cardsGrid.style.transition = 'opacity 0.2s ease';
      if (cardsGrid) cardsGrid.style.opacity = '0.4';
    }

    let fetchUrl = url.split('#')[0];

    fetch(fetchUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('Network response not ok');
        return response.text();
      })
      .then(function (html) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');

        let newGridContainer = doc.getElementById('ProductGridContainer') || doc.querySelector('.ka-search-results');
        let currentGridContainer = document.getElementById('ProductGridContainer') || document.querySelector('.ka-search-results');
        if (currentGridContainer && newGridContainer) {
          currentGridContainer.innerHTML = newGridContainer.innerHTML;
        } else {
          let newContainer = doc.querySelector('.ka-journal-search');
          if (container && newContainer) {
            container.innerHTML = newContainer.innerHTML;
          }
        }

        // Synchronize search input text
        let qParam = '';
        try {
          let parsedUrl = new URL(url, window.location.origin);
          qParam = parsedUrl.searchParams.get('q') || '';
          if (qParam === '*' || qParam.includes('author:*') || qParam.includes('tag:*')) qParam = '';
          if (qParam.includes('title:(')) qParam = qParam.split('title:(')[1].split(')')[0].trim();
          if (qParam.includes('OR body:')) qParam = qParam.split('OR body:')[0].trim();
        } catch (err) {}
        let searchInput = document.querySelector('.ka-journal-search input[name="q"], #Search-In-Template');
        let resetBtn = document.querySelector('.ka-journal-search .ka-custom-search-reset');
        if (searchInput) {
          searchInput.value = qParam;
        }
        if (resetBtn) {
          if (!qParam || qParam.trim() === '') {
            resetBtn.classList.add('is-hidden');
          } else {
            resetBtn.classList.remove('is-hidden');
          }
        }

        // Synchronize search count text
        let newCount = doc.querySelector('.ka-search-count-text, .ka-search-no-results');
        let currentCount = document.querySelector('.ka-search-count-text, .ka-search-no-results');
        if (currentCount && newCount) {
          currentCount.innerHTML = newCount.innerHTML;
        } else if (newCount && !currentCount) {
          let headerWrap = document.querySelector('.ka-search-header-wrap');
          if (headerWrap) {
            let p = document.createElement('div');
            p.innerHTML = newCount.outerHTML;
            headerWrap.appendChild(p.firstElementChild);
          }
        } else if (!newCount && currentCount) {
          currentCount.remove();
        }

        // Synchronize search title
        let newH1 = doc.querySelector('.ka-search-h1');
        let currentH1 = document.querySelector('.ka-search-h1');
        if (currentH1 && newH1) {
          currentH1.innerHTML = newH1.innerHTML;
        }

        // Synchronize filter links
        let newFilters = doc.querySelector('.ka-search-filters-list');
        let currentFilters = document.querySelector('.ka-search-filters-list');
        if (currentFilters && newFilters) {
          currentFilters.innerHTML = newFilters.innerHTML;
        }

        let activeResultsArea = document.getElementById('ProductGridContainer') || document.querySelector('.ka-search-results');
        if (activeResultsArea) {
          let cardsGrid = activeResultsArea.querySelector('.ka-blog-article-grid--search, .ka-search-results-grid, ul');
          if (cardsGrid) {
            cardsGrid.style.opacity = '1';
          }
        }

        if (!isPopState) {
          history.pushState(null, '', url);
        }

        if (isUserAction || url.includes('search_page=')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      })
      .catch(function (err) {
        console.error('Search AJAX failed:', err);
        window.location.href = url;
      });
  }

  function initJournalSearchAjax() {
    let searchContainer = document.querySelector('.ka-journal-search');
    if (!searchContainer) return;

    if (!searchContainer._hasSearchBound) {
      searchContainer._hasSearchBound = true;

      // Handle search input typing to toggle "X" button visibility
      searchContainer.addEventListener('input', function (e) {
        let input = e.target;
        if (input && (input.name === 'q' || input.id === 'Search-In-Template')) {
          let resetBtn = searchContainer.querySelector('.ka-custom-search-reset');
          if (resetBtn) {
            if (!input.value || input.value.trim() === '') {
              resetBtn.classList.add('is-hidden');
            } else {
              resetBtn.classList.remove('is-hidden');
            }
          }
        }
      });

      // Handle search form submit
      searchContainer.addEventListener('submit', function (e) {
        let form = e.target;
        if (form && (form.classList.contains('search') || form.classList.contains('ka-blog-hero-search'))) {
          let qInput = form.querySelector('input[name="q"]');
          if (qInput) {
            e.preventDefault();
            let query = qInput.value.trim();
            let searchUrl = form.action || '/pages/journal-search';
            let targetUrl = new URL(searchUrl, window.location.origin);
            targetUrl.searchParams.set('q', query || '*');
            loadSearchAjax(targetUrl.toString(), false, true);
          }
        }
      });

      // Handle filter/pagination/reset clicks inside search results
      searchContainer.addEventListener('click', function (e) {
        let resetBtn = e.target.closest('.ka-custom-search-reset');
        if (resetBtn) {
          e.preventDefault();
          let qInput = searchContainer.querySelector('input[name="q"], #Search-In-Template');
          if (qInput) qInput.value = '';
          resetBtn.classList.add('is-hidden');
          let url = resetBtn.getAttribute('href') || '/pages/journal-search?q=*';
          loadSearchAjax(url, false, true);
          return;
        }

        let filterLink = e.target.closest('.ka-filter-link');
        let link = e.target.closest('.ka-filter-link, .ka-blog-pagination a, .pagination__item, .pagination a');
        if (!link) return;

        let url = link.getAttribute('href');
        if (!url || url === '#' || url.startsWith('javascript:')) return;

        if (filterLink) {
          let searchInput = document.querySelector('.ka-journal-search input[name="q"], #Search-In-Template');
          let resetBtn = document.querySelector('.ka-journal-search .ka-custom-search-reset');
          if (searchInput) searchInput.value = '';
          if (resetBtn) resetBtn.classList.add('is-hidden');
        }

        e.preventDefault();
        loadSearchAjax(url, false, true);
      });
    }
  }

  function initLandingInstantSearch() {
    let heroSearchForm = document.querySelector('.ka-blog-hero-search');
    let landingWrapper = document.querySelector('.ka-blog-wrapper--landing');
    if (!heroSearchForm || !landingWrapper) return;

    heroSearchForm.addEventListener('submit', function (e) {
      let qInput = heroSearchForm.querySelector('input[name="q"]');
      let query = qInput ? qInput.value.trim() : '';
      if (!query) return;

      e.preventDefault();
      let targetUrl = '/pages/journal-search?q=' + encodeURIComponent(query);
      transitionToSearchPage(targetUrl, query);
    });

    let exploreBtn = document.querySelector('.ka-blog-hero-actions a[href="#topics"]');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', function (e) {
        let qInput = heroSearchForm.querySelector('input[name="q"]');
        let query = qInput ? qInput.value.trim() : '';
        if (query) {
          e.preventDefault();
          e.stopImmediatePropagation();
          let targetUrl = '/pages/journal-search?q=' + encodeURIComponent(query);
          transitionToSearchPage(targetUrl, query);
        }
      });
    }
  }

  function transitionToSearchPage(url, query, isPopState) {
    let mainContainer = document.querySelector('.ka-blog-wrapper--landing') || document.querySelector('.ka-blog-wrapper') || document.querySelector('main');
    if (!mainContainer) {
      window.location.href = url;
      return;
    }

    mainContainer.style.transition = 'opacity 0.2s cubic-bezier(0.2, 0, 0, 1)';
    mainContainer.style.opacity = '0.3';

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Search page fetch failed');
        return response.text();
      })
      .then(function (html) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        let newSearchWrapper = doc.querySelector('.ka-journal-search') || doc.querySelector('.template-search');

        if (newSearchWrapper) {
          let parent = mainContainer.parentElement;
          let temp = document.createElement('div');
          temp.innerHTML = newSearchWrapper.outerHTML;
          let inserted = temp.firstElementChild;
          inserted.style.opacity = '0';
          inserted.style.transition = 'opacity 0.25s cubic-bezier(0, 0, 0.2, 1)';
          parent.replaceChild(inserted, mainContainer);
          requestAnimationFrame(function () {
            inserted.style.opacity = '1';
          });

          if (!isPopState) {
            history.pushState({ type: 'journal_search', url: url }, '', url);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });

          initJournalSearchAjax();
          initSearchFiltersMobile();
          if (typeof initMaterialRipples === 'function') initMaterialRipples();
        } else {
          window.location.href = url;
        }
      })
      .catch(function (err) {
        console.error('Instant search transition error:', err);
        window.location.href = url;
      });
  }

  // ============================================================
  // 7. FLOATING CTA — Hide when approaching the footer
  // ============================================================
  function initFloatingCTA() {
    let cta = document.querySelector('.ka-blog-floating-cta');
    let footer = document.querySelector('.theme-footer');
    if (!cta || !footer) return;

    if ('IntersectionObserver' in window) {
      let observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            cta.classList.add('ka-blog-floating-cta--hidden');
          } else {
            cta.classList.remove('ka-blog-floating-cta--hidden');
          }
        });
      }, {
        root: null,
        rootMargin: '0px 0px 80px 0px',
        threshold: 0
      });
      observer.observe(footer);
    } else {
      let checkVisibility = function () {
        let footerRect = footer.getBoundingClientRect();
        if (footerRect.top < window.innerHeight + 80) {
          cta.classList.add('ka-blog-floating-cta--hidden');
        } else {
          cta.classList.remove('ka-blog-floating-cta--hidden');
        }
      };
      window.addEventListener('scroll', checkVisibility, { passive: true });
      window.addEventListener('resize', checkVisibility, { passive: true });
      checkVisibility();
    }
  }

  // ============================================================
  // 7.1. ASK GURUJI CHATBOT WIDGET LOGIC
  // ============================================================
  function initChatbot() {
    let trigger = document.getElementById('ka-chatbot-trigger');
    let windowEl = document.getElementById('ka-chatbot-window');
    let messagesContainer = document.getElementById('ka-chatbot-messages');
    let form = document.getElementById('ka-chatbot-form');
    let input = document.getElementById('ka-chatbot-input');

    if (!trigger || !windowEl || !messagesContainer || !form || !input) return;
    document.body.classList.add('has-ask-guruji');

    let backupQuestions = [
      "What is Agni?",
      "Cooling recipes for Pitta",
      "How to balance Vata?",
      "How to balance Kapha?",
      "What is Ashwagandha?",
      "How does stress affect health?",
      "What is tongue scraping?",
      "Is warm milk good before bed?",
      "What are viruddha ahara?",
      "What is Dinacharya daily routine?",
      "What is Ojas in Ayurveda?",
      "How to improve appetite?",
      "Is ghee good for cooking?",
      "What is Triphala?",
      "How to detox at home?",
      "How to care for joints?",
      "What herbs support memory?",
      "What is Abhyanga massage?",
      "How to prevent dry skin?",
      "How to grow hair faster?",
      "What causes morning grogginess?",
      "How to treat acidity naturally?",
      "What are seasonal guidelines?",
      "Is fasting recommended?",
      "What is panchakarma?",
      "How to practice mindful eating?"
    ];
    let backupIndex = 0;

    let botResponses = {
      "what is this page about?": "This page is the Kerala Ayurveda Wellness Journal, a dedicated portal for classical Ayurvedic wisdom, custom diet guidelines, care paths, and holistic health updates.",
      "how useful is it?": "It provides verified Ayurvedic guidelines, expert-reviewed articles, dynamic wellness topics, and self-care routines to help you achieve long-term balance.",
      "how can i improve sleep?": "For restful sleep, favor a calming evening routine: massage your feet with warm oil, avoid screen time after 9 PM, and drink a cup of warm milk with nutmeg.",
      "i want to speak with a vaidya.": "We can connect you with an expert Ayurvedic Vaidya for a personalized wellness plan. WhatsApp consultations are opening soon!",
      "what is agni?": "Agni is the digestive fire. To steady your agni, eat warm cooked meals at consistent times daily, and try a pre-meal slice of fresh ginger with rock salt.",
      "cooling recipes for pitta": "To soothe Pitta (heat), favor sweet ripe fruits, coriander, fennel, and coconut water. Limit hot spices, chillies, sour pickles, and fried foods.",
      "how to balance vata?": "Vata dosha represents air and space. When out of balance, it brings dryness, coldness, and anxiety. Favour warm, moist, grounding foods, and regular routines.",
      "how to balance kapha?": "Kapha dosha represents earth and water. When out of balance, it brings heaviness, congestion, and lethargy. Favour warm, light, spicy foods and active exercise.",
      "what is ashwagandha?": "Ashwagandha is a renowned adaptogen that supports energy levels, reduces stress, and calms the nervous system.",
      "how does stress affect health?": "Stress raises cortisol and disrupts Vata dosha, leading to poor digestion, sleep issues, and fatigue. Meditation and herbal support help restore balance.",
      "what is tongue scraping?": "Tongue scraping (Jihwa Nirlekhana) in the morning removes toxins (Ama), improves taste perception, and supports digestive and oral health.",
      "is warm milk good before bed?": "Yes! Warm milk acts as a natural sedative. Adding a pinch of nutmeg or cardamom aids digestion and sleep quality.",
      "what are viruddha ahara?": "Viruddha Ahara refers to incompatible food combinations (e.g., milk with fruit or fish) that disrupt digestion and accumulate toxins.",
      "what is dinacharya daily routine?": "Dinacharya is the daily Ayurvedic routine, including early waking, tongue scraping, self-massage (Abhyanga), and structured meal times to align with nature.",
      "what is ojas in ayurveda?": "Ojas is the vital energy or essence of all bodily tissues, representing immunity, strength, vigor, and overall radiant health.",
      "how to improve appetite?": "Improve your appetite by drinking warm ginger-water, chewing ginger with salt before meals, and eating only when your previous meal is digested.",
      "is ghee good for cooking?": "Yes! Ghee (clarified butter) has a high smoke point, stimulates Agni (digestive fire), nourishes tissues, and improves absorption of fat-soluble nutrients.",
      "what is triphala?": "Triphala is a classical formula of three fruits (Amalaki, Bibhitaki, Haritaki) that acts as a gentle bowel tonic and rich antioxidant.",
      "how to detox at home?": "Do a gentle home detox by drinking warm water, sipping cumin-coriander-fennel tea, and eating light, warm Kitchari for a day or two.",
      "how to care for joints?": "Nourish your joints by massaging them with warm sesame or Mahanarayan oil, keeping active, and avoiding dry, cold foods that aggravate Vata.",
      "what herbs support memory?": "Medhya Rasayana (cognitive herbs) like Brahmi, Shankhapushpi, and Gotu Kola are highly praised for memory, focus, and brain health.",
      "what is abhyanga massage?": "Abhyanga is self-massage using warm herbal oil. It calms the nervous system, supports skin tone, increases circulation, and grounds Vata.",
      "how to prevent dry skin?": "Address dry skin from within: drink warm water, consume healthy fats (ghee, olive oil), and perform daily oil massage (Abhyanga).",
      "how to grow hair faster?": "Promote hair growth by oiling the scalp with Bhringraj or coconut oil, eating nutrient-rich foods, and reducing stress to balance Pitta.",
      "what causes morning grogginess?": "Morning grogginess is often due to Ama (undigested waste) or late dinners. Try eating a light dinner by 7 PM and sleeping before 10 PM.",
      "how to treat acidity naturally?": "Soothe acidity with cooling herbs like Amalaki, Shatavari, or licorice. Drink coconut water, and avoid spicy, fried, or sour foods.",
      "what are seasonal guidelines?": "Ayurvedic seasonal routine (Ritucharya) adjusts your diet and lifestyle to balance the environmental shifts in Vata, Pitta, and Kapha.",
      "is fasting recommended?": "Ayurveda recommends light fasting (sips of warm water or ginger tea) during congestion or low appetite to help burn toxins (Ama).",
      "what is panchakarma?": "Panchakarma is a deep Ayurvedic detoxification process of five therapies (like Vamana, Virechana, Basti) managed under medical supervision.",
      "how to practice mindful eating?": "Eat in a calm environment, chew your food thoroughly, avoid distractions like phones, and eat until you are about 75% full."
    };

    let greetingTriggered = false;

    // Toggle Chatbot Window
    function openChatbot() {
      windowEl.classList.remove('ka-chatbot-hidden');
      windowEl.setAttribute('aria-hidden', 'false');
      trigger.classList.add('is-open');
      trigger.innerHTML = '<span class="ka-close-x">✕</span>';
      input.focus();
      
      if (!greetingTriggered) {
        greetingTriggered = true;
        showTypingIndicator();
        setTimeout(function () {
          removeTypingIndicator();
          addMessage("Pranam! I am Guruji, your Ayurvedic guide. How can I help you find balance today?", 'bot');
        }, 1200);
      }
    }

    function closeChatbot() {
      windowEl.classList.add('ka-chatbot-hidden');
      windowEl.setAttribute('aria-hidden', 'true');
      trigger.classList.remove('is-open');
      trigger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ka-chatbot-trigger-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="ka-chatbot-label">Ask Guruji</span>';
    }

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      let isHidden = windowEl.classList.contains('ka-chatbot-hidden');
      if (isHidden) {
        openChatbot();
      } else {
        closeChatbot();
      }
    });

    // Close on clicking outside
    document.addEventListener('click', function (e) {
      if (!windowEl.classList.contains('ka-chatbot-hidden')) {
        if (!windowEl.contains(e.target) && !trigger.contains(e.target)) {
          closeChatbot();
        }
      }
    });

    // Scroll to bottom helper
    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add message bubble
    function addMessage(text, sender) {
      let msgDiv = document.createElement('div');
      msgDiv.classList.add('ka-chatbot-message');
      msgDiv.classList.add('ka-chatbot-message-' + sender);
      
      let p = document.createElement('p');
      p.textContent = text;
      msgDiv.appendChild(p);
      
      // Insert before quick options if they exist
      let quickOpts = messagesContainer.querySelector('.ka-chatbot-quick-options');
      if (quickOpts) {
        messagesContainer.insertBefore(msgDiv, quickOpts);
      } else {
        messagesContainer.appendChild(msgDiv);
      }
      
      scrollToBottom();
    }

    // Simulate typing indicator
    function showTypingIndicator() {
      let bubble = document.createElement('div');
      bubble.classList.add('ka-chatbot-typing-bubble');
      bubble.id = 'ka-chatbot-typing-indicator';
      
      for (let i = 0; i < 3; i++) {
        let dot = document.createElement('div');
        dot.classList.add('ka-chatbot-typing-dot');
        bubble.appendChild(dot);
      }
      
      let quickOpts = messagesContainer.querySelector('.ka-chatbot-quick-options');
      if (quickOpts) {
        messagesContainer.insertBefore(bubble, quickOpts);
      } else {
        messagesContainer.appendChild(bubble);
      }
      scrollToBottom();
    }

    function removeTypingIndicator() {
      let indicator = document.getElementById('ka-chatbot-typing-indicator');
      if (indicator) {
        indicator.parentNode.removeChild(indicator);
      }
    }

    // Keyword responder mapping
    function getBotResponse(userMsg, isTyped) {
      if (isTyped) {
        return "We'll be live soon!";
      }

      let msg = userMsg.toLowerCase().trim();
      
      if (botResponses[msg]) {
        return botResponses[msg];
      }
      
      // Fallback searches
      if (msg.indexOf('sleep') > -1) {
        return botResponses["how can i improve sleep?"];
      }
      if (msg.indexOf('agni') > -1 || msg.indexOf('digest') > -1) {
        return botResponses["what is agni?"];
      }
      if (msg.indexOf('pitta') > -1) {
        return botResponses["cooling recipes for pitta"];
      }
      if (msg.indexOf('vaidya') > -1 || msg.indexOf('doctor') > -1 || msg.indexOf('speak') > -1) {
        return botResponses["i want to speak with a vaidya."];
      }
      
      return "Pranam! Ayurveda teaches us to seek balance through custom diet, herbs, and daily routines. Try selecting one of our quick questions for verified Ayurvedic guides.";
    }

    let isBotResponding = false;
    let chatbotQueue = [];

    // Process question helper
    function processQuestion(questionText, isTyped) {
      if (isBotResponding) {
        chatbotQueue.push({ text: questionText, isTyped: isTyped });
        addMessage(questionText, 'user');
        return;
      }

      isBotResponding = true;
      addMessage(questionText, 'user');
      showTypingIndicator();
      
      setTimeout(function () {
        removeTypingIndicator();
        let response = getBotResponse(questionText, isTyped);
        addMessage(response, 'bot');
        isBotResponding = false;
        
        if (chatbotQueue.length > 0) {
          let nextQ = chatbotQueue.shift();
          showTypingForQueue(nextQ.text, nextQ.isTyped);
        }
      }, 2000);
    }

    function showTypingForQueue(questionText, isTyped) {
      isBotResponding = true;
      showTypingIndicator();
      
      setTimeout(function () {
        removeTypingIndicator();
        let response = getBotResponse(questionText, isTyped);
        addMessage(response, 'bot');
        isBotResponding = false;
        
        if (chatbotQueue.length > 0) {
          let nextQ = chatbotQueue.shift();
          showTypingForQueue(nextQ.text, nextQ.isTyped);
        }
      }, 2000);
    }

    // Form submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      let text = input.value.trim();
      if (!text) return;
      
      input.value = '';
      processQuestion(text, true);
    });

    // Quick option clicks
    messagesContainer.addEventListener('click', function (e) {
      if (e.target.classList.contains('ka-chatbot-option-btn')) {
        let question = e.target.getAttribute('data-question');
        if (question) {
          let siblings = Array.prototype.slice.call(e.target.parentNode.children);
          let btnIndex = siblings.indexOf(e.target);
          if (btnIndex >= 0 && btnIndex < 3) {
            if (backupQuestions.length > 0) {
              let nextQ = backupQuestions[backupIndex % backupQuestions.length];
              backupIndex++;
              e.target.textContent = nextQ;
              e.target.setAttribute('data-question', nextQ);
            }
          }
          processQuestion(question, false);
        }
      }
    });
  }


  // ============================================================
  // 9. TOC TOGGLE — Drop down and collapse sidebar Table of Contents
  // ============================================================
  // 10. TOC TOGGLE — Desktop Table of Contents Collapse / Expand
  // ============================================================
  function initTocToggle() {
    document.addEventListener('click', function (e) {
      let toggle = e.target.closest('.vaidyam-article-toc-toggle, .vaidyam-article-toc-header, .vaidyam-article-toc-card h3');
      if (!toggle) return;

      let card = toggle.closest('.vaidyam-article-toc-card') || document.querySelector('.vaidyam-article-toc-card');
      if (!card) return;

      let list = card.querySelector('.ka-article-sidebar__list');
      let isCollapsed = card.classList.contains('toc-is-collapsed');

      if (isCollapsed) {
        card.classList.remove('toc-is-collapsed');
        if (list) list.classList.remove('ka-collapsed');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        card.classList.add('toc-is-collapsed');
        if (list) list.classList.add('ka-collapsed');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ============================================================
  // 11. COMMENTS — Expanding composer, formatting, popup fields
  // ============================================================
  function initComments() {
    let textarea = document.getElementById('ka-comment-body');
    let composer = document.getElementById('ka-comment-composer');
    let container = document.querySelector('.ka-comment-textarea-container');
    let cancelBtn = document.querySelector('.ka-comment-btn-cancel');
    let nextBtn = document.querySelector('.ka-comment-btn-next');
    let popupCard = document.querySelector('.ka-comment-popup-card');
    let popupClose = document.querySelector('.ka-comment-popup-close');
    let formatBtns = document.querySelectorAll('.ka-comment-format-btn');

    if (!composer || !textarea || !container) return;

    let chatbotTrigger = document.getElementById('ka-chatbot-trigger');
    let authorInput = document.getElementById('ka-comment-author');
    let emailInput = document.getElementById('ka-comment-email');

    function hideChatbot() {
      if (window.innerWidth < 980 && chatbotTrigger) {
        chatbotTrigger.classList.add('ka-hidden');
      }
    }

    function showChatbot() {
      if (chatbotTrigger) {
        chatbotTrigger.classList.remove('ka-hidden');
      }
    }

    composer.addEventListener('focus', hideChatbot);
    if (authorInput) authorInput.addEventListener('focus', hideChatbot);
    if (emailInput) emailInput.addEventListener('focus', hideChatbot);

    function checkActiveFocus() {
      setTimeout(function() {
        if (
          document.activeElement !== composer &&
          document.activeElement !== authorInput &&
          document.activeElement !== emailInput &&
          !container.classList.contains('is-expanded')
        ) {
          showChatbot();
        }
      }, 150);
    }

    composer.addEventListener('blur', checkActiveFocus);
    if (authorInput) authorInput.addEventListener('blur', checkActiveFocus);
    if (emailInput) emailInput.addEventListener('blur', checkActiveFocus);

    // 1. Focus expansion, clicking container, & synchronization
    composer.addEventListener('focus', function () {
      container.classList.add('is-expanded');
      hideChatbot();
    });

    container.addEventListener('click', function (e) {
      if (!e.target.closest('.ka-comment-controls') && !e.target.closest('.ka-comment-popup-card')) {
        composer.focus();
      }
    });

    composer.addEventListener('input', function () {
      textarea.value = composer.innerHTML;
    });

    // Helper to update bold/italic button active highlights
    function updateFormatStates() {
      try {
        formatBtns.forEach(function (btn) {
          let format = btn.getAttribute('data-format');
          if (document.queryCommandState && document.queryCommandState(format)) {
            btn.classList.add('is-active');
          } else {
            btn.classList.remove('is-active');
          }
        });
      } catch (err) {
        console.warn('Failed to query command state:', err);
      }
    }

    composer.addEventListener('keyup', updateFormatStates);
    composer.addEventListener('mouseup', updateFormatStates);
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === composer) {
        updateFormatStates();
      }
    });

    // 2. Formatting Bold & Italic click events
    formatBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        composer.focus();
        let format = btn.getAttribute('data-format');
        document.execCommand(format, false, null);
        updateFormatStates();
        textarea.value = composer.innerHTML;
      });
    });

    // Helper to toggle empty box height when details popup opens/closes
    function updateEmptyBoxHeight() {
      let emptyBox = document.querySelector('.vaidyam-article-comments-empty');
      if (!emptyBox) return;
      if (popupCard && !popupCard.classList.contains('ka-comment-popup-hidden')) {
        emptyBox.classList.add('popup-is-open');
      } else {
        emptyBox.classList.remove('popup-is-open');
      }
    }

    // 3. Cancel button action
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        composer.innerHTML = '';
        textarea.value = '';
        container.classList.remove('is-expanded');
        if (popupCard) popupCard.classList.add('ka-comment-popup-hidden', 'ka-hidden');
        if (nextBtn) nextBtn.classList.remove('ka-hidden');
        updateEmptyBoxHeight();
        showChatbot();
      });
    }

    // 4. Next/Comment button action (triggers name/email popup)
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        let commentText = composer.innerText.trim();
        if (!commentText) {
          composer.focus();
          return;
        }
        textarea.value = composer.innerHTML;
        if (popupCard) {
          popupCard.classList.remove('ka-comment-popup-hidden', 'ka-hidden');
          nextBtn.classList.add('ka-hidden');
          updateEmptyBoxHeight();
          popupCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // 5. Popup Close action
    if (popupClose) {
      popupClose.addEventListener('click', function (e) {
        e.preventDefault();
        if (popupCard) {
          popupCard.classList.add('ka-comment-popup-hidden', 'ka-hidden');
        }
        if (nextBtn) nextBtn.classList.remove('ka-hidden');
        updateEmptyBoxHeight();
      });
    }

    // 6. Click outside to collapse if empty
    document.addEventListener('click', function (e) {
      if (!container.contains(e.target) && (!popupCard || !popupCard.contains(e.target))) {
        if (!composer.innerText.trim()) {
          container.classList.remove('is-expanded');
          if (popupCard) {
            popupCard.classList.add('ka-comment-popup-hidden', 'ka-hidden');
          }
          if (nextBtn) nextBtn.classList.remove('ka-hidden');
          updateEmptyBoxHeight();
        }
      }
    });

    // 7. Form submission AJAX handler
    let commentForm = document.querySelector('form[action*="/comments"], form#comment_form');
    let submitBtn = commentForm ? commentForm.querySelector('.ka-comment-submit-btn') : null;

    function handleCommentSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      textarea.value = composer.innerHTML;
      let authorVal = authorInput ? authorInput.value.trim() : '';
      let emailVal = emailInput ? emailInput.value.trim() : '';
      let bodyVal = textarea.value.trim() || composer.innerText.trim();

      if (!bodyVal) {
        composer.focus();
        return false;
      }
      if (!authorVal) {
        if (authorInput) authorInput.focus();
        return false;
      }
      if (!emailVal) {
        if (emailInput) emailInput.focus();
        return false;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
      }

      let params = new URLSearchParams();
      for (let pair of formData.entries()) {
        params.append(pair[0], pair[1]);
      }
      if (!params.has('form_type')) params.append('form_type', 'new_comment');
      if (!params.has('utf8')) params.append('utf8', '✓');

      fetch(commentForm.action, {
        method: 'POST',
        body: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }).then(function (res) {
        return res.text();
      }).finally(function () {
        composer.innerHTML = '';
        textarea.value = '';
        if (authorInput) authorInput.value = '';
        if (emailInput) emailInput.value = '';
        if (popupCard) {
          popupCard.classList.add('ka-comment-popup-hidden', 'ka-hidden');
        }
        if (nextBtn) nextBtn.classList.remove('ka-hidden');
        container.classList.remove('is-expanded');

        let formNote = commentForm.querySelector('.ka-article-comment-form');
        if (formNote) {
          let existingMsg = formNote.querySelector('.ka-form-success');
          if (existingMsg) existingMsg.remove();

          let successMsg = document.createElement('p');
          successMsg.className = 'ka-article-form-note ka-form-success';
          successMsg.textContent = 'Your comment was posted successfully. Thank you!';
          formNote.insertBefore(successMsg, formNote.firstChild);
          setTimeout(function () {
            successMsg.classList.add('is-fading');
            setTimeout(function () { successMsg.remove(); }, 300);
          }, 6000);
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Post comment';
        }
      });
      return false;
    }

    if (commentForm) {
      commentForm.addEventListener('submit', handleCommentSubmit);
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', handleCommentSubmit);
    }

    // 8. Reverted to native HTML form submission to allow Captcha redirects and anchor-based scrolling.
    if (window.location.hash === '#comments') {
      let commentsSection = document.getElementById('comments');
      if (commentsSection) {
        setTimeout(function () {
          let headerHeight = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--header-height')
          ) || 60;
          let targetPosition = commentsSection.getBoundingClientRect().top + window.pageYOffset;
          let offsetPosition = targetPosition - headerHeight - 30;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }, 300);
      }
    }
  }



  // ============================================================
  // PREMIUM SCROLL ACTIONS (Progress bar, Parallax, reveals)
  // ============================================================
  function initScrollAnimations() {
    // 1. Create and inject scroll progress bar if not exists
    let progressBar = document.querySelector('.ka-scroll-progress-bar');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'ka-scroll-progress-bar';
      document.body.appendChild(progressBar);
    }

    // 2. Track scroll to update progress bar width and apply parallax zoom to hero images
    let ticking = false;
    let heroImages = document.querySelectorAll('.ka-blog-hero__bg, .ka-blog-topic-hero__image-wrap img, .ka-blog-article-hero__image-wrap img');

    function updateScrollEffects() {
      // Update progress bar
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      let docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      let scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = scrollPercent + '%';

      // Parallax zoom for heroes
      heroImages.forEach(function (img) {
        let rect = img.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          let scrolledFromTop = window.pageYOffset;
          img.style.transform = 'translate3d(0, ' + (scrolledFromTop * 0.12) + 'px, 0) scale(' + (1 + scrolledFromTop * 0.00015) + ')';
        }
      });

      // Immediate reveal for Key Takeaways, TOC, and Trust elements on scroll start
      if (scrollTop > 1) {
        if (revealSidebar) revealSidebar.classList.add('is-visible');
        if (revealMobileToc) revealMobileToc.classList.add('is-visible');
        if (revealSummaryCard) revealSummaryCard.classList.add('is-visible');
        if (revealWhyTrustCard) revealWhyTrustCard.classList.add('is-visible');
      }

      if (window.innerWidth >= 980) {
        if (scrollTop > 1) {
          if (revealFirstSection) revealFirstSection.classList.add('is-visible');
        }
      } else {
        let docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0 && (scrollTop / docHeight) >= 0.20) {
          if (revealFirstSection) revealFirstSection.classList.add('is-visible');
        }
      }

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollEffects);
        ticking = true;
      }
    }, { passive: true });

    // First section reveal trigger based on viewport width:
    // - Desktop: Trigger as soon as scroll starts (> 1px)
    // - Mobile: Trigger when scrolled 20% from initial starting position
    let revealSidebar = document.querySelector('.ka-article-sidebar');
    let revealMobileToc = document.querySelector('.vaidyam-article-toc-mobile');
    let revealSummaryCard = document.querySelector('.ka-article-summary-card');
    let revealWhyTrustCard = document.querySelector('.vaidyam-why-trust-card');
    let revealFirstSection = document.querySelector('.reveal-on-scroll');

    // Initial update
    updateScrollEffects();

    // Reveal top fold sections 300ms after initial page load immediately
    setTimeout(function () {
      let sidebar = document.querySelector('.ka-article-sidebar');
      let mobileToc = document.querySelector('.vaidyam-article-toc-mobile');
      let summaryCard = document.querySelector('.ka-article-summary-card');
      let whyTrustCard = document.querySelector('.vaidyam-why-trust-card');
      if (sidebar) sidebar.classList.add('is-visible');
      if (mobileToc) mobileToc.classList.add('is-visible');
      if (summaryCard) summaryCard.classList.add('is-visible');
      if (whyTrustCard) whyTrustCard.classList.add('is-visible');
    }, 300);

    // 3. Scroll reveals via IntersectionObserver
    if ('IntersectionObserver' in window) {
      let carePathSections = document.querySelectorAll(
        '.ka-blog-wrapper--topic .ka-blog-section, ' +
        '.ka-carepath-hero-card, ' +
        '.ka-care-journey-card, ' +
        '.ka-lifestyle-card, ' +
        '.ka-apothecary-card, ' +
        '.ka-care-team-card, ' +
        '.ka-carepath-faq-card'
      );

      if (carePathSections.length > 0) {
        let careObserver = new IntersectionObserver(function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.06,
          rootMargin: '0px 0px -30px 0px'
        });

        carePathSections.forEach(function (el) {
          el.classList.add('ka-carepath-reveal');
          careObserver.observe(el);
        });
      }

      if (!document.querySelector('.ka-blog-topic-hero') && !document.querySelector('.ka-journal-article-section, .article-template, .ka-article-layout') && window.location.pathname.indexOf('/tagged/') === -1) {
        let revealTargets = document.querySelectorAll(
          '.ka-blog-container section, ' +
          '.ka-blog-section, ' +
          '.ka-blog-section--tight, ' +
          '.ka-blog-topic-deck'
        );

        let grids = document.querySelectorAll('.ka-blog-topic-deck');
        grids.forEach(function (grid) {
          let children = grid.children;
          for (let i = 0; i < children.length; i++) {
            let child = children[i];
            child.classList.add('reveal-on-scroll');
            let delayClass = 'reveal-delay-' + ((i % 5) + 1);
            child.classList.add(delayClass);
          }
        });

        revealTargets.forEach(function (el) {
          if (!el.classList.contains('ka-blog-article-grid') && !el.classList.contains('ka-blog-topic-deck')) {
            el.classList.add('reveal-on-scroll');
          }
        });

        let revealObserver = new IntersectionObserver(function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.05,
          rootMargin: '0px 0px -40px 0px'
        });

        document.querySelectorAll('.reveal-on-scroll').forEach(function (el) {
          revealObserver.observe(el);
        });
      }
    }
  }

  // ============================================================
  // RELATED ARTICLES CAROUSEL — Slide behavior on desktop
  // ============================================================
  function initRelatedArticlesCarousel() {
    let sections = document.querySelectorAll('#related, .vaidyam-related-articles-section, .ka-blog-section--tight');
    sections.forEach(function (sec) {
      let prevBtn = sec.querySelector('.ka-blog-topic-arrow--prev, .ka-related-arrow--prev');
      let nextBtn = sec.querySelector('.ka-blog-topic-arrow--next, .ka-related-arrow--next');
      let container = sec.querySelector('.vaidyam-related-articles-carousel-container') || sec.querySelector('.vaidyam-related-articles-track');
      let innerTrack = sec.querySelector('.vaidyam-related-articles-track');
      let nav = sec.querySelector('.vaidyam-related-articles-nav');
      let slides = sec.querySelectorAll('.ka-related-slide');
      let cards = sec.querySelectorAll('.vaidyam-article-card, .ka-article-card');

      if (nav) {
        if (slides.length > 1 || cards.length > 4) {
          nav.style.display = 'flex';
        } else {
          nav.style.display = 'none';
        }
      }
      if (!container || !prevBtn || !nextBtn) return;

      if (!prevBtn._hasRelatedBound) {
        prevBtn._hasRelatedBound = true;
        prevBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          let step = container.clientWidth || 600;
          container.scrollBy({ left: -step, behavior: 'smooth' });
          if (innerTrack && innerTrack !== container) {
            innerTrack.scrollBy({ left: -step, behavior: 'smooth' });
          }
        });
      }

      if (!nextBtn._hasRelatedBound) {
        nextBtn._hasRelatedBound = true;
        nextBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          let step = container.clientWidth || 600;
          container.scrollBy({ left: step, behavior: 'smooth' });
          if (innerTrack && innerTrack !== container) {
            innerTrack.scrollBy({ left: step, behavior: 'smooth' });
          }
        });
      }
    });

    // Global touch/click fallback for mobile & desktop carousel navigation
    document.addEventListener('click', function (e) {
      let arrowBtn = e.target.closest('.ka-blog-topic-arrow, .ka-related-arrow, .ka-product-grid-arrow');
      if (!arrowBtn) return;
      
      arrowBtn.classList.add('is-clicked');
      setTimeout(function() {
        arrowBtn.classList.remove('is-clicked');
      }, 2000);

      let isPrev = arrowBtn.classList.contains('ka-blog-topic-arrow--prev') || arrowBtn.classList.contains('ka-related-arrow--prev') || arrowBtn.classList.contains('ka-product-grid-arrow--prev');
      let isNext = arrowBtn.classList.contains('ka-blog-topic-arrow--next') || arrowBtn.classList.contains('ka-related-arrow--next') || arrowBtn.classList.contains('ka-product-grid-arrow--next');
      if (!isPrev && !isNext) return;

      let parentSection = arrowBtn.closest('section') || arrowBtn.closest('.ka-blog-section--tight') || arrowBtn.closest('.ka-blog-section') || arrowBtn.parentElement.parentElement;
      if (!parentSection) return;

      let container = parentSection.querySelector('.vaidyam-related-articles-carousel-container') || parentSection.querySelector('.vaidyam-related-articles-track') || parentSection.querySelector('.ka-article-product-grid') || parentSection.querySelector('.ka-blog-topic-grid');
      let innerTrack = parentSection.querySelector('.vaidyam-related-articles-track');
      if (!container) return;

      e.preventDefault();
      let slide = container.querySelector('.ka-related-slide, .vaidyam-article-card, .ka-blog-topic-deck');
      let amount = (slide && slide.clientWidth) ? slide.clientWidth : (container.clientWidth || window.innerWidth || 320);
      if (isPrev) {
        container.scrollBy({ left: -amount, behavior: 'smooth' });
        if (innerTrack && innerTrack !== container) {
          innerTrack.scrollBy({ left: -amount, behavior: 'smooth' });
        }
      } else {
        container.scrollBy({ left: amount, behavior: 'smooth' });
        if (innerTrack && innerTrack !== container) {
          innerTrack.scrollBy({ left: amount, behavior: 'smooth' });
        }
      }
    });
  }

  function scrollAccordionIntoView(el) {
    if (!el || window.innerWidth >= 1024) return;
    setTimeout(function () {
      let headerEl = document.querySelector('.theme-header-custom, header, .header-wrapper');
      let navOffset = (headerEl ? headerEl.offsetHeight : 60) + 16;
      let rect = el.getBoundingClientRect();
      let scrollTarget = window.pageYOffset + rect.top - navOffset;
      window.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth'
      });
    }, 120);
  }

  // Why Trust Collapsible Card
  function initWhyTrustCard() {
    document.addEventListener('click', function (e) {
      let header = e.target.closest('.ka-why-trust-header');
      if (!header) return;
      let card = header.closest('.vaidyam-why-trust-card') || document.getElementById('vaidyam-why-trust-card');
      if (!card) return;
      let content = card.querySelector('.ka-why-trust-content');
      if (!content) return;

      let isOpen = card.classList.contains('is-open');
      if (isOpen) {
        card.classList.remove('is-open');
        header.setAttribute('aria-expanded', 'false');
      } else {
        card.classList.add('is-open');
        header.setAttribute('aria-expanded', 'true');
        scrollAccordionIntoView(card);
      }
    });
  }

  function initGlossaryHighlights() {
    let terms = [];
    let glossaryScript = document.getElementById('ka-glossary-data');
    if (glossaryScript && glossaryScript.textContent) {
      try {
        terms = JSON.parse(glossaryScript.textContent) || [];
      } catch (e) {}
    }

    // Collect terms from any rendered glossary cards on the page
    document.querySelectorAll('.ka-article-glossary-card, .ka-glossary-item').forEach(function(card) {
      let titleEl = card.querySelector('.ka-glossary-card-title, .ka-glossary-item-title, h4, h3, strong');
      let descEl = card.querySelector('.ka-glossary-card-desc, .ka-glossary-item-desc, p');
      if (titleEl) {
        let tText = titleEl.textContent.trim();
        let dText = descEl ? descEl.textContent.trim() : '';
        if (tText && dText) {
          terms.push({ term: tText, definition: dText });
        }
      }
    });

    if (!terms.length) {
      return;
    }

    let articleBodies = document.querySelectorAll('.ka-article-content, .ka-article-body, .ka-blog-article-body, .rte, article');
    if (!articleBodies.length) return;

    let highlightedTerms = {};

    terms.sort(function (a, b) {
      return b.term.length - a.term.length;
    });

    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function walk(node) {
      if (node.nodeType === 3) {
        let text = node.nodeValue;
        let parent = node.parentNode;
        if (!parent) return;

        let tag = parent.tagName.toLowerCase();
        if (tag === 'a' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'script' || tag === 'style' || parent.classList.contains('ka-glossary-highlight') || parent.closest('.ka-ingredients-container') || parent.closest('.ka-ingredient-card') || parent.closest('.ka-article-glossary-card') || parent.closest('.ka-expert-card') || parent.closest('#glossary')) {
          return;
        }

        for (let i = 0; i < terms.length; i++) {
          let termObj = terms[i];
          let termText = termObj.term ? termObj.term.trim() : '';
          if (!termText) continue;

          let termKey = termText.toLowerCase();
          if (highlightedTerms[termKey]) continue;

          let regex = new RegExp('\\b(' + escapeRegExp(termText) + ')\\b', 'i');
          let match = regex.exec(text);
          if (match) {
            let matchText = match[0];
            let matchIndex = match.index;

            let span = document.createElement('span');
            span.className = 'ka-glossary-highlight';
            span.textContent = matchText;
            span.setAttribute('data-term', termText);
            let dVal = termObj.short_definition || termObj.definition || termObj.shortDefinition || '';
            span.setAttribute('data-definition', dVal);

            let afterText = text.substring(matchIndex + matchText.length);
            node.nodeValue = text.substring(0, matchIndex);

            if (afterText) {
              let afterNode = document.createTextNode(afterText);
              parent.insertBefore(afterNode, node.nextSibling);
              parent.insertBefore(span, afterNode);
            } else {
              parent.insertBefore(span, node.nextSibling);
            }

            highlightedTerms[termKey] = true;
            break;
          }
        }
      } else if (node.nodeType === 1) {
        let tag = node.tagName.toLowerCase();
        if (tag !== 'a' && tag !== 'h1' && tag !== 'h2' && tag !== 'h3' && tag !== 'h4' && tag !== 'h5' && tag !== 'h6' && tag !== 'script' && tag !== 'style' && !node.classList.contains('ka-expert-card') && !node.classList.contains('ka-ingredients-container')) {
          let children = Array.prototype.slice.call(node.childNodes);
          for (let i = 0; i < children.length; i++) {
            walk(children[i]);
          }
        }
      }
    }

    articleBodies.forEach(function(bodyEl) {
      walk(bodyEl);
    });

    initGlossaryTooltips();
  }

  window.initGlossaryHighlights = initGlossaryHighlights;
  window.initGlossaryTooltips = initGlossaryTooltips;

  function initGlossaryTooltips() {
    let highlights = document.querySelectorAll('.ka-glossary-highlight');
    if (!highlights.length) return;

    function removeAllTooltips() {
      let tooltips = document.querySelectorAll('.ka-glossary-tooltip');
      tooltips.forEach(function (t) {
        if (t.parentNode) t.parentNode.removeChild(t);
      });
      highlights.forEach(function (h) {
        h._tooltip = null;
      });
    }

    highlights.forEach(function (el) {
      el.addEventListener('mouseenter', function (e) {
        if ('ontouchstart' in window || window.innerWidth <= 1024) return;
        showTooltip(el);
      });

      el.addEventListener('mouseleave', function (e) {
        if ('ontouchstart' in window || window.innerWidth <= 1024) return;
        setTimeout(function() {
          hideTooltip(el);
        }, 100);
      });

      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        let wasOpen = !!el._tooltip;
        removeAllTooltips();

        if (!wasOpen) {
          showTooltip(el);
        }
      });
    });

    function showTooltip(el) {
      let term = el.getAttribute('data-term') || el.textContent.trim();
      let definition = el.getAttribute('data-definition') || '';
      if (!definition) return;

      removeAllTooltips();

      let tooltip = document.createElement('div');
      tooltip.className = 'ka-glossary-tooltip is-active';
      tooltip.setAttribute('role', 'tooltip');

      let closeBtn = document.createElement('button');
      closeBtn.className = 'ka-glossary-tooltip-close';
      closeBtn.type = 'button';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        removeAllTooltips();
      });
      tooltip.appendChild(closeBtn);

      let title = document.createElement('strong');
      title.className = 'ka-glossary-tooltip-title';
      title.textContent = term;
      tooltip.appendChild(title);

      let desc = document.createElement('p');
      desc.className = 'ka-glossary-tooltip-desc';
      desc.textContent = definition;
      tooltip.appendChild(desc);

      document.body.appendChild(tooltip);
      el._tooltip = tooltip;

      let rect = el.getBoundingClientRect();
      let tooltipRect = tooltip.getBoundingClientRect();

      let spaceBelow = window.innerHeight - rect.bottom;
      let spaceAbove = rect.top;

      let top, isAbove = false;
      if (spaceBelow >= tooltipRect.height + 14 || spaceBelow >= spaceAbove) {
        top = rect.bottom + 10;
        isAbove = false;
      } else {
        top = rect.top - tooltipRect.height - 10;
        isAbove = true;
      }

      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));

      tooltip.style.position = 'fixed';
      tooltip.style.top = Math.max(10, top) + 'px';
      tooltip.style.left = left + 'px';

      let arrowX = (rect.left + rect.width / 2) - left;
      tooltip.style.setProperty('--arrow-left', Math.max(16, Math.min(arrowX, tooltipRect.width - 16)) + 'px');

      if (isAbove) {
        tooltip.classList.add('ka-tooltip-above');
      } else {
        tooltip.classList.remove('ka-tooltip-above');
      }
    }

    function hideTooltip(el) {
      if (el && el._tooltip && el._tooltip.parentNode) {
        el._tooltip.parentNode.removeChild(el._tooltip);
        el._tooltip = null;
      }
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.ka-glossary-highlight') && !e.target.closest('.ka-glossary-tooltip')) {
        removeAllTooltips();
      }
    });

    window.addEventListener('scroll', function () {
      if (document.querySelector('.ka-glossary-tooltip')) {
        removeAllTooltips();
      }
    }, { passive: true });
  }

  // ============================================================
  // GENERIC SMOOTH SCROLL WITH HEADER OFFSET FOR ANCHOR LINKS
  // ============================================================
  function initAnchorOffsets() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        let targetId = this.getAttribute('href');
        if (targetId === '#' || targetId.length < 2) return;
        let targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          let headerEl = document.querySelector('.theme-header-custom');
          let headerHeight = headerEl ? headerEl.offsetHeight : 60;
          let breadcrumbsWrap = document.querySelector('.theme-header-custom__breadcrumbs-wrap');
          let subnavHeight = breadcrumbsWrap ? breadcrumbsWrap.offsetHeight : 50;
          
          let targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
          let offsetPosition = targetPosition - headerHeight - subnavHeight - 24;
          
          smoothScrollTo(offsetPosition, 350);
          
          if (history.pushState) {
            history.pushState(null, null, targetId);
          } else {
            location.hash = targetId;
          }
        }
      });
    });
  }

  function initInfographicCarousels() {
    document.querySelectorAll('.ka-infographic-carousel-shell').forEach(function (shell) {
      let carousel = shell.querySelector('.ka-infographic-carousel');
      let slides = shell.querySelectorAll('.ka-infographic-carousel-slide');
      let previous = shell.querySelector('.ka-infographic-carousel-arrow--prev');
      let next = shell.querySelector('.ka-infographic-carousel-arrow--next');
      if (!carousel || slides.length < 2) return;

      function activeIndex() {
        let width = carousel.clientWidth || 1;
        return Math.max(0, Math.min(slides.length - 1, Math.round(carousel.scrollLeft / width)));
      }

      function updateButtons() {
        let index = activeIndex();
        if (previous) previous.disabled = index === 0;
        if (next) next.disabled = index === slides.length - 1;
      }

      function move(direction) {
        let index = Math.max(0, Math.min(slides.length - 1, activeIndex() + direction));
        carousel.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
      }

      if (previous) previous.addEventListener('click', function () { move(-1); });
      if (next) next.addEventListener('click', function () { move(1); });
      carousel.addEventListener('scroll', updateButtons, { passive: true });
      updateButtons();

      // Mobile touch swipe gestures
      let touchStartX = 0;
      let touchStartY = 0;

      carousel.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      carousel.addEventListener('touchend', function (e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        let deltaX = e.changedTouches[0].clientX - touchStartX;
        let deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) {
            move(1);
          } else {
            move(-1);
          }
        }
      }, { passive: true });

      // Prevent browser default ghost image drag
      carousel.querySelectorAll('img, video').forEach(function (media) {
        media.addEventListener('dragstart', function (e) {
          e.preventDefault();
        });
      });

      // Mouse drag scrolling on desktop
      let isDown = false;
      let startX = 0;
      let scrollLeftStart = 0;

      carousel.addEventListener('mousedown', function (e) {
        isDown = true;
        carousel.classList.add('is-dragging');
        startX = e.pageX;
        scrollLeftStart = carousel.scrollLeft;
        e.preventDefault();
      });

      carousel.addEventListener('mouseleave', function () {
        if (isDown) {
          isDown = false;
          carousel.classList.remove('is-dragging');
          let index = activeIndex();
          carousel.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
        }
      });

      carousel.addEventListener('mouseup', function () {
        if (isDown) {
          isDown = false;
          carousel.classList.remove('is-dragging');
          let index = activeIndex();
          carousel.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
        }
      });

      carousel.addEventListener('mousemove', function (e) {
        if (!isDown) return;
        e.preventDefault();
        let walk = (e.pageX - startX) * 1.5;
        carousel.scrollLeft = scrollLeftStart - walk;
      });

      // Touch swipe support for mobile
      carousel.addEventListener('touchend', function () {
        setTimeout(updateButtons, 100);
        setTimeout(updateButtons, 300);
      }, { passive: true });
    });
  }

  function initMobileFiltersToggle() {
    document.addEventListener('click', function(e) {
      let header = e.target.closest('.ka-search-filters-title');
      if (header && window.innerWidth < 990) {
        let container = header.closest('.ka-search-filters');
        if (container) {
          container.classList.toggle('is-open');
        }
      }
    });
  }

  function initProductGridNavigation() {
    /* Product grid shells & Related Article shells — arrows inside the shell */
    document.querySelectorAll('.ka-article-product-grid-shell, .vaidyam-related-articles-shell, .vaidyam-related-articles').forEach(function (shell) {
      let grid = shell.querySelector('.ka-article-product-grid, .vaidyam-related-articles-grid, .vaidyam-related-articles-scroll, .ka-article-grid');
      let previous = shell.querySelector('.ka-product-grid-arrow--prev, .ka-related-arrow--prev');
      let next = shell.querySelector('.ka-product-grid-arrow--next, .ka-related-arrow--next');
      if (!grid || !previous || !next) return;

      let cards = grid.querySelectorAll('.ka-blog-product-card, .ka-blog-article-card, .ka-article-card');
      if (cards.length < 2) {
        previous.classList.add('ka-hidden');
        next.classList.add('ka-hidden');
        return;
      }

      function updateButtons() {
        let isAtStart = grid.scrollLeft <= 5;
        let isAtEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 5;
        let hasOverflow = grid.scrollWidth > grid.clientWidth + 5;

        previous.classList.toggle('ka-hidden', !hasOverflow);
        next.classList.toggle('ka-hidden', !hasOverflow);
        previous.disabled = isAtStart;
        next.disabled = isAtEnd;
      }

      previous.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        let cardWidth = cards[0] ? (cards[0].offsetWidth + 16) : (grid.clientWidth * 0.8);
        grid.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      });

      next.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        let cardWidth = cards[0] ? (cards[0].offsetWidth + 16) : (grid.clientWidth * 0.8);
        grid.scrollBy({ left: cardWidth, behavior: 'smooth' });
      });

      grid.addEventListener('scroll', updateButtons, { passive: true });
      window.addEventListener('resize', updateButtons, { passive: true });

      updateButtons();
      setTimeout(updateButtons, 100);
      setTimeout(updateButtons, 400);
      setTimeout(updateButtons, 1000);

      grid.querySelectorAll('img').forEach(function(img) {
        if (!img.complete) {
          img.addEventListener('load', updateButtons, { once: true });
        }
      });
    });


  }

  function initCarePathFAQ() {
    // 1. Native details/summary based FAQs (article pages) with smooth animation
    document.querySelectorAll('details.ka-faq-item').forEach(function(detail) {
      let summary = detail.querySelector('summary.ka-faq-summary') || detail.querySelector('summary');
      let answer = detail.querySelector('.ka-faq-answer');
      if (!summary || !answer) return;

      summary.addEventListener('click', function(e) {
        e.preventDefault();
        let isOpen = detail.open;

        if (isOpen) {
          // Smooth collapse
          let startHeight = answer.offsetHeight;
          let anim = answer.animate([
            { height: startHeight + 'px', opacity: '1' },
            { height: '0px', opacity: '0' }
          ], {
            duration: 250,
            easing: 'cubic-bezier(0.4, 0, 1, 1)'
          });
          anim.onfinish = function() {
            detail.open = false;
            answer.style.height = '';
          };
        } else {
          // Accordion: smoothly close other open FAQs in the same section
          let container = detail.closest('.ka-article-faq, .ka-carepath-faq-list') || detail.parentElement;
          if (container) {
            container.querySelectorAll('details.ka-faq-item[open]').forEach(function(other) {
              if (other !== detail) {
                let otherAnswer = other.querySelector('.ka-faq-answer');
                if (otherAnswer) {
                  let animOther = otherAnswer.animate([
                    { height: otherAnswer.offsetHeight + 'px', opacity: '1' },
                    { height: '0px', opacity: '0' }
                  ], { duration: 200, easing: 'ease' });
                  animOther.onfinish = function() {
                    other.open = false;
                    otherAnswer.style.height = '';
                  };
                } else {
                  other.open = false;
                }
              }
            });
          }

          detail.open = true;
          let endHeight = answer.offsetHeight;
          answer.animate([
            { height: '0px', opacity: '0' },
            { height: endHeight + 'px', opacity: '1' }
          ], {
            duration: 280,
            easing: 'cubic-bezier(0, 0, 0.2, 1)'
          });
        }
      });
    });

    // 2. Button trigger based FAQs (topic & carepath pages)
    let triggers = document.querySelectorAll('.ka-faq-trigger');
    triggers.forEach(function(trigger) {
      trigger.addEventListener('click', function() {
        let expanded = trigger.getAttribute('aria-expanded') === 'true';
        let item = trigger.closest('.ka-faq-item');
        let container = trigger.closest('.ka-carepath-faq-list, .ka-faq-list, section') || document;

        if (!expanded && container) {
          container.querySelectorAll('.ka-faq-item').forEach(function(otherItem) {
            if (otherItem !== item) {
              otherItem.classList.remove('is-open');
              let otherTrigger = otherItem.querySelector('.ka-faq-trigger');
              if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
            }
          });
        }

        trigger.setAttribute('aria-expanded', String(!expanded));
        if (item) {
          item.classList.toggle('is-open', !expanded);
        }
      });
    });
  }

  function initGlossaryToggle() {
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

    if (!window._kaGlossaryToggleInitialized) {
      window._kaGlossaryToggleInitialized = true;
      document.addEventListener('click', function (e) {
        let trigger = e.target.closest('.ka-glossary-header, .ka-glossary-toggle-btn');
        if (!trigger) return;
        let card = trigger.closest('.ka-article-glossary-card, #glossary');
        if (!card) return;
        e.preventDefault();
        let isExpanded = card.classList.toggle('is-expanded');
        let btn = card.querySelector('.ka-glossary-toggle-btn');
        if (btn) {
          btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        }
        if (isExpanded) {
          scrollAccordionIntoView(card);
        }
      });
    }
  }

  // ============================================================
  // GOOGLE MATERIAL RIPPLE MECHANICAL INTERACTION
  // ============================================================
  function initMaterialRipples() {
    let rippleTargets = '.vaidyam-article-card, .vaidyam-topic-card, .ka-image-card, .ka-blog-image-card, .ka-read-next-card, .ka-clinical-link, .ka-blog-btn, .ka-blog-btn--secondary, .ka-faq-trigger, .ka-why-trust-header, .ka-glossary-header, .vaidyam-article-toc-mobile__toggle, .ka-tag-badge, .ka-chatbot-trigger, .ka-filter-link, .ka-custom-search-reset, .ka-blog-path-row, .ka-blog-filter-bar a';
    
    let lastTouchTime = 0;

    document.addEventListener('touchstart', function (e) {
      lastTouchTime = Date.now();
      createRipple(e);
    }, { passive: true });

    document.addEventListener('mousedown', function (e) {
      if (Date.now() - lastTouchTime < 500) return;
      createRipple(e);
    });

    function createRipple(e) {
      let target = e.target.closest(rippleTargets);
      if (!target) return;

      // Strict boundary containment: ensure target clips and bounds the ripple internally
      let computed = window.getComputedStyle(target);
      if (computed.position === 'static') {
        target.style.position = 'relative';
      }
      if (computed.overflow !== 'hidden') {
        target.style.overflow = 'hidden';
      }

      let rect = target.getBoundingClientRect();
      let clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
      let clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;

      let x = clientX - rect.left;
      let y = clientY - rect.top;
      let maxDimension = Math.max(rect.width, rect.height);
      
      let ripple = document.createElement('span');
      ripple.className = 'ka-material-ripple';
      ripple.style.position = 'absolute';
      ripple.style.borderRadius = '50%';
      ripple.style.pointerEvents = 'none';
      ripple.style.width = (maxDimension * 2.2) + 'px';
      ripple.style.height = (maxDimension * 2.2) + 'px';
      ripple.style.left = (x - maxDimension * 1.1) + 'px';
      ripple.style.top = (y - maxDimension * 1.1) + 'px';

      target.appendChild(ripple);

      requestAnimationFrame(function() {
        ripple.classList.add('is-active');
      });

      setTimeout(function() {
        ripple.remove();
      }, 450);
    }
  }

  // ============================================================
  // SPECULATIVE DATA-PREFETCHING FOR INSTANT LOADS
  // ============================================================
  function initSpeculativePrefetch() {
    let navLinks = '.ka-blog-subnav a, .vaidyam-topic-card a, .ka-article-sidebar a, .vaidyam-article-toc-mobile__list a, .ka-read-next-card a';
    let prefetchedUrls = new Set();

    function prefetchUrl(url) {
      if (!url || prefetchedUrls.has(url)) return;
      prefetchedUrls.add(url);

      let linkEl = document.createElement('link');
      linkEl.rel = 'prefetch';
      linkEl.href = url;
      document.head.appendChild(linkEl);
    }

    document.addEventListener('pointerenter', handlePrefetchTrigger, { passive: true });
    document.addEventListener('touchstart', handlePrefetchTrigger, { passive: true });

    function handlePrefetchTrigger(e) {
      if (!e || !e.target || typeof e.target.closest !== 'function') return;
      let link = e.target.closest(navLinks);
      if (!link) return;
      let url = link.getAttribute('href');
      // Prefetch pages, skip internal hash tags
      if (url && url.indexOf('#') === -1 && url.startsWith('/')) {
        prefetchUrl(url);
      }
    }
  }

  // ============================================================
  // INIT — Run all on DOMContentLoaded
  // ============================================================
  function init() {
    try { initSubnav(); } catch(e) { console.error("initSubnav error:", e); }
    try { initArticleTOC(); } catch(e) { console.error("initArticleTOC error:", e); }
    try { initFAQ(); } catch(e) { console.error("initFAQ error:", e); }
    try { initCarePathFAQ(); } catch(e) { console.error("initCarePathFAQ error:", e); }
    try { initGlossaryToggle(); } catch(e) { console.error("initGlossaryToggle error:", e); }
    try { initReadTime(); } catch(e) { console.error("initReadTime error:", e); }
    try { initTopicCarousel(); } catch(e) { console.error("initTopicCarousel error:", e); }
    try { initHeroSearchExploreRedirect(); } catch(e) { console.error("initHeroSearchExploreRedirect error:", e); }
    try { initScopedSearch(); } catch(e) { console.error("initScopedSearch error:", e); }
    try { initAjaxFiltering(); } catch(e) { console.error("initAjaxFiltering error:", e); }
    try { initFloatingCTA(); } catch(e) { console.error("initFloatingCTA error:", e); }
    try { initChatbot(); } catch(e) { console.error("initChatbot error:", e); }
    try { initTocToggle(); } catch(e) { console.error("initTocToggle error:", e); }
    try { initComments(); } catch(e) { console.error("initComments error:", e); }
    try { initScrollAnimations(); } catch(e) { console.error("initScrollAnimations error:", e); }
    try { initRelatedArticlesCarousel(); } catch(e) { console.error("initRelatedArticlesCarousel error:", e); }
    try { initMobileScrollProgressBar(); } catch(e) { console.error("initMobileScrollProgressBar error:", e); }
    try { initWhyTrustCard(); } catch(e) { console.error("initWhyTrustCard error:", e); }
    try { initGlossaryHighlights(); } catch(e) { console.error("initGlossaryHighlights error:", e); }
    try { initAnchorOffsets(); } catch(e) { console.error("initAnchorOffsets error:", e); }
    try { initInfographicCarousels(); } catch(e) { console.error("initInfographicCarousels error:", e); }
    try { initMobileFiltersToggle(); } catch(e) { console.error("initMobileFiltersToggle error:", e); }
    try { initProductGridNavigation(); } catch(e) { console.error("initProductGridNavigation error:", e); }
    try { initJournalSearchAjax(); } catch(e) { console.error("initJournalSearchAjax error:", e); }
    try { initLandingInstantSearch(); } catch(e) { console.error("initLandingInstantSearch error:", e); }
    try { initMaterialRipples(); } catch(e) { console.error("initMaterialRipples error:", e); }
    try { initSpeculativePrefetch(); } catch(e) { console.error("initSpeculativePrefetch error:", e); }
    try { initJournalHeaderDrawer(); } catch(e) { console.error("initJournalHeaderDrawer error:", e); }
    try { initMobileReadAloudScrollTrigger(); } catch(e) { console.error("initMobileReadAloudScrollTrigger error:", e); }
  }

  function initMobileReadAloudScrollTrigger() {
    let triggerBtns = document.querySelectorAll('.vaidyam-read-aloud-component .vaidyam-read-aloud-floating-btn, #vaidyam-read-aloud-trigger, #ka-chatbot-trigger, .ka-chatbot-trigger');
    if (!triggerBtns || !triggerBtns.length) return;

    let keyTakeaways = document.querySelector('#key-takeaways, .ka-key-takeaways-wrapper, .ka-article-summary-card, .ka-article-summary-grid, .ka-key-takeaways-box, #at-a-glance');
    let productsSec = document.querySelector('.ka-article-products, #products, .ka-article-product-grid-shell, .ka-recommended-products, .ka-related-products');
    let referencesSec = document.querySelector('.vaidyam-article-sources, #vaidyam-article-sources, .ka-article-references, .ka-references-card, footer, .theme-footer');

    function checkVisibility() {
      let pastKeyTakeaways = false;
      if (keyTakeaways) {
        let ktRect = keyTakeaways.getBoundingClientRect();
        let ktMidpoint = ktRect.top + (ktRect.height * 0.5);
        pastKeyTakeaways = ktMidpoint <= (window.innerHeight * 0.5);
      } else {
        pastKeyTakeaways = window.pageYOffset >= 500;
      }

      let reachedProducts = false;
      if (productsSec) {
        let prodRect = productsSec.getBoundingClientRect();
        reachedProducts = prodRect.top <= window.innerHeight;
      } else if (referencesSec) {
        let refRect = referencesSec.getBoundingClientRect();
        reachedProducts = refRect.top <= window.innerHeight;
      }

      let shouldShow = pastKeyTakeaways && !reachedProducts;

      triggerBtns.forEach(function(btn) {
        if (shouldShow) {
          btn.classList.remove('ka-hidden');
          btn.classList.add('is-visible-mobile');
        } else {
          btn.classList.add('ka-hidden');
          btn.classList.remove('is-visible-mobile');
        }
      });
    }

    let isTriggerTicking = false;
    function onScrollCheckVisibility() {
      if (!isTriggerTicking) {
        requestAnimationFrame(function () {
          checkVisibility();
          isTriggerTicking = false;
        });
        isTriggerTicking = true;
      }
    }

    window.addEventListener('scroll', onScrollCheckVisibility, { passive: true });
    window.addEventListener('resize', onScrollCheckVisibility, { passive: true });
    checkVisibility();
  }

  function initJournalHeaderDrawer() {
    let header = document.querySelector('.theme-header-custom');
    if (!header) return;

    function setHeaderHeight() {
      let h = header.offsetHeight;
      if (h > 40) {
        document.documentElement.style.setProperty('--theme-header-height', h + 'px');
        document.documentElement.style.setProperty('--header-height', h + 'px');
      }
    }
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight, { passive: true });

    let menuBtn = header.querySelector('.theme-header-custom__menu-btn');
    let drawer = header.querySelector('.theme-header-custom__drawer');
    let closeBtn = header.querySelector('.theme-header-custom__drawer-close');
    let overlay = header.querySelector('.theme-header-custom__drawer-overlay');

    if (!menuBtn || !drawer) return;

    function openMenu() {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden');
    }

    function closeMenu() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
    }

    menuBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init();
    });
  } else {
    init();
  }
})();
