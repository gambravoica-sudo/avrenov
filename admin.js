const config = window.VOICA_CONFIG ?? {};
const setupState = document.querySelector("#setup-state");
const loginState = document.querySelector("#login-state");
const dashboard = document.querySelector("#dashboard");
const loginStatus = document.querySelector("#login-status");
let client;

const show = (element, visible) => { if (element) element.hidden = !visible; };

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  show(setupState, true);
} else {
  initializeAdmin().catch((error) => {
    console.error("Admin initialization failed", error);
    show(loginState, true);
    loginStatus.textContent = "Impossible de se connecter au service. Vérifiez la configuration.";
  });
}

async function initializeAdmin() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { session } } = await client.auth.getSession();
  if (session) await authorizeAdmin();
  else show(loginState, true);

  client.auth.onAuthStateChange((_event, session) => {
    if (session) setTimeout(() => authorizeAdmin(), 0);
    else {
      show(dashboard, false);
      show(loginState, true);
    }
  });

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    loginStatus.textContent = "Connexion…";
    const formData = new FormData(form);
    const { error } = await client.auth.signInWithPassword({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
    });
    button.disabled = false;
    if (error) loginStatus.textContent = "Connexion impossible. Vérifiez vos identifiants ou les droits du compte.";
    else loginStatus.textContent = "Vérification des accès…";
  });

  document.querySelector("#signout-button").addEventListener("click", () => client.auth.signOut());
  document.querySelectorAll(".admin-tabs button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs button").forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".admin-panel").forEach((panel) => show(panel, panel.id === button.dataset.panel));
  }));
  document.querySelectorAll("[data-refresh]").forEach((button) => button.addEventListener("click", () => loadInquiries()));
  document.querySelector("#portfolio-form").addEventListener("submit", addPortfolioItem);
  document.querySelector("#review-form").addEventListener("submit", addReview);
}

async function authorizeAdmin() {
  const { data, error } = await client.rpc("is_admin");
  if (error || data !== true) {
    await client.auth.signOut();
    show(loginState, true);
    loginStatus.textContent = "Ce compte n’est pas autorisé à accéder à l’administration.";
    return;
  }
  show(loginState, false);
  show(dashboard, true);
  await Promise.all([loadInquiries(), loadPortfolioAdmin(), loadReviewsAdmin()]);
}

function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function setStatus(id, message, isError = false) {
  const element = document.querySelector(`#${id}`);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function loadInquiries() {
  const host = document.querySelector("#inquiries-list");
  host.replaceChildren(node("p", "empty-message", "Chargement des demandes…"));
  const { data, error } = await client.from("inquiries")
    .select("id,name,email,phone,project_city,service_type,message,status,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) {
    host.replaceChildren(node("p", "empty-message", "Impossible de charger les demandes. Vérifiez les règles d’accès."));
    return;
  }
  const count = document.querySelector("#inquiry-count");
  if (count) count.textContent = String(data.filter((item) => item.status === "new").length);
  if (!data.length) {
    host.replaceChildren(node("p", "empty-message", "Aucune demande pour le moment."));
    return;
  }
  host.replaceChildren();
  data.forEach((item) => {
    const card = node("article", "record-card");
    const header = node("div", "record-card-header");
    const details = document.createElement("div");
    details.append(node("h3", "", item.name));
    details.append(node("p", "record-meta", [item.email, item.phone, item.project_city, item.service_type, formatDate(item.created_at)].filter(Boolean).join(" · ")));
    header.append(details, node("span", "status-label", item.status === "new" ? "Nouveau" : item.status === "contacted" ? "Contacté" : "Clos"));
    const message = node("p", "record-message", item.message);
    const actions = node("div", "record-actions");
    const reply = document.createElement("a");
    reply.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Votre projet avec Alex Renov & Voica Renov")}&body=${encodeURIComponent(`Bonjour ${item.name},\n\nMerci pour votre demande concernant ${item.service_type || "votre projet"}.\n\n\nAlex Renov & Voica Renov`)}`;
    reply.textContent = "Répondre par e-mail ↗";
    actions.append(reply);
    if (item.status === "new") {
      const contacted = node("button", "", "Marquer comme contacté");
      contacted.type = "button";
      contacted.addEventListener("click", async () => {
        const { error: updateError } = await client.from("inquiries").update({ status: "contacted" }).eq("id", item.id);
        if (!updateError) loadInquiries();
      });
      actions.append(contacted);
    }
    card.append(header, message, actions);
    host.append(card);
  });
}

async function loadPortfolioAdmin() {
  const host = document.querySelector("#portfolio-list");
  const { data, error } = await client.from("portfolio_items")
    .select("id,title,location,category,is_published,storage_path")
    .order("created_at", { ascending: false }).limit(100);
  if (error) {
    host.replaceChildren(node("p", "empty-message", "Impossible de charger les réalisations."));
    return;
  }
  if (!data.length) {
    host.replaceChildren(node("p", "empty-message", "Aucune photo de chantier ajoutée."));
    return;
  }
  host.replaceChildren();
  data.forEach((item) => {
    const card = node("article", "record-card record-card-inline");
    const image = document.createElement("img");
    image.src = client.storage.from("portfolio").getPublicUrl(item.storage_path).data.publicUrl;
    image.alt = item.title;
    const details = document.createElement("div");
    details.append(node("h3", "", item.title));
    details.append(node("p", "record-meta", [item.category, item.location, item.is_published ? "Publié" : "Masqué"].filter(Boolean).join(" · ")));
    const toggle = node("button", "", item.is_published ? "Masquer du site" : "Publier sur le site");
    toggle.type = "button";
    toggle.addEventListener("click", async () => {
      const { error: updateError } = await client.from("portfolio_items").update({ is_published: !item.is_published }).eq("id", item.id);
      if (!updateError) loadPortfolioAdmin();
    });
    card.append(image, details, toggle);
    host.append(card);
  });
}

async function addPortfolioItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const file = data.get("photo");
  const statusId = "portfolio-status";
  const submit = form.querySelector("button[type=submit]");
  if (!(file instanceof File) || !file.size) return setStatus(statusId, "Choisissez une photo.", true);
  if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return setStatus(statusId, "Choisissez une image JPG, PNG ou WebP de moins de 10 Mo.", true);
  }
  submit.disabled = true;
  setStatus(statusId, "Envoi de la photo…");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `chantiers/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("portfolio").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    submit.disabled = false;
    return setStatus(statusId, "La photo n’a pas été envoyée. Vérifiez les droits de stockage.", true);
  }
  const { error } = await client.from("portfolio_items").insert({
    title: String(data.get("title")).trim(), location: String(data.get("location") || "").trim() || null,
    category: String(data.get("category")).trim(), description: String(data.get("description") || "").trim() || null,
    sort_order: Number(data.get("sort_order") || 0), storage_path: path, is_published: true,
    client_permission: data.get("client_permission") === "on",
  });
  if (error) {
    await client.storage.from("portfolio").remove([path]);
    setStatus(statusId, "La photo a été reçue, mais sa fiche n’a pas pu être enregistrée.", true);
  } else {
    form.reset();
    form.elements.sort_order.value = "0";
    setStatus(statusId, "La réalisation est publiée sur le site.");
    await loadPortfolioAdmin();
  }
  submit.disabled = false;
}

async function addReview(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const sourceUrl = String(data.get("source_url") || "").trim();
  if (sourceUrl) {
    try { if (new URL(sourceUrl).protocol !== "https:") throw new Error(); }
    catch { return setStatus("review-status", "Le lien de la source doit commencer par https://.", true); }
  }
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  const { error } = await client.from("reviews").insert({
    author_name: String(data.get("author_name")).trim(), location: String(data.get("location") || "").trim() || null,
    quote: String(data.get("quote")).trim(), rating: Number(data.get("rating")),
    source_platform: String(data.get("source_platform") || "").trim() || null,
    source_url: sourceUrl || null, is_published: true,
    permission_to_publish: data.get("permission_to_publish") === "on",
  });
  submit.disabled = false;
  if (error) return setStatus("review-status", "L’avis n’a pas pu être publié. Vérifiez la base et les règles d’accès.", true);
  form.reset();
  setStatus("review-status", "L’avis a été publié.");
  await loadReviewsAdmin();
}

async function loadReviewsAdmin() {
  const host = document.querySelector("#reviews-admin-list");
  const { data, error } = await client.from("reviews")
    .select("id,author_name,location,rating,quote,source_platform,is_published").order("created_at", { ascending: false }).limit(100);
  if (error) {
    host.replaceChildren(node("p", "empty-message", "Impossible de charger les avis."));
    return;
  }
  if (!data.length) {
    host.replaceChildren(node("p", "empty-message", "Aucun avis publié."));
    return;
  }
  host.replaceChildren();
  data.forEach((review) => {
    const card = node("article", "record-card");
    card.append(node("h3", "", `${review.author_name} · ${review.rating}/5`));
    card.append(node("p", "record-meta", [review.location, review.source_platform, review.is_published ? "Publié" : "Masqué"].filter(Boolean).join(" · ")));
    card.append(node("p", "record-message", review.quote));
    const toggle = node("button", "", review.is_published ? "Masquer du site" : "Publier sur le site");
    toggle.type = "button";
    toggle.addEventListener("click", async () => {
      const { error: updateError } = await client.from("reviews").update({ is_published: !review.is_published }).eq("id", review.id);
      if (!updateError) loadReviewsAdmin();
    });
    card.append(toggle);
    host.append(card);
  });
}

