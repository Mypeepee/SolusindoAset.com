import "server-only";
import { MarketingError } from "./security.server";
import { CHATBOT_AGENT_ID } from "../../../backend/whatsapp/services/client_capture.js";

export async function whatsappRequest(path: string, body?: unknown) {
  const raw = process.env.WHATSAPP_BACKEND_URL,
    token = process.env.WHATSAPP_BACKEND_TOKEN;
  if (!raw || !token) throw new MarketingError("WA_DISCONNECTED", 503);
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new MarketingError("WA_DISCONNECTED", 503);
  const response = await fetch(
    raw.replace(/\/$/, "") +
      "/agents/" +
      CHATBOT_AGENT_ID +
      "/admin/marketing/" +
      path,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new MarketingError(
      [
        "WA_DISCONNECTED",
        "DELIVERY_UNCERTAIN",
        "INVALID_AUDIENCE",
        "WA_TEST_REQUIRED",
      ].includes(error.error)
        ? error.error
        : "PROVIDER_ERROR",
      response.status >= 500 ? 503 : 400,
    );
  }
  return response.json();
}
