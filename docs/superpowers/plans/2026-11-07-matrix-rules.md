# Matrix Rules Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przenieść reguły matrycy (przygotowanie, stan komórek, legalność i skutki kliknięcia) z `src/ui.ts` do czystego, testowanego `src/matrix.ts`, i dodać test rozwiązywalności, który sam obejmuje każde nowe ICE i item.

**Architecture:** `matrix.ts` dostaje jeden obiekt stanu `Board` (puzzle + run + stan itemów `M` + uzbrojone narzędzie + kontekst runu) i czyste funkcje nad nim. `ui.ts` trzyma `Board` w miejscu dzisiejszych `S.puzzle`/`S.run`/`M`/`armed` i tylko rysuje wynik oraz obsługuje DOM, timer, zapis i animacje. Zachowanie gry się nie zmienia: to czysty refactor plus testy.

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5. Bez nowych zależności.

**Spec:** brak osobnego dokumentu; wymagania z rozmowy z 2026-11-07: łatwe i bezpieczne dodawanie firm, ICE, daemonów, itemów i mechanik; testy chroniące to, co już działa; backlog w pamięci (Flicker, Decay, Conveyor, Lock&key, Dual cell, Overclock, Portal, Painter).

## Global Constraints

- Zero zmian zachowania gry. Wszystkie istniejące testy (`npm test`) przechodzą bez edycji ich asercji.
- Bez nowych zależności w `package.json`.
- `matrix.ts` nie importuje niczego z DOM ani z `ui.ts`; `roguelike.ts` nie importuje `matrix.ts` (brak cykli).
- Komentarze po angielsku, krótkie, tylko tam, gdzie logika nie jest oczywista (CLAUDE.md).
- Tryby inne niż run (sprint, daily, train) przekazują pusty kontekst: `items: []`, `daemons: []`, `ice: []`. Dzisiejsze sprawdzenia `S.mode === 'run'` w regułach znikają przez to, a nie przez flagę.
- `npm run build` (tsc) przechodzi po każdym zadaniu.

## Review Focus

1. Tryby bez runu (sprint/daily/train): komórki wyglądają i klikają się jak dziś; żadna reguła runu nie przecieka. Test w Task 2 (`cellView` z pustym kontekstem).
2. Encryption + uzbrojony Bridge + Side door razem: kod widoczny tylko w linii, w 8 polach wokół ostatniego kliknięcia i na krawędziach przed pierwszym ruchem. Test w Task 2.
3. Repeater na pełnym buforze: drugi kod nie wchodzi, gdy bufor jest pełny. Test w Task 3.
4. Rewind trzyma matrycę otwartą przy ślepym zaułku (`stuck` false, gdy Rewind niezużyty). Test w Task 3.
5. Powtarzalność rozdania: ten sam seed i stan runu dają identyczną matrycę, cells, trap i rep (daily i wznowienie runu na tym polegają). Test w Task 1.

---

### Task 1: `dealBoard` — przygotowanie matrycy w `matrix.ts`

**Files:**
- Create: `src/matrix.ts`
- Modify: `src/ui.ts:60-70` (typ `M`, `Tool`, `TOOLS`, `loopAny` przenoszone), `src/ui.ts:1002-1022` (`dealMatrix` woła `dealBoard`)
- Test: `src/matrix.test.ts`

**Interfaces:**
- Produces:
  - `export type Tool = 'wild' | 'split' | 'jump' | 'loop' | 'mux' | 'rewind'`
  - `export const TOOLS: Partial<Record<ItemId, Tool>>` (przeniesione 1:1)
  - `export interface ItemState` — dokładnie dzisiejszy kształt `M` z `ui.ts:63-64`.
  - `export interface Ctx { items: ItemId[]; daemons: DaemonId[]; ice: IceId[]; lastStart?: number; rowLabel?: …; }` — tylko `items`, `daemons`, `ice`, `lastStart` są wymagane w tym zadaniu.
  - `export interface Board { puzzle: Puzzle; run: Run; m: ItemState; armed: Tool | null; ctx: Ctx; over: boolean }`
  - `export const emptyItems = (): ItemState` — dzisiejsza wartość domyślna z `ui.ts:65`.
  - `export const ctxOf = (s: RunState): Ctx` — `{ items: s.items, daemons: s.daemons, ice: roomIce(s), lastStart: s.lastStart }`.
  - `export function dealBoard(seed: number, s: RunState): Board` — treść `dealMatrix` z `ui.ts:1007-1019` bez DOM (`$`, `logo`), bez `R.matrix++` (to zostaje w ui), bez `tOrder` i `bonusIntro`; zwraca świeży `newRun()` z `run.burn = burnOf(s) || undefined` (jak `resetRun()` w `ui.ts:1448`).
  - `export const loopAny = (b: Board) => b.ctx.items.includes('loopback2')`

- [ ] **Step 1: Napisz testy `dealBoard`**

```ts
describe('dealBoard', () => {
  const st = (over: Partial<RunState> = {}) => ({ ...newRunState(3), section: BOSS, ...over });
  it('is deterministic for a seed and run state', () => {
    const s = st({ items: ['repeater', 'wildcard1', 'datanode'], ice: 'honeypot' });
    expect(dealBoard(11, s)).toEqual(dealBoard(11, s));
  });
  it('matches the old dealRunMatrix grid when no item reshapes it', () => {
    expect(dealBoard(7, st()).puzzle).toEqual(dealRunMatrix(7, st()));
  });
  it('arms one-shot tools from the rack', () => {
    const b = dealBoard(5, st({ items: ['bridge', 'mux', 'rewind'] }));
    expect([b.m.jump, b.m.mux, b.m.rewind, b.m.loop]).toEqual([true, true, true, false]);
  });
  it('places honeypot only under Honeypot ICE', () => {
    expect(dealBoard(5, st({ ice: 'honeypot' })).m.trap).toBeDefined();
    expect(dealBoard(5, st()).m.trap).toBeUndefined();
  });
});
```

Nazwy itemów (`wildcard1`, `datanode`) sprawdź w `ITEMS` (`roguelike.ts:572`) i popraw, jeśli są inne.

- [ ] **Step 2:** `npx vitest run src/matrix.test.ts` → FAIL: `dealBoard` nie istnieje.
- [ ] **Step 3:** Utwórz `src/matrix.ts` z powyższymi eksportami; `ui.ts` importuje `Tool`, `TOOLS`, `ItemState`, `emptyItems`, `dealBoard`, a `dealMatrix` robi `const b = dealBoard(stageSeed(R.seed, R.matrix++), R); S.puzzle = b.puzzle; M = b.m; armed = null; resetRun();` plus swoje części DOM. (Pełne przejście na `Board` w ui jest w Task 2.)
- [ ] **Step 4:** `npm test` i `npm run build` → PASS.
- [ ] **Step 5:** Commit: `git add src/matrix.ts src/matrix.test.ts src/ui.ts && git commit -m "Extract matrix deal into matrix.ts"`

### Task 2: `cellView` i `canPick` — stan komórki bez DOM

**Files:**
- Modify: `src/matrix.ts`, `src/ui.ts:88-110` (helpery reguł usunięte), `src/ui.ts:117-171` (pętla komórek w `render`), `src/ui.ts:1080-1082` (`applyCross` używa `cellView`)
- Test: `src/matrix.test.ts`

**Interfaces:**
- Consumes: `Board`, `Ctx`, `loopAny` z Task 1.
- Produces:
  - `export function canPick(b: Board, r: number, c: number): boolean` — dzisiejsze `legal` z `ui.ts:94-99` bez `S.dealing` i `offer.length` (te zostają w ui: `const legal = (r, c) => !S.dealing && !offer.length && canPick(B, r, c)`).
  - `export interface CellView { code: string; hidden: boolean; cls: string[]; tags: ('node' | 'trap' | 'rep')[]; burnLeft?: number; pick: boolean }`
  - `export function cellView(b: Board, r: number, c: number): CellView` — logika z `ui.ts:142-162`; `cls` zawiera dokładnie dzisiejsze nazwy klas CSS (`enc`, `wild`, `ice`, `trap`, `ping`, `lane`, `used`, `burn`, `memo`, `corner`, `ok`).
  - `export const blackout = (b: Board): boolean`, `export const doorOpen = (b: Board): boolean` — używane też przez targets i `laneLabel` w ui.
- `ui.ts` zastępuje `S.puzzle`/`S.run`/`M`/`armed` jednym `let B: Board`, a `S.puzzle`/`S.run` czyta przez `B` (tryby bez runu budują `Board` z pustym `Ctx` i `emptyItems()`). Jeśli to za duża zmiana w jednym kroku, dopuszczalne jest `const B = (): Board => ({ puzzle: S.puzzle, run: S.run, m: M, armed, ctx: S.mode === 'run' ? ctxOf(R) : EMPTY_CTX, over: S.over })` jako widok na stary stan — wybierz to, co daje mniejszy diff.

- [ ] **Step 1: Napisz testy** (plansze budowane ręcznie: `grid` 5×5 z kodami `'A'…'Y'`, `newRun()`):
  - `encryption hides codes off the lane` — `ctx.ice = ['encryption']`: `(0,3)` widoczne (rząd 0), `(2,2)` ma `hidden: true`, a `cls` zawiera `'enc'` (`code` zostaje prawdziwym kodem; `'??'` wstawia ui).
  - `armed bridge sees the 8 cells around the last pick` — po `pick(run, p, 0, 2)`, `armed = 'jump'`: `(1,1)` nie `hidden`, `(3,3)` `hidden`.
  - `side door opens every edge before the first pick` — `items: ['sidedoor']`: `canPick` true dla `(4,0)` i `(2,4)`, false dla `(2,2)`.
  - `mux lane` — `armed = 'mux'` po picku `(0,2)`: `canPick(2,2)` true, `canPick(3,3)` false.
  - `wild cannot go on the repeater cell` — `armed = 'wild'`, `m.rep = [1,1]`: `canPick(1,1)` false.
  - `burning cell shows moves left` — run z `burn: 2` po picku `(0,2)`: `cellView(1,2).burnLeft === 2`, `pick: false`.
  - `non-run board shows plain cells` — pusty `Ctx`, `grid` z `BLOCK` w `(1,1)`: `cls` dla `(1,1)` to `['ice']`, dla `(0,0)` `['lane','ok']`, `hidden` zawsze false.
- [ ] **Step 2:** `npx vitest run src/matrix.test.ts` → FAIL.
- [ ] **Step 3:** Przenieś `isUsed`, `muxLane`, `doorOpen`, `onEdge`, `legal`, `blackout`, `isNode`, `isTrap`, `bridgeSees`, `encrypted` do `matrix.ts` jako funkcje od `Board`; `render` buduje przycisk z `cellView` (tekst, klasy, tagi `ntag`/`ttag`/`rtag`, `btag`, `aria-label`, `onclick`). HTML i klasy na wyjściu bez zmian.
- [ ] **Step 4:** `npm test`, `npm run build` → PASS. Potem ręcznie w podglądzie (preview): run z Encryption i z Side door wygląda jak przed zmianą (screenshot).
- [ ] **Step 5:** Commit: `Move cell rules to matrix.ts`

### Task 3: `applyPick` i `isStuck` — skutki kliknięcia

**Files:**
- Modify: `src/matrix.ts`, `src/ui.ts:1154-1187` (`choose`), `src/ui.ts:1035-1046` (`doRewind`)
- Test: `src/matrix.test.ts`

**Interfaces:**
- Consumes: `Board`, `canPick`, `doorOpen`, `loopAny`.
- Produces:
  - `export type PickResult = 'placed' | 'picked'` — `'placed'` dla uzbrojonego Wildcarda (bez ruchu i bez startu zegara).
  - `export function applyPick(b: Board, r: number, c: number): PickResult` — logika z `ui.ts:1157-1177` bez DOM, logowania i zegara: wild, mux (`free`), `m.back`, `pick`, Repeater (tylko gdy `buffer.length < puzzle.l`), `sideDoor`, `m.jumps`, zużycie narzędzi, `armed = null`, `m.tools = true` przy użyciu narzędzia.
  - `export function isStuck(b: Board, runMode: boolean): boolean` — `ui.ts:1181-1184`.
  - `export function hasMoves(b: Board): boolean` — `ui.ts:1186` (`more`).
  - `export function rewind(b: Board): boolean` — `doRewind` bez `logAct`/`render`; zwraca false, gdy nie ma czego cofać.
- `choose` w ui: `if (!legal(r,c)) return; logAct(...); if (applyPick(B, r, c) === 'placed') return render();` potem zegar, `isStuck`, `hasMoves`, koniec rundy i DOM jak dziś.

- [ ] **Step 1: Napisz testy:**
  - `repeater doubles its code` — `m.rep = [0,1]`, pick `(0,1)`: bufor `['B','B']`.
  - `repeater skips the second code on a full buffer` — `puzzle.l = 1`: bufor `['B']`.
  - `wildcard places ** without a move` — `armed = 'wild'`: wynik `'placed'`, `run.path.length === 0`, `grid[r][c] === WILD`, `m.wild === false`.
  - `bridge off the lane records a jump` — `armed = 'jump'`, pick poza linią: `m.jumps` to `[0]`, `m.jump === false`.
  - `unused rewind keeps a dead end open` — plansza bez szans na target i `m.rewind = true` z `m.back`: `isStuck(b, true) === false`; po `m.rewind = false`: `true`.
  - `rewind frees the last cell and adds a slot` — po picku i `rewind(b)`: `run.used` bez tej komórki, `puzzle.l` +1, druga próba zwraca false.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Zaimplementuj przez przeniesienie kodu; `choose` i `doRewind` w ui wołają nowe funkcje.
- [ ] **Step 4:** `npm test`, `npm run build` → PASS; w podglądzie przejdź jedną matrycę z Bridge i Rewind.
- [ ] **Step 5:** Commit: `Move pick rules to matrix.ts`

### Task 4: Test rozwiązywalności dla całej zawartości + instrukcja dodawania

**Files:**
- Test: `src/content.test.ts` (nowy)
- Modify: `docs/DESIGN.md` (krótka sekcja „Adding a matrix mechanic”)

**Interfaces:**
- Consumes: `dealBoard`, `TOOLS`, `loopAny` (Task 1), `canComplete`, `ICE`, `ITEMS`, `COMPANIES`.

- [ ] **Step 1: Napisz testy** (seedy 1–30, sekcja boss i sekcja 0, każda firma):
  - `every ICE deals a solvable matrix` — dla każdego `id of Object.keys(ICE)`: `canComplete(newRun-with-burn, b.puzzle, undefined, { ...b.m, loopAny: loopAny(b) })` true.
  - `every item deals a solvable matrix` — to samo dla każdego `ItemId` w `ITEMS`, item sam w racku.
  - `every company's ICE pool is solvable together` — dla każdej firmy wszystkie jej ICE naraz (patches na sekcji boss).
  - `every ICE and item has rule text` — każdy wpis `ICE`/`ITEMS` ma niepuste `name` i `text` (lub odpowiednik pola w `ITEMS`).
  Pętle iterują po kluczach tabel, więc nowe ICE i itemy wchodzą do testu bez jego edycji.
- [ ] **Step 2:** `npx vitest run src/content.test.ts`. Oczekiwane: PASS (to test-strażnik obecnego stanu). Jeśli coś pada, to prawdziwy błąd w grze — zatrzymaj się i zgłoś seed i id, nie poprawiaj testu.
- [ ] **Step 3:** Sprawdź czas: cały `npm test` ma trwać poniżej ~10 s; jeśli dłużej, zmniejsz seedy do 1–15.
- [ ] **Step 4:** W `docs/DESIGN.md` dopisz ≤10 linii: nowa mechanika matrycy = wpis w tabeli (`ICE`/`ITEMS`/`DAEMONS`) + reguła w `matrix.ts` (`dealBoard` / `cellView` / `canPick` / `applyPick`) + test w `matrix.test.ts`; jeśli zmienia możliwe ruchy, także `Tools` w `solver.ts`; `content.test.ts` pokrywa ją sam.
- [ ] **Step 5:** Commit: `Content solvability tests and mechanic guide`

---

**Pominięte celowo:** rejestr hooków per ICE/item (dodam przy pierwszej mechanice z backlogu, jeśli trzy funkcje w `matrix.ts` zaczną puchnąć), rozbijanie reszty `ui.ts` (sklep, podsumowanie), testy e2e, nowe biblioteki.
