import { startServer } from "./server";
import { startMonitoring } from "./services/monitor";

console.log("[DEBUG] Starting monitor and server...");

startServer();
startMonitoring();