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

// =============================
// Events
// =============================
refreshBtn?.addEventListener("click", refreshAll);

logoutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

// =============================
// Boot
// =============================
(async function boot() {
  const ok = await requireLogin();
  if (!ok) return;
  await refreshAll();
})();
