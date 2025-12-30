// =============================
// SITE SCRIPT (FIXED)
// =============================
// ✅ Keeps existing design
// ✅ Reads latest resume + carousel URLs from site_assets
// ✅ Updates carousel images without breaking hover/click behaviors
// ✅ Keeps login slide-out working (panel opens)

// =============================
// GLOBAL SAFE HELPERS
// =============================
const $ = (id) => document.getElementById(id);

// =============================
// EmailJS CONFIG
// =============================
const EMAILJS_PUBLIC_KEY = "rBCzi8gk95ZNi_AbF";
const EMAILJS_SERVICE_ID = "service_cy9g64j";
const EMAILJS_TEMPLATE_ID = "template_7z3kejw";

(function initEmailJS() {
  if (typeof emailjs === "undefined") {
    console.warn("EmailJS not loaded");
    return;
  }
  emailjs.init(EMAILJS_PUBLIC_KEY);
})();

// =============================
// TIME-BASED GREETING
// =============================
(function initGreeting() {
  const el = $("greeting");
  if (!el) return;

  const hour = new Date().getHours();
  el.textContent =
    hour < 12 ? "Good morning! ☀️" :
    hour < 18 ? "Good afternoon! 🌤️" :
    "Good evening! 🌙";
})();

// =============================
// LIVE CLOCK
// =============================
(function initClock() {
  const clock = $("clock");
  if (!clock) return;

  function update() {
    clock.textContent = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  update();
  setInterval(update, 1000);
})();

// =============================
// SUPABASE
// =============================
const SUPABASE_URL = "https://wumakgzighvtvtvprnri.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89";

let supabaseClient = null;
let LIVE_RESUME_URL = "";
let LIVE_CAROUSEL_URLS = [];

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
    console.warn("[supabase] init failed:", e);
    return null;
  }
}

async function trackVisit() {
  const client = await ensureSupabaseClient();
  if (!client) return;
  try {
    await client.from("site_visits").insert([{ path: location.pathname }]);
  } catch (err) {
    // If your RLS blocks anon inserts, this will 403 — safe to ignore.
    console.warn("[visit] tracking failed:", err);
  }
}

async function logResumeDownload({ organization, title, name = null, email = null }) {
  const client = await ensureSupabaseClient();
  if (!client) return;
  try {
    await client.from("resume_downloads").insert([{
      organization,
      title,
      name,
      email,
      downloaded_at: new Date().toISOString(),
    }]);
  } catch (err) {
    console.warn("[resume] log download failed:", err);
  }
}

// =============================
// CAROUSEL — core references
// =============================
const ringPortal = document.getElementById("carousel-portal");
const ringContainer = document.getElementById("carousel-container");
let ring = document.querySelector(".carousel-ring");
const ringButton = document.getElementById("carouselTrigger");

let isOpen = false;
let autoRotateTimer = null;
let rotationY = 0;
let rotationSpeed = 0.004;

function setCarouselOpenState(nextOpen) {
  isOpen = nextOpen;
  if (isOpen) {
    ringPortal?.classList.add("open");
    ringContainer?.classList.add("open");
    ringContainer?.setAttribute("aria-hidden", "false");
    startAutoRotate();
  } else {
    ringPortal?.classList.remove("open");
    ringContainer?.classList.remove("open");
    ringContainer?.setAttribute("aria-hidden", "true");
    clearActiveImage();
    stopAutoRotate();
  }
}

(function initCarouselTrigger() {
  const trigger = document.getElementById("carouselTrigger");
  if (!trigger || !ringContainer) {
    console.warn("[carousel] init aborted — missing elements", {
      trigger: !!trigger,
      ringContainer: !!ringContainer,
    });
    return;
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setCarouselOpenState(!isOpen);
  });
})();

function layoutCarousel() {
  const container = document.getElementById("carousel-container");
  const images = container?.querySelectorAll("img");
  if (!container || !images || !images.length) return;

  const count = images.length;
  const scale = 1.5;
  const gap = 20;

  const baseW = 220;
  const baseH = 140;
  const imgW = Math.round(baseW * scale);
  const imgH = Math.round(baseH * scale);

  images.forEach((img) => {
    img.style.width = imgW + "px";
    img.style.height = imgH + "px";
  });

  const circumferenceNeeded = count * (imgW + gap);
  let radius = Math.max(circumferenceNeeded / (2 * Math.PI), imgW * 0.9);
  radius = Math.round(radius + Math.max(16, imgW * 0.04));

  const containerSize = Math.round(radius * 2 + imgH * 1.2);
  container.style.width = containerSize + "px";
  container.style.height = containerSize + "px";

  images.forEach((img, index) => {
    const angle = (360 / count) * index;
    img.dataset.angle = String(angle);
    img.style.setProperty("--carousel-angle", `${angle}deg`);
    img.style.setProperty("--carousel-radius", `${radius}px`);
    img.style.setProperty("--carousel-scale", "1");
    img.style.transform =
      `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px) scale(var(--carousel-scale))`;
  });
}

function startAutoRotate() {
  if (autoRotateTimer) return;
  autoRotateTimer = setInterval(() => {
    rotationY -= rotationSpeed;
    if (ring) ring.style.transform = `rotateY(${rotationY}rad)`;
  }, 16);
}

function stopAutoRotate() {
  clearInterval(autoRotateTimer);
  autoRotateTimer = null;
}

function clearActiveImage() {
  if (!ring) return;
  ring.querySelectorAll("img").forEach((img) => {
    img.classList.remove("is-active");
    img.style.setProperty("--carousel-scale", "1");
  });
}

function focusImage(img) {
  if (!img || !ring) return;
  const angle = Number(img.dataset.angle || 0);

  stopAutoRotate();
  clearActiveImage();

  img.classList.add("is-active");
  img.style.setProperty("--carousel-scale", "1.4");

  const targetRotation = -angle * (Math.PI / 180);
  rotationY = targetRotation;

  ring.classList.add("snap");
  ring.style.transform = `rotateY(${rotationY}rad)`;

  setTimeout(() => ring.classList.remove("snap"), 700);
}

let lastMouseX = null;
const MOUSE_DIR_THRESHOLD = 2;

function getRotateDirLR() {
  return rotationSpeed > 0 ? -1 : 1;
}

function flipRotateDirKeepSpeed() {
  rotationSpeed = -rotationSpeed;
}

function bindCarouselImageEvents() {
  ring = document.querySelector(".carousel-ring");
  if (!ring) return;

  // Remove old handlers by cloning (prevents duplicate bindings after updates)
  const imgs = Array.from(ring.querySelectorAll("img"));

  ring.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) focusImage(target);
  });

  imgs.forEach((img) => {
    img.addEventListener("mouseenter", () => {
      lastMouseX = null;
    });

    img.addEventListener("mousemove", (event) => {
      if (!isOpen) return;
      if (!autoRotateTimer) startAutoRotate();

      if (lastMouseX === null) {
        lastMouseX = event.clientX;
        return;
      }

      const deltaX = event.clientX - lastMouseX;
      if (Math.abs(deltaX) < MOUSE_DIR_THRESHOLD) return;

      const mouseDir = deltaX > 0 ? 1 : -1;
      const rotDir = getRotateDirLR();

      if (mouseDir !== rotDir) flipRotateDirKeepSpeed();
      lastMouseX = event.clientX;
    });
  });
}

if (ringContainer) {
  ringContainer.addEventListener("mouseenter", () => stopAutoRotate());
  ringContainer.addEventListener("mouseleave", () => {
    if (isOpen) {
      clearActiveImage();
      startAutoRotate();
    }
  });

  ringContainer.addEventListener("click", (event) => event.stopPropagation());
}

// =============================
// Apply published carousel urls WITHOUT breaking the carousel behavior
// =============================
function applyCarouselImages(urls) {
  if (!Array.isArray(urls) || !urls.length) return;
  const ringEl = document.querySelector(".carousel-ring");
  if (!ringEl) return;

  const imgs = Array.from(ringEl.querySelectorAll("img"));

  // Prefer updating existing <img> tags (preserves layout/CSS)
  if (imgs.length === urls.length) {
    imgs.forEach((img, i) => {
      img.src = urls[i];
    });
  } else {
    // Rebuild only if counts differ
    ringEl.innerHTML = urls.map((u) => `<img src="${u}" alt="">`).join("");
  }

  // Re-layout and re-bind hover/click handlers
  layoutCarousel();
  bindCarouselImageEvents();
}

async function loadPublishedAssets() {
  const client = await ensureSupabaseClient();
  if (!client) return;

  try {
    const { data, error } = await client
      .from("site_assets")
      .select("key,value")
      .in("key", ["resume_url", "carousel_images"]);

    if (error) throw error;

    const map = new Map((data || []).map((r) => [r.key, r.value]));

    const resume = map.get("resume_url");
    LIVE_RESUME_URL = resume?.url || "";

    const carousel = map.get("carousel_images");
    LIVE_CAROUSEL_URLS = Array.isArray(carousel?.urls) ? carousel.urls.filter(Boolean) : [];

    // Update resume link element
    const resumeLinkEl = document.getElementById("resumeLink");
    if (resumeLinkEl && LIVE_RESUME_URL) {
      resumeLinkEl.setAttribute("href", LIVE_RESUME_URL);
    }

    if (LIVE_CAROUSEL_URLS.length) {
      applyCarouselImages(LIVE_CAROUSEL_URLS);
    }

    console.log("[assets] LIVE_RESUME_URL:", LIVE_RESUME_URL ? "loaded" : "empty");
  } catch (e) {
    console.warn("[assets] loadPublishedAssets failed:", e);
  }
}

// =============================
// ADMIN LOGIN (slide-out)
// =============================
function initAdminLogin() {
  const boxEl = document.getElementById("adminLoginBox");
  const panelEl = document.getElementById("adminPanel");
  const emailEl = document.getElementById("adminEmail");
  const passEl = document.getElementById("adminPassword");
  const btnEl = document.getElementById("adminLoginBtn");
  const msgEl = document.getElementById("adminLoginMsg");

  if (!boxEl || !panelEl || !emailEl || !passEl || !btnEl) return;

  function setOpen(open) {
    boxEl.classList.toggle("is-open", open);
    btnEl.setAttribute("aria-expanded", String(open));
    panelEl.setAttribute("aria-hidden", String(!open));
    if (open) setTimeout(() => emailEl.focus(), 0);
    else if (msgEl) msgEl.textContent = "";
  }

  function isOpenPanel() {
    return boxEl.classList.contains("is-open");
  }

  btnEl.addEventListener("click", async (e) => {
    e.preventDefault();

    // First click opens
    if (!isOpenPanel()) {
      setOpen(true);
      return;
    }

    const email = emailEl.value.trim();
    const password = passEl.value;

    // If open but empty -> close
    if (!email && !password) {
      setOpen(false);
      return;
    }

    if (!email || !password) {
      if (msgEl) msgEl.textContent = "Enter email + password.";
      return;
    }

    const client = await ensureSupabaseClient();
    if (!client) {
      if (msgEl) msgEl.textContent = "Supabase not available.";
      return;
    }

    try {
      if (msgEl) msgEl.textContent = "Signing in...";

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        if (msgEl) msgEl.textContent = `Login failed: ${error.message}`;
        return;
      }

      if (!data?.session) {
        if (msgEl) msgEl.textContent = "Login failed (no session).";
        return;
      }

      if (msgEl) msgEl.textContent = "Success! Redirecting...";
      window.location.href = "admin.html";
    } catch (err) {
      console.warn("[admin] login failed:", err);
      if (msgEl) msgEl.textContent = "Unexpected error. Check console.";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpenPanel()) setOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (!isOpenPanel()) return;
    if (boxEl.contains(e.target)) return;
    setOpen(false);
  });
}

// =============================
// RESUME DOWNLOAD
// =============================
(function initResumeDownload() {
  const form = document.getElementById("downloadForm");
  const orgInput = document.getElementById("orgInput");
  const titleInput = document.getElementById("titleInput");
  const message = document.getElementById("downloadMessage");
  const link = document.getElementById("resumeLink");

  if (!form || !link) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const org = orgInput.value.trim();
    const title = titleInput.value.trim();

    if (!org || !title) {
      if (message) message.textContent = "Please fill out both fields.";
      return;
    }

    const urlToDownload = LIVE_RESUME_URL || link.getAttribute("href");

    if (message) message.textContent = "Thank you! Preparing your download...";

    // log, but don't block
    logResumeDownload({ organization: org, title });

    // ✅ Reliable download on deployed sites: create a temporary <a> and click it
    // (This avoids user-gesture problems with showSaveFilePicker on some hosts.)
    try {
      const a = document.createElement("a");
      a.href = urlToDownload;
      a.download = "Jimmy-Han-Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (message) message.textContent = "Download started.";
    } catch (err) {
      console.warn("[resume] download failed:", err);
      if (message) {
        message.innerHTML = `Download failed — <a href="${urlToDownload}" download>click here</a>.`;
      }
    } finally {
      form.reset();
    }
  });
})();

// =============================
// CHAT WIDGET + EMAILJS
// =============================
(function initChatWidget() {
  const widget = $("chat-widget");
  const toggle = $("chatToggle");
  const closeBtn = $("chatClose");
  const form = $("chatForm");
  const input = $("chatInput");
  const messages = $("chatMessages");
  const status = $("chatStatus");

  const userNameEl = $("userName");
  const userEmailEl = $("userEmail");

  if (!widget || !toggle || !form || !input || !messages) return;

  let sending = false;

  function setStatus(isOnline) {
    if (!status) return;
    status.className = "chat-status " + (isOnline ? "online" : "offline");
  }

  setStatus(true);

  function addMessage(text, from = "user") {
    const msg = document.createElement("div");
    msg.className = `msg ${from}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function openChat() {
    widget.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    setTimeout(() => input.focus(), 150);
  }

  function closeChat() {
    widget.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    widget.classList.contains("open") ? closeChat() : openChat();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeChat();
  });

  const ownerName = "Jimmy";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";
    sending = true;

    if (typeof emailjs === "undefined") {
      addMessage("❌ Email service not available. " + ownerName, "owner");
      sending = false;
      return;
    }

    const fileInput = document.getElementById("chatFile");
    const file = fileInput?.files?.[0];
    if (file) {
      addMessage("❌ File uploads are not supported yet. Please email your file directly to me.", "owner");
      fileInput.value = "";
      sending = false;
      return;
    }

    const params = {
      name: userNameEl?.value?.trim() || "Anonymous",
      email: userEmailEl?.value?.trim() || "Not provided",
      message: text,
    };

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then(() => addMessage("✅ Message sent. I’ll reply by email soon! " + ownerName, "owner"))
      .catch((err) => {
        console.error("EmailJS error:", err);
        addMessage("❌ Failed to send message. Please try again later. " + ownerName, "owner");
      })
      .finally(() => {
        sending = false;
      });
  });
})();

// =============================
// BOOT (important: run after DOM is ready)
// =============================
window.addEventListener("DOMContentLoaded", async () => {
  // Layout carousel once for the default images, then bind handlers
  layoutCarousel();
  bindCarouselImageEvents();

  initAdminLogin();

  await trackVisit();
  await loadPublishedAssets();
});
