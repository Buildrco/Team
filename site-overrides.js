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

  function createLogoMarquee() {
    const marquee = document.createElement("div");
    marquee.className = "nook-logo-marquee";
    marquee.setAttribute("aria-label", "Nook Studios services");
    const labels = ["BRANDING", "SEO", "CONTENT", "DIGITAL REACH", "WEB DESIGN", "STRATEGY"];
    marquee.innerHTML = `<div class="nook-logo-track">${labels.concat(labels).map((label) => `<span>${label}<b>✦</b></span>`).join("")}</div>`;
    return marquee;
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
    section.appendChild(createLogoMarquee());
    const grid = document.createElement("div");
    grid.className = "nook-team-grid";
    grid.innerHTML = TEAM_MEMBERS.map(
      ([src, name, title]) =>
        `<article class="nook-team-card"><img src="${src}" loading="lazy" decoding="async" alt="${name}"><h3>${name}</h3><p>${title}</p></article>`
    ).join("");
    section.appendChild(grid);

    const style = document.createElement("style");
    style.textContent =
      ".nook-about-team-section{width:min(1120px,calc(100% - 48px));margin:56px auto 80px}.nook-about-team-heading h2{margin:0;font-size:clamp(32px,5vw,64px);line-height:1.05}.nook-about-team-heading p{margin:16px 0 0;max-width:620px;font-size:18px;line-height:1.5}.nook-logo-marquee{overflow:hidden;width:100%;margin:46px 0 42px;border-top:1px solid currentColor;border-bottom:1px solid currentColor;padding:18px 0}.nook-logo-track{display:flex;width:max-content;animation:nook-logo-scroll 26s linear infinite}.nook-logo-track span{display:flex;align-items:center;gap:28px;margin-right:28px;white-space:nowrap;font-size:14px;letter-spacing:.16em;font-weight:700}.nook-logo-track b{font-size:20px;font-weight:400}@keyframes nook-logo-scroll{to{transform:translateX(-50%)}}.nook-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.nook-team-card{overflow:hidden;border-radius:16px;background:#fff}.nook-team-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}.nook-team-card h3,.nook-team-card p{margin:12px 16px 0}.nook-team-card p{margin-bottom:16px;color:#667085}@media(max-width:800px){.nook-about-team-section{width:min(100% - 32px,620px)}.nook-team-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}@media(max-width:520px){.nook-team-grid{grid-template-columns:1fr}}";
    document.head.appendChild(style);
    oldTeamBlock.parentElement.insertBefore(section, oldTeamBlock);
  }

  function updateAboutSections() {
    if (!/about/i.test(window.location.pathname)) return;
    removeAboutGallery();
    hideAboutMarker(/awards?\s*(and|&)?\s*recognition/i);
    hideAboutMarker(/find\s+us\s+nearby/i);
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
  }

  const start = () => {
    scrub();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scrub(node);
        });
      });
      updateSocials();
      updateAboutSections();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();