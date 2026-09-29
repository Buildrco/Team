module.exports = async function worksRoute(req, res) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const source = await fetch(protocol + "://" + host + "/index.html", { cache: "no-store" });
  if (!source.ok) {
    res.status(source.status).send("Unable to load the original page");
    return;
  }
  const html = await source.text();
  const script = '<script src="/site-overrides.js"></script>';
  const page = html.includes("</body>") ? html.replace("</body>", script + "</body>") : html + script;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).send(page);
};
