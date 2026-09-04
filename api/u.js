const { getPrisma } = require("../lib/prisma");
const {
  LEADS_AUTH_COOKIE,
  isLeadsAuthCookie,
  isLeadsPassword,
  parseCookies,
  authCookieHeader,
} = require("../lib/leadsAuth");

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? esc(text) : "—";
}

function fmtDate(d) {
  return new Date(d).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function page(title, body, extraHead = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, nocache">
  <title>${esc(title)}</title>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #F0F0F0; color: #262626; }
    .gate { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    form { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 16px; }
    input { height: 40px; border: 0; border-radius: 12px; padding: 0 16px; font-size: 16px; outline: none; box-shadow: 0 0 0 1px rgba(38,38,38,.08); }
    input:focus { box-shadow: 0 0 0 2px #262626; }
    button { min-height: 40px; border: 0; border-radius: 12px; background: #262626; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; }
    button:disabled { opacity: .6; cursor: default; }
    .err { text-align: center; font-size: 14px; font-weight: 500; color: #c10007; }
    .wrap { max-width: 1400px; margin: 0 auto; padding: 32px 16px; }
    header { display: flex; justify-content: flex-end; margin-bottom: 24px; color: rgba(38,38,38,.5); font-size: 14px; }
    .card { overflow-x: auto; background: #fff; border-radius: 16px; box-shadow: 0 5px 30px rgba(0,0,0,.05); }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { padding: 12px 16px; font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(38,38,38,.45); border-bottom: 1px solid rgba(38,38,38,.08); white-space: nowrap; }
    td { padding: 12px 16px; border-bottom: 1px solid rgba(38,38,38,.06); white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .muted { color: rgba(38,38,38,.7); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .empty { text-align: center; padding: 40px 16px; color: rgba(38,38,38,.45); }
  </style>
  ${extraHead}
</head>
<body>${body}</body>
</html>`;
}

function unlockPage(error) {
  return page(
    "Brights",
    `<div class="gate">
      <form method="post" action="/api/u">
        <input type="password" name="password" autofocus autocomplete="current-password" placeholder="Password" required>
        ${error ? `<p class="err">${esc(error)}</p>` : ""}
        <button type="submit">Continue</button>
      </form>
    </div>`
  );
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    const raw = req.body;
    if ((req.headers["content-type"] || "").includes("json")) {
      return JSON.parse(raw);
    }
    return Object.fromEntries(new URLSearchParams(raw));
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  if ((req.headers["content-type"] || "").includes("json")) {
    return JSON.parse(raw);
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, nocache");

  if (req.method === "POST") {
    try {
      const body = await readBody(req);
      const password = typeof body.password === "string" ? body.password : "";
      if (!isLeadsPassword(password)) {
        res.statusCode = 303;
        res.setHeader("Location", "/u?e=1");
        res.end();
        return;
      }
      res.statusCode = 303;
      res.setHeader("Location", "/u");
      res.setHeader("Set-Cookie", authCookieHeader());
      res.end();
      return;
    } catch (err) {
      res.statusCode = 303;
      res.setHeader("Location", "/u?e=1");
      res.end();
      return;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const authed = isLeadsAuthCookie(cookies[LEADS_AUTH_COOKIE]);

  if (!authed) {
    const q = req.query?.e;
    const error =
      q === "1" || (typeof q === "object" && q.includes("1")) || (req.url || "").includes("e=1")
        ? "Wrong password"
        : "";
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(unlockPage(error));
    return;
  }

  try {
    const leads = await getPrisma().lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const rows = leads.length
      ? leads
          .map((lead) => {
            const extra =
              lead.extra && typeof lead.extra === "object"
                ? lead.extra
                : {};
            const portfolio = typeof extra.portfolio === "string" ? extra.portfolio : "";
            return `<tr>
              <td class="muted">${fmtDate(lead.createdAt)}</td>
              <td style="font-weight:500">${esc(lead.name)}</td>
              <td>${esc(lead.email)}</td>
              <td>${cell(portfolio)}</td>
              <td>${cell(lead.source)}</td>
              <td>${cell(lead.platform)}</td>
              <td>${cell(lead.country)}</td>
              <td>${cell(lead.city)}</td>
              <td class="mono">${cell(lead.ip)}</td>
              <td>${cell(lead.timezone)}</td>
              <td>${cell(lead.language)}</td>
              <td class="muted">${cell(lead.referer)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td class="empty" colspan="12">Nothing yet</td></tr>`;

    const html = page(
      "Brights",
      `<div class="wrap">
        <header><p>${leads.length} ${leads.length === 1 ? "row" : "rows"}</p></header>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Added</th>
                <th>Name</th>
                <th>Email</th>
                <th>Portfolio</th>
                <th>Source</th>
                <th>Platform</th>
                <th>Country</th>
                <th>City</th>
                <th>IP</th>
                <th>Timezone</th>
                <th>Language</th>
                <th>Referer</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      page(
        "Brights",
        `<div class="gate"><p class="err">${esc((err && err.message) || "Error")}</p></div>`
      )
    );
  }
}

module.exports = handler;
