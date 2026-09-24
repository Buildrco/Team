import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  GripVertical,
  Image as ImageIcon,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  MoreHorizontal,
  Navigation,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./styles.css";

const ASSET = (path) => `/${path}`;
const INTERNAL_AUTH_DOMAIN = "@nook-studios.internal";
const normaliseUsername = (value) => value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const usernameToEmail = (username) => `${normaliseUsername(username)}${INTERNAL_AUTH_DOMAIN}`;
const FALLBACK_NAV = [
  { label: "Home", url: "/" },
  { label: "About", url: "/about" },
  { label: "Works", url: "/works" },
  { label: "Services", url: "/services" },
  { label: "Contact", url: "/contact" },
];

function getErrorMessage(error) {
  if (!error) return "Something went wrong.";
  return error.message || error.error_description || String(error);
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment.");
  }
  return supabase;
}

async function fetchPage(slug, includeDraft = false) {
  const client = requireSupabase();
  const { data: page, error } = await client.from("pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!page) return null;
  if (!includeDraft && page.status !== "published") return null;

  const { data: sectionRows, error: sectionError } = await client
    .from("sections")
    .select("*")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true });
  if (sectionError) throw sectionError;
  const sections = sectionRows || [];
  const { data: itemRows, error: itemError } = sections.length
    ? await client.from("section_items").select("*").in("section_id", sections.map((section) => section.id)).order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (itemError) throw itemError;
  const live = sections.map((section) => ({
    ...section,
    items: (itemRows || []).filter((item) => item.section_id === section.id),
  }));

  if (includeDraft) {
    const { data: revisions, error: revisionError } = await client
      .from("revisions")
      .select("revision_data, created_at")
      .eq("page_id", page.id)
      .eq("description", "draft")
      .order("created_at", { ascending: false })
      .limit(1);
    if (revisionError) throw revisionError;
    const draft = revisions?.[0]?.revision_data;
    if (draft?.sections) return { ...page, ...(draft.page || {}), sections: draft.sections };
  }
  return { ...page, sections: live };
}

async function fetchNavigation() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("navigation_items")
    .select("*")
    .eq("is_visible", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchAdminPages() {
  const client = requireSupabase();
  const { data, error } = await client.from("pages").select("*").order("is_homepage", { ascending: false }).order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchAdminPage(pageId) {
  const client = requireSupabase();
  const { data: page, error } = await client.from("pages").select("*").eq("id", pageId).single();
  if (error) throw error;
  const { data: sections, error: sectionError } = await client.from("sections").select("*").eq("page_id", pageId).order("sort_order", { ascending: true });
  if (sectionError) throw sectionError;
  const rows = sections || [];
  const { data: items, error: itemError } = rows.length
    ? await client.from("section_items").select("*").in("section_id", rows.map((section) => section.id)).order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (itemError) throw itemError;
  const draftResult = await client.from("revisions").select("revision_data, created_at").eq("page_id", pageId).eq("description", "draft").order("created_at", { ascending: false }).limit(1);
  if (draftResult.error) throw draftResult.error;
  const draft = draftResult.data?.[0]?.revision_data;
  if (draft?.sections) return { ...page, ...(draft.page || {}), sections: draft.sections, hasDraft: true, draftCreatedAt: draftResult.data[0].created_at };
  return {
    ...page,
    sections: rows.map((section) => ({ ...section, items: (items || []).filter((item) => item.section_id === section.id) })),
    hasDraft: false,
  };
}

const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        if (mounted) setProfile(userProfile);
      }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession?.user) {
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", nextSession.user.id).maybeSingle();
        if (mounted) setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    canEdit: profile?.role === "admin" || profile?.role === "editor",
    signOut: () => supabase?.auth.signOut(),
  }), [session, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
const useAuth = () => useContext(AuthContext);

function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  return <div className={`toast toast-${type}`} role="status"><span>{type === "success" ? <Check size={15} /> : <CircleHelp size={15} />}</span>{message}<button onClick={onClose} aria-label="Dismiss"><X size={15} /></button></div>;
}

function ConfigNotice({ admin = false }) {
  return <div className={admin ? "config-notice admin-config" : "config-notice"}>
    <Sparkles size={22} />
    <div>
      <strong>Connect the content database to continue</strong>
      <p>This build intentionally does not fall back to localStorage or mock content. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the deployment environment, then run the included migration.</p>
    </div>
  </div>;
}

function Loading({ label = "Loading" }) {
  return <div className="loading-state"><Loader2 className="spin" size={20} /> {label}</div>;
}

function ErrorState({ error, onRetry }) {
  return <div className="empty-state error-state"><CircleHelp size={24} /><h3>We couldn’t load this content</h3><p>{getErrorMessage(error)}</p>{onRetry && <button className="button button-dark" onClick={onRetry}>Try again</button>}</div>;
}

function SiteHeader({ navItems = FALLBACK_NAV }) {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <Link to="/" className="brand" onClick={() => setOpen(false)}><img src={ASSET("nook-studios-logo.png")} alt="Nook Studios" /><span>NOOK<br />STUDIOS</span></Link>
    <nav className={`site-nav ${open ? "is-open" : ""}`}>
      {navItems.map((item) => <Link key={item.id || item.url} to={item.url || "/"} onClick={() => setOpen(false)}>{item.label}</Link>)}
      <Link className="nav-cta" to="/contact" onClick={() => setOpen(false)}>Let’s talk <ArrowUpRight /></Link>
    </nav>
    <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
  </header>;
}

function PublicLayout({ children }) {
  const [navItems, setNavItems] = useState(FALLBACK_NAV);
  const [navError, setNavError] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    fetchNavigation().then(setNavItems).catch(setNavError);
  }, []);
  return <><SiteHeader navItems={navItems} />{navError && null}{children}<SiteFooter /></>;
}

function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-cta"><p className="eyebrow">Want to discuss a project?</p><h2>Let’s_<em>Talk</em></h2><Link className="button button-light" to="/contact">Start a conversation <ArrowUpRight /></Link></div>
    <div className="footer-bottom">
      <div><span className="footer-mark">NOOK</span><p>Bold ideas meet thoughtful design and measurable growth.</p></div>
      <div className="footer-links"><div><b>Pages</b><Link to="/">Home</Link><Link to="/about">About us</Link><Link to="/works">Works</Link><Link to="/services">Services</Link></div><div><b>Social</b><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a><a href="https://www.youtube.com/" target="_blank" rel="noreferrer">YouTube</a><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a></div><div><b>Studio</b><a href="mailto:nookstudiosofficial@gmail.com">Email us</a><a href="tel:+233557696771">+233 55 769 6771</a><Link to="/admin/login">Admin</Link></div></div>
    </div>
    <div className="footer-legal">© 2026 Nook Studios. Crafted with care in Accra.</div>
  </footer>;
}

function ArrowUpRight() {
  return <ArrowRight size={16} />;
}

const imageForSection = (section) => section.settings?.background_image || section.settings?.image_url || section.content?.image_url || section.items?.[0]?.image_url;

function SectionView({ section, editor = false, selected = false, onSelect }) {
  const props = { className: `content-section section-${section.section_type} ${section.settings?.theme || ""} ${selected ? "is-selected" : ""}`, onClick: editor ? (event) => { event.stopPropagation(); onSelect?.(section.id); } : undefined };
  const items = (section.items || []).filter((item) => item.is_visible !== false);
  const settings = section.settings || {};
  const image = imageForSection(section);
  const heading = section.title || "";
  const body = section.content || "";
  const button = settings.button_label ? <Link className="button button-accent" to={settings.button_url || "/contact"} onClick={(event) => editor && event.preventDefault()}>{settings.button_label} <ArrowRight size={15} /></Link> : null;
  if (!section.is_visible && !editor) return null;

  if (section.section_type === "hero") return <section {...props} style={{ backgroundImage: image ? `linear-gradient(90deg, rgba(10,15,28,.96), rgba(10,15,28,.46)), url("${image}")` : undefined }}><div className="section-inner hero-inner"><div className="hero-copy"><p className="eyebrow">{section.subtitle || "Nook Studios / digital growth partner"}</p><h1>{heading}</h1><p className="hero-body">{body}</p><div className="button-row">{button || <Link className="button button-light" to="/contact">Book a call <ArrowUpRight /></Link>}<Link className="text-link" to="/works">See our works <ArrowRight size={15} /></Link></div></div><div className="hero-orbit"><span>Strategy</span><span>Design</span><span>Growth</span></div></div></section>;
  if (section.section_type === "text_image") return <section {...props}><div className="section-inner split-grid"><div><p className="eyebrow">{section.subtitle || "Our point of view"}</p><h2>{heading}</h2><p className="rich-copy">{body}</p>{button}</div>{image && <img className="rounded-image" src={image} alt={settings.image_alt || heading} />}</div></section>;
  if (section.section_type === "services_grid") return <section {...props}><div className="section-inner"><div className="section-heading"><div><p className="eyebrow">{section.subtitle || "Our services"}</p><h2>{heading}</h2></div><p>{body}</p></div><div className="service-grid">{items.map((item) => <article className="service-card" key={item.id}><span className="card-number">0{item.sort_order + 1}</span><h3>{item.title}</h3><p>{item.body}</p><Link to={item.link_url || "/contact"}>Let’s collab <ArrowUpRight size={14} /></Link></article>)}</div></div></section>;
  if (section.section_type === "large_service") return <section {...props}><div className="section-inner large-service"><div><p className="eyebrow">{section.subtitle || "How we work"}</p><h2>{heading}</h2><p className="rich-copy">{body}</p></div><div className="process-list">{items.map((item, index) => <div className="process-row" key={item.id}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></div>)}</div></div></section>;
  if (section.section_type === "logo_marquee") return <section {...props}><div className="marquee"><div className="marquee-track">{[...items, ...items].map((item, index) => <span key={`${item.id}-${index}`}>{item.title}<b>✦</b></span>)}</div></div></section>;
  if (section.section_type === "team_grid") return <section {...props}><div className="section-inner"><div className="section-heading"><div><p className="eyebrow">{section.subtitle || "The people behind the work"}</p><h2>{heading}</h2></div><p>{body}</p></div><div className="team-grid">{items.map((item) => <article className="team-card" key={item.id}>{item.image_url ? <img src={item.image_url} alt={item.metadata?.alt || item.title} /> : <div className="image-placeholder"><Users /></div>}<h3>{item.title}</h3><p>{item.subtitle}</p>{item.body && <small>{item.body}</small>}</article>)}</div></div></section>;
  if (section.section_type === "portfolio_grid") return <section {...props}><div className="section-inner"><div className="section-heading"><div><p className="eyebrow">{section.subtitle || "Selected work"}</p><h2>{heading}</h2></div><p>{body}</p></div><div className="portfolio-grid">{items.map((item) => <article className="portfolio-card" key={item.id}>{item.image_url ? <img src={item.image_url} alt={item.title} /> : <div className="portfolio-blank" />}<div><span>{item.subtitle}</span><h3>{item.title}</h3></div></article>)}</div></div></section>;
  if (section.section_type === "testimonial") return <section {...props}><div className="section-inner testimonial"><p className="eyebrow">{section.subtitle || "Testimonials"}</p><h2>{heading}</h2><div className="testimonial-grid">{items.map((item) => <blockquote key={item.id}><span>“</span><p>{item.body}</p><footer><b>{item.title}</b><small>{item.subtitle}</small></footer></blockquote>)}</div></div></section>;
  if (section.section_type === "cta") return <section {...props}><div className="section-inner cta-band"><div><p className="eyebrow">{section.subtitle}</p><h2>{heading}</h2><p>{body}</p></div>{button || <Link className="button button-dark" to="/contact">Let’s talk <ArrowUpRight /></Link>}</div></section>;
  if (section.section_type === "contact") return <section {...props}><div className="section-inner contact-grid"><div><p className="eyebrow">{section.subtitle || "Get in touch"}</p><h2>{heading}</h2><p>{body}</p><a className="contact-email" href="mailto:nookstudiosofficial@gmail.com">nookstudiosofficial@gmail.com <ArrowUpRight size={15} /></a></div><form onSubmit={(event) => event.preventDefault()}><label>Name<input required placeholder="Your name" /></label><label>Email<input required type="email" placeholder="you@company.com" /></label><label>What can we build?<textarea rows="4" placeholder="Tell us a little about the project" /></label><button className="button button-dark" type="submit">Send enquiry <ArrowRight size={15} /></button></form></div></section>;
  if (section.section_type === "gallery") return <section {...props}><div className="section-inner"><div className="section-heading"><div><p className="eyebrow">{section.subtitle || "Gallery"}</p><h2>{heading}</h2></div><p>{body}</p></div><div className="gallery-grid">{items.map((item) => item.image_url ? <img key={item.id} src={item.image_url} alt={item.title} /> : null)}</div></div></section>;
  if (section.section_type === "footer") return <SiteFooter />;
  return <section {...props}><div className="section-inner rich-section"><p className="eyebrow">{section.subtitle}</p><h2>{heading}</h2><p className="rich-copy">{body}</p>{button}</div></section>;
}

function PublicPage({ slug }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(null);
  useEffect(() => {
    if (page) document.title = page.seo_title || `${page.title} — Nook Studios`;
  }, [page]);
  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    fetchPage(slug).then(setPage).catch(setError).finally(() => setLoading(false));
  }, [slug]);
  if (!supabase) return <><SiteHeader navItems={FALLBACK_NAV} /><main className="public-main"><ConfigNotice /></main><SiteFooter /></>;
  if (loading) return <><SiteHeader navItems={FALLBACK_NAV} /><main className="public-main"><Loading label="Loading Nook Studios" /></main></>;
  if (error) return <><SiteHeader navItems={FALLBACK_NAV} /><main className="public-main"><ErrorState error={error} onRetry={() => window.location.reload()} /></main></>;
  if (!page) return <><SiteHeader navItems={FALLBACK_NAV} /><main className="public-main"><div className="empty-state"><h1>Page not found</h1><p>This page is not published yet.</p><Link className="button button-dark" to="/">Back home</Link></div></main><SiteFooter /></>;
  return <PublicLayout><main className="public-main">{page.sections?.filter((section) => section.is_visible).map((section) => <SectionView section={section} key={section.id} />)}</main></PublicLayout>;
}

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && session) navigate("/admin/dashboard", { replace: true }); }, [loading, session, navigate]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      requireSupabase();
      const email = usernameToEmail(username);
      if (!normaliseUsername(username)) throw new Error("Enter a username.");
      const result = mode === "create"
        ? await supabase.auth.signUp({ email, password, options: { data: { username: normaliseUsername(username), full_name: username.trim() } } })
        : await supabase.auth.signInWithPassword({ email, password });
      const authError = result.error;
      if (authError) throw authError;
      if (mode === "create" && result.data.user) {
        const { error: claimError } = await supabase.rpc("claim_first_admin", { p_username: normaliseUsername(username) });
        if (claimError && !/already claimed|not available/i.test(claimError.message)) throw claimError;
        if (!result.data.session) throw new Error("Account created. Email confirmation is enabled in Supabase; disable it under Authentication → Providers → Email, then sign in with your username.");
      }
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }
  return <main className="login-page"><div className="login-art"><Link to="/" className="brand brand-light"><img src={ASSET("nook-studios-logo.png")} alt="Nook Studios" /><span>NOOK<br />STUDIOS</span></Link><div><p className="eyebrow">Content, with intention.</p><h1>Make the work.<br /><em>Ship the change.</em></h1></div></div><div className="login-panel"><div className="login-form"><span className="admin-kicker">Nook Studios CMS</span><h2>{mode === "create" ? "Create your admin." : "Welcome back."}</h2><p>{mode === "create" ? "Create the first admin account with a username and password." : "Sign in with your Nook username and password."}</p>{!supabase && <ConfigNotice admin />}{error && <div className="form-error">{error}</div>}<form onSubmit={submit}><label>Username<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" placeholder="desmond" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} /></label><button disabled={busy || !supabase} className="button button-dark button-wide">{busy ? <Loader2 className="spin" size={17} /> : mode === "create" ? "Create admin account" : "Sign in"} {!busy && <ArrowRight size={16} />}</button></form><button className="login-mode-toggle" onClick={() => { setMode((value) => value === "login" ? "create" : "login"); setError(""); }}>{mode === "create" ? "Already have an account? Sign in" : "First time here? Create the admin account"}</button><Link className="back-home" to="/"><ArrowLeft size={15} /> Back to website</Link></div></div></main>;
}

function RequireAdmin({ children }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading label="Checking session" />;
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!profile || !["admin", "editor"].includes(profile.role)) return <div className="admin-denied"><CircleHelp size={28} /><h2>Admin access required</h2><p>Your account is signed in but does not have an editor role yet.</p><button className="button button-dark" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  return children;
}

const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/pages", label: "Pages", icon: PanelLeft },
  { to: "/admin/navigation", label: "Navigation", icon: Navigation },
  { to: "/admin/media", label: "Media library", icon: ImageIcon },
  { to: "/admin/settings", label: "Site settings", icon: Settings },
];

function AdminShell({ children }) {
  const { profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return <div className="admin-app"><aside className={`admin-sidebar ${open ? "is-open" : ""}`}><div className="admin-brand"><Link to="/" className="brand" onClick={() => setOpen(false)}><img src={ASSET("nook-studios-logo.png")} alt="Nook Studios" /><span>NOOK<br />STUDIOS</span></Link><button onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button></div><div className="admin-workspace"><span className="admin-kicker">Workspace</span><strong>Nook Studios</strong><small>Production website</small></div><nav className="admin-nav">{adminNav.filter((item) => isAdmin || !["/admin/navigation", "/admin/settings"].includes(item.to)).map(({ to, label, icon: Icon }) => <Link className={location.pathname.startsWith(to) ? "active" : ""} key={to} to={to} onClick={() => setOpen(false)}><Icon size={17} />{label}</Link>)}{isAdmin && <Link className={location.pathname.startsWith("/admin/users") ? "active" : ""} to="/admin/users" onClick={() => setOpen(false)}><Users size={17} />Users</Link>}</nav><div className="admin-sidebar-bottom"><Link to="/" target="_blank"><Eye size={16} />Preview website</Link><button onClick={() => signOut()}><LogOut size={16} />Log out</button><div className="profile-chip"><span>{profile?.full_name?.slice(0, 1) || profile?.email?.slice(0, 1) || "A"}</span><div><b>{profile?.full_name || profile?.email}</b><small>{profile?.role}</small></div></div></div></aside><div className="admin-main"><button className="mobile-admin-menu" onClick={() => setOpen(true)} aria-label="Open admin navigation"><Menu size={19} /></button>{children}</div>{open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}</div>;
}

function AdminPage() {
  return <Routes><Route path="/admin/login" element={<LoginPage />} /><Route path="/admin/*" element={<RequireAdmin><AdminShell><Routes><Route path="dashboard" element={<Dashboard />} /><Route path="pages" element={<PagesView />} /><Route path="pages/:pageId" element={<PageEditor />} /><Route path="navigation" element={<RequireAdminRole><NavigationView /></RequireAdminRole>} /><Route path="media" element={<MediaView />} /><Route path="settings" element={<RequireAdminRole><SettingsView /></RequireAdminRole>} /><Route path="users" element={<RequireAdminRole><UsersView /></RequireAdminRole>} /><Route path="*" element={<Navigate to="/admin/dashboard" replace />} /></Routes></AdminShell></RequireAdmin>} /></Routes>;
}

function AdminHeader({ eyebrow, title, description, actions }) {
  return <div className="admin-header"><div><span className="admin-kicker">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="admin-actions">{actions}</div></div>;
}

function Dashboard() {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { fetchAdminPages().then(setPages).catch(setError); }, []);
  if (error) return <ErrorState error={error} />;
  const drafts = pages.filter((page) => page.status === "draft").length;
  const published = pages.filter((page) => page.status === "published").length;
  return <div className="admin-content"><AdminHeader eyebrow="Overview" title="Good morning." description="Keep the Nook Studios site clear, current, and moving forward." actions={<Link className="button button-dark" to="/admin/pages/new"><Plus size={16} /> New page</Link>} /><div className="metric-grid"><div className="metric-card"><span>Total pages</span><strong>{pages.length}</strong><small>Across the website</small></div><div className="metric-card"><span>Published</span><strong>{published}</strong><small>Visible to visitors</small></div><div className="metric-card"><span>Drafts</span><strong>{drafts}</strong><small>Waiting for review</small></div><div className="metric-card accent-metric"><span>Quick action</span><strong>✦</strong><Link to="/admin/pages">Open page editor <ArrowRight size={14} /></Link></div></div><div className="dashboard-grid"><section className="dashboard-panel"><div className="panel-heading"><div><span className="admin-kicker">Content</span><h2>Pages at a glance</h2></div><Link to="/admin/pages">View all <ArrowRight size={14} /></Link></div>{pages.slice(0, 5).map((page) => <Link className="recent-row" to={`/admin/pages/${page.id}`} key={page.id}><span className="recent-icon">{page.is_homepage ? "H" : "P"}</span><div><b>{page.title}</b><small>/{page.slug}</small></div><StatusBadge status={page.status} /><ChevronRight size={16} /></Link>)}{!pages.length && <div className="empty-inline">No pages yet. Create the homepage to get started.</div>}</section><section className="dashboard-panel dashboard-note"><Sparkles size={22} /><span className="admin-kicker">Publishing principle</span><h2>Draft first. Publish with confidence.</h2><p>Every change is saved as a revision before it touches the public site. The canvas is the same component system visitors see.</p><Link className="text-link dark-link" to="/admin/pages">Start editing <ArrowRight size={15} /></Link></section></div></div>;
}

function StatusBadge({ status, draft }) {
  return <span className={`status-badge status-${status}`}>{draft && <span className="draft-dot" />} {draft ? "Draft saved" : status}</span>;
}

function RequireAdminRole({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/admin/dashboard" replace />;
}

function PagesView() {
  const [pages, setPages] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function load() { try { setPages(await fetchAdminPages()); } catch (loadError) { setError(loadError); } }
  useEffect(() => { load(); }, []);
  async function createPage() {
    setBusy(true);
    try {
      const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("slug", "nook-studios").single();
      if (siteError) throw siteError;
      const { data: page, error: pageError } = await supabase.from("pages").insert({ site_id: site.id, title: "Untitled page", slug: `new-page-${Date.now()}`, page_type: "standard", status: "draft", seo_title: "Untitled page — Nook Studios" }).select().single();
      if (pageError) throw pageError;
      const { error: sectionError } = await supabase.from("sections").insert({ page_id: page.id, section_type: "hero", title: "Your new page starts here", subtitle: "Edit this section", content: "Add a short introduction for this page.", settings: { button_label: "Let’s talk", button_url: "/contact" }, sort_order: 0 });
      if (sectionError) throw sectionError;
      navigate(`/admin/pages/${page.id}`);
    } catch (createError) { setError(createError); } finally { setBusy(false); }
  }
  const filtered = pages.filter((page) => (filter === "all" || page.status === filter) && `${page.title} ${page.slug}`.toLowerCase().includes(query.toLowerCase()));
  if (error) return <div className="admin-content"><ErrorState error={error} onRetry={load} /></div>;
  return <div className="admin-content"><AdminHeader eyebrow="Content" title="Pages" description="Manage what the world sees, one thoughtful page at a time." actions={<button className="button button-dark" onClick={createPage} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} New page</button>} /><div className="toolbar"><div className="search-field"><Search size={16} /><input placeholder="Search pages" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="filter-tabs">{["all", "published", "draft", "archived"].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div></div><div className="page-list">{filtered.map((page) => <article className="page-row" key={page.id}><div className="page-row-main"><span className="page-type-icon">{page.is_homepage ? "⌂" : "↗"}</span><div><h3>{page.title}</h3><p>/{page.slug}</p></div></div><StatusBadge status={page.status} /><span className="date-label">{new Date(page.updated_at).toLocaleDateString()}</span><div className="row-actions"><Link to={`/admin/pages/${page.id}`} aria-label={`Edit ${page.title}`}><Pencil size={16} /></Link><a href={`/${page.slug}`} target="_blank" rel="noreferrer" aria-label={`Preview ${page.title}`}><Eye size={16} /></a></div></article>)}{!filtered.length && <div className="empty-state compact"><FilePlus2 size={25} /><h3>No pages match that search</h3><p>Try a different filter or create a new page.</p></div>}</div></div>;
}

const sectionTypes = ["hero", "text_image", "services_grid", "large_service", "logo_marquee", "team_grid", "portfolio_grid", "testimonial", "cta", "contact", "gallery", "rich_text"];
const sectionNames = { hero: "Hero", text_image: "Text & image", services_grid: "Services grid", large_service: "Large service", logo_marquee: "Logo marquee", team_grid: "Creative team", portfolio_grid: "Portfolio grid", testimonial: "Testimonials", cta: "Call to action", contact: "Contact form", gallery: "Image gallery", rich_text: "Rich text" };

function PageEditor() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");
  const actualId = pageId === "new" ? null : pageId;
  async function load() {
    try {
      if (!actualId) { navigate("/admin/pages"); return; }
      const loaded = await fetchAdminPage(actualId);
      setPage(loaded);
      setSelectedId(loaded.sections?.[0]?.id || null);
    } catch (loadError) { setError(loadError); }
  }
  useEffect(() => { load(); }, [actualId]);
  useEffect(() => {
    if (!page || !saved) return undefined;
    const timer = setTimeout(() => setSaved(false), 2400);
    return () => clearTimeout(timer);
  }, [page, saved]);
  function updatePage(patch) { setPage((current) => ({ ...current, ...patch })); setSaved(false); }
  function updateSection(id, patch) { setPage((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) })); setSaved(false); }
  function updateSectionSetting(id, key, value) { const section = page.sections.find((item) => item.id === id); updateSection(id, { settings: { ...(section.settings || {}), [key]: value } }); }
  function updateItem(sectionId, itemId, patch) { setPage((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, items: section.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : section) })); setSaved(false); }
  function reorderSection(sourceId, targetId) {
    if (sourceId === targetId) return;
    const sections = [...page.sections];
    const sourceIndex = sections.findIndex((section) => section.id === sourceId);
    const targetIndex = sections.findIndex((section) => section.id === targetId);
    const [moved] = sections.splice(sourceIndex, 1);
    sections.splice(targetIndex, 0, moved);
    updatePage({ sections: sections.map((section, index) => ({ ...section, sort_order: index })) });
  }
  function moveSection(id, direction) {
    const sections = [...page.sections];
    const index = sections.findIndex((section) => section.id === id);
    const next = index + direction;
    if (next < 0 || next >= sections.length) return;
    [sections[index], sections[next]] = [sections[next], sections[index]];
    updatePage({ sections: sections.map((section, order) => ({ ...section, sort_order: order })) });
  }
  function addSection(type) {
    const newSection = { id: `new-${Date.now()}`, page_id: page.id, section_type: type, title: sectionNames[type], subtitle: "Edit this section", content: "Add the supporting copy for this section.", settings: {}, sort_order: page.sections.length, is_visible: true, items: [] };
    updatePage({ sections: [...page.sections, newSection] });
    setSelectedId(newSection.id);
    setShowAdd(false);
  }
  async function saveDraft(publish = false) {
    setSaving(true);
    try {
      requireSupabase();
      const sections = page.sections.map((section, index) => ({ ...section, sort_order: index }));
      const snapshot = { page: { title: page.title, slug: page.slug, seo_title: page.seo_title, seo_description: page.seo_description }, sections };
      const { error: revisionError } = await supabase.from("revisions").insert({ page_id: page.id, revision_data: snapshot, description: "draft" });
      if (revisionError) throw revisionError;
      if (publish) {
        for (const section of sections) {
          const sectionPayload = { page_id: page.id, section_type: section.section_type, title: section.title, subtitle: section.subtitle, content: section.content, settings: section.settings || {}, sort_order: section.sort_order, is_visible: section.is_visible !== false };
          let sectionId = section.id;
          if (String(section.id).startsWith("new-")) {
            const { data, error: insertError } = await supabase.from("sections").insert(sectionPayload).select().single();
            if (insertError) throw insertError;
            sectionId = data.id;
          } else {
            const { error: updateError } = await supabase.from("sections").update(sectionPayload).eq("id", section.id);
            if (updateError) throw updateError;
          }
          const existingItems = section.items || [];
          for (const [index, item] of existingItems.entries()) {
            const itemPayload = { section_id: sectionId, item_type: item.item_type || "card", title: item.title, subtitle: item.subtitle, body: item.body, image_url: item.image_url, link_url: item.link_url, metadata: item.metadata || {}, sort_order: index, is_visible: item.is_visible !== false };
            const result = String(item.id).startsWith("new-")
              ? await supabase.from("section_items").insert(itemPayload)
              : await supabase.from("section_items").update(itemPayload).eq("id", item.id);
            if (result.error) throw result.error;
          }
        }
        const { error: pageError } = await supabase.from("pages").update({ title: page.title, slug: page.slug, seo_title: page.seo_title, seo_description: page.seo_description, status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", page.id);
        if (pageError) throw pageError;
        await supabase.from("revisions").delete().eq("page_id", page.id).eq("description", "draft");
        setToast("Published to the live website");
      } else {
        await supabase.from("pages").update({ title: page.title, slug: page.slug, seo_title: page.seo_title, seo_description: page.seo_description, updated_at: new Date().toISOString() }).eq("id", page.id);
        setToast("Draft saved safely");
      }
      setSaved(true);
      await load();
    } catch (saveError) { setError(saveError); } finally { setSaving(false); }
  }
  async function toggleVisibility(section) { updateSection(section.id, { is_visible: !section.is_visible }); }
  async function duplicateSection(section) {
    const copy = { ...section, id: `new-${Date.now()}`, title: `${section.title} copy`, sort_order: page.sections.length, items: (section.items || []).map((item) => ({ ...item, id: `new-${Date.now()}-${item.id}` })) };
    updatePage({ sections: [...page.sections, copy] });
    setSelectedId(copy.id);
  }
  function removeSection(id) {
    if (!window.confirm("Delete this section from the draft?")) return;
    updatePage({ sections: page.sections.filter((section) => section.id !== id).map((section, index) => ({ ...section, sort_order: index })) });
    setSelectedId(page.sections.find((section) => section.id !== id)?.id || null);
  }
  if (error) return <div className="admin-content"><ErrorState error={error} onRetry={load} /></div>;
  if (!page) return <Loading label="Loading editor" />;
  const selected = page.sections.find((section) => section.id === selectedId) || page.sections[0];
  return <div className="editor-page"><div className="editor-topbar"><button className="icon-button" onClick={() => navigate("/admin/pages")} aria-label="Back to pages"><ArrowLeft size={18} /></button><div className="editor-title"><span className="admin-kicker">Page editor</span><strong>{page.title}</strong>{page.hasDraft && <span className="editor-draft-pill">Draft</span>}</div><div className="device-switcher"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}><Monitor size={15} />Desktop</button><button className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")}><Tablet size={15} />Tablet</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}><Smartphone size={15} />Mobile</button></div><div className="editor-actions"><span className={`save-state ${saved ? "saved" : ""}`}>{saving ? <><Loader2 className="spin" size={14} /> Saving</> : saved ? <><Check size={14} /> Saved</> : "Unsaved changes"}</span><button className="button button-ghost" onClick={() => saveDraft(false)} disabled={saving}><Save size={15} /> Save draft</button><button className="button button-dark" onClick={() => saveDraft(true)} disabled={saving}><Sparkles size={15} /> Publish</button></div></div><div className="editor-layout"><aside className="structure-panel"><div className="panel-heading"><div><span className="admin-kicker">Structure</span><h2>{page.sections.length} sections</h2></div><button className="icon-button" onClick={() => setShowAdd((value) => !value)} aria-label="Add section"><Plus size={17} /></button></div>{showAdd && <div className="add-section-menu">{sectionTypes.map((type) => <button key={type} onClick={() => addSection(type)}><Plus size={13} />{sectionNames[type]}</button>)}</div>}<div className="structure-list">{page.sections.map((section) => <div className={`structure-item ${selectedId === section.id ? "selected" : ""} ${section.is_visible === false ? "hidden-section" : ""}`} key={section.id} draggable onDragStart={(event) => event.dataTransfer.setData("section-id", section.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => reorderSection(event.dataTransfer.getData("section-id"), section.id)} onClick={() => setSelectedId(section.id)}><GripVertical className="drag-handle" size={15} /><div className="structure-copy"><b>{section.title || sectionNames[section.section_type]}</b><small>{sectionNames[section.section_type]}</small></div><button className="structure-more" onClick={(event) => { event.stopPropagation(); toggleVisibility(section); }} aria-label={section.is_visible === false ? "Show section" : "Hide section"}>{section.is_visible === false ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>)}</div></aside><main className="editor-canvas-wrap"><div className={`editor-canvas canvas-${device}`}>{page.sections.map((section) => <SectionView section={section} editor selected={section.id === selected?.id} onSelect={setSelectedId} key={section.id} />)}</div></main><aside className="inspector-panel">{selected ? <Inspector section={selected} page={page} updatePage={updatePage} updateSection={updateSection} updateSectionSetting={updateSectionSetting} updateItem={updateItem} moveSection={moveSection} duplicateSection={duplicateSection} removeSection={removeSection} /> : <div className="empty-state compact"><PanelRight size={23} /><h3>Select a section</h3><p>Choose a section in the structure panel to edit it.</p></div>}</aside></div><Toast message={toast} onClose={() => setToast("")} /></div>;
}

function Inspector({ section, page, updatePage, updateSection, updateSectionSetting, updateItem, moveSection, duplicateSection, removeSection }) {
  const settings = section.settings || {};
  return <div className="inspector"><div className="inspector-header"><div><span className="admin-kicker">Inspector</span><h2>{sectionNames[section.section_type]}</h2></div><div className="inspector-actions"><button onClick={() => moveSection(section.id, -1)} aria-label="Move up"><ArrowUp size={15} /></button><button onClick={() => moveSection(section.id, 1)} aria-label="Move down"><ArrowDown size={15} /></button><button onClick={() => duplicateSection(section)} aria-label="Duplicate section"><Copy size={15} /></button><button onClick={() => removeSection(section.id)} aria-label="Delete section"><Trash2 size={15} /></button></div></div><div className="inspector-scroll"><Field label="Internal label"><input value={section.title || ""} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></Field><Field label="Eyebrow / subtitle"><input value={section.subtitle || ""} onChange={(event) => updateSection(section.id, { subtitle: event.target.value })} /></Field><Field label="Body copy"><textarea rows="5" value={section.content || ""} onChange={(event) => updateSection(section.id, { content: event.target.value })} /></Field>{["hero", "text_image", "cta", "rich_text"].includes(section.section_type) && <><Field label="Button label"><input value={settings.button_label || ""} onChange={(event) => updateSectionSetting(section.id, "button_label", event.target.value)} placeholder="Let’s talk" /></Field><Field label="Button URL"><input value={settings.button_url || ""} onChange={(event) => updateSectionSetting(section.id, "button_url", event.target.value)} placeholder="/contact" /></Field></>}{["hero", "text_image"].includes(section.section_type) && <Field label="Background / image URL"><input value={imageForSection(section) || ""} onChange={(event) => updateSectionSetting(section.id, "background_image", event.target.value)} placeholder="/team-home-banner.jpg" /></Field>}{section.section_type === "team_grid" || section.section_type === "services_grid" || section.section_type === "portfolio_grid" || section.section_type === "testimonial" || section.section_type === "large_service" ? <ItemsEditor section={section} updateItem={updateItem} /> : null}<details className="advanced-details"><summary>Page SEO settings <ChevronDown size={15} /></summary><Field label="SEO title"><input value={page.seo_title || ""} onChange={(event) => updatePage({ seo_title: event.target.value })} /></Field><Field label="SEO description"><textarea rows="3" value={page.seo_description || ""} onChange={(event) => updatePage({ seo_description: event.target.value })} /></Field></details><label className="toggle-field"><input type="checkbox" checked={section.is_visible !== false} onChange={() => updateSection(section.id, { is_visible: section.is_visible === false })} /><span className="toggle-ui" /><span>Visible on website</span></label></div></div>;
}

function ItemsEditor({ section, updateItem }) {
  const items = section.items || [];
  return <div className="items-editor"><div className="field-label">Cards & items <span>{items.length}</span></div>{items.map((item) => <div className="item-edit" key={item.id}><div className="item-edit-title"><GripVertical size={14} /><b>{item.title || "Untitled item"}</b></div><Field label="Title"><input value={item.title || ""} onChange={(event) => updateItem(section.id, item.id, { title: event.target.value })} /></Field><Field label="Role / label"><input value={item.subtitle || ""} onChange={(event) => updateItem(section.id, item.id, { subtitle: event.target.value })} /></Field><Field label="Description"><textarea rows="3" value={item.body || ""} onChange={(event) => updateItem(section.id, item.id, { body: event.target.value })} /></Field>{["team_grid", "portfolio_grid"].includes(section.section_type) && <Field label="Image URL"><input value={item.image_url || ""} onChange={(event) => updateItem(section.id, item.id, { image_url: event.target.value })} placeholder="/team-jennifer.jpg" /></Field>}</div>)}</div>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function NavigationView() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  async function load() { try { const { data, error: loadError } = await supabase.from("navigation_items").select("*").order("sort_order"); if (loadError) throw loadError; setItems(data || []); } catch (loadError) { setError(loadError); } }
  useEffect(() => { load(); }, []);
  function update(id, patch) { setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  async function save() { setSaving(true); try { for (const [index, item] of items.entries()) { const { error: saveError } = await supabase.from("navigation_items").update({ label: item.label, url: item.url, is_visible: item.is_visible, sort_order: index }).eq("id", item.id); if (saveError) throw saveError; } } catch (saveError) { setError(saveError); } finally { setSaving(false); } }
  async function add() {
    const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("slug", "nook-studios").single();
    if (siteError) { setError(siteError); return; }
    const { data, error: addError } = await supabase.from("navigation_items").insert({ site_id: site.id, label: "New link", url: "/", sort_order: items.length, is_visible: true }).select().single();
    if (addError) setError(addError); else setItems((current) => [...current, data]);
  }
  if (error) return <div className="admin-content"><ErrorState error={error} onRetry={load} /></div>;
  return <div className="admin-content"><AdminHeader eyebrow="Site structure" title="Navigation" description="The public header reads these links directly from Supabase." actions={<><button className="button button-ghost" onClick={add}><Plus size={15} /> Add item</button><button className="button button-dark" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save navigation</button></>} /><div className="settings-card nav-editor-card">{items.map((item, index) => <div className="nav-edit-row" key={item.id}><GripVertical size={17} className="drag-handle" /><span className="nav-order">{String(index + 1).padStart(2, "0")}</span><input value={item.label} onChange={(event) => update(item.id, { label: event.target.value })} aria-label="Navigation label" /><div className="nav-url"><LinkIcon size={15} /><input value={item.url || ""} onChange={(event) => update(item.id, { url: event.target.value })} aria-label="Navigation URL" /></div><button className={`visibility-button ${item.is_visible ? "visible" : ""}`} onClick={() => update(item.id, { is_visible: !item.is_visible })}>{item.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>)}{!items.length && <div className="empty-state compact"><Navigation size={24} /><h3>No navigation items yet</h3><button className="button button-dark" onClick={add}>Add first link</button></div>}</div></div>;
}

function MediaView() {
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  async function load() { try { const { data, error: loadError } = await supabase.from("media_assets").select("*").order("created_at", { ascending: false }); if (loadError) throw loadError; setAssets(data || []); } catch (loadError) { setError(loadError); } }
  useEffect(() => { load(); }, []);
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("site-assets").getPublicUrl(path);
      const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("slug", "nook-studios").single();
      if (siteError) throw siteError;
      const { error: rowError } = await supabase.from("media_assets").insert({ site_id: site.id, file_name: file.name, storage_path: path, public_url: publicData.publicUrl, alt_text: file.name.replace(/\.[^.]+$/, ""), mime_type: file.type, file_size: file.size, folder: "uploads" });
      if (rowError) throw rowError;
      await load();
    } catch (uploadError) { setError(uploadError); } finally { setUploading(false); event.target.value = ""; }
  }
  async function remove(asset) {
    if (!window.confirm(`Delete ${asset.file_name}? This removes the stored file.`)) return;
    const { error: storageError } = await supabase.storage.from("site-assets").remove([asset.storage_path]);
    if (storageError) { setError(storageError); return; }
    const { error: rowError } = await supabase.from("media_assets").delete().eq("id", asset.id);
    if (rowError) setError(rowError); else setAssets((current) => current.filter((item) => item.id !== asset.id));
  }
  if (error) return <div className="admin-content"><ErrorState error={error} onRetry={load} /></div>;
  const filtered = assets.filter((asset) => asset.file_name.toLowerCase().includes(query.toLowerCase()));
  return <div className="admin-content"><AdminHeader eyebrow="Assets" title="Media library" description="Upload the images your pages need. Files live in Supabase Storage, not in the database." actions={<label className="button button-dark upload-button">{uploading ? <Loader2 className="spin" size={16} /> : <Upload size={16} />} {uploading ? "Uploading" : "Upload image"}<input type="file" accept="image/*" onChange={upload} hidden disabled={uploading} /></label>} /><div className="toolbar"><div className="search-field"><Search size={16} /><input placeholder="Search assets" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="asset-count">{assets.length} assets</span></div><div className="media-grid">{filtered.map((asset) => <article className="media-card" key={asset.id}><div className="media-preview"><img src={asset.public_url} alt={asset.alt_text || asset.file_name} /></div><div className="media-info"><b title={asset.file_name}>{asset.file_name}</b><small>{asset.mime_type || "image"} · {asset.file_size ? `${Math.round(asset.file_size / 1024)} KB` : "—"}</small><div><button onClick={() => navigator.clipboard?.writeText(asset.public_url)}><Copy size={14} /> Copy URL</button><button className="danger-button" onClick={() => remove(asset)} aria-label={`Delete ${asset.file_name}`}><Trash2 size={14} /></button></div></div></article>)}{!filtered.length && <div className="empty-state compact"><ImageIcon size={25} /><h3>Your library is empty</h3><p>Upload an image to use it in the page editor.</p></div>}</div></div>;
}

function SettingsView() {
  const [settings, setSettings] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { supabase.from("site_settings").select("*").order("setting_key").then(({ data, error: loadError }) => { if (loadError) setError(loadError); else setSettings(data || []); }); }, []);
  function update(key, value) { setSettings((current) => current.map((item) => item.setting_key === key ? { ...item, setting_value: value } : item)); }
  async function save() { setSaving(true); try { for (const item of settings) { const { error: saveError } = await supabase.from("site_settings").update({ setting_value: item.setting_value, updated_at: new Date().toISOString() }).eq("id", item.id); if (saveError) throw saveError; } } catch (saveError) { setError(saveError); } finally { setSaving(false); } }
  if (error) return <div className="admin-content"><ErrorState error={error} /></div>;
  return <div className="admin-content"><AdminHeader eyebrow="Configuration" title="Site settings" description="A few global details used across the public site." actions={<button className="button button-dark" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save settings</button>} /><div className="settings-card global-settings">{settings.map((item) => <Field key={item.id} label={item.setting_key.replaceAll("_", " ")}><input value={item.setting_value || ""} onChange={(event) => update(item.setting_key, event.target.value)} /></Field>)}{!settings.length && <div className="empty-state compact"><Settings size={24} /><h3>No settings have been seeded</h3><p>Run the Supabase migration to create the studio defaults.</p></div>}</div></div>;
}

function UsersView() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  async function load() {
    const { data, error: loadError } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    if (loadError) setError(loadError);
    else setUsers(data || []);
  }
  useEffect(() => { load(); }, []);
  async function changeRole(id, role) {
    setSavingId(id);
    const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (updateError) setError(updateError);
    else setUsers((current) => current.map((user) => user.id === id ? { ...user, role } : user));
    setSavingId(null);
  }
  if (error) return <div className="admin-content"><ErrorState error={error} onRetry={load} /></div>;
  return <div className="admin-content"><AdminHeader eyebrow="Access" title="Users" description="Control who can edit the site and who can publish changes." /><div className="settings-card user-list">{users.map((user) => <div className="user-row" key={user.id}><span className="profile-avatar">{(user.full_name || user.email || "U").slice(0, 1).toUpperCase()}</span><div><b>{user.full_name || "Unnamed user"}</b><small>{user.email}</small></div><select value={user.role} disabled={savingId === user.id} onChange={(event) => changeRole(user.id, event.target.value)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></div>)}{!users.length && <div className="empty-state compact"><Users size={24} /><h3>No profiles yet</h3><p>Create the first user through Supabase Auth, then promote them here.</p></div>}</div></div>;
}

function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/admin/*" element={<AdminPage />} /><Route path="/" element={<PublicPage slug="home" />} /><Route path="/about" element={<PublicPage slug="about" />} /><Route path="/works" element={<PublicPage slug="works" />} /><Route path="/services" element={<PublicPage slug="services" />} /><Route path="/contact" element={<PublicPage slug="contact" />} /><Route path="*" element={<PublicPage slug="home" />} /></Routes></BrowserRouter></AuthProvider>;
}

createRoot(document.getElementById("root")).render(<App />);