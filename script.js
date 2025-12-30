// =============================
// GLOBAL SAFE HELPERS
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
// LOG RESUME DOWNLOAD
// =============================
async function logResumeDownload({ organization, title, name = null, email = null }) {
  try {
    await supabaseClient.from("resume_downloads").insert([{
      organization,
      title,
      name,
      email,
      downloaded_at: new Date().toISOString(),
    }]);
  } catch (err) {
    console.warn("[resume] logResumeDownload failed:", err);
    // Don't block the download if logging fails
  }
}

async function trackVisit() {
  try {
    await supabaseClient
      .from("site_visits")
      .insert([{ path: location.pathname }]);
  } catch (err) {
    console.warn("Visit tracking failed:", err);
  }
}
trackVisit();

// =============================
// LOAD PUBLISHED ASSETS
// =============================
let LIVE_RESUME_URL = ""; // will be filled from site_assets

async function loadPublishedAssets() {
  try {
    const { data, error } = await supabaseClient
      .from("site_assets")
      .select("key,value")
      .in("key", ["resume_url", "carousel_images"]);

    if (error) throw error;

    const map = new Map((data || []).map((r) => [r.key, r.value]));

    const resume = map.get("resume_url");
    LIVE_RESUME_URL = resume?.url || "";

    // ✅ Update the link in DOM to the live resume (so manual download uses the new one too)
    const resumeLinkEl = document.getElementById("resumeLink");
    if (LIVE_RESUME_URL && resumeLinkEl) {
      resumeLinkEl.setAttribute("href", LIVE_RESUME_URL);
    }

    console.log("[assets] LIVE_RESUME_URL:", LIVE_RESUME_URL ? "loaded" : "empty");
  } catch (e) {
    console.warn("[assets] loadPublishedAssets failed:", e);
  }
}
loadPublishedAssets();


// =============================
// ADMIN LOGIN (compact slide-out)
// =============================
(function initAdminLogin() {
  const boxEl = document.getElementById("adminLoginBox");
  const panelEl = document.getElementById("adminPanel");
  const emailEl = document.getElementById("adminEmail");
  const passEl = document.getElementById("adminPassword");
  const btnEl = document.getElementById("adminLoginBtn");
  const msgEl = document.getElementById("adminLoginMsg");

  if (!boxEl || !panelEl || !emailEl || !passEl || !btnEl) return;

  // Always clear autofill on load/refresh (Chrome may fill after DOM paints)
  emailEl.value = "";
  passEl.value = "";

  setTimeout(() => {
    emailEl.value = "";
    passEl.value = "";
  }, 0);

  setTimeout(() => {
    emailEl.value = "";
    passEl.value = "";
  }, 200);

  function setOpen(open) {
    boxEl.classList.toggle("is-open", open);
    btnEl.setAttribute("aria-expanded", String(open));
    panelEl.setAttribute("aria-hidden", String(!open));
    if (open) {
      setTimeout(() => emailEl.focus(), 0);
    } else {
      if (msgEl) msgEl.textContent = "";
      emailEl.value = emailEl.value.trim();
    }
  }

  function isOpen() {
    return boxEl.classList.contains("is-open");
  }

  btnEl.addEventListener("click", async () => {
    if (!isOpen()) {
      setOpen(true);
      return;
    }

    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email && !password) {
      setOpen(false);
      return;
    }

    if (!email || !password) {
      if (msgEl) msgEl.textContent = "Enter email + password.";
      return;
    }

    try {
      if (msgEl) msgEl.textContent = "Signing in...";

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn("[admin] login failed:", error);
        if (msgEl) msgEl.textContent = `Login failed: ${error.message}`;
        return;
      }

      if (!data?.session) {
        if (msgEl) msgEl.textContent = "Login failed (no session).";
        return;
      }

      if (msgEl) msgEl.textContent = "Success! Redirecting...";
      window.location.href = "admin.html";
    } catch (e) {
      console.error("[admin] unexpected error:", e);
      if (msgEl) msgEl.textContent = "Unexpected error. Check console.";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (boxEl.contains(e.target)) return;
    setOpen(false);
  });
})();



const $ = (id) => document.getElementById(id);

// ✅ ADD THIS HERE (ONCE)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =============================
// EmailJS CONFIG ✅ 必须完整
// =============================
const EMAILJS_PUBLIC_KEY = "rBCzi8gk95ZNi_AbF"; // ← 必填
const EMAILJS_SERVICE_ID = "service_cy9g64j";
const EMAILJS_TEMPLATE_ID = "template_7z3kejw";

// 初始化 EmailJS（✅ 核心修复）
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
// RESUME DOWNLOAD LOGIC
// =============================
(function initResumeDownload() {
  const form = document.getElementById("downloadForm");
  const orgInput = document.getElementById("orgInput");
  const titleInput = document.getElementById("titleInput");
  const message = document.getElementById("downloadMessage");
  const link = document.getElementById("resumeLink");

  if (!form || !link) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const org = orgInput.value.trim();
    const title = titleInput.value.trim();

    if (!org || !title) {
      message.textContent = "Please fill out both fields.";
      return;
    }

    message.textContent = "Thank you! Preparing your download...";
    logResumeDownload({ organization: org, title });

    (async () => {
      // ✅ always use one URL for all branches
      const oldHref = link.getAttribute("href");
      // If LIVE_RESUME_URL not ready yet, try to load it once more
      if (!LIVE_RESUME_URL) {
        await loadPublishedAssets();
      }
      const urlToDownload = LIVE_RESUME_URL || oldHref;

      try {
        if (window.showSaveFilePicker) {
          let handle;
          try {
            handle = await window.showSaveFilePicker({
              suggestedName: 'Jimmy-Han-Resume.pdf',
              types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
            });
          } catch (pickerErr) {
            console.warn('Save picker cancelled or blocked:', pickerErr);
            message.textContent = 'Save cancelled.';
            form.reset();
            return;
          }

          const res = await fetch(urlToDownload);
          if (!res.ok) throw new Error('Failed to fetch resume');

          if (handle) {
            try {
              const writable = await handle.createWritable();

              if (res.body && writable.write) {
                try {
                  const reader = res.body.getReader();
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                  }
                  await writable.close();
                } catch (streamErr) {
                  const blob = await res.blob();
                  await writable.write(blob);
                  await writable.close();
                }
              } else {
                const blob = await res.blob();
                await writable.write(blob);
                await writable.close();
              }

              message.textContent = 'Saved to chosen location. Thank you!';
            } catch (fsErr) {
              console.error('Error writing to file handle:', fsErr);
              message.innerHTML =
                'Save failed — you can <a href="' + urlToDownload + '" download>click here</a> to download manually.';
              link.style.display = 'inline-block';
              link.setAttribute("href", urlToDownload);
            }
          } else {
            message.innerHTML =
              'No file chosen — you can <a href="' + urlToDownload + '" download>click here</a> to download manually.';
            link.style.display = 'inline-block';
            link.setAttribute("href", urlToDownload);
          }
        } else {
          // ✅ no picker: manual link should point to the new resume URL too
          message.innerHTML =
            'Your browser cannot prompt a save dialog. <a href="' + urlToDownload + '" download>Click here to download</a>.';
          link.style.display = 'inline-block';
          link.setAttribute("href", urlToDownload);
        }
      } catch (err) {
        console.error(err);
        // ✅ fallback link also uses urlToDownload (new if available)
        message.innerHTML =
          'Download failed — you can <a href="' + urlToDownload + '" download>click here</a> to try manually.';
        link.style.display = 'inline-block';
        link.setAttribute("href", urlToDownload);
      } finally {
        form.reset();
      }
    })();
  });
})();


// =============================
// CHAT WIDGET + EMAILJS (✅ 稳定版)
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

  let ownerName = "Jimmy";
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
      .then(() => {
        addMessage("✅ Message sent. I’ll send email to you soon! " + ownerName, "owner");
      })
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
// IMAGE CAROUSEL – STEP 1 TRIGGER
// =============================
const ringPortal = document.getElementById("carousel-portal");
const ringContainer = document.getElementById("carousel-container");
const ring = document.querySelector(".carousel-ring");
const ringButton = document.getElementById("carouselTrigger");

let isOpen = false;
let autoRotateTimer = null;
let rotationY = 0;
let rotationSpeed = 0.004; // slower left rotation

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
    console.warn('[carousel] init aborted — missing elements', { trigger: !!trigger, ringContainer: !!ringContainer });
    return;
  }

  console.log('[carousel] initCarouselTrigger: ready');
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setCarouselOpenState(!isOpen);
    console.log('[carousel] trigger clicked — isOpen=', isOpen);
  });
})();

// =============================
// IMAGE CAROUSEL – STEP 2 LAYOUT
// =============================
(function initCarouselLayout() {
  const container = document.getElementById("carousel-container");
  const images = container?.querySelectorAll("img");
  if (!container || !images.length) return;

  const count = images.length;
  const scale = 1.5;
  const gap = 20;

  const baseW = 220;
  const baseH = 140;

  const imgW = Math.round(baseW * scale);
  const imgH = Math.round(baseH * scale);

  images.forEach((img) => {
    img.style.width = imgW + 'px';
    img.style.height = imgH + 'px';
  });

  const circumferenceNeeded = count * (imgW + gap);
  let radius = Math.max(circumferenceNeeded / (2 * Math.PI), imgW * 0.9);
  radius = Math.round(radius + Math.max(16, imgW * 0.04));

  const containerSize = Math.round(radius * 2 + imgH * 1.2);
  container.style.width = containerSize + 'px';
  container.style.height = containerSize + 'px';

  console.log('[carousel] layout:', { count, imgW, imgH, gap, radius, containerSize });

  images.forEach((img, index) => {
    const angle = (360 / count) * index;
    img.dataset.angle = String(angle);
    img.style.setProperty("--carousel-angle", `${angle}deg`);
    img.style.setProperty("--carousel-radius", `${radius}px`);
    img.style.setProperty("--carousel-scale", "1");
    img.style.transform = `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px) scale(var(--carousel-scale))`;
  });
})();

// =============================
// IMAGE RING – STEP 2: OPEN + AUTO ROTATE
// =============================
if (ringContainer) {
  ringContainer.addEventListener("mouseenter", () => {
    stopAutoRotate();
  });

  ringContainer.addEventListener("mouseleave", () => {
    if (isOpen) {
      clearActiveImage();
      startAutoRotate();
    }
  });

  ringContainer.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

// Auto-rotate logic
function startAutoRotate() {
  if (autoRotateTimer) return;
  console.log("[carousel] startAutoRotate");

  ring?.classList.remove("snap");
  autoRotateTimer = setInterval(() => {
    rotationY -= rotationSpeed;
    if (ring) ring.style.transform = `rotateY(${rotationY}rad)`;
  }, 16);
}

function stopAutoRotate() {
  console.log("[carousel] stopAutoRotate");
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

  setTimeout(() => {
    ring.classList.remove("snap");
  }, 700);
}

// =============================
// ✅ FIX #2: 鼠标滑动触发方向翻转（速度不变）
// =============================
let lastMouseX = null;
const MOUSE_DIR_THRESHOLD = 2;

function getRotateDirLR() {
  return rotationSpeed > 0 ? -1 : 1;
}

function flipRotateDirKeepSpeed() {
  rotationSpeed = -rotationSpeed;
}

if (ring) {
  ring.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      focusImage(target);
    }
  });

  ring.querySelectorAll("img").forEach((img) => {
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

      if (mouseDir !== rotDir) {
        flipRotateDirKeepSpeed();
      }

      lastMouseX = event.clientX;
    });
  });
}

// =============================
// ✅ FIX #1: 删除“点击任意地方关闭”
// =============================
// (No document click close logic)
