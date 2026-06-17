import { NextResponse } from "next/server";
import { gamesCollection } from "../../../../lib/db";
import {
  advanceGame,
  assertHost,
  assertPlayer,
  eliminate,
  normalizeCode,
  publicGame,
  resetToLobby,
  startGame,
  submitNightAction,
  submitVote
} from "../../../../lib/game";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { code } = await params;
    const token = request.nextUrl.searchParams.get("token");
    const game = await findGame(code);
    return NextResponse.json({ game: publicGame(game, token) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Nie znaleziono gry." }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const token = body.token;
    const games = await gamesCollection();
    const game = await findGame(code);

    if (body.action === "start") {
      assertHost(game, token);
      startGame(game, body.settings || {});
    } else if (body.action === "advance") {
      assertHost(game, token);
      advanceGame(game);
    } else if (body.action === "eliminate") {
      assertHost(game, token);
      eliminate(game, body.targetId);
    } else if (body.action === "reset") {
      assertHost(game, token);
      resetToLobby(game);
    } else if (body.action === "nightAction") {
      const player = assertPlayer(game, token);
      submitNightAction(game, player, body.targetId);
    } else if (body.action === "vote") {
      const player = assertPlayer(game, token);
      submitVote(game, player, body.targetId);
    } else {
      return NextResponse.json({ error: "Nieznana akcja." }, { status: 400 });
    }

    game.updatedAt = new Date();
    await games.replaceOne({ code: game.code }, game);
    return NextResponse.json({ game: publicGame(game, token) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Błąd akcji gry." }, { status: error.status || 500 });
  }
}

async function findGame(code) {
  const games = await gamesCollection();
  const game = await games.findOne({ code: normalizeCode(code) });
  if (!game) {
    const error = new Error("Nie znaleziono pokoju o takim kodzie.");
    error.status = 404;
    throw error;
  }
  return game;
}
