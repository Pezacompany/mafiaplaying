"use client";

import { useEffect, useMemo, useState } from "react";

const roleLabels = {
  mafia: "Mafia",
  doctor: "Medyk",
  detective: "Detektyw",
  town: "Miasto"
};

const roleIcons = {
  mafia: "🔪",
  doctor: "💉",
  detective: "🔍",
  town: "🛡️"
};

const stepLabels = {
  waiting: "Lobby",
  mafia: "Noc · Mafia wybiera",
  doctor: "Noc · Medycy chronią",
  detective: "Noc · Detektywi sprawdzają",
  discussion: "Dzień · Głosowanie",
  finished: "Koniec gry"
};

const PHASES = [
  { key: "lobby", label: "Lobby" },
  { key: "night", label: "Noc" },
  { key: "day", label: "Dzień / Głosowanie" },
  { key: "ended", label: "Wynik" }
];

export default function Home() {
  const [game, setGame] = useState(null);
  const [token, setToken] = useState("");
  const [hostToken, setHostToken] = useState("");
  const [code, setCode] = useState("");
  const [nick, setNick] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [settings, setSettings] = useState({ mafia: 1, doctors: 1, detectives: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justVoted, setJustVoted] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code || !token) return undefined;
    const interval = setInterval(() => loadGame(code, activeToken()), 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, hostToken]);

  useEffect(() => {
    if (!justVoted) return undefined;
    const timeout = setTimeout(() => setJustVoted(false), 1800);
    return () => clearTimeout(timeout);
  }, [justVoted]);

  const alivePlayers = useMemo(() => game?.players.filter((player) => player.alive) || [], [game]);
  const inviteUrl = useMemo(() => {
    if (!game?.code || typeof window === "undefined") return "";
    return `${window.location.origin}?room=${game.code}`;
  }, [game?.code]);
  const isHost = game?.me?.isHost;
  const me = game?.me;
  const myVoteId = me ? game?.votes?.[me.id] : undefined;

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
    if (action === "vote") setJustVoted(true);
  }

  function leaveSession() {
    localStorage.removeItem("mafia-session");
    setGame(null);
    setCode("");
    setToken("");
    setHostToken("");
  }

  const phaseIndex = PHASES.findIndex((phase) => phase.key === game?.phase);

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

      {error && <div className="alert">⚠ {error}</div>}

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
          {game.phase !== "lobby" && (
            <div className="phaseTrack">
              {PHASES.slice(1).map((phase, index) => {
                const realIndex = index + 1;
                const state =
                  realIndex < phaseIndex ? "done" : realIndex === phaseIndex ? "active" : "todo";
                return (
                  <div className={`phaseStep ${state}`} key={phase.key}>
                    <span className="dot" />
                    <span>{phase.label}</span>
                  </div>
                );
              })}
            </div>
          )}

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
              <strong>
                {roleIcons[me?.role] ? `${roleIcons[me?.role]} ` : ""}
                {isHost ? "Narrator" : roleLabels[me?.role] || "Czekaj na start"}
              </strong>
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
              {game.players.map((player) => {
                const hasVoted = game.phase === "day" && game.votes && player.id in game.votes;
                return (
                  <div className={`player ${!player.alive ? "dead" : ""}`} key={player.id}>
                    <div className="playerAvatar">{initials(player.nick)}</div>
                    <div className="playerInfo">
                      <strong>
                        {player.nick}
                        {player.isMe && <span className="badge">Ty</span>}
                      </strong>
                      <span className="muted">{player.alive ? "żyje" : "odpadł"}</span>
                    </div>
                    {player.role && <em>{roleIcons[player.role]} {roleLabels[player.role]}</em>}
                    {game.phase === "day" && player.alive && (
                      <span className={`voteFlag ${hasVoted ? "yes" : "no"}`}>
                        {hasVoted ? "✓ głos oddany" : "… namysł"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {game.phase === "day" && (
            <VoteBoard game={game} me={me} isHost={isHost} myVoteId={myVoteId} justVoted={justVoted} />
          )}

          {isHost ? (
            <HostPanel game={game} settings={settings} setSettings={setSettings} busy={busy} hostAction={hostAction} />
          ) : (
            <PlayerPanel game={game} me={me} alivePlayers={alivePlayers} busy={busy} playerAction={playerAction} myVoteId={myVoteId} />
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

function VoteBoard({ game, me, isHost, myVoteId, justVoted }) {
  const stats = game.voteStats || { aliveCount: 0, castCount: 0, ranking: [], leaderId: null, allVoted: false };
  const alivePlayers = game.players.filter((player) => player.alive);
  const candidates = [...alivePlayers.map((player) => player.id), "skip"];
  const maxCount = stats.ranking[0]?.[1] || 0;
  const progressPct = stats.aliveCount ? Math.round((stats.castCount / stats.aliveCount) * 100) : 0;

  return (
    <section className="panel voteBoardPanel">
      <div className="sectionHeader">
        <h2>🗳️ Tablica głosów</h2>
        <span>{stats.castCount}/{stats.aliveCount} oddanych</span>
      </div>

      <div className="voteProgressTrack">
        <div className="voteProgressFill" style={{ width: `${progressPct}%` }} />
      </div>

      {justVoted && !isHost && <div className="voteToast">✓ Twój głos został zapisany</div>}

      <div className="voteCandidates">
        {candidates.map((candidateId) => {
          const count = stats.counts?.[candidateId] || 0;
          const pct = stats.castCount ? Math.round((count / stats.castCount) * 100) : 0;
          const isLeader = stats.leaderId === candidateId && count > 0;
          const isMine = myVoteId === candidateId;
          const name = candidateId === "skip" ? "Bez eliminacji" : alivePlayers.find((p) => p.id === candidateId)?.nick;
          const voters = Object.entries(game.votes || {})
            .filter(([, target]) => target === candidateId)
            .map(([voterId]) => game.players.find((p) => p.id === voterId)?.nick)
            .filter(Boolean);

          return (
            <div className={`voteRow ${isLeader ? "leader" : ""} ${isMine ? "mine" : ""}`} key={candidateId}>
              <div className="voteRowTop">
                <span className="voteName">
                  {candidateId === "skip" ? "🤷" : "👤"} {name}
                  {isMine && <span className="myVoteTag">Twój głos</span>}
                </span>
                <span className="voteCount">{count}</span>
              </div>
              <div className="voteBarTrack">
                <div
                  className={`voteBarFill ${count === maxCount && count > 0 ? "top" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {voters.length > 0 && <div className="voteVoters">{voters.join(", ")}</div>}
            </div>
          );
        })}
      </div>

      {stats.isTied && stats.castCount > 0 && (
        <p className="hint voteHint">⚖️ Remis głosów — host może dogrywkę lub wybrać ręcznie.</p>
      )}
      {stats.allVoted && <p className="hint voteHint">✅ Wszyscy żywi gracze oddali głos.</p>}
    </section>
  );
}

function HostPanel({ game, settings, setSettings, busy, hostAction }) {
  const alivePlayers = game.players.filter((player) => player.alive);
  const stats = game.voteStats || {};
  const topVote = stats.ranking?.[0];

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
          {game.players.length < 4 && <p className="hint">Potrzeba minimum 4 graczy, żeby wystartować.</p>}
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
          <p className="hint">
            {stats.allVoted
              ? "Wszyscy zagłosowali — możesz ogłosić eliminację."
              : `Czekasz na ${(stats.aliveCount || 0) - (stats.castCount || 0)} głos(y/ów). Możesz też zakończyć wcześniej.`}
          </p>
          <div className="buttonRow">
            <button disabled={busy || !topVote || stats.isTied} onClick={() => hostAction("eliminate", { targetId: topVote?.[0] })}>
              Wyeliminuj prowadzącego{topVote ? ` (${voteCandidateName(game, topVote[0])})` : ""}
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

function PlayerPanel({ game, me, alivePlayers, busy, playerAction, myVoteId }) {
  const canNightAct =
    game.phase === "night" &&
    me?.alive &&
    ((game.step === "mafia" && me.role === "mafia") ||
      (game.step === "doctor" && me.role === "doctor") ||
      (game.step === "detective" && me.role === "detective"));
  const canVote = game.phase === "day" && me?.alive;
  const detectiveResult = game.night?.investigationResults?.[me?.id];
  const [pendingTarget, setPendingTarget] = useState(null);

  return (
    <section className="panel controlPanel">
      <div className="sectionHeader">
        <h2>Twoja akcja</h2>
        <span>{canNightAct || canVote ? "wybierz cel" : "czekaj na hosta"}</span>
      </div>

      {canNightAct && (
        <>
          <p className="hint">{playerHint(me.role)}</p>
          <div className="targetGrid">
            {alivePlayers.map((player) => (
              <button
                key={player.id}
                className={`targetCard ${pendingTarget === player.id ? "selected" : ""}`}
                disabled={busy}
                onClick={() => {
                  setPendingTarget(player.id);
                  playerAction("nightAction", { targetId: player.id });
                }}
              >
                <span className="playerAvatar small">{initials(player.nick)}</span>
                {player.nick}
              </button>
            ))}
          </div>
          {pendingTarget && <p className="hint">✓ Akcja wysłana do hosta. Możesz zmienić wybór do końca tury.</p>}
        </>
      )}

      {detectiveResult && (
        <div className="resultBox">
          🔍 Wynik śledztwa: <strong>{detectiveResult.targetNick}</strong> to {roleLabels[detectiveResult.role]}.
        </div>
      )}

      {canVote && (
        <>
          <p className="hint">Kliknij osobę, na którą głosujesz. Wynik widać od razu na tablicy głosów powyżej — możesz zmienić zdanie do czasu ogłoszenia przez hosta.</p>
          <div className="targetGrid">
            {alivePlayers.map((player) => (
              <button
                key={player.id}
                className={`targetCard ${myVoteId === player.id ? "selected" : ""}`}
                disabled={busy}
                onClick={() => playerAction("vote", { targetId: player.id })}
              >
                <span className="playerAvatar small">{initials(player.nick)}</span>
                {player.nick}
                {myVoteId === player.id && <span className="checkMark">✓</span>}
              </button>
            ))}
            <button
              className={`targetCard skip ${myVoteId === "skip" ? "selected" : ""}`}
              disabled={busy}
              onClick={() => playerAction("vote", { targetId: "skip" })}
            >
              🤷 Bez eliminacji
              {myVoteId === "skip" && <span className="checkMark">✓</span>}
            </button>
          </div>
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

function initials(nick) {
  return String(nick || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function voteCandidateName(game, target) {
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
