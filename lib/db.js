import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "mafia_playing";

let cached = global.mongoClientPromise;

if (!cached && uri) {
  const client = new MongoClient(uri);
  cached = global.mongoClientPromise = client.connect();
}

export async function getDb() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  const client = await cached;
  return client.db(dbName);
}

export async function gamesCollection() {
  const db = await getDb();
  const collection = db.collection("games");
  await collection.createIndex({ code: 1 }, { unique: true });
  await collection.createIndex({ updatedAt: 1 });
  return collection;
}
