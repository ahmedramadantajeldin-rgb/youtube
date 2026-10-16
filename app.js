/* YouTube Shortcut PWA - Core Logic & Shorts Interceptor */
(function () {
  'use strict';

  var STORAGE_KEY_FEED = 'yt_pwa_default_feed';
  var STORAGE_KEY_PLAYLIST = 'yt_pwa_saved_url';

  var FEEDS = {
    home: 'https://www.youtube.com/',
    subscriptions: 'https://www.youtube.com/feed/subscriptions',
    library: 'https://www.youtube.com/feed/library'
  };

  function getPreferredFeedKey() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY_FEED);
      if (saved && FEEDS[saved]) return saved;
    } catch (e) {}
    return 'subscriptions'; // Default to Subscriptions to avoid algorithmic Shorts shelf
  }

  function getPreferredFeedUrl() {
    return FEEDS[getPreferredFeedKey()] || FEEDS.subscriptions;
  }

  function isStandaloneMode() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'standalone') return true;
    if (window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches
    )) {
      return true;
    }
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function parseYouTubeUrl(input) {
    if (!input || typeof input !== 'string') return null;
    var trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    try {
      var u = new URL(trimmed);
      var host = u.hostname.toLowerCase();
      var isYt = (
        host === 'youtube.com' ||
        host === 'www.youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtu.be'
      );
      if (!isYt) return null;

      // Detect Shorts URL: /shorts/{id}
      var shortsMatch = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{5,})/);
      if (shortsMatch) {
        return {
          isShorts: true,
          videoId: shortsMatch[1],
          originalUrl: u.href,
          standardUrl: 'https://www.youtube.com/watch?v=' + encodeURIComponent(shortsMatch[1])
        };
      }

      // Normalize mobile host m.youtube.com -> www.youtube.com if desired
      return {
        isShorts: false,
        videoId: u.searchParams.get('v') || null,
        originalUrl: u.href,
        standardUrl: u.href
      };
    } catch (e) {
      return null;
    }
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {});
    });
  }

  // Prevent pull-to-refresh / overscroll trigger at top of page
  var touchStartY = 0;
  window.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (!e.touches || e.touches.length !== 1) return;
    var currentY = e.touches[0].clientY;
    var isScrollingUp = currentY > touchStartY;
    if (window.scrollY <= 0 && isScrollingUp && e.cancelable) {
      e.preventDefault();
    }
  }, { passive: false });

  // Immediate Launch / Redirect check before DOM paints
  var params = new URLSearchParams(window.location.search);
  var goParam = params.get('go');
  var urlParam = params.get('url');
  var standalone = isStandaloneMode();

  if (standalone) {
    document.documentElement.classList.add('is-standalone');
  }

  // Determine if we should immediately redirect
  var targetRedirect = null;
  var interceptedShorts = null;

  if (urlParam) {
    var parsedParam = parseYouTubeUrl(urlParam);
    if (parsedParam) {
      if (parsedParam.isShorts) {
        interceptedShorts = parsedParam;
      } else {
        targetRedirect = parsedParam.standardUrl;
      }
    }
  } else if (goParam && FEEDS[goParam]) {
    targetRedirect = FEEDS[goParam];
  } else if (standalone && !params.has('setup')) {
    targetRedirect = getPreferredFeedUrl();
  }

  if (targetRedirect && navigator.onLine !== false) {
    window.location.replace(targetRedirect);
    return;
  }

  // DOM Interactive Setup
  window.addEventListener('DOMContentLoaded', function () {
    var offlineBanner = document.getElementById('offline-banner');
    var resumeSection = document.getElementById('resume');
    var resumeMsg = document.getElementById('resume-msg');
    var resumeOpen = document.getElementById('resume-open');

    function updateOnlineStatus() {
      var online = navigator.onLine !== false;
      if (offlineBanner) offlineBanner.hidden = online;
      if (standalone && online && targetRedirect) {
        window.location.replace(targetRedirect);
      }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // If running in standalone and didn't redirect (e.g. offline), show resume view
    if (standalone && !params.has('setup') && !interceptedShorts) {
      if (resumeSection) resumeSection.hidden = false;
      if (resumeOpen) resumeOpen.href = targetRedirect || getPreferredFeedUrl();
      if (resumeMsg) {
        resumeMsg.hidden = false;
        resumeMsg.textContent = navigator.onLine === false
          ? 'Waiting for connection to open YouTube...'
          : 'Tap below to continue to YouTube.';
      }
    }

    // Default Launch Feed radio controls
    var radioHome = document.getElementById('pref-feed-home');
    var radioSubs = document.getElementById('pref-feed-subs');
    var prefMsg = document.getElementById('pref-msg');
    var currentPref = getPreferredFeedKey();

    if (radioHome && radioSubs) {
      radioHome.checked = (currentPref === 'home');
      radioSubs.checked = (currentPref === 'subscriptions');

      function onFeedChange(e) {
        var val = e.target.value;
        try {
          localStorage.setItem(STORAGE_KEY_FEED, val);
          if (prefMsg) {
            prefMsg.textContent = 'Saved! Launching from Home Screen will open ' +
              (val === 'subscriptions' ? 'Subscriptions (No Home Shorts).' : 'YouTube Home.');
          }
          if (resumeOpen) resumeOpen.href = getPreferredFeedUrl();
        } catch (err) {}
      }
      radioHome.addEventListener('change', onFeedChange);
      radioSubs.addEventListener('change', onFeedChange);
    }

    // Install Prompt Handling
    var installCard = document.getElementById('install-card');
    var installBtn = document.getElementById('install-btn');
    var iosHint = document.getElementById('ios-hint');
    var deferredPrompt = null;

    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);

    if (isIOS && !standalone) {
      if (installCard) installCard.hidden = false;
      if (iosHint) iosHint.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (installCard) installCard.hidden = false;
      if (installBtn) installBtn.hidden = false;
    });

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          installBtn.hidden = true;
        });
      });
    }

    // Device Environment Detection & Guidance
    var detectedNameEl = document.getElementById('detected-device-name');
    var adviceAndroid = document.getElementById('advice-android');
    var adviceIos = document.getElementById('advice-ios');
    var adviceDesktop = document.getElementById('advice-desktop');

    var isBrave = (navigator.brave && typeof navigator.brave.isBrave === 'function') || /Brave/i.test(ua);

    function setDeviceGuidance(envLabel, showEl) {
      if (detectedNameEl) detectedNameEl.textContent = envLabel;
      if (adviceAndroid) adviceAndroid.hidden = (showEl !== adviceAndroid);
      if (adviceIos) adviceIos.hidden = (showEl !== adviceIos);
      if (adviceDesktop) adviceDesktop.hidden = (showEl !== adviceDesktop);
    }

    if (isAndroid) {
      setDeviceGuidance(isBrave ? 'Android (Brave Browser)' : 'Android Mobile Browser', adviceAndroid);
    } else if (isIOS) {
      setDeviceGuidance('iOS / iPadOS', adviceIos);
    } else {
      setDeviceGuidance('Desktop Browser', adviceDesktop);
    }

    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      navigator.brave.isBrave().then(function (braveDetected) {
        if (braveDetected && isAndroid && detectedNameEl) {
          detectedNameEl.textContent = 'Android (Brave Browser)';
        }
      }).catch(function () {});
    }

    // Playlist / Video Link & Shorts Interceptor
    var playlistForm = document.getElementById('playlist-form');
    var playlistInput = document.getElementById('playlist-input');
    var playlistSave = document.getElementById('playlist-save');
    var playlistClear = document.getElementById('playlist-clear');
    var playlistMsg = document.getElementById('playlist-msg');
    var shortsNotice = document.getElementById('shorts-notice');
    var shortsConvertBtn = document.getElementById('shorts-convert-btn');
    var shortsFeedBtn = document.getElementById('shorts-feed-btn');

    var pendingShortsObj = interceptedShorts;

    function showShortsNotice(shortsObj) {
      pendingShortsObj = shortsObj;
      if (shortsNotice) shortsNotice.hidden = false;
      if (playlistMsg) playlistMsg.textContent = 'Shorts URL intercepted before opening.';
    }

    function hideShortsNotice() {
      pendingShortsObj = null;
      if (shortsNotice) shortsNotice.hidden = true;
    }

    if (interceptedShorts) {
      document.documentElement.classList.remove('is-standalone');
      if (playlistInput) playlistInput.value = interceptedShorts.originalUrl;
      showShortsNotice(interceptedShorts);
    } else {
      try {
        var savedUrl = localStorage.getItem(STORAGE_KEY_PLAYLIST);
        if (savedUrl && playlistInput) playlistInput.value = savedUrl;
      } catch (e) {}
    }

    if (shortsConvertBtn) {
      shortsConvertBtn.addEventListener('click', function () {
        if (pendingShortsObj && pendingShortsObj.standardUrl) {
          window.location.href = pendingShortsObj.standardUrl;
        }
      });
    }

    if (shortsFeedBtn) {
      shortsFeedBtn.addEventListener('click', function () {
        window.location.href = getPreferredFeedUrl();
      });
    }

    if (playlistForm) {
      playlistForm.addEventListener('submit', function (e) {
        e.preventDefault();
        hideShortsNotice();
        var raw = playlistInput ? playlistInput.value : '';
        var parsed = parseYouTubeUrl(raw);
        if (!parsed) {
          if (playlistMsg) playlistMsg.textContent = 'Please enter a valid YouTube URL.';
          return;
        }
        if (parsed.isShorts) {
          showShortsNotice(parsed);
          return;
        }
        window.location.href = parsed.standardUrl;
      });
    }

    if (playlistSave) {
      playlistSave.addEventListener('click', function () {
        hideShortsNotice();
        var raw = playlistInput ? playlistInput.value : '';
        var parsed = parseYouTubeUrl(raw);
        if (!parsed) {
          if (playlistMsg) playlistMsg.textContent = 'Enter a valid YouTube URL to save.';
          return;
        }
        if (parsed.isShorts) {
          showShortsNotice(parsed);
          if (playlistMsg) playlistMsg.textContent = 'Shorts URLs cannot be saved directly. Convert to standard video first.';
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY_PLAYLIST, parsed.standardUrl);
          if (playlistInput) playlistInput.value = parsed.standardUrl;
          if (playlistMsg) playlistMsg.textContent = 'Saved to this device.';
        } catch (e) {}
      });
    }

    if (playlistClear) {
      playlistClear.addEventListener('click', function () {
        hideShortsNotice();
        if (playlistInput) playlistInput.value = '';
        try {
          localStorage.removeItem(STORAGE_KEY_PLAYLIST);
          if (playlistMsg) playlistMsg.textContent = 'Cleared saved link.';
        } catch (e) {}
      });
    }

    // Copy Cosmetic Filter Rules button
    var copyFiltersBtn = document.getElementById('copy-filters-btn');
    var filterRulesCode = document.getElementById('filter-rules-code');
    var copyStatus = document.getElementById('copy-status');

    if (copyFiltersBtn && filterRulesCode) {
      copyFiltersBtn.addEventListener('click', function () {
        var text = filterRulesCode.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            if (copyStatus) copyStatus.textContent = 'Filter rules copied to clipboard!';
          }).catch(function () {
            if (copyStatus) copyStatus.textContent = 'Could not copy automatically. Please select and copy manually.';
          });
        }
      });
    }
  });
})();
