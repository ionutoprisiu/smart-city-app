const isDev = __DEV__;

const fmt = (level: string, message: string, error?: unknown) =>
  `[${level}] ${message}${error !== undefined ? ` - ${String(error)}` : ''}`;

export const Logger = {
  debug(message: string, error?: unknown) {
    if (isDev) console.log(fmt('DEBUG', message, error));
  },
  info(message: string, error?: unknown) {
    if (isDev) console.log(fmt('INFO', message, error));
  },
  warning(message: string, error?: unknown) {
    if (isDev) console.warn(fmt('WARNING', message, error));
  },
  error(message: string, error?: unknown) {
    if (isDev) console.error(fmt('ERROR', message, error));
  },
};
