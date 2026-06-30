import { NextResponse } from "next/server";
import { event, makePlayer, normalizeCode, publicGame } from "../../../../../lib/game";
import { findGameByCode } from "../../../../../lib/store";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { code: routeCode } = await params;
    const body = await request.json();
    const nick = String(body.nick || "").trim().slice(0, 28);

    if (!nick) {
      return NextResponse.json({ error: "Podaj nick." }, { status: 400 });
    }

    const code = normalizeCode(routeCode || body.code);
    const { game, games } = await findGameByCode(code);

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

    game.codeNormalized = normalizeCode(game.code);
    await games.replaceOne({ _id: game._id }, game);
    return NextResponse.json({
      code,
      token: player.token,
      game: publicGame(game, player.token)
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Błąd dołączania." }, { status: error.status || 500 });
  }
}
