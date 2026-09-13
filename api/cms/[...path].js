const crypto = require("crypto");

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};

function jsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

function config() {
  return {
    username: process.env.CMS_ADMIN_USERNAME || "",
    password: process.env.CMS_ADMIN_PASSWORD || "",
    secret: process.env.CMS_SESSION_SECRET || "",
    token: process.env.CMS_GITHUB_TOKEN || "",
    repo: process.env.CMS_GITHUB_REPO || "Buildrco/Team",
    branch: process.env.CMS_GITHUB_BRANCH || "main"
  };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function makeSession(username, secret) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Date.now() + 1000 * 60 * 60 * 12
  })).toString("base64url");
  return payload + "." + sign(payload, secret);
}

function sessionUser(req, secret) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)cms_session=([^;]+)/);
  if (!match || !secret) return null;
  const parts = match[1].split(".");
  if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0], secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return data.exp > Date.now() ? data.sub : null;
  } catch (_) {
    return null;
  }
}

function routeName(req) {
  const value = req.query && req.query.path;
  if (Array.isArray(value)) return value.join("/");
  if (value) return String(value);
  const path = (req.url || "").split("?")[0].replace(/^\/api\/cms\/?/, "");
  return path;
}

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.keys(extraHeaders || {}).forEach((key) => res.setHeader(key, extraHeaders[key]));
  res.end(JSON.stringify(body));
}

function githubUrl(cfg, path) {
  return "https://api.github.com" + path;
}

async function github(cfg, path, options) {
  if (!cfg.token) throw new Error("CMS_GITHUB_TOKEN is not configured");
  const response = await fetch(githubUrl(cfg, path), {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + cfg.token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = text;
  }
  if (!response.ok) {
    const message = body && body.message ? body.message : "GitHub request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

function repoPath(cfg, filePath) {
  return "/repos/" + cfg.repo + "/contents/" + filePath;
}

async function readFile(cfg, filePath) {
  return github(cfg, repoPath(cfg, filePath) + "?ref=" + encodeURIComponent(cfg.branch));
}

async function writeFile(cfg, filePath, content, message, sha) {
  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch: cfg.branch
  };
  if (sha) body.sha = sha;
  return github(cfg, repoPath(cfg, filePath), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readContent(cfg) {
  try {
    const file = await readFile(cfg, "cms/content.json");
    return JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch (error) {
    if (error.status === 404) return { site: {}, pages: {}, works: [], testimonials: [], services: [], process: [], pricing: {}, faq: [], articles: [] };
    throw error;
  }
}

function validContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  const arrays = ["works", "testimonials", "services", "process", "faq", "articles"];
  return arrays.every((key) => !content[key] || Array.isArray(content[key]));
}

function safeMediaPath(value) {
  return typeof value === "string" && value.startsWith("cms/media/") && !value.includes("..") && !value.includes("\\") && value.length < 180;
}

async function requireAuth(req, res, cfg) {
  if (!cfg.secret || !sessionUser(req, cfg.secret)) {
    send(res, 401, { error: "Authentication required" });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  const cfg = config();
  const route = routeName(req);
  try {
    if (route === "login" && req.method === "POST") {
      const body = jsonBody(req);
      if (!cfg.username || !cfg.password || !cfg.secret) return send(res, 500, { error: "CMS authentication environment variables are not configured" });
      if (!safeEqual(body.username, cfg.username) || !safeEqual(body.password, cfg.password)) return send(res, 401, { error: "Invalid username or password" });
      return send(res, 200, { authenticated: true }, {
        "Set-Cookie": "cms_session=" + makeSession(cfg.username, cfg.secret) + "; HttpOnly; Path=/; SameSite=Lax" + (process.env.NODE_ENV === "production" ? "; Secure" : "")
      });
    }

    if (route === "session" && req.method === "GET") {
      return send(res, 200, { authenticated: Boolean(cfg.secret && sessionUser(req, cfg.secret)) });
    }

    if (route === "logout" && req.method === "POST") {
      return send(res, 200, { authenticated: false }, {
        "Set-Cookie": "cms_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + (process.env.NODE_ENV === "production" ? "; Secure" : "")
      });
    }

    if ((route === "content" || route === "raw") && req.method === "GET") {
      return send(res, 200, await readContent(cfg));
    }

    if (route === "content" && req.method === "PUT") {
      if (!(await requireAuth(req, res, cfg))) return;
      const content = jsonBody(req);
      if (!validContent(content)) return send(res, 400, { error: "Invalid CMS content structure" });
      const current = await readFile(cfg, "cms/content.json").catch((error) => error.status === 404 ? null : Promise.reject(error));
      await writeFile(cfg, "cms/content.json", JSON.stringify(content, null, 2) + "\n", "Update CMS content", current && current.sha);
      return send(res, 200, { saved: true, content });
    }

    if (route === "media" && req.method === "GET") {
      if (!(await requireAuth(req, res, cfg))) return;
      const tree = await github(cfg, "/repos/" + cfg.repo + "/git/trees/" + encodeURIComponent(cfg.branch) + "?recursive=1");
      const media = (tree.tree || []).filter((item) => item.type === "blob" && item.path.startsWith("cms/media/") && item.path !== "cms/media/.gitkeep").map((item) => ({
        path: "/" + item.path,
        name: item.path.split("/").pop(),
        url: "/" + item.path,
        sha: item.sha,
        size: item.size || 0
      }));
      return send(res, 200, { media });
    }

    if (route === "media" && req.method === "POST") {
      if (!(await requireAuth(req, res, cfg))) return;
      const body = jsonBody(req);
      const mime = String(body.mime || "").toLowerCase();
      const extension = ALLOWED_MEDIA[mime];
      const raw = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
      if (!extension || !raw || !body.filename || !/^[^/\\]+$/.test(body.filename)) return send(res, 400, { error: "Unsupported image upload" });
      const buffer = Buffer.from(raw, "base64");
      if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) return send(res, 413, { error: "Images must be smaller than 5 MB" });
      if (mime === "image/svg+xml" && /<script|on\w+\s*=|javascript:/i.test(buffer.toString("utf8"))) return send(res, 400, { error: "This SVG contains unsafe content" });
      const baseName = String(body.filename).replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";
      const filePath = "cms/media/" + Date.now() + "-" + baseName + "." + extension;
      await writeFile(cfg, filePath, buffer, "Add CMS media");
      return send(res, 201, { path: "/" + filePath, name: filePath.split("/").pop() });
    }

    if (route === "media" && req.method === "DELETE") {
      if (!(await requireAuth(req, res, cfg))) return;
      const body = jsonBody(req);
      const filePath = String(body.path || "").replace(/^\/+/, "");
      if (!safeMediaPath(filePath)) return send(res, 400, { error: "Invalid media path" });
      const file = await readFile(cfg, filePath);
      await github(cfg, repoPath(cfg, filePath), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Remove CMS media", sha: file.sha, branch: cfg.branch })
      });
      return send(res, 200, { deleted: true });
    }

    return send(res, 404, { error: "CMS route not found" });
  } catch (error) {
    console.error(error);
    send(res, error.status === 404 ? 404 : 500, { error: error.message || "CMS request failed" });
  }
};