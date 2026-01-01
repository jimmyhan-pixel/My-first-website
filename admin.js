// =============================
// admin.js (FIXED: carousel slot replace + reliable Supabase load)
// Keep all UI/CSS/HTML the same — this only fixes behavior.
// =============================

// =============================
// SUPABASE INIT (same as your site)
// =============================
const SUPABASE_URL = "https://wumakgzighvtvtvprnri.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89";

let supabaseClient = null;

// Load Supabase JS if missing (important on deployed sites)
async function ensureSupabaseClient() {
  try {
    if (typeof supabase === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    if (!supabaseClient && typeof supabase !== "undefined") {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    }
    return supabaseClient;
  } catch (e) {
    console.warn("[admin] failed to init supabase:", e);
    return null;
  }
}

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

// Carousel preview grid (8 slots) from admin.html
const carouselPreviewGrid = document.getElementById("carouselPreviewGrid");
const selectedSlotText = document.getElementById("selectedSlotText");

// =============================
// Auth guard
// =============================
async function requireLogin() {
  const client = await ensureSupabaseClient();
  if (!client) {
    statusMsg.textContent = "Supabase not loaded.";
    return false;
  }

  const { data, error } = await client.auth.getSession();
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
  const client = await ensureSupabaseClient();
  if (!client) return;

  try {
    const { count: visitTotal, error: vErr } = await client
      .from("site_visits")
      .select("id", { count: "exact", head: true });
    if (vErr) throw vErr;

    const { count: dlTotal, error: dErr } = await client
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
  const client = await ensureSupabaseClient();
  if (!client) return;

  try {
    const { data, error } = await client
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
// Upload helpers (resume + carousel)
// =============================
let pendingResumeUrl = null;

// Option B: slot replace (keep 8 URLs)
const DEFAULT_CAROUSEL_URLS = Array.from({ length: 8 }, (_, i) => `images/img${i + 1}.png`);
let currentCarouselUrls = DEFAULT_CAROUSEL_URLS.slice(); // what is currently live in DB
let pendingCarouselUrls = null; // staged changes to publish
let selectedSlotIndex = null;   // 0..7

function setSelectedSlot(index) {
  selectedSlotIndex = index;
  
  const hintElement = document.getElementById("carouselSelectedIndex");
  if (hintElement) {
    hintElement.textContent = index == null ? "None" : String(index + 1);
  }
  
  // Remove highlight from all slots
  document.querySelectorAll(".carousel-slot").forEach((el) => {
    el.classList.remove("selected");
  });
  
  // Add highlight to selected slot
  if (index != null) {
    const el = document.querySelector(`.carousel-slot[data-slot='${index}']`);
    if (el) el.classList.add("selected");
  }
}

function ensureEightUrls(urls) {
  const out = Array.isArray(urls) ? urls.slice(0, 8) : [];
  while (out.length < 8) out.push(DEFAULT_CAROUSEL_URLS[out.length] || "");
  return out;
}

async function loadCarouselUrlsFromDB() {
  const client = await ensureSupabaseClient();
  if (!client) return DEFAULT_CAROUSEL_URLS.slice();

  try {
    const { data, error } = await client
      .from("site_assets")
      .select("value")
      .eq("key", "carousel_images")
      .single();

    if (error) throw error;

    const urls = data?.value?.urls;
    if (Array.isArray(urls) && urls.length) {
      return ensureEightUrls(urls);
    }
    return DEFAULT_CAROUSEL_URLS.slice();
  } catch (e) {
    console.warn("[admin] loadCarouselUrlsFromDB failed:", e);
    return DEFAULT_CAROUSEL_URLS.slice();
  }
}

function renderCarouselPreview(urls) {
  if (!carouselPreviewGrid) return;

  const safe = ensureEightUrls(urls);

  carouselPreviewGrid.innerHTML = safe
    .map((url, idx) => {
      const hasImg = !!url;
      const imgHtml = hasImg
        ? `<img src="${url}" alt="Slot ${idx + 1}" />`
        : `<div class="empty">Empty</div>`;
      return `
        <div class="carousel-slot" data-slot="${idx}">
          <div class="slot-badge">${idx + 1}</div>
          ${imgHtml}
        </div>
      `;
    })
    .join("");

  // Click to select slot
  carouselPreviewGrid.querySelectorAll(".carousel-slot").forEach((slot) => {
    slot.addEventListener("click", () => {
      const idx = Number(slot.getAttribute("data-slot"));
      setSelectedSlot(Number.isFinite(idx) ? idx : null);
      if (imagesStatus) imagesStatus.textContent = "";
    });
  });

  // Restore selection highlight if a slot was previously selected
  if (selectedSlotIndex != null) {
    const selectedSlot = carouselPreviewGrid.querySelector(
      `.carousel-slot[data-slot="${selectedSlotIndex}"]`
    );
    if (selectedSlot) selectedSlot.classList.add("selected");
  }
}

// Upload resume to public-assets and return public URL (+ cache buster)
async function uploadResume(file) {
  const client = await ensureSupabaseClient();
  if (!client) throw new Error("Supabase not ready");

  const path = "resume/current.pdf";

  const { error: upErr } = await client.storage
    .from("public-assets")
    .upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "0",
    });

  if (upErr) throw upErr;

  const { data } = client.storage.from("public-assets").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Upload ONE image to the selected slot path and return URL (+ cache buster)
async function uploadCarouselImageToSlot(file, slotIndex) {
  const client = await ensureSupabaseClient();
  if (!client) throw new Error("Supabase not ready");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ext || "png";
  const path = `carousel/slot-${slotIndex + 1}.${safeExt}`;

  const { error: upErr } = await client.storage
    .from("public-assets")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
      cacheControl: "0",
    });
  if (upErr) throw upErr;

  const { data } = client.storage.from("public-assets").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Publish to DB so the public site can read current assets
async function publishAssets({ resumeUrl, carouselUrls }) {
  const client = await ensureSupabaseClient();
  if (!client) throw new Error("Supabase not ready");

  if (resumeUrl) {
    const { error } = await client
      .from("site_assets")
      .update({ value: { url: resumeUrl } })
      .eq("key", "resume_url");
    if (error) throw error;
  }

  if (carouselUrls) {
    const safe = ensureEightUrls(carouselUrls);
    const { error } = await client
      .from("site_assets")
      .update({ value: { urls: safe } })
      .eq("key", "carousel_images");
    if (error) throw error;
  }
}

async function readBackCarouselUrls() {
  const client = await ensureSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from("site_assets")
    .select("value")
    .eq("key", "carousel_images")
    .single();

  if (error) throw error;
  return Array.isArray(data?.value?.urls) ? data.value.urls : [];
}

// =============================
// Events
// =============================
refreshBtn?.addEventListener("click", refreshAll);

logoutBtn?.addEventListener("click", async () => {
  const client = await ensureSupabaseClient();
  if (client) await client.auth.signOut();
  window.location.href = "index.html";
});

uploadResumeBtn?.addEventListener("click", async () => {
  if (!resumeFile?.files?.[0]) {
    resumeStatus.textContent = "Please choose a PDF first.";
    return;
  }
  resumeStatus.textContent = "Uploading resume…";
  try {
    pendingResumeUrl = await uploadResume(resumeFile.files[0]);
    resumeStatus.textContent = "Resume uploaded. Ready to publish.";
  } catch (e) {
    console.warn(e);
    resumeStatus.textContent = "Upload failed. Check console.";
  }
});

// ✅ FIXED: Slot-based image upload (Option B)
uploadImagesBtn?.addEventListener("click", async () => {
  const file = imageFiles?.files?.[0];
  if (!file) {
    imagesStatus.textContent = "Please choose an image first.";
    return;
  }
  if (selectedSlotIndex == null) {
    imagesStatus.textContent = "Select a slot first.";
    return;
  }

  imagesStatus.textContent = "Uploading image…";
  try {
    const newUrl = await uploadCarouselImageToSlot(file, selectedSlotIndex);

    // Merge into 8-slot list
    const base = ensureEightUrls(pendingCarouselUrls || currentCarouselUrls);
    base[selectedSlotIndex] = newUrl;

    pendingCarouselUrls = base;
    imagesStatus.textContent = `Image uploaded to slot ${selectedSlotIndex + 1}. Ready to publish.`;

    // Update preview immediately
    renderCarouselPreview(pendingCarouselUrls);
  } catch (e) {
    console.warn(e);
    imagesStatus.textContent = "Upload failed. Check console.";
  } finally {
    try { imageFiles.value = ""; } catch (_) {}
  }
});

publishBtn?.addEventListener("click", async () => {
  publishStatus.textContent = "Publishing…";
  try {
    if (!pendingResumeUrl && !pendingCarouselUrls) {
      publishStatus.textContent = "Nothing to publish yet.";
      return;
    }

    await publishAssets({
      resumeUrl: pendingResumeUrl,
      carouselUrls: pendingCarouselUrls,
    });

    // Proof (read-back)
    let liveCarouselUrls = [];
    try {
      liveCarouselUrls = await readBackCarouselUrls();
    } catch (e) {
      console.warn("[admin] readBackCarouselUrls failed:", e);
    }

    const resumeOk = !!pendingResumeUrl;
    const carouselOk = Array.isArray(liveCarouselUrls) && liveCarouselUrls.length > 0;

    publishStatus.textContent = `Published! Resume: ${resumeOk ? "OK" : "SKIP"} | Carousel: ${carouselOk ? "OK" : "EMPTY"}`;

    if (pendingCarouselUrls) {
      currentCarouselUrls = ensureEightUrls(pendingCarouselUrls);
      pendingCarouselUrls = null;
    }
    pendingResumeUrl = null;

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

  currentCarouselUrls = await loadCarouselUrlsFromDB();
  renderCarouselPreview(currentCarouselUrls);
  setSelectedSlot(null);
})();
