const CONTENT_KEY = "site_content";
const SESSION_COOKIE = "mpdo_session";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_CONTENT_BYTES = 500_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function allowedOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && (u.hostname === "mpdo-malilipot.pages.dev" || u.hostname === "mpdo-malilipot-v9-cms-test.pages.dev" || u.hostname.endsWith(".mpdo-malilipot.pages.dev"));
  } catch { return false; }
}
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const h = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
  if (allowedOrigin(origin)) { h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Credentials"] = "true"; }
  return h;
}
function json(data, status = 200, request = null, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(request ? corsHeaders(request) : {}), ...extra } });
}
function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const item = cookies.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : null;
}
function base64url(bytes) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function signingKey(password) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function createSession(password) {
  const payload = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(password), new TextEncoder().encode(payload));
  return payload + "." + base64url(new Uint8Array(signature));
}
async function isAuthenticated(request, password) {
  try {
    const token = cookieValue(request, SESSION_COOKIE); if (!token) return false;
    const parts = token.split("."); if (parts.length !== 2) return false;
    const expiry = Number(parts[0]); if (!Number.isFinite(expiry) || expiry <= Date.now() / 1000) return false;
    return await crypto.subtle.verify("HMAC", await signingKey(password), decodeBase64url(parts[1]), new TextEncoder().encode(parts[0]));
  } catch { return false; }
}
function sessionCookie(value, maxAge) { return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`; }
function safeFilename(name) { return String(name || "file").replace(/[\\/\r\n\0]/g, "_").slice(0, 160); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (method === "OPTIONS") {
      if (!allowedOrigin(request.headers.get("Origin"))) return json({ error: "Origin not allowed." }, 403, request);
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Public file delivery through the Worker; objects are only created by authenticated uploads.
    if (path.startsWith("/files/") && method === "GET") {
      if (!env.MPDO_FILES) return new Response("File storage is not configured.", { status: 503 });
      const key = decodeURIComponent(path.slice("/files/".length));
      if (!key || key.includes("..")) return new Response("Not found.", { status: 404 });
      const object = await env.MPDO_FILES.get(key);
      if (!object) return new Response("Not found.", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=3600");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(object.customMetadata?.filename || "download"));
      return new Response(object.body, { headers });
    }

    if (!env.ADMIN_PASSWORD || !env.MPDO_CONTENT) return json({ error: "Admin configuration is incomplete." }, 500, request);

    if (path === "/api/admin/login" && method === "POST") {
      if (!allowedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403, request);
      let body; try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400, request); }
      if (typeof body.password !== "string" || body.password !== env.ADMIN_PASSWORD) return json({ error: "Incorrect password." }, 401, request);
      const token = await createSession(env.ADMIN_PASSWORD);
      return json({ success: true }, 200, request, { "Set-Cookie": sessionCookie(token, SESSION_SECONDS) });
    }
    if (path === "/api/admin/logout" && method === "POST") {
      if (!allowedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403, request);
      return json({ success: true }, 200, request, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (path === "/api/admin/me" && method === "GET") return json({ authenticated: await isAuthenticated(request, env.ADMIN_PASSWORD) }, 200, request);

    if (path === "/api/content" && method === "GET") {
      const stored = await env.MPDO_CONTENT.get(CONTENT_KEY); let content = null;
      if (stored) { try { content = JSON.parse(stored); } catch { return json({ error: "Stored content is invalid." }, 500, request); } }
      return json({ content }, 200, request);
    }
    if (path === "/api/content" && method === "POST") {
      if (!allowedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403, request);
      if (!await isAuthenticated(request, env.ADMIN_PASSWORD)) return json({ error: "Unauthorized." }, 401, request);
      let body; try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400, request); }
      if (!body || !Object.prototype.hasOwnProperty.call(body, "content")) return json({ error: "Missing content field." }, 400, request);
      const serialized = JSON.stringify(body.content);
      if (new TextEncoder().encode(serialized).length > MAX_CONTENT_BYTES) return json({ error: "Content is too large." }, 413, request);
      await env.MPDO_CONTENT.put(CONTENT_KEY, serialized);
      return json({ success: true, message: "Content saved." }, 200, request);
    }
    if (path === "/api/files" && method === "POST") {
      if (!allowedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403, request);
      if (!await isAuthenticated(request, env.ADMIN_PASSWORD)) return json({ error: "Unauthorized." }, 401, request);
      if (!env.MPDO_FILES) return json({ error: "R2 storage is not configured. Add the MPDO_FILES binding." }, 503, request);
      let form; try { form = await request.formData(); } catch { return json({ error: "Invalid upload form." }, 400, request); }
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "No file was provided." }, 400, request);
      if (!ALLOWED_TYPES.has(file.type)) return json({ error: "Only JPG, PNG, WEBP, and PDF files are accepted." }, 415, request);
      if (file.size <= 0 || file.size > MAX_FILE_BYTES) return json({ error: "File must be between 1 byte and 10 MB." }, 413, request);
      const key = `${crypto.randomUUID()}-${safeFilename(file.name)}`;
      await env.MPDO_FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=3600" }, customMetadata: { filename: safeFilename(file.name) } });
      return json({ success: true, title: String(form.get("title") || file.name).slice(0, 160), key, url: `${url.origin}/files/${encodeURIComponent(key)}` }, 201, request);
    }
    if (path === "/" && method === "GET") return new Response("MPDO Malilipot Admin API is running.", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    return json({ error: "Not found." }, 404, request);
  }
};
