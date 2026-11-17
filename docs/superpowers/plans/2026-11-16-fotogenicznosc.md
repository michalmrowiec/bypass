# Fotogeniczność: plan wdrożenia

> **Dla wykonawcy:** wymagany sub-skill: superpowers:executing-plans (albo subagent-driven-development). Kroki to checkboxy (`- [ ]`).

**Cel:** każdy build ma wyglądać inaczej już na zrzucie ekranu. Daemony dostają faktury rodzin i glify, rack materiały paneli, paski i tabliczki wersji, a plansza odcień rodziny przy 3+ daemonach.

**Architektura:** głównie CSS na obecnym HTML. W `src/ui.ts` dochodzą tylko klasy i małe elementy w istniejącym markupie (karta daemona, moduł racka, panel matrix). `src/gear.ts` i `src/roguelike.ts` zostają bez zmian (w `roguelike.ts` pracuje inna sesja).

**Stack:** TypeScript + Vite, czysty CSS (`src/style.css`).

**Spec:** `.notes/00_START_HERE.md`, sekcja 6 → „Fotogeniczność”, „Projekt ustalony 2026-11-16”.

## Globalne ograniczenia
- Zero nowego ruchu. Obecne animacje (biegnąca ramka holo legendary, glitch, diody LED, hover) zostają bez zmian.
- Faktury mają niski kontrast; tekst i kody muszą być czytelne jak dziś, także na telefonie.
- Złoto (`--gold`, `#ffd23f`) tylko dla kasy. Po kroku 1 nie zostaje w daemonach.
- Kolory rodzin: Splicer `--cyan`, Ghost `#b9a6ff`, Runner `#f0b35a`, Cron `#c6e46b` (`.c-<rodzina>{--fc}`).
- Komórki matrycy nigdy nie barwią się kolorem rodziny.
- Komentarze w kodzie po angielsku, krótkie.
- Commit tylko własnych plików. Jeśli `src/style.css` lub `src/ui.ts` mają niezacommitowane zmiany innej sesji, pytaj przed commitem.

## Na co uważać przy review
1. Telefon (375 px): faktura i glif nie mogą zasłaniać nazwy daemona ani tekstu efektu.
2. Karty w sklepie, ofercie, katalogu i liście swapów (`.dlist`) dostają ten sam wygląd co w panelu daemonów, bo wszystkie idą przez `card()`.
3. Moduły `spent`/`unused` (opacity) z materiałem nadal czytelnie „przygaszone”.
4. Odcień planszy musi zniknąć po sprzedaży/zamianie daemona (spadek poniżej 3) i w trybach bez daemonów (daily, training, sprint).
5. Co-processor: daemon w gnieździe liczy się do rodziny, jeśli jest w `R.daemons`.

Sprawdzenie każdego z punktów: przeglądarka (dev server z `.claude/launch.json`, cheat panel w katalogu dodaje daemony i itemy), zrzut na desktop + `resize_window` mobile.

---

### Zadanie 1: Daemony (faktury, glif, legendary bez złota)

**Pliki:**
- Modyfikuj: `src/ui.ts:461-462` (funkcja `card()`): dodaj glif w tle karty.
- Modyfikuj: `src/style.css:197-293` (blok kart daemonów).
- Modyfikuj: `docs/DESIGN.md`, tabela kolorów sekcja 2: złoto „tylko kasa”, bez „(i legendary)”.

**Interfejsy:** brak nowych. Glif to ta sama ścieżka co `ICONS[id]`.

- [ ] **Krok 1:** w `card()` wstaw w `.dbody` drugi `<svg class='dwm' viewBox='0 0 24 24' aria-hidden='true'>` z `ICONS[id]`.
- [ ] **Krok 2:** CSS `.dwm`: absolutnie przy prawej krawędzi, wysokość ~90% karty, `stroke:var(--fc)`, krycie ~0.12, pod tekstem (`z-index` niższy niż `.dmain`), `pointer-events:none`.
- [ ] **Krok 3:** faktury w tle `.dbody` per rodzina (`.c-splicer .dbody` itd.), dodane do obecnego gradientu, każda ≤ 16% krycia koloru rodziny:
  - Splicer: ukośne włókna `repeating-linear-gradient(135deg, …1px, transparent 1px 5px)`;
  - Ghost: mgła, czyli miękki `radial-gradient` + drobne kropki szronu;
  - Runner: poziome linie co ~5 px;
  - Cron: podziałka zegara, krótkie pionowe kreski co ~8 px tylko w górnym pasku 4 px.
- [ ] **Krok 4:** legendary bez złota:
  - `--legend` z `#ffd23f` na perłowo-biały holo (np. `#f3e9ff`);
  - `--metal` legendary (płatek rogu) z gradientu złota na tęczowy holo z tych samych barw co ramka;
  - z `--hc` ramki usuń `#ffd23f`;
  - w keyframes glitcha (`tearL`, `rgbL`) `var(--legend)` może zostać, bo zmienia się sama zmienna.
- [ ] **Krok 5:** popraw komentarze CSS, które mówią „gold” przy legendary (linie ~208, 220, 243, 254), i tabelę w `docs/DESIGN.md`.
- [ ] **Krok 6: weryfikacja.**
  - `npx tsc --noEmit -p .` ma przejść bez błędów.
  - Dev server, w cheat panelu dodaj po jednym daemonie z każdej rodziny i wszystkich rzadkości. Zrzut panelu daemonów: desktop i mobile, plus sklep.
  - Pokaż graczowi i poczekaj na jego ocenę. Poprawki wprowadź przed commitem.
- [ ] **Krok 7: commit.** `git add src/ui.ts src/style.css docs/DESIGN.md` i `git commit -m "Daemons: family glass textures, big glyph, legendary holo without gold"`.

### Zadanie 2: Rack (materiał panelu, pasek koloru komórki, tabliczka wersji)

**Pliki:**
- Modyfikuj: `src/ui.ts:645-656` (budowa `$('items')`, markup `.unit hw`).
- Modyfikuj: `src/style.css:450-612` (blok racka).

**Interfejsy:**
- Produkuje: `const MATERIAL: Partial<Record<ItemId, 'pcb' | 'anod' | 'steel' | 'net'>>` w `ui.ts` obok kodu racka (używa tylko rack).
- Produkuje: `const MARK: Partial<Record<ItemId, string>>`, czyli kolor CSS paska.

- [ ] **Krok 1:** `MATERIAL` wg specu:
  - pcb: buffer1/2, linker1/2, prio1/2, socket;
  - anod: datanode/2/3, thumb/2/3, chip, sim;
  - steel: wildcard1/2, shortkey, sidedoor, repeater, glob, heatsink, rewind;
  - net: bridge/2, ping, mux, split1/2, loopback1/2;
  - brak wpisu = obecny szary panel.
- [ ] **Krok 2:** `MARK`, czyli ten sam kolor co znak na planszy:
  - wildcard1/2, glob: `var(--pink)`;
  - repeater: `var(--violet)`;
  - datanode/2/3: `var(--data)`;
  - ping: kolor jego znacznika na planszy (sprawdź klasę komórki Ping w `style.css`).
- [ ] **Krok 3:** w markupie modułu dodaj:
  - klasę `m-<materiał>`;
  - przy `MARK` styl `--k:<kolor>` i `<i class='strip'></i>` jako pierwsze dziecko;
  - dla id kończących się na `2`/`3` tabliczkę `<i class='vplate'>v2</i>` / `v3` tuż za pierwszą śrubą.
- [ ] **Krok 4:** CSS:
  - materiały z makiety: `pcb` `linear-gradient(#132a1f,#0e1f17)` z ramką `#2b5a40`, `anod` szczotkowany niebieski `#1b283a→#131c29` z ramką `#2c4562`, `steel` szczotkowana stal `#262b2f→#1c2023` z ramką `#454e54`, `net` `#0b0d0f`;
  - `.strip`: 3 px przy lewej krawędzi w `var(--k)`;
  - `.vplate`: mała prostokątna tabliczka metalowa (jasnoszary gradient, ciemny tekst 8 px, bez świecenia);
  - hover, LED i stany `spent`/`unused` bez zmian.
- [ ] **Krok 5: weryfikacja.**
  - `npx tsc --noEmit -p .` bez błędów.
  - Dev server, w cheat panelu dodaj itemy wszystkich 4 materiałów, w tym jeden v2 i jeden v3. Zrzut racka: desktop i mobile, plus sklep („your rack”).
  - Pokaż graczowi i poczekaj na ocenę.
- [ ] **Krok 6: commit.** `git commit -m "Rack: panel materials by hardware kind, cell-colour strip, version plate"`.

### Zadanie 3: Odcień planszy od rodziny

**Pliki:**
- Modyfikuj: `src/ui.ts`, funkcja `render()` (`src/ui.ts:139`), przy `$('grid')`.
- Modyfikuj: `src/style.css`, po stylach `.pane` matrycy.

**Interfejsy:**
- Produkuje: `const famTint = (ids: DaemonId[]): string | null`, czyli nazwa rodziny (lowercase), gdy ≥3 daemony z `ids` mają tę rodzinę, w innym wypadku `null`.

- [ ] **Krok 1:** `famTint` w `ui.ts`; w `render()` ustaw na `$('grid').closest('.pane')` klasy `tint` + `c-<rodzina>`, gdy jest wynik, albo je usuń. Poza runem (brak `R`) zawsze usuń.
- [ ] **Krok 2:** CSS `.pane.tint`:
  - ramka panelu w `color-mix(in srgb,var(--fc) 45%,var(--line))`;
  - etykieta panelu w `var(--fc)`;
  - tło `#grid` dostaje fakturę rodziny z Zadania 1 przy ~6% krycia. Wydziel faktury do zmiennych `--tex` na `.c-<rodzina>`, żeby karta i plansza używały tej samej definicji;
  - komórki bez zmian.
- [ ] **Krok 3: weryfikacja w przeglądarce.**
  - 3 Ghosty dają odcień, a po sprzedaży jednego odcień znika;
  - 2+2 zostaje neutralne;
  - tryb daily nie ma odcienia;
  - zrzut desktop i mobile. Pokaż graczowi.
- [ ] **Krok 4: commit.** `git commit -m "Matrix: family tint on frame and glass with 3+ daemons of one family"`.

### Zadanie 4 (po akcepcie wszystkich trzech): screenshoty itch
- [ ] Zaproponuj graczowi nowy zestaw zrzutów wg skilla `bypass-promo-media`. Nie rób ich bez zgody.
- [ ] Odhacz „Fotogeniczność” w `.notes/00_START_HERE.md` sekcja 6 i dopisz datę.
