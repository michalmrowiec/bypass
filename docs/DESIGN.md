# BYPASS: zasady projektowe i bank pomysłów

## 1. Zasady nadrzędne
1. **Rdzeń mechaniki się nie zmienia:** macierz, naprzemienność wiersz / kolumna, bufor, targety.
2. **Nie robimy kopii 1:1** Cyberpunk 2077 ani Balatro. Bierzemy tylko ogólną koncepcję roguelike (run → etapy → sklep → synergie), wykonanie jest własne.
3. **Ulepszenie to nowa reguła, którą gracz bierze pod uwagę przy planowaniu.** Musi być przewidywalna, widoczna przed ruchem i dać się wyjaśnić jednym zdaniem. Nie mieszamy zasad bez celu.
4. **Kluczowe uczucia:**
   - *planowanie → wykonanie*: „rozwiązałem coś trudnego”;
   - *clutch pod presją*: tylko w wydzielonych momentach (Hot breach);
   - domyślnie spokojne planowanie.
5. **Snowball:** dobre decyzje dają silniejszy build, ze słabych da się wyjść.
6. **Łatwe do zaliczenia, trudne do maksa** („optymalizacja zamiast spełnienia”). Służą temu cele bonusowe, rekordy, rzadkość i daemony per pokój.
7. **Efekty widoczne na matrycy są najlepsze**, np. `**` i `×2`. Chcemy ich jak najwięcej.
8. **Archetyp buildu nie może wisieć na jednym rzadkim daemonie.** Każdy archetyp powinny wspierać 2–3 daemony różnej rzadkości.
9. **Meta-progresja daje mądrzejszego gracza, nie silniejszą postać.** Odblokowania tak, stałe bonusy mocy nie.
10. **Macierz to decyzja, nie tylko zagadka.** Jeśli każdy build idzie tą samą ścieżką, build tylko dolicza liczby. Plansza powinna mieć 2–3 sensowne trasy o różnych profilach, a gracz wybiera tę, która pasuje do jego buildu i stanu runu. Trasa na wszystkie targety zostaje gwarantowana.
11. **Wysiłek ≈ nagroda.** Archetypy (splicer, ghost, runner, cron) mają mieć podobne szanse przy różnym stylu gry. Leniwa ścieżka (krótkie targety, pusty bufor, szybki disconnect) nie może bić pełnego planowania.

## 2. Kolory (mają znaczenie w grze)

| kolor | znaczenie |
|---|---|
| miętowy | ruchy, UI, bonus objective (odwrócony tag + maszerująca ramka) |
| różowy | wildcard `**`, „źle”, ICE, burn, boost |
| cyjan | consumable (ładunek ×2), dodatkowe sloty bufora, rare |
| fiolet `--violet` | Repeater ×2, nic więcej |
| złoty | **tylko kasa** (legendary to perłowy holo); gracz kojarzy go z $ |
| limonka | rodzina cron (np. Rotate) |
| niebieski (`--data`) | wartości data |

Nowy efekt na matrycy dostaje **nowy, wolny kolor** albo wyraźny tag.

**Ikony itemów:** wersja v2.0 ma małe akcenty: zielone części (piny, paski USB), różowe diody i różowy celownik; nigdy całe ramki. Klasa `.gear.v2` jest nadawana każdemu id kończącemu się na `2`. Wersja v3.0 dostanie w przyszłości własny, inny akcent.

## 3. Nazewnictwo i fabuła
- Gracz to **pentester / red team**, a firmy same zlecają mu kontrakt. Możliwy twist: podejrzany zleceniodawca.
- **Daemon** oznacza pasywne ulepszenie (proces w tle w Uniksie). **Breach** jako słowo jest OK.
- **Unikamy:**
  - frazy „Breach Protocol”;
  - słów z Balatro: ante, blind, joker*, chips/mult, planet, tarot, voucher;
  - mechanik 1:1 z Balatro: $ za niewykorzystane ręce, odsetki, „skip blind”, Blueprint.

  *Daemon Joker już jest. Do przemyślenia przy ostatecznym nazewnictwie.
- **Software i hardware:** daemony (darmowe) zmieniają, jak liczą się punkty. Itemy (płatne, w racku) zmieniają matrycę, ruch albo ekonomię. Itemy nie mają rodzin.

## 4. Bank pomysłów (niezdecydowane, na później)

**Nowe kształty plansz** (⭐ chcemy szybko, plan w `.notes/00_START_HERE.md`):
- **Porty** ⭐: dwie macierze obok siebie, komórka-port `⇄` przenosi następny wybór do drugiej. Każda połowa może mieć inne kody i inne ICE.
- **Macierze sprzężone** ⭐: wybory na zmianę w A i B; linia wybrana w A wyznacza linię w B i odwrotnie. Wygląda groźnie, a jest prosta dla kogoś, kto zna zasady. Kandydat na bossa.
- **Kształty**: L, krzyż, pierścień, plansza z dziurami; linia to odcinek wiersza lub kolumny.
- **Hex**: 3 osie zamiast 2, ruch rotuje po osiach. Ta sama mechanika, inne myślenie.
- **Łańcuch macierzy w pokoju**: bufor przechodzi dalej, target można zacząć w jednej i skończyć w drugiej. Na później.
- 3D: patrz „Firmy” niżej; ryzyko czytelności na telefonie.

**Warianty macierzy:**
- Wrap (torus);
- Gravity (kody opadają);
- Mirror (wybór wypala lustrzane pole);
- Linked pairs;
- Rotate co N ruchów;
- Shift aktywnego wiersza;
- Dual start (wiersz 0 albo kolumna 0);
- Locked lanes.

**Hot breach:**
- 5×5 / 6×6 na czas, daemony nie liczą punktów, ukończony cel dolewa czasu.
- Nagrody progowe: przy wszystkich celach wybór 1 z 3 rzadkich nagród. Nagrody przyspieszają build, ale nie są warunkiem wygranej.

**Wyróżniki z siatki:**
- implanty w slotach bufora ⭐;
- wywiad przed bossem ⭐;
- mapa budynku zamiast liniowej ścieżki;
- Trace (wykrycie rośnie z ruchami i wywołuje Hot breach);
- pominięcie pokoju za nagrodę (uwaga na „skip blind”).

**Pula kodów, czyli deckbuilding na siatce:**
- dodaj, usuń albo przekonwertuj kod;
- ulepszone kody: złoty, szklany, gorący;
- rodzina Signature (Sniffer, Resonance, Monoculture).

**Itemy i daemony pod konkretny kod**, np. „Exploit C9”: komórki C9 podświetlone, każdy C9 daje +5 data.

**Inne daemony:**
- Kernel (+boost za daemony z tej samej rodziny);
- Overclock jako daemon (podwaja sąsiada, −1 bufor). Uwaga: nazwa koliduje z itemem Overclock z backlogu.

**Inne ICE:**
- Key rotation (target zmienia kod po N ruchach);
- IDS (ruchy poza ścieżką podnoszą alarm);
- Scramble (trudno zagwarantować rozwiązywalność).

**Firmy:**
- 3D: matrix[n][n][2–3], warstwa jako trzecia oś, nie ta sama oś dwa razy z rzędu. Trudność musi dać coś innego niż „więcej osi = łatwiej”.
- Kilka macierzy obok siebie naraz.

**Grafika:**
- „dongle” na jednorazowe przedmioty;
- terminalowa oprawa sklepu (`market --list`, `install ... ok`).

**Run:**
- seedowany „daily run” albo wyzwanie dla znajomego;
- długość runu ok. 15–25 min.

**Rodzina Root (uniwersalna), pomysł gracza 2026-11-23, w projekcie (bez kodu):**
- normalna rodzina (common/rare/legendary): stałe premie z łatwymi warunkami, pasuje do każdego buildu; nie jest „rodziną od mieszania”;
- kolor: **biel `#f2f5f8`**. Grafit i srebro odrzucone: obok nasyconych rodzin wyglądały na nieaktywne. Pasek w 4 kolorach rodzin odrzucony (dezorientuje). Rare odróżnia podwójna ramka, legendary holo 3px;
- lodowy błękit (`#cfe6ff`, podkręcony) zostaje na przyszłą rodzinę;
- kandydaci (wszystkie podobają się graczowi, liczby do sima):
  - **Baseline** (common): +0,4 boosta na każdej macierzy, bez warunku (sim 23.11: +0,6 za mocne na K/M);
  - **Payroll** (common): +$1 po macierzy z co najmniej **2** wgranymi targetami;
  - **Patch** (common): +10 data za każdy wgrany target (sim 23.11: +15 za mocne na K/M);
  - **Polyglot** (rare): ×1,3 + 0,3 za każdą inną rodzinę w racku (max ×2,2);
  - **Superuser** (legendary): ×1,8 zawsze;
  - **Failsafe** (rare): ×1,25, a ×1,6 gdy wgrasz wszystkie targety;
- Signal flaw nie dotyczy Root (ma na stałe Runnera). Więcej daemonów nie dodajemy (3 common, 2 rare, 1 legendary);
- **Paczki daemonów zamiast 3 kart** (pomysł gracza 2026-11-23, odłożony do playtestów z Root): w ofercie 2 paczki po ok. 3 daemony, każda oznaczona rodziną (np. Ghost, Splicer/Cron albo „mix”); gdy rodzina jest prawie wyczerpana, gra daje paczkę innej rodziny albo mix. Wariant: jedna paczka z pewną legendą za dopłatą. Uwaga: gracz widzi ok. 6 daemonów zamiast 3 (silniejszy wybór, balans do sima), a paczki kojarzą się z Balatro.
  - 2026-11-24 (po dodaniu Root i Botnet: 37 daemonów, 6 rodzin): na razie oferta ma 4 karty zamiast 3. Paczki zostają kierunkiem docelowym, bo paczka z jednej rodziny nie rozmywa się wraz z pulą. Warianty paczek wg gracza: jedna rodzina, dwie rodziny (synergie między rodzinami), totalny mix, czasem paczka z gwarantowanym rare. Gracz odrzucił ukrytą „skłonność do rodzin” w losowaniu, bo synergie często idą między rodzinami.
  - 2026-11-25 **wdrożone** (`offerPacks` w roguelike.ts, `pack3d.ts`): oferta to 2 zamknięte paczki po 3 daemony do wyboru (czasem, 10%, „mega” paczka z 4), otwiera się jedna. Rodzaj paczki: mix wszystkich (50%), dwie rodziny (35%), jedna rodzina (15%); obie paczki zawsze wyglądają inaczej i nie dzielą daemonów. Paczka bywa oznaczona RARE+ (15%) albo LEGENDARY+ (4%): oznaczenie gwarantuje co najmniej jedną kartę tej rzadkości, reszta losuje się normalnie; karty idą od common do legendary. Wejście z jedną rodziną: jedna paczka tej rodziny. Nagroda „legenda” z bonusu: jedna paczka „LEGENDARY ×2” z dwiema legendami do wyboru (mocniejsza niż dawne „oferta zaczyna się od legendy”, do sprawdzenia simem).
  - wygląd (makiety w `.notes/daemon-packs/`): szklane etui 3D w kolorach rodzin (dwie rodziny: lewa/prawa połowa), z gwarancją od razu inne (emblemat, srebrne/holo okucia, światło w szczelinie). Pieczęć pryska, klapa się otwiera, karty wylatują i lądują rewersem do góry, odwracają się po kolei; rare/legendary najpierw spokojnie się ładują. W połowie obrotu karta 3D zamienia się w zwykłą kartę daemona (revealR/revealL, hover). Styl classic i brak WebGL: płaskie paczki i zwykła lista kart.
- otwarte: czy Root nie rozmyje puli za mocno (najpierw boty sima mają używać nowych daemonów, potem sim z Root i bez); od początku czy do odblokowania (skłania się: od początku); ikony.

## 5. Trudność i balans

**Co robi macierz trudną.** Liczba rozwiązań to nie trudność. Liczy się, ile mylących opcji trzeba odrzucić i jak daleko patrzeć w przód.
- fałszywe tropy: ścieżki, które przez 3–4 ruchy wyglądają dobrze i się nie domykają (najmocniejsza dźwignia);
- głębokość decyzji: wybór w wierszu 0 mści się dopiero przy 5.–6. ruchu;
- luz bufora: 1–2 wolne sloty plus fałszywe tropy bywa trudniejsze niż 0;
- ruchy-łączniki: trzeba celowo wziąć kod spoza targetów, żeby wejść na dobrą linię;
- kolejność sklejania targetów: kilka sklejek wygląda dobrze, geometrycznie działa jedna;
- rozkład kodów: rzadki kod w potrzebnej linii to wąskie gardło, częsty w złej to szum.

**Metryki z solvera** (do wyboru plansz wg profilu): liczba rozwiązań, ślepe zaułki głębokości ≥ 3, ruch, po którym pada pierwsza decyzja zamykająca rozwiązania, czy trzeba ruchu-łącznika, ile kolejności sklejania jest wykonalnych, i najważniejsze: **czy najlepsza trasa różni się między buildami** (różna = decyzja, ta sama = zagadka).

**Generator sadzi, solver sprawdza.** Generator najpierw sadzi 2–3 trasy o różnych profilach (np. komplet targetów i pełny bufor; jeden duży target i wolne sloty; trasa przez Data node albo róg), potem wypełnia resztę. Solver tylko weryfikuje i liczy metryki. 5×5 mieści zwykle 2 trasy, 6×6 i 7×7 trzy. Mała plansza sama wymusza konflikty tras, co jest zaletą.

**Solver pod nowe plansze i itemy.** Stan = pozycja, aktywna oś lub linia, maska użytych komórek, postęp targetów (automat po wszystkich sekwencjach naraz), ładunki itemów, ewentualnie aktywna macierz. Plansza (prostokąt, hex, kształt, porty, sprzężone) daje tylko `nextCells(state)`, a item to dodatkowy generator ruchów z licznikiem. Głębokość ogranicza bufor, więc to się liczy nawet dla 2×25 komórek.

**Wygrywalność runu.** Generator gwarantuje rozwiązywalność macierzy, nie quota. Wariancję runu gracz ma ogarniać wyborem ofert, rerollem, gwarancjami w sklepie (np. zawsze coś, co daje data) i zapasem w quota. Pierwsza firma ma być do przejścia bez itemów. Jeden błąd kosztuje zasoby, nie cały run.

**Dźwignie na dominującą strategię** (krótkie targety + pusty bufor + szybki disconnect): wartość targetu rosnąca szybciej niż długość, koszt disconnectu, boosty ghosta jako płaskie +data zamiast mnożników, ICE i pokoje kontrujące jeden styl. Zrobione 2026-11-09: komórka `**` jest jednorazowa (koniec stosu `** **` z Rewind i Loopback), Cache zeruje się przy wgraniu wszystkich targetów.

## 6. Odrzucone
- **Magnes** (sąsiednie kody przesuwają się do jednej komórki): niezrozumiały.
- **Timeout jako ICE:** czas zostaje dla Hot breach.
- **Akcent kolorystyczny firmy:** kolory mają znaczenie w grze. Firmy różnią się logo, motywem w tle i kodami.
- **„Nowe dane na komórce, z której wychodzisz”:** bez Loopbacka nic nie zmienia.
- **Kredyty za niewykorzystane macierze:** za blisko Balatro.
- **Tasowanie kodów co 3 ruchy:** psuje planowanie.
- **Inne znaki „deszyfrowania”:** niezauważalne.
- **Notacja `ICE.Nazwa`** (2026-11-10): dłuższe nazwy na telefonie, a kolor i miejsce już mówią, że to ICE.

## 7. Jak dodać nową mechanikę

- **Wpis w tabeli:** `ICE`, `ITEMS` lub `DAEMONS` w `src/roguelike.ts` (nazwa i tekst zasady). Firma: `COMPANIES`.
- **Punktacja** (daemon, item, ICE zmieniające wynik): `scoreMatrix` i `facts` w `src/roguelike.ts`.
- **Matryca** (co widać, co da się kliknąć, co robi kliknięcie): `src/matrix.ts`. Rozdanie w `dealBoard`, wygląd komórki w `cellView`, legalność w `canPick`, skutki w `applyPick`. `ui.ts` tylko to rysuje.
- **Nowy rodzaj ruchu** (skok, ponowne kliknięcie…): również `Tools` w `src/solver.ts`, inaczej gra źle wykryje ślepy zaułek.
- **Testy:** przypadek w `src/matrix.test.ts`. `src/content.test.ts` sam sprawdza, że każdy wpis z tabel daje rozwiązywalne matryce.
