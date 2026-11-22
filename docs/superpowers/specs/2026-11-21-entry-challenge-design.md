# Wejścia #2 i #3 jako wyzwania (2026-11-21)

## Po co

Wejście #1 każdej firmy to podstawa: średnio ogarnięty gracz ją przejdzie, a trudność rośnie z firmą (Kestrel → Meridian → Ashgrove → Argus). Wejścia #2 i #3 mają być dla graczy, którzy lubią wyzwanie. Dziś są bocznym wyborem (plus i minus), a część jest w sumie łatwiejsza od #1. Przykład: Argus #2 „Signal flaw” (minus „jedna rodzina daemonów, wybrana na starcie”) z wybranym Ghostem dał łatwą wygraną z 1 pickiem na matrycę.

## Cele

- W każdej firmie: #1 < #2 < #3 pod względem trudności (w sumie, z plusem wliczonym).
- Każde wejście zaprojektowane ręcznie dla swojej firmy. Zwykle wyższe kwoty, czasem ograniczenia, narzucony styl, konkretny ICE, czasem bonus. Nie musi rosnąć równo.
- Wszystko deterministyczne: żadnego losowania zasad wejścia (np. stała rodzina „Cron”, a nie losowa ani wybierana).
- Styl gry zawężony, ale nie wymuszony: zostaje wybór daemonów w rodzinie i wybór itemów.

## Poza zakresem

- Wspólna drabinka trudności („heat”) dla wszystkich firm.
- Nowe firmy i więcej niż 3 wejścia (`entriesOpen` zostaje max 3).
- Haki/skrypty z własną logiką dla wejść.

## Czego unikać (porażka, nawet jeśli działa)

- Pierwszy pokój niewykonalny: jego kwota nie może przekroczyć sumy danych ze wszystkich targetów bez ulepszeń.
- Minus, który dobrym wyborem zmienia się w plus (jak Signal flaw + Ghost).
- Wejście z jednym jedynym buildem, który w ogóle działa.

## Podejścia

- **A. Przebudowa danych wejść + kilka nowych pól `Entry`** (wybrane). Mało kodu, każde wejście ręcznie, większość pracy to balans w symulatorze.
- B. Wspólne kary dla każdego #2/#3 + charakter wejścia. Odrzucone: kary byłyby takie same w każdej firmie, a gracz chce różnie.
- C. Wejścia jako skrypty z hakami na zdarzenia. Odrzucone: dużo kodu na zapas, A pokrywa wszystko, co dziś potrzebne.

## Nowe pola `Entry` (ustalone z graczem)

| pole | znaczenie |
|---|---|
| `quotaGrowth?: number` | wzrost kwot na iterację dla tego wejścia, zamiast `QUOTA_GROWTH` (2.5). Iteracja 1 bez zmian, więc pierwszy pokój zostaje wykonalny. |
| `family?: Family` | stała rodzina daemonów w ofertach. Zastępuje `familyLock` (wybór na starcie). |
| `noSell?: true \| ItemId[]` | `true`: żadnego itemu nie da się sprzedać. Lista: tylko te itemy (np. `['sim']` przy „zaczynasz z Burner SIM”). |
| `banned?: ItemId[]` | te itemy nigdy nie pojawiają się w sklepie na tym wejściu. |

Mnożnik kwot na iteracjach (dla porównania): 2.5 → it3 ×6.25; 2.7 → ×7.29 (+17%); 2.9 → ×8.41 (+35%); 3.0 → ×9.0 (+44%).

`quotaMult` zostaje w typie, ale nowe wejścia go nie używają (podnosi też pierwszy pokój).

## Propozycja 8 wejść (moje propozycje, do poprawki przez gracza; liczby do sprawdzenia w symulatorze)

Każde wejście zachowuje nazwę i klimat. Teksty `plus`/`minus` po angielsku, jak dziś.

### Kestrel (najłatwiejsza)

- **#2 Courier tablet.** Plus: start z Mux v1 (stały, zamiast losowego narzędzia z `startTool`). Minus: półka 3 moduły; Mux nie do sprzedania; `quotaGrowth` 2.7.
- **#3 Dock scanner.** Plus: single.bin i multi.bin na Lv3. Minus: brak Linker v1/v2 w sklepie (styl: krótkie uploady, nie łańcuchy); `quotaGrowth` 2.9. `quotaMult` 1.15 usunięty.

### Meridian

- **#2 Night shift.** Plus: oferty daemonów pokazują 4 karty. Minus: tylko rodzina Runner (decyzja gracza); moduły, patch.zip i sloty racka $1 drożej; `quotaGrowth` 2.7.
- **#3 Phishing.** Plus: linked.bin i all_linked.bin na Lv3. Minus: brak Disconnect; nie można sprzedawać itemów (`noSell: true`); `quotaGrowth` 2.9.

### Ashgrove

- **#2 Partner's phone.** Plus: start z Burner SIM. Minus: Dead cells w każdym pokoju; Burner SIM nie do sprzedania; `quotaGrowth` 2.7.
- **#3 Paper trail.** Plus: wybór boss ICE z puli firmy na starcie. Minus: każda łatka dodaje 2 reguły ICE; brak Rewind i Burner SIM w sklepie („nic się nie cofa”); `quotaGrowth` 2.9.

### Argus (najtrudniejsza); kolejność wejść bez zmian

Moja decyzja: nie zamieniam kolejności. `entriesOpen` odblokowuje wejścia po pozycji, więc zamiana podmieniłaby odblokowane wejście graczom z itch.io. Zamiast tego Signal flaw (#2) jest łagodniejszy, a Fibre tap (#3) ostrzejszy.

- **#2 Signal flaw.** Plus: każdy payload na Lv2. Minus: tylko rodzina Runner (stała, bez wyboru); `quotaGrowth` 2.7.
- **#3 Fibre tap.** Plus: start z Linker v1. Minus: Linker nie do sprzedania; brak Wildcard v1/v2 w sklepie; półka 3 moduły; `quotaGrowth` 3.0.

## Co trzeba zmienić w kodzie (dla wykonawcy)

- `src/roguelike.ts`:
  - `quota()`: `(entryOf(s).quotaGrowth ?? QUOTA_GROWTH) ** s.loop`.
  - `offerDaemons()`: rodzina z `entryOf(s).family`; usunąć `familyLock`, `setFamily` i krok `'family'` w `needsStartChoice` (plus wywołania w `ui.ts`). Zapisany run w toku: rodzina wejścia ma pierwszeństwo przed starym `s.family` (moja decyzja). Gdy w rodzinie brakuje daemonów na pełną ofertę (pominięte posiadane i te z `lastOffer`), oferta dopełnia się daemonami z poprzedniej oferty (decyzja gracza).
  - `forSale()`: odfiltrować `entryOf(s).banned`. Nagrody nie dają itemów (`payReward`), więc nic więcej nie trzeba.
  - `sell()`: odmowa dla zablokowanych itemów. Lista `noSell` obejmuje całą linię itemu (`olderVersions`): kupienie Linker v2 jest dozwolone, ale v2 też nie da się sprzedać (moja decyzja, inaczej upgrade omija minus).
  - Courier: `startItems: ['mux']` zamiast `startTool`.
  - dane 8 wejść jak wyżej; kolejność wejść bez zmian.
- `src/ui.ts`: zablokowany item w racku bez przycisku sprzedaży (z podpowiedzią dlaczego); usunąć ekran wyboru rodziny.
- `src/roguelike.test.ts`: testy nowych pól (kwota it2/it3 z `quotaGrowth`, rodzina w ofercie, `banned` w półce, `noSell` lista i `true`).
- `docs/GAME_STATE.md`: tabela wejść.
- `.notes/00_START_HERE.md`: decyzja z datą i wynikami symulatora.

## Jak sprawdzić, że działa

- Symulator (`SIM_ENTRY` 0/1/2 dla każdej firmy, skill `bypass-balance-sim`): w każdej firmie win rate głównych profili botów spada #1 → #2 → #3. Szum przy 20 runach to ±10 pp, więc różnica musi być większa albo trzeba więcej runów.
- Pierwszy pokój każdego wejścia: kwota ≤ suma danych ze wszystkich targetów.
- `npx vitest run src` przechodzi.

## Pozostawione wykonawcy

- Dokładne liczby `quotaGrowth` po symulatorze (2.7 / 2.9 / 3.0 to punkt startu).
- Gdy sam `quotaGrowth` nie daje #1 < #2 < #3, wykonawca może ruszyć inne pokrętła w klimacie wejścia (półka, bany, siła plusa), ale pokazuje graczowi wyniki symulatora przed commitem (moja decyzja). Główne profile botów do porównania: wszystkie z `ALL_PROFILES` poza `casual` i `painter` (te leżą przy 0% poza Kestrelem).
- Wygląd blokady sprzedaży w racku (w obecnym stylu; glass/classic).
