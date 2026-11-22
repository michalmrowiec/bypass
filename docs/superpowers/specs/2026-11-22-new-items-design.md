# Nowe itemy i moduły 2U (2026-11-22)

## Po co

Run Argus 94457483: ~20 unikalnych itemów, półka 4, tani reroll, więc w jednej wizycie widać prawie całą pulę. Idealny zestaw (Wildcard v2, Mux, Bridge v2) przychodzi prawie zawsze, build się zbiera, a nie szuka. Cel: większa pula, w której częściej trzeba składać synergię z tym, co już masz i co pokazał sklep. Gracz, który kmini nad idealną ścieżką, dalej ma dostawać dużo punktów.

## Cele

- 10 nowych itemów; większość wiąże się z buildem **przez mechanikę** (nagradza to, co robi rodzina, ale działa każdemu), 2 pod hands.
- Mocne itemy płacą **miejscem w racku (2U)**, nie rzadkością.
- Bonus pasywnych itemów widać na rachunku albo na planszy.

## Poza zakresem

- **Rzadkość itemów** (odrzucona: za dużo warstw obok poziomów, 2U i mechanik).
- **Jammer** (odłożony do trudniejszych ICE), **Server blade** (odrzucony: z Buffer v2 + Overflow za mocny dla Ghosta), **Portal** (cecha planszy, nie item).
- Zmiana rozmiaru innych itemów ruchu: Wildcard v2 i Mux zostają 1U.

## Podejścia (rozważone)

1. **Rzadkość itemów** (waga w losowaniu półki albo kość rzadkości na miejsce, jak daemony). Odrzucona przez gracza: komplikuje system.
2. **Większa pula + koszt w slotach 2U** (wybrane). Pula rozrzedza się sama; mocne rzeczy kosztują miejsce, więc mieści się ich mniej.

## Zasady 2U

- Item ma rozmiar 1U (domyślnie) albo 2U. Zajmuje tyle slotów racka; kupno wymaga tylu wolnych slotów, sprzedaż tyle zwalnia.
- Upgrade może zmienić rozmiar: **Bridge v2 = 2U** (v1 = 1U). Kupno Bridge v2 przy pełnym racku wymaga 1 wolnego slotu ponad Bridge v1.
- Moduł 2U ma w UI podwójną wysokość.

## Itemy

Liczby to punkt startowy do simu.

| Item | U | Cena | Pasuje | Zasada |
|---|---|---|---|---|
| **Null pad** | 1 | 3 | Ghost | +8 data za każdy pusty slot bufora w matrycy z uploadem |
| **Zip tie** | 1 | 4 | Splicer | uploadowany target, który dzieli kody z innym uploadowanym, płaci +50% data |
| **Slingshot** | 1 | 3 | Runner | najdłuższy ruch matrycy: +10 data za każdą komórkę, którą przeskakuje |
| **UPS** | 2 | 5 | Cron | raz na pokój przerwana seria (Heartbeat, Rotate, Backup, Uptime, Cache…) nie traci stacków; dioda gaśnie po użyciu |
| **Hotkey** v1 / v2 | 1 | 3 / 3 | hands | przy zakupie wybierasz hand; dopóki item jest w racku, ma +2 (v2: +3) poziomy |
| **Compiler** | 2 | 6 | hands | co 3 zagrania handu, który zapunktował, ten hand dostaje +1 poziom na stałe (zostaje po sprzedaży) |
| **Bitshift** | 1 | 4 | narzędzie | raz na matrycę, przed ruchem, obracasz kody jednego targetu cyklicznie (`A B C` → `B C A`) |
| **Overclock** | 2 | 8 | każdy | cały wynik matrycy ×1,5, osobna linia na rachunku |
| **Exploit** v1 / v2 | 1 | 3 / 3 | ekonomia | w każdej matrycy 1 (v2: 2) komórka oznaczona `$` (złoto = kasa); jej pick daje +$1 |
| **Snapshot** | 1 | 5 | mistrz ścieżki | raz na pokój, po matrycy z kompletem targetów: następna matryca to ta sama plansza, z poprzednim skryptem wczytanym do edycji |

## Decyzje gracza

- **UPS zmieniony** (2026-11-22, po wdrożeniu): raz na pokój było zbyt OP i zwalniało z myślenia przy Cronie. Teraz jeden ładunek, a w sklepie „Replace battery” za $2 (UPS_BATTERY). Zostaje 2U.

- **Slingshot usunięty** (2026-11-22, po wdrożeniu): prawie dublował daemona Long jump; zostaje 9 nowych itemów.

- Mechanika zamiast nazwy rodziny; mieszanka z 2 itemami pod hands.
- UPS mocny, więc 2U; Compiler 2U; Overclock 2U i drogi; Bridge v2 2U.
- Hotkey wzmocniony do +2/+3 (mocny na początku runu, to OK).
- Exploit wraca w wersji „+$1 za pick oznaczonej komórki”.
- Snapshot = klon matrycy (prawdziwy snapshot: sklonowane środowisko). Gracz zauważył, że bez zapisu trzeba by kminić od nowa.

## Moje decyzje (do sprawdzenia)

- Snapshot wczytuje poprzedni skrypt (stąd „snapshot” stanu, nie tylko planszy) i wymaga kompletu targetów, żeby nie był wentylem po złej matrycy.
- Snapshot nie dodaje matrycy, tylko zastępuje następną nową planszę znaną. Bez quoty do dobicia przegrywa z wcześniejszym wyjściem (+$3 za matrycę). Mocny z Overtime (nadwyżka przechodzi dalej), Painter (cała trasa już pomalowana), Warm-up i Heartbeat; kontra: Rotate (ten sam start resetuje). Sprawdzić w simie, czy z Overtime nie jest OP.
- Snapshot jest opcjonalny: po spełnieniu warunków podsumowanie matrycy pokazuje przycisk powtórki.
- Slingshot liczy długość najdłuższego ruchu (komórki odległości), ×10 data.
- Bitshift: jeden target na matrycę, ale dowolnie wiele kroków obrotu przed pierwszym ruchem.
- Null pad +8 zamiast +12 (gracz: „może za mocny”).
- Exploit: `$` nie leży na komórce `**` ani ×2; pick daje kasę od razu, także przy późniejszym Disconnect. Pilnować w simie łącznie z Credit chip (wcześniejszy farm kasy).
- Compiler: liczą się zagrania handu, który dał punkty w matrycy; poziomy zostają po sprzedaży modułu.
- Zip tie: +50% na każdy target z co najmniej 1 wspólnym kodem, liczone przed mnożnikami.
- Kolory nowych znaczników: `$` złoty (Exploit); reszta bez znaczników na planszy.

## Dla buildera

- Pole rozmiaru w `Item` i obsługa w `rackFull`, `buy`, sprzedaży, UI racka; test rozmiaru przy upgradzie (Bridge v2).
- Każdy item: efekt w obliczeniu rachunku/planszy, wpis w GAME_STATE.md, wzorzec w `.notes/sim.test.ts` (inaczej trafi do „Not in any pattern”).
- Snapshot: zapis planszy i skryptu, powtórzenie jako następna matryca pokoju (licznik matryc pokoju się nie zmienia).
- Bitshift: działa przed pierwszym ruchem jak Split; zgodny ze skryptem.
- Sim po wszystkim: win rate per firma, czy któryś item jest martwy albo obowiązkowy.
