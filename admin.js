// =============================
// ADMIN DASHBOARD (FIXED)
// =============================
// ✅ Keeps all existing design/CSS
// ✅ Fixes: carousel image upload (Option B: replace a selected slot)
// ✅ Fixes: publish writes correct DB rows (upsert)

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

// Slot UI (your admin.html may already contain these; we bind to whatever exists)
const slotEls = () => Array.from(document.querySelectorAll(".carousel-slot"));
const selectedSlotLabel = document.getElementById("selectedSlotLabel")
  || document.getElementById("selectedSlot")
  || document.querySelector("[data-selected-slot]");

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
// Helpers
// =============================
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSelectedSlotText(n) {
  if (!selectedSlotLabel) return;
  if (typeof selectedSlotLabel.textContent === "string") {
    selectedSlotLabel.textContent = n ? String(n) : "None";
  }
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
// ASSETS STATE
// =============================
let pendingResumeUrl = null;
let pendingCarouselUrls = null; // full 8-length array

let currentCarouselUrls = new Array(8).fill("");
let selectedSlot = null; // 1..8

function normalizeCarouselUrls(urls) {
  const arr = Array.isArray(urls) ? urls.slice(0, 8) : [];
  while (arr.length < 8) arr.push("");
  return arr;
}

// =============================
// Storage helpers
// =============================
async function uploadResume(file) {
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

  // cache buster
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function uploadCarouselFileToSlot(file, slotIndex) {
  // Stable path per slot so it truly "replaces" in-place
  const safeExt = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `carousel/slot${slotIndex}.${safeExt}`;

  const { error: upErr } = await supabaseClient.storage
    .from("public-assets")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
      cacheControl: "0",
    });

  if (upErr) throw upErr;

  const { data } = supabaseClient.storage
    .from("public-assets")
    .getPublicUrl(path);

  return `${data.publicUrl}?v=${Date.now()}`; // cache buster
}

// =============================
// DB publish (UPsert by key)
// =============================
async function publishAssets({ resumeUrl, carouselUrls }) {
  const rows = [];
  if (resumeUrl) rows.push({ key: "resume_url", value: { url: resumeUrl } });
  if (carouselUrls && carouselUrls.length) {
    rows.push({ key: "carousel_images", value: { urls: carouselUrls } });
  }
  if (!rows.length) return;

  const { error } = await supabaseClient
    .from("site_assets")
    .upsert(rows, { onConflict: "key" });

  if (error) throw error;
}

async function readPublishedAssets() {
  const { data, error } = await supabaseClient
    .from("site_assets")
    .select("key,value")
    .in("key", ["resume_url", "carousel_images"]);

  if (error) throw error;

  const map = new Map((data || []).map((r) => [r.key, r.value]));
  const carousel = map.get("carousel_images");
  currentCarouselUrls = normalizeCarouselUrls(carousel?.urls);
}

// =============================
// Slot UI binding
// =============================
function paintSlots() {
  const els = slotEls();
  if (!els.length) return;

  els.forEach((el, i) => {
    const idx = i + 1;
    el.dataset.slot = String(idx);

    // If your HTML uses an <img> inside, update it; otherwise set background.
    const url = currentCarouselUrls[i] || "";
    const img = el.querySelector("img");

    if (img) {
      if (url) {
        img.src = url;
        img.style.display = "block";
      } else {
        img.removeAttribute("src");
        img.style.display = "none";
      }
    } else {
      // background preview fallback
      if (url) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      } else {
        el.style.backgroundImage = "";
      }
    }

    // Optional: toggle an "Empty" label if present
    const emptyLabel = el.querySelector(".slot-empty");
    if (emptyLabel) emptyLabel.style.display = url ? "none" : "block";

    el.classList.toggle("is-selected", selectedSlot === idx);
  });

  setSelectedSlotText(selectedSlot);
}

function bindSlotClicks() {
  const els = slotEls();
  if (!els.length) return;

  els.forEach((el, i) => {
    el.addEventListener("click", () => {
      selectedSlot = i + 1;
      paintSlots();
    });
  });

  paintSlots();
}

// =============================
// Events
// =============================
refreshBtn?.addEventListener("click", refreshAll);

logoutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
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

uploadImagesBtn?.addEventListener("click", async () => {
  const files = imageFiles?.files ? Array.from(imageFiles.files) : [];
  if (!files.length) {
    imagesStatus.textContent = "Please choose images first.";
    return;
  }

  // Option B: replace a selected slot when uploading 1 image
  if (files.length === 1 && !selectedSlot) {
    imagesStatus.textContent = "Select a slot first.";
    return;
  }

  imagesStatus.textContent = "Uploading images…";

  try {
    // Start from current state
    const next = currentCarouselUrls.slice();

    // Decide slot mapping
    let slotOrder = [];

    if (files.length === 8) {
      slotOrder = [1, 2, 3, 4, 5, 6, 7, 8];
    } else if (files.length === 1) {
      slotOrder = [selectedSlot];
    } else {
      // multiple but not 8
      // If a slot is selected, fill sequentially starting there.
      if (!selectedSlot) {
        imagesStatus.textContent = "Select a slot first (or upload 8 files).";
        return;
      }
      for (let s = selectedSlot; s <= 8 && slotOrder.length < files.length; s++) {
        slotOrder.push(s);
      }
      if (slotOrder.length !== files.length) {
        imagesStatus.textContent = "Not enough slots from the selected position. Choose another slot or upload fewer files.";
        return;
      }
    }

    // Upload and fill
    for (let i = 0; i < files.length; i++) {
      const slotIndex = slotOrder[i];
      const url = await uploadCarouselFileToSlot(files[i], slotIndex);
      next[slotIndex - 1] = url;
    }

    // Update local states
    currentCarouselUrls = next;
    pendingCarouselUrls = next;

    paintSlots();

    imagesStatus.textContent =
      files.length === 1
        ? `Image uploaded to slot ${slotOrder[0]}. Ready to publish.`
        : `Images uploaded (${files.length}). Ready to publish.`;
  } catch (e) {
    console.warn(e);
    imagesStatus.textContent = "Upload failed. Check console.";
  }
});

publishBtn?.addEventListener("click", async () => {
  publishStatus.textContent = "Publishing…";

  try {
    await publishAssets({
      resumeUrl: pendingResumeUrl,
      carouselUrls: pendingCarouselUrls,
    });

    // Proof read-back
    const { data } = await supabaseClient
      .from("site_assets")
      .select("key,value")
      .in("key", ["resume_url", "carousel_images"]);

    const map = new Map((data || []).map((r) => [r.key, r.value]));
    const resumeOK = !!map.get("resume_url")?.url;
    const carCount = Array.isArray(map.get("carousel_images")?.urls)
      ? map.get("carousel_images").urls.filter(Boolean).length
      : 0;

    publishStatus.textContent = `Published! Resume: ${resumeOK ? "OK" : "EMPTY"} | Carousel: ${carCount ? "OK" : "EMPTY"}`;

    // Clear pending (so you don't republish by accident)
    pendingResumeUrl = null;
    pendingCarouselUrls = null;

    // Refresh overview
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

  // Load published carousel URLs so the slots show what's currently live
  try {
    await readPublishedAssets();
  } catch (e) {
    console.warn("[admin] readPublishedAssets failed:", e);
  }

  // Bind slot click selection (works whether your HTML pre-renders slots or not)
  bindSlotClicks();
})();
