(function () {
  "use strict";

  var CONTENT_URL = "/api/cms/content";
  var esc = function (value) {
    return String(value == null ? "" : value).replace(/["\\]/g, "\\$&");
  };

  function setText(node, value) {
    if (!node || value == null) return;
    var target = node.querySelector("h1,h2,h3,h4,h5,h6,p,span,a") || node;
    target.textContent = value;
  }

  function nodesByName(name) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-framer-name="' + esc(name) + '"]'));
  }

  function updateNamed(name, value, all) {
    nodesByName(name).slice(all ? 0 : 0, all ? undefined : 1).forEach(function (node) {
      setText(node, value);
    });
  }

  function updateExact(oldValue, newValue, all) {
    if (!oldValue || newValue == null || oldValue === newValue) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    var matches = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.children.length === 0 && node.textContent.trim() === oldValue) matches.push(node);
    }
    matches.slice(0, all ? undefined : 1).forEach(function (item) {
      item.textContent = newValue;
    });
  }

  function applySite(site) {
    if (!site) return;
    var root = document.documentElement;
    var values = {
      "--cms-primary": site.primaryColor,
      "--cms-secondary": site.secondaryColor,
      "--cms-accent": site.accentColor,
      "--cms-background": site.backgroundColor,
      "--cms-text": site.textColor
    };
    Object.keys(values).forEach(function (key) {
      if (values[key]) root.style.setProperty(key, values[key]);
    });
    if (site.headingFont) root.style.setProperty("--cms-heading-font", site.headingFont);
    if (site.bodyFont) root.style.setProperty("--cms-body-font", site.bodyFont);
    if (site.bodyFontSize) root.style.setProperty("--cms-body-size", site.bodyFontSize);
    if (site.headingFontSize) root.style.setProperty("--cms-heading-size", site.headingFontSize);
    if (site.favicon) {
      var favicon = document.querySelector('link[rel="icon"]') || document.createElement("link");
      favicon.rel = "icon";
      favicon.href = site.favicon;
      document.head.appendChild(favicon);
    }
    if (site.logo) {
      document.querySelectorAll("img").forEach(function (img) {
        var alt = (img.getAttribute("alt") || "").toLowerCase();
        var name = (img.getAttribute("data-framer-name") || "").toLowerCase();
        if (alt.indexOf("logo") !== -1 || name.indexOf("logo") !== -1) img.src = site.logo;
      });
    }
  }

  function applyContent(content) {
    var home = content.pages && content.pages.home;
    var hero = home && home.hero;
    if (hero) {
      updateNamed("#1 Popular digital marketing agency", hero.eyebrow);
      updateExact("#1 Popular digital marketing agency", hero.eyebrow, true);
      updateExact("With a combined years of experience, our team is passionate about helping businesses grow.", hero.paragraph, true);
      updateExact("Book a Call", hero.primaryButtonText, true);
      updateExact("See Our Works", hero.secondaryButtonText, true);
    }

    (content.works || []).slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    }).filter(function (item) { return item.published !== false; }).forEach(function (item) {
      updateNamed(item.title, item.title, true);
      updateExact(item.title, item.title, true);
      updateExact(item.category, item.category, true);
    });

    (content.services || []).slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    }).filter(function (item) { return item.published !== false; }).forEach(function (item) {
      updateNamed(item.title, item.title, true);
      updateExact(item.title, item.title, true);
      if (item.description) updateExact(item.description, item.description, true);
    });

    (content.process || []).slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    }).filter(function (item) { return item.published !== false; }).forEach(function (item) {
      updateNamed(item.title, item.title, true);
      updateExact(item.title, item.title, true);
      if (item.description) updateExact(item.description, item.description, true);
    });

    (content.testimonials || []).filter(function (item) { return item.published !== false; }).forEach(function (item) {
      updateNamed(item.name, item.name, true);
      updateExact(item.name, item.name, true);
      if (item.role) updateExact(item.role, item.role, true);
      if (item.quote) updateExact("Super experience", item.quote, true);
    });

    if (home && home.about) {
      updateExact("10+ Strategic Growth Partners in Marketing", home.about.heading, true);
      updateExact("We believe that the best user experiences are intuitive, beautiful and a joy to use. These principles are reflected in our work through an instinctual approach to design, and a meticulous attention to detail.", home.about.paragraph, true);
    }
    if (content.pages && content.pages.insights) {
      updateExact("Latest Articles", content.pages.insights.heading, true);
      updateExact("At Nook Studios, we're more than just a design agency—we're your creative companions on the journey to design excellence.", content.pages.insights.paragraph, true);
    }
    if (home && home.contact) {
      updateExact("Want to Discuss A Project", home.contact.heading, true);
      updateExact("Let’s_Talk", home.contact.buttonText, true);
    }
  }

  function load() {
    fetch(CONTENT_URL + "?t=" + Date.now(), { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("CMS content unavailable");
        return response.json();
      })
      .then(function (content) {
        applySite(content.site);
        applyContent(content);
        document.documentElement.setAttribute("data-cms-ready", "true");
        window.dispatchEvent(new CustomEvent("cms:ready", { detail: content }));
      })
      .catch(function (error) {
        document.documentElement.setAttribute("data-cms-error", error.message);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();