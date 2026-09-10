# Leftovers — budget.swipe.match

Full demo build: Groups, shared budgets, swipe voting, majority matching, Top 3 recommendations, Saved + Anti-list, custom group activities, lightweight accounts, Explore/live-find, and offline support.

## Run

1. Extract the folder.
2. Make sure Node.js is installed.
3. Double-click `START_LEFTOVERS.bat`.
4. If Windows blocks it: ZIP → Properties → **Unblock** → Apply, then extract again.

Manual fallback: run `node server.js`, then open `http://127.0.0.1:8081`.

## Core flow

Login → Create/Join Group → everyone enters budget → swipe → majority match → Top 3 → save/anti-list.

Demo data is local/in-memory; restarting the server resets groups/accounts.

## Key assumptions

* Individual budgets are combined into a shared group budget constraint.
* Majority approval is sufficient; unanimous agreement is not required.
* Up to three matching recommendations are shown; fewer are shown if fewer qualify.
* Swipes represent preferences, not bookings or purchases.
* Saved and Anti-list preferences are user-specific.
* Custom activities follow the same voting/matching rules as built-in activities.
* Live-find is optional; the core flow works with demo/offline data.
* Accounts are lightweight demo accounts, not production authentication.
* No real booking, payment, or guaranteed live availability is assumed.
* Where the brief was ambiguous, the simplest behaviour consistent with the core flow was chosen.
