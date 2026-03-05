import { BarcodeDetector } from "barcode-detector/pure";
import { supabase } from "./supabase.js"; // adjust path if needed

// DOM Elements
const video = document.getElementById("video");
const resultDiv = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const saveSection = document.getElementById("save-section");
const saveBtn = document.getElementById("saveBtn");
const descriptionInput = document.getElementById("description");
const imageInput = document.getElementById("image-input");
const saveMessage = document.getElementById("save-message");
const itemsList = document.getElementById("items-list");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");

// Auth Elements
const authSection = document.getElementById("auth-section");
const scannerSection = document.getElementById("scanner-section");
const historySection = document.getElementById("history-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMessage = document.getElementById("auth-message");

// App State
let detector;
let scanning = false;
let currentBarcode = null;

// ==================== AUTH FUNCTIONS ====================
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showApp();
  } else {
    showAuth();
  }
}

function showAuth() {
  authSection.style.display = "block";
  scannerSection.style.display = "none";
  historySection.style.display = "none";
}

function showApp() {
  authSection.style.display = "none";
  scannerSection.style.display = "block";
  historySection.style.display = "block";
  loadHistory();
}

signupBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    authMessage.textContent = "❌ " + error.message;
    authMessage.style.color = "red";
  } else {
    authMessage.textContent = "✅ Check email for confirmation!";
    authMessage.style.color = "green";
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authMessage.textContent = "❌ " + error.message;
    authMessage.style.color = "red";
  } else {
    authMessage.textContent = "";
    showApp();
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
  // Reset UI
  resultDiv.textContent = "Waiting...";
  saveSection.style.display = "none";
  itemsList.innerHTML = "";
});

// Listen for auth changes (e.g., page refresh)
supabase.auth.onAuthStateChange((event, session) => {
  if (session) showApp();
  else showAuth();
});

// ==================== SCANNER FUNCTIONS ====================
async function startScanner() {
  startBtn.disabled = true;
  resultDiv.textContent = "Starting camera...";

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

    resultDiv.textContent = "Scanning...";
    scanning = true;
    scanLoop();

  } catch (err) {
    console.error(err);
    resultDiv.textContent = "Camera error: " + err.message;
    startBtn.disabled = false;
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
        startBtn.textContent = "Scan Again";
        
        // Show save section
        saveSection.style.display = "block";
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
  saveSection.style.display = "none";
  startScanner();
});

// ==================== SAVE ITEM FUNCTION ====================
saveBtn.addEventListener("click", async () => {
  if (!currentBarcode) return;
  
  saveBtn.disabled = true;
  saveMessage.textContent = "Saving...";

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const description = descriptionInput.value || "";
    let imageUrl = null;

    // Upload image if selected
    if (imageInput.files[0]) {
      const file = imageInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('item-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(fileName);
    }

    // Save to database
    const { error: dbError } = await supabase
      .from('items')
      .insert([{
        user_id: user.id,
        barcode: currentBarcode,
        description,
        image_url: imageUrl
      }]);

    if (dbError) throw dbError;

    saveMessage.textContent = "✅ Saved!";
    saveMessage.style.color = "green";
    
    // Reset form
    descriptionInput.value = "";
    imageInput.value = "";
    
    // Refresh history
    loadHistory();

  } catch (err) {
    console.error(err);
    saveMessage.textContent = "❌ Error: " + err.message;
    saveMessage.style.color = "red";
  } finally {
    saveBtn.disabled = false;
  }
});

// ==================== LOAD HISTORY ====================
async function loadHistory() {
  itemsList.innerHTML = "<p>Loading...</p>";
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    itemsList.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
    return;
  }

  if (data.length === 0) {
    itemsList.innerHTML = "<p>No items yet. Scan something!</p>";
    return;
  }

  itemsList.innerHTML = data.map(item => `
    <div style="border:1px solid #ccc; padding:10px; margin:10px 0; border-radius:8px">
      ${item.image_url ? `<img src="${item.image_url}" style="max-width:100px; max-height:100px"><br>` : ''}
      <strong>Barcode:</strong> ${item.barcode}<br>
      <strong>Description:</strong> ${item.description || '—'}<br>
      <small>${new Date(item.created_at).toLocaleString()}</small>
    </div>
  `).join('');
}

loadHistoryBtn.addEventListener("click", loadHistory);

// ==================== INIT ====================
checkAuth();