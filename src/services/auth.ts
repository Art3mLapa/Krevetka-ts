import axios from "axios";
import { CONFIG } from "../config";
import { logger } from "../utils/logger";

let cachedToken: string | null = null;

export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (!CONFIG.authUrl) {
    throw new Error("AUTH_URL is not configured");
  }

  const res = await axios.get<{ token: string }>(CONFIG.authUrl);
  cachedToken = res.data.token;
  logger.debug("Token obtained");
  return cachedToken;
}