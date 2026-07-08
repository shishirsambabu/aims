import "server-only";

function sentryStoreUrl(dsn: string): { url: string; publicKey: string } | null {
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace("/", "");
    const publicKey = parsed.username;
    if (!projectId || !publicKey) return null;
    return {
      url: `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`,
      publicKey,
    };
  } catch {
    return null;
  }
}

export async function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const dsn = process.env.SENTRY_DSN;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  if (!dsn) {
    console.error("[observability]", message, context);
    return;
  }

  const target = sentryStoreUrl(dsn);
  if (!target) {
    console.error("[observability] invalid SENTRY_DSN", message, context);
    return;
  }

  try {
    await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": [
          "Sentry sentry_version=7",
          `sentry_client=aims-erp/1.0`,
          `sentry_key=${target.publicKey}`,
        ].join(", "),
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replaceAll("-", ""),
        timestamp: new Date().toISOString(),
        platform: "javascript",
        logger: "aims",
        level: "error",
        message,
        exception: stack
          ? {
              values: [
                {
                  type: error instanceof Error ? error.name : "Error",
                  value: message,
                  stacktrace: { frames: stack.split("\n").slice(1).map((line) => ({ function: line.trim() })) },
                },
              ],
            }
          : undefined,
        extra: context,
      }),
    });
  } catch (sendError) {
    console.error("[observability] failed to report error", sendError);
  }
}
