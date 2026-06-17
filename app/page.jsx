"use client";

import { useEffect, useMemo, useState } from "react";

const roleLabels = {
  mafia: "Mafia",
  doctor: "Medyk",
  detective: "Detektyw",
  town: "Miasto"
};

const stepLabels = {
  waiting: "Lobby",
  mafia: "Noc: Mafia",
  doctor: "Noc: Medycy",
  detective: "Noc: Detektywi",
  discussion: "Dzień: dyskusja",
  finished: "Koniec"
};

export default function Home() {
  const [game, setGame] = useState(null);
  const [token, setToken] = useState("");
  const [hostToken, setHostToken] = useState("");
  const [code, setCode] = useState("");
  const [nick, setNick] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [settings, setSettings] = useState({ mafia: 1, doctors: 1, detectives: 1 });
  const [targetId, setTargetId] = useState("");
  const [voteId, setVoteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get("room");
    if (roomFromUrl) {
      setJoinCode(roomFromUrl.toUpperCase());
    }

    const saved = JSON.parse(localStorage.getItem("mafia-session") || "null");
    if (saved?.code && saved?.token) {
      setCode(saved.code);
      setToken(saved.token);
      setHostToken(saved.hostToken || "");
      loadGame(saved.code, saved.hostToken || saved.token);
    }
  }, []);

  useEffect(() => {
    if (!code || !token) return undefined;
    const interval = setInterval(() => loadGame(code, activeToken()), 2500);
    return () => clearInterval(interval);
  }, [code, token, hostToken]);

  const alivePlayers = useMemo(() => game?.players.filter((player) => player.alive) || [], [game]);
  const voteSummary = useMemo(() => countVotes(game), [game]);
  const inviteUrl = useMemo(() => {
    if (!game?.code || typeof window === "undefined") return "";
    return `${window.location.origin}?room=${game.code}`;
  }, [game?.code]);
  const isHost = game?.me?.isHost;
  const me = game?.me;

  function activeToken() {
    return hostToken || token;
  }

  function persist(nextCode, nextToken, nextHostToken = "") {
    localStorage.setItem(
      "mafia-session",
      JSON.stringify({ code: nextCode, token: nextToken, hostToken: nextHostToken })
    );
    setCode(nextCode);
    setToken(nextToken);
    setHostToken(nextHostToken);
  }

  async function request(path, options = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Coś poszło nie tak.");
      if (data.game) setGame(data.game);
      return data;
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  }

  async function loadGame(nextCode = code, nextToken = activeToken()) {
    if (!nextCode || !nextToken) return;
    try {
      const response = await fetch(`/api/games/${nextCode}?token=${nextToken}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setGame(data.game);
    } catch {
      // Polling should stay quiet when the user's connection blips.
    }
  }

  async function createGame(event) {
    event.preventDefault();
    const data = await request("/api/games", {
      method: "POST",
      body: JSON.stringify({ hostName: nick || "Host" })
    });
    persist(data.code, data.token, data.hostToken);
  }

  async function joinGame(event) {
    event.preventDefault();
    const nextCode = joinCode.trim().toUpperCase();
    const data = await request("/api/games/join", {
      method: "POST",
      body: JSON.stringify({ code: nextCode, nick })
    });
    persist(data.code, data.token);
  }

  async function hostAction(action, body = {}) {
    const data = await request(`/api/games/${code}`, {
      method: "PATCH",
      body: JSON.stringify({ action, token: activeToken(), ...body })
    });
    setGame(data.game);
  }

  async function playerAction(action, body = {}) {
    const data = await request(`/api/games/${code}`, {
      method: "PATCH",
      body: JSON.stringify({ action, token, ...body })
    });
    setGame(data.game);
  }

  function leaveSession() {
    localStorage.removeItem("mafia-session");
    setGame(null);
    setCode("");
    setToken("");
    setHostToken("");
    setTargetId("");
    setVoteId("");
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Mafia online bez kont</p>
          <h1>Hostuj pokój, rozdaj role i prowadź noc oraz dzień.</h1>
        </div>
        {game && (
          <div className="codePanel">
            <span>Kod pokoju</span>
            <strong>{game.code}</strong>
          </div>
        )}
      </section>

      {error && <div className="alert">{error}</div>}

      {!game ? (
        <section className="entryGrid">
          <form className="panel" onSubmit={createGame}>
            <h2>Stwórz grę</h2>
            <label>
              Nick hosta
              <input value={nick} onChange={(event) => setNick(event.target.value)} maxLength={28} placeholder="Np. Narrator" />
            </label>
            <button disabled={busy}>{busy ? "Tworzenie..." : "Utwórz pokój"}</button>
          </form>

          <form className="panel" onSubmit={joinGame}>
            <h2>Dołącz kodem</h2>
            <label>
              Kod
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={5} placeholder="A7K2P" />
            </label>
            <label>
              Nick
              <input value={nick} onChange={(event) => setNick(event.target.value)} maxLength={28} placeholder="Twój nick" required />
            </label>
            <button disabled={busy}>{busy ? "Dołączanie..." : "Dołącz"}</button>
          </form>
        </section>
      ) : (
        <section className="gameGrid">
          <aside className="panel statusPanel">
            <div className="roomHeader">
              <div>
                <span className="muted">Faza</span>
                <h2>{stepLabels[game.step] || game.step}</h2>
              </div>
              <button className="ghost" onClick={leaveSession}>Wyjdź</button>
            </div>

            <div className={`roleCard ${me?.role || "host"}`}>
              <span>{isHost ? "Panel hosta" : "Twoja rola"}</span>
              <strong>{isHost ? "Narrator" : roleLabels[me?.role] || "Czekaj na start"}</strong>
              {me?.team && <small>Drużyna: {me.team === "mafia" ? "Mafia" : "Miasto"}</small>}
            </div>

            {isHost && inviteUrl && (
              <div className="inviteBox">
                <span>Link zaproszenia</span>
                <input value={inviteUrl} readOnly />
                <button className="secondary" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>
                  Kopiuj link
                </button>
              </div>
            )}

            <div className="stats">
              <span>Dzień {game.day || 0}</span>
              <span>{alivePlayers.length} żywych</span>
              {game.winner && <span>Wygrywa: {game.winner === "mafia" ? "Mafia" : "Miasto"}</span>}
            </div>
          </aside>

          <section className="panel tablePanel">
            <div className="sectionHeader">
              <h2>Gracze</h2>
              <span>{game.players.length} osób</span>
            </div>
            <div className="players">
              {game.players.map((player) => (
                <div className={`player ${!player.alive ? "dead" : ""}`} key={player.id}>
                  <div>
                    <strong>{player.nick}</strong>
                    {player.isMe && <span className="badge">Ty</span>}
                  </div>
                  <span>{player.alive ? "żyje" : "odpada"}</span>
                  {player.role && <em>{roleLabels[player.role]}</em>}
                </div>
              ))}
            </div>
          </section>

          {isHost ? (
            <HostPanel
              game={game}
              settings={settings}
              setSettings={setSettings}
              busy={busy}
              hostAction={hostAction}
              voteSummary={voteSummary}
            />
          ) : (
            <PlayerPanel
              game={game}
              me={me}
              alivePlayers={alivePlayers}
              targetId={targetId}
              setTargetId={setTargetId}
              voteId={voteId}
              setVoteId={setVoteId}
              busy={busy}
              playerAction={playerAction}
            />
          )}

          <section className="panel logPanel">
            <div className="sectionHeader">
              <h2>Dziennik</h2>
              <span>ostatnie akcje</span>
            </div>
            <ol className="log">
              {game.log.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ol>
          </section>
        </section>
      )}
    </main>
  );
}

function HostPanel({ game, settings, setSettings, busy, hostAction, voteSummary }) {
  const alivePlayers = game.players.filter((player) => player.alive);
  const topVote = voteSummary[0];

  return (
    <section className="panel controlPanel">
      <div className="sectionHeader">
        <h2>Sterowanie hosta</h2>
        <span>{game.phase === "lobby" ? "ustaw role" : "prowadź turę"}</span>
      </div>

      {game.phase === "lobby" && (
        <>
          <div className="settings">
            <NumberField label="Mafia" value={settings.mafia} onChange={(value) => setSettings({ ...settings, mafia: value })} />
            <NumberField label="Medyków" value={settings.doctors} onChange={(value) => setSettings({ ...settings, doctors: value })} />
            <NumberField label="Detektywów" value={settings.detectives} onChange={(value) => setSettings({ ...settings, detectives: value })} />
          </div>
          <button disabled={busy || game.players.length < 4} onClick={() => hostAction("start", { settings })}>
            Start gry
          </button>
        </>
      )}

      {game.phase === "night" && (
        <>
          <p className="hint">{nightHint(game.step)}</p>
          <button disabled={busy} onClick={() => hostAction("advance")}>Pomiń / dalej</button>
        </>
      )}

      {game.phase === "day" && (
        <>
          <div className="voteBox">
            {voteSummary.length ? (
              voteSummary.map(([target, count]) => (
                <span key={target}>{nameForVote(game, target)}: {count}</span>
              ))
            ) : (
              <span>Brak głosów</span>
            )}
          </div>
          <div className="buttonRow">
            <button disabled={busy || !topVote} onClick={() => hostAction("eliminate", { targetId: topVote?.[0] })}>
              Wyeliminuj prowadzącego
            </button>
            <button className="secondary" disabled={busy} onClick={() => hostAction("eliminate", { targetId: "skip" })}>
              Bez eliminacji
            </button>
            <button className="secondary" disabled={busy} onClick={() => hostAction("advance")}>
              Następna noc
            </button>
          </div>
        </>
      )}

      {game.phase === "ended" && (
        <button disabled={busy} onClick={() => hostAction("reset")}>Nowa gra w tym pokoju</button>
      )}

      <details>
        <summary>Ręczna eliminacja</summary>
        <div className="manualList">
          {alivePlayers.map((player) => (
            <button className="ghost" key={player.id} onClick={() => hostAction("eliminate", { targetId: player.id })}>
              {player.nick}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}

function PlayerPanel({ game, me, alivePlayers, targetId, setTargetId, voteId, setVoteId, busy, playerAction }) {
  const canNightAct =
    game.phase === "night" &&
    me?.alive &&
    ((game.step === "mafia" && me.role === "mafia") ||
      (game.step === "doctor" && me.role === "doctor") ||
      (game.step === "detective" && me.role === "detective"));
  const canVote = game.phase === "day" && me?.alive;
  const detectiveResult = game.night?.investigationResults?.[me?.id];

  return (
    <section className="panel controlPanel">
      <div className="sectionHeader">
        <h2>Twoja akcja</h2>
        <span>{canNightAct || canVote ? "wybierz cel" : "czekaj na hosta"}</span>
      </div>

      {canNightAct && (
        <>
          <p className="hint">{playerHint(me.role)}</p>
          <SelectTarget value={targetId} onChange={setTargetId} players={alivePlayers} />
          <button disabled={busy || !targetId} onClick={() => playerAction("nightAction", { targetId })}>
            Zatwierdź akcję
          </button>
        </>
      )}

      {detectiveResult && (
        <div className="resultBox">
          Wynik śledztwa: {detectiveResult.targetNick} to {roleLabels[detectiveResult.role]}.
        </div>
      )}

      {canVote && (
        <>
          <p className="hint">W dzień głosujesz na osobę do eliminacji albo wybierasz brak eliminacji.</p>
          <SelectTarget value={voteId} onChange={setVoteId} players={alivePlayers} includeSkip />
          <button disabled={busy || !voteId} onClick={() => playerAction("vote", { targetId: voteId })}>
            Oddaj głos
          </button>
        </>
      )}

      {!canNightAct && !canVote && <p className="hint">Obserwuj dziennik i czekaj na kolejną fazę.</p>}
    </section>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input type="number" min="0" max="20" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectTarget({ value, onChange, players, includeSkip = false }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Wybierz cel</option>
      {includeSkip && <option value="skip">Bez eliminacji</option>}
      {players.map((player) => (
        <option value={player.id} key={player.id}>{player.nick}</option>
      ))}
    </select>
  );
}

function countVotes(game) {
  if (!game?.votes) return [];
  const counts = {};
  Object.values(game.votes).forEach((target) => {
    counts[target] = (counts[target] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function nameForVote(game, target) {
  if (target === "skip") return "Bez eliminacji";
  return game.players.find((player) => player.id === target)?.nick || "Nieznany";
}

function nightHint(step) {
  if (step === "mafia") return "Mafia wybiera ofiarę. Kiedy będą gotowi, przejdź dalej.";
  if (step === "doctor") return "Medycy wybierają osobę do ochrony. Mogą chronić także siebie.";
  return "Detektywi sprawdzają jednego gracza i dostają prywatny wynik.";
}

function playerHint(role) {
  if (role === "mafia") return "Wybierz osobę, którą Mafia spróbuje wyeliminować tej nocy.";
  if (role === "doctor") return "Wybierz osobę, którą chcesz ochronić przed nocnym atakiem.";
  return "Wybierz osobę, której rolę chcesz sprawdzić.";
}
