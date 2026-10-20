# AI-Assisted Development Transcript

This project was built end-to-end with **Claude Code** as an AI pair-programmer. Below is the
development dialogue — the instructions I gave and the concrete actions the agent took — grouped
into the phases the work moved through.

The prompts are direct and intent-first, with the constraints that mattered and tight iterative
feedback on product and UX. They're lightly cleaned up for readability — the live session had more
back-and-forth — but the intent, decisions, and sequence are faithful to how it actually went. A
few of those decisions were a short discussion: I had the agent lay out options and trade-offs,
then made the call. Two principles I held the agent to throughout:

> 1. **Correctness lives in the database** — unique indexes + transactions, not application
>    `if`-statements — so the guarantees survive concurrency and multiple instances.
> 2. **Ship a working, simple, customer-friendly product over gold-plating** — matching the
>    brief's emphasis on judgment (what to build and what *not* to).

---

## Phase 1 — Scope before writing code

**Prompt:** "Before we write any code, go through the assignment and pull out what's actually
being graded — the hard requirements and the eval criteria. I want to keep scope tight and not
over-build."
**Agent:** Parsed the brief and surfaced the graded dimensions — time zones, DST, mentor
assignment + 2/day cap, **concurrency**, and a friendly no-availability state — plus the
meta-criteria (architecture, AI usage, documentation, judgment). No code yet.

**Prompt:** "Let's go with Node + TS + Fastify and MongoDB, running on Docker. I want correctness
handled in the database, not in app code — a unique index on `{mentorId, slotStartUtc}` so you
physically can't double-book, and a guarded counter inside a transaction for the 2/day cap. We'll
need a single-node replica set for transactions, so auto-init it in compose. And keep it layered
with a pure domain core for the time/DST + slot logic so we can unit-test that on its own."
**Agent:** Implemented exactly this and backed each guarantee with tests.

---

## Phase 2 — Build the engine in verified slices

**Prompt:** "Scaffold it and build in layered slices — domain core first (keep it
dependency-free), then models, services, API, frontend. Type-check and test each layer before
moving on."
**Agent:** Built a pure **domain core** (DST-aware time math + slot generation) unit-testable with
no DB or mocks; Mongoose models with the key indexes; `availabilityService` + a transactional
`bookingService`; Fastify routes with Zod validation and a central error handler; and the React
booking flow. Ended at **25 tests** (domain DST/slot + DB-backed concurrency/capacity on an
in-memory replica set), plus a committed API smoke test and a browser E2E.

**Prompt:** "Run it and let's make sure the whole booking flow actually works in a real browser,
not just in the tests."
**Agent:** Launched it and drove the flow in headless Chrome (timezone → date → slots → book →
confirm), capturing screenshots at each step.

---

## Phase 3 — Raise the bar: adversarial review

**Prompt:** "Let's be thorough before we submit — run the deeper multi-agent adversarial review
instead of a quick pass, and verify each finding independently."
**Agent:** Ran it across six dimensions (timezone/DST, concurrency, availability, API/validation,
frontend UX, architecture), with each finding independently verified — 47 raised, 36 confirmed.

**Prompt:** "Go through the confirmed findings and fix them — correctness first."
**Agent:** Caught a **real concurrency bug**: the daily-cap counter's guarded upsert couldn't
distinguish "day is full" from "counter doc doesn't exist yet", so a fresh-day race could wrongly
reject a valid booking. Fixed with ensure-doc-outside-txn + a guarded increment inside; added a
regression test. Also fixed DST spring-forward slot generation, modal accessibility, a CORS
wildcard fallback, 4xx errors masked as 500, a stale-response race, env validation, and a
booking-horizon cap.

**Prompt:** "Now check us against every requirement and edge case in the brief — confirm what's
covered and flag any gaps or things we deliberately skipped."
**Agent:** Produced a requirement-by-requirement compliance check — all functional requirements
and edge cases covered, with a few documented assumptions (e.g. email delivery stubbed per the
brief's "dummy link is fine").

---

## Phase 4 — Make it feel like a product (iterative UX)

This was the longest phase: tight, screenshot-driven feedback loops on look, feel, and clarity.

**Prompt:** "The UI feels generic / AI-made. Give it an identity that fits a kids' ed-tech brand,
but don't hurt usability."
**Agent:** Explained that the "generic" feel comes from composition and execution, not hue; began
iterating on visual direction.

**Prompt:** "It's not really intuitive — it's unclear what to do first. Redesign it so a
first-time parent gets each step: plain language, guided flow."
**Agent:** Introduced a guided, plainly-worded flow (later simplified further).

**Prompt:** "The booking area has no real boundaries — it feels unstructured. Put it in a clear,
bounded card."
**Agent:** Turned out to be a **real regression** — the `.card` style had been dropped in a prior
redesign, so the container rendered transparent (which also broke the error screen). Restored it
and simplified to a single focused card.

**Prompt:** "Of the directions we looked at (Calendly, Duolingo, Notion, Airbnb) — let's go with
the Airbnb warm/friendly one. Soft shadows, airy spacing, a clean font."
**Agent:** Rebuilt the UI in that style.

**Prompt:** "The coral's basically Airbnb's signature color. From the accent options, let's use
teal — keep the warm look, just recolour so it's its own thing."
**Agent:** Recoloured the app to teal, retaining the warm execution (soft shadows, airy spacing,
Plus Jakarta Sans).

**Prompt:** "Let's make it date-first — only show the time slots after they pick a date, like
Calendly."
**Agent:** Date starts empty with a prompt; selecting a date loads and reveals the times.

**Prompt:** "The native date picker looks generic and OS-dependent. Build a custom inline calendar
that's on-brand and timezone-aware, and disable past / out-of-range dates."
**Agent:** Built a Luxon-backed Calendar component (today marked, selected highlighted,
past/out-of-range disabled, month navigation bounded to the booking horizon).

**Prompt:** "When you pick a date there's no feedback that slots are loading. Add something clear
— scroll down to the times, a loading state, and a count of what's available."
**Agent:** Added smooth-scroll to the times, a loading spinner, and an "N available" count.

**Prompt:** "Drop the ⇄ 'bridge' on the confirmation — just show the class time once, in the
parent's zone."
**Agent:** Removed the bridge; the confirmation shows the parent's time once with the assigned
mentor.

**Prompt:** "Why are we showing the mentor's local time on the *parent's* confirmation? The parent
only needs their own time — take it off."
**Agent:** Removed it; the mentor still receives their IST time via their own notification.

**Prompt:** "The class link just goes to a dead page. Point it somewhere real in the app, and give
that page a purpose — show the booking, how to join, and a join action. Keep it honest that it's
a demo."
**Agent:** Routed the link to an in-app demo class room with the booking context, a "before you
join" checklist, and a working Join action — clearly labelled a demo.

**Prompt:** "If I refresh the confirmation, it goes back to the home screen. Persist it so a
refresh keeps me on the confirmation."
**Agent:** Persisted the confirmation to `sessionStorage`; restored on load, cleared on "Book
another".

**Prompt:** "Backend's not responding — get it running."
**Agent:** Traced it to Docker Desktop crashing locally; ran a Dockerless single-node
`mongod --replSet` on an alternate port so the app ran reliably (repo defaults unchanged for
reviewers).

**Prompt:** "Act as QA and stress-test the API — edge cases, capacity, concurrency, and error
states — and tell me what's broken or missing."
**Agent:** Ran 12 API edge cases + capacity/no-availability/alternatives (all correct) and
surfaced the missing-`.card` regression noted above.

**Prompt:** "Let's skip the email-domain autocomplete — browsers autofill anyway and the validated
field is enough. I'd rather keep it simple." *(A deliberate "don't build" call, in the spirit of
the brief's emphasis on judgment.)*
**Agent:** Left the email field as-is.

---

## Phase 5 — Submission

**Prompt:** "Go over the README and make sure it matches the final UI — fix anything stale. Also
give me a short repo description and some topics."
**Agent:** Aligned the README (date-first flow, calendar, confirmation, class-link example) and
provided a description + topics.

**Prompt:** "Help me find my GitHub noreply email, then make sure the whole commit history uses it
— no personal or work email anywhere."
**Agent:** Walked through GitHub → Settings → Emails; **re-authored all commits** to the noreply
address and verified no personal/work email in history.

**Prompt:** "Run the full regression — all tests + the browser E2E + the smoke test — and confirm
it's all green before I push."
**Agent:** 25 tests + typechecks + build + smoke + E2E, all green.

**Prompt:** "Push it, then set the description and topics on GitHub."
**Agent:** Pushed to the public repo and set the description + topics via `gh`.

---

*Every change was produced through this AI-assisted session and then reviewed, type-checked, and
tested before being accepted. Product/UX was driven by iterative, screenshot-based feedback;
correctness by automated tests and an adversarial review.*
