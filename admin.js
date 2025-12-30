// =============================
// SUPABASE INIT (same as your site)
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

const carouselPreviewGrid = document.getElementById("carouselPreviewGrid");
const carouselSelectedIndexEl = document.getElementById("carouselSelectedIndex");


// =============================
// Auth guard
// =============================
async function requireLogin() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    statusMsg.textContent = "Auth error.";
    console.warn("[admin] getSession error", error);
    return false;
  }

  const session = data?.session;
  if (!session) {
    window.location.href = "index.html";
    return false;
  }

  statusMsg.textContent = `Logged in as: ${session.user.email}`;
  return true;
}

// =============================
// Load stats + table
// =============================
async function loadOverview() {
  overviewError.textContent = "";

  try {
    const { count: visitTotal, error: vErr } = await supabaseClient
      .from("site_visits")
      .select("id", { count: "exact", head: true });

    if (vErr) throw vErr;

    const { count: dlTotal, error: dErr } = await supabaseClient
      .from("resume_downloads")
      .select("id", { count: "exact", head: true });

    if (dErr) throw dErr;

    visitsCount.textContent = String(visitTotal ?? 0);
    downloadsCount.textContent = String(dlTotal ?? 0);
  } catch (err) {
    console.warn("[admin] loadOverview error", err);
    overviewError.textContent =
      "Failed to load overview. (Check RLS policies for authenticated users.)";
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRecentDownloads() {
  downloadsError.textContent = "";

  try {
    const { data, error } = await supabaseClient
      .from("resume_downloads")
      .select("organization,title,name,email,downloaded_at")
      .order("downloaded_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      downloadsTableBody.innerHTML =
        `<tr><td colspan="5" class="admin-muted">No downloads yet.</td></tr>`;
      return;
    }

    downloadsTableBody.innerHTML = data
      .map((row) => {
        const time = escapeHtml(row.downloaded_at || "");
        const org = escapeHtml(row.organization || "");
        const title = escapeHtml(row.title || "");
        const name = escapeHtml(row.name || "");
        const email = escapeHtml(row.email || "");
        return `<tr>
          <td>${time}</td>
          <td>${org}</td>
          <td>${title}</td>
          <td>${name}</td>
          <td>${email}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    console.warn("[admin] loadRecentDownloads error", err);
    downloadsError.textContent =
      "Failed to load downloads. (Check RLS policies for authenticated users.)";
  }
}

async function refreshAll() {
  await loadOverview();
  await loadRecentDownloads();
}

// =============================
// Pending (draft) assets before publish
// =============================
let pendingResumeUrl = null;
let pendingImageUrls = null;
let currentCarouselUrls = [];
let selectedCarouselIndex = null; // 0-7

// =============================
// Upload resume to PUBLIC bucket (Option A)
// =============================
async function uploadResume(file) {
  // Always overwrite this path
  const path = "resume/current.pdf";

  const { error: upErr } = await supabaseClient.storage
    .from("public-assets")
    .upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "0",
    });

  if (upErr) throw upErr;

  const { data } = supabaseClient.storage
    .from("public-assets")
    .getPublicUrl(path);

  // Cache-busting param forces browsers to fetch newest file
  return `${data.publicUrl}?v=${Date.now()}`;
}

// =============================
// Upload images to public-assets and return public URLs
// =============================
async function uploadImages(files) {
  const urls = [];

  for (const file of files) {
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `carousel/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseClient.storage
      .from("public-assets")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) throw upErr;

    const { data } = supabaseClient.storage
      .from("public-assets")
      .getPublicUrl(path);

    urls.push(`${data.publicUrl}?v=${Date.now()}`);
  }

  return urls;
}

// =============================
// Publish to DB so the public site can read current assets
// =============================
async function publishAssets({ resumeUrl, imageUrls }) {
  // Update resume_url row
  if (resumeUrl) {
    const { error } = await supabaseClient
      .from("site_assets")
      .update({ value: { url: resumeUrl } })
      .eq("key", "resume_url");
    if (error) throw error;
  }

  // Update carousel_images row
  if (imageUrls && imageUrls.length) {
    const { error } = await supabaseClient
      .from("site_assets")
      .update({ value: { urls: imageUrls } })
      .eq("key", "carousel_images");
    if (error) throw error;
  }
}

// =============================
// Proof helper: read back resume_url from DB
// =============================
async function readBackResumeUrl() {
  const { data, error } = await supabaseClient
    .from("site_assets")
    .select("value")
    .eq("key", "resume_url")
    .single();

  if (error) throw error;
  return data?.value?.url || "";
}


// Proof helper: read back carousel_images from DB
async function readBackCarouselUrls() {
  const { data, error } = await supabaseClient
    .from("site_assets")
    .select("value")
    .eq("key", "carousel_images")
    .single();

  if (error) throw error;
  const urls = data?.value?.urls;
  return Array.isArray(urls) ? urls : [];
}

async function loadCarouselUrlsFromDB() {
  const { data, error } = await supabaseClient
    .from("site_assets")
    .select("value")
    .eq("key", "carousel_images")
    .single();

  if (error) throw error;

  const urls = data?.value?.urls;
  currentCarouselUrls = Array.isArray(urls) ? urls : [];
  return currentCarouselUrls;
}

function renderCarouselPreview(urls) {
  if (!carouselPreviewGrid) return;

  // ensure exactly 8 slots (fallback placeholders)
  const slots = Array.from({ length: 8 }, (_, i) => urls[i] || "");

  carouselPreviewGrid.innerHTML = slots
    .map((u, i) => {
      const safeSrc = u || "images/img" + (i + 1) + ".png"; // fallback to your original local images
      return `
        <div class="carousel-preview-item" data-index="${i}">
          <span class="carousel-preview-badge">${i + 1}</span>
          <img src="${safeSrc}" alt="carousel ${i + 1}">
        </div>
      `;
    })
    .join("");

  // bind clicks
  carouselPreviewGrid.querySelectorAll(".carousel-preview-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.index);
      selectedCarouselIndex = idx;

      // UI selected state
      carouselPreviewGrid.querySelectorAll(".carousel-preview-item").forEach((x) => x.classList.remove("selected"));
      el.classList.add("selected");

      if (carouselSelectedIndexEl) carouselSelectedIndexEl.textContent = String(idx + 1);
    });
  });

  // keep selection highlight if already selected
  if (selectedCarouselIndex != null) {
    const sel = carouselPreviewGrid.querySelector(`.carousel-preview-item[data-index="${selectedCarouselIndex}"]`);
    sel?.classList.add("selected");
    if (carouselSelectedIndexEl) carouselSelectedIndexEl.textContent = String(selectedCarouselIndex + 1);
  } else {
    if (carouselSelectedIndexEl) carouselSelectedIndexEl.textContent = "None";
  }
}


// =============================
// Events
// =============================
refreshBtn?.addEventListener("click", refreshAll);

logoutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

uploadImagesBtn?.addEventListener("click", async () => {
  const files = imageFiles?.files ? Array.from(imageFiles.files) : [];
  if (!files.length) {
    imagesStatus.textContent = "Please choose images first.";
    return;
  }

  imagesStatus.textContent = "Uploading images…";

  try {
    // Make sure we have the current 8 URLs from DB for replacement mode
    if (!currentCarouselUrls.length) {
      await loadCarouselUrlsFromDB();
    }

    // Case 1: user selects ONE file and has selected a slot -> replace that slot
    if (files.length === 1 && selectedCarouselIndex != null) {
      const [newUrl] = await uploadImages(files); // reuses your existing uploader
      const next = Array.from({ length: 8 }, (_, i) => currentCarouselUrls[i] || "");

      next[selectedCarouselIndex] = newUrl;

      pendingImageUrls = next;
      imagesStatus.textContent = `Uploaded 1 image. Ready to publish (replaces slot ${selectedCarouselIndex + 1}).`;

      // update preview immediately (so you see what will publish)
      currentCarouselUrls = next;
      renderCarouselPreview(currentCarouselUrls);
      return;
    }

    // Case 2: multi-upload (or no slot selected) -> treat as “replace all” behavior
    pendingImageUrls = await uploadImages(files);
    imagesStatus.textContent = `Images uploaded (${pendingImageUrls.length}). Ready to publish.`;

  } catch (e) {
    console.warn(e);
    imagesStatus.textContent = "Upload failed. Check console.";
  }
});


uploadImagesBtn?.addEventListener("click", async () => {
  const files = imageFiles?.files ? Array.from(imageFiles.files) : [];
  if (!files.length) {
    imagesStatus.textContent = "Please choose images first.";
    return;
  }

  imagesStatus.textContent = "Uploading images…";
  try {
    pendingImageUrls = await uploadImages(files);
    imagesStatus.textContent = `Images uploaded (${pendingImageUrls.length}). Ready to publish.`;
    console.log("[admin] pendingImageUrls:", pendingImageUrls);
  } catch (e) {
    console.warn(e);
    imagesStatus.textContent = "Upload failed. Check console.";
  }
});

publishBtn?.addEventListener("click", async () => {
  // ✅ prevent publishing if nothing is pending
  if (!pendingResumeUrl && (!pendingImageUrls || !pendingImageUrls.length)) {
    publishStatus.textContent = "Nothing to publish. Upload resume/images first.";
    return;
  }

  publishStatus.textContent = "Publishing…";

  try {
    await publishAssets({
      resumeUrl: pendingResumeUrl,
      imageUrls: pendingImageUrls,
    });

    // ✅ proof (read back from DB)
    const liveResumeUrl = await readBackResumeUrl();
    const liveCarouselUrls = await readBackCarouselUrls();

    const resumeOk = !!liveResumeUrl;
    const carouselOk = Array.isArray(liveCarouselUrls) && liveCarouselUrls.length > 0;

    publishStatus.textContent =
      `Published! Resume: ${resumeOk ? "OK" : "EMPTY"} | Carousel: ${carouselOk ? ("OK (" + liveCarouselUrls.length + ")") : "EMPTY"}`; 

    // Clear pending so you don't accidentally re-publish old values
    pendingResumeUrl = null;
    pendingImageUrls = null;

    // Optionally refresh dashboard
    await refreshAll();
  } catch (e) {
    console.warn(e);
    publishStatus.textContent = "Publish failed. Check console.";
  }
});

// =============================
// Boot
// =============================
(async function boot() {
  const ok = await requireLogin();
  if (!ok) return;
  await refreshAll();
try {
  await loadCarouselUrlsFromDB();
  renderCarouselPreview(currentCarouselUrls);
} catch (e) {
  console.warn("[admin] failed to load carousel preview:", e);
}


})();
