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
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMessage = document.getElementById("auth-message");

// ==================== APP STATE ====================
let detector;
let scanning = false;
let currentBarcode = null;
let currentUser = null;

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
}

function showApp() {
  authSection.classList.add("hidden");
  scannerSection.classList.remove("hidden");
  historySection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  loadHistory();
}

async function handleSignUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    authMessage.textContent = "❌ Please enter email and password";
    authMessage.className = "error";
    return;
  }

  const { error } = await supabase.auth.signUp({ email, password });
  
  if (error) {
    authMessage.textContent = "❌ " + error.message;
    authMessage.className = "error";
  } else {
    authMessage.textContent = "✅ Check email for confirmation link!";
    authMessage.className = "success";
  }
}

async function handleSignIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    authMessage.textContent = "❌ Please enter email and password";
    authMessage.className = "error";
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    authMessage.textContent = "❌ " + error.message;
    authMessage.className = "error";
  } else {
    authMessage.textContent = "";
    await checkAuth();
    showApp();
  }
}

async function handleSignOut() {
  await supabase.auth.signOut();
  currentUser = null;
  showAuth();
  resultDiv.textContent = "Waiting...";
  saveSection.classList.add("hidden");
  itemsList.innerHTML = "";
  startBtn.textContent = "▶️ Start Scanner";
  startBtn.disabled = false;
  scanning = false;
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

// Auth Event Listeners
signupBtn.addEventListener("click", handleSignUp);
loginBtn.addEventListener("click", handleSignIn);
logoutBtn.addEventListener("click", handleSignOut);

// Listen for auth state changes
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
        
        // Show save section
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

    // Upload image if selected
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

    // Save to database
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
    
    // Reset form
    descriptionInput.value = "";
    imageInput.value = "";
    
    // Refresh history
    await loadHistory();

    // Hide save section after 2 seconds
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