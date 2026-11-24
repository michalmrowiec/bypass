# Nowe ICE – pomysły (Sable Vault i dalej)

1. **Flicker** – co 2 ruchy jedna losowa kolumna gaśnie (kody niewidoczne, ale klikalne). Fajne: trzeba pamiętać planszę, długi skrypt planuje się „na pamięć”. Koszt: mały (jak Encryption, tylko tykające w ruchach).
2. **Decay** – kod wybrany z komórki zostawia sąsiadów „starzejących się”: po 3 ruchach zmieniają kod o jeden w puli. Fajne: długie cele w Sable = wyścig z czasem. Koszt: średni (zmiana gridu w trakcie, solver musi znać czas).
3. **Lock&key** – jedna komórka-zamek (🔒) da się wybrać dopiero po wybraniu komórki-klucza. Fajne: wymusza kolejność w skrypcie, zgrywa się z portami. Koszt: średni (generator planuje klucz przed zamkiem na ścieżce).
4. **Cold storage** – jeden cel jest „zamrożony”: liczy się tylko, gdy wgrasz go jako ostatni. Fajne: przy 2 długich celach odwraca łańcuch. Koszt: mały (warunek w scoringu, podpowiedź w UI).
5. **Mirror** (tylko dla plansz portowych) – wybór w lewej macierzy blokuje lustrzaną komórkę w prawej. Fajne: porty przestają być darmowe. Koszt: średni.

Rekomendacja na SOC Sable: **Lock&key** albo **Cold storage**. Żadne nie jest jeszcze zaimplementowane (brak czasu).
