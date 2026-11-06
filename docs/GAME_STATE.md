# BYPASS: co już jest w grze (stan 2026-11-06)

> Jedno źródło prawdy o stanie gry. Liczby pochodzą z `src/roguelike.ts`. Gdy coś się zmieni, popraw tutaj.

## 1. Tryby
- `0:daily`, `1:training` (5×5 / 6×6 / 7×7) i `2:sprint` (3 / 5 macierzy na czas). Stare tryby, nie ruszamy.
- `3:run` to tryb roguelike opisany niżej.

## 2. Rdzeń
- Macierz kodów, wybór naprzemiennie wiersz / kolumna, start w górnym wierszu.
- Bufor ma długość zaplanowanej trasy plus zapas (`slack`) z itemów. Rośnie z targetami, nie z rozmiarem macierzy.
- Target to ciągła sekwencja w buforze. Dane za target wg długości: 2 kody → 10, 3 → 25, 4 → 45, 5 → 70, 6 → 100.
- **Wynik macierzy = (dane + płaskie bonusy) × (1 + boosty) × mnożniki.** Na żywo widać podgląd i rachunek.
- Macierz zalicza się od 1 wgranego targetu. Kończy się, gdy żaden target nie jest osiągalny, albo przez **Disconnect** (od 1 targetu).
- Generator gwarantuje, że wszystkie targety są osiągalne. Solver zna itemy (Bridge, Loopback, Repeater, Rewind, Corruption).

## 3. Run
- **Run = jedna firma.** Pokoje mają po kilka macierzy i próg danych (quota). Brak progu kończy run.
- Po każdym pokoju jest **darmowy wybór 1 z 3 daemonów** (można pominąć), potem **sklep**.
- Ostatni pokój to **SOC** (boss) z ICE z puli firmy.
- **3 iteracje** (`LOOPS`). Po SOC firma się łata („Patch notes”: 1 ICE do losowego pokoju) i rundy lecą od nowa.
  - Progi ×2,5 na iterację (`QUOTA_GROWTH`).
  - Od 2. iteracji najdłuższy target ma +1 kod.
  - 3. SOC oznacza firmę zhakowaną i odblokowuje następną.
- Zapis runu: checkpoint plus log akcji (replay). Jest też eksport i import save'a.
- Na koniec runu jest podsumowanie (×quota przy każdym pokoju). Rekord to suma danych + czas, widoczny jako „best” na karcie firmy.
- Wybór firmy: karuzela kart 3D. Następna zablokowana firma jest widoczna w pełni, dalsze jako „???”.

## 4. Firmy
Każda firma ma własne kody, logo, etykiety wierszy i kolumn oraz motyw w tle.

| firma | pokoje (rozmiar, macierze, próg it1) | ICE bossa | łatki |
|---|---|---|---|
| **Kestrel Logistics** (spedycja) | Reception 5×5·1·25 → Offices 6×6·2·90 → Server Room 7×7·3·320 → SOC 7×7·2·250 | Firewall, Throttle, Blackout | + Corruption |
| **Meridian Health** (szpital) | Lobby 6×6·1·50 → Wards 7×7·2·150 → Records 8×8·2·300 → SOC 8×8·2·400 | + Encryption | + Encryption |
| **Ashgrove & Pike** (kancelaria) | wszystko 5×5: Lobby 30 · Mailroom 45 · Paralegals 100 · Partners 140 · Archive 180 · Vault 220 · SOC 260 | + Honeypot, Dead cells | + Honeypot, Dead cells |

Każda firma ma ICE poprzedniej i dokłada własne.

## 5. ICE
- **Firewall:** zablokowany wiersz albo kolumna `##`, nigdy wiersz 0.
- **Throttle:** bufor −1.
- **Blackout:** targety `??` do pierwszego ruchu.
- **Corruption:** wybór blokuje 4 sąsiadów na N ruchów. Licznik rośnie z łatkami, od 3. łatki blokada jest na stałe.
- **Encryption:** kody `??` poza linią wyboru.
- **Honeypot:** pułapka poza trasą, ×0,5 wyniku.
- **Dead cells:** 2–3 martwe pola `##`.

Wszystkie ICE mogą się sumować. Timeout odrzuciliśmy, bo czas zostaje dla Hot breach.

## 6. Daemony (software, pliki `.dmn`)
- **Sloty:** 4. Piąty daje item Co-processor. Wymiana daemona przy pełnych slotach kosztuje $6.
- **Rzadkość w ofercie:** common 70%, rare 25%, legendary 5%. Ramka i foil zależą od rzadkości.
- **Zasięg:** `◇ matrix`, `▣ room` (przerywana ramka), `∞ run` (stack, podwójna ramka).
- Kolejność daemonów zmienia się przytrzymaniem i przeciągnięciem. Jest tylko kosmetyczna.

| rodzina | daemony |
|---|---|
| **Splicer** (nakładanie) | Chain (rare), Compressor, Full stack (legendary), Deflate (legendary), Joker (rare), Saturate ×1,25 (rare), All-in ×2/×0,5 (rare) |
| **Ghost** (minimalizm) | Overflow, Light footprint (legendary), Silent, Cache (rare, stack), Echo (rare), Sandbag (rare, room) |
| **Runner** (geometria) | Long jump, Corner, Zigzag (rare), Crawler |
| **Cron** (serie) | Heartbeat (rare), Rotate (+7), Backup (rare), Uptime (+7), Overtime (rare, room), Warm-up (room) |

Pełne opisy są w `DAEMONS` w `src/roguelike.ts`.

## 7. Itemy (hardware w racku)
- **Rack:** 4 sloty, dokup do 9 (coraz drożej). Sprzedaż za połowę ceny.
- Upgrade v1.0 → v2.0 pojawia się tylko, gdy masz v1.0, i nie zajmuje nowego slotu.
- Każdy item ma własną ilustrację SVG z animacją na hover (`src/gear.ts`).
- Gotowy do użycia item w racku pulsuje. Klik go uzbraja.

| item | cena | efekt |
|---|---|---|
| Buffer v1/v2 | 4/4 | +1 / +2 slot bufora |
| Short key | 3 | najdłuższy target −1 kod, bufor bez zmian |
| Linker v1/v2 | 4/4 | +1 połączenie targetów; v2 jedno połączenie na 2 kody |
| Wildcard v1/v2 | 4/4 | komórka `**` pasuje do wszystkiego; v1 losowa poza trasą, v2 wybierasz (nie na ×2) |
| Data node | 3 | komórka +15 data |
| Split v1/v2 | 4/3 | przed 1. ruchem tniesz target; v1 w losowym miejscu, v2 tam, gdzie chcesz |
| Side door | 3 | pierwszy wybór z dowolnej krawędzi |
| Bridge | 5 | raz na matrycę skok na dowolną wolną komórkę (pod Encryption widzi tylko 8 pól wokół) |
| Loopback v1/v2 | 3/3 | ponowny wybór zużytej komórki; v1 w linii, v2 dowolnej |
| Thumb drive | 2 | +5 data, gdy matryca coś wgra |
| Credit chip | 2 | +$1 za zaliczony pokój |
| Ping | 2 | zaznacza start rozwiązania |
| Heatsink | 2 | Corruption krótsza o 1 ruch |
| Burner SIM | 3 | raz na pokój, przed 1. ruchem, nowa macierz (klik w rack) |
| Glob | 4 | jeden kod targetu staje się `**` |
| Repeater | 3 | komórka `×2` (fiolet) wrzuca kod dwa razy |
| Rewind | 4 | raz na matrycę cofasz ostatni pick, kod zostaje |
| Mux | 3 | raz na matrycę następny ruch w tej samej albo krzyżującej się linii |
| Co-processor | 8 | +1 slot daemona |

## 8. Bonusy (cele bonusowe)
- **1 matryca na iterację** (`BOUNTIES_PER_LOOP`), nigdy w SOC. Na starcie pokazuje się plansza celu, która znika po kliknięciu „Got it” albo po pierwszym ruchu.
- **Cele:**
  - **Surgical:** wszystkie targety w liczbie picków nie większej niż zaplanowana trasa.
  - **Corners:** start i koniec w rogu.
  - **Clean:** upload z 3+ pustymi slotami bufora.
  - **Full house:** wszystkie targety przy pełnym buforze.
  - **Bare hands:** upload bez użycia itemu.
  - **Tiptoe:** żaden ruch dłuższy niż 2 pola.
  - **Wild:** 2 targety przez `**`; tylko z Wildcardem.
- **Nagroda:** na podsumowaniu klikasz „Roll reward”, losują się **2 nagrody** i wybierasz jedną. Dalej da się przejść dopiero po odbiorze.
  - +$5;
  - 3 darmowe rerolle;
  - +2 stacki na każdym daemonie ze streakiem (tylko gdy masz taki daemon);
  - legendary na czele następnej oferty;
  - **ładunek ×2 data**: consumable w cyjanowej ramce, aktywowany ręcznie na dowolnej późniejszej matrycy, 1 na matrycę, ładunki się zbierają.
- Odebrane bonusy są oznaczone w następnej ofercie i sklepie. Pokój, w którym był bonus, ma szary badge w kontrakcie.

## 9. Ekonomia
- **Nadwyżka:** $1 za każde 20 danych ponad próg, maks. $3 na pokój.
- **Inne źródła:** +$1 za pokój; +$1 za matrycę z wgranymi wszystkimi targetami.
- **Puste sloty bufora:** $1 za każde 2, gdy matryca skończy się sama; po Disconnect $1 za każde 3. Daemon Silent dokłada do tego +$2.
- **Koszty:** reroll oferty $1, półka w sklepie ma 3 itemy.

## 10. UI (najważniejsze)
- **Kontrakt:** pokoje, pola z wynikami macierzy, ICE i łatki, badge bonusu, licznik kredytów i danych pokoju.
- **Bufor:** licznik `n/l` (z Throttle). Sloty z itemów mają delikatną przerywaną ramkę, zabrane przez Throttle są czerwone `##`.
- **Podgląd daemonów pod macierzą:** wartość teraz, przyrost albo utrata.
- **Podświetlanie kodów:** kod spod kursora jest podkreślony w targetach. Najechanie na kod w targecie obrysowuje jego komórki w macierzy.
- **Podsumowania:** osobne po matrycy, po pokoju i po runie. Na każdym jest przycisk **View matrix** (Esc albo klik wraca).
- **Pozostałe:** katalog z zakładkami daemons / items / bonuses / ice, tooltipy, briefing z animowanym hakerem, motywowy scrollbar.

## 11. Narzędzia
- **Symulator balansu** (lokalnie, poza repo): `npx vitest run .notes/sim.test.ts`, wynik trafia do `.notes/sim-out.txt`.
  - Robi pełne runy po zaplanowanej trasie na stałych buildach (none / commons / splicer / topfull / drafted).
  - Nie zna itemów, Encryption ani Honeypota.
  - ⚠ Ostatni wynik jest sprzed wydłużenia targetów od 2. iteracji.
- **Wnioski z ostatniego symulowania:** same progi są OK. Łatwość bierze się ze stackowania mnożników na „wszystkie targety”, dlatego osłabiliśmy All-in i Saturate.
