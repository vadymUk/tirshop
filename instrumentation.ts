export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Node-only APIs live in a separate module so the Edge bundle never analyses them.
    await import("./instrumentation-node");
  }
}