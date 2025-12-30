// =============================
// GLOBAL SAFE HELPERS
// =============================
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
// SUPABASE (Assets + Analytics)
// =============================
const SUPABASE_URL = "https://wumakgzighvtvtvprnri.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89";

let supabaseClient = null;

// Live assets read from DB
let LIVE_RESUME_URL = "";
let LIVE_CAROUSEL_URLS = [];

async function ensureSupabaseClient() {
  try {
    // If the library isn't loaded (e.g., missing <script> tag), load it dynamically.
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
    console.warn("[supabase] failed to init client:", e);
    return null;
  }
}

async function trackVisit() {
  const client = await ensureSupabaseClient();
  if (!client) return;
  try {
    await client.from("site_visits").insert([{ path: location.pathname }]);
  } catch (err) {
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

// Apply carousel URLs to existing ring without changing design
function applyCarouselImages(urls) {
  try {
    if (!Array.isArray(urls) || urls.length === 0) return;
    const ringEl = document.querySelector(".carousel-ring");
    if (!ringEl) return;

    // Rebuild images (keep same structure: <img ...>)
    ringEl.innerHTML = urls.map((u) => `<img src="${u}" alt="">`).join("");

    // Re-run layout after images exist
    if (typeof layoutCarousel === "function") {
      layoutCarousel();
    }
  } catch (e) {
    console.warn("[assets] applyCarouselImages failed:", e);
  }
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
    LIVE_CAROUSEL_URLS = Array.isArray(carousel?.urls) ? carousel.urls : [];

    // Update resume link so any fallback/manual link uses the live URL too
    const resumeLinkEl = document.getElementById("resumeLink");
    if (resumeLinkEl && LIVE_RESUME_URL) {
      resumeLinkEl.setAttribute("href", LIVE_RESUME_URL);
    }

    // Update carousel images if published
    if (LIVE_CAROUSEL_URLS.length) {
      applyCarouselImages(LIVE_CAROUSEL_URLS);
    }

    console.log("[assets] resume:", LIVE_RESUME_URL ? "loaded" : "empty",
                "| carousel:", LIVE_CAROUSEL_URLS.length ? `loaded(${LIVE_CAROUSEL_URLS.length})` : "empty");
  } catch (e) {
    console.warn("[assets] loadPublishedAssets failed:", e);
  }
}

// kick off on page load (safe; doesn't change UI)
trackVisit();
loadPublishedAssets();

// =============================
// ADMIN LOGIN (compact slide-out) — deployed-safe init
// =============================
(function initAdminLoginRobust() {
  async function init() {
    const boxEl = document.getElementById("adminLoginBox");
    const panelEl = document.getElementById("adminPanel");
    const emailEl = document.getElementById("adminEmail");
    const passEl = document.getElementById("adminPassword");
    const btnEl = document.getElementById("adminLoginBtn");
    const msgEl = document.getElementById("adminLoginMsg");

    // If the login UI is not on this page, just stop (no errors)
    if (!boxEl || !panelEl || !emailEl || !passEl || !btnEl) return false;

    // Prevent double-binding if init runs twice
    if (btnEl.dataset.bound === "1") return true;
    btnEl.dataset.bound = "1";

    // Clear autofill
    emailEl.value = "";
    passEl.value = "";
    setTimeout(() => { emailEl.value = ""; passEl.value = ""; }, 0);
    setTimeout(() => { emailEl.value = ""; passEl.value = ""; }, 200);

    function setOpen(open) {
      boxEl.classList.toggle("is-open", open);
      btnEl.setAttribute("aria-expanded", String(open));
      panelEl.setAttribute("aria-hidden", String(!open));
      if (open) setTimeout(() => emailEl.focus(), 0);
      if (!open && msgEl) msgEl.textContent = "";
    }

    function isOpen() {
      return boxEl.classList.contains("is-open");
    }

    // Click button:
    // - if closed: open panel
    // - if open: attempt login (if filled), otherwise close
    btnEl.addEventListener("click", async (e) => {
      e.preventDefault();

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

        const client = await ensureSupabaseClient();
        if (!client) {
          if (msgEl) msgEl.textContent = "Supabase not ready. Refresh and try again.";
          return;
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password });

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
      } catch (err) {
        console.error("[admin] unexpected error:", err);
        if (msgEl) msgEl.textContent = "Unexpected error. Check console.";
      }
    });

    // Esc closes panel
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) setOpen(false);
    });

    // Click outside closes the panel (not carousel)
    document.addEventListener("click", (e) => {
      if (!isOpen()) return;
      if (boxEl.contains(e.target)) return;
      setOpen(false);
    });

    return true;
  }

  // DOM-ready + retry (for deployed timing differences)
  const run = async () => {
    const ok = await init();
    if (!ok) setTimeout(init, 250);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
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

    // ✅ Record download info (does not block download)
    logResumeDownload({ organization: org, title });

    // Try to prompt the native save-file picker first (preserving user gesture),
    // then fetch and write the file. If picker is not available or fails, fall back
    // to a standard blob download. This ordering prevents the picker being blocked
    // on deployed sites where async work breaks the user gesture.
    (async () => {
      const urlToDownload = (LIVE_RESUME_URL || link.getAttribute('href'));
      try {
        if (window.showSaveFilePicker) {
          // Prompt picker immediately while still in the user gesture
          let handle;
          try {
            handle = await window.showSaveFilePicker({
              suggestedName: 'Jimmy-Han-Resume.pdf',
              types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
            });
          } catch (pickerErr) {
            // user cancelled the picker or it's blocked — DO NOT proceed to download
            console.warn('Save picker cancelled or blocked:', pickerErr);
            message.textContent = 'Save cancelled.';
            form.reset();
            return; // exit without fetching or downloading
          }

          // Now fetch the resume (only if a handle was obtained)
          const res = await fetch(urlToDownload);
          if (!res.ok) throw new Error('Failed to fetch resume');

          if (handle) {
            try {
              const writable = await handle.createWritable();
              // write response body as stream if available for efficiency
              if (res.body && writable.write) {
                // If WritableStream supports single-write of ReadableStream, pipe
                // Otherwise fall back to arrayBuffer
                try {
                  // Some environments allow piping directly
                  const reader = res.body.getReader();
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                  }
                  await writable.close();
                } catch (streamErr) {
                  // Fallback: read full blob and write once
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
              // If writing fails, DO NOT auto-download. Offer a manual link instead.
              message.innerHTML = 'Save failed — you can <a href="' + urlToDownload + '" download>click here</a> to download manually.';
              link.style.display = 'inline-block';
            }
          } else {
            // No handle selected (shouldn't happen because we return on cancel),
            // but avoid auto-downloading — show a manual link instead.
            message.innerHTML = 'No file chosen — you can <a href="' + urlToDownload + '" download>click here</a> to download manually.';
            link.style.display = 'inline-block';
          }
        } else {
          // Browser doesn't support showSaveFilePicker — do not auto-download.
          // Provide a manual download link so the user explicitly chooses to download.
          message.innerHTML = 'Your browser cannot prompt a save dialog. <a href="' + urlToDownload + '" download>Click here to download</a>.';
          link.style.display = 'inline-block';
        }
      } catch (err) {
        console.error(err);
        // fallback to the original anchor if fetch fails
        message.innerHTML = 'Download failed — you can <a href="' + urlToDownload + '" download>click here</a> to try manually.';
        link.style.display = 'inline-block';
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

  setStatus(true); // 当前为 Email 模式，默认 online

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

  // =============================
  // FORM SUBMIT → EMAILJS
  // =============================
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
      addMessage("❌ Email service not available. "+ ownerName, "owner");
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
        addMessage("✅ Message sent. I’ll send email to you soon! "+ ownerName, "owner");
      })
      .catch((err) => {
        console.error("EmailJS error:", err);
        addMessage("❌ Failed to send message. Please try again later. "+ ownerName, "owner");
      })
      .finally(() => {
        sending = false;
      });
  });
})();
// =============================
// IMAGE CAROUSEL – STEP 1 TRIGGER
// =============================
// ring globals (available to trigger/layout/hover logic)
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
function layoutCarousel() {
  const container = document.getElementById("carousel-container");
  const images = container?.querySelectorAll("img");
  if (!container || !images.length) return;

  const count = images.length;
  const scale = 1.5; // enlarge by 50%
  const gap = 20; // px between images

  // base sizes to match CSS fallback
  const baseW = 220;
  const baseH = 140;

  const imgW = Math.round(baseW * scale);
  const imgH = Math.round(baseH * scale);

  // set actual sizes (override CSS fallback)
  images.forEach((img) => {
    img.style.width = imgW + 'px';
    img.style.height = imgH + 'px';
  });

  // compute minimal radius so images don't touch but aren't too far
  const circumferenceNeeded = count * (imgW + gap);
  let radius = Math.max(circumferenceNeeded / (2 * Math.PI), imgW * 0.9);
  radius = Math.round(radius + Math.max(16, imgW * 0.04));

  // size the container to comfortably fit the ring
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
}
// Run once on load
layoutCarousel();
// =============================
// IMAGE RING – STEP 2: OPEN + AUTO ROTATE
// =============================

// Pause on hover + resume only when open
if (ringContainer) {
  ringContainer.addEventListener("mouseenter", () => {
    stopAutoRotate(); // 保留你原本“悬停暂停”的设计
  });

  ringContainer.addEventListener("mouseleave", () => {
    // 离开时如果是打开状态，继续自动旋转
    if (isOpen) {
      clearActiveImage();
      startAutoRotate();
    }
  });

  // ✅ 不再允许点击 container 关闭 carousel
  // 仅阻止冒泡即可（避免影响其他点击逻辑）
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
  }, 16); // ~60fps
}

function stopAutoRotate() {
  console.log("[carousel] stopAutoRotate");
  clearInterval(autoRotateTimer);
  autoRotateTimer = null;
}

// ✅ 清除激活图片：恢复所有图片到正常大小
function clearActiveImage() {
  if (!ring) return;
  ring.querySelectorAll("img").forEach((img) => {
    img.classList.remove("is-active");
    img.style.setProperty("--carousel-scale", "1");
  });
}

// ✅ 聚焦图片：停止旋转 + 放大 40%
function focusImage(img) {
  if (!img || !ring) return;
  const angle = Number(img.dataset.angle || 0);

  stopAutoRotate();
  clearActiveImage();

  img.classList.add("is-active");
  img.style.setProperty("--carousel-scale", "1.4"); // ✅ 40% bigger

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
// 逻辑：当“滑动方向” ≠ “当前旋转方向”时才翻转
// =============================
let lastMouseX = null;
const MOUSE_DIR_THRESHOLD = 2; // px 防抖

// 说明：你原来注释写 rotationSpeed=0.004 是“left rotation”
// 所以这里约定：rotationSpeed > 0 代表“向左”，<0 代表“向右”
function getRotateDirLR() {
  return rotationSpeed > 0 ? -1 : 1; // -1=left, 1=right
}

function flipRotateDirKeepSpeed() {
  rotationSpeed = -rotationSpeed; // ✅ 只翻转正负号，速度大小不变
}

if (ring) {
  // ✅ 点击图片只做一件事：focus（不关闭 carousel）
  ring.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      focusImage(target);
    }
  });

  // ✅ 在图片上滑动：如果方向不一致就翻转方向
  ring.querySelectorAll("img").forEach((img) => {
    img.addEventListener("mouseenter", () => {
      lastMouseX = null;
    });

    img.addEventListener("mousemove", (event) => {
      if (!isOpen) return;

      // 你原本 hover 会 stopAutoRotate()
      // 为了让“滑动改变方向”可见：只要你开始滑动，就恢复旋转
      if (!autoRotateTimer) startAutoRotate();

      if (lastMouseX === null) {
        lastMouseX = event.clientX;
        return;
      }

      const deltaX = event.clientX - lastMouseX;
      if (Math.abs(deltaX) < MOUSE_DIR_THRESHOLD) return;

      const mouseDir = deltaX > 0 ? 1 : -1; // 1=right, -1=left
      const rotDir = getRotateDirLR();       // 1=right, -1=left

      // ✅ 只有不一致才翻转（你要求的触发逻辑）
      if (mouseDir !== rotDir) {
        flipRotateDirKeepSpeed();
      }

      lastMouseX = event.clientX;
    });
  });
}

// =============================
// ✅ FIX #1: 删除“点击任意地方关闭”
// 关闭 carousel 只能由按钮 ringButton 的 toggle 逻辑完成
// =============================

// ❌ 删除你原来的 document click 关闭逻辑（不要再加回来）
// document.addEventListener("click", ... setCarouselOpenState(false));



