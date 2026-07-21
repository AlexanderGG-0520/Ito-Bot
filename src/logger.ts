import type { LogLevel } from './config';

const priorities: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function safe(value: unknown): unknown {
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

export function createLogger(level: LogLevel): Logger {
  const write = (
    entryLevel: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void => {
    if (priorities[entryLevel] < priorities[level]) return;
    const payload = { timestamp: new Date().toISOString(), level: entryLevel, message, ...context };
    const output = JSON.stringify(payload, (_key, value: unknown) => safe(value));
    if (entryLevel === 'error') console.error(output);
    else if (entryLevel === 'warn') console.warn(output);
    else console.log(output);
  };
  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
