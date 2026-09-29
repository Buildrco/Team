(() => {
  "use strict";

  const WORK_NAMES = ["Bajindu", "Pump", "Canne", "Absolute.308", "Cuppa"];
  const WORK_PATHS = new Set([
    "/works/bajindu",
    "/works/pump",
    "/works/canne",
    "/works/absolute.308",
    "/works/cuppa-cuppa"
  ]);
  let cards = [];
  let viewer;
  let active = -1;

  const normal = (value) => String(value || "").split(" ").filter(Boolean).join(" ").trim();
  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const findName = (value) => {
    const text = normal(value).toLowerCase();
    return WORK_NAMES.find((name) => text.includes(name.toLowerCase())) || "";
  };
  const worksRoute = () =>
    ["/works", "/our-works"].includes(window.location.pathname.replace(/\/+$/, "") || "/");

  function isWorkLink(link) {
    if (!link?.href) return false;
    const path = new URL(link.href, window.location.href).pathname.replace(/\/+$/, "").toLowerCase();
    return WORK_PATHS.has(path);
  }

  function getWorkLink(image) {
    const link = image.closest("a[href]");
    return isWorkLink(link) ? link : null;
  }

  function isWorkImage(image) {
    return Boolean(getWorkLink(image));
  }

  function getCard(image) {
    return getWorkLink(image);
  }

  function getGallery(nextCards) {
    let node = nextCards[0]?.parentElement;
    while (node && node !== document.body) {
      const workLinks = [...node.querySelectorAll("a[href]")].filter(isWorkLink);
      if (workLinks.length === nextCards.length && nextCards.every((card) => node.contains(card))) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function addStyles() {
    if (document.getElementById("nook-works-only-styles")) return;
    const style = document.createElement("style");
    style.id = "nook-works-only-styles";
    style.textContent = [
      ".nook-works-grid{display:block!important;column-count:2!important;column-gap:clamp(10px,2vw,24px)!important;width:100%!important}",
      ".nook-works-grid>*{break-inside:avoid!important;display:block!important;min-width:0!important;width:100%!important;margin:0 0 clamp(10px,2vw,24px)!important}",
      ".nook-works-card{break-inside:avoid!important;display:block!important;height:auto!important;min-height:0!important;min-width:0!important;width:100%!important;aspect-ratio:auto!important;transition:transform .35s cubic-bezier(.2,.7,.2,1),filter .35s ease;animation:nookWorksReveal .6s both;animation-delay:calc(var(--nook-card-order,0)*70ms)}",
      ".nook-works-card>div:first-child,.nook-works-card>div:first-child>div{height:auto!important;min-height:0!important;width:100%!important;aspect-ratio:auto!important}",
      ".nook-works-card [data-framer-background-image-wrapper]{height:auto!important;inset:auto!important;position:relative!important;width:100%!important}",
      ".nook-works-card:hover{filter:brightness(1.03);transform:translateY(-4px)}.nook-works-card img{display:block!important;height:auto!important;max-width:100%!important;transition:transform .45s cubic-bezier(.2,.7,.2,1)!important;width:100%!important}.nook-works-card:hover img{transform:scale(1.03)}",
      "@keyframes nookWorksReveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}",
      ".nook-works-viewer[hidden]{display:none}.nook-works-viewer{inset:0;position:fixed;z-index:2147483000}.nook-works-backdrop{background:rgba(5,20,34,.78);inset:0;position:absolute}.nook-works-dialog{background:#fff;border-radius:20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.9fr);left:50%;max-height:calc(100vh - 32px);max-width:1040px;overflow:auto;position:absolute;top:50%;transform:translate(-50%,-50%);width:calc(100% - 32px);animation:nookWorksDialogIn .3s ease}.nook-works-dialog>img{background:#edf0f2;display:block;height:100%;max-height:75vh;min-height:360px;object-fit:cover;width:100%}.nook-works-copy{color:#071b2d;padding:38px 30px}.nook-works-copy small{color:#d0b91f;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.nook-works-copy h2{font-size:clamp(34px,5vw,62px);letter-spacing:-.07em;line-height:.9;margin:16px 0}.nook-works-copy p{color:#68737b;line-height:1.5;margin:0 0 24px}.nook-works-close{background:#fff;border:0;border-radius:50%;font-size:25px;height:38px;position:absolute;right:14px;top:14px;width:38px;z-index:2}.nook-works-related{border-top:1px solid #e5e9eb;padding-top:18px}.nook-works-related h3{font-size:17px;margin:0 0 12px}.nook-works-related-grid{display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}.nook-works-related-card{background:none;border:0;padding:0;text-align:left}.nook-works-related-card img{border-radius:8px;display:block;height:82px;object-fit:cover;width:100%}.nook-works-related-card span{color:#68737b;display:block;font-size:11px;margin-top:5px}.nook-works-open{overflow:hidden}@keyframes nookWorksDialogIn{from{opacity:0;transform:translate(-50%,-47%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}",
      "@media(max-width:680px){.nook-works-grid{column-gap:10px!important}.nook-works-grid>*{margin-bottom:10px!important}.nook-works-dialog{display:block;max-height:calc(100vh - 16px);width:calc(100% - 16px)}.nook-works-dialog>img{max-height:42vh;min-height:0}.nook-works-copy{padding:25px 20px 22px}.nook-works-related-card img{height:100px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function titleFor(card, index) {
    return findName(card.textContent) || normal(card.querySelector("img")?.alt) || "Selected work " + (index + 1);
  }

  function closeViewer() {
    if (!viewer) return;
    viewer.hidden = true;
    viewer.innerHTML = "";
    document.body.classList.remove("nook-works-open");
    active = -1;
  }

  function renderViewer() {
    const card = cards[active];
    if (!card) return;
    const image = card.querySelector("img");
    const title = titleFor(card, active);
    const related = cards
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.index !== active)
      .slice(0, 4);
    viewer.innerHTML = [
      '<div class="nook-works-backdrop" data-nook-close="true"></div>',
      '<div class="nook-works-dialog" role="dialog" aria-modal="true" aria-label="' + escapeHtml(title) + '">',
      '<button class="nook-works-close" type="button" data-nook-close="true" aria-label="Close project">×</button>',
      '<img src="' + escapeHtml(image.currentSrc || image.src) + '" alt="' + escapeHtml(title) + '">',
      '<div class="nook-works-copy"><small>Selected work</small><h2>' + escapeHtml(title) + '</h2><p>Explore this project from the Nook Studios works collection.</p><div class="nook-works-related"><h3>More like this</h3><div class="nook-works-related-grid">',
      related
        .map(
          (entry) =>
            '<button class="nook-works-related-card" type="button" data-nook-related="' +
            entry.index +
            '"><img src="' +
            escapeHtml(entry.item.querySelector("img")?.currentSrc || entry.item.querySelector("img")?.src) +
            '" alt="' +
            escapeHtml(titleFor(entry.item, entry.index)) +
            '"><span>' +
            escapeHtml(titleFor(entry.item, entry.index)) +
            "</span></button>"
        )
        .join(""),
      "</div></div></div></div>"
    ].join("");
    viewer.hidden = false;
    document.body.classList.add("nook-works-open");
  }

  function openViewer(indexOrCard) {
    active = typeof indexOrCard === "number" ? indexOrCard : cards.indexOf(indexOrCard);
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.className = "nook-works-viewer";
      viewer.hidden = true;
      document.body.appendChild(viewer);
      viewer.addEventListener("click", (event) => {
        if (event.target.closest("[data-nook-close]")) closeViewer();
        const related = event.target.closest("[data-nook-related]");
        if (related) openViewer(Number(related.dataset.nookRelated));
      });
    }
    renderViewer();
  }

  function apply() {
    if (!worksRoute()) return;
    const images = [...document.querySelectorAll("img")].filter(isWorkImage);
    const nextCards = [...new Set(images.map(getCard))].filter(Boolean);
    if (nextCards.length < 2) return;
    const nextGallery = getGallery(nextCards);
    if (!nextGallery) return;
    cards = nextCards;
    nextGallery.classList.add("nook-works-grid");
    cards.forEach((card, index) => {
      card.classList.add("nook-works-card");
      card.style.setProperty("--nook-card-order", String(index));
    });
    addStyles();
  }

  function start() {
    if (!worksRoute()) return;
    addStyles();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    [0, 250, 700, 1400, 2400].forEach((delay) => window.setTimeout(apply, delay));
    document.addEventListener(
      "click",
      (event) => {
        const card = event.target.closest(".nook-works-card");
        if (!card || event.target.closest(".nook-works-viewer")) return;
        event.preventDefault();
        event.stopPropagation();
        openViewer(card);
      },
      true
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeViewer();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();