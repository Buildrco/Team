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

  function updateAboutImages() {
    if (!/about/i.test(window.location.pathname)) return;
    const mission = [...document.querySelectorAll("body *")].find((element) =>
      /^our\s+mission$/i.test(element.textContent.trim())
    );
    if (!mission) return;

    const images = [...document.querySelectorAll("img")];
    let started = false;
    let replaced = 0;
    images.forEach((image) => {
      if (!started) {
        const position = mission.compareDocumentPosition(image);
        started = Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
      }
      if (!started || replaced >= ABOUT_IMAGES.length) return;
      image.src = ABOUT_IMAGES[replaced];
      image.removeAttribute("srcset");
      image.loading = "lazy";
      image.decoding = "async";
      replaced += 1;
    });
  }

  function scrub(root = document) {
    rewriteTextNodes(root);
    root.querySelectorAll?.("*").forEach((element) => {
      ["href", "src", "srcset", "alt", "title", "aria-label", "data-framer-name"].forEach((name) =>
        rewriteAttribute(element, name)
      );
    });
    optimizeImages();
    updateSocials();
    updateMapEmbeds();
    updateAboutImages();
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
      updateAboutImages();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();