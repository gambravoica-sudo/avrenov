const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
const config = window.VOICA_CONFIG ?? {};

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Ouvrir le menu" : "Fermer le menu");
  nav?.classList.toggle("open", !isOpen);
});

nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  nav.classList.remove("open");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Ouvrir le menu");
}));

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section-heading, .expertise-item, .projects-heading, .portfolio-grid, .reviews-copy, .review-empty, .process-steps article, .contact-content, .lead-form").forEach((element) => {
  element.classList.add("reveal");
  observer.observe(element);
});

const leadForm = document.querySelector("#lead-form");
const formStatus = document.querySelector("#form-status");
const portfolioGrid = document.querySelector("#portfolio-grid");
const portfolioCount = document.querySelector("#portfolio-count");
const portfolioTotal = document.querySelector("#portfolio-total");
const reviewsList = document.querySelector("#reviews-list");
const directContact = document.querySelector("#direct-contact");
const reviewPlatformLink = document.querySelector("#review-platform-link");
let clientPromise;
let portfolioItems = [...(window.VOICA_PORTFOLIO ?? [])];
let portfolioFilter = "all";

if (directContact && config.contactEmail) {
  directContact.href = `mailto:${config.contactEmail.trim()}`;
  directContact.textContent = config.contactEmail;
  directContact.hidden = false;
}

if (reviewPlatformLink && config.reviewProfileUrl) {
  try {
    const reviewUrl = new URL(config.reviewProfileUrl);
    if (reviewUrl.protocol === "https:") {
      reviewPlatformLink.href = reviewUrl.href;
      reviewPlatformLink.textContent = "Lire les avis sur notre profil ↗";
      reviewPlatformLink.hidden = false;
    }
  } catch { /* Ignore an invalid review-profile URL. */ }
}

function getClient() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(config.supabaseUrl, config.supabaseAnonKey));
  }
  return clientPromise;
}

function createText(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function categorySlug(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderPortfolio() {
  if (!portfolioGrid) return;
  if (portfolioTotal) portfolioTotal.textContent = String(portfolioItems.length);
  const filtered = portfolioFilter === "all"
    ? portfolioItems
    : portfolioItems.filter((item) => categorySlug(item.category) === portfolioFilter);
  if (portfolioCount) portfolioCount.textContent = `${filtered.length} réalisation${filtered.length === 1 ? "" : "s"}`;
  portfolioGrid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "portfolio-empty";
    empty.append(createText("p", "", "Aucune réalisation dans cette catégorie pour le moment."));
    portfolioGrid.append(empty);
    return;
  }
  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "portfolio-card";
    const image = document.createElement("img");
    image.src = item.imageUrl || item.src;
    image.alt = item.alt || `${item.title}${item.location ? ` — ${item.location}` : ""}`;
    image.loading = "lazy";
    const caption = document.createElement("div");
    caption.className = "portfolio-caption";
    caption.append(createText("span", "portfolio-category", item.category || "Réalisation"));
    caption.append(createText("h3", "", item.title));
    if (item.location) caption.append(createText("p", "", item.location));
    if (item.description) caption.append(createText("p", "portfolio-description", item.description));
    card.append(image, caption);
    portfolioGrid.append(card);
  });
}

document.querySelectorAll(".portfolio-filters button").forEach((button) => button.addEventListener("click", () => {
  portfolioFilter = button.dataset.filter;
  document.querySelectorAll(".portfolio-filters button").forEach((filterButton) => {
    const active = filterButton === button;
    filterButton.setAttribute("aria-pressed", String(active));
    filterButton.classList.toggle("active", active);
  });
  renderPortfolio();
}));

async function loadPortfolio(client) {
  if (!portfolioGrid) return;
  if (!client) return renderPortfolio();
  const { data, error } = await client.from("portfolio_items")
    .select("id,title,location,category,description,storage_path,created_at")
    .eq("is_published", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) return renderPortfolio();
  const onlineItems = (data ?? []).map((item) => ({
    ...item,
    imageUrl: client.storage.from("portfolio").getPublicUrl(item.storage_path).data.publicUrl,
  }));
  portfolioItems = [...onlineItems, ...(window.VOICA_PORTFOLIO ?? [])];
  renderPortfolio();
}

async function loadReviews(client) {
  if (!reviewsList || !client) return;
  const { data, error } = await client.from("reviews")
    .select("id,author_name,location,rating,quote,source_platform,source_url,created_at")
    .eq("is_published", true).order("created_at", { ascending: false }).limit(6);
  if (error || !data?.length) return;
  reviewsList.replaceChildren();
  data.forEach((review) => {
    const card = document.createElement("article");
    card.className = "review-item";
    const stars = createText("div", "review-stars", "★".repeat(Math.min(5, Math.max(1, Number(review.rating) || 0))));
    stars.setAttribute("aria-label", `${review.rating} sur 5`);
    card.append(stars, createText("blockquote", "", `« ${review.quote} »`));
    const byline = createText("p", "review-author", review.location ? `${review.author_name} · ${review.location}` : review.author_name);
    card.append(byline);
    if (review.source_platform && review.source_url) {
      try {
        const url = new URL(review.source_url);
        if (url.protocol === "https:") {
          const source = document.createElement("a");
          source.className = "review-source";
          source.href = url.href;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          source.textContent = `Voir la source : ${review.source_platform}`;
          card.append(source);
        }
      } catch { /* A malformed external source is not displayed. */ }
    }
    reviewsList.append(card);
  });
}

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (leadForm.elements.website.value) return;
  if (!leadForm.reportValidity()) return;
  const submitButton = leadForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  formStatus.textContent = "Envoi de votre demande…";
  try {
    const client = await getClient();
    if (!client) {
      if (config.contactEmail) {
        const values = new FormData(leadForm);
        const body = [
          `Nom : ${values.get("name")}`,
          `E-mail : ${values.get("email")}`,
          `Téléphone : ${values.get("phone") || "—"}`,
          `Commune : ${values.get("project_city") || "—"}`,
          `Travaux : ${values.get("service_type") || "—"}`,
          "",
          String(values.get("message")),
        ].join("\n");
        window.location.href = `mailto:${config.contactEmail.trim()}?subject=${encodeURIComponent("Demande de projet — Alex Renov & Voica Renov")}&body=${encodeURIComponent(body)}`;
        formStatus.textContent = "Votre application e-mail va s’ouvrir avec le message préparé. Vérifiez-le avant de l’envoyer.";
      } else {
        formStatus.textContent = "Le formulaire est en cours de configuration. Merci de revenir bientôt.";
      }
      return;
    }
    const formData = new FormData(leadForm);
    const { error } = await client.from("inquiries").insert({
      name: String(formData.get("name")).trim(),
      email: String(formData.get("email")).trim(),
      phone: String(formData.get("phone") || "").trim() || null,
      project_city: String(formData.get("project_city") || "").trim() || null,
      service_type: String(formData.get("service_type") || "").trim() || null,
      message: String(formData.get("message")).trim(),
      consent: formData.get("consent") === "on",
    });
    if (error) throw error;
    leadForm.reset();
    formStatus.textContent = "Merci. Votre demande a bien été transmise à l’équipe.";
  } catch (error) {
    console.error("Lead submission failed", error);
    formStatus.textContent = "L’envoi n’a pas abouti. Réessayez plus tard ou contactez-nous directement.";
  } finally {
    submitButton.disabled = false;
  }
});

getClient().then((client) => {
  if (!client) return loadPortfolio(null);
  return Promise.all([loadPortfolio(client), loadReviews(client)]);
}).catch((error) => console.error("Site content could not be loaded", error));

