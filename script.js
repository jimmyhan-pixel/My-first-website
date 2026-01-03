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

    // Try to prompt the native save-file picker first (preserving user gesture),
    // then fetch and write the file. If picker is not available or fails, fall back
    // to a standard blob download. This ordering prevents the picker being blocked
    // on deployed sites where async work breaks the user gesture.
    (async () => {
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
            // user cancelled the picker or it's blocked – DO NOT proceed to download
            console.warn('Save picker cancelled or blocked:', pickerErr);
            message.textContent = 'Save cancelled.';
            form.reset();
            return; // exit without fetching or downloading
          }

          // Now fetch the resume (only if a handle was obtained)
          const res = await fetch(link.getAttribute('href'));
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
              message.innerHTML = 'Save failed – you can <a href="' + link.getAttribute('href') + '" download>click here</a> to download manually.';
              link.style.display = 'inline-block';
            }
          } else {
            // No handle selected (shouldn't happen because we return on cancel),
            // but avoid auto-downloading – show a manual link instead.
            message.innerHTML = 'No file chosen – you can <a href="' + link.getAttribute('href') + '" download>click here</a> to download manually.';
            link.style.display = 'inline-block';
          }
        } else {
          // Browser doesn't support showSaveFilePicker – do not auto-download.
          // Provide a manual download link so the user explicitly chooses to download.
          message.innerHTML = 'Your browser cannot prompt a save dialog. <a href="' + link.getAttribute('href') + '" download>Click here to download</a>.';
          link.style.display = 'inline-block';
        }
      } catch (err) {
        console.error(err);
        // fallback to the original anchor if fetch fails
        message.innerHTML = 'Download failed – you can <a href="' + link.getAttribute('href') + '" download>click here</a> to try manually.';
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
        addMessage("✅ Message sent. I'll send email to you soon! "+ ownerName, "owner");
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
// Ring globals (available to trigger/layout/hover logic)
const ringPortal = document.getElementById("carousel-portal");
const ringContainer = document.getElementById("carousel-container");
const ring = document.querySelector(".carousel-ring");
const ringButton = document.getElementById("carouselTrigger");

let isOpen = false;
let autoRotateTimer = null;
let rotationY = 0;
let rotationSpeed = 0.004; // base speed (can be reversed)
let activeImage = null; // track enlarged image

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
    console.warn('[carousel] init aborted – missing elements', { trigger: !!trigger, ringContainer: !!ringContainer });
    return;
  }

  console.log('[carousel] initCarouselTrigger: ready');
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setCarouselOpenState(!isOpen);
    console.log('[carousel] trigger clicked – isOpen=', isOpen);
  });
})();

// =============================
// LOAD CAROUSEL IMAGES FROM DATABASE
// =============================
// This function waits for both the DOM and Supabase library to be ready,
// then loads the latest carousel images from the database and updates the page.
// This ensures we don't try to connect to Supabase before the library has loaded.

// Helper function: wait for Supabase library to be available
function waitForSupabase() {
  return new Promise((resolve) => {
    // If Supabase is already loaded, resolve immediately
    if (typeof supabase !== "undefined") {
      resolve();
      return;
    }
    
    // Otherwise, check every 100ms until it's available (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (typeof supabase !== "undefined") {
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn('[carousel] Supabase library did not load in time');
        resolve(); // Resolve anyway to prevent hanging
      }
    }, 100);
  });
}

// Main function: load carousel images from database
async function loadCarouselImagesFromDB() {
  console.log('[carousel] Starting image load from database...');
  
  // Wait for Supabase library to be available
  await waitForSupabase();
  
  const container = document.getElementById("carousel-container");
  const images = container?.querySelectorAll(".carousel-ring img");
  
  if (!images || images.length === 0) {
    console.log('[carousel] No images found to update');
    return;
  }

  console.log(`[carousel] Found ${images.length} images to potentially update`);

  try {
    // Initialize Supabase client if not already done
    let client = window.supabaseClient;
    if (!client && typeof supabase !== "undefined") {
      console.log('[carousel] Creating Supabase client...');
      client = supabase.createClient(
        "https://wumakgzighvtvtvprnri.supabase.co",
        "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89"
      );
      window.supabaseClient = client;
    }

    if (!client) {
      console.log('[carousel] Supabase not available, using default images');
      return;
    }

    console.log('[carousel] Fetching URLs from database...');

    // Fetch carousel URLs from the site_assets table
    const { data, error } = await client
      .from("site_assets")
      .select("value")
      .eq("key", "carousel_images")
      .single();

    if (error) {
      console.warn('[carousel] Failed to load from database:', error);
      return;
    }

    // Extract the URLs array
    const urls = data?.value?.urls;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      console.log('[carousel] No URLs in database, using default images');
      return;
    }

    console.log('[carousel] Received URLs from database:', urls);

    // Update each image src with the database URL
    images.forEach((img, index) => {
      if (urls[index]) {
        const oldSrc = img.src;
        img.src = urls[index];
        console.log(`[carousel] Slot ${index + 1}: ${oldSrc} → ${urls[index]}`);
      }
    });

    console.log('[carousel] ✅ Successfully loaded all images from database');

  } catch (err) {
    console.warn('[carousel] Error loading carousel images:', err);
    // Fail silently and use default images
  }
}

// Run the function when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCarouselImagesFromDB);
} else {
  // DOM is already loaded, run immediately
  loadCarouselImagesFromDB();
}

// =============================
// IMAGE CAROUSEL – STEP 2 LAYOUT
// =============================
(function initCarouselLayout() {
  const container = document.getElementById("carousel-container");
  const images = container?.querySelectorAll("img");
  if (!container || !images.length) return;

  const count = images.length;
  const scale = 1.5; // enlarge by 50%
  const gap = 20; // px between images

  // base sizes to match CSS fallback
  const baseW = 220;
  const baseH = 200;

  const imgW = Math.round(baseW * scale);
  const imgH = Math.round(baseH * scale);

  // Set CSS variables for max dimensions (images will scale to fit)
  images.forEach((img) => {
    img.style.setProperty("--carousel-img-w", imgW + 'px');
    img.style.setProperty("--carousel-img-h", imgH + 'px');
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
})();

// =============================
// IMAGE RING – NEW INTERACTION CODE
// =============================

// Handle carousel interactions
if (ringContainer) {
  ringContainer.addEventListener("mouseleave", () => {
    // Only shrink active image when mouse leaves
    shrinkActiveImage();
  });

  ringContainer.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  
  // NEW: Trackpad swipe left/right → reverse rotation
  let lastSwipeTime = 0;
  
  ringContainer.addEventListener("wheel", (event) => {
    if (activeImage) return;
    
    const now = Date.now();
    if (now - lastSwipeTime < 300) return; // Prevent too frequent reversals
    
    // Detect horizontal scroll (trackpad left/right swipe)
    const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    
    if (isHorizontal) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('[carousel] horizontal swipe detected, reversing');
      reverseRotation();
      lastSwipeTime = now;
      
      if (!autoRotateTimer) {
        startAutoRotate();
      }
    }
  }, { passive: false });
}

// Auto-rotate logic
function startAutoRotate() {
  if (autoRotateTimer) return;
  console.log('[carousel] startAutoRotate');

  ring?.classList.remove("snap");
  autoRotateTimer = setInterval(() => {
    rotationY -= rotationSpeed;
    if (ring) ring.style.transform = `rotateY(${rotationY}rad)`;
  }, 16);
}

function stopAutoRotate() {
  console.log('[carousel] stopAutoRotate');
  clearInterval(autoRotateTimer);
  autoRotateTimer = null;
}

// NEW: Reverse rotation direction
function reverseRotation() {
  rotationSpeed = -rotationSpeed;
  console.log('[carousel] rotation reversed, new speed:', rotationSpeed);
}

function clearActiveImage() {
  if (!activeImage) return;
  activeImage.style.setProperty("--carousel-scale", "1");
  activeImage.classList.remove("is-active");
  activeImage = null;
}

function enlargeImage(img) {
  if (!img || !ring) return;
  stopAutoRotate();
  clearActiveImage();
  
  activeImage = img;
  activeImage.classList.add("is-active");
  activeImage.style.setProperty("--carousel-scale", "1.5");
  
  const angle = Number(img.dataset.angle || 0);
  const targetRotation = -angle * (Math.PI / 180);
  rotationY = targetRotation;
  ring.classList.add("snap");
  ring.style.transform = `rotateY(${rotationY}rad)`;

  setTimeout(() => {
    ring.classList.remove("snap");
  }, 700);
}

function shrinkActiveImage() {
  if (!activeImage) return;
  console.log('[carousel] shrinkActiveImage called - restoring size and restarting rotation');
  activeImage.style.setProperty("--carousel-scale", "1");
  activeImage.classList.remove("is-active");
  activeImage = null;
  
  // Always restart rotation when shrinking (if carousel is open)
  if (isOpen) {
    startAutoRotate();
  }
}

// Mouse movement tracking for direction change
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
      enlargeImage(target);
    }
  });

  ring.querySelectorAll("img").forEach((img) => {
    img.addEventListener("mouseenter", () => {
      lastMouseX = null;
    });

    img.addEventListener("mousemove", (event) => {
      if (!isOpen) return;
      if (activeImage) return; // Don't change direction when image is enlarged
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
// CLICK OUTSIDE CAROUSEL - CONSOLIDATED HANDLER
// This is the only click-outside handler. It detects clicks outside the carousel
// and shrinks any enlarged image while keeping the carousel rotating.
// =============================
document.addEventListener("click", (event) => {
  // Only handle clicks when carousel is open
  if (!isOpen) return;
  
  console.log('[carousel] document click detected, target:', event.target.tagName);
  
  const target = event.target;
  
  // Ignore clicks on the carousel trigger button - let the button handler deal with it
  if (ringButton && (target === ringButton || ringButton.contains(target))) {
    console.log('[carousel] click on button - ignoring');
    return;
  }
  
  // Ignore clicks inside the carousel container itself
  if (ringContainer?.contains(target)) {
    console.log('[carousel] click inside carousel - ignoring');
    return;
  }
  
  // If we reach here, the click is outside the carousel
  console.log('[carousel] click outside detected, activeImage:', !!activeImage);
  
  // Shrink the active image if there is one (this also restarts rotation)
  if (activeImage) {
    console.log('[carousel] calling shrinkActiveImage to restore size and resume rotation');
    shrinkActiveImage();
  }
  // If there's no active image, the carousel continues rotating normally - we do nothing
}, true); // Use capture phase to catch the event before it bubbles


// =============================
// ADMIN LOGIN HANDLER
// =============================
(function initAdminLogin() {
  const loginBox = document.getElementById("adminLoginBox");
  const loginBtn = document.getElementById("adminLoginBtn");
  const adminPanel = document.getElementById("adminPanel");
  const emailInput = document.getElementById("adminEmail");
  const passwordInput = document.getElementById("adminPassword");
  const loginMsg = document.getElementById("adminLoginMsg");

  if (!loginBox || !loginBtn) return;

  let isOpen = false;

  // Toggle panel visibility
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    
    if (!isOpen) {
      // Open the panel to show inputs
      isOpen = true;
      loginBox.classList.add("is-open");
      loginBtn.setAttribute("aria-expanded", "true");
      adminPanel.setAttribute("aria-hidden", "false");
      setTimeout(() => emailInput?.focus(), 150);
    } else {
      // Try to login
      const email = emailInput?.value?.trim();
      const password = passwordInput?.value?.trim();

      if (!email || !password) {
        loginMsg.textContent = "Please enter both email and password";
        return;
      }

      loginMsg.textContent = "Logging in...";

      try {
        // Initialize Supabase if needed
        let client = window.supabaseClient;
        if (!client && typeof supabase !== "undefined") {
          client = supabase.createClient(
            "https://wumakgzighvtvtvprnri.supabase.co",
            "sb_publishable_Li3EhE3QIYmYzdyRNeLIow_hxHRjM89"
          );
          window.supabaseClient = client;
        }

        if (!client) {
          loginMsg.textContent = "Error: Supabase not loaded";
          return;
        }

        const { data, error } = await client.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;

        loginMsg.textContent = "Success! Redirecting...";
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 500);

      } catch (err) {
        console.error("Login error:", err);
        loginMsg.textContent = "Login failed: " + err.message;
      }
    }
  });




  // Close panel when clicking outside
  document.addEventListener("click", (e) => {
    if (isOpen && !loginBox.contains(e.target)) {
      isOpen = false;
      loginBox.classList.remove("is-open");
      loginBtn.setAttribute("aria-expanded", "false");
      adminPanel.setAttribute("aria-hidden", "true");
      loginMsg.textContent = "";
    }
  });
})();

// ================================
// RIGHT SIDE: Tabs + Daily Game + Daily Question
// (Safe to append; does not change existing functions)
// ================================

// Tabs
(function initResumeRightTabs(){
  const btns = document.querySelectorAll(".pill-tab[data-tab]");
  const panels = document.querySelectorAll(".tab-panel");
  const cover = document.getElementById("rightCover");
  const closeBtn = document.getElementById("rightPanelClose");

  // 你左侧卡片的 class 可能不同：如果你不是 .left-card，就改成你左侧容器真实的class
  const leftCard = document.querySelector(".left-card") || document.querySelector(".resume-left") || document.querySelector("#resumeLeft");
  const rightCard = document.querySelector(".right-card") || document.querySelector(".resume-right") || document.querySelector("#resumeRight");

  if (!btns.length || !cover || !closeBtn) return;

  function hideAllPanels(){
    panels.forEach(p => p.classList.remove("active"));
    btns.forEach(b => b.classList.remove("active"));
  }

  function showCover(){
    cover.style.display = "block";
    closeBtn.style.display = "none";
    hideAllPanels();
    syncRightHeight();
  }

  function showPanel(tabId, btn){
    cover.style.display = "none";
    closeBtn.style.display = "inline-flex";
    hideAllPanels();
    btn.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
    // 面板显示后再同步高度
    setTimeout(syncRightHeight, 0);
  }

  function syncRightHeight(){
    if (!leftCard || !rightCard) return;
    // 让右侧至少和左侧一样高（如果右侧内容更高，它会自然变高）
    rightCard.style.minHeight = leftCard.offsetHeight + "px";
  }

  // ✅ 初始：只显示 cover
  showCover();

  // 点击 tab
  btns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const tabId = btn.dataset.tab;
      showPanel(tabId, btn);
    });
  });

  // 点击关闭
  closeBtn.addEventListener("click", showCover);

  // 窗口变化时同步
  window.addEventListener("load", syncRightHeight);
  window.addEventListener("resize", syncRightHeight);
})();





// Daily Question (rotates by date)
(function initDailyQuestion(){
  const qText = document.getElementById("qText");
  const qMeta = document.getElementById("qMeta");
  const input = document.getElementById("qAnswer");
  const btnCheck = document.getElementById("btnCheck");
  const btnReveal = document.getElementById("btnReveal");
  const feedback = document.getElementById("qFeedback");
  const refWrap = document.getElementById("qRefWrap");
  const qRef = document.getElementById("qRef");

  if (!qText || !qMeta || !btnCheck || !btnReveal) return;

  const QUESTIONS = [
    {
      q: "You discover a potential data leak affecting a small number of users. What are the first 3 actions you would take in the first 24 hours, and why?",
      ref: "Example reference: 1) Contain & preserve evidence (limit access, snapshot logs). 2) Triage scope/impact (what data, how many users, how it happened). 3) Notify the right stakeholders (security/legal/leadership) and assess notification obligations by jurisdiction & data type."
    },
    {
      q: "A third-party vendor handles user data. What key contract clauses would you insist on to manage privacy/security risk?",
      ref: "Example reference: Data processing terms, security standards, breach notification timelines, audit rights, subcontractor controls, data retention/deletion, cross-border transfer safeguards, and aligned liability/indemnity."
    },
    {
      q: "Leadership wants to ship a feature that collects more user data ASAP. How do you push back constructively while still enabling delivery?",
      ref: "Example reference: Clarify the goal, propose a privacy-minimizing alternative, explain concrete risks, set guardrails (minimization/retention/consent), and offer a phased plan with measurable milestones."
    }
  ];

  const idx = pickDailyIndex(QUESTIONS.length);
  const item = QUESTIONS[idx];

  qText.textContent = item.q;
  qMeta.textContent = `Today (${getTodayKey()}): Question #${idx + 1} — rotates daily.`;

  function showFeedback(text){
    feedback.style.display = "block";
    feedback.textContent = text;
  }

  btnCheck.addEventListener("click", ()=>{
    const ans = (input.value || "").trim();
    if (!ans) {
      showFeedback("Write a short answer first (3–6 sentences). Then click again for feedback.");
      return;
    }

    const hasSteps = /(1|first|second|third|then|next)/i.test(ans);
    const mentionsCore = /(risk|impact|scope|evidence|notify|legal|privacy|security|stakeholder)/i.test(ans);
    const concise = ans.length <= 900;

    const tips = [];
    if (!hasSteps) tips.push("Try structuring it as 3 clear steps (1/2/3).");
    if (!mentionsCore) tips.push("Add core keywords: scope, evidence, notification, stakeholders, risk/impact.");
    if (!concise) tips.push("Make it tighter: 4–6 sentences is ideal.");

    const score = (hasSteps?1:0) + (mentionsCore?1:0) + (concise?1:0);

    showFeedback(
      `Quick feedback: ${score}/3\n` +
      (tips.length ? `Improve:\n- ${tips.join("\n- ")}` : "Nice structure. Compare with the reference answer if you want.")
    );
  });

  btnReveal.addEventListener("click", ()=>{
    refWrap.style.display = "block";
    qRef.textContent = item.ref;
  });
})();

// =======================================
// MINI GAMES: Tetris / Match-3 / 24 Cards
// (Daily rotation by date, same for everyone)
// =======================================
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function pickDailyIndex(len){
  const s = getTodayKey().replaceAll("-", ""); // YYYYMMDD
  let n = 0;
  for (const ch of s) n = (n * 10 + (ch.charCodeAt(0) - 48)) % 1000000;
  return n % len;
}
function lsGet(key, fallback){
  try { const v = localStorage.getItem(key); return v===null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function lsSet(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// -------- Game 1: Tetris (simplified) --------
function gameTetris(mount) {
  mount.innerHTML = `
    <div class="game-title">🧱 Tetris</div>
    <div class="game-muted">Controls: ← → ↓ / ↑ rotate / Space hard drop / P pause / R restart</div>
    <div class="game-muted">Click Restart to begin.</div>
    <div class="game-row">
      <span id="tScore" class="game-pill">Score: 0</span>
      <span id="tBest" class="game-pill">Best today: —</span>
      <button id="tRestart" class="btn-ghost" type="button">Restart</button>
      <button id="tPause" class="btn-ghost" type="button">Pause</button>
    </div>
    
    <div class="game-area tetris-wrap">
      <canvas id="tCanvas" width="200" height="400"></canvas>
    </div>
  `;

  const canvas = mount.querySelector("#tCanvas");
  const ctx = canvas.getContext("2d");

  const today = getTodayKey();
  const bestKey = `best_tetris_${today}`;
  let best = lsGet(bestKey, null);

  const bestEl = mount.querySelector("#tBest");
  const scoreEl = mount.querySelector("#tScore");
  const restartBtn = mount.querySelector("#tRestart");
  const pauseBtn = mount.querySelector("#tPause");

  function renderBest(){ bestEl.textContent = best==null ? "Best today: —" : `Best today: ${best}`; }
  renderBest();

  const COLS=10, ROWS=20, SIZE=20;
  const board = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));

  const SHAPES = {
    I:[[1,1,1,1]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1]],
    S:[[0,1,1],[1,1,0]],
    Z:[[1,1,0],[0,1,1]],
    J:[[1,0,0],[1,1,1]],
    L:[[0,0,1],[1,1,1]],
  };
  const KEYS = Object.keys(SHAPES);


let score=0, paused=true, over=false;
let running=false;
let rafId=null;

  function rotate(mat){
    const h=mat.length, w=mat[0].length;
    const res=Array.from({length:w}, ()=>Array(h).fill(0));
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) res[x][h-1-y]=mat[y][x];
    return res;
  }

  function randPiece(){
    const k = KEYS[Math.floor(Math.random()*KEYS.length)];
    const m = SHAPES[k].map(r=>r.slice());
    return { m, x: Math.floor((COLS-m[0].length)/2), y: 0 };
  }
  let piece = randPiece();

  function collide(px,py,mat){
    for(let y=0;y<mat.length;y++){
      for(let x=0;x<mat[0].length;x++){
        if(!mat[y][x]) continue;
        const bx=px+x, by=py+y;
        if(bx<0||bx>=COLS||by>=ROWS) return true;
        if(by>=0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function merge(){
    for(let y=0;y<piece.m.length;y++){
      for(let x=0;x<piece.m[0].length;x++){
        if(!piece.m[y][x]) continue;
        const by=piece.y+y, bx=piece.x+x;
        if(by>=0) board[by][bx]=1;
      }
    }
  }

  function clearLines(){
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){
      if(board[y].every(v=>v===1)){
        board.splice(y,1);
        board.unshift(Array(COLS).fill(0));
        cleared++; y++;
      }
    }
    if(cleared){
      score += [0,100,300,500,800][cleared] || cleared*200;
      scoreEl.textContent = `Score: ${score}`;
    }
  }

  function lockNext(){
    merge();
    clearLines();
    piece = randPiece();
    if(collide(piece.x,piece.y,piece.m)){
      over=true;
      if(best==null || score>best){ best=score; lsSet(bestKey,best); renderBest(); }
    }
  }

  function hardDrop(){
    while(!collide(piece.x,piece.y+1,piece.m)) piece.y++;
    lockNext();
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        if(board[y][x]) ctx.fillRect(x*SIZE,y*SIZE,SIZE-1,SIZE-1);
      }
    }
    for(let y=0;y<piece.m.length;y++){
      for(let x=0;x<piece.m[0].length;x++){
        if(!piece.m[y][x]) continue;
        ctx.fillRect((piece.x+x)*SIZE,(piece.y+y)*SIZE,SIZE-1,SIZE-1);
      }
    }
    if(over) ctx.fillText("GAME OVER", 55, 200);
  }

  let last=0, acc=0, interval=600;
  function loop(ts){
   if (!running) return;   // ✅ 不运行就退出，不会自动开始
    if(!last) last=ts;
    const dt=ts-last; last=ts;
    if(!paused && !over){
      acc+=dt;
      if(acc>interval){
        acc=0;
        if(!collide(piece.x,piece.y+1,piece.m)) piece.y++;
        else lockNext();
      }
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function restart(){
    for(let y=0;y<ROWS;y++) board[y].fill(0);
    score=0; paused=false; over=false;
    piece = randPiece();
    scoreEl.textContent = `Score: ${score}`;
  }
  function start(){
  if (running) return;
  running = true;
  paused = false;
  last = 0;
  acc = 0;
  rafId = requestAnimationFrame(loop);
}

function stop(){
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function restartAndStart(){
  restart();
  start();
}

  
  restartBtn.addEventListener("click", restartAndStart);
pauseBtn.addEventListener("click", ()=> {
  if (!running) return;
  paused = !paused;
});

function onKey(e){
  if(document.activeElement && ["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;

  // ✅ 关键：阻止方向键/空格滚动页面（只在Tetris运行时）
  const blockKeys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "];
  if (running && blockKeys.includes(e.key)) {
    e.preventDefault();
  }

  if(e.key==="p"||e.key==="P") paused=!paused;
  if(e.key==="r"||e.key==="R") restartAndStart(); // 我下面会让你加这个函数
  if(!running || paused || over) return;

  if(e.key==="ArrowLeft" && !collide(piece.x-1,piece.y,piece.m)) piece.x--;
  else if(e.key==="ArrowRight" && !collide(piece.x+1,piece.y,piece.m)) piece.x++;
  else if(e.key==="ArrowDown" && !collide(piece.x,piece.y+1,piece.m)) piece.y++;
  else if(e.key==="ArrowUp"){
    const rm=rotate(piece.m);
    if(!collide(piece.x,piece.y,rm)) piece.m=rm;
  } else if(e.key===" "){
    hardDrop();
  }
}

  window.addEventListener("keydown", onKey, { passive:false });

  draw();
scoreEl.textContent = `Score: ${score}`;
bestEl.textContent = best==null ? "Best today: —" : `Best today: ${best}`;

}

// -------- Game 2: Match-3 (simplified) --------
function gameMatch3(mount){
  mount.innerHTML = `
    <div class="game-title">🍬 Match-3</div>
    <div class="game-muted">Click two adjacent blocks to swap. Make 3+ to clear.</div>
    <div class="game-row">
      <span id="mScore" class="game-pill">Score: 0</span>
      <span id="mBest" class="game-pill">Best today: —</span>
      <button id="mNew" class="btn-ghost" type="button">New board</button>
    </div>
    <div id="mGrid" class="m3-grid"></div>
  `;

  const today=getTodayKey();
  const bestKey=`best_match3_${today}`;
  let best=lsGet(bestKey,null);
  const scoreEl=mount.querySelector("#mScore");
  const bestEl=mount.querySelector("#mBest");
  const gridEl=mount.querySelector("#mGrid");

  const N=8;
  const TYPES=["A","B","C","D","E","F"];
  const grid=Array.from({length:N}, ()=>Array(N).fill("A"));
  let score=0;
  let first=null;

  function renderBest(){ bestEl.textContent = best==null ? "Best today: —" : `Best today: ${best}`; }
  renderBest();

  function randType(){ return TYPES[Math.floor(Math.random()*TYPES.length)]; }

  function initBoard(){
    score=0; first=null;
    scoreEl.textContent=`Score: ${score}`;
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        let t;
        do{
          t=randType();
        }while(
          (c>=2 && grid[r][c-1]===t && grid[r][c-2]===t) ||
          (r>=2 && grid[r-1][c]===t && grid[r-2][c]===t)
        );
        grid[r][c]=t;
      }
    }
    render();
  }

  function render(){
    gridEl.innerHTML="";
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const d=document.createElement("div");
        d.className="m3-cell";
        d.dataset.r=r; d.dataset.c=c;
        d.textContent=grid[r][c];
        if(first && first.r===r && first.c===c) d.classList.add("selected");
        gridEl.appendChild(d);
      }
    }
  }

  function adjacent(a,b){ return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1; }

  function findMatches(){
    const marked=Array.from({length:N},()=>Array(N).fill(false));
    for(let r=0;r<N;r++){
      let c=0;
      while(c<N){
        const t=grid[r][c];
        let k=c+1;
        while(k<N && grid[r][k]===t) k++;
        if(t && k-c>=3) for(let x=c;x<k;x++) marked[r][x]=true;
        c=k;
      }
    }
    for(let c=0;c<N;c++){
      let r=0;
      while(r<N){
        const t=grid[r][c];
        let k=r+1;
        while(k<N && grid[k][c]===t) k++;
        if(t && k-r>=3) for(let x=r;x<k;x++) marked[x][c]=true;
        r=k;
      }
    }
    return marked;
  }
  function anyMarked(m){
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(m[r][c]) return true;
    return false;
  }
  function clearMarked(m){
    let cleared=0;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(m[r][c]){ grid[r][c]=null; cleared++; }
    }
    if(cleared){
      score += cleared*10;
      scoreEl.textContent=`Score: ${score}`;
    }
  }
  function dropRefill(){
    for(let c=0;c<N;c++){
      let w=N-1;
      for(let r=N-1;r>=0;r--){
        if(grid[r][c]!=null){
          grid[w][c]=grid[r][c];
          if(w!==r) grid[r][c]=null;
          w--;
        }
      }
      for(let r=w;r>=0;r--) grid[r][c]=randType();
    }
  }
  function resolve(){
    let loops=0;
    while(loops<10){
      const m=findMatches();
      if(!anyMarked(m)) break;
      clearMarked(m);
      dropRefill();
      loops++;
    }
    if(best==null || score>best){ best=score; lsSet(bestKey,best); renderBest(); }
    render();
  }
  function swap(a,b){
    const tmp=grid[a.r][a.c];
    grid[a.r][a.c]=grid[b.r][b.c];
    grid[b.r][b.c]=tmp;
  }

  gridEl.addEventListener("click",(e)=>{
    const cell=e.target.closest(".m3-cell");
    if(!cell) return;
    const cur={ r:Number(cell.dataset.r), c:Number(cell.dataset.c) };

    if(!first){ first=cur; render(); return; }
    if(first.r===cur.r && first.c===cur.c){ first=null; render(); return; }
    if(!adjacent(first,cur)){ first=cur; render(); return; }

    swap(first,cur);
    const m=findMatches();
    if(anyMarked(m)){ first=null; resolve(); }
    else { swap(first,cur); first=null; render(); }
  });

  mount.querySelector("#mNew").addEventListener("click", initBoard);
  initBoard();
}

// -------- Game 3: 24 Cards --------
function game24(mount){
  mount.innerHTML = `
    <div class="game-title">🃏 24 Cards</div>
    <div class="game-muted">Use all 4 numbers exactly once with + - * / ( ) to make 24.</div>
    <div id="cardsRow" class="card24-row"></div>
    <div class="game-row">
      <input id="expr" class="game-input" placeholder="Example: (8-4) * (7-1)" />
    </div>
    <div class="game-row">
      <button id="check24" class="btn-primary" type="button">Check</button>
      <button id="new24" class="btn-ghost" type="button">New hand</button>
      <span id="best24" class="game-pill">Best today: —</span>
    </div>
    <div id="msg24" class="game-muted"></div>
  `;

  const today=getTodayKey();
  const bestKey=`best_24_${today}`;
  let best=lsGet(bestKey,null);
  const bestEl=mount.querySelector("#best24");
  const cardsRow=mount.querySelector("#cardsRow");
  const exprEl=mount.querySelector("#expr");
  const msgEl=mount.querySelector("#msg24");

  function renderBest(){ bestEl.textContent = best==null ? "Best today: —" : `Best today: ${best} attempts`; }
  renderBest();

  let nums=[], attempts=0;

  function drawCards(){
    cardsRow.innerHTML="";
    nums.forEach(n=>{
      const d=document.createElement("div");
      d.className="card24";
      d.textContent=String(n);
      cardsRow.appendChild(d);
    });
  }
  function newHand(){
    attempts=0;
    nums=Array.from({length:4},()=>1+Math.floor(Math.random()*13));
    drawCards();
    exprEl.value="";
    msgEl.textContent="Type an expression using all 4 numbers exactly once.";
  }

  function isSafeExpr(expr){ return /^[0-9+\-*/().\s]+$/.test(expr); }
  function countNums(expr){ return (expr.match(/\d+/g)||[]).map(Number); }
  function sameMultiset(a,b){
    return [...a].sort((x,y)=>x-y).join(",")===[...b].sort((x,y)=>x-y).join(",");
  }

  function check(){
    const expr=(exprEl.value||"").trim();
    if(!expr){ msgEl.textContent="Please enter an expression."; return; }
    if(!isSafeExpr(expr)){ msgEl.textContent="Only use numbers and + - * / ( )."; return; }

    const used=countNums(expr);
    if(used.length!==4 || !sameMultiset(used,nums)){
      msgEl.textContent=`You must use exactly these numbers once: ${nums.join(", ")}.`;
      return;
    }

    attempts++;
    let val;
    try{ val = Function(`"use strict"; return (${expr});`)(); }
    catch{ msgEl.textContent="Invalid expression."; return; }

    const ok = Math.abs(val-24)<1e-6;
    if(ok){
      msgEl.textContent=`✅ Correct! Attempts: ${attempts}.`;
      if(best==null || attempts<best){ best=attempts; lsSet(bestKey,best); renderBest(); }
    } else {
      msgEl.textContent=`❌ Got ${val}. Attempts: ${attempts}. Try again.`;
    }
  }

  mount.querySelector("#check24").addEventListener("click", check);
  mount.querySelector("#new24").addEventListener("click", newHand);
  newHand();
}

// -------- Mount daily game --------
(function initDailyGame(){
  const mount=document.getElementById("gameMount");
  const meta=document.getElementById("gameMeta");
  if(!mount || !meta) return;

  const games=[
    { title:"Tetris", fn: gameTetris },
    { title:"Match-3", fn: gameMatch3 },
    { title:"24 Cards", fn: game24 },
  ];

  const idx=pickDailyIndex(games.length);
  const g=games[idx];
  g.fn(mount);
  meta.textContent = `Today (${getTodayKey()}): ${g.title} — rotates daily.`;
})();
