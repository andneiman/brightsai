import type { IncomingMessage, ServerResponse } from "http";
import { getPrisma } from "../lib/prisma";
import { getRequestMeta } from "../lib/requestMeta";
import { authCookieHeader, isLeadsPassword } from "../lib/leadsAuth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type VercelReq = IncomingMessage & {
  method?: string;
  body?: unknown;
};

async function readJson(req: VercelReq) {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req.body === "string" && req.body) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function json(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJson(req);

    if (body.unlock === true) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!isLeadsPassword(password)) {
        json(res, 401, { error: "Wrong password" });
        return;
      }
      json(res, 200, { ok: true }, { "Set-Cookie": authCookieHeader() });
      return;
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const portfolio =
      typeof body.portfolio === "string" ? body.portfolio.trim().slice(0, 500) : "";
    const source =
      typeof body.source === "string" ? body.source.slice(0, 120) : "landing";
    const timezone =
      typeof body.timezone === "string" ? body.timezone.slice(0, 80) : null;
    const locale =
      typeof body.locale === "string" ? body.locale.slice(0, 40) : null;
    const screen =
      typeof body.screen === "string" ? body.screen.slice(0, 40) : null;

    if (name.length < 1 || name.length > 120) {
      json(res, 400, { error: "Invalid name" });
      return;
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      json(res, 400, { error: "Invalid email" });
      return;
    }

    const meta = getRequestMeta(req);
    const ua = meta.userAgent || "";
    const platform = /Win/i.test(ua)
      ? "windows"
      : /Mac/i.test(ua)
        ? "mac"
        : /Android/i.test(ua)
          ? "android"
          : /iPhone|iPad|iPod/i.test(ua)
            ? "ios"
            : null;

    const extra = {
      locale,
      screen,
      portfolio: portfolio || null,
      vercel: {
        country: meta.country,
        region: meta.region,
        city: meta.city,
      },
    };

    const lead = await getPrisma().lead.create({
      data: {
        name,
        email,
        ip: meta.ip,
        userAgent: meta.userAgent,
        language: meta.language,
        country: meta.country,
        region: meta.region,
        city: meta.city ? decodeURIComponent(meta.city) : null,
        timezone,
        referer: meta.referer,
        source,
        platform,
        extra,
      },
    });

    json(res, 200, { success: true, id: lead.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    json(res, 500, { error: message });
  }
}
