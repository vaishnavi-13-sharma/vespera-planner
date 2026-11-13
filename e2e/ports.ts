// The two E2E servers. Override the base port with E2E_PORT when several worktrees run the suite at once.
export const PORT = Number(process.env.E2E_PORT ?? 4317);
/** The local-only test build (no sign-in): every spec except the gate's. */
export const BASE_URL = `http://127.0.0.1:${PORT}`;
/** A build with sync "configured" against an unreachable address: what a signed-out visitor sees. */
export const GATE_PORT = PORT + 1;
export const GATE_BASE_URL = `http://127.0.0.1:${GATE_PORT}`;
