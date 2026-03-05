import { BarcodeDetector } from "barcode-detector";

const video = document.getElementById("video");
const resultDiv = document.getElementById("result");
const startBtn = document.getElementById("startBtn");

let detector;
let stream;

async function startScanner() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = stream;
    await video.play();

    // Use native if available, otherwise fallback
    detector = new (window.BarcodeDetector || BarcodeDetector)({
      formats: ["qr_code", "code_128", "ean_13", "upc_a"]
    });

    scanLoop();
  } catch (err) {
    console.error(err);
    resultDiv.textContent = "Camera error!";
  }
}

async function scanLoop() {
  if (!detector) return;

  try {
    const barcodes = await detector.detect(video);

    if (barcodes.length > 0) {
      resultDiv.textContent = "Detected: " + barcodes[0].rawValue;
    }
  } catch (err) {
    console.error(err);
  }

  requestAnimationFrame(scanLoop);
}

startBtn.addEventListener("click", startScanner);