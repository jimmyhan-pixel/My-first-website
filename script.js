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
// IMAGE RING – STEP 2: OPEN + AUTO ROTATE
// =============================

// =============================
// IMAGE RING – NEW INTERACTION CODE
// =============================

// Pause on hover + resume only when open
if (ringContainer) {
  ringContainer.addEventListener("mouseenter", () => {
    if (!activeImage) {
      stopAutoRotate();
    }
  });

  ringContainer.addEventListener("mouseleave", () => {
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
  activeImage.style.setProperty("--carousel-scale", "1");
  activeImage.classList.remove("is-active");
  activeImage = null;
  
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

// Close carousel when clicking outside (keeping this functionality)
document.addEventListener("click", (event) => {
  if (!isOpen) return;
  const target = event.target;
  if (ringContainer?.contains(target)) return;
  if (ringButton && target === ringButton) return;
  setCarouselOpenState(false);
});

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

  
})();
