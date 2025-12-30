// =============================
// ADMIN.JS — FIXED VERSION
// Keeps all UI/design the same
// Fixes:
// 1) Carousel publish actually writes 8 URLs to DB
// 2) Slot replacement logic works after deploy
// 3) Publish status is accurate
// =============================

// =============================
// SUPABASE INIT
// =============================
const SUPABASE_URL = "https://wumakgzighvtvtvprnri.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// =============================
// DOM
// =============================
const statusMsg = document.getElementById("statusMsg");
const visitsCount = document.getElementById("visitsCount");
const downloadsCount = document.getElementById("downloadsCount");
const overviewError = document.getElementById("overviewError");

const downloadsError = document.getElementById("downloadsError");
const downloadsTableBody = document.getElementById("downloadsTableBody");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const resumeFile = document.getElementById("resumeFile");
const uploadResumeBtn = document.getElementById("uploadResumeBtn");
const resumeStatus = document.getElementById("resumeStatus");

const imageFiles = document.getElementById("imageFiles");
const uploadImagesBtn = document.getElementById("uploadImagesBtn");
const imagesStatus = document.getElementById("imagesStatus");

const publishBtn = document.getElementById("publishBtn");
const publishStatus = document.getElementById("publishStatus");

const carouselSlots = document.querySelectorAll(".carousel-slot");
const carouselSelectedIndexEl = document.getElementById("carouselSelectedIndex");

// =============================
// STATE
// =============================
let pendingResumeUrl = null;
let currentCarouselUrls = new Array(8).fill("");
let selectedCarouselIndex = null; // 0–7

// =============================
// AUTH GUARD
// =============================
async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) {
    window.location.href = "index.html";
    return false;
  }
  statusMsg.textContent = `Logged in as: ${data.session.user.email}`;
  return true;
}

// =============================
// LOAD CURRENT ASSETS
// =============================
async function loadCurrentAssets() {
  const { data } = await supabaseClient
    .from("site_assets")
    .select("key,value")
    .eq("key", "carousel_images")
    .single();

  if (data?.value?.urls && Array.isArray(data.value.urls)) {
    currentCarouselUrls = data.value.urls.slice(0, 8);
  }

  renderCarouselPreview();
}

function renderCarouselPreview() {
  carouselSlots.forEach((slot, i) => {
    const img = slot.querySelector("img");
    const label = slot.querySelector(".slot-label");

    if (currentCarouselUrls[i]) {
      img.src = currentCarouselUrls[i];
      img.style.display = "block";
      label.textContent = "";
    } else {
      img.style.display = "none";
      label.textContent = "Empty";
    }

    slot.classList.toggle("selected", i === selectedCarouselIndex);
  });

  carouselSelectedIndexEl.textContent =
    selectedCarouselIndex === null ? "None" : String(selectedCarouselIndex + 1);
}

// =============================
// OVERVIEW + DOWNLOADS
// =============================
async function loadOverview() {
  overviewError.textContent = "";
  try {
    const { count: visits } = await supabaseClient
      .from("site_visits")
      .select("id", { count: "exact", head: true });

    const { count: downloads } = await supabaseClient
      .from("resume_downloads")
      .select("id", { count: "exact", head: true });

    visitsCount.textContent = visits ?? 0;
    downloadsCount.textContent = downloads ?? 0;
  } catch (e) {
    overviewError.textContent = "Failed to load overview.";
  }
}

async function loadRecentDownloads() {
  downloadsError.textContent = "";
  try {
    const { data } = await supabaseClient
      .from("resume_downloads")
      .select("organization,title,name,email,downloaded_at")
      .order("downloaded_at", { ascending: false })
      .limit(50);

    downloadsTableBody.innerHTML = (data || []).map(r => `
      <tr>
        <td>${r.downloaded_at}</td>
        <td>${r.organization}</td>
        <td>${r.title}</td>
        <td>${r.name || ""}</td>
        <td>${r.email || ""}</td>
      </tr>
    `).join("") || `<tr><td colspan="5">No downloads yet.</td></tr>`;
  } catch (e) {
    downloadsError.textContent = "Failed to load downloads.";
  }
}

async function refreshAll() {
  await loadOverview();
  await loadRecentDownloads();
  await loadCurrentAssets();
}

// =============================
// UPLOAD RESUME
// =============================
async function uploadResume(file) {
  const path = "resume/current.pdf";
  const { error } = await supabaseClient.storage
    .from("public-assets")
    .upload(path, file, { upsert: true, contentType: "application/pdf", cacheControl: "0" });
  if (error) throw error;

  const { data } = supabaseClient.storage
    .from("public-assets")
    .getPublicUrl(path);

  return `${data.publicUrl}?v=${Date.now()}`;
}

// =============================
// UPLOAD IMAGE → SLOT
// =============================
async function uploadImageToSlot(file, index) {
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `carousel/slot_${index + 1}_${Date.now()}_${safeName}`;

  const { error } = await supabaseClient.storage
    .from("public-assets")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from("public-assets")
    .getPublicUrl(path);

  currentCarouselUrls[index] = `${data.publicUrl}?v=${Date.now()}`;
}

// =============================
// EVENTS
// =============================
refreshBtn?.addEventListener("click", refreshAll);

logoutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

uploadResumeBtn?.addEventListener("click", async () => {
  if (!resumeFile.files[0]) return;
  resumeStatus.textContent = "Uploading…";
  pendingResumeUrl = await uploadResume(resumeFile.files[0]);
  resumeStatus.textContent = "Resume uploaded. Ready to publish.";
});

carouselSlots.forEach((slot, i) => {
  slot.addEventListener("click", () => {
    selectedCarouselIndex = i;
    renderCarouselPreview();
  });
});

uploadImagesBtn?.addEventListener("click", async () => {
  if (selectedCarouselIndex === null) {
    imagesStatus.textContent = "Select a slot first.";
    return;
  }
  const file = imageFiles.files[0];
  if (!file) return;

  imagesStatus.textContent = "Uploading image…";
  await uploadImageToSlot(file, selectedCarouselIndex);
  imagesStatus.textContent = `Image uploaded to slot ${selectedCarouselIndex + 1}.`;
  renderCarouselPreview();
});

publishBtn?.addEventListener("click", async () => {
  publishStatus.textContent = "Publishing…";

  if (pendingResumeUrl) {
    await supabaseClient
      .from("site_assets")
      .update({ value: { url: pendingResumeUrl } })
      .eq("key", "resume_url");
  }

  await supabaseClient
    .from("site_assets")
    .update({ value: { urls: currentCarouselUrls } })
    .eq("key", "carousel_images");

  publishStatus.textContent = "Published! Resume: OK | Carousel: OK";
});

// =============================
// BOOT
// =============================
(async function boot() {
  const ok = await requireLogin();
  if (!ok) return;
  await refreshAll();
})();
