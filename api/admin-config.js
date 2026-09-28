module.exports = function adminConfig(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Use the connected production CMS project. The publishable key is safe for browser use.
  // CMS_* overrides are supported for future project changes; stale VITE/SUPABASE values are ignored.
  const defaultUrl = "https://lygosyhgjhcrpwardvvg.supabase.co";
  const defaultKey = "sb_publishable_SrhTb2mo3k3stXUQ1Xr3qg_WNlB8xHP";
  const url = process.env.CMS_SUPABASE_URL || defaultUrl;
  const key = process.env.CMS_SUPABASE_PUBLISHABLE_KEY || defaultKey;
  const isPrivileged = typeof key === "string" && (/^sb_secret_/i.test(key) || /service_role/i.test(key));

  if (!url || !key) {
    res.status(503).json({ error: "Supabase is not configured." });
    return;
  }
  if (isPrivileged) {
    res.status(503).json({ error: "VITE_SUPABASE_ANON_KEY contains a secret/service-role key. Replace it with the Supabase publishable/anon key." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ url, key });
};