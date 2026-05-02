// utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private formatMessage(level: string, message: string, context?: unknown) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: unknown) {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage("DEBUG", message, context));
    }
  }

  info(message: string, context?: unknown) {
    if (this.minLevel <= LogLevel.INFO) {
      console.info(this.formatMessage("INFO", message, context));
    }
  }

  warn(message: string, context?: unknown) {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message, context));
    }
  }

  error(message: string, error?: Error | unknown) {
    if (this.minLevel <= LogLevel.ERROR) {
      const errorContext =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error;
      console.error(this.formatMessage("ERROR", message, errorContext));
    }
  }
}

export const logger = new Logger();

// Convenience function for error handling in catch blocks
export const handleError = (
  message: string,
  error: Error | unknown,
  context?: unknown,
) => {
  logger.error(message, { error, context });
};
