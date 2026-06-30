import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    return NextResponse.json({
      ok: true,
      database: db.databaseName,
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Nie udało się połączyć z MongoDB."
      },
      { status: 500 }
    );
  }
}
