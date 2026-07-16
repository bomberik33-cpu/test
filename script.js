/* ==========================================================================
   script.js — PROJECT SZPONT
   Pobiera dane z FACEIT (przez Twojego Workera z config.js) i sam
   uzupelnia: sklad, ELO/poziomy, najblizsze mecze, wyniki i bilans ligowy.
   Odswieza sie automatycznie co SITE_CONFIG.refreshIntervalMs.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------- Ikonki (proste, generyczne) ------------- */
  const ICONS = {
    discord: '<svg viewBox="0 0 24 24"><path d="M8 12.5c.6 0 1-.6 1-1.3s-.4-1.3-1-1.3-1 .6-1 1.3.4 1.3 1 1.3Zm8 0c.6 0 1-.6 1-1.3s-.4-1.3-1-1.3-1 .6-1 1.3.4 1.3 1 1.3Z"/><path d="M17.5 6.5C16 5.7 14.4 5.2 12.8 5l-.3.6c1.4.2 2.7.6 4 1.2-2.6-1.2-6.7-1.2-9.4 0 1.2-.6 2.6-1 4-1.2L11 5c-1.6.2-3.2.7-4.7 1.5-1.9 3-2.4 6-2.1 8.9 1.7 1.2 3.3 2 4.9 2.5l.6-1.1c-.8-.3-1.6-.7-2.3-1.2.2.1.4.3.6.4 3 1.4 6.3 1.4 9.3 0 .2-.1.4-.2.6-.4-.7.5-1.5.9-2.3 1.2l.6 1.1c1.6-.5 3.2-1.3 4.9-2.5.4-3.4-.5-6.4-2.1-8.9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" stroke="none"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 4v9.8a3.3 3.3 0 1 1-2.6-3.2"/><path d="M14 4c.5 2.4 2.1 3.9 4.4 4.2"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="6" width="17" height="12" rx="3.5"/><path d="M10.5 9.5v5l4.3-2.5-4.3-2.5Z" fill="currentColor" stroke="none"/></svg>',
    twitch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 4h15v10l-4 4h-4l-2.5 2.5V18H5V4Z"/><path d="M12 8v4M16 8v4"/></svg>',
    kick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 4v16M13 4l-6 8 6 8M13 4l6 0-6 8 6 8-6 0"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5 5 19"/></svg>',
    faceit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 12 12 4l8 8-8 8-8-8Z"/><path d="M9 12h6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 15l6-6M10 6h5.5A2.5 2.5 0 0 1 18 8.5V14M14 18H8.5A2.5 2.5 0 0 1 6 15.5V10"/></svg>',
  };

  const iconEl = (key, extraClass = "") => {
    const svg = ICONS[key] || ICONS.link;
    return `<span class="icon ${extraClass}" aria-hidden="true">${svg}</span>`;
  };

  /* ---------------------------- Pomocnicze -------------------------------- */

  const cfg = window.SITE_CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const dateFmt = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const dateFmtShort = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  function fmtTimestamp(sec) {
    if (!sec) return "termin nieznany";
    return dateFmt.format(new Date(sec * 1000));
  }
  function fmtTimestampShort(sec) {
    if (!sec) return "—";
    return dateFmtShort.format(new Date(sec * 1000));
  }

  // Emoji flagi z kodu kraju ISO (np. "pl" -> ????)
  function flagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return "";
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  function levelColor(level) {
    if (!level) return "var(--muted)";
    if (level >= 9) return "var(--win)";
    if (level >= 6) return "var(--accent)";
    return "var(--text-dim)";
  }

  async function apiGet(path) {
    if (!cfg.apiBase || cfg.apiBase.includes("TWOJA-NAZWA")) {
      throw new Error("MISSING_WORKER");
    }
    const res = await fetch(cfg.apiBase.replace(/\/$/, "") + "/v4" + path);
    if (!res.ok) {
      const err = new Error(`Zapytanie nieudane: ${path} (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // Jak apiGet(), ale przez bramke /league/... (wewnetrzne API FACEIT, bez klucza).
  // Podaj body, zeby wyslac POST z JSON-em (np. {leagueId, seasonId}); bez body -> GET.
  async function apiGetLeague(path, body) {
    if (!cfg.apiBase || cfg.apiBase.includes("TWOJA-NAZWA")) {
      throw new Error("MISSING_WORKER");
    }
    const url = cfg.apiBase.replace(/\/$/, "") + "/league" + path;
    const options = body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {};
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = new Error(`Zapytanie ligowe nieudane: ${path} (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function setStatus(el, text, kind = "info") {
    if (!el) return;
    el.innerHTML = `<p class="status status--${kind}">${text}</p>`;
  }

  /* ---------------------------- Stan strony -------------------------------- */

  const state = {
    team: null,
    players: [],       // pelne dane graczy z /players/{id}
    upcoming: [],
    past: [],
    leagueInfo: null,
  };

  /* ---------------------------- 1) Sklad druzyny --------------------------- */

  async function loadTeamAndRoster() {
    const grid = $("#rosterGrid");
    setStatus(grid, "Wczytywanie skladu z FACEIT…");

    const team = await apiGet(`/teams/${cfg.team.faceitTeamId}`);
    state.team = team;

    const rosterRaw = team.members || team.roster || [];
    if (!rosterRaw.length) {
      setStatus(grid, "Nie znaleziono skladu druzyny w danych FACEIT.", "empty");
      return;
    }

    // Dociagamy pelny profil (ELO, poziom w grze, kraj) dla kazdego gracza
    const players = await Promise.all(
      rosterRaw.map(async (m) => {
        const userId = m.user_id || m.player_id;
        try {
          const full = await apiGet(`/players/${userId}`);
          return full;
        } catch {
          return m; // fallback do skróconych danych z rostera
        }
      })
    );
    state.players = players;
    renderRoster(players, team);
  }

  function renderRoster(players, team) {
    const grid = $("#rosterGrid");
    const game = cfg.team.game;

    grid.innerHTML = players
      .map((p) => {
        const nickname = p.nickname || "Gracz";
        const country = flagEmoji(p.country);
        const gameData = (p.games && p.games[game]) || {};
        const level = gameData.skill_level || p.skill_level || null;
        const elo = gameData.faceit_elo || null;
        const avatar = p.avatar || "";
        const profileUrl = `https://www.faceit.com/pl/players/${nickname}`;
        const socials = (cfg.playerSocials && cfg.playerSocials[nickname]) ||
          Object.entries(cfg.playerSocials || {}).reduce(
            (acc, [k, v]) => (k.toLowerCase() === nickname.toLowerCase() ? v : acc), null
          ) || {};

        const socialIcons = Object.entries(socials)
          .filter(([, url]) => url)
          .map(([key, url]) => `<a href="${url}" target="_blank" rel="noopener" class="player-social" aria-label="${key}">${iconEl(key)}</a>`)
          .join("");

        return `
          <article class="player-card">
            <a class="player-card__link" href="${profileUrl}" target="_blank" rel="noopener" aria-label="Profil FACEIT — ${nickname}"></a>
            <div class="player-card__top">
              ${avatar
                ? `<img class="player-card__avatar" src="${avatar}" alt="Avatar ${nickname}" loading="lazy">`
                : `<div class="player-card__avatar player-card__avatar--placeholder">${nickname.slice(0, 2).toUpperCase()}</div>`}
              ${country ? `<span class="player-card__flag" title="${p.country || ""}">${country}</span>` : ""}
            </div>
            <div class="player-card__body">
              <h3 class="player-card__name">${nickname}</h3>
              <div class="player-card__stats">
                ${level ? `<span class="badge" style="--badge-color:${levelColor(level)}">POZIOM ${level}</span>` : ""}
                ${elo ? `<span class="badge badge--ghost">${elo} ELO</span>` : ""}
              </div>
            </div>
            <div class="player-card__footer">
              ${socialIcons ? `<div class="player-card__socials">${socialIcons}</div>` : ""}
              <span class="player-card__faceit">${iconEl("faceit")}</span>
            </div>
          </article>`;
      })
      .join("");
  }

  /* ---------------------------- 2) Odkrywanie rozgrywek --------------------- */

  async function discoverCompetitions() {
    const found = new Map(); // id -> {id, kind}

    for (const type of ["upcoming", "past", "ongoing"]) {
      try {
        const data = await apiGet(`/teams/${cfg.team.faceitTeamId}/tournaments?type=${type}`);
        (data.items || []).forEach((t) => {
          const id = t.tournament_id || t.id;
          if (id) found.set(id, { id, kind: "tournaments" });
        });
      } catch {
        /* ten typ moze nie istniec — pomijamy po cichu */
      }
    }

    (cfg.manualCompetitionIds || []).forEach((id) => {
      if (!found.has(id)) found.set(id, { id, kind: "championships" });
    });

    return Array.from(found.values());
  }

  // Sprawdza, czy dany obiekt "faction" z meczu to NASZA druzyna.
  // WAZNE: w lidze ESEA/FACEIT League mecze czesto uzywaja INNEGO id druzyny
  // (leagueTeamId) niz glówne ID klubowe (faceitTeamId) — dlatego porównujemy
  // do OBU id, a dodatkowo (najbardziej niezawodnie) do nazwy druzyny.
  function isOurTeam(t) {
    if (!t) return false;
    const teamId = cfg.team.faceitTeamId;
    const leagueTeamId = cfg.league && cfg.league.leagueTeamId;
    const teamName = (cfg.team.name || "").trim().toLowerCase();
    if (teamId && (t.faction_id === teamId || t.team_id === teamId)) return true;
    if (leagueTeamId && (t.faction_id === leagueTeamId || t.team_id === leagueTeamId)) return true;
    if (teamName && t.name && t.name.trim().toLowerCase() === teamName) return true;
    return false;
  }

  async function loadMatches() {
    const upcomingEl = $("#upcomingList");
    const resultsEl = $("#resultsList");
    setStatus(upcomingEl, "Szukam najblizszych meczów…");
    setStatus(resultsEl, "Szukam ostatnich wyników…");

    let competitions = [];
    try {
      competitions = await discoverCompetitions();
    } catch {
      competitions = [];
    }

    if (!competitions.length) {
      setStatus(upcomingEl, "Brak wykrytych rozgrywek. Dodaj ID ligi/turnieju w config.js (manualCompetitionIds).", "empty");
      setStatus(resultsEl, "Brak wykrytych rozgrywek. Dodaj ID ligi/turnieju w config.js (manualCompetitionIds).", "empty");
      return;
    }

    const manualIds = new Set(cfg.manualCompetitionIds || []);
    const allMatches = [];
    for (const comp of competitions) {
      for (const kind of ["championships", "tournaments"]) {
        try {
          const data = await apiGet(`/${kind}/${comp.id}/matches?type=all&limit=50`);
          (data.items || []).forEach((m) =>
            allMatches.push({
              ...m,
              // Oznaczamy, z jakiej rozgrywki pochodzi mecz i czy to ta z
              // manualCompetitionIds (u Ciebie: dywizja ESEA League).
              __sourceCompetitionId: comp.id,
              __isLeagueMatch: manualIds.has(comp.id),
            })
          );
        } catch {
          /* ta sciezka moze nie pasowac do danego ID — próbujemy dalej */
        }
      }
    }

    const ourMatches = dedupeById(allMatches).filter((m) => {
      const teams = m.teams || {};
      return Object.values(teams).some(isOurTeam);
    });

    const now = Date.now() / 1000;
    const live = ourMatches.filter((m) => m.status === "ONGOING" || m.status === "LIVE");
    const upcoming = ourMatches
      .filter(
        (m) =>
          m.status !== "ONGOING" &&
          m.status !== "LIVE" &&
          m.status !== "FINISHED" &&
          m.status !== "CANCELLED" &&
          m.status !== "ABORTED" &&
          ((m.scheduled_at || 0) >= now ||
            ["SCHEDULED", "UPCOMING", "READY", "CONFIGURING", "VOTING"].includes(m.status))
      )
      .sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0));
    const past = ourMatches
      .filter((m) => m.status === "FINISHED" || (m.finished_at && m.finished_at > 0))
      .sort((a, b) => (b.finished_at || b.scheduled_at || 0) - (a.finished_at || a.scheduled_at || 0));

    state.upcoming = [...live, ...upcoming];
    state.past = past;

    renderUpcoming(state.upcoming);
    renderResults(past);
    renderHeroNextMatch(live[0] || upcoming[0]);
  }

  function dedupeById(matches) {
    const map = new Map();
    matches.forEach((m) => map.set(m.match_id, m));
    return Array.from(map.values());
  }

  function opponentOf(match) {
    const teams = match.teams || {};
    const entries = Object.values(teams);
    const opp = entries.find((t) => !isOurTeam(t)) || entries[1] || entries[0];
    return opp || { name: "Przeciwnik" };
  }

  function renderUpcoming(list) {
    const el = $("#upcomingList");
    if (!list.length) {
      setStatus(el, "Brak zaplanowanych meczów w tej chwili.", "empty");
      return;
    }
    el.innerHTML = list
      .slice(0, 8)
      .map((m) => {
        const opp = opponentOf(m);
        const isLive = m.status === "ONGOING" || m.status === "LIVE";
        const sourceTag = m.__isLeagueMatch ? "ESEA LIGA" : (m.competition_name || "Turniej");
        const matchUrl = m.faceit_url ? m.faceit_url.replace("{lang}", "pl") : cfg.team.faceitLeaguesUrl;
        return `
        <li class="match-row ${isLive ? "match-row--live" : ""}">
          <a class="match-row__link" href="${matchUrl}" target="_blank" rel="noopener" aria-label="Zobacz mecz SZPONT vs ${opp.name || "Przeciwnik"}"></a>
          <div class="match-row__date">
            ${isLive
              ? `<span class="badge badge--live">NA ZYWO</span>`
              : `<span class="match-row__day">${fmtTimestampShort(m.scheduled_at)}</span>
                 <span class="match-row__time">${fmtTimestamp(m.scheduled_at).split(", ").pop()}</span>`}
          </div>
          <div class="match-row__vs">
            <span class="match-row__label">SZPONT</span>
            <span class="match-row__sep">vs</span>
            <span class="match-row__label">${opp.name || "Przeciwnik"}</span>
          </div>
          <div class="match-row__comp">${sourceTag}</div>
        </li>`;
      })
      .join("");
  }

  function renderResults(list) {
    const el = $("#resultsList");
    if (!list.length) {
      setStatus(el, "Brak rozegranych meczów do pokazania.", "empty");
      return;
    }
    el.innerHTML = list
      .slice(0, 8)
      .map((m) => {
        const opp = opponentOf(m);
        const score = m.results && m.results.score ? Object.values(m.results.score).join(" : ") : "—";
        const winnerFaction = m.results ? m.results.winner : null;
        const ourEntry = Object.entries(m.teams || {}).find(([, t]) => isOurTeam(t));
        const won = ourEntry && winnerFaction === ourEntry[0];
        const sourceTag = m.__isLeagueMatch ? "ESEA LIGA" : (m.competition_name || "Turniej");
        const matchUrl = m.faceit_url ? m.faceit_url.replace("{lang}", "pl") : cfg.team.faceitLeaguesUrl;
        return `
        <li class="match-row match-row--result">
          <a class="match-row__link" href="${matchUrl}" target="_blank" rel="noopener" aria-label="Szczególy meczu SZPONT vs ${opp.name || "Przeciwnik"}"></a>
          <span class="badge ${won ? "badge--win" : "badge--loss"}">${won ? "WYGRANA" : "PRZEGRANA"}</span>
          <div class="match-row__vs">
            <span class="match-row__label">SZPONT</span>
            <span class="match-row__score">${score}</span>
            <span class="match-row__label">${opp.name || "Przeciwnik"}</span>
          </div>
          <div class="match-row__comp">${sourceTag} · ${fmtTimestampShort(m.finished_at || m.scheduled_at)}</div>
        </li>`;
      })
      .join("");
  }

  /* ---------------------------- 3) Hero: najblizszy mecz --------------------- */

  let countdownTimer = null;

  function renderHeroNextMatch(match) {
    const box = $("#heroNextMatch");
    if (!box) return;
    if (!match) {
      box.innerHTML = `<p class="hero-match__empty">Brak zaplanowanego meczu — sprawdz lige na FACEIT.</p>`;
      return;
    }
    const opp = opponentOf(match);
    const isLive = match.status === "ONGOING" || match.status === "LIVE";
    const sourceTag = match.__isLeagueMatch ? "ESEA LIGA" : (match.competition_name || "Mecz ligowy");

    if (isLive) {
      box.innerHTML = `
        <span class="hero-match__eyebrow">Mecz w trakcie</span>
        <div class="hero-match__vs">SZPONT <span>vs</span> ${opp.name || "Przeciwnik"}</div>
        <div class="hero-match__meta">${sourceTag}</div>
        <div class="hero-match__countdown">TRWA TERAZ</div>
      `;
      if (countdownTimer) clearInterval(countdownTimer);
      return;
    }

    box.innerHTML = `
      <span class="hero-match__eyebrow">Najblizszy mecz</span>
      <div class="hero-match__vs">SZPONT <span>vs</span> ${opp.name || "Przeciwnik"}</div>
      <div class="hero-match__meta">${sourceTag} · ${fmtTimestamp(match.scheduled_at)}</div>
      <div class="hero-match__countdown" id="countdown">--:--:--:--</div>
    `;

    if (countdownTimer) clearInterval(countdownTimer);
    const target = (match.scheduled_at || 0) * 1000;
    const tick = () => {
      const el = $("#countdown");
      if (!el) return;
      const diff = target - Date.now();
      if (diff <= 0) {
        el.textContent = "TRWA / ZAKONCZONY";
        clearInterval(countdownTimer);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      el.textContent = `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ---------------------------- 4) Liga / bilans ------------------------------ */

  async function loadLeagueBalance() {
    const el = $("#leagueStats");
    if (!el) return;

    const stats = [];

    // Srednie ELO druzyny — zawsze policzalne z danych graczy
    const elos = state.players
      .map((p) => (p.games && p.games[cfg.team.game] && p.games[cfg.team.game].faceit_elo) || null)
      .filter(Boolean);
    if (elos.length) {
      const avg = Math.round(elos.reduce((a, b) => a + b, 0) / elos.length);
      stats.push({ label: "Srednie ELO skladu", value: avg });
    }

    // Bilans W-L w lidze ESEA — liczony NAPRAWDE z rozegranych meczów w
    // rozgrywce podanej w manualCompetitionIds (Twoja dywizja ESEA League),
    // a nie z domyslnego API pozycji/punktów (ono wymaga league.leagueId/
    // seasonId i czesto sie spóznia). Dziala automatycznie po kazdym meczu.
    const leagueMatches = state.past.filter((m) => m.__isLeagueMatch);
    if (leagueMatches.length) {
      const wins = leagueMatches.filter((m) => {
        const ourEntry = Object.entries(m.teams || {}).find(([, t]) => isOurTeam(t));
        return ourEntry && m.results && m.results.winner === ourEntry[0];
      }).length;
      const losses = leagueMatches.length - wins;
      stats.push({ label: "Bilans w lidze ESEA", value: `${wins}W – ${losses}L` });
    }

    // Pozycja/punkty w lidze (ESEA) — wymaga leagueId + seasonId w config.js.
    //
    // OPCJA A (glówna, teraz ze masz FACEIT_API_KEY): oficjalne Data API
    // (open.faceit.com/data/v4, przez bramke /v4/ na Workerze) —
    // /leagues/{id}/seasons/{id} zwraca m.in. divisions[].leaderboards[] i
    // season.start_date/end_date. Bierzemy pierwsza tablice liderów i szukamy
    // w niej naszych graczy.
    //
    // OPCJA B (zapasowa): jesli oficjalne API akurat nie ma jeszcze wpisu dla
    // Waszej druzyny (np. tuz po starcie sezonu, zanim FACEIT przeliczy dane),
    // próbujemy wewnetrznego API (bramka /league/...). To API jest
    // nieoficjalne — pola position/points/team_id sa ustalone eksperymentalnie
    // i FACEIT moze je zmienic bez ostrzezenia.
    if (cfg.league && cfg.league.leagueId && cfg.league.seasonId) {
      let handled = false;

      // --- Opcja A: oficjalne API ---
      try {
        const season = await apiGet(`/leagues/${cfg.league.leagueId}/seasons/${cfg.league.seasonId}`);
        const startDate = season.season?.start_date;

        if (startDate && new Date(startDate) > new Date()) {
          stats.push({ label: "Sezon ligowy", value: `Start ${dateFmtShort.format(new Date(startDate))}` });
          handled = true;
        } else {
          const leaderboardId = season.divisions?.[0]?.leaderboards?.[0];
          if (leaderboardId) {
            const board = await apiGet(`/leaderboards/${leaderboardId}?limit=100`);
            const ourPlayers = new Set(state.players.map((p) => p.player_id));
            const entry = (board.items || []).find((row) => ourPlayers.has(row.player?.user_id));
            if (entry) {
              stats.push({ label: "Pozycja w lidze", value: `#${entry.position}` });
              stats.push({ label: "Punkty (bilans)", value: entry.points });
              handled = true;
            }
          }
        }
      } catch {
        /* oficjalne API zawiodlo (np. zly klucz albo brak danych) — próbujemy fallbacku */
      }

      // --- Opcja B: wewnetrzne API (fallback) ---
      if (!handled) {
        try {
          const overview = await apiGetLeague("/v1/get_league_overview", {
            leagueId: cfg.league.leagueId,
            seasonId: cfg.league.seasonId,
          });
          const payload = overview.payload || {};
          const season = payload.season;
          const teamInfoList = payload.current_team_league_info || [];

          if (season && season.time_start && new Date(season.time_start) > new Date()) {
            stats.push({
              label: "Sezon ligowy",
              value: `Start ${dateFmtShort.format(new Date(season.time_start))}`,
            });
          } else if (teamInfoList.length) {
            const ourInfo =
              teamInfoList.find((t) => t.team_id === cfg.league.leagueTeamId) || teamInfoList[0];
            if (ourInfo) {
              if (ourInfo.position != null) stats.push({ label: "Pozycja w lidze", value: `#${ourInfo.position}` });
              if (ourInfo.points != null) stats.push({ label: "Punkty (bilans)", value: ourInfo.points });
            }
          }
        } catch {
          /* brak danych ligowych z zadnego zródla — pomijamy sekcje po cichu */
        }
      }
    }

    if (!stats.length) {
      setStatus(el, "Brak jeszcze danych ligowych do pokazania.", "empty");
      return;
    }

    el.innerHTML = stats
      .map((s) => `<div class="stat-card"><span class="stat-card__value">${s.value}</span><span class="stat-card__label">${s.label}</span></div>`)
      .join("");
  }

  /* ---------------------------- 5) Socials druzyny (statyczne z config) ------ */

  function renderTeamSocials() {
    const containers = $all("[data-team-socials]");
    const items = Object.entries(cfg.teamSocials || {}).filter(([, url]) => url);
    const html = items
      .map(([key, url]) => `<a href="${url}" target="_blank" rel="noopener" class="social-link" aria-label="${key}">${iconEl(key)}</a>`)
      .join("");
    containers.forEach((c) => {
      c.innerHTML = html || "";
    });

    if (cfg.contactEmail) {
      $all("[data-contact-email]").forEach((el) => {
        el.textContent = cfg.contactEmail;
        el.href = `mailto:${cfg.contactEmail}`;
      });
    } else {
      $all("[data-contact-email-wrap]").forEach((el) => {
        el.style.display = "none";
      });
    }

    if (cfg.teamSocials && cfg.teamSocials.discord) {
      $all("[data-team-socials-discord]").forEach((el) => {
        el.href = cfg.teamSocials.discord;
        el.target = "_blank";
        el.rel = "noopener";
      });
    }
  }

  /* ---------------------------- Orkiestracja + auto-odswiezanie -------------- */

  function setLastUpdated() {
    $all("[data-last-updated]").forEach((el) => {
      el.textContent = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    });
  }

  async function refreshAll() {
    try {
      await loadTeamAndRoster();
    } catch (e) {
      handleGlobalError(e, "#rosterGrid");
    }
    try {
      await loadMatches();
    } catch (e) {
      handleGlobalError(e, "#upcomingList");
      handleGlobalError(e, "#resultsList");
    }
    try {
      await loadLeagueBalance();
    } catch (e) {
      handleGlobalError(e, "#leagueStats");
    }
    setLastUpdated();
  }

  function handleGlobalError(e, selector) {
    const el = $(selector);
    if (e && e.message === "MISSING_WORKER") {
      setStatus(
        el,
        "Skonfiguruj adres Workera w <code>config.js</code> (pole <code>apiBase</code>), zeby dane ladowaly sie automatycznie — patrz README.md.",
        "empty"
      );
    } else {
      setStatus(el, "Nie udalo sie pobrac danych z FACEIT. Spróbuj ponownie za chwile.", "empty");
    }
    console.error(e);
  }

  function init() {
    renderTeamSocials();

    // Podstawowe dane tekstowe z configu
    $all("[data-team-name]").forEach((el) => (el.textContent = cfg.team.name));
    $all("[data-team-tagline]").forEach((el) => (el.textContent = cfg.team.tagline));
    $all("[data-faceit-url]").forEach((el) => (el.href = cfg.team.faceitTeamUrl));
    $all("[data-faceit-leagues-url]").forEach((el) => (el.href = cfg.team.faceitLeaguesUrl));

    refreshAll();
    setInterval(refreshAll, cfg.refreshIntervalMs || 300000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
