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

## 2. Kolory (mają znaczenie w grze)

| kolor | znaczenie |
|---|---|
| miętowy | ruchy, UI, bonus objective (odwrócony tag + maszerująca ramka) |
| różowy | wildcard `**`, „źle”, ICE, burn, boost |
| cyjan | consumable (ładunek ×2), dodatkowe sloty bufora, rare |
| fiolet `--violet` | Repeater ×2, nic więcej |
| złoty | **tylko kasa** (i legendary); gracz kojarzy go z $ |
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

## 5. Odrzucone
- **Magnes** (sąsiednie kody przesuwają się do jednej komórki): niezrozumiały.
- **Timeout jako ICE:** czas zostaje dla Hot breach.
- **Akcent kolorystyczny firmy:** kolory mają znaczenie w grze. Firmy różnią się logo, motywem w tle i kodami.
- **„Nowe dane na komórce, z której wychodzisz”:** bez Loopbacka nic nie zmienia.
- **Kredyty za niewykorzystane macierze:** za blisko Balatro.
- **Tasowanie kodów co 3 ruchy:** psuje planowanie.
- **Inne znaki „deszyfrowania”:** niezauważalne.

## 6. Jak dodać nową mechanikę

- **Wpis w tabeli:** `ICE`, `ITEMS` lub `DAEMONS` w `src/roguelike.ts` (nazwa i tekst zasady). Firma: `COMPANIES`.
- **Punktacja** (daemon, item, ICE zmieniające wynik): `scoreMatrix` i `facts` w `src/roguelike.ts`.
- **Matryca** (co widać, co da się kliknąć, co robi kliknięcie): `src/matrix.ts`. Rozdanie w `dealBoard`, wygląd komórki w `cellView`, legalność w `canPick`, skutki w `applyPick`. `ui.ts` tylko to rysuje.
- **Nowy rodzaj ruchu** (skok, ponowne kliknięcie…): również `Tools` w `src/solver.ts`, inaczej gra źle wykryje ślepy zaułek.
- **Testy:** przypadek w `src/matrix.test.ts`. `src/content.test.ts` sam sprawdza, że każdy wpis z tabel daje rozwiązywalne matryce.
