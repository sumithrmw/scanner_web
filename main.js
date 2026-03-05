import { BarcodeDetector } from "barcode-detector/pure";

// ===== DOM Elements =====
const video = document.getElementById("video");
const photoVideo = document.getElementById("photoVideo");
const canvas = document.getElementById("canvas");
const photoPreview = document.getElementById("photoPreview");
const finalPhoto = document.getElementById("finalPhoto");

const barcodeResult = document.getElementById("barcodeResult");
const finalBarcode = document.getElementById("finalBarcode");
const notesInput = document.getElementById("notes");
const status = document.getElementById("status");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const resultBox = document.getElementById("result");

// Buttons
const startScanBtn = document.getElementById("startScanBtn");
const rescanBtn = document.getElementById("rescanBtn");
const takePhotoBtn = document.getElementById("takePhotoBtn");
const retakePhotoBtn = document.getElementById("retakePhotoBtn");
const confirmPhotoBtn = document.getElementById("confirmPhotoBtn");
const submitBtn = document.getElementById("submitBtn");
const retakeAllBtn = document.getElementById("retakeAllBtn");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const newScanBtn = document.getElementById("newScanBtn");

// Result elements
const resBarcode = document.getElementById("resBarcode");
const resNotes = document.getElementById("resNotes");
const resPhoto = document.getElementById("resPhoto");
const jsonOutput = document.getElementById("jsonOutput");

// ===== State =====
let scannedBarcode = "";
let photoBase64 = "";
let detector;
let scanning = false;
let photoStream = null;

// ===== STEP 1: SCAN BARCODE =====
async function startScanner() {
  startScanBtn.disabled = true;
  barcodeResult.textContent = "🎥 Starting camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" }, width: { ideal: 1280 } }
    });
    video.srcObject = stream;
    await video.play();

    detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"]
    });

    barcodeResult.textContent = "🔍 Point at barcode...";
    scanning = true;
    scanLoop();
  } catch (err) {
    status.textContent = "❌ Camera error: " + err.message;
    startScanBtn.disabled = false;
  }
}

async function scanLoop() {
  if (!scanning || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) {
    if (scanning) requestAnimationFrame(scanLoop);
    return;
  }

  try {
    const barcodes = await detector.detect(video);
    if (barcodes.length > 0) {
      scannedBarcode = barcodes[0].rawValue.trim();
      barcodeResult.textContent = "✅ " + scannedBarcode;
      if (navigator.vibrate) navigator.vibrate(150);
      
      // Stop scanner stream
      video.srcObject.getTracks().forEach(t => t.stop());
      scanning = false;
      
      // UI updates
      startScanBtn.classList.add("hidden");
      rescanBtn.classList.remove("hidden");
      
      // Auto-proceed to photo step
      setTimeout(() => goToStep(2), 1200);
    }
  } catch (e) { /* ignore detection errors */ }
  
  if (scanning) requestAnimationFrame(scanLoop);
}

// ===== STEP 2: TAKE PHOTO =====
async function startPhotoCamera() {
  try {
    photoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    photoVideo.srcObject = photoStream;
    await photoVideo.play();
    photoVideo.classList.remove("hidden");
    takePhotoBtn.classList.remove("hidden");
  } catch (err) {
    status.textContent = "❌ Photo camera error: " + err.message;
  }
}

function capturePhoto() {
  canvas.width = photoVideo.videoWidth || 1280;
  canvas.height = photoVideo.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(photoVideo, 0, 0, canvas.width, canvas.height);
  
  // Stop stream & hide video
  photoStream.getTracks().forEach(t => t.stop());
  photoVideo.classList.add("hidden");
  takePhotoBtn.classList.add("hidden");
  
  // Generate preview
  photoBase64 = canvas.toDataURL("image/jpeg", 0.85);
  photoPreview.src = photoBase64;
  photoPreview.classList.remove("hidden");
  
  // Show buttons
  retakePhotoBtn.classList.remove("hidden");
  confirmPhotoBtn.classList.remove("hidden");
}

function retakePhotoOnly() {
  photoPreview.classList.add("hidden");
  retakePhotoBtn.classList.add("hidden");
  confirmPhotoBtn.classList.add("hidden");
  startPhotoCamera();
}

// ===== STEP 3: NOTES + SUBMIT =====
function prepareSubmit() {
  finalBarcode.textContent = scannedBarcode;
  finalPhoto.src = photoBase64;
  finalPhoto.classList.remove("hidden");
  notesInput.value = "";
  resultBox.classList.add("hidden");
}

function handleSubmit() {
  const notes = notesInput.value.trim();
  const payload = {
    barcode: scannedBarcode,
    photo: photoBase64,           // Base64 JPEG
    notes: notes,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };

  // Show result
  resBarcode.textContent = payload.barcode;
  resNotes.textContent = payload.notes || "(none)";
  resPhoto.src = payload.photo;
  jsonOutput.textContent = JSON.stringify(payload, null, 2);
  
  resultBox.classList.remove("hidden");
  status.textContent = "✅ Ready! Copy, download, or start new scan.";
  status.style.color = "#28a745";
  
  // Attach copy/download handlers
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    status.textContent = "📋 Copied to clipboard!";
    setTimeout(() => status.textContent = "", 2000);
  };
  
  downloadBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery_${payload.barcode}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// ===== NAVIGATION =====
function goToStep(n) {
  [step1, step2, step3].forEach((el, i) => 
    el.classList.toggle("active", i + 1 === n)
  );
  if (n === 2) startPhotoCamera();
  if (n === 3) prepareSubmit();
}

function resetAll() {
  // Stop streams
  [video, photoVideo].forEach(v => {
    if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
  });
  
  // Reset state
  scannedBarcode = "";
  photoBase64 = "";
  scanning = false;
  
  // Reset UI
  status.textContent = "";
  [photoPreview, finalPhoto, resultBox].forEach(el => el.classList.add("hidden"));
  [takePhotoBtn, retakePhotoBtn, confirmPhotoBtn, rescanBtn].forEach(btn => 
    btn.classList.add("hidden")
  );
  startScanBtn.classList.remove("hidden");
  startScanBtn.disabled = false;
  barcodeResult.textContent = "Tap \"Start\" to scan";
  
  goToStep(1);
}

// ===== EVENT LISTENERS =====
startScanBtn.addEventListener("click", startScanner);
rescanBtn.addEventListener("click", () => {
  rescanBtn.classList.add("hidden");
  startScanBtn.classList.remove("hidden");
  startScanBtn.disabled = false;
  barcodeResult.textContent = "Tap \"Start\" to scan";
  startScanner();
});

takePhotoBtn.addEventListener("click", capturePhoto);
retakePhotoBtn.addEventListener("click", retakePhotoOnly);
confirmPhotoBtn.addEventListener("click", () => goToStep(3));

submitBtn.addEventListener("click", handleSubmit);
retakeAllBtn.addEventListener("click", resetAll);
newScanBtn.addEventListener("click", resetAll);