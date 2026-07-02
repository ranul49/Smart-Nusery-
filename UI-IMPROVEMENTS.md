# Smart Cassava Nursery — UI Improvement Plan

A full review of the React Native app (`app/src/`), every screen and component.
Grouped by theme, with a prioritized shortlist at the end.

---

## 1. Trust & data reliability

These matter most: this is a monitoring app, so the farmer's trust in the
numbers is the product.

### 1.1 "Connection lost / data stale" indicator ⭐
If the backend or WebSocket drops **after** the first load, the Dashboard
silently keeps showing frozen values — `Dashboard.js` catches the fetch error
but displays nothing once data exists. Add a slim amber banner
("Reconnecting… data may be stale") and a "last updated Xs ago" line on the
Dashboard (Live already has one). Expose a `connected` flag from
`useLive.js` to drive it.

### 1.2 Fix chart auto-scaling that exaggerates noise ⭐
`charts.js` scales the y-axis from the data's min to max. Humidity holding
steady between 88.9–89.1% renders as violent swings — the farmer reads
"unstable nursery" when conditions are perfect. Enforce a minimum y-span per
metric (e.g. never less than a few units) and print min/max values on the
left edge so the shape has a scale.

### 1.3 Save feedback for threshold changes
In `Settings.js`, every stepper tap fires an API call whose error is silently
discarded (`catch(() => {})`). A farmer offline could "change" the humidity
threshold and walk away believing the automation was updated. Add a small
"Saved ✓ / Couldn't save" indicator and debounce the taps (five quick taps
currently send five requests).

### 1.4 Critical alerts are silent
The critical toast appears and vanishes after ~5s with no vibration, sound, or
system notification. Phone in a pocket = BREACH missed (SMS is the backstop,
but the app should try too). Minimum: `Vibration.vibrate()` on critical
alerts. Fuller: `expo-notifications` local push when backgrounded — which
would also give the Settings "Notifications" toggle something real to control.

---

## 2. Navigation & app shell

### 2.1 Android hardware back button ⭐
Navigation is pure state (`tab` / `overlay` in `App.js`), so the hardware back
button exits the app instead of closing the Live/System/SMS overlay — and
you're shipping APKs. Add a `BackHandler` hook: close overlay first, then
return to Home tab, then exit.

### 2.2 Unread-alert badge on the bottom nav
The Alerts tab looks identical with 0 or 5 critical alerts. Add a red count
dot on the bell icon, and make the critical toast tappable to jump to the
Alerts tab instead of only auto-dismissing.

### 2.3 Session restore races the splash screen
The splash dismisses after a fixed 2.4s while `api.me()` restores the session
in parallel (`App.js`). On a slow connection the splash finishes first and a
logged-in user is dumped at the Login screen. Hold the splash until the
restore settles (with a timeout) so "Remember me" is reliable.

### 2.4 Pull-to-refresh
Screens poll on a 6s timer but there's no `RefreshControl`. Farmers will
instinctively swipe down after an alert. ~10 lines in the shared `Screen`
component (`ui.js`) fixes every screen at once.

---

## 3. Dead or misleading controls

Controls that look functional but aren't — the kind of thing that hurts
credibility in a demo or supervisor review.

- **Analytics "Export Report" button does nothing** — `onPress={() => {}}`
  (`Analytics.js:70`). Wire it to the certification export Reports already
  has, or navigate to the Reports tab.
- **Dark mode toggle has no effect** — Settings flips local state but the
  color tokens are static. Implement a dark palette (the tokens file makes
  this easy — swap one `C` object) or remove the toggle.
- **Language selector saves but doesn't translate** — English/Yoruba/Hausa
  persist to the backend, yet every UI string is hardcoded English. Given the
  farmer audience this is the highest-impact *real feature*: even translating
  just Dashboard, Alerts, and SMS preview makes the setting genuinely useful.
- **"Forgot password?" on Login is plain text, not tappable** — wire it to
  something (even an info dialog: "Contact your extension officer") or drop it.
- **Misleading Analytics range labels** — "Month" and "Growth Cycle" both
  fetch the same 7-day window; "Week" fetches 24h. Rename the chips to match
  the data actually shown.
- **Live screen honesty nit** — says "refresh every 5s" but the trend
  refetches every 15s.

---

## 4. Farmer-friendly presentation

- **Gauge safe zones** ⭐ — `Gauge270` shows the value but nothing marks where
  "good" is. Draw the optimal band as a faint green arc on the track, driven
  by the actual thresholds from Settings, so every gauge is self-explanatory.
- **Time-aware greeting** — Dashboard always says "Good morning," even at
  4 pm. Trivial fix, disproportionate polish.
- **Live trend metric toggle** — the Live chart only ever plots humidity;
  add a temp / humidity / soil toggle.
- **Skeleton loaders** — replace plain "Loading nursery…" text with skeleton
  cards so first load feels intentional.
- **FAB overlap** — the "Scan Device" FAB can cover the last Dashboard button
  on short screens; add bottom padding or hide FAB on scroll.

---

## 5. Polish & accessibility

- **No animation anywhere** — the toast pops in with no transition, gauges
  jump between values, tab switches are hard cuts. Built-in
  `LayoutAnimation` + an animated gauge sweep moves the feel from "student
  project" to "product" for very little code.
- **No accessibility labels** — no `accessibilityLabel` or roles on any
  button, toggle, or gauge; the app is invisible to screen readers. At least
  cover the interactive elements.

---

## Prioritized shortlist

| # | Improvement | Why first | Effort |
|---|------------|-----------|--------|
| 1 | Stale-data / reconnecting banner (1.1) | Trust in the numbers is the product | Small |
| 2 | Android back button (2.1) | Most jarring real-device bug; APKs are shipping | Small |
| 3 | Chart y-scaling fix (1.2) | Stops the app lying about stability | Small |
| 4 | Gauge safe zones (4) | Biggest at-a-glance usability win for farmers | Small–Med |
| 5 | Critical-alert vibration (1.4) | Alerts that can be missed aren't alerts | Small |
| 6 | Dead export button + save feedback (3, 1.3) | Credibility in demos | Small |
| 7 | Pull-to-refresh + greeting + toast-tap (2.4, 4, 2.2) | Cheap polish bundle | Small |
| 8 | Real i18n for Yoruba/Hausa (3) | Highest-impact real feature for the audience | Medium |
| 9 | Dark mode or remove the toggle (3) | Honest UI | Medium |
