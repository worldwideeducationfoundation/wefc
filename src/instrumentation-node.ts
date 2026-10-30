import { runMigrations } from "./server/migrate";

export async function runStartupTasks() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    await runMigrations();
  } catch (err) {
    console.error("[db] Migrations failed:", err);
  }
}
