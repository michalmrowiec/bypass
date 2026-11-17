# Run script: ładowanie, lot kodów, terminal, exit at end

## Po co
`./run` miga teraz jak zwykłe picki. Skrypt ma wyglądać jak program, który się wykonuje: szybko, programistycznie, z satysfakcją na końcu. Makieta: `.notes/runfx.html` (wariant 5, zaakceptowany przez gracza).

## Co budujemy
1. **Ładowanie planu**: po `./run` zaplanowane komórki zapalają się po kolei jednym błyskiem (ok. 60 ms na krok, wypełnienie cyjanem od dołu).
2. **Lot kodów**: każdy krok wylatuje z komórki do swojego slotu w buforze (ok. 260 ms, start co ok. 140 ms, loty zachodzą na siebie). Slot łapie kod z dekodowaniem (istniejący `scramble`), komórka zostaje zużyta. Kolor lotu: cyjan.
3. **Terminal pod macierzą**: stały widok istniejącego logu `R.events` (ostatnie ~5 linii, auto-scroll), zawsze widoczny w runie. Pokazuje picki ręczne i ze skryptu, uploady (`--done`), itemy, ICE. Skrypt dopisuje `$ ./run · N steps`. Disconnect, nieudane cele i ICE na różowo (`--pink`). `[ log ]` zostaje jako pełny podgląd.
4. **Exit at end**: checkbox „exit at end” widoczny w trybie `[ script ]`, odznacza się po każdej matrycy; zaznaczony zmienia przycisk na `[ ./run && exit ]`. Zaznaczony: po ostatnim kroku skryptu auto-disconnect (jak przycisk DISCONNECT). Odznaczony: terminal pisze `script done`, gra trwa.
5. **Finał** (gdy skrypt się kończy: pełny bufor, wszystkie cele, exit lub `script done`), dwa różne efekty po sobie:
   - bufor: fala „checksum”, każdy wypełniony slot po kolei (co 55 ms) dekoduje się jeszcze raz, a jego ramka na moment zapala się mint;
   - cele: na każdym wgranym celu pasek uploadu wypełnia tło od lewej do prawej (ok. 420 ms, co 120 ms) i gaśnie.
6. **Rachunek z opóźnieniem**: gdy runda kończy się ze skryptu, okno wyniku otwiera się zaraz po ostatnim pasku uploadu.
7. **Delikatne wejście okna wyniku** (zawsze, nie tylko po skrypcie): tło przyciemnia się płynnie, a okno wjeżdża z lekkim fade i uniesieniem o kilka pikseli (ok. 200 ms) zamiast pojawiać się skokowo. Bez efektów wychodzących poza okno.

## Poza zakresem
- Linia ścieżki (gracz odrzucił dla skryptu). Osobny pomysł: cienka linia pod tekstem przy daemonie Runner od krzyżowania.
- Zmiany w `playBill` i w `src/roguelike.ts`.
- Ręczny pick zostaje jak teraz (tylko jego linia trafia do terminala).

## Anty-cele
- Długie animacje: cały skrypt z 6 krokami trwa poniżej ~1 s, plus połysk.
- Ślad po skrypcie zostający na planszy.
- Złoto, migotanie całej planszy, więcej niż 1–2 efekty na komórkę.
- Akcja gracza w trakcie dalej przerywa skrypt od razu (`[ ^C ]`). `prefers-reduced-motion`: bez ładowania, lotu i połysku; terminal zostaje.

## Podejścia (rozważone w makiecie)
1. Sam lot kodów: ładny, ale za wolny i mało programistyczny.
2. Ładowanie + kaskada: ładowanie za długie.
3. Terminal: pasuje do idei skryptu; gracz chce go na stałe.
4. Ładowanie + lot: za długie.
5. **Wybrany**: krótkie ładowanie, szybki nakładający się lot, stały terminal, exit at end, połysk, opóźniony rachunek.

## Dla wykonawcy (moje decyzje)
- Lot to element `position:fixed` nad stroną, animowany WAAPI, usuwany po lądowaniu. Stan gry zmienia się od razu (jak teraz), lot jest tylko wizualny: slot pokazuje kod dopiero po lądowaniu.
- Terminal renderuje się w `render()` z `R.events`, klasy kolorów z prefiksu linii (upload, ICE, disconnect).
- Telefon: terminal 3 linie, ta sama logika.
