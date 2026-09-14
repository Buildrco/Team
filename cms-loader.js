(function () {
  "use strict";

  var CONTENT_URL = "/api/cms/content";
  var root = document.documentElement;
  var escSelector = function (value) { return String(value == null ? "" : value).replace(/["\\]/g, "\\$&"); };
  function text(value) { return value == null ? "" : String(value); }
  function imageUrl(value) {
    var url = text(value).trim();
    if (!url) return "";
    if (url.indexOf("./") === 0) return "/" + url.slice(2);
    return url;
  }
  function nodesByName(name, scope) {
    if (!name) return [];
    try { return Array.prototype.slice.call((scope || document).querySelectorAll('[data-framer-name="' + escSelector(name) + '"]')); } catch (_) { return []; }
  }
  function leafNodes(scope) {
    var target = scope || document;
    var nodes = scope ? target.querySelectorAll("*") : document.querySelectorAll("body *");
    return Array.prototype.slice.call(nodes).filter(function (node) { return node.children.length === 0 && text(node.textContent).trim(); });
  }
  function setText(node, value) {
    if (!node || value == null) return;
    var target = node.querySelector("h1,h2,h3,h4,h5,h6,p,span,a,button") || node;
    target.textContent = text(value);
  }
  function findText(value, scope) {
    var expected = text(value).trim();
    if (!expected) return [];
    return leafNodes(scope).filter(function (node) { return text(node.textContent).trim() === expected; });
  }
  function updateExact(oldValue, newValue, all) {
    var previous = text(oldValue).trim();
    if (!previous || newValue == null || previous === text(newValue)) return;
    findText(previous).slice(0, all ? undefined : 1).forEach(function (node) { node.textContent = text(newValue); });
  }
  function updateNamed(name, value, all) {
    nodesByName(name).slice(0, all ? undefined : 1).forEach(function (node) { setText(node, value); });
  }
  function updateNamedWithin(scopeName, name, value, all) {
    nodesByName(scopeName).forEach(function (scope) { nodesByName(name, scope).slice(0, all ? undefined : 1).forEach(function (node) { setText(node, value); }); });
  }
  function closestWithImage(node) {
    var current = node;
    for (var i = 0; current && i < 7; i += 1, current = current.parentElement) {
      var image = current.querySelector && current.querySelector("img");
      if (image) return { container: current, image: image };
    }
    return null;
  }
  function setImage(image, value, alt) {
    if (!image || !value) return;
    var url = imageUrl(value);
    image.src = url;
    image.removeAttribute("srcset");
    image.setAttribute("data-cms-src", url);
    if (alt != null) image.alt = text(alt);
  }
  function imageKey(value) {
    var url = imageUrl(value);
    try { return decodeURIComponent(url); } catch (_) { return url; }
  }
  function findImage(sourceImage, scope) {
    var wanted = imageKey(sourceImage);
    if (!wanted) return null;
    var images = Array.prototype.slice.call((scope || document).querySelectorAll("img"));
    var existing = images.find(function (img) { return imageKey(img.getAttribute("src") || "") === wanted || imageKey(img.currentSrc || "") === wanted; });
    return existing ? { container: existing.parentElement, image: existing } : null;
  }
  function imageForText(value, sourceImage, alt, referenceImage, scope) {
    var candidates = findText(value, scope);
    var match = null;
    candidates.some(function (node) { match = closestWithImage(node); return Boolean(match); });
    if (!match && referenceImage) match = findImage(referenceImage, scope);
    if (!match && sourceImage) match = findImage(sourceImage, scope);
    if (match) setImage(match.image, sourceImage, alt);
    return match;
  }
  function styleForSection(sectionName, style) {
    if (!sectionName || !style) return;
    var names = [sectionName, sectionName + " Section"];
    if (/hero/i.test(sectionName)) names.push("Hero Section");
    var targets = [];
    names.forEach(function (name) { nodesByName(name).forEach(function (node) { if (targets.indexOf(node) === -1) targets.push(node); }); });
    targets.forEach(function (target) {
      if (style.textColor) target.style.color = style.textColor;
      if (style.backgroundColor) target.style.backgroundColor = style.backgroundColor;
      if (style.fontFamily) target.style.fontFamily = style.fontFamily;
      if (style.fontSize) target.style.fontSize = style.fontSize;
      if (style.fontWeight) target.style.fontWeight = style.fontWeight;
      if (style.lineHeight) target.style.lineHeight = style.lineHeight;
      if (style.letterSpacing) target.style.letterSpacing = style.letterSpacing;
      if (style.alignment) target.style.textAlign = style.alignment;
    });
  }
  function imageForSection(sectionName, sourceImage, alt) {
    if (!sectionName || !sourceImage) return null;
    var names = [sectionName, sectionName + " Section"];
    if (/hero/i.test(sectionName)) names.push("Hero Section");
    for (var n = 0; n < names.length; n += 1) {
      var containers = nodesByName(names[n]);
      for (var i = 0; i < containers.length; i += 1) {
        var images = containers[i].querySelectorAll("img");
        if (images.length) { var image = images[images.length - 1]; setImage(image, sourceImage, alt); return { container: image.parentElement, image: image }; }
      }
    }
    return null;
  }
  function hideForText(value, hidden) {
    findText(value).forEach(function (node) {
      var match = closestWithImage(node);
      var target = match ? match.container : node;
      if (target && target !== document.body) target.style.display = hidden ? "none" : "";
    });
  }
  function styleForText(value, style) {
    if (!style) return;
    findText(value).forEach(function (node) {
      var target = node;
      if (style.textColor) target.style.color = style.textColor;
      if (style.backgroundColor) target.style.backgroundColor = style.backgroundColor;
      if (style.fontFamily) target.style.fontFamily = style.fontFamily;
      if (style.fontSize) target.style.fontSize = style.fontSize;
      if (style.fontWeight) target.style.fontWeight = style.fontWeight;
      if (style.lineHeight) target.style.lineHeight = style.lineHeight;
      if (style.letterSpacing) target.style.letterSpacing = style.letterSpacing;
      if (style.alignment) target.style.textAlign = style.alignment;
    });
  }
  function applyFavicon(url) {
    if (!url) return;
    var favicon = document.querySelector('link[rel="icon"]') || document.createElement("link");
    favicon.rel = "icon";
    favicon.href = imageUrl(url);
    if (!favicon.parentNode) document.head.appendChild(favicon);
  }
  function applySite(site) {
    if (!site) return;
    var values = { "--cms-primary": site.primaryColor, "--cms-secondary": site.secondaryColor, "--cms-accent": site.accentColor, "--cms-background": site.backgroundColor, "--cms-text": site.textColor, "--cms-heading-font": site.headingFont, "--cms-body-font": site.bodyFont, "--cms-body-size": site.bodyFontSize, "--cms-heading-size": site.headingFontSize };
    Object.keys(values).forEach(function (key) { if (values[key]) root.style.setProperty(key, values[key]); });
    applyFavicon(site.favicon);
    if (site.logo) {
      Array.prototype.slice.call(document.querySelectorAll("img")).filter(function (img) {
        var alt = text(img.alt).toLowerCase();
        var name = text(img.getAttribute("data-framer-name")).toLowerCase();
        return alt.indexOf("logo") !== -1 || name.indexOf("logo") !== -1;
      }).forEach(function (img) { setImage(img, site.logo, site.name || img.alt); });
    }
  }
  function applyMotion(oldValue, newValue, block) {
    var animation = text(block && block.animation).toLowerCase();
    var targets = findText(newValue).concat(findText(oldValue)).filter(function (node, index, list) { return list.indexOf(node) === index; });
    if (!targets.length || !animation || animation === "none") return;
    targets.forEach(function (node) {
      var target = node;
      target.setAttribute("data-cms-motion", animation);
      target.style.transition = "transform .28s ease, opacity .28s ease";
      if (animation === "fade") target.style.opacity = "0";
      if (animation === "slide-up") target.style.transform = "translateY(12px)";
      if (animation === "scale") target.style.transform = "scale(.97)";
      window.requestAnimationFrame(function () { target.style.opacity = "1"; target.style.transform = "none"; });
      if (animation === "tap" || block.tapLink) {
        target.style.cursor = "pointer";
        if (!target.getAttribute("data-cms-tap-bound")) {
          target.setAttribute("data-cms-tap-bound", "true");
          target.addEventListener("pointerdown", function () { target.style.transform = "scale(.97)"; });
          target.addEventListener("pointerup", function () { target.style.transform = "scale(1)"; });
          target.addEventListener("pointerleave", function () { target.style.transform = "scale(1)"; });
          if (block.tapLink) target.addEventListener("click", function () { window.location.href = block.tapLink; });
        }
      }
    });
  }
  function applyBlock(block, sectionTitle) {
    if (!block || block.visible === false) {
      if (block && block.sourceText) hideForText(block.sourceText, true);
      return;
    }
    var value = block.value != null ? block.value : block.text;
    if (value == null) value = block.content;
    var oldValue = block.sourceText || block.previousValue || value;
    if (block.name) updateNamed(block.name, value, true);
    updateExact(oldValue, value, true);
    if (block.image || block.type === "image") {
      var nextImage = block.image || block.value;
      var referenceImage = block.sourceImage || (/^(https?:|\/|\.\/)/.test(text(block.sourceText)) ? block.sourceText : "");
      var imageMatch = imageForText(block.sourceText || block.label || "", nextImage, block.alt, referenceImage);
      if (!imageMatch && !referenceImage) imageForSection(sectionTitle, nextImage, block.alt);
    }
    styleForText(value, block.style);
    if (block.link) {
      findText(value).forEach(function (node) { if (node.tagName === "A" || node.querySelector("a")) (node.tagName === "A" ? node : node.querySelector("a")).href = block.link; });
    }
    applyMotion(oldValue, value, block);
  }
  function applyPage(page) {
    if (!page) return;
    (page.sections || []).forEach(function (section) {
      if (section.visible === false) {
        (section.blocks || []).forEach(function (block) { if (block.sourceText) hideForText(block.sourceText, true); });
        return;
      }
      styleForSection(section.title, section.style);
      (section.blocks || []).forEach(function (block) { applyBlock(block, section.title); });
      if (section.image) imageForText(section.sourceText || section.title, section.image, section.alt, section.sourceImage) || imageForSection(section.title, section.image, section.alt);
    });
    if (page.hero) {
      updateExact("#1 Popular digital marketing agency", page.hero.eyebrow, true);
      updateNamedWithin("Hero Section", "Title", page.hero.heading, true);
      updateExact("We build brands that win.", page.hero.heading, true);
      updateExact("With a combined years of experience, our team is passionate about helping businesses grow.", page.hero.paragraph, true);
      updateExact("Book a Call", page.hero.primaryButtonText, true);
      updateExact("See Our Works", page.hero.secondaryButtonText, true);
      if (page.hero.image) imageForText("We build brands that win.", page.hero.image, page.hero.imageAlt, page.hero.sourceImage) || imageForSection("Hero Section", page.hero.image, page.hero.imageAlt);
    }
    if (page.about) {
      updateExact("10+ Strategic Growth Partners in Marketing", page.about.heading, true);
      updateExact("We believe that the best user experiences are intuitive, beautiful and a joy to use. These principles are reflected in our work through an instinctual approach to design, and a meticulous attention to detail.", page.about.paragraph, true);
      updateExact("More About Us", page.about.buttonText, true);
    }
    if (page.contact) {
      updateExact("Want to Discuss A Project", page.contact.heading, true);
      updateExact("Let’s Talk", page.contact.buttonText, true);
    }
    if (page.heading) updateExact(page.sourceHeading || page.heading, page.heading, true);
    if (page.paragraph) updateExact(page.sourceParagraph || page.paragraph, page.paragraph, true);
  }
  function applyCollection(items, fields) {
    (items || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).filter(function (item) { return item.published !== false; }).forEach(function (item) {
      var label = item.title || item.name || item.question || "";
      var match = imageForText(item.sourceTitle || label, item[fields.image], item.imageAlt || item.alt);
      updateExact(item.sourceTitle || label, label, true);
      if (item.category) updateExact(item.sourceCategory || item.category, item.category, true);
      if (item.description) updateExact(item.sourceDescription || item.description, item.description, true);
      if (item.role) updateExact(item.sourceRole || item.role, item.role, true);
      if (item.quote) updateExact(item.sourceQuote || "Super experience", item.quote, true);
      if (item.question) updateExact(item.sourceQuestion || item.question, item.question, true);
      if (item.answer) updateExact(item.sourceAnswer || item.answer, item.answer, true);
      if (!match && item[fields.image]) imageForText(label, item[fields.image], item.imageAlt || item.alt);
    });
  }
  function applyContent(content) {
    applySite(content.site);
    var pages = content.pages || {};
    Object.keys(pages).forEach(function (key) { applyPage(pages[key]); });
    applyCollection(content.works, { image: "coverImage" });
    applyCollection(content.testimonials, { image: "clientPhoto" });
    applyCollection(content.services, { image: "icon" });
    applyCollection(content.process, { image: "image" });
    applyCollection(content.articles, { image: "coverImage" });
    applyCollection(content.faq, { image: "image" });
    root.setAttribute("data-cms-ready", "true");
    window.dispatchEvent(new CustomEvent("cms:ready", { detail: content }));
  }
  function load() {
    fetch(CONTENT_URL + "?t=" + Date.now(), { credentials: "same-origin", cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("CMS content unavailable");
      return response.json();
    }).then(applyContent).catch(function (error) { root.setAttribute("data-cms-error", error.message); });
  }
  function boot() { load(); window.setTimeout(load, 350); window.setTimeout(load, 1400); window.setTimeout(load, 3000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
