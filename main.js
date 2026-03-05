import { BarcodeDetector } from "barcode-detector/pure";
import { supabase } from "./supabase.js";

// ==================== DOM ELEMENTS ====================
const video = document.getElementById("video");
const resultDiv = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const saveSection = document.getElementById("save-section");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const barcodeDisplay = document.getElementById("barcode-display");
const descriptionInput = document.getElementById("description");
const imageInput = document.getElementById("image-input");
const saveMessage = document.getElementById("save-message");
const itemsList = document.getElementById("items-list");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");

const authSection = document.getElementById("auth-section");
const scannerSection = document.getElementById("scanner-section");
const historySection = document.getElementById("history-section");

// Auth Elements
const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupConfirm = document.getElementById("signup-confirm");
const strengthFill = document.getElementById("strength-fill");
const strengthText = document.getElementById("strength-text");
const authLoading = document.getElementById("auth-loading");
const authMessage = document.getElementById("auth-message");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");

// ==================== APP STATE ====================
let detector;
let scanning = false;
let currentBarcode = null;
let currentUser = null;

// ==================== UTILITY FUNCTIONS ====================
function showLoading(show) {
  authLoading.classList.toggle("hidden", !show);
  loginBtn.disabled = show;
  signupBtn.disabled = show;
}

function showMessage(text, type = "info") {
  authMessage.textContent = text;
  authMessage.className = type;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return strength;
}

function updatePasswordStrength(password) {
  const strength = checkPasswordStrength(password);
  const colors = ["#dc3545", "#dc3545", "#ffc107", "#28a745", "#28a745", "#28a745"];
  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  
  const percentage = (strength / 5) * 100;
  strengthFill.style.width = `${percentage}%`;
  strengthFill.style.background = colors[strength];
  strengthText.textContent = password ? labels[strength] : "Password strength";
  strengthText.style.color = colors[strength];
  
  return strength >= 3;
}

// ==================== TAB SWITCHING ====================
tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  showMessage("");
});

tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  showMessage("");
});

// ==================== PASSWORD STRENGTH LIVE FEEDBACK ====================
signupPassword.addEventListener("input", () => {
  updatePasswordStrength(signupPassword.value);
});

// ==================== AUTH FUNCTIONS ====================
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  return currentUser;
}

function showAuth() {
  authSection.classList.remove("hidden");
  scannerSection.classList.add("hidden");
  historySection.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
}

function showApp() {
  authSection.classList.add("hidden");
  scannerSection.classList.remove("hidden");
  historySection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  loadHistory();
}

async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  
  if (!validateEmail(email)) {
    showMessage("❌ Please enter a valid email", "error");
    return;
  }
  
  if (!password) {
    showMessage("❌ Please enter your password", "error");
    return;
  }
  
  showLoading(true);
  showMessage("");
  
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) throw error;
    
    showMessage("✅ Login successful!", "success");
    await checkAuth();
    showApp();
    
  } catch (err) {
    console.error(err);
    showMessage("❌ " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

async function handleSignup() {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirm = signupConfirm.value;
  
  if (!validateEmail(email)) {
    showMessage("❌ Please enter a valid email", "error");
    return;
  }
  
  if (password.length < 6) {
    showMessage("❌ Password must be at least 6 characters", "error");
    return;
  }
  
  if (password !== confirm) {
    showMessage("❌ Passwords don't match", "error");
    return;
  }
  
  const isStrong = updatePasswordStrength(password);
  if (!isStrong) {
    showMessage("⚠️ Please use a stronger password", "error");
    return;
  }
  
  showLoading(true);
  showMessage("");
  
  try {
    const { error: signupError } = await supabase.auth.signUp({ email, password });
    
    if (signupError) throw signupError;
    
    // Auto-login after signup
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (loginError) throw loginError;
    
    showMessage("✅ Account created! Redirecting...", "success");
    
    setTimeout(async () => {
      await checkAuth();
      showApp();
    }, 1000);
    
  } catch (err) {
    console.error(err);
    
    if (err.message.includes("User already registered")) {
      showMessage("❌ This email is already registered. Try logging in!", "error");
    } else if (err.message.includes("weak password")) {
      showMessage("❌ Password is too weak. Use numbers & special characters.", "error");
    } else {
      showMessage("❌ " + err.message, "error");
    }
  } finally {
    showLoading(false);
  }
}

async function handleLogout() {
  showLoading(true);
  
  try {
    await supabase.auth.signOut();
    currentUser = null;
    showAuth();
    showMessage("✅ Logged out successfully", "success");
    
    loginEmail.value = "";
    loginPassword.value = "";
    signupEmail.value = "";
    signupPassword.value = "";
    signupConfirm.value = "";
    updatePasswordStrength("");
    
  } catch (err) {
    showMessage("❌ " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// Auth Event Listeners
loginBtn.addEventListener("click", handleLogin);
signupBtn.addEventListener("click", handleSignup);
logoutBtn.addEventListener("click", handleLogout);

loginPassword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLogin();
});

signupConfirm.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSignup();
});

supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    currentUser = null;
    showAuth();
  }
});

// ==================== SCANNER FUNCTIONS ====================
async function startScanner() {
  startBtn.disabled = true;
  resultDiv.textContent = "📷 Starting camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = stream;
    await video.play();

    detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"]
    });

    resultDiv.textContent = "🔍 Scanning...";
    scanning = true;
    scanLoop();

  } catch (err) {
    console.error(err);
    resultDiv.textContent = "❌ Camera error: " + err.message;
    startBtn.disabled = false;
    startBtn.textContent = "▶️ Try Again";
  }
}

async function scanLoop() {
  if (!scanning || !detector) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    try {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        currentBarcode = barcodes[0].rawValue;
        resultDiv.textContent = "✅ Scanned: " + currentBarcode;
        if (navigator.vibrate) navigator.vibrate(200);
        
        scanning = false;
        startBtn.disabled = false;
        startBtn.textContent = "🔄 Scan Again";
        
        barcodeDisplay.value = currentBarcode;
        saveSection.classList.remove("hidden");
        return;
      }
    } catch (err) {
      // Silent - normal for empty frames
    }
  }
  requestAnimationFrame(scanLoop);
}

startBtn.addEventListener("click", () => {
  if (scanning) return;
  saveSection.classList.add("hidden");
  startScanner();
});

cancelBtn.addEventListener("click", () => {
  saveSection.classList.add("hidden");
  resultDiv.textContent = "Waiting...";
  descriptionInput.value = "";
  imageInput.value = "";
  saveMessage.textContent = "";
});

// ==================== SAVE ITEM FUNCTION ====================
async function saveItem() {
  if (!currentBarcode || !currentUser) return;
  
  saveBtn.disabled = true;
  saveMessage.textContent = "⏳ Saving...";
  saveMessage.className = "";

  try {
    const description = descriptionInput.value.trim();
    let imageUrl = null;

    if (imageInput.files[0]) {
      const file = imageInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrl;
    }

    const { error: dbError } = await supabase
      .from('items')
      .insert([{
        user_id: currentUser.id,
        barcode: currentBarcode,
        description: description || null,
        image_url: imageUrl || null
      }]);

    if (dbError) throw dbError;

    saveMessage.textContent = "✅ Saved successfully!";
    saveMessage.className = "success";
    
    descriptionInput.value = "";
    imageInput.value = "";
    
    await loadHistory();

    setTimeout(() => {
      saveSection.classList.add("hidden");
      resultDiv.textContent = "Waiting...";
      saveMessage.textContent = "";
    }, 2000);

  } catch (err) {
    console.error(err);
    saveMessage.textContent = "❌ Error: " + err.message;
    saveMessage.className = "error";
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener("click", saveItem);

// ==================== LOAD HISTORY FUNCTION ====================
async function loadHistory() {
  itemsList.innerHTML = "<p>⏳ Loading...</p>";
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    itemsList.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    itemsList.innerHTML = "<p>📭 No items yet. Scan something!</p>";
    return;
  }

  itemsList.innerHTML = data.map(item => `
    <div class="item-card">
      ${item.image_url ? `<img src="${item.image_url}" alt="Item photo"><br>` : ''}
      <strong>📦 Barcode:</strong> ${item.barcode}<br>
      <strong>📝 Description:</strong> ${item.description || '—'}<br>
      <strong>🕐 Scanned:</strong> ${new Date(item.created_at).toLocaleString()}
    </div>
  `).join('');
}

loadHistoryBtn.addEventListener("click", loadHistory);

// ==================== INITIALIZATION ====================
async function init() {
  await checkAuth();
  if (currentUser) {
    showApp();
  } else {
    showAuth();
  }
}

init();