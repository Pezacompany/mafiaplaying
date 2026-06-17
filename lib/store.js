import { gamesCollection } from "./db";
import { normalizeCode } from "./game";

export async function getGamesCollection() {
  const games = await gamesCollection();
  await games.createIndex({ codeNormalized: 1 });
  return games;
}

export async function findGameByCode(inputCode) {
  const code = normalizeCode(inputCode);
  const games = await getGamesCollection();

  if (!code) {
    const error = new Error("Podaj kod pokoju.");
    error.status = 400;
    throw error;
  }

  const direct = await games.findOne({
    $or: [{ code }, { codeNormalized: code }]
  });

  if (direct) {
    return { game: direct, code, games };
  }

  const recentGames = await games
    .find({}, { projection: { code: 1, codeNormalized: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(80)
    .toArray();

  const fuzzyMatch = recentGames.find((game) => normalizeCode(game.codeNormalized || game.code) === code);

  if (fuzzyMatch) {
    const game = await games.findOne({ _id: fuzzyMatch._id });
    if (game) {
      return { game, code, games };
    }
  }

  const error = new Error(`Nie znaleziono pokoju ${code}. Upewnij się, że tworzysz i dołączasz na tej samej stronie.`);
  error.status = 404;
  throw error;
}
