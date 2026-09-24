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

  function findAboutHeading(pattern) {
    return [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, [data-framer-name]")].find((element) => {
      const text = element.textContent.trim();
      return text.length < 160 && pattern.test(text);
    });
  }

  function hideAboutSection(pattern) {
    const heading = findAboutHeading(pattern);
    if (!heading) return;
    let section = heading;
    for (let i = 0; i < 6 && section.parentElement && section.parentElement !== document.body; i += 1) {
      const parent = section.parentElement;
      if (parent.textContent.length > 6500) break;
      section = parent;
    }
    section.style.display = "none";
  }

  function removeAboutGallery() {
    if (!/about/i.test(window.location.pathname)) return;
    const mission = [...document.querySelectorAll("body *")].find((element) =>
      /^our\s+mission$/i.test(element.textContent.trim())
    );
    const creative = findAboutHeading(/our\s+creative\s+team/i);
    if (!mission || !creative) return;
    const images = [...document.querySelectorAll("img")];
    let started = false;
    images.forEach((image) => {
      if (!started) {
        const position = mission.compareDocumentPosition(image);
        started = Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
      }
      if (!started || creative.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING) return;
      const card = image.closest('[data-framer-name="Image Wrapper"]')?.parentElement || image.parentElement;
      if (card) card.style.display = "none";
    });
  }

  function renderAboutTeam() {
    if (!/about/i.test(window.location.pathname) || document.querySelector(".nook-team-grid")) return;
    const heading = findAboutHeading(/our\s+(creative\s+)?team/i);
    if (!heading) return;
    let afterHeading = false;
    let hidden = 0;
    document.querySelectorAll("img").forEach((image) => {
      if (!afterHeading) {
        afterHeading = Boolean(heading.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING);
      }
      if (!afterHeading || hidden >= TEAM_MEMBERS.length || image.closest(".nook-team-grid")) return;
      const card = image.closest('[data-framer-name="Card"]') || image.parentElement;
      if (card) card.style.display = "none";
      hidden += 1;
    });
    const grid = document.createElement("div");
    grid.className = "nook-team-grid";
    grid.innerHTML = TEAM_MEMBERS.map(
      ([src, name, title]) =>
        `<article class="nook-team-card"><img src="${src}" loading="lazy" decoding="async" alt="${name}"><h3>${name}</h3><p>${title}</p></article>`
    ).join("");
    const style = document.createElement("style");
    style.textContent =
      ".nook-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:40px 0}.nook-team-card{overflow:hidden;border-radius:16px;background:#fff}.nook-team-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}.nook-team-card h3,.nook-team-card p{margin:12px 16px 0}.nook-team-card p{margin-bottom:16px;color:#667085}@media(max-width:800px){.nook-team-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}@media(max-width:520px){.nook-team-grid{grid-template-columns:1fr}}";
    document.head.appendChild(style);
    heading.parentElement?.appendChild(grid);
  }

  function updateAboutSections() {
    // Keep the About route intact until its actual section wrappers are known.
    // Broad ancestor hiding can hide the entire Framer page container.
    rewriteSplitBranding();
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