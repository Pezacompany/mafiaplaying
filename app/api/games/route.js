import { NextResponse } from "next/server";
import { gamesCollection } from "../../../lib/db";
import { event, makeCode, makePlayer, makeToken, publicGame } from "../../../lib/game";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const hostName = String(body.hostName || "Host").trim().slice(0, 28);
    const host = makePlayer(hostName || "Host");
    const hostToken = makeToken();
    const games = await gamesCollection();

    let game;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = makeCode();
      game = {
        code,
        hostToken,
        phase: "lobby",
        step: "waiting",
        day: 0,
        settings: { mafia: 1, doctors: 1, detectives: 1 },
        players: [host],
        night: null,
        votes: {},
        winner: null,
        log: [event(`Pokój utworzony przez ${host.nick}.`)],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await games.insertOne(game);
        return NextResponse.json({
          code,
          token: host.token,
          hostToken,
          game: publicGame(game, hostToken)
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    return NextResponse.json({ error: "Nie udało się wygenerować kodu pokoju." }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Błąd tworzenia gry." }, { status: error.status || 500 });
  }
}
