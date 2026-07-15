/* ==========================================================================
   config.js — PROJECT SZPONT
   ---------------------------------------------------------------------------
   To jest JEDYNY plik, który musisz recznie uzupelnic. Wszystko inne
   (sklad, mecze, wyniki, ELO) dociaga sie samo z FACEIT co odswiezenie.

   Dlaczego niektóre pola sa "reczne"?
   FACEIT Data API NIE udostepnia social mediów graczy ani druzyny
   (Instagram/TikTok/Twitch itd.) — tego po prostu nie ma w ich bazie,
   wiec te linki trzeba wpisac samodzielnie raz, ponizej.
   ========================================================================== */

window.SITE_CONFIG = {

  /* --- Podstawy druzyny (z linku, który podales) ------------------------ */
  team: {
    faceitTeamId: "155cd538-dd2f-4be4-8eec-9fa4eb43d108",
    faceitTeamUrl: "https://www.faceit.com/pl/teams/155cd538-dd2f-4be4-8eec-9fa4eb43d108",
    faceitLeaguesUrl: "https://www.faceit.com/pl/teams/155cd538-dd2f-4be4-8eec-9fa4eb43d108/leagues",
    game: "cs2",              // gra na FACEIT (cs2 / csgo)
    name: "Project Szpont",
    tagline: "Sklad, mecze i wyniki — aktualizowane same, prosto z FACEIT.",
  },

  /* --- Adres Twojego Cloudflare Workera (patrz worker.js + README) ------
     Wklej TYLKO sam adres Workera, BEZ zadnych dopisków typu /v4 na koncu —
     script.js sam dokleja wlasciwe sciezki. Adres znajdziesz na górze
     strony Workera w Cloudflare Dashboard, zaraz po wdrozeniu.            */
  // np. "https://sred-sound-df6cszpont.9sukuyomi.workers.dev"
  apiBase: "https://sred-sound-df6cszpont.9sukuyomi.workers.dev/",

  /* --- Social media DRUZYNY (uzupelnij, co dotyczy — reszte zostaw "") -- */
  teamSocials: {
    discord:   "",   // np. "https://discord.gg/xxxxxxx"
    instagram: "",
    tiktok:    "",
    youtube:   "",
    twitch:    "",
    kick:      "",
    x:         "",   // Twitter/X
  },

  contactEmail: "",  // np. "kontakt@projectszpont.pl" — zostaw puste, by ukryc

  /* --- Social media GRACZY, po nicku FACEIT (wielkosc liter bez znaczenia)
     Dodaj tu wpis dla kazdego gracza, którego social chcesz pokazac.
     Nick musi byc identyczny z nickiem na FACEIT.                        */
  playerSocials: {
    // "NICKFACEIT": { instagram: "https://instagram.com/...", x: "", twitch: "", tiktok: "" },
  },

  /* --- Liga / ESEA-styl (bilans, pozycja, punkty) ------------------------
     Sekcja korzysta z WEWNETRZNEGO API faceit.com (nie z oficjalnego
     Data API v4) — dzieki temu nie potrzeba zadnego klucza API. Minus:
     to API jest nieoficjalne, FACEIT moze je zmienic bez ostrzezenia,
     wiec traktuj te sekcje jako dodatek, a nie fundament strony.

     Jak znalezc wartosci ponizej (Narzedzia deweloperskie -> Siec/Network
     na stronie ligi Twojej druzyny, filtr "Fetch/XHR", odswiez strone):
       - leagueId        -> z zapytania "teams?team_type=league&league_id=..."
       - seasonId        -> z zapytan typu "requirements?season_id=...",
                             "seasons?entityType=season&entityId=..."
       - leagueTeamId    -> z zapytania "...&team_ids=..." lub
                             "registrations?leagueTeamIds=..."
                             (UWAGA: to NIE jest to samo co team.faceitTeamId
                             wyzej — to ID Twojej druzyny w kontekscie tej
                             konkretnej ligi)                               */
  league: {
    leagueId: "",      // np. "a14b8616-45b9-4581-8637-4dfd0b5f6af8"
    seasonId: "",      // np. "ec187700-30e2-4245-b5e2-daa762db12fc"
    leagueTeamId: "",  // np. "fbb856ae-a754-4860-92ad-b6e25dd6dad1"
  },

  /* --- Reczna "podpórka" na mecze -----------------------------------------
     Strona SAMA próbuje znalezc rozgrywki druzyny (przez /teams/{id}/tournaments).
     Jesli jakis turniej/liga sie nie wykryje automatycznie, mozesz dokleic
     tu jego ID (z adresu URL rozgrywki na faceit.com), a strona doda go
     do listy zródel meczów.                                               */
  manualCompetitionIds: ["c1641aae-0e63-4564-a571-927091687b5b"], // Twoja dywizja w ESEA League

  /* --- Jak czesto strona sama odswieza dane (ms) ------------------------- */
  refreshIntervalMs: 5 * 60 * 1000, // 5 minut

};
