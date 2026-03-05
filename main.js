import { BarcodeDetector } from "barcode-detector/pure";

// ===== DOM Elements =====
const barcodeInput = document.getElementById("barcodeInput");
const scanBtn = document.getElementById("scanBtn");
const confirmBarcodeBtn = document.getElementById("confirmBarcodeBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const scannerVideo = document.getElementById("scannerVideo");
const scannerCanvas = document.getElementById("scannerCanvas");

const photoVideo = document.getElementById("photoVideo");
const photoCanvas = document.getElementById("photoCanvas");
const photoPreview = document.getElementById("photoPreview");
const takePhotoBtn = document.getElementById("takePhotoBtn");
const retakePhotoBtn = document.getElementById("retakePhotoBtn");
const confirmPhotoBtn = document.getElementById("confirmPhotoBtn");

const displayBarcode = document.getElementById("displayBarcode");
const finalPhoto = document.getElementById("finalPhoto");
const notesInput = document.getElementById("notesInput");
const submitBtn = document.getElementById("submitBtn");
const retakeAllBtn = document.getElementById("retakeAllBtn");

const resultBox = document.getElementById("resultBox");
const resBarcode = document.getElementById("resBarcode");
const resNotes = document.getElementById("resNotes");
const resPhoto = document.getElementById("resPhoto");
const jsonOutput = document.getElementById("jsonOutput");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const newScanBtn = document.getElementById("newScanBtn");

const status = document.getElementById("status");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

// ===== State =====
let detector;
let scanning = false;
let scannerStream = null;
let photoStream = null;
let photoBase64 = "";

// ===== STEP 1: BARCODE INPUT (Scan OR Type) =====

// Enable "Continue" when barcode has value
barcodeInput.addEventListener("input", () => {
  confirmBarcodeBtn.disabled = !barcodeInput.value.trim();
});

async function startScanner() {
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" }, width: { ideal: 1280 } }
    });
    
    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();
    scannerVideo.classList.add("active");
    
    scanBtn.classList.add("hidden");
    stopScanBtn.classList.remove("hidden");
    barcodeInput.disabled = true;
    
    detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"]
    });
    
    scanning = true;
    status.textContent = "🔍 Scanning... Point at barcode";
    scanLoop();
  } catch (err) {
    status.textContent = "❌ Camera error: " + err.message;
    scanBtn.disabled = false;
  }
}

async function scanLoop() {
  if (!scanning || !detector || scannerVideo.readyState !== scannerVideo.HAVE_ENOUGH_DATA) {
    if (scanning) requestAnimationFrame(scanLoop);
    return;
  }

  try {
    const barcodes = await detector.detect(scannerVideo);
    if (barcodes.length > 0) {
      const code = barcodes[0].rawValue.trim();
      barcodeInput.value = code;
      confirmBarcodeBtn.disabled = false;
      status.textContent = "✅ Barcode detected!";
      if (navigator.vibrate) navigator.vibrate(100);
      
      // Auto-stop scanner after success
      stopScanner();
    }
  } catch (e) { /* ignore */ }
  
  if (scanning) requestAnimationFrame(scanLoop);
}

function stopScanner() {
  scanning = false;
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  scannerVideo.classList.remove("active");
  scannerVideo.srcObject = null;
  
  scanBtn.classList.remove("hidden");
  stopScanBtn.classList.add("hidden");
  barcodeInput.disabled = false;
  barcodeInput.focus();
}

// ===== STEP 2: PHOTO CAPTURE =====
async function startPhotoCamera() {
  try {
    photoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    photoVideo.srcObject = photoStream;
    await photoVideo.play();
    photoVideo.classList.add("active");
    takePhotoBtn.classList.remove("hidden");
  } catch (err) {
    status.textContent = "❌ Photo camera error: " + err.message;
  }
}

function capturePhoto() {
  photoCanvas.width = photoVideo.videoWidth || 1280;
  photoCanvas.height = photoVideo.videoHeight || 720;
  const ctx = photoCanvas.getContext("2d");
  ctx.drawImage(photoVideo, 0, 0, photoCanvas.width, photoCanvas.height);
  
  // Stop stream
  photoStream.getTracks().forEach(t => t.stop());
  photoVideo.classList.remove("active");
  takePhotoBtn.classList.add("hidden");
  
  // Generate preview
  photoBase64 = photoCanvas.toDataURL("image/jpeg", 0.85);
  photoPreview.src = photoBase64;
  photoPreview.classList.add("active");
  
  retakePhotoBtn.classList.remove("hidden");
  confirmPhotoBtn.classList.remove("hidden");
}

function retakePhotoOnly() {
  photoPreview.classList.remove("active");
  retakePhotoBtn.classList.add("hidden");
  confirmPhotoBtn.classList.add("hidden");
  startPhotoCamera();
}

// ===== STEP 3: NOTES + SUBMIT =====
function prepareSubmit() {
  const barcode = barcodeInput.value.trim();
  displayBarcode.textContent = barcode;
  finalPhoto.src = photoBase64;
  finalPhoto.classList.add("active");
  notesInput.value = "";
  resultBox.classList.remove("active");
}

function handleSubmit() {
  const payload = {
    barcode: barcodeInput.value.trim(),
    photo: photoBase64,
    notes: notesInput.value.trim(),
    timestamp: new Date().toISOString(),
    device: navigator.userAgent
  };

  // Show result
  resBarcode.textContent = payload.barcode;
  resNotes.textContent = payload.notes || "(none)";
  resPhoto.src = payload.photo;
  jsonOutput.textContent = JSON.stringify(payload, null, 2);
  resultBox.classList.add("active");
  
  status.textContent = "✅ Ready! Copy, download, or start new scan.";
  status.style.color = "#28a745";
  
  // Copy button
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    status.textContent = "📋 Copied to clipboard!";
    setTimeout(() => status.textContent = "", 1500);
  };
  
  // Download button
  downloadBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery_${payload.barcode.replace(/\W/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// ===== NAVIGATION =====
function goToStep(n) {
  [step1, step2, step3].forEach((el, i) => 
    el.classList.toggle("active", i + 1 === n)
  );
  if (n === 2) {
    // Validate barcode before proceeding
    if (!barcodeInput.value.trim()) {
      status.textContent = "⚠️ Please enter a barcode first";
      return;
    }
    startPhotoCamera();
  }
  if (n === 3) prepareSubmit();
}

function resetAll() {
  // Stop all streams
  [scannerStream, photoStream].forEach(stream => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  });
  
  // Reset state
  scanning = false;
  photoBase64 = "";
  
  // Reset UI
  status.textContent = "";
  status.style.color = "#dc3545";
  barcodeInput.value = "";
  barcodeInput.disabled = false;
  confirmBarcodeBtn.disabled = true;
  
  [scannerVideo, photoVideo, photoPreview, finalPhoto].forEach(el => {
    el.classList.remove("active");
    el.srcObject = null;
  });
  [takePhotoBtn, retakePhotoBtn, confirmPhotoBtn, stopScanBtn].forEach(btn => 
    btn.classList.add("hidden")
  );
  scanBtn.classList.remove("hidden");
  scanBtn.disabled = false;
  
  resultBox.classList.remove("active");
  
  goToStep(1);
}

// ===== EVENT LISTENERS =====
scanBtn.addEventListener("click", () => {
  scanBtn.disabled = true;
  startScanner();
});

stopScanBtn.addEventListener("click", stopScanner);

confirmBarcodeBtn.addEventListener("click", () => goToStep(2));

takePhotoBtn.addEventListener("click", capturePhoto);
retakePhotoBtn.addEventListener("click", retakePhotoOnly);
confirmPhotoBtn.addEventListener("click", () => goToStep(3));

submitBtn.addEventListener("click", handleSubmit);
retakeAllBtn.addEventListener("click", resetAll);
newScanBtn.addEventListener("click", resetAll);

// Allow Enter key to confirm barcode
barcodeInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && barcodeInput.value.trim()) {
    confirmBarcodeBtn.click();
  }
});