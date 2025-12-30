// =============================
// SUPABASE INIT (same as your site)
// =============================
const SUPABASE_URL = "https://wumakgzighvtvtvprnri.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89";

document.addEventListener("DOMContentLoaded", () => {
  // If supabase script didn't load, stop early with a visible message
  if (typeof supabase === "undefined") {
    const msg = document.getElementById("publishStatus") || document.body;
    if (msg) msg.textContent = "Supabase library not loaded. Check admin.html <script> tag.";
    console.error("[admin] supabase is undefined");
    return;
  }

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

  // =============================
  // Inject Preview UI if missing (keeps your design)
  // =============================
  function ensureCarouselPreviewUI() {
    let label = document.getElementById("selectedSlotLabel");
    let grid = document.getElementById("carouselPreviewGrid");

    if (label && grid) return { label, grid };

    // Find Publish Assets card
    const publishCard = Array.from(document.querySelectorAll(".admin-card"))
      .find((c) => (c.textContent || "").includes("Publish Assets"));

    if (!publishCard) return { label: null, grid: null };

    // Insert preview section near the HR
    const hr = publishCard.querySelector("hr") || publishCard;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div style="margin-top:10px;">
        <h3 style="margin:0 0 6px 0;">Carousel images (click one slot to replace)</h3>
        <p class="admin-muted" id="selectedSlotLabel">Selected slot: None</p>
        <div id="carouselPreviewGrid"
          style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:stretch;">
        </div>
      </div>
    `;
    hr.insertAdjacentElement("beforebegin", wrap);

    label = document.getElementById("selectedSlotLabel");
    grid = document.getElementById("carouselPreviewGrid");
    return { label, grid };
  }

  const { label: selectedSlotLabel, grid: carouselPreviewGrid } = ensureCarouselPreviewUI();

  // =============================
  // State
  // =============================
  let pendingResumeUrl = null;
  let pendingImageUrls = null;       // MUST be an array of 8 urls when publishing carousel
  let liveImageUrls = new Array(8).fill(""); // current live urls from DB
  let selectedIndex = null;          // 0..7

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
  // Load assets from DB
  // =============================
  async function loadLiveAssets() {
    try {
      const { data, error } = await supabaseClient
        .from("site_assets")
        .select("key,value")
        .in("key", ["carousel_images", "resume_url"]);

      if (error) throw error;

      const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      const urls = map.carousel_images?.urls;

      if (Array.isArray(urls) && urls.length === 8) {
        liveImageUrls = urls.slice();
      } else {
        // If empty in DB, keep placeholders (so publish won’t write empty accidentally)
        liveImageUrls = new Array(8).fill("");
      }

      renderCarouselPreview();
    } catch (e) {
      console.warn("[admin] loadLiveAssets failed:", e);
      if (imagesStatus) imagesStatus.textContent = "Failed to load carousel state. Check RLS policies.";
    }
  }

  // =============================
  // Render 8-slot preview
  // =============================
  function renderCarouselPreview() {
    if (!carouselPreviewGrid) return;

    carouselPreviewGrid.innerHTML = "";

    for (let i = 0; i < 8; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.border = (selectedIndex === i) ? "3px solid #3498db" : "1px solid #ddd";
      btn.style.borderRadius = "12px";
      btn.style.overflow = "hidden";
      btn.style.cursor = "pointer";
      btn.style.padding = "0";
      btn.style.background = "#fff";
      btn.style.position = "relative";
      btn.style.height = "110px";

      const url = (pendingImageUrls?.[i] || liveImageUrls[i] || "");
      btn.innerHTML = `
        <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;
                    width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;
                    font-size:14px;">
          ${i + 1}
        </div>
        ${url
          ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#777;">
               Empty
             </div>`
        }
      `;

      btn.addEventListener("click", () => {
        selectedIndex = i;
        if (selectedSlotLabel) selectedSlotLabel.textContent = `Selected slot: ${i + 1}`;
        renderCarouselPreview();
      });

      carouselPreviewGrid.appendChild(btn);
    }
  }

  // =============================
  // Helpers: upload
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

    const { data } = supabaseClient.storage.from("public-assets").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function uploadOneImage(file, slotIndex) {
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `carousel/slot${slotIndex + 1}_${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseClient.storage
      .from("public-assets")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "0" });

    if (upErr) throw upErr;

    const { data } = supabaseClient.storage.from("public-assets").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  // =============================
  // Publish (DB is source of truth)
  // =============================
  async function publishAssets({ resumeUrl, imageUrls }) {
    if (resumeUrl) {
      const { error } = await supabaseClient
        .from("site_assets")
        .update({ value: { url: resumeUrl } })
        .eq("key", "resume_url");
      if (error) throw error;
    }

    if (Array.isArray(imageUrls)) {
      if (imageUrls.length !== 8) throw new Error("Carousel publish requires exactly 8 images.");

      const { error } = await supabaseClient
        .from("site_assets")
        .update({ value: { urls: imageUrls } })
        .eq("key", "carousel_images");

      if (error) throw error;
    }
  }

  // =============================
  // Stats
  // =============================
  async function loadOverview() {
    overviewError.textContent = "";
    try {
      const { count: visitTotal, error: vErr } = await supabaseClient
        .from("site_visits").select("id", { count: "exact", head: true });
      if (vErr) throw vErr;

      const { count: dlTotal, error: dErr } = await supabaseClient
        .from("resume_downloads").select("id", { count: "exact", head: true });
      if (dErr) throw dErr;

      visitsCount.textContent = String(visitTotal ?? 0);
      downloadsCount.textContent = String(dlTotal ?? 0);
    } catch (err) {
      console.warn("[admin] loadOverview error", err);
      overviewError.textContent = "Failed to load overview. (Check RLS for authenticated users.)";
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
        downloadsTableBody.innerHTML = `<tr><td colspan="5" class="admin-muted">No downloads yet.</td></tr>`;
        return;
      }

      const esc = (s) => (s ?? "").toString()
        .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
        .replaceAll('"',"&quot;").replaceAll("'","&#039;");

      downloadsTableBody.innerHTML = data.map((row) => `
        <tr>
          <td>${esc(row.downloaded_at)}</td>
          <td>${esc(row.organization)}</td>
          <td>${esc(row.title)}</td>
          <td>${esc(row.name)}</td>
          <td>${esc(row.email)}</td>
        </tr>
      `).join("");
    } catch (err) {
      console.warn("[admin] loadRecentDownloads error", err);
      downloadsError.textContent = "Failed to load downloads. (Check RLS for authenticated users.)";
    }
  }

  async function refreshAll() {
    await loadOverview();
    await loadRecentDownloads();
    await loadLiveAssets();
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
    if (files.length !== 1) {
      imagesStatus.textContent = "Please choose exactly ONE image to replace the selected slot.";
      return;
    }
    if (selectedIndex == null) {
      imagesStatus.textContent = "Select a slot (1–8) first.";
      return;
    }

    imagesStatus.textContent = "Uploading image…";

    try {
      const newUrl = await uploadOneImage(files[0], selectedIndex);

      // Build an 8-url array to publish
      const next = (Array.isArray(pendingImageUrls) && pendingImageUrls.length === 8)
        ? pendingImageUrls.slice()
        : liveImageUrls.slice();

      next[selectedIndex] = newUrl;

      pendingImageUrls = next; // MUST be 8
      imagesStatus.textContent = `Image uploaded for slot ${selectedIndex + 1}. Ready to publish.`;

      renderCarouselPreview();
    } catch (e) {
      console.warn(e);
      imagesStatus.textContent = "Upload failed. Check console.";
    }
  });

  publishBtn?.addEventListener("click", async () => {
    publishStatus.textContent = "Publishing…";

    try {
      const hasResume = !!pendingResumeUrl;
      const hasCarousel = Array.isArray(pendingImageUrls) && pendingImageUrls.length === 8;

      if (!hasResume && !hasCarousel) {
        publishStatus.textContent = "Nothing to publish.";
        return;
      }

      await publishAssets({
        resumeUrl: pendingResumeUrl || undefined,
        imageUrls: hasCarousel ? pendingImageUrls : undefined,
      });

      // Proof read back
      const { data } = await supabaseClient
        .from("site_assets")
        .select("key,value")
        .in("key", ["resume_url", "carousel_images"]);

      const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      const resumeOK = !!map.resume_url?.url;
      const carouselOK = Array.isArray(map.carousel_images?.urls) && map.carousel_images.urls.length === 8;

      publishStatus.textContent =
        `Published! Resume: ${resumeOK ? "OK" : "EMPTY"} | Carousel: ${carouselOK ? "OK" : "EMPTY"}`;

      // Update live state + clear pending
      if (carouselOK) liveImageUrls = map.carousel_images.urls.slice();
      pendingResumeUrl = null;
      pendingImageUrls = null;

      renderCarouselPreview();
    } catch (e) {
      console.warn(e);
      publishStatus.textContent = e?.message || "Publish failed. Check console.";
    }
  });

  // =============================
  // Boot
  // =============================
  (async function boot() {
    const ok = await requireLogin();
    if (!ok) return;
    await refreshAll();
  })();
});
