(function () {
  const STORAGE_KEY = "pvd-aniversario-data-v1";
  const REMOTE_SYNC_INTERVAL_MS = 30000;
  const baseData = window.PVD_DATA;
  const cloneData = (value) => JSON.parse(JSON.stringify(value));
  const originalData = baseData ? cloneData(baseData) : null;
  let remoteSyncTimer = null;

  if (!baseData) {
    document.documentElement.dataset.pvdApp = "missing-data";
    return;
  }

  const loadStoredData = () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn("No se pudo leer la persistencia local.", error);
      return null;
    }
  };

  const applyData = (nextData) => {
    Object.keys(baseData).forEach((key) => {
      delete baseData[key];
    });

    Object.assign(baseData, cloneData(nextData));
    window.PVD_DATA = baseData;
  };

  const persistedData = loadStoredData();
  if (persistedData) {
    applyData(persistedData);
    document.documentElement.dataset.pvdPersisted = "ready";
  }

  const data = baseData;

  const saveData = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.documentElement.dataset.pvdPersisted = "ready";
  };

  const validateImportedData = (importedData) =>
    importedData &&
    Array.isArray(importedData.teams) &&
    Array.isArray(importedData.matches) &&
    importedData.finalStage &&
    importedData.rules &&
    importedData.admin;

  const normalizeRemotePayload = (payload) => payload?.data || payload;

  const remoteSourceUrl = () => String(data.admin?.storage?.publicSourceUrl || "").trim();

  const remoteWriteUrl = () => String(data.admin?.storage?.writeEndpointUrl || "").trim();

  const loadRemoteData = async ({ silent = false } = {}) => {
    const url = remoteSourceUrl();

    if (!url) {
      return false;
    }

    try {
      document.documentElement.dataset.pvdRemote = "loading";
      const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = normalizeRemotePayload(await response.json());

      if (!validateImportedData(payload)) {
        throw new Error("Estructura remota no valida");
      }

      applyData(payload);
      renderApp();
      document.documentElement.dataset.pvdRemote = "ready";

      if (!silent) {
        setAdminMessage("Datos sincronizados desde la fuente remota.", "success");
      }

      return true;
    } catch (error) {
      console.warn("No se pudo sincronizar la fuente remota.", error);
      document.documentElement.dataset.pvdRemote = "error";

      if (!silent) {
        setAdminMessage("No se pudo leer la fuente remota. Se mantienen los datos actuales.", "error");
      }

      return false;
    }
  };

  const startRemoteSync = () => {
    const url = remoteSourceUrl();

    if (remoteSyncTimer) {
      window.clearInterval(remoteSyncTimer);
      remoteSyncTimer = null;
    }

    if (!url) return;

    loadRemoteData({ silent: true });
    remoteSyncTimer = window.setInterval(() => {
      loadRemoteData({ silent: true });
    }, REMOTE_SYNC_INTERVAL_MS);
  };

  const pushRemoteData = async (token) => {
    const url = remoteWriteUrl();
    const cleanToken = String(token || "").trim();

    if (!url) {
      setAdminMessage("Configura la URL privada de escritura antes de publicar.", "error");
      return false;
    }

    if (!cleanToken) {
      setAdminMessage("Ingresa el token privado de Apps Script para publicar.", "error");
      return false;
    }

    const body = JSON.stringify({
      token: cleanToken,
      data,
    });

    try {
      document.documentElement.dataset.pvdRemote = "publishing";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Respuesta remota no confirmada");
      }

      document.documentElement.dataset.pvdRemote = "published";
      setAdminMessage("Datos publicados en Google Sheets correctamente.", "success");
      return true;
    } catch (error) {
      console.warn("No se pudo publicar la fuente remota.", error);

      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body,
        });

        document.documentElement.dataset.pvdRemote = "sent";
        setAdminMessage("Datos enviados a Google Sheets. Pulsa Sincronizar ahora para confirmar lectura.", "success");
        return true;
      } catch (fallbackError) {
        console.warn("No se pudo publicar con envio no-cors.", fallbackError);
      }

      document.documentElement.dataset.pvdRemote = "error";
      setAdminMessage("No se pudo publicar en Google Sheets. Revisa URL, token y permisos del Apps Script.", "error");
      return false;
    }
  };

  const exportData = () => {
    const payload = JSON.stringify(data, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `pvd-aniversario-datos-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      try {
        const importedData = JSON.parse(String(reader.result || "{}"));

        if (!validateImportedData(importedData)) {
          setAdminMessage("El archivo JSON no tiene la estructura esperada.", "error");
          return;
        }

        applyData(importedData);
        saveData();
        renderApp();
        setAdminMessage("Datos importados correctamente.", "success");
      } catch (error) {
        console.warn("No se pudo importar el archivo.", error);
        setAdminMessage("No se pudo leer el archivo JSON seleccionado.", "error");
      }
    });

    reader.readAsText(file);
  };

  const importDataFromText = (rawValue) => {
    try {
      const importedData = JSON.parse(String(rawValue || "{}"));

      if (!validateImportedData(importedData)) {
        setAdminMessage("El texto JSON no tiene la estructura esperada.", "error");
        return false;
      }

      applyData(importedData);
      saveData();
      renderApp();
      setAdminMessage("Datos importados desde texto correctamente.", "success");
      return true;
    } catch (error) {
      console.warn("No se pudo importar el texto JSON.", error);
      setAdminMessage("No se pudo leer el texto JSON. Revisa llaves, comas y comillas.", "error");
      return false;
    }
  };

  const currentDataJson = () => JSON.stringify(data, null, 2);

  const storageStatus = () => {
    const storage = data.admin?.storage || {};
    const hasLocalData = Boolean(loadStoredData());

    return {
      mode: storage.label || "Local",
      description: storage.description || "Los datos se guardan en este navegador.",
      publicSource: storage.publicSourceUrl || "Pendiente de conectar",
      writeEndpoint: storage.writeEndpointUrl || "Pendiente de conectar",
      localState: hasLocalData ? "Hay cambios guardados en este navegador." : "Usando datos base del sitio.",
      remoteState: document.documentElement.dataset.pvdRemote || "sin configurar",
    };
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  };

  const teamStatusLabel = (team) => (team.active ? "Activo" : "Inactivo");

  const statusMeta = {
    scheduled: { label: "Programado", className: "scheduled", cardClass: "match-scheduled" },
    live: { label: "En vivo", className: "live", cardClass: "match-live" },
    finished: { label: "Finalizado", className: "finished", cardClass: "match-finished" },
    suspended: { label: "Suspendido", className: "suspended", cardClass: "match-suspended" },
    walkover: { label: "W.O.", className: "walkover", cardClass: "match-walkover" },
  };

  const resultMeta = {
    live: { label: "En vivo", className: "result-live" },
    finished: { label: "Finalizado", className: "result-closed" },
    walkover: { label: "W.O.", className: "result-walkover" },
    suspended: { label: "Suspendido", className: "result-suspended" },
  };

  const teamsById = () => {
    const teams = Array.isArray(data.teams) ? data.teams : [];
    return new Map(teams.map((team) => [team.id, team]));
  };

  const formatDate = (value) => {
    if (!value) return "Fecha por confirmar";

    const parts = value.split("-");
    if (parts.length !== 3) return value;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const resolveMatchTeam = (match, side, teamMap) => {
    const teamId = match[`${side}TeamId`];
    const team = teamId ? teamMap.get(teamId) : null;

    return {
      id: teamId || "",
      initials: team?.initials || match[`${side}Initials`] || teamId || "PVD",
      name: team?.name || match[`${side}Label`] || "Por definir",
    };
  };

  const matchFilterKey = (match) => {
    if (match.phase === "Grupo A") return "A";
    if (match.phase === "Grupo B") return "B";
    if (match.phase === "Fase final") return "final";
    return "all";
  };

  const scoreValue = (value) => (value === null || value === undefined ? "-" : String(value));

  const scoreLine = (match) => {
    if (match.homeGoals === null || match.homeGoals === undefined || match.awayGoals === null || match.awayGoals === undefined) {
      return "-";
    }

    return `${match.homeGoals} - ${match.awayGoals}`;
  };

  const scoreCaption = (match) => {
    if (match.status === "suspended") return "Pausa";
    if (match.status === "walkover") return "W.O.";
    if (match.time) return match.time;
    if (match.round === "Final") return "Final";
    return "Por definir";
  };

  const addWinnerClass = (element, goals, rivalGoals, status) => {
    if ((status === "finished" || status === "walkover") && goals !== null && rivalGoals !== null && goals > rivalGoals) {
      element.classList.add("winner");
    }
  };

  const renderTeamCard = (team) => {
    const card = createElement("article", "team-card");

    if (!team.active) {
      card.classList.add("is-inactive");
    }

    const badge = createElement("span", "team-badge", team.initials || team.id);
    const content = createElement("div");
    const name = createElement("h3", "", team.name);
    const delegate = createElement("p", "", team.delegate || "Delegado por confirmar");
    const status = createElement("small", "", teamStatusLabel(team));

    content.append(name, delegate);
    card.append(badge, content, status);

    card.dataset.teamId = team.id;
    card.dataset.teamGroup = team.group;

    return card;
  };

  const renderTeams = () => {
    const teams = Array.isArray(data.teams) ? data.teams : [];

    document.querySelectorAll("[data-render-teams]").forEach((target) => {
      const group = target.dataset.renderTeams;
      const groupTeams = teams.filter((team) => team.group === group);

      target.replaceChildren(...groupTeams.map(renderTeamCard));

      const counter = document.querySelector(`[data-group-count="${group}"]`);
      if (counter) {
        const label = groupTeams.length === 1 ? "1 equipo" : `${groupTeams.length} equipos`;
        counter.textContent = label;
      }
    });
  };

  const renderMatchCard = (match, options = {}) => {
    const teamMap = teamsById();
    const homeTeam = resolveMatchTeam(match, "home", teamMap);
    const awayTeam = resolveMatchTeam(match, "away", teamMap);
    const meta = statusMeta[match.status] || statusMeta.scheduled;
    const isActiveScore = match.homeGoals !== null || match.awayGoals !== null || match.status === "live";
    const card = createElement("article", `match-card ${meta.cardClass}`);

    if (options.featured) {
      card.classList.add("featured-match");
    }

    if (match.highlight) {
      card.classList.add("highlight-match");
    }

    card.dataset.matchId = match.id;
    card.dataset.matchFilter = matchFilterKey(match);
    card.dataset.matchStatus = match.status;

    const header = createElement("header", "match-header");
    const phase = createElement("span", "", `${match.phase} \u00b7 ${match.round}`);
    const status = createElement("strong", `status ${meta.className}`, match.statusLabel || meta.label);
    header.append(phase, status);

    const body = createElement("div", "match-body");
    const home = createElement("div", "match-team");
    const homeBadge = createElement("span", "team-badge", homeTeam.initials);
    const homeName = createElement("strong", "", homeTeam.name);
    home.append(homeBadge, homeName);
    addWinnerClass(home, match.homeGoals, match.awayGoals, match.status);

    const score = createElement("div", "score-box");
    if (isActiveScore) {
      score.classList.add("active-score");
    }
    if (match.status === "suspended") {
      score.classList.add("muted-score");
    }
    score.append(
      createElement("span", "", scoreValue(match.homeGoals)),
      createElement("small", "", scoreCaption(match)),
      createElement("span", "", scoreValue(match.awayGoals)),
    );

    const away = createElement("div", "match-team away");
    const awayBadge = createElement("span", "team-badge", awayTeam.initials);
    const awayName = createElement("strong", "", awayTeam.name);
    away.append(awayBadge, awayName);
    addWinnerClass(away, match.awayGoals, match.homeGoals, match.status);

    body.append(home, score, away);

    const footer = createElement("footer", "match-meta");
    footer.append(
      createElement("span", "", formatDate(match.date)),
      createElement("span", "", match.note || match.court || "Cancha por confirmar"),
    );

    card.append(header, body, footer);

    return card;
  };

  const getFixtureMatches = () => (Array.isArray(data.matches) ? data.matches : []);

  const filterMatches = (matches, filter) => {
    if (filter === "all") return matches;
    return matches.filter((match) => matchFilterKey(match) === filter);
  };

  const renderLiveFeature = (filter = "all") => {
    const target = document.querySelector("[data-render-live]");
    if (!target) return;

    const liveMatch = filterMatches(getFixtureMatches(), filter).find((match) => match.status === "live");

    if (!liveMatch) {
      target.classList.add("is-empty");
      target.replaceChildren(
        createElement("div", "live-feature-heading"),
        createElement("p", "live-feature-empty", "No hay partido en vivo para este filtro."),
      );
      const heading = target.querySelector(".live-feature-heading");
      heading.append(createElement("span", "", "En vivo ahora"), createElement("strong", "", "Sin partido en curso"));
      return;
    }

    target.classList.remove("is-empty");

    const heading = createElement("div", "live-feature-heading");
    heading.append(createElement("span", "", "En vivo ahora"), createElement("strong", "", "Partido principal en curso"));

    target.replaceChildren(heading, renderMatchCard(liveMatch, { featured: true }));
  };

  const renderFixture = (filter = "all") => {
    const target = document.querySelector("[data-render-fixture]");
    if (!target) return;

    const matches = filterMatches(getFixtureMatches(), filter).filter((match) => match.status !== "live");

    if (!matches.length) {
      target.replaceChildren(createElement("p", "fixture-empty", "No hay partidos registrados para este filtro."));
      return;
    }

    target.replaceChildren(...matches.map((match) => renderMatchCard(match)));
  };

  const bindFixtureFilters = () => {
    const filters = document.querySelectorAll("[data-fixture-filter]");

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.fixtureFilter || "all";

        filters.forEach((item) => item.classList.toggle("active", item === button));
        renderLiveFeature(filter);
        renderFixture(filter);
      });
    });
  };

  const resultMatches = () =>
    getFixtureMatches().filter((match) => ["live", "finished", "walkover", "suspended"].includes(match.status));

  const standingsMatches = () =>
    getFixtureMatches().filter((match) =>
      ["live", "finished", "walkover"].includes(match.status) &&
      match.homeTeamId &&
      match.awayTeamId &&
      match.homeGoals !== null &&
      match.homeGoals !== undefined &&
      match.awayGoals !== null &&
      match.awayGoals !== undefined,
    );

  const renderResultSummary = () => {
    const target = document.querySelector("[data-render-results-summary]");
    if (!target) return;

    const matches = getFixtureMatches();
    const summary = [
      { label: "En vivo", value: matches.filter((match) => match.status === "live").length },
      { label: "Finalizados", value: matches.filter((match) => match.status === "finished").length },
      { label: "W.O.", value: matches.filter((match) => match.status === "walkover").length },
      { label: "Suspendidos", value: matches.filter((match) => match.status === "suspended").length },
    ];

    target.replaceChildren(
      ...summary.map((item) => {
        const card = createElement("article");
        card.append(createElement("span", "", item.label), createElement("strong", "", item.value));
        return card;
      }),
    );
  };

  const renderResultCard = (match) => {
    const teamMap = teamsById();
    const homeTeam = resolveMatchTeam(match, "home", teamMap);
    const awayTeam = resolveMatchTeam(match, "away", teamMap);
    const meta = resultMeta[match.status] || resultMeta.finished;
    const card = createElement("article", `result-card ${meta.className}`);

    card.dataset.resultMatchId = match.id;
    card.dataset.resultStatus = match.status;

    const header = createElement("header");
    header.append(
      createElement("span", "", match.statusLabel || meta.label),
      createElement("small", "", `${match.phase} \u00b7 ${match.round}`),
    );

    const score = createElement("div", "result-score");
    const home = createElement("strong", "", homeTeam.name);
    const away = createElement("strong", "", awayTeam.name);

    if ((match.status === "finished" || match.status === "walkover") && match.homeGoals !== null && match.awayGoals !== null) {
      if (match.homeGoals > match.awayGoals) home.classList.add("winner");
      if (match.awayGoals > match.homeGoals) away.classList.add("winner");
    }

    score.append(home, createElement("span", "", scoreLine(match)), away);

    const footerText = match.note || `${match.court || "Cancha por confirmar"} \u00b7 ${scoreCaption(match)}`;
    const footer = createElement("footer", "", footerText);

    card.append(header, score, footer);

    return card;
  };

  const renderResults = () => {
    const target = document.querySelector("[data-render-results]");
    if (!target) return;

    const matches = resultMatches();

    if (!matches.length) {
      target.replaceChildren(createElement("p", "results-empty", "A\u00fan no hay resultados registrados."));
      return;
    }

    target.replaceChildren(...matches.map(renderResultCard));
  };

  const createStandingRow = (row, index) => {
    const tableRow = createElement("tr", index < 2 ? "qualifier-row" : "");
    const goalDiff = row.gf - row.gc;
    const values = [
      { label: "Pos", value: index + 1 },
      { label: "Equipo", value: row.name },
      { label: "PJ", value: row.played },
      { label: "PG", value: row.won },
      { label: "PE", value: row.drawn },
      { label: "PP", value: row.lost },
      { label: "GF", value: row.gf },
      { label: "GC", value: row.gc },
      { label: "DG", value: goalDiff > 0 ? `+${goalDiff}` : goalDiff },
    ];

    values.forEach((item) => {
      const cell = createElement("td", "", item.value);
      cell.dataset.label = item.label;
      tableRow.append(cell);
    });

    const points = createElement("td");
    points.dataset.label = "PTS";
    points.append(createElement("strong", "", row.points));
    tableRow.append(points);

    return tableRow;
  };

  const calculateStandings = (group) => {
    const teams = (Array.isArray(data.teams) ? data.teams : []).filter((team) => team.group === group);
    const rows = new Map(
      teams.map((team) => [
        team.id,
        {
          id: team.id,
          name: team.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          gc: 0,
          points: 0,
        },
      ]),
    );

    standingsMatches()
      .filter((match) => matchFilterKey(match) === group)
      .forEach((match) => {
        const home = rows.get(match.homeTeamId);
        const away = rows.get(match.awayTeamId);
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.gf += match.homeGoals;
        home.gc += match.awayGoals;
        away.gf += match.awayGoals;
        away.gc += match.homeGoals;

        if (match.homeGoals > match.awayGoals) {
          home.won += 1;
          home.points += 3;
          away.lost += 1;
        } else if (match.homeGoals < match.awayGoals) {
          away.won += 1;
          away.points += 3;
          home.lost += 1;
        } else {
          home.drawn += 1;
          away.drawn += 1;
          home.points += 1;
          away.points += 1;
        }
      });

    return Array.from(rows.values()).sort((a, b) => {
      const diffA = a.gf - a.gc;
      const diffB = b.gf - b.gc;

      return (
        b.points - a.points ||
        diffB - diffA ||
        b.gf - a.gf ||
        a.name.localeCompare(b.name, "es")
      );
    });
  };

  const groupQualifierLabels = () => {
    const groupA = calculateStandings("A");
    const groupB = calculateStandings("B");

    return {
      firstA: groupA[0]?.name || "1.\u00ba Grupo A",
      secondA: groupA[1]?.name || "2.\u00ba Grupo A",
      firstB: groupB[0]?.name || "1.\u00ba Grupo B",
      secondB: groupB[1]?.name || "2.\u00ba Grupo B",
    };
  };

  const renderStandings = () => {
    document.querySelectorAll("[data-render-standings]").forEach((target) => {
      const group = target.dataset.renderStandings;
      const rows = calculateStandings(group);
      target.replaceChildren(...rows.map(createStandingRow));
    });
  };

  const finalStageMatches = () => {
    const finalStage = data.finalStage || {};
    return [
      ...(Array.isArray(finalStage.semifinals) ? finalStage.semifinals : []),
      finalStage.final,
      finalStage.thirdPlace,
    ].filter(Boolean);
  };

  const finalScoreValue = (value) => (value === null || value === undefined ? "" : String(value));

  const updateBracketMatch = (target, match) => {
    const title = target.querySelector("h3");
    const scoreline = target.querySelector(".bracket-scoreline");
    if (!scoreline) return;

    if (title) {
      title.textContent = match.label || title.textContent;
    }

    const home = createElement("span", "", match.home || "Por definir");
    const homeScore = createElement("strong", "", finalScoreValue(match.homeGoals));
    const awayScore = createElement("strong", "", finalScoreValue(match.awayGoals));
    const away = createElement("span", "", match.away || "Por definir");

    if (match.homeGoals !== null && match.homeGoals !== undefined && match.awayGoals !== null && match.awayGoals !== undefined) {
      if (match.homeGoals > match.awayGoals) home.classList.add("winner");
      if (match.awayGoals > match.homeGoals) away.classList.add("winner");
    }

    scoreline.replaceChildren(home, homeScore, awayScore, away);
  };

  const renderFinalStage = () => {
    const matches = new Map(finalStageMatches().map((match) => [match.id, match]));

    document.querySelectorAll("[data-render-final-match]").forEach((target) => {
      const match = matches.get(target.dataset.renderFinalMatch);
      if (match) {
        updateBracketMatch(target, match);
      }
    });

    const podium = data.finalStage?.podium || {};
    document.querySelectorAll("[data-render-podium]").forEach((target) => {
      const key = target.dataset.renderPodium;
      target.textContent = podium[key] || "Por definir";
    });
  };

  const renderRules = () => {
    const rules = data.rules || {};
    const scoringTarget = document.querySelector("[data-render-scoring]");
    const tiebreakersTarget = document.querySelector("[data-render-tiebreakers]");
    const pointsLabel = (value) => `${value} ${value === 1 ? "pt" : "pts"}`;

    if (scoringTarget && rules.scoring) {
      const scoringItems = [
        { label: "Partido ganado", value: rules.scoring.win },
        { label: "Partido empatado", value: rules.scoring.draw },
        { label: "Partido perdido", value: rules.scoring.loss },
      ];

      scoringTarget.replaceChildren(
        ...scoringItems.map((item) => {
          const row = createElement("div");
          row.append(
            createElement("dt", "", item.label),
            createElement("dd", "", pointsLabel(item.value)),
          );
          return row;
        }),
      );
    }

    if (tiebreakersTarget && Array.isArray(rules.tiebreakers)) {
      tiebreakersTarget.replaceChildren(
        ...rules.tiebreakers.map((criterion) => createElement("li", "", criterion)),
      );
    }
  };

  const renderAdminStats = () => {
    const target = document.querySelector("[data-render-admin-stats]");
    if (!target) return;

    const teams = Array.isArray(data.teams) ? data.teams : [];
    const matches = getFixtureMatches();
    const adminSummary = data.admin?.summary || {};
    const stats = [
      { label: "Equipos", value: teams.length || adminSummary.totalTeams || 0 },
      { label: "Partidos", value: matches.length || adminSummary.estimatedMatches || 0 },
      { label: "En vivo", value: matches.filter((match) => match.status === "live").length },
    ];

    target.replaceChildren(
      ...stats.map((item) => {
        const card = createElement("article");
        card.append(createElement("span", "", item.label), createElement("strong", "", item.value));
        return card;
      }),
    );
  };

  const renderAdminModules = () => {
    const target = document.querySelector("[data-render-admin-modules]");
    if (!target) return;

    const modules = Array.isArray(data.admin?.modules) ? data.admin.modules : [];
    if (!modules.length) return;

    target.replaceChildren(
      ...modules.map((module, index) => {
        const card = createElement("article", "admin-module");
        const number = String(index + 1).padStart(2, "0");

        card.append(
          createElement("span", "", number),
          createElement("h3", "", module.title),
          createElement("p", "", module.description),
          createElement("button", "", module.action),
        );

        const button = card.querySelector("button");
        button.type = "button";
        button.dataset.adminModule = module.key || module.title.toLowerCase().replace(/\s+/g, "-");

        return card;
      }),
    );
  };

  const renderAdminPanel = () => {
    renderAdminStats();
    renderAdminModules();
  };

  const setAdminMessage = (message, type = "info") => {
    const target = document.querySelector("[data-admin-message]");
    if (!target) return;

    target.textContent = message;
    target.dataset.messageType = type;
  };

  const renderApp = () => {
    renderTeams();
    renderLiveFeature();
    renderFixture();
    renderResultSummary();
    renderResults();
    renderStandings();
    renderFinalStage();
    renderRules();
    renderAdminPanel();
  };

  const persistAndRender = (message) => {
    saveData();
    renderApp();
    setAdminMessage(message, "success");
  };

  const createField = (label, input) => {
    const field = createElement("label", "admin-editor-field");
    field.append(createElement("span", "", label), input);
    return field;
  };

  const createInput = (value, type = "text") => {
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    return input;
  };

  const createSelect = (value, options) => {
    const select = document.createElement("select");
    options.forEach((option) => {
      const item = createElement("option", "", option.label);
      item.value = option.value;
      item.selected = option.value === value;
      select.append(item);
    });
    return select;
  };

  const renderBackupEditor = (workspace) => {
    const panel = createElement("div", "admin-editor admin-backup-editor");
    const status = storageStatus();
    const textarea = document.createElement("textarea");
    textarea.value = currentDataJson();
    textarea.spellcheck = false;
    textarea.setAttribute("aria-label", "Datos JSON del campeonato");

    const statusGrid = createElement("div", "admin-sync-status");
    [
      { label: "Modo actual", value: status.mode },
      { label: "Estado local", value: status.localState },
      { label: "Lectura publica", value: status.publicSource },
      { label: "Escritura admin", value: status.writeEndpoint },
      { label: "Sincronizacion", value: status.remoteState },
    ].forEach((item) => {
      const card = createElement("article");
      card.append(createElement("span", "", item.label), createElement("strong", "", item.value));
      statusGrid.append(card);
    });

    const note = createElement("p", "admin-sync-note", status.description);
    const publicSourceInput = createInput(data.admin?.storage?.publicSourceUrl || "", "url");
    const writeEndpointInput = createInput(data.admin?.storage?.writeEndpointUrl || "", "url");
    const tokenInput = createInput("", "password");
    tokenInput.placeholder = "Token privado de Apps Script";
    const toolbar = createElement("div", "admin-editor-toolbar");
    const saveStorageButton = createElement("button", "admin-save-button", "Guardar URLs");
    const syncButton = createElement("button", "admin-secondary-button", "Sincronizar ahora");
    const publishButton = createElement("button", "admin-save-button", "Publicar en Google Sheets");
    const refreshButton = createElement("button", "admin-secondary-button", "Actualizar texto");
    const importTextButton = createElement("button", "admin-save-button", "Importar texto JSON");
    const exportButton = createElement("button", "admin-secondary-button", "Descargar JSON");

    saveStorageButton.type = "button";
    syncButton.type = "button";
    publishButton.type = "button";
    refreshButton.type = "button";
    importTextButton.type = "button";
    exportButton.type = "button";

    saveStorageButton.addEventListener("click", () => {
      data.admin.storage = {
        ...(data.admin.storage || {}),
        mode: publicSourceInput.value.trim() ? "remote-json" : "local-json",
        label: publicSourceInput.value.trim() ? "Google Sheets / Apps Script" : "Local + respaldo JSON",
        publicSourceUrl: publicSourceInput.value.trim(),
        writeEndpointUrl: writeEndpointInput.value.trim(),
      };

      persistAndRender("Configuracion de sincronizacion guardada.");
      renderBackupEditor(workspace);
      startRemoteSync();
    });

    syncButton.addEventListener("click", () => {
      loadRemoteData();
    });

    publishButton.addEventListener("click", () => {
      pushRemoteData(tokenInput.value);
    });

    refreshButton.addEventListener("click", () => {
      textarea.value = currentDataJson();
      setAdminMessage("Texto JSON actualizado con los datos actuales.", "success");
    });

    importTextButton.addEventListener("click", () => {
      const imported = importDataFromText(textarea.value);
      if (imported) {
        renderBackupEditor(workspace);
      }
    });

    exportButton.addEventListener("click", () => {
      exportData();
      setAdminMessage("Archivo JSON exportado correctamente.", "success");
    });

    toolbar.append(saveStorageButton, syncButton, publishButton, refreshButton, importTextButton, exportButton);

    panel.append(
      createElement("h3", "", "Respaldo y sincronizacion"),
      note,
      statusGrid,
      createField("URL publica de lectura (Apps Script /exec)", publicSourceInput),
      createField("URL privada de escritura (Apps Script /exec)", writeEndpointInput),
      createField("Token privado temporal", tokenInput),
      createField("JSON editable para respaldo o importacion", textarea),
      toolbar,
    );

    workspace.replaceChildren(panel);
  };

  const renderTeamsEditor = (workspace) => {
    const panel = createElement("div", "admin-editor");
    panel.append(createElement("h3", "", "Gestionar equipos"));

    const createTeamEditorRow = (team) => {
      const row = createElement("article", "admin-editor-row admin-team-row");
      row.dataset.teamId = team.id;

      const active = document.createElement("input");
      active.type = "checkbox";
      active.checked = Boolean(team.active);

      const removeButton = createElement("button", "admin-remove-button", "Quitar");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => {
        row.remove();
      });

      row.append(
        createField("Código", createInput(team.id)),
        createField("Nombre", createInput(team.name)),
        createField("Iniciales", createInput(team.initials)),
        createField("Grupo", createSelect(team.group, [
          { value: "A", label: "Grupo A" },
          { value: "B", label: "Grupo B" },
        ])),
        createField("Delegado", createInput(team.delegate)),
        createField("Color", createInput(team.color)),
        createField("Activo", active),
        removeButton,
      );

      return row;
    };

    const nextTeamId = () => {
      const used = new Set(Array.from(list.querySelectorAll(".admin-editor-row")).map((row) => row.querySelector("input")?.value.trim()));
      let index = used.size + 1;
      let candidate = `N${String(index).padStart(2, "0")}`;

      while (used.has(candidate)) {
        index += 1;
        candidate = `N${String(index).padStart(2, "0")}`;
      }

      return candidate;
    };

    const list = createElement("div", "admin-editor-list");
    (data.teams || []).forEach((team) => {
      list.append(createTeamEditorRow(team));
    });

    const toolbar = createElement("div", "admin-editor-toolbar");
    const addButton = createElement("button", "admin-secondary-button", "Agregar equipo");
    addButton.type = "button";
    addButton.addEventListener("click", () => {
      const id = nextTeamId();
      list.append(
        createTeamEditorRow({
          id,
          name: "Nuevo equipo",
          initials: id,
          group: "A",
          delegate: "Delegado por confirmar",
          color: "Por definir",
          active: true,
        }),
      );
    });
    toolbar.append(addButton);

    const saveButton = createElement("button", "admin-save-button", "Guardar equipos");
    saveButton.type = "button";
    saveButton.addEventListener("click", () => {
      const rows = Array.from(list.querySelectorAll(".admin-editor-row"));
      const ids = rows.map((row) => row.querySelector("input")?.value.trim()).filter(Boolean);
      const uniqueIds = new Set(ids);

      if (ids.length !== rows.length || uniqueIds.size !== ids.length) {
        setAdminMessage("Cada equipo necesita un código único antes de guardar.", "error");
        return;
      }

      const idMap = new Map();
      data.teams = rows.map((row) => {
        const fields = row.querySelectorAll("input, select");
        const id = fields[0].value.trim();
        idMap.set(row.dataset.teamId, id);

        return {
          id,
          name: fields[1].value.trim() || id,
          initials: fields[2].value.trim() || id,
          group: fields[3].value,
          delegate: fields[4].value.trim() || "Delegado por confirmar",
          color: fields[5].value.trim() || "Por definir",
          active: fields[6].checked,
        };
      });

      data.matches = getFixtureMatches()
        .filter((match) => !match.homeTeamId || (idMap.has(match.homeTeamId) && idMap.has(match.awayTeamId)))
        .map((match) => ({
          ...match,
          homeTeamId: idMap.get(match.homeTeamId) || match.homeTeamId,
          awayTeamId: idMap.get(match.awayTeamId) || match.awayTeamId,
        }));

      persistAndRender("Equipos guardados correctamente.");
      renderTeamsEditor(workspace);
    });

    panel.append(toolbar, list, saveButton);
    workspace.replaceChildren(panel);
  };

  const renderMatchesEditor = (workspace) => {
    const panel = createElement("div", "admin-editor");
    const teams = data.teams || [];
    const teamOptions = teams.map((team) => ({ value: team.id, label: `${team.initials} - ${team.name}` }));
    const statusOptions = Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }));

    panel.append(createElement("h3", "", "Editar fixture y resultados"));

    const nextMatchId = () => {
      const used = new Set(Array.from(list.querySelectorAll(".admin-editor-row")).map((row) => row.querySelector("input")?.value.trim()));
      let index = used.size + 1;
      let candidate = `M${String(index).padStart(2, "0")}`;

      while (used.has(candidate)) {
        index += 1;
        candidate = `M${String(index).padStart(2, "0")}`;
      }

      return candidate;
    };

    const createMatchEditorRow = (match) => {
      const row = createElement("article", "admin-editor-row admin-match-row");
      row.dataset.matchId = match.id;

      const removeButton = createElement("button", "admin-remove-button", "Quitar");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => {
        row.remove();
      });

      row.append(
        createField("Código", createInput(match.id)),
        createField("Fase", createInput(match.phase)),
        createField("Jornada", createInput(match.round)),
        createField("Local", createSelect(match.homeTeamId, teamOptions)),
        createField("Visitante", createSelect(match.awayTeamId, teamOptions)),
        createField("Estado", createSelect(match.status, statusOptions)),
        createField("Goles local", createInput(match.homeGoals ?? "", "number")),
        createField("Goles visitante", createInput(match.awayGoals ?? "", "number")),
        createField("Fecha", createInput(match.date, "date")),
        createField("Hora", createInput(match.time)),
        createField("Cancha", createInput(match.court)),
        createField("Nota", createInput(match.note)),
        removeButton,
      );

      return row;
    };

    const list = createElement("div", "admin-editor-list");
    getFixtureMatches()
      .filter((match) => match.homeTeamId && match.awayTeamId)
      .forEach((match) => {
        list.append(createMatchEditorRow(match));
      });

    const toolbar = createElement("div", "admin-editor-toolbar");
    const addButton = createElement("button", "admin-secondary-button", "Agregar partido");
    addButton.type = "button";
    addButton.addEventListener("click", () => {
      const id = nextMatchId();
      const firstTeam = teamOptions[0]?.value || "";
      const secondTeam = teamOptions[1]?.value || firstTeam;
      list.append(
        createMatchEditorRow({
          id,
          phase: "Grupo A",
          round: "Fecha nueva",
          date: data.event?.date || "",
          time: "",
          court: data.event?.venue || "Cancha principal",
          homeTeamId: firstTeam,
          awayTeamId: secondTeam,
          homeGoals: null,
          awayGoals: null,
          status: "scheduled",
          note: "",
        }),
      );
    });
    toolbar.append(addButton);

    const saveButton = createElement("button", "admin-save-button", "Guardar fixture/resultados");
    saveButton.type = "button";
    saveButton.addEventListener("click", () => {
      const rows = Array.from(list.querySelectorAll(".admin-editor-row"));
      const ids = rows.map((row) => row.querySelector("input")?.value.trim()).filter(Boolean);
      const uniqueIds = new Set(ids);

      if (ids.length !== rows.length || uniqueIds.size !== ids.length) {
        setAdminMessage("Cada partido necesita un código único antes de guardar.", "error");
        return;
      }

      const nonEditableMatches = getFixtureMatches().filter((match) => !match.homeTeamId || !match.awayTeamId);
      const editableMatches = rows.map((row) => {
        const fields = row.querySelectorAll("input, select");

        return {
          id: fields[0].value.trim(),
          phase: fields[1].value.trim() || "Grupo",
          round: fields[2].value.trim() || "Fecha",
          homeTeamId: fields[3].value,
          awayTeamId: fields[4].value,
          status: fields[5].value,
          homeGoals: fields[6].value === "" ? null : Number(fields[6].value),
          awayGoals: fields[7].value === "" ? null : Number(fields[7].value),
          date: fields[8].value,
          time: fields[9].value.trim(),
          court: fields[10].value.trim() || "Cancha principal",
          note: fields[11].value.trim(),
        };
      });

      data.matches = [...editableMatches, ...nonEditableMatches];
      persistAndRender("Fixture y resultados guardados correctamente.");
      renderMatchesEditor(workspace);
    });

    panel.append(toolbar, list, saveButton);
    workspace.replaceChildren(panel);
  };

  const renderFinalsEditor = (workspace) => {
    const panel = createElement("div", "admin-editor");
    panel.append(createElement("h3", "", "Fase final y podio"));

    const toolbar = createElement("div", "admin-editor-toolbar");
    const generateButton = createElement("button", "admin-secondary-button", "Generar semifinales desde tabla");
    generateButton.type = "button";
    generateButton.addEventListener("click", () => {
      const qualifiers = groupQualifierLabels();

      data.finalStage.semifinals = [
        {
          ...(data.finalStage.semifinals?.[0] || { id: "SF1", label: "Semifinal 1" }),
          id: "SF1",
          label: "Semifinal 1",
          home: qualifiers.firstA,
          away: qualifiers.secondB,
          homeGoals: null,
          awayGoals: null,
        },
        {
          ...(data.finalStage.semifinals?.[1] || { id: "SF2", label: "Semifinal 2" }),
          id: "SF2",
          label: "Semifinal 2",
          home: qualifiers.firstB,
          away: qualifiers.secondA,
          homeGoals: null,
          awayGoals: null,
        },
      ];

      data.finalStage.final = {
        ...data.finalStage.final,
        home: "Ganador 1",
        away: "Ganador 2",
        homeGoals: null,
        awayGoals: null,
      };

      data.finalStage.thirdPlace = {
        ...data.finalStage.thirdPlace,
        home: "Perdedor 1",
        away: "Perdedor 2",
        homeGoals: null,
        awayGoals: null,
      };

      data.finalStage.podium = {
        champion: "Por definir",
        runnerUp: "Por definir",
        thirdPlace: "Por definir",
      };

      persistAndRender("Semifinales generadas desde la tabla de posiciones.");
      renderFinalsEditor(workspace);
    });
    toolbar.append(generateButton);

    const list = createElement("div", "admin-editor-list");
    finalStageMatches().forEach((match) => {
      const row = createElement("article", "admin-editor-row");
      row.dataset.finalMatchId = match.id;
      row.append(
        createField("Etiqueta", createInput(match.label)),
        createField("Equipo 1", createInput(match.home)),
        createField("Goles 1", createInput(match.homeGoals ?? "", "number")),
        createField("Goles 2", createInput(match.awayGoals ?? "", "number")),
        createField("Equipo 2", createInput(match.away)),
      );
      list.append(row);
    });

    const podium = data.finalStage?.podium || {};
    const podiumRow = createElement("article", "admin-editor-row admin-podium-row");
    podiumRow.append(
      createField("Campeón", createInput(podium.champion || "Por definir")),
      createField("Subcampeón", createInput(podium.runnerUp || "Por definir")),
      createField("Tercer lugar", createInput(podium.thirdPlace || "Por definir")),
    );

    const saveButton = createElement("button", "admin-save-button", "Guardar fase final");
    saveButton.type = "button";
    saveButton.addEventListener("click", () => {
      const updates = new Map(
        Array.from(list.querySelectorAll(".admin-editor-row")).map((row) => {
          const fields = row.querySelectorAll("input");
          return [
            row.dataset.finalMatchId,
            {
              label: fields[0].value.trim(),
              home: fields[1].value.trim(),
              homeGoals: fields[2].value === "" ? null : Number(fields[2].value),
              awayGoals: fields[3].value === "" ? null : Number(fields[3].value),
              away: fields[4].value.trim(),
            },
          ];
        }),
      );

      data.finalStage.semifinals = data.finalStage.semifinals.map((match) => ({ ...match, ...(updates.get(match.id) || {}) }));
      data.finalStage.final = { ...data.finalStage.final, ...(updates.get(data.finalStage.final.id) || {}) };
      data.finalStage.thirdPlace = { ...data.finalStage.thirdPlace, ...(updates.get(data.finalStage.thirdPlace.id) || {}) };

      const podiumFields = podiumRow.querySelectorAll("input");
      data.finalStage.podium = {
        champion: podiumFields[0].value.trim() || "Por definir",
        runnerUp: podiumFields[1].value.trim() || "Por definir",
        thirdPlace: podiumFields[2].value.trim() || "Por definir",
      };

      persistAndRender("Fase final y podio guardados correctamente.");
      renderFinalsEditor(workspace);
    });

    panel.append(toolbar, list, podiumRow, saveButton);
    workspace.replaceChildren(panel);
  };

  const openAdminModule = (moduleKey) => {
    const workspace = document.querySelector("[data-admin-workspace]");
    if (!workspace) return;

    workspace.hidden = false;

    if (moduleKey === "teams") {
      renderTeamsEditor(workspace);
      return;
    }

    if (moduleKey === "finals") {
      renderFinalsEditor(workspace);
      return;
    }

    if (moduleKey === "backup") {
      renderBackupEditor(workspace);
      return;
    }

    renderMatchesEditor(workspace);
  };

  const bindAdminPanel = () => {
    const loginButton = document.querySelector("[data-admin-login]");
    const usernameInput = document.querySelector("[data-render-admin-username]");
    const passwordInput = document.querySelector("[data-admin-password]");
    const resetButton = document.querySelector("[data-admin-reset]");
    const exportButton = document.querySelector("[data-admin-export]");
    const importButton = document.querySelector("[data-admin-import]");
    const importFile = document.querySelector("[data-admin-import-file]");
    const modulesTarget = document.querySelector("[data-render-admin-modules]");

    loginButton?.addEventListener("click", () => {
      if (usernameInput?.value.trim() !== data.admin?.username) {
        setAdminMessage("Usuario administrador incorrecto.", "error");
        return;
      }

      if (passwordInput?.value !== data.admin?.password) {
        setAdminMessage("Contraseña incorrecta. Revisa el acceso local.", "error");
        return;
      }

      document.documentElement.dataset.adminUnlocked = "true";
      setAdminMessage("Panel habilitado. Ya puedes editar y guardar cambios.", "success");
      openAdminModule("teams");
    });

    resetButton?.addEventListener("click", () => {
      applyData(originalData);
      window.localStorage.removeItem(STORAGE_KEY);
      renderApp();
      setAdminMessage("Datos base restaurados correctamente.", "success");
    });

    exportButton?.addEventListener("click", () => {
      if (document.documentElement.dataset.adminUnlocked !== "true") {
        setAdminMessage("Ingresa la contraseña para exportar los datos.", "error");
        return;
      }

      exportData();
      setAdminMessage("Archivo JSON exportado correctamente.", "success");
    });

    importButton?.addEventListener("click", () => {
      if (document.documentElement.dataset.adminUnlocked !== "true") {
        setAdminMessage("Ingresa la contraseña para importar datos.", "error");
        return;
      }

      importFile?.click();
    });

    importFile?.addEventListener("change", () => {
      importData(importFile.files?.[0]);
      importFile.value = "";
    });

    modulesTarget?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-admin-module]");
      if (!button) return;

      if (document.documentElement.dataset.adminUnlocked !== "true") {
        setAdminMessage("Ingresa la contraseña para habilitar la edición.", "error");
        return;
      }

      openAdminModule(button.dataset.adminModule);
    });
  };

  renderApp();
  bindFixtureFilters();
  bindAdminPanel();
  startRemoteSync();

  document.documentElement.dataset.pvdApp = "ready";
})();
