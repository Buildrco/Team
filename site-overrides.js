(() => {
  "use strict";

  const EMAIL = "nookstudiosofficial@gmail.com";
  const PHONE = "+233557696771";
  const PHONE_HREF = `tel:${PHONE}`;
  const HOME_BANNER =
    "./framerusercontent.com/images/PKWNuWIsmQ7fTrryG0px7mJJCY_width=3168&height=1480.jpg";
  const MAP_URL = "https://www.google.com/maps/search/?api=1&query=Osu%2C+Accra";
  const SOCIALS = [
    { names: ["Instagram", "Dribbble", "Behance", "LinkedIn"], label: "Tiktok", href: "https://www.tiktok.com/" },
    { names: ["Instagram", "Dribbble", "Behance", "LinkedIn"], label: "YouTube", href: "https://www.youtube.com/" },
  ];
  const ABOUT_IMAGES = ["./about-team-1.jpg", "./about-team-2.jpg", "./about-team-3.jpg", "./about-team-4.jpg"];
  const TEAM_MEMBERS = [
    ["./founder-desmond.jpg", "Desmond Grace", "Founder & Creative Director"],
    ["./founder-fiifi.jpg", "Fiifi Abew", "Founder & Technical Director"],
    ["./team-jennifer.jpg", "Jennifer Wilson", "Social Media Strategist Lead"],
    ["./team-johnetta.jpg", "Johnetta", "Lead Content Creator"],
    ["./team-aaron.jpg", "Aaron Adonteng", "Lead Architect and Chief of Staff (C.O.S)"],
  ];

  const brandPattern = /\bagenmint\b|\bdunhill\b/gi;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phonePattern = /(?:\+?\d[\d\s()./-]{7,}\d)/g;

  const replaceText = (value) =>
    value
      .replace(brandPattern, "Nook Studios")
      .replace(emailPattern, EMAIL)
      .replace(/\bLagos\s*,\s*Nigeria\b/gi, "OSU, Accra")
      .replace(/\bLagos\b/gi, "OSU")
      .replace(/\bNigeria\b/gi, "Accra")
      .replace(phonePattern, PHONE);

  function rewriteTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach((textNode) => {
      if (!textNode.parentElement || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(textNode.parentElement.tagName)) return;
      const updated = replaceText(textNode.nodeValue);
      if (updated !== textNode.nodeValue) textNode.nodeValue = updated;
    });
  }

  function rewriteSplitBranding() {
    document.querySelectorAll("h1, h2, h3, h4, h5, h6, p").forEach((element) => {
      if (/\bagenmint\b|\bdunhill\b/i.test(element.textContent)) {
        element.textContent = replaceText(element.textContent);
      }
    });
  }

  function rewriteAttribute(element, name) {
    const value = element.getAttribute(name);
    if (!value) return;
    let updated = value.replace(brandPattern, "nook-studios").replace(emailPattern, EMAIL);
    if (name === "href" && /^mailto:/i.test(value)) updated = `mailto:${EMAIL}`;
    if (name === "href" && /^tel:/i.test(value)) updated = PHONE_HREF;

    const mapContext = `${name} ${value} ${element.getAttribute("data-framer-name") || ""}`.toLowerCase();
    if (
      (name === "src" || name === "srcset") &&
      /team-home-banner\.jpg|PKWNuWIsmQ7fTrryG0px7mJJCY/i.test(value)
    ) {
      updated = HOME_BANNER;
    } else if (name === "src" && element.tagName === "IFRAME" && /map|location|address/.test(mapContext)) {
      updated = MAP_URL;
    } else if ((name === "href" || name === "src") && /map|location|address/.test(mapContext)) {
      updated = MAP_URL;
    }

    if (updated !== value) element.setAttribute(name, updated);
  }

  function optimizeImages() {
    document.querySelectorAll("img").forEach((img, index) => {
      const isHomeBanner =
        /team-home-banner\.jpg|PKWNuWIsmQ7fTrryG0px7mJJCY/i.test(img.getAttribute("src") || "") ||
        /team-home-banner\.jpg|PKWNuWIsmQ7fTrryG0px7mJJCY/i.test(img.getAttribute("srcset") || "");

      img.decoding = "async";
      if (isHomeBanner) {
        img.src = HOME_BANNER;
        img.removeAttribute("srcset");
        img.loading = "eager";
        img.fetchPriority = "high";
        img.alt = "Nook Studios team";
      } else {
        img.loading = "lazy";
        img.fetchPriority = index < 2 ? "auto" : "low";
      }

      ["src", "srcset", "alt", "title", "aria-label"].forEach((name) => rewriteAttribute(img, name));
    });
  }

  function updateSocials() {
    const originalNames = new Set(["instagram", "dribbble", "behance", "linkedin"]);
    const links = [...document.querySelectorAll("footer a")].filter((link) =>
      originalNames.has(link.textContent.trim().toLowerCase())
    );

    links.forEach((link, index) => {
      const groupIndex = index % 4;
      if (groupIndex > 1) {
        link.style.display = "none";
        return;
      }

      const social = SOCIALS[groupIndex];
      const label = link.querySelector("p, span") || link;
      label.textContent = social.label;
      link.href = social.href;
      link.setAttribute("aria-label", social.label);
    });
  }

  function updateMapEmbeds() {
    document.querySelectorAll("iframe, a, [data-framer-name]").forEach((element) => {
      const context = `${element.getAttribute("src") || ""} ${element.getAttribute("href") || ""} ${
        element.getAttribute("data-framer-name") || ""
      }`.toLowerCase();
      if (!/map|location|address/.test(context)) return;
      if (element.tagName === "IFRAME") element.src = MAP_URL;
      if (element.tagName === "A") element.href = MAP_URL;
    });
  }

  function findAboutMarker(pattern) {
    const candidates = [...document.querySelectorAll("body *")].filter((element) => {
      if (element.closest(".nook-about-team-section")) return false;
      const text = element.textContent.trim().replace(/\s+/g, " ");
      return text.length > 0 && text.length < 280 && pattern.test(text);
    });
    return candidates.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
  }

  function safeAboutBlock(marker, limit = 1800) {
    if (!marker) return null;
    let block = marker;
    let current = marker;
    for (let i = 0; i < 8; i += 1) {
      const parent = current.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      const textLength = parent.textContent.trim().length;
      if (textLength > limit || parent.querySelector("nav, header")) break;
      if (parent.children.length > 1) block = parent;
      current = parent;
    }
    if (block === document.body || block === document.documentElement) return null;
    if (block.querySelectorAll("img").length > 8) return null;
    return block;
  }

  function hideAboutMarker(pattern) {
    const block = safeAboutBlock(findAboutMarker(pattern));
    if (block) block.style.display = "none";
  }

  function hideImageBlock(image) {
    let block = image;
    let current = image;
    for (let i = 0; i < 5; i += 1) {
      const parent = current.parentElement;
      if (!parent || parent === document.body) break;
      const name = (parent.getAttribute("data-framer-name") || "").toLowerCase();
      const textLength = parent.textContent.trim().length;
      if (name.includes("card") || name.includes("image") || (parent.children.length > 1 && textLength < 900)) {
        block = parent;
      }
      if (textLength > 1200) break;
      current = parent;
    }
    if (block !== document.body && block !== document.documentElement) block.style.display = "none";
  }

  function removeAboutGallery() {
    const mission = findAboutMarker(/^our\s+mission$/i);
    const creative = findAboutMarker(/our\s+creative\s+team/i);
    if (!mission || !creative) return;
    let started = false;
    let removed = 0;
    document.querySelectorAll("img").forEach((image) => {
      if (!started) started = Boolean(mission.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!started || removed >= 4 || creative.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING) return;
      hideImageBlock(image);
      removed += 1;
    });
  }

  function renderAboutTeam() {
    if (!/about/i.test(window.location.pathname) || document.querySelector(".nook-about-team-section")) return;
    const marker = findAboutMarker(/our\s+creative\s+team/i);
    if (!marker) return;
    const oldTeamBlock = safeAboutBlock(marker);
    if (!oldTeamBlock || oldTeamBlock === document.body) return;

    let afterTeam = false;
    let beforeAlien = true;
    const alien = findAboutMarker(/our\s+alien/i);
    document.querySelectorAll("img").forEach((image) => {
      if (!afterTeam) afterTeam = Boolean(marker.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (alien && alien.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING) beforeAlien = false;
      if (afterTeam && beforeAlien && !image.closest(".nook-about-team-section")) hideImageBlock(image);
    });
    oldTeamBlock.style.display = "none";

    const section = document.createElement("section");
    section.className = "nook-about-team-section";
    section.innerHTML = `<div class="nook-about-team-heading"><h2>Our Creative Team</h2><p>Explore the services our clients love most, designed to deliver exceptional results.</p></div>`;
    const grid = document.createElement("div");
    grid.className = "nook-team-grid";
    grid.innerHTML = TEAM_MEMBERS.map(
      ([src, name, title]) =>
        `<article class="nook-team-card"><img src="${src}" loading="lazy" decoding="async" alt="${name}"><h3>${name}</h3><p>${title}</p></article>`
    ).join("");
    section.appendChild(grid);

    const style = document.createElement("style");
    style.textContent =
      ".nook-about-team-section{width:min(1120px,calc(100% - 48px));margin:112px auto 80px;animation:nook-team-enter .7s ease-out both}.nook-about-team-heading h2{margin:0;font-size:clamp(32px,5vw,64px);line-height:1.05}.nook-about-team-heading p{margin:16px 0 20px;max-width:620px;font-size:18px;line-height:1.5}.nook-logo-marquee{overflow:hidden;width:100%;margin:46px 0 42px;border-top:1px solid currentColor;border-bottom:1px solid currentColor;padding:18px 0}.nook-logo-track{display:flex;width:max-content;animation:nook-logo-scroll 26s linear infinite}.nook-logo-track span{display:flex;align-items:center;gap:28px;margin-right:28px;white-space:nowrap;font-size:14px;letter-spacing:.16em;font-weight:700}.nook-logo-track b{font-size:20px;font-weight:400}@keyframes nook-logo-scroll{to{transform:translateX(-50%)}}@keyframes nook-team-enter{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes nook-card-enter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}.nook-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.nook-team-card{overflow:hidden;border-radius:16px;background:#fff;min-width:0;opacity:0;animation:nook-card-enter .6s ease-out both}.nook-team-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:16px}.nook-team-card h3{margin:12px 16px 0}.nook-team-card p{margin:4px 16px 16px;color:#667085}.nook-team-card:nth-child(2){animation-delay:.08s}.nook-team-card:nth-child(3){animation-delay:.16s}.nook-team-card:nth-child(4){animation-delay:.24s}.nook-team-card:nth-child(5){animation-delay:.32s}@media(max-width:800px){.nook-about-team-section{width:min(100% - 32px,620px);margin-top:112px;padding-top:56px}.nook-team-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}@media(max-width:520px){.nook-team-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nook-team-card{min-width:0}}";
    document.head.appendChild(style);
    const insertionTarget = document.querySelector("[data-nook-about-logo-marquee]") || oldTeamBlock;
    insertionTarget.parentElement.insertBefore(section, insertionTarget);
  }

  function removeAboutIntro() {
    if (!/about/i.test(window.location.pathname)) return;
    if (document.querySelector("[data-nook-about-trimmed]") && document.querySelector("[data-nook-about-logo-marquee]")) return;

    const page = document.querySelector("#main, main");
    if (!page) return;

    const candidates = [...page.querySelectorAll("[data-framer-name], [class]")].filter((element) => {
      if (element.closest("header, nav, footer")) return false;
      const label = [element, ...element.querySelectorAll("[data-framer-name]")].map((node) =>
        `${node.getAttribute("data-framer-name") || ""} ${node.getAttribute("class") || ""}`
      ).join(" ").toLowerCase();
      if (!/logo|marquee|ticker|client|partner|trusted|scroll/.test(label)) return false;
      return element.querySelectorAll("img, svg").length >= 2 || element.children.length >= 2;
    });
    const logoMarker = candidates.sort((a, b) => {
      const score = (element) => {
        const ownLabel = `${element.getAttribute("data-framer-name") || ""} ${element.getAttribute("class") || ""}`.toLowerCase();
        const nestedLabel = [...element.querySelectorAll("[data-framer-name]")].map((node) =>
          node.getAttribute("data-framer-name") || ""
        ).join(" ").toLowerCase();
        return (/marquee|ticker/.test(ownLabel) ? 12 : 0) + (/logo/.test(ownLabel) ? 8 : 0) +
          (/marquee|ticker/.test(nestedLabel) ? 3 : 0) + (/logo/.test(nestedLabel) ? 2 : 0) +
          Math.min(element.querySelectorAll("img, svg").length, 8) / 10 - element.querySelectorAll("*").length / 10000;
      };
      return score(b) - score(a);
    })[0];
    if (!logoMarker) return;

    let logoSection = logoMarker;
    let current = logoMarker;
    let contentRoot = null;
    while (current.parentElement && current.parentElement !== page) {
      const parent = current.parentElement;
      const hasDirectShell = [...parent.children].some((child) => /^(HEADER|NAV|FOOTER)$/i.test(child.tagName));
      if (!hasDirectShell && current.previousElementSibling) {
        contentRoot = parent;
        logoSection = current;
      }
      if (hasDirectShell) break;
      current = parent;
    }
    if (!contentRoot) return;

    const sections = [...contentRoot.children];
    const logoIndex = sections.indexOf(logoSection);
    if (logoIndex < 0) return;

    sections.slice(0, logoIndex).forEach((section) => {
      if (section.querySelector("header, nav, footer")) return;
      section.remove();
    });
    logoSection.setAttribute("data-nook-about-logo-marquee", "true");
    contentRoot.setAttribute("data-nook-about-trimmed", "true");
  }

  function updateAboutSections() {
    if (!/about/i.test(window.location.pathname)) return;
    removeAboutIntro();
    removeAboutGallery();
    hideAboutMarker(/awards?\s*(and|&)?\s*recognition/i);
    hideAboutMarker(/find\s+us\s+near(?:by|\s+by(?:\s+you)?)/i);
    hideAboutMarker(/^(?:our\s+)?(?:core\s+)?values?$/i);
    renderAboutTeam();
  }

  function scrub(root = document) {
    rewriteTextNodes(root);
    rewriteSplitBranding();
    root.querySelectorAll?.("*").forEach((element) => {
      ["href", "src", "srcset", "alt", "title", "aria-label", "data-framer-name"].forEach((name) =>
        rewriteAttribute(element, name)
      );
    });
    optimizeImages();
    updateSocials();
    updateMapEmbeds();
    updateAboutSections();
    removeBlogContent();
    restoreHomepageFooter();
  }

  function removeBlogContent(root = document) {
    if (root.matches?.('[data-framer-name="Blog Section"]')) root.remove();
    root.querySelectorAll?.('[data-framer-name="Blog Section"]').forEach((section) => section.remove());
    root.querySelectorAll?.('a[href*="/blogs"], a[href*="./blogs"]').forEach((link) => {
      const item = link.closest('div[class*="container"]') || link;
      if (item !== document.body && item !== document.documentElement) item.remove();
    });
  }

  function restoreHomepageFooter() {
    if (!/^\/?$/.test(window.location.pathname)) return;
    document.querySelectorAll("footer").forEach((footer) => {
      footer.hidden = false;
      footer.style.removeProperty("display");
    });
  }

  function redirectBlogRoutes() {
    if (!/\/blogs(?:\/|$)/i.test(window.location.pathname)) return false;
    window.location.replace("/");
    return true;
  }

  const start = () => {
    if (redirectBlogRoutes()) return;
    scrub();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scrub(node);
        });
      });
      updateSocials();
      updateAboutSections();
      removeBlogContent();
      restoreHomepageFooter();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();


/* Nook Studios works discovery experience */
(() => {
  "use strict";

  const WORKS = [
    { id: "bajindu", title: "Bajindu", type: "Brand identity", description: "A confident identity system built around rhythm, contrast, and a warm editorial palette.", image: "framerusercontent.com/images/4ELvfGisLwg2bivRpvymFikUY_scale-down-to=1024&width=1584&height=972.png", color: "Ochre / Ink" },
    { id: "canne", title: "Canne", type: "Campaign art", description: "A campaign toolkit that turns a single visual idea into a full social and launch system.", image: "framerusercontent.com/images/OfDyPQ9wcOv5yizqmGGiw9p9o_scale-down-to=1024&width=1584&height=972.png", color: "Coral / Cream" },
    { id: "absolute", title: "Absolute.308", type: "Visual system", description: "A sharp, modular visual language for a culture-led brand with a point of view.", image: "framerusercontent.com/images/Qhci2BrqufhycMHG3nlAqebgns4_scale-down-to=1024&width=1440&height=1000.png", color: "Black / Lime" },
    { id: "pump", title: "Pump", type: "Product launch", description: "Product storytelling shaped into a tactile launch world across digital touchpoints.", image: "framerusercontent.com/images/c6quDVvua9PzowsUI2FTZqHHo24_scale-down-to=1024&width=1300&height=1600.png", color: "Red / Sand" },
    { id: "nook", title: "Nook Studios", type: "Digital experience", description: "An ownable digital home for a creative studio that wants every detail to feel intentional.", image: "framerusercontent.com/images/m1QolqibGeJtHxap3FSDYwh2ivw_scale-down-to=1024&width=1320&height=1650.png", color: "Blue / White" },
    { id: "afi", title: "Afi", type: "Campaign art", description: "A human, expressive campaign direction with enough flexibility to keep moving.", image: "framerusercontent.com/images/sHDqYlrZP0VFOdBhKFh6QbWUoL8_scale-down-to=1024&width=1320&height=1650.png", color: "Green / Peach" },
    { id: "kora", title: "Kora", type: "Digital experience", description: "A calm, considered interface system designed to make discovery feel effortless.", image: "framerusercontent.com/images/wi8NZYvAjIouKtG0fGU2wPK8gY_scale-down-to=1024&width=1609&height=1499.png", color: "Cobalt / Sand" },
    { id: "kente", title: "Kente House", type: "Brand identity", description: "A graphic identity rooted in pattern, movement, and a distinctly local visual voice.", image: "framerusercontent.com/images/tidtw9jROlXgTScfw5wbpXENcn8_scale-down-to=1024&width=3000&height=3000.png", color: "Orange / Black" },
    { id: "rover", title: "Rover", type: "Campaign art", description: "A playful visual world for a launch that needed to feel impossible to ignore.", image: "framerusercontent.com/images/y3WMRv29CohMfFM44AXdkRhvKI_scale-down-to=1024&width=2280&height=1698.png", color: "Lavender / Charcoal" },
    { id: "mati", title: "Mati", type: "Brand identity", description: "A quiet, premium system where material, type, and space carry the story.", image: "framerusercontent.com/images/z9y8N989HPjzV0fa23eON6Jqg_scale-down-to=1024&width=1320&height=1650.png", color: "Stone / Moss" },
    { id: "north", title: "North Star", type: "Digital experience", description: "A bold editorial direction that gives a growing product room to be understood.", image: "framerusercontent.com/images/XMzJoUAKtYJ41zpBFjXADNSk1zU_scale-down-to=1024&width=2280&height=1698.png", color: "Navy / Sky" },
    { id: "sway", title: "Sway", type: "Product launch", description: "A flexible launch identity built to move quickly from pitch deck to public release.", image: "framerusercontent.com/images/ossyydzyoDmgd6tBh4JfQnlYdV4_scale-down-to=1024&width=4320&height=2640.png", color: "Yellow / Violet" }
  ];

  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  const isWorksRoute = () => {
    const path = window.location.pathname.replace(/\\/+$/, "") || "/";
    return path === "/works" || path === "/our-works" || /(^|&)works=1(&|$)/.test(window.location.search.slice(1)) || window.location.hash === "#works";
  };

  function cardMarkup(work) {
    return '<button class="works-card" type="button" data-work-id="' + esc(work.id) + '" aria-label="Open ' + esc(work.title) + '">' +
      '<span class="works-card-media"><img src="./' + esc(work.image) + '" alt="' + esc(work.title) + ' project artwork" loading="lazy"><span class="works-card-hover"><span>View project</span><span class="works-arrow">↗</span></span></span>' +
      '<span class="works-card-copy"><strong>' + esc(work.title) + '</strong><small>' + esc(work.type) + '</small></span>' +
      '</button>';
  }

  function renderWorksPage() {
    const style = document.createElement("style");
    style.id = "nook-works-styles";
    style.textContent = [
      ".works-page{--ink:#161616;--muted:#77736d;--paper:#f8f7f3;--line:#e6e2da;--accent:#ff5a3c;min-height:100vh;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}",
      ".works-page *{box-sizing:border-box}.works-page button,.works-page input{font:inherit}.works-page button{cursor:pointer}",
      ".works-topbar{align-items:center;background:rgba(248,247,243,.9);border-bottom:1px solid var(--line);display:flex;gap:24px;justify-content:space-between;padding:18px clamp(20px,4vw,60px);position:sticky;top:0;z-index:10;backdrop-filter:blur(18px)}",
      ".works-brand{color:var(--ink);font-size:15px;font-weight:800;letter-spacing:-.04em;text-decoration:none}.works-brand span{color:var(--accent)}.works-back{color:var(--ink);font-size:13px;font-weight:700;text-decoration:none}.works-back:hover{color:var(--accent)}",
      ".works-intro{margin:0 auto;max-width:1440px;padding:clamp(70px,10vw,140px) clamp(20px,4vw,60px) 44px}.works-kicker{color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}.works-intro h1{font-size:clamp(52px,9vw,132px);letter-spacing:-.085em;line-height:.87;margin:20px 0 28px;max-width:900px}.works-intro p{color:var(--muted);font-size:clamp(16px,2vw,22px);line-height:1.4;margin:0;max-width:530px}",
      ".works-toolbar{align-items:center;border-top:1px solid var(--line);display:flex;gap:16px;justify-content:space-between;margin:0 auto;max-width:1440px;padding:20px clamp(20px,4vw,60px);position:relative}.works-filters{display:flex;flex-wrap:wrap;gap:8px}.works-filter{background:transparent;border:1px solid transparent;border-radius:999px;color:var(--muted);font-size:13px;padding:9px 14px}.works-filter:hover,.works-filter[aria-pressed=true]{background:var(--ink);color:#fff}.works-search{background:transparent;border:1px solid var(--line);border-radius:999px;color:var(--ink);font-size:13px;outline:none;padding:10px 15px;width:190px}.works-search:focus{border-color:var(--ink)}",
      ".works-grid{column-count:4;column-gap:18px;margin:0 auto;max-width:1440px;padding:12px clamp(20px,4vw,60px) 90px}.works-card{background:none;border:0;display:block;margin:0 0 34px;padding:0;text-align:left;width:100%;break-inside:avoid}.works-card-media{background:#e9e5de;border-radius:16px;display:block;overflow:hidden;position:relative}.works-card img{display:block;height:auto;transition:transform .45s cubic-bezier(.2,.7,.2,1);width:100%}.works-card:hover img{transform:scale(1.035)}.works-card-hover{align-items:center;background:rgba(22,22,22,.84);border-radius:999px;color:#fff;display:flex;font-size:12px;font-weight:700;gap:12px;left:18px;opacity:0;padding:11px 14px;position:absolute;top:18px;transform:translateY(6px);transition:.25s ease}.works-card:hover .works-card-hover,.works-card:focus-visible .works-card-hover{opacity:1;transform:translateY(0)}.works-arrow{font-size:17px;line-height:10px}.works-card-copy{display:flex;gap:8px;justify-content:space-between;padding:12px 2px 0}.works-card-copy strong{font-size:14px;letter-spacing:-.02em}.works-card-copy small{color:var(--muted);font-size:11px;text-align:right}",
      ".works-empty{color:var(--muted);font-size:18px;padding:80px 20px;text-align:center}.works-modal[hidden]{display:none}.works-modal{inset:0;position:fixed;z-index:50}.works-modal-backdrop{background:rgba(12,12,12,.72);inset:0;position:absolute}.works-modal-dialog{background:var(--paper);border-radius:22px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);left:50%;max-height:calc(100vh - 40px);max-width:1120px;overflow:auto;position:absolute;top:50%;transform:translate(-50%,-50%);width:calc(100% - 40px)}.works-modal-visual{background:#e9e5de;min-height:520px}.works-modal-visual img{display:block;height:100%;max-height:75vh;object-fit:cover;width:100%}.works-modal-content{display:flex;flex-direction:column;min-width:0;padding:42px 38px 34px}.works-close{align-items:center;background:#fff;border:0;border-radius:50%;display:flex;font-size:24px;height:38px;justify-content:center;line-height:1;position:absolute;right:18px;top:18px;width:38px;z-index:1}.works-modal-type{color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.works-modal-content h2{font-size:clamp(42px,6vw,76px);letter-spacing:-.08em;line-height:.9;margin:18px 0}.works-modal-content p{color:var(--muted);font-size:16px;line-height:1.5;margin:0 0 30px;max-width:390px}.works-meta{border-bottom:1px solid var(--line);border-top:1px solid var(--line);display:grid;gap:14px;grid-template-columns:1fr 1fr;margin-bottom:22px;padding:16px 0}.works-meta small{color:var(--muted);display:block;font-size:10px;margin-bottom:4px;text-transform:uppercase}.works-meta strong{font-size:13px}.works-save{align-items:center;background:var(--ink);border:0;border-radius:999px;color:#fff;display:flex;font-size:13px;font-weight:700;gap:8px;justify-content:center;padding:14px 18px}.works-save:hover{background:var(--accent)}.works-share{color:var(--muted);font-size:12px;margin-top:14px;text-align:center}.works-related{border-top:1px solid var(--line);margin-top:auto;padding-top:28px}.works-related h3{font-size:18px;letter-spacing:-.04em;margin:0 0 16px}.works-related-grid{column-count:2;column-gap:12px}.works-related-grid .works-card{margin-bottom:18px}.works-related-grid .works-card-copy{display:none}.works-related-grid .works-card-hover{display:none}.works-related-grid .works-card-media{border-radius:10px}.works-modal-open{overflow:hidden}",
      "@media(max-width:980px){.works-grid{column-count:3}.works-modal-dialog{grid-template-columns:1fr}.works-modal-visual img{max-height:46vh}.works-modal-content{padding-top:34px}.works-related-grid{column-count:3}}",
      "@media(max-width:640px){.works-topbar{padding:16px 20px}.works-back{font-size:12px}.works-intro{padding-top:72px}.works-intro h1{font-size:62px}.works-toolbar{align-items:flex-start;flex-direction:column}.works-search{width:100%}.works-grid{column-count:2;column-gap:12px;padding-left:14px;padding-right:14px}.works-card{margin-bottom:22px}.works-card-copy{display:block}.works-card-copy small{display:block;margin-top:4px;text-align:left}.works-modal-dialog{border-radius:16px;max-height:calc(100vh - 20px);width:calc(100% - 20px)}.works-modal-content{padding:30px 22px 24px}.works-related-grid{column-count:2}}",
      "@media(max-width:400px){.works-grid{column-count:1}.works-intro h1{font-size:56px}}"
    ].join("\\n");
    document.head.appendChild(style);
    document.body.innerHTML = [
      '<div class="works-page">',
      '<header class="works-topbar"><a class="works-brand" href="/"><span>●</span> Nook Studios</a><a class="works-back" href="/">Back to studio ↗</a></header>',
      '<section class="works-intro"><div class="works-kicker">Selected work / 2026</div><h1>Ideas worth<br>saving.</h1><p>A visual index of identities, digital worlds, and campaigns made to stay with you.</p></section>',
      '<section class="works-toolbar"><div class="works-filters" aria-label="Filter projects"><button class="works-filter" type="button" data-filter="All" aria-pressed="true">All work</button><button class="works-filter" type="button" data-filter="Brand identity" aria-pressed="false">Brand identity</button><button class="works-filter" type="button" data-filter="Digital experience" aria-pressed="false">Digital</button><button class="works-filter" type="button" data-filter="Campaign art" aria-pressed="false">Campaigns</button></div><input class="works-search" id="works-search" type="search" placeholder="Search projects" aria-label="Search projects"></section>',
      '<main class="works-grid" id="works-grid" aria-live="polite"></main>',
      '<div class="works-modal" id="works-modal" hidden></div>',
      '</div>'
    ].join("");

    let activeFilter = "All";
    let activeWork = null;
    const grid = document.getElementById("works-grid");
    const modal = document.getElementById("works-modal");

    function filteredWorks() {
      const query = (document.getElementById("works-search").value || "").trim().toLowerCase();
      return WORKS.filter((work) => (activeFilter === "All" || work.type === activeFilter) && (!query || (work.title + " " + work.type + " " + work.description).toLowerCase().includes(query)));
    }

    function renderGrid() {
      const visible = filteredWorks();
      grid.innerHTML = visible.length ? visible.map(cardMarkup).join("") : '<div class="works-empty">No projects match that search yet.</div>';
    }

    function renderModal() {
      if (!activeWork) return;
      const related = WORKS.filter((work) => work.id !== activeWork.id && (work.type === activeWork.type || activeWork.type === "Brand identity")).slice(0, 4);
      let saved = false;
      try { saved = JSON.parse(localStorage.getItem("nook-saved-works") || "[]").includes(activeWork.id); } catch (error) {}
      modal.innerHTML = '<div class="works-modal-backdrop" data-close="true"></div>' +
        '<div class="works-modal-dialog" role="dialog" aria-modal="true" aria-label="' + esc(activeWork.title) + '">' +
        '<button class="works-close" type="button" data-close="true" aria-label="Close project">×</button>' +
        '<div class="works-modal-visual"><img src="./' + esc(activeWork.image) + '" alt="' + esc(activeWork.title) + ' project artwork"></div>' +
        '<div class="works-modal-content"><div class="works-modal-type">' + esc(activeWork.type) + '</div><h2>' + esc(activeWork.title) + '</h2><p>' + esc(activeWork.description) + '</p>' +
        '<div class="works-meta"><div><small>Palette</small><strong>' + esc(activeWork.color) + '</strong></div><div><small>Studio</small><strong>Nook Studios</strong></div></div>' +
        '<button class="works-save" type="button" data-save="true">' + (saved ? "✓ Saved to your collection" : "＋ Save project") + '</button><div class="works-share">Tap any suggestion below to keep exploring.</div>' +
        '<div class="works-related"><h3>More like this</h3><div class="works-related-grid">' + related.map(cardMarkup).join("") + '</div></div></div></div>';
      modal.hidden = false;
      document.body.classList.add("works-modal-open");
    }

    function openWork(id) {
      activeWork = WORKS.find((work) => work.id === id) || WORKS[0];
      renderModal();
    }

    function closeWork() {
      modal.hidden = true;
      modal.innerHTML = "";
      activeWork = null;
      document.body.classList.remove("works-modal-open");
    }

    document.addEventListener("click", (event) => {
      const filter = event.target.closest("[data-filter]");
      if (filter) {
        activeFilter = filter.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === filter)));
        renderGrid();
        return;
      }
      const close = event.target.closest("[data-close]");
      if (close) { closeWork(); return; }
      const save = event.target.closest("[data-save]");
      if (save && activeWork) {
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem("nook-saved-works") || "[]"); } catch (error) {}
        saved = saved.includes(activeWork.id) ? saved.filter((id) => id !== activeWork.id) : saved.concat(activeWork.id);
        localStorage.setItem("nook-saved-works", JSON.stringify(saved));
        renderModal();
        return;
      }
      const card = event.target.closest(".works-card");
      if (card) openWork(card.dataset.workId);
    });
    document.getElementById("works-search").addEventListener("input", renderGrid);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && activeWork) closeWork(); });
    renderGrid();
  }

  function wireWorksLinks(root) {
    root.querySelectorAll("a").forEach((link) => {
      const label = (link.textContent || "").replace(/\\s+/g, " ").trim();
      if (/\\b(?:see|view|our) works\\b/i.test(label)) {
        link.setAttribute("href", "/our-works");
      }
    });
  }

  function startWorksExperience() {
    if (isWorksRoute()) {
      renderWorksPage();
    } else {
      wireWorksLinks(document);
      const observer = new MutationObserver(() => wireWorksLinks(document));
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWorksExperience, { once: true });
  else startWorksExperience();
})();
