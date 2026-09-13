(function () {
  "use strict";

  var app = document.getElementById("app");
  var state = { authenticated: false, content: null, media: [], active: "dashboard", modal: null, loading: true };
  var configs = {
    works: { label: "Works", singular: "Work", fields: [
      ["title", "Title", "text"], ["category", "Category", "text"], ["coverImage", "Cover image URL", "text"], ["shortDescription", "Short description", "textarea"], ["fullDescription", "Full description", "textarea"], ["challenge", "Challenge", "textarea"], ["solution", "Solution", "textarea"], ["result", "Result", "textarea"], ["order", "Order", "number"], ["published", "Published", "checkbox"]
    ] },
    testimonials: { label: "Testimonials", singular: "Testimonial", fields: [
      ["name", "Name", "text"], ["role", "Role", "text"], ["clientPhoto", "Client photo URL", "text"], ["quote", "Quote", "textarea"], ["rating", "Rating", "number"], ["order", "Order", "number"], ["published", "Published", "checkbox"]
    ] },
    services: { label: "Services", singular: "Service", fields: [
      ["title", "Title", "text"], ["description", "Description", "textarea"], ["icon", "Icon / image URL", "text"], ["order", "Order", "number"], ["published", "Published", "checkbox"]
    ] },
    process: { label: "Process", singular: "Step", fields: [
      ["title", "Title", "text"], ["description", "Description", "textarea"], ["order", "Order", "number"], ["published", "Published", "checkbox"]
    ] }
  };

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch];
    });
  }
  function uid(prefix) { return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function api(path, options) {
    return fetch("/api/cms/" + path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...(options || {}) }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) throw new Error(body.error || "Request failed");
        return body;
      });
    });
  }
  function toast(message, type) {
    var node = document.createElement("div");
    node.className = "toast " + (type || "");
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(function () { node.classList.add("show"); }, 10);
    setTimeout(function () { node.classList.remove("show"); setTimeout(function () { node.remove(); }, 250); }, 2800);
  }
  function sorted(key) {
    return (state.content[key] || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function countPublished(key) { return (state.content[key] || []).filter(function (item) { return item.published !== false; }).length; }
  function render() {
    if (state.loading) return (app.innerHTML = '<div class="splash"><div class="brand-mark">A</div><span>Loading Agenmint CMS…</span></div>');
    if (!state.authenticated) return renderLogin();
    var nav = [
      ["dashboard", "Dashboard", "⌂"], ["pages", "Pages", "▤"], ["works", "Works", "◇"], ["testimonials", "Testimonials", "◌"], ["services", "Services", "✦"], ["process", "Process", "↗"], ["media", "Media Library", "▧"], ["settings", "Site Settings", "⚙"]
    ];
    app.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">A</div><div><strong>Agenmint</strong><span>Content Studio</span></div></div><button class="mobile-close" aria-label="Close menu">×</button><nav>' + nav.map(function (item) {
      return '<button class="nav-item ' + (state.active === item[0] ? "active" : "") + '" data-page="' + item[0] + '"><span class="nav-icon">' + item[2] + '</span>' + item[1] + '</button>';
    }).join("") + '</nav><div class="sidebar-foot"><span class="status-dot"></span> Connected to GitHub<button id="logout">Log out</button></div></aside><main class="main"><header class="topbar"><button class="menu-toggle" aria-label="Open menu">☰</button><div><span class="eyebrow">Agenmint / CMS</span><h1>' + escape(pageTitle()) + '</h1></div><a class="view-site" href="/" target="_blank">View site ↗</a></header><section class="content">' + pageMarkup() + '</section></main></div>';
    bindShell();
  }
  function pageTitle() {
    if (state.active === "dashboard") return "Dashboard";
    if (state.active === "media") return "Media Library";
    if (state.active === "settings") return "Site Settings";
    return state.active.charAt(0).toUpperCase() + state.active.slice(1);
  }
  function renderLogin() {
    app.innerHTML = '<main class="login-page"><div class="login-card"><div class="brand login-brand"><div class="brand-mark">A</div><div><strong>Agenmint</strong><span>Content Studio</span></div></div><span class="eyebrow">Private workspace</span><h1>Welcome back.</h1><p>Sign in to manage the content on your public site.</p><form id="login-form"><label>Username<input name="username" autocomplete="username" required /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><button class="primary full" type="submit">Sign in <span>→</span></button><div id="login-error" class="form-error"></div></form></div><div class="login-aside"><span>AG</span><p>Good content makes good work easier to find.</p></div></main>';
    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var form = new FormData(event.currentTarget);
      var error = document.getElementById("login-error");
      error.textContent = "";
      api("login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) }).then(function () {
        state.authenticated = true; return loadData();
      }).catch(function (err) { error.textContent = err.message; });
    });
  }
  function pageMarkup() {
    if (state.active === "dashboard") return dashboardMarkup();
    if (state.active === "pages") return pagesMarkup();
    if (state.active === "media") return mediaMarkup();
    if (state.active === "settings") return settingsMarkup();
    return collectionMarkup(state.active);
  }
  function dashboardMarkup() {
    var cards = [
      ["Total pages", Object.keys(state.content.pages || {}).length, "Across the public site", "violet"],
      ["Published works", countPublished("works"), (state.content.works || []).length + " total records", "lime"],
      ["Draft works", (state.content.works || []).filter(function (x) { return x.published === false; }).length, "Not visible on the site", "orange"],
      ["Testimonials", (state.content.testimonials || []).length, "Client voices", "blue"],
      ["Services", countPublished("services"), "Published offerings", "dark"],
      ["Media files", state.media.length, "Stored in cms/media", "gray"]
    ];
    return '<div class="welcome-row"><div><span class="eyebrow">Sunday, September 13, 2026</span><h2>Make the next update count.</h2><p>Everything you publish here flows to the existing Agenmint website.</p></div><button class="primary" data-action="open-quick">Quick edit <span>→</span></button></div><div class="stats-grid">' + cards.map(function (card) { return '<article class="stat-card ' + card[3] + '"><span>' + card[0] + '</span><strong>' + card[1] + '</strong><small>' + card[2] + '</small></article>'; }).join("") + '</div><div class="dashboard-grid"><article class="panel activity"><div class="panel-heading"><div><span class="eyebrow">Workflow</span><h3>Content at a glance</h3></div><span class="pill success">Live sync ready</span></div><div class="activity-line"><span class="activity-icon">✓</span><div><strong>GitHub-backed content</strong><p>Changes are committed to ' + escape("CMS_GITHUB_REPO") + ' and redeployed by Vercel.</p></div></div><div class="activity-line"><span class="activity-icon">↗</span><div><strong>Public website protected</strong><p>The loader updates existing Framer nodes without replacing the layout.</p></div></div></article><article class="panel shortcut"><span class="eyebrow">Start here</span><h3>Build your content library</h3><p>Add a new work, upload a visual, or fine-tune your global brand settings.</p><div class="shortcut-actions"><button data-page="works">Add a work</button><button data-page="media">Upload media</button></div></article></div>';
  }
  function collectionMarkup(key) {
    var config = configs[key], items = sorted(key);
    var rows = items.map(function (item) {
      var image = item.clientPhoto || item.coverImage;
      var label = item.title || item.name || "";
      return '<div class="table-row" data-row="' + escape(item.id) + '"><div class="item-name">' +
        (image ? '<img src="' + escape(image) + '" alt="" />' : '<span class="item-avatar">' + escape(label.charAt(0) || "?") + '</span>') +
        '<div><strong>' + escape(label) + '</strong><small>' + escape(item.category || item.role || item.description || "") + '</small></div></div>' +
        '<span class="pill ' + (item.published === false ? "draft" : "success") + '">' + (item.published === false ? "Draft" : "Published") + '</span>' +
        '<span class="order-number">' + (item.order || 0) + '</span><div class="row-actions">' +
        '<button data-action="edit" data-key="' + key + '" data-id="' + item.id + '">Edit</button>' +
        '<button class="icon-button danger" data-action="delete" data-key="' + key + '" data-id="' + item.id + '" aria-label="Delete">×</button></div></div>';
    }).join("");
    var body = items.length ? '<div class="data-table"><div class="table-header"><span>Name</span><span>Status</span><span>Order</span><span></span></div>' + rows + '</div>' :
      '<div class="empty"><div class="empty-icon">◇</div><h3>No ' + config.label.toLowerCase() + ' yet</h3><p>Add your first record to start building the collection.</p><button class="secondary" data-action="add" data-key="' + key + '">Add ' + config.singular + '</button></div>';
    return '<div class="section-heading"><div><span class="eyebrow">Content collection</span><h2>' + config.label + '</h2><p>Manage the records that appear on your public website.</p></div><button class="primary" data-action="add" data-key="' + key + '">Add ' + config.singular + ' <span>+</span></button></div><div class="panel table-panel"><div class="table-tools"><span>' + items.length + ' records</span><input class="search" data-search="' + key + '" placeholder="Search ' + config.label.toLowerCase() + '…" /></div>' + body + '</div>';
  }
  function pagesMarkup() {
    var page = state.content.pages.home || {};
    var hero = page.hero || {};
    return '<div class="section-heading"><div><span class="eyebrow">Page content</span><h2>Pages</h2><p>Edit the words and links already mapped to the public site.</p></div><button class="secondary" data-action="save-page">Save page</button></div><form id="page-form" class="editor-grid"><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Home / Hero</span><h3>First impression</h3></div></div>' + field("hero.eyebrow", "Eyebrow", hero.eyebrow) + field("hero.heading", "Heading", hero.heading) + field("hero.paragraph", "Paragraph", hero.paragraph, "textarea") + '<div class="two-col">' + field("hero.primaryButtonText", "Primary button", hero.primaryButtonText) + field("hero.primaryButtonLink", "Primary link", hero.primaryButtonLink) + '</div><div class="two-col">' + field("hero.secondaryButtonText", "Secondary button", hero.secondaryButtonText) + field("hero.secondaryButtonLink", "Secondary link", hero.secondaryButtonLink) + '</div></article><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Home / About</span><h3>About section</h3></div></div>' + field("about.heading", "Heading", (page.about || {}).heading) + field("about.paragraph", "Paragraph", (page.about || {}).paragraph, "textarea") + '<div class="two-col">' + field("about.buttonText", "Button text", (page.about || {}).buttonText) + field("about.buttonLink", "Button link", (page.about || {}).buttonLink) + '</div></article><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Home / Contact</span><h3>Call to action</h3></div></div>' + field("contact.heading", "Heading", (page.contact || {}).heading) + '<div class="two-col">' + field("contact.buttonText", "Button text", (page.contact || {}).buttonText) + field("contact.buttonLink", "Button link", (page.contact || {}).buttonLink) + '</div></article></form>';
  }
  function field(name, label, value, type) {
    return '<label>' + label + '<' + (type === "textarea" ? "textarea" : 'input type="text"') + ' data-path="' + name + '">' + (type === "textarea" ? escape(value) + "</textarea>" : ' value="' + escape(value) + '" />') + "</label>";
  }
  function mediaMarkup() {
    return '<div class="section-heading"><div><span class="eyebrow">Asset library</span><h2>Media Library</h2><p>Upload visuals once, then reuse their paths across your content.</p></div><label class="primary upload-button">Upload image<input id="media-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden /></label></div><div class="media-grid">' + (state.media.length ? state.media.map(function (item) { return '<article class="media-card"><div class="media-preview"><img src="' + escape(item.url) + '" alt="" /></div><div class="media-meta"><strong>' + escape(item.name) + '</strong><small>' + Math.round((item.size || 0) / 1024) + ' KB</small></div><div class="media-actions"><button data-copy="' + escape(item.url) + '">Copy URL</button><button data-use="' + escape(item.url) + '">Use image</button><button class="icon-button danger" data-delete-media="' + escape(item.path) + '">×</button></div></article>'; }).join("") : '<div class="empty media-empty"><div class="empty-icon">▧</div><h3>Your library is empty</h3><p>Upload PNG, JPG, WEBP, GIF, or safe SVG images up to 5 MB.</p></div>') + '</div>';
  }
  function settingsMarkup() {
    var site = state.content.site || {};
    return '<div class="section-heading"><div><span class="eyebrow">Global configuration</span><h2>Site Settings</h2><p>Set the shared visual language and contact details for the public site.</p></div><button class="primary" data-action="save-settings">Save settings <span>→</span></button></div><form id="settings-form" class="editor-grid"><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Identity</span><h3>Brand basics</h3></div></div><div class="two-col">' + field("name", "Site name", site.name) + field("logo", "Logo URL", site.logo) + '</div>' + field("favicon", "Favicon URL", site.favicon) + '</article><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Color system</span><h3>Brand colors</h3></div></div><div class="color-grid">' + ["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "textColor"].map(function (key) { return colorField(key, key.replace("Color", " color"), site[key]); }).join("") + '</div></article><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Type system</span><h3>Fonts & scale</h3></div></div><div class="two-col">' + field("headingFont", "Heading font", site.headingFont) + field("bodyFont", "Body font", site.bodyFont) + '</div><div class="two-col">' + field("headingFontSize", "Heading size", site.headingFontSize) + field("bodyFontSize", "Body size", site.bodyFontSize) + '</div><div class="two-col">' + field("headingWeight", "Heading weight", site.headingWeight) + field("bodyWeight", "Body weight", site.bodyWeight) + '</div></article><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">Contact</span><h3>How people reach you</h3></div></div><div class="two-col">' + field("contactEmail", "Email", site.contactEmail) + field("contactPhone", "Phone", site.contactPhone) + '</div>' + field("address", "Address", site.address) + '</article></form>';
  }
  function colorField(key, label, value) {
    return '<label class="color-field">' + label + '<span><input type="color" data-setting="' + key + '" value="' + escape(value || "#000000") + '" /><input type="text" data-setting="' + key + '" value="' + escape(value) + '" pattern="^#[0-9a-fA-F]{6}$" /></span></label>';
  }
  function bindShell() {
    document.querySelectorAll("[data-page]").forEach(function (button) { button.addEventListener("click", function () { state.active = button.dataset.page; render(); }); });
    document.querySelectorAll("[data-action]").forEach(function (button) { button.addEventListener("click", action); });
    document.querySelectorAll("[data-delete-media]").forEach(function (button) { button.addEventListener("click", deleteMedia); });
    document.querySelectorAll("[data-copy]").forEach(function (button) { button.addEventListener("click", function () { navigator.clipboard.writeText(button.dataset.copy).then(function () { toast("URL copied"); }); }); });
    document.getElementById("logout").addEventListener("click", function () { api("logout", { method: "POST" }).catch(function () {}).finally(function () { state.authenticated = false; render(); }); });
    document.querySelector(".menu-toggle").addEventListener("click", function () { document.querySelector(".sidebar").classList.add("open"); });
    document.querySelector(".mobile-close").addEventListener("click", function () { document.querySelector(".sidebar").classList.remove("open"); });
    var upload = document.getElementById("media-upload");
    if (upload) upload.addEventListener("change", uploadMedia);
    document.querySelectorAll("[data-search]").forEach(function (input) { input.addEventListener("input", function () { document.querySelectorAll("[data-row]").forEach(function (row) { row.style.display = row.textContent.toLowerCase().indexOf(input.value.toLowerCase()) === -1 ? "none" : ""; }); }); });
  }
  function action(event) {
    var button = event.currentTarget, actionName = button.dataset.action;
    if (actionName === "add" || actionName === "edit") openModal(button.dataset.key, button.dataset.id);
    if (actionName === "delete") deleteItem(button.dataset.key, button.dataset.id);
    if (actionName === "save-page") savePage();
    if (actionName === "save-settings") saveSettings();
    if (actionName === "open-quick") { state.active = "works"; render(); openModal("works"); }
  }
  function openModal(key, id) {
    var config = configs[key], item = id ? (state.content[key] || []).find(function (x) { return x.id === id; }) : {};
    item = item || {};
    var form = config.fields.map(function (entry) {
      var keyName = entry[0], label = entry[1], type = entry[2], value = item[keyName];
      if (type === "checkbox") return '<label class="check-label"><input type="checkbox" data-modal-field="' + keyName + '" ' + (value !== false ? "checked" : "") + ' /> ' + label + '</label>';
      return '<label>' + label + (type === "textarea" ? '<textarea data-modal-field="' + keyName + '">' + escape(value) + '</textarea>' : '<input type="' + type + '" data-modal-field="' + keyName + '" value="' + escape(value) + '" />') + '</label>';
    }).join("");
    state.modal = document.createElement("div");
    state.modal.className = "modal-backdrop";
    state.modal.innerHTML = '<div class="modal"><div class="modal-head"><div><span class="eyebrow">' + (id ? "Edit record" : "New record") + '</span><h2>' + (id ? "Update " : "Add ") + config.singular + '</h2></div><button class="modal-close">×</button></div><form id="modal-form" class="modal-form">' + form + '<div class="modal-actions"><button type="button" class="secondary modal-close">Cancel</button><button class="primary" type="submit">Save ' + config.singular + ' <span>→</span></button></div></form></div>';
    document.body.appendChild(state.modal);
    state.modal.querySelectorAll(".modal-close").forEach(function (x) { x.addEventListener("click", closeModal); });
    state.modal.querySelector("#modal-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var next = {};
      config.fields.forEach(function (entry) {
        var fieldNode = state.modal.querySelector('[data-modal-field="' + entry[0] + '"]');
        next[entry[0]] = entry[2] === "checkbox" ? fieldNode.checked : (entry[2] === "number" ? Number(fieldNode.value || 0) : fieldNode.value);
      });
      next.id = id || uid(key.slice(0, -1));
      var list = state.content[key] || [];
      var index = list.findIndex(function (x) { return x.id === next.id; });
      if (index === -1) list.push(next); else list[index] = next;
      saveContent().then(function () { closeModal(); render(); toast(config.singular + " saved"); }).catch(function (err) { toast(err.message, "error"); });
    });
  }
  function closeModal() { if (state.modal) { state.modal.remove(); state.modal = null; } }
  function deleteItem(key, id) {
    var item = (state.content[key] || []).find(function (x) { return x.id === id; });
    if (!item || !window.confirm("Delete " + (item.title || item.name) + "? This cannot be undone.")) return;
    state.content[key] = state.content[key].filter(function (x) { return x.id !== id; });
    saveContent().then(function () { render(); toast("Record deleted"); }).catch(function (err) { toast(err.message, "error"); });
  }
  function savePage() {
    var form = document.getElementById("page-form"), home = state.content.pages.home;
    form.querySelectorAll("[data-path]").forEach(function (node) {
      var parts = node.dataset.path.split("."), target = home;
      for (var i = 0; i < parts.length - 1; i++) target = target[parts[i]] || (target[parts[i]] = {});
      target[parts[parts.length - 1]] = node.value;
    });
    saveContent().then(function () { toast("Page saved"); }).catch(function (err) { toast(err.message, "error"); });
  }
  function saveSettings() {
    var form = document.getElementById("settings-form"), site = state.content.site;
    form.querySelectorAll("[data-setting]").forEach(function (node) { site[node.dataset.setting] = node.value; });
    form.querySelectorAll("[data-path]").forEach(function (node) { site[node.dataset.path] = node.value; });
    saveContent().then(function () { toast("Settings saved"); }).catch(function (err) { toast(err.message, "error"); });
  }
  function saveContent() {
    return api("content", { method: "PUT", body: JSON.stringify(state.content) }).then(function (result) { state.content = result.content; });
  }
  function uploadMedia(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Images must be smaller than 5 MB", "error");
    var reader = new FileReader();
    reader.onload = function () {
      api("media", { method: "POST", body: JSON.stringify({ filename: file.name, mime: file.type, data: reader.result }) }).then(function () { return loadMedia(); }).then(function () { render(); toast("Image uploaded"); }).catch(function (err) { toast(err.message, "error"); });
    };
    reader.readAsDataURL(file);
  }
  function deleteMedia(event) {
    var path = event.currentTarget.dataset.deleteMedia;
    if (!window.confirm("Delete this image from the media library?")) return;
    api("media", { method: "DELETE", body: JSON.stringify({ path: path }) }).then(loadMedia).then(function () { render(); toast("Image deleted"); }).catch(function (err) { toast(err.message, "error"); });
  }
  function loadMedia() { return api("media").then(function (result) { state.media = result.media || []; }); }
  function loadData() {
    state.loading = true; render();
    return Promise.all([api("content"), loadMedia()]).then(function (results) { state.content = results[0]; state.authenticated = true; state.loading = false; render(); }).catch(function () { state.authenticated = false; state.loading = false; render(); });
  }
  api("session").then(function (result) {
    state.authenticated = result.authenticated;
    if (state.authenticated) return loadData();
    state.loading = false;
    render();
  }).catch(function () { state.loading = false; render(); });
})();