(function () {
  'use strict';

  var YT_HOME = 'https://www.youtube.com/';
  var STORAGE_KEY = 'ytLauncher.playlistUrl';

  // Targets used by manifest shortcuts (e.g. ./?go=subscriptions).
  // Manifest shortcuts must stay inside the app scope, so they point here
  // and this page forwards to the official YouTube URL.
  var GO_TARGETS = {
    home: YT_HOME,
    subscriptions: 'https://www.youtube.com/feed/subscriptions',
    library: 'https://www.youtube.com/feed/library'
  };

  var ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

  function $(id) { return document.getElementById(id); }

  function isOnline() {
    return navigator.onLine !== false;
  }

  function isOfficialYouTubeUrl(value) {
    try {
      var u = new URL(value);
      return u.protocol === 'https:' && ALLOWED_HOSTS.indexOf(u.hostname) !== -1;
    } catch (e) {
      return false;
    }
  }

  // ---- Offline handling -------------------------------------------------
  var banner = $('offline-banner');

  function updateOnlineState() {
    banner.hidden = isOnline();
  }
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();

  // Block navigation to YouTube while offline so the user sees a message
  // instead of a browser error page.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="https://www.youtube.com"]');
    if (link && !isOnline()) {
      event.preventDefault();
      banner.hidden = false;
      banner.scrollIntoView({ block: 'nearest' });
    }
  });

  $('search-form').addEventListener('submit', function (event) {
    if (!isOnline()) {
      event.preventDefault();
      banner.hidden = false;
    }
  });

  // ---- Shortcut forwarding (?go=...) -----------------------------------
  (function handleGoParam() {
    var go;
    try {
      go = new URLSearchParams(location.search).get('go');
    } catch (e) {
      return;
    }
    if (!go || !Object.prototype.hasOwnProperty.call(GO_TARGETS, go)) return;
    if (!isOnline()) return; // stay on the launcher and show the offline message
    location.replace(GO_TARGETS[go]);
  })();

  // ---- User playlist link ----------------------------------------------
  var playlistInput = $('playlist-input');
  var playlistMsg = $('playlist-msg');

  function setMsg(text) { playlistMsg.textContent = text; }

  function readSaved() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }

  function writeSaved(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  var saved = readSaved();
  if (saved && isOfficialYouTubeUrl(saved)) playlistInput.value = saved;

  function validatedInput() {
    var value = playlistInput.value.trim();
    if (!value) { setMsg('Paste a YouTube link first.'); return null; }
    if (!isOfficialYouTubeUrl(value)) {
      setMsg('Only https links on youtube.com or youtu.be are allowed.');
      return null;
    }
    return value;
  }

  $('playlist-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var value = validatedInput();
    if (!value) return;
    if (!isOnline()) { banner.hidden = false; setMsg('You are offline.'); return; }
    setMsg('');
    location.href = value;
  });

  $('playlist-save').addEventListener('click', function () {
    var value = validatedInput();
    if (!value) return;
    setMsg(writeSaved(value) ? 'Saved on this device.' : 'Could not save in this browser.');
  });

  $('playlist-clear').addEventListener('click', function () {
    playlistInput.value = '';
    writeSaved('');
    setMsg('Cleared.');
  });

  // ---- Install prompt (Android/Chromium) and iOS hint ------------------
  var installCard = $('install-card');
  var installBtn = $('install-btn');
  var iosHint = $('ios-hint');
  var deferredPrompt = null;

  var isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isStandalone) {
    if (isIOS) {
      installCard.hidden = false;
      iosHint.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      installCard.hidden = false;
      installBtn.hidden = false;
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.hidden = true;
        installCard.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      installCard.hidden = true;
    });
  }

  // ---- Service worker ---------------------------------------------------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      // Relative path so it works under /repository-name/ on GitHub Pages.
      navigator.serviceWorker.register('service-worker.js').catch(function () {
        /* The launcher still works without a service worker. */
      });
    });
  }
})();
