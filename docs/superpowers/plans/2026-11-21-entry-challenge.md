# Entry challenges (#2/#3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make entries #2 and #3 of every company deterministic, hand-made challenges that are harder than #1 (and #3 harder than #2).

**Architecture:** Four new optional `Entry` fields in `src/roguelike.ts` (`quotaGrowth`, `family`, `noSell`, `banned`) read where quotas, daemon offers, the shop shelf and selling are computed; `familyLock`/`setFamily` and the family start dialog go away. Then the 8 entries get new data and texts, checked with the bot sim.

**Tech Stack:** TypeScript, Vite, Vitest (`npx vitest run src`), bot sim in `.notes/sim.test.ts` (skill `bypass-balance-sim`).

**Spec:** `docs/superpowers/specs/2026-11-21-entry-challenge-design.md`

## Global Constraints

- Everything deterministic: no random entry rules (Courier's random `startTool` goes).
- `quotaGrowth` changes iterations 2–3 only; iteration 1 quotas of every entry stay as #1 (first room must stay doable). New entries do not use `quotaMult`.
- Entry order stays (unlocks go by position, `entriesOpen`); entry ids stay (records are keyed by id).
- Card texts (`plus`/`minus`, tips) in English; code comments English, short, only for non-obvious logic.
- Edit source with Edit or Node, never PowerShell text writes (UTF-8 glyphs).
- No commits until the player has seen the sim results (Task 5).

## Review Focus

- A `noSell` line item upgraded (Linker v1 → v2 on Fibre tap): v2 must stay unsellable. Test in Task 3.
- A banned item that is also a start item or an upgrade of an owned item: never on the shelf. Test in Task 3.
- Family offer with nearly every family daemon owned: offer refills from the last offer, never contains `undefined`, never an owned daemon. Test in Task 2.
- A saved run from before this change on `signal` with `family: 'Ghost'` in the save: offers must follow the entry's Runner. Test in Task 2.
- Patch notes between iterations show the entry's growth, not 2.5. Checked in Task 1 step 5.

---

### Task 1: `quotaGrowth`

**Files:**
- Modify: `src/roguelike.ts` (`Entry` ~line 35, `quota` ~line 160)
- Modify: `src/ui.ts:1120` (patch notes)
- Test: `src/roguelike.test.ts`

**Interfaces:**
- Produces: `Entry.quotaGrowth?: number`; `export const growthOf = (s: { company: number; entry?: string }) => number` (entry's `quotaGrowth ?? QUOTA_GROWTH`).

- [ ] **Step 1: Failing test** `'quotaGrowth raises iterations 2 and 3 only'`: on a temporary entry built in the test (push a copy entry into `COMPANIES[0].entries` with `quotaGrowth: 3`, remove it in `finally`), `quota(s, 0)` at `loop` 0 equals the default entry's; at `loop` 2 equals `Math.round(20 * 9 / 5) * 5` (= 180); `growthOf(s)` is 3 and `growthOf(newRunState(1))` is 2.5.
- [ ] **Step 2:** `npx vitest run src/roguelike.test.ts -t quotaGrowth` → FAIL (`growthOf` not exported).
- [ ] **Step 3:** Add the field and `growthOf`; `quota` uses `growthOf(s) ** s.loop`.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5:** `src/ui.ts:1120`: `'Quotas ×' + growthOf(R)`. Company card (1425) and map (1442) stay on `QUOTA_GROWTH` (they show the company, not an entry).

### Task 2: `family` replaces `familyLock`

**Files:**
- Modify: `src/roguelike.ts` (`Entry`, `RunState.family`, `needsStartChoice` ~317, `setFamily` ~324, `offerDaemons` ~824)
- Modify: `src/ui.ts` (imports line 14, `startChoice` ~1394–1409: drop the family branch)
- Modify: `.notes/sim.test.ts:13, 322–327` (drop `setFamily` use)
- Test: `src/roguelike.test.ts:1039–1052` (rewrite the Signal flaw test)

**Interfaces:**
- Produces: `Entry.family?: Family`; `needsStartChoice(s): 'ice' | undefined`. `setFamily`, `familyLock` and `RunState.family` removed (old saves may still carry `family`; it is ignored).

- [ ] **Step 1: Failing tests** (use a test entry with `family: 'Runner', offer: 4` until Task 4 sets the real data, same push/remove pattern as Task 1):
  - `'a fixed family offers only that family'`: every id in `offerDaemons(s)` has `DAEMONS[id].family === 'Runner'`; `needsStartChoice(s)` is `undefined`.
  - `'a family offer refills from the last offer when the family runs short'`: `s.daemons` = all Runner daemons but 3, `s.lastOffer` = 2 of those 3; the offer has length 3, `every(Boolean)`, no owned id, and includes both `lastOffer` ids.
  - `'an old save family is ignored'`: same state with `s.family = 'Ghost'` (cast) → still only Runner.
- [ ] **Step 2:** `npx vitest run src/roguelike.test.ts -t family` → FAIL.
- [ ] **Step 3:** `offerDaemons`: family filter from `entryOf(s).family`. Fresh pool = family, not owned, not in `lastOffer` (shuffled as now). Only when `entryOf(s).family` is set and the fresh pool is shorter than the offer size, append the shuffled `lastOffer` ids of that family that are not owned. Non-family offers keep the current rng order (existing offer tests must not change).
- [ ] **Step 4:** Remove `familyLock`, `setFamily`, the `'family'` case and `RunState.family`; drop the family branch in `startChoice` (keep the ICE one) and in the sim; remove `setFamily` from imports in ui, test and sim.
- [ ] **Step 5:** `npx vitest run src` and `npx tsc --noEmit -p .` → PASS, no errors.

### Task 3: `noSell` and `banned`

**Files:**
- Modify: `src/roguelike.ts` (`Entry`, `forSale` ~950, `sell` ~1017)
- Modify: `src/ui.ts:1140–1141, 1195–1196` (rack in the shop)
- Test: `src/roguelike.test.ts`

**Interfaces:**
- Produces: `Entry.noSell?: true | ItemId[]`, `Entry.banned?: ItemId[]`; `export const canSell = (s: RunState, id: ItemId) => boolean` (false when `noSell === true`, or the list holds `id` or any of `olderVersions(id)`). `sell` returns false when `!canSell`.

- [ ] **Step 1: Failing tests** (test entries as before):
  - `'noSell true blocks every sale'`: `sell(s, 'thumb')` false, item kept, credits unchanged.
  - `'a noSell list covers the whole item line'`: `noSell: ['linker1']`, items `['linker2', 'thumb']` → `canSell(s, 'linker2')` false, `canSell(s, 'thumb')` true.
  - `'banned items never reach the shelf'`: `banned: ['wildcard1', 'wildcard2', 'linker1', 'linker2']`, items `['linker1']` → `forSale(s)` contains none of the four; after `stockShop(s)` the shelf contains none either.
- [ ] **Step 2:** `npx vitest run src/roguelike.test.ts -t "noSell|banned"` → FAIL.
- [ ] **Step 3:** Implement `canSell`, the guard in `sell`, and the `banned` filter in `forSale`.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5:** UI: in the shop, a module with `!canSell(R, id)` renders as the non-shop `span` (no `data-sell`) with tip `ITEMS[id].text + ' · locked by the entry: cannot be sold'`; no other style change. Check in the dev server (preview) on an entry with `noSell` that the module has no sell label and the others do.

### Task 4: The 8 entries

**Files:**
- Modify: `src/roguelike.ts:76–79, 95–98, 117–120, 138–141` (entry data), comment at line 33 (no more random start tool)
- Modify: `src/roguelike.test.ts` (tests that name `courier`, `dock`, `nightshift`, `phishing`, `phone`, `papertrail`, `signal`, `fibre`; switch Tasks 1–3 test entries to real ones where it reads better)
- Modify: `docs/GAME_STATE.md` (entry table)

**Interfaces:**
- Consumes: fields from Tasks 1–3. Remove `startTool` from `Entry` and `newRunState` if no entry uses it.

Data (from the spec; ids and order unchanged). Minus texts must state every rule, including the growth as `Quotas ×X per iteration (from iteration 2).`:

| company | # | id | plus | minus / data |
|---|---|---|---|---|
| Kestrel | 2 | courier | `startItems: ['mux']` | `shelf: 3`, `noSell: ['mux']`, `quotaGrowth: 2.7` |
| Kestrel | 3 | dock | `payLevels: { single: 3, multi: 3 }` | `banned: ['linker1', 'linker2']`, `quotaGrowth: 2.9`, no `quotaMult` |
| Meridian | 2 | nightshift | `offer: 4` | `family: 'Runner'`, `priceDelta: 1`, `quotaGrowth: 2.7` |
| Meridian | 3 | phishing | `payLevels: { linked: 3, all_linked: 3 }` | `noDisconnect: true`, `noSell: true`, `quotaGrowth: 2.9` |
| Ashgrove | 2 | phone | `startItems: ['sim']` | `always: ['deadcells']`, `noSell: ['sim']`, `quotaGrowth: 2.7` |
| Ashgrove | 3 | papertrail | `pickBossIce: true` | `doublePatch: true`, `banned: ['rewind', 'sim']`, `quotaGrowth: 2.9` |
| Argus | 2 | signal | `payLevels` all five at 2 | `family: 'Runner'`, `quotaGrowth: 2.7` |
| Argus | 3 | fibre | `startItems: ['linker1']` | `noSell: ['linker1']`, `banned: ['wildcard1', 'wildcard2']`, `shelf: 3`, `quotaGrowth: 3.0`, no `quotaMult` |

- [ ] **Step 1:** Update the tests that pin old entry behaviour to the table (e.g. Courier now always starts with `['mux']`; Dock quota at loop 0 equals #1's; Signal offers only Runner).
- [ ] **Step 2:** `npx vitest run src` → FAIL on those tests.
- [ ] **Step 3:** Edit the entry data and texts.
- [ ] **Step 4:** `npx vitest run src` and `npx tsc --noEmit -p .` → PASS.
- [ ] **Step 5:** Update the entry table in `docs/GAME_STATE.md`.

### Task 5: Sim check and the player's OK

**Files:**
- Modify: `.notes/00_START_HERE.md` (dated decision + sim results)

- [ ] **Step 1:** Ask the player before the run (it is a long, costly step). Then, per skill `bypass-balance-sim`, run the sim for each company with `SIM_ENTRY=0`, `1`, `2` (`SIM_PAR=2`), in the background; do not edit `src/` while it runs.
- [ ] **Step 2:** Table: win rate per profile (all of `ALL_PROFILES` except `casual` and `painter`) × company × entry. Pass: in every company the average drops #1 → #2 → #3 by more than the ±10 pp noise; iteration-1 quotas equal across entries.
- [ ] **Step 3:** If a company fails, adjust levers within the entry's theme (growth, shelf, bans, plus strength), rerun only that company, and repeat.
- [ ] **Step 4:** Show the player the table and any lever changes. Add the dated decision to `.notes/00_START_HERE.md` (old → new entry rules, sim numbers).
- [ ] **Step 5:** On the player's OK, commit spec, plan and code in one commit (ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Push only if asked.
