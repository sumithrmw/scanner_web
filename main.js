import { BarcodeDetector } from "barcode-detector/pure";

const video = document.getElementById("video");
const resultDiv = document.getElementById("result");
const startBtn = document.getElementById("startBtn");

let detector;
let scanning = false;

async function startScanner() {
  startBtn.disabled = true;
  resultDiv.textContent = "Starting camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: "environment" }, // more explicit for mobile
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

  if (video.readyState === video.HAVE_ENOUGH_DATA) { // only scan when frame is ready
    try {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue;
        resultDiv.textContent = "✅ " + value;

        // Optional: vibrate on mobile for feedback
        if (navigator.vibrate) navigator.vibrate(200);

        scanning = false; // stop after first scan
        startBtn.disabled = false;
        startBtn.textContent = "Scan Again";
        return;
      }
    } catch (err) {
      // silent — detector throws on empty frames, this is normal
    }
  }

  requestAnimationFrame(scanLoop);
}

startBtn.addEventListener("click", startScanner);