/**
 * Runs once when the server process starts.
 *
 * Brings the database schema up to date before the first request, so a
 * deploy that ships a new migration needs no manual step. A database that is
 * unreachable is logged rather than fatal: the public pages then show their
 * error state and the admin explains what is wrong, instead of the whole
 * process refusing to boot.
 *
 * The runtime check wraps the import directly (not an early return) so the
 * bundler can drop the Node-only database code from the edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupTasks } = await import("./instrumentation-node");
    await runStartupTasks();
  }
}
