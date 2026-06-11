type MonitoringContext = Record<string, unknown>;

const SLOW_OPERATION_MS = Number(process.env.AIMS_SLOW_OPERATION_MS ?? 750);

function safeContext(context: MonitoringContext = {}) {
  return JSON.stringify(context, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return value;
  });
}

export function reportError(
  source: string,
  error: unknown,
  context: MonitoringContext = {}
) {
  console.error(
    `[monitoring:error] ${source}`,
    safeContext({
      ...context,
      error,
      ts: new Date().toISOString(),
    })
  );
}

export function reportSlowOperation(
  source: string,
  durationMs: number,
  context: MonitoringContext = {}
) {
  if (durationMs < SLOW_OPERATION_MS) return;
  console.warn(
    `[monitoring:slow] ${source}`,
    safeContext({
      ...context,
      durationMs,
      thresholdMs: SLOW_OPERATION_MS,
      ts: new Date().toISOString(),
    })
  );
}

export async function observed<T>(
  source: string,
  operation: () => Promise<T>,
  context: MonitoringContext = {}
): Promise<T> {
  const started = Date.now();
  try {
    return await operation();
  } catch (error) {
    reportError(source, error, context);
    throw error;
  } finally {
    reportSlowOperation(source, Date.now() - started, context);
  }
}
