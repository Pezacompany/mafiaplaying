import crypto from "crypto";

export const ROLES = {
  mafia: { label: "Mafia", team: "mafia" },
  doctor: { label: "Medyk", team: "town" },
  detective: { label: "Detektyw", team: "town" },
  town: { label: "Miasto", team: "town" }
};

export function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function makeToken() {
  return crypto.randomBytes(18).toString("hex");
}

export function makePlayer(nick) {
  return {
    id: crypto.randomUUID(),
    token: makeToken(),
    nick: String(nick || "").trim().slice(0, 28),
    role: null,
    team: null,
    alive: true,
    joinedAt: new Date()
  };
}

export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function publicGame(game, token) {
  const me = game.players.find((player) => player.token === token);
  const isHost = token && token === game.hostToken;
  const canSeeRoles = game.phase === "ended" || isHost;

  return {
    code: game.code,
    phase: game.phase,
    step: game.step,
    day: game.day,
    settings: game.settings,
    winner: game.winner || null,
    log: game.log || [],
    night: summarizeNight(game, isHost),
    votes: game.votes || {},
    voteStats: voteStats(game),
    me: me
      ? {
          id: me.id,
          nick: me.nick,
          alive: me.alive,
          role: me.role,
          team: me.team,
          isHost
        }
      : isHost
        ? { isHost }
        : null,
    players: game.players.map((player) => ({
      id: player.id,
      nick: player.nick,
      alive: player.alive,
      role: canSeeRoles || player.token === token ? player.role : null,
      team: canSeeRoles || player.token === token ? player.team : null,
      isMe: player.token === token
    }))
  };
}

function voteStats(game) {
  const alivePlayers = (game.players || []).filter((player) => player.alive);
  const votes = game.votes || {};
  const votedIds = new Set(Object.keys(votes));
  const pending = alivePlayers.filter((player) => !votedIds.has(player.id)).map((player) => player.id);

  const counts = {};
  Object.values(votes).forEach((target) => {
    counts[target] = (counts[target] || 0) + 1;
  });

  const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topCount = ranking[0]?.[1] || 0;
  const tiedLeaders = ranking.filter(([, count]) => count === topCount).map(([id]) => id);

  return {
    aliveCount: alivePlayers.length,
    castCount: Object.keys(votes).length,
    pendingIds: pending,
    counts,
    ranking,
    leaderId: tiedLeaders.length === 1 ? tiedLeaders[0] : null,
    isTied: tiedLeaders.length > 1 && topCount > 0,
    allVoted: pending.length === 0 && alivePlayers.length > 0
  };
}

function summarizeNight(game, isHost) {
  if (!isHost) {
    return {
      result: game.night?.result || null,
      investigationResults: game.night?.investigationResults || {}
    };
  }

  return game.night || {};
}

export function assertHost(game, token) {
  if (!token || game.hostToken !== token) {
    const error = new Error("Tylko host może wykonać tę akcję.");
    error.status = 403;
    throw error;
  }
}

export function assertPlayer(game, token) {
  const player = game.players.find((candidate) => candidate.token === token);
  if (!player) {
    const error = new Error("Nie znaleziono gracza dla tej przeglądarki.");
    error.status = 403;
    throw error;
  }
  return player;
}

export function startGame(game, settings) {
  const mafia = clampInt(settings.mafia, 1, game.players.length);
  const doctors = clampInt(settings.doctors, 0, game.players.length);
  const detectives = clampInt(settings.detectives, 0, game.players.length);
  const specialCount = mafia + doctors + detectives;

  if (game.players.length < 4) {
    const error = new Error("Do gry potrzeba przynajmniej 4 graczy.");
    error.status = 400;
    throw error;
  }

  if (specialCount > game.players.length) {
    const error = new Error("Ról specjalnych jest więcej niż graczy.");
    error.status = 400;
    throw error;
  }

  const roles = [
    ...Array(mafia).fill("mafia"),
    ...Array(doctors).fill("doctor"),
    ...Array(detectives).fill("detective"),
    ...Array(game.players.length - specialCount).fill("town")
  ];
  shuffle(roles);

  game.players = game.players.map((player, index) => ({
    ...player,
    alive: true,
    role: roles[index],
    team: ROLES[roles[index]].team
  }));

  game.phase = "night";
  game.step = "mafia";
  game.day = 1;
  game.settings = { mafia, doctors, detectives };
  game.night = blankNight();
  game.votes = {};
  game.winner = null;
  game.log = [
    event("Gra wystartowała. Miasto zasypia, a Mafia wybiera ofiarę."),
    ...(game.log || [])
  ].slice(0, 80);

  return game;
}

export function submitNightAction(game, player, targetId) {
  if (game.phase !== "night") {
    const error = new Error("Akcje ról można wykonywać tylko nocą.");
    error.status = 400;
    throw error;
  }

  const target = livingPlayer(game, targetId);
  if (!player.alive) {
    const error = new Error("Wyeliminowany gracz nie może wykonywać akcji.");
    error.status = 400;
    throw error;
  }

  if (game.step === "mafia" && player.role === "mafia") {
    game.night.kills[player.id] = target.id;
    return game;
  }

  if (game.step === "doctor" && player.role === "doctor") {
    game.night.saves[player.id] = target.id;
    return game;
  }

  if (game.step === "detective" && player.role === "detective") {
    game.night.investigations[player.id] = target.id;
    game.night.investigationResults[player.id] = {
      targetId: target.id,
      targetNick: target.nick,
      role: target.role,
      team: target.team
    };
    return game;
  }

  const error = new Error("To nie jest kolej twojej roli.");
  error.status = 400;
  throw error;
}

export function advanceGame(game) {
  if (game.phase === "lobby") {
    const error = new Error("Najpierw wystartuj grę.");
    error.status = 400;
    throw error;
  }

  if (game.phase === "night") {
    if (game.step === "mafia") {
      game.step = "doctor";
      game.log = [event("Mafia kończy turę. Medycy mogą kogoś ochronić."), ...game.log].slice(0, 80);
      return game;
    }

    if (game.step === "doctor") {
      game.step = "detective";
      game.log = [event("Medycy kończą turę. Detektywi mogą sprawdzić gracza."), ...game.log].slice(0, 80);
      return game;
    }

    if (game.step === "detective") {
      resolveNight(game);
      return checkWin(game);
    }
  }

  if (game.phase === "day") {
    game.phase = "night";
    game.step = "mafia";
    game.day += 1;
    game.night = blankNight();
    game.votes = {};
    game.log = [event(`Noc ${game.day}. Miasto zasypia.`), ...game.log].slice(0, 80);
    return game;
  }

  return game;
}

export function submitVote(game, player, targetId) {
  if (game.phase !== "day") {
    const error = new Error("Głosowanie jest dostępne tylko w dzień.");
    error.status = 400;
    throw error;
  }

  if (!player.alive) {
    const error = new Error("Wyeliminowany gracz nie może głosować.");
    error.status = 400;
    throw error;
  }

  const target = targetId === "skip" ? null : livingPlayer(game, targetId);
  game.votes[player.id] = target ? target.id : "skip";
  return game;
}

export function eliminate(game, targetId, reason = "Miasto zdecydowało o eliminacji.") {
  if (targetId !== "skip") {
    const target = livingPlayer(game, targetId);
    target.alive = false;
    game.log = [event(`${reason} Odpada ${target.nick} (${ROLES[target.role].label}).`), ...game.log].slice(0, 80);
  } else {
    game.log = [event("Miasto nikogo nie eliminuje w tej turze."), ...game.log].slice(0, 80);
  }

  return checkWin(game);
}

export function resetToLobby(game) {
  game.phase = "lobby";
  game.step = "waiting";
  game.day = 0;
  game.settings = { mafia: 1, doctors: 1, detectives: 1 };
  game.players = game.players.map((player) => ({
    ...player,
    role: null,
    team: null,
    alive: true
  }));
  game.night = blankNight();
  game.votes = {};
  game.winner = null;
  game.log = [event("Gra została zresetowana do lobby."), ...(game.log || [])].slice(0, 80);
  return game;
}

function resolveNight(game) {
  const killTargetId = mostCommon(Object.values(game.night.kills));
  const savedIds = new Set(Object.values(game.night.saves));
  const killed = killTargetId ? game.players.find((player) => player.id === killTargetId) : null;

  game.phase = "day";
  game.step = "discussion";
  game.votes = {};

  if (!killed) {
    game.night.result = { type: "none" };
    game.log = [event("Świta dzień. Nikt nie został zaatakowany tej nocy."), ...game.log].slice(0, 80);
    return game;
  }

  if (savedIds.has(killed.id)) {
    game.night.result = { type: "saved", targetId: killed.id, targetNick: killed.nick };
    game.log = [event(`Świta dzień. ${killed.nick} przeżywa dzięki ochronie Medyka.`), ...game.log].slice(0, 80);
    return game;
  }

  killed.alive = false;
  game.night.result = {
    type: "killed",
    targetId: killed.id,
    targetNick: killed.nick,
    role: killed.role
  };
  game.log = [event(`Świta dzień. Nocą zginął ${killed.nick} (${ROLES[killed.role].label}).`), ...game.log].slice(0, 80);
  return game;
}

function checkWin(game) {
  const alive = game.players.filter((player) => player.alive);
  const mafia = alive.filter((player) => player.team === "mafia").length;
  const town = alive.length - mafia;

  if (mafia === 0) {
    game.phase = "ended";
    game.step = "finished";
    game.winner = "town";
    game.log = [event("Koniec gry. Miasto wygrywa, bo Mafia została usunięta."), ...game.log].slice(0, 80);
  } else if (mafia >= town) {
    game.phase = "ended";
    game.step = "finished";
    game.winner = "mafia";
    game.log = [event("Koniec gry. Mafia wygrywa, bo ma przewagę nad miastem."), ...game.log].slice(0, 80);
  }

  return game;
}

function blankNight() {
  return {
    kills: {},
    saves: {},
    investigations: {},
    investigationResults: {},
    result: null
  };
}

function livingPlayer(game, targetId) {
  const target = game.players.find((player) => player.id === targetId && player.alive);
  if (!target) {
    const error = new Error("Ten gracz nie jest dostępny jako cel.");
    error.status = 400;
    throw error;
  }
  return target;
}

function clampInt(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return min;
  }
  return Math.min(Math.max(number, min), max);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

function mostCommon(values) {
  if (!values.length) return null;
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function event(text) {
  return {
    id: crypto.randomUUID(),
    text,
    at: new Date()
  };
}
