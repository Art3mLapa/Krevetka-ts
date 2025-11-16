export const logger = {
  debug: (...args: any[]) => console.log("[DEBUG]", ...args),
  error: (...args: any[]) => console.error("[ERROR]", ...args),
  warn: (...args: any[]) => console.warn("[WARN]", ...args),
};