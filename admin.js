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
    // Not logged in → go back to home
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
    // Count visits
    const { count: visitTotal, error: vErr } = await supabaseClient
      .from("site_visits")
      .select("id", { count: "exact", head: true });

    if (vErr) throw vErr;

    // Count downloads
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
let pendingResumeUrl = null;
let pendingImageUrls = null;

// Upload resume to private-assets and return a signed URL (valid for 1 day)
async function uploadResume(file) {
  const path = `resume/resume_${Date.now()}.pdf`;

  const { error: upErr } = await supabaseClient.storage
    .from("private-assets")
    .upload(path, file, { upsert: true, contentType: "application/pdf" });

  if (upErr) throw upErr;

  // Create a signed URL for downloads (valid 24 hours)
  const { data, error: signErr } = await supabaseClient.storage
    .from("private-assets")
    .createSignedUrl(path, 60 * 60 * 24);

  if (signErr) throw signErr;

  return data.signedUrl;
}

// Upload images to public-assets and return public URLs
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

    urls.push(data.publicUrl);
  }

  return urls;
}

// Publish to DB so the public site can read current assets
async function publishAssets({ resumeUrl, imageUrls }) {
  if (resumeUrl) {
    const { error } = await supabaseClient
      .from("site_assets")
      .update({ value: { url: resumeUrl } })
      .eq("key", "resume_url");
    if (error) throw error;
  }

  if (imageUrls && imageUrls.length) {
    const { error } = await supabaseClient
      .from("site_assets")
      .update({ value: { urls: imageUrls } })
      .eq("key", "carousel_images");
    if (error) throw error;
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
  imagesStatus.textContent = "Uploading images…";
  try {
    pendingImageUrls = await uploadImages(files);
    imagesStatus.textContent = `Images uploaded (${pendingImageUrls.length}). Ready to publish.`;
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
      imageUrls: pendingImageUrls,
    });
    publishStatus.textContent = "Published! Your public site will use the new assets.";
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
})();
