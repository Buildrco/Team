module.exports = function adminConfig(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const isPrivileged = typeof key === "string" && (/^sb_secret_/i.test(key) || /service_role/i.test(key));

  if (!url || !key) {
    res.status(503).json({ error: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel. The public site does not need these variables." });
    return;
  }
  if (isPrivileged) {
    res.status(503).json({ error: "VITE_SUPABASE_ANON_KEY contains a secret/service-role key. Replace it with the Supabase publishable/anon key." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ url, key });
};