# AccountHop – Account Switcher for Roblox

Switch between your own Roblox accounts in one click. Everything stays on your computer.

*Nederlands: wissel met één klik tussen je eigen Roblox-accounts. Alles blijft op je computer.*

> **Status:** This repository currently contains the popup UI and localization source plus the privacy policy. It is not a complete or installable extension; the manifest, icons, and background service worker are not included. The background code supplied separately stores and restores Roblox `.ROBLOSECURITY` session cookies, which are sensitive login credentials, so it has not been published here.

## Privacy policy

Read [PRIVACY.md](PRIVACY.md). Review the policy against the actual implementation before relying on its statements or submitting it to the Chrome Web Store.

## Files

- `popup.html`, `popup.css`, `popup.js` – popup interface
- `_locales/en/messages.json` – English UI strings
- `PRIVACY.md` – privacy policy (English and Dutch)

The popup expects a background service worker to handle its messages. That service worker is intentionally not present in this repository, so the interface is non-functional by itself.

AccountHop is not affiliated with Roblox Corporation.
