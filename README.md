# Leftovers v4 — original planner restored

Full demo build: Groups, shared budgets, KA-CHING confirmation, Tinder-style swipe voting, majority matching, Top 3 recommendations, Saved + Anti-list, custom group activities, lightweight accounts, plus the newer Explore/live-find/offline layer.

## Run
1. Extract the folder.
2. Make sure Node.js is installed.
3. Double-click `START_LEFTOVERS.bat`.
4. If Windows blocks the BAT, right-click the downloaded ZIP → Properties → **Unblock** → Apply, then extract again.

Manual fallback: open a terminal in this folder and run `node server.js`, then open `http://127.0.0.1:8081`.

## Core flow
Login → Create/Join Group → everyone enters budget → swipe → majority match → Top 3 → save/anti-list. Explore is an extra, not a replacement.

Demo data is local/in-memory; restarting the server resets groups/accounts.
