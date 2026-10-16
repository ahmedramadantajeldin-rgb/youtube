# YouTube Launcher (PWA)

A tiny, installable Progressive Web App that gives you a Home Screen icon and a clean mobile launcher for the **official YouTube website** (https://www.youtube.com/).

It is **only a launcher**. It does not recreate YouTube, proxy it, embed it, download videos, or touch your account. Videos, sign-in, subscriptions, playlists, comments and search are all provided by youtube.com itself.

> This is an unofficial launcher and is not affiliated with YouTube or Google. The icon is a generic play symbol, not YouTube's logo. Replace the files in `icons/` with your own artwork if you like (keep the same names and sizes).

## What's in the project

```
youtube-pwa/
├── index.html           Launcher page (prominent "Open YouTube" button + shortcuts)
├── styles.css           Mobile-first styling (safe areas, 48px touch targets)
├── app.js               Offline message, shortcuts, install prompt, SW registration
├── manifest.json        PWA manifest (name "YouTube", standalone, icons, shortcuts)
├── service-worker.js    Minimal cache for this app's own files only
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-512-maskable.png
│   └── apple-touch-icon.png   (180×180, used by iPhone Home Screen)
└── README.md
```

All paths are **relative**, so the app works both at a domain root and inside a GitHub repository subfolder such as `https://USER.github.io/REPO/`.

## Important limitations (please read)

- **It is a launcher, not a YouTube client.** A PWA hosted on your own domain cannot control, inject into, or register a service worker for youtube.com.
- **YouTube may not stay inside the app window.** When you tap *Open YouTube*, Android or iOS decides what happens: it may open in the same standalone window, in your browser, or hand off to the installed YouTube app. This launcher cannot force one behavior. Behavior differs between devices, browsers and OS versions.
- **No offline videos.** Offline, only the launcher page itself loads, with a message saying you're offline. YouTube content is never cached.
- **Install support varies.** Android Chrome and other Chromium browsers support the install flow; iPhone uses Safari's *Add to Home Screen*. Other browsers may only offer a plain bookmark.
- **Playlist link** (optional field): saved with `localStorage` on your device only, never sent anywhere. Only `https` links on `youtube.com` / `youtu.be` are accepted.

## Privacy and safety

- No analytics, no tracking, no third-party scripts, fonts or libraries.
- No passwords, cookies or tokens are read or stored.
- The service worker only handles requests to its own origin; all YouTube traffic bypasses it entirely.

## Deploy with GitHub Pages

1. **Arrange the files.** Keep the folder structure exactly as shown above. `index.html` must be at the top level of the repository (not inside an extra folder).
2. **Upload to GitHub.**
   - Sign in at https://github.com and click **New repository**. Name it, for example, `youtube-launcher`, set it to **Public**, and create it.
   - On the repo page click **Add file → Upload files**, drag in *the contents* of the project folder (including the `icons` folder), and click **Commit changes**.
   - Or from a terminal:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/USER/youtube-launcher.git
     git push -u origin main
     ```
3. **Enable GitHub Pages.** In the repo go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, select branch **main** and folder **/ (root)**, then **Save**.
4. **Get your HTTPS URL.** After a minute or two the page shows your address: `https://USER.github.io/youtube-launcher/`. (Pages serves HTTPS automatically; PWAs require it.)
5. **Install on Android (Chrome).**
   - Open your URL in Chrome.
   - Tap the **Install on this device** button on the page, or open the Chrome menu (⋮) and choose **Install app** / **Add to Home screen**.
   - Launch it from your Home Screen. Long-press the icon for the Home, Subscriptions and Library shortcuts.
6. **Add to Home Screen on iPhone (Safari).**
   - Open your URL in **Safari** (other iOS browsers may not offer this).
   - Tap the **Share** button, then **Add to Home Screen**, then **Add**.
7. **Update the app after changing files.**
   - Edit and re-upload (or push) the changed files.
   - In `service-worker.js`, change `var VERSION = 'v1';` to `'v2'` (and so on). This makes phones fetch the new files.
   - Close and reopen the app once or twice; the new version activates on the next launch. If it still looks old, clear the site's data in the browser settings, or remove and re-add the app.

## Troubleshooting

| Problem | What to try |
|---|---|
| No install option on Android | Use Chrome, open the **https** URL (not `http`), wait for the page to finish loading, and reload once so the service worker registers. |
| Icon or name looks old after an update | Bump `VERSION` in `service-worker.js`, then remove and re-add the Home Screen icon. Android caches the icon at install time. |
| Blank page or 404 on GitHub Pages | Confirm `index.html` is at the repo root, Pages is set to branch **main** / **root**, and wait a couple of minutes after the first deploy. |
| Old files keep showing | Bump `VERSION`, hard-refresh in the browser, or clear site data. |
| YouTube opens in the browser or the YouTube app | Expected. The OS chooses; a launcher cannot control it. |
| "You appear to be offline" message | Check your connection. The launcher cannot play videos offline. |
| iPhone has no install button | iOS never shows one. Use Safari → Share → Add to Home Screen. |

## Testing note

The files were checked for valid JSON, correct icon sizes, matching file references, JavaScript syntax, and successful serving from both a root path and a subfolder path. The install prompt, standalone window behavior, and how Android/iOS hand off youtube.com links depend on the physical device and cannot be verified without one, so please test on your phone after deploying.
