import { NextResponse } from "next/server";
import { gamesCollection } from "../../../../lib/db";
import { event, makePlayer, normalizeCode, publicGame } from "../../../../lib/game";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const code = normalizeCode(body.code);
    const nick = String(body.nick || "").trim().slice(0, 28);

    if (!code) {
      return NextResponse.json({ error: "Podaj kod pokoju." }, { status: 400 });
    }

    if (!nick) {
      return NextResponse.json({ error: "Podaj nick." }, { status: 400 });
    }

    const games = await gamesCollection();
    const game = await games.findOne({ code });

    if (!game) {
      return NextResponse.json(
        { error: `Nie znaleziono pokoju ${code}. Sprawdź, czy host utworzył pokój na tej samej stronie.` },
        { status: 404 }
      );
    }

    if (game.phase !== "lobby") {
      return NextResponse.json({ error: "Ta gra już wystartowała." }, { status: 400 });
    }

    if (game.players.some((player) => player.nick.toLowerCase() === nick.toLowerCase())) {
      return NextResponse.json({ error: "Ten nick jest już zajęty w pokoju." }, { status: 400 });
    }

    const player = makePlayer(nick);
    game.players.push(player);
    game.log = [event(`${player.nick} dołącza do lobby.`), ...(game.log || [])].slice(0, 80);
    game.updatedAt = new Date();

    await games.replaceOne({ code }, game);
    return NextResponse.json({
      code,
      token: player.token,
      game: publicGame(game, player.token)
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Błąd dołączania." }, { status: error.status || 500 });
  }
}
