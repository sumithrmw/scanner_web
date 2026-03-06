// main.js - Production-ready Scanner App with Supabase
import { BarcodeDetector } from "barcode-detector/pure";
import { supabase } from "./supabase.js";

// ==================== CACHED DOM ====================
const $ = (id) => document.getElementById(id);
const els = {
  // Auth
  login: $('login'),
  app: $('app'),
  loginForm: $('loginForm'),
  email: $('email'),
  password: $('password'),
  loginBtn: $('loginBtn'),
  msg: $('msg'),
  
  // Scanner
  video: $('video'),
  result: $('result'),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  
  // Save Item
  save: $('save'),
  code: $('code'),
  desc: $('desc'),
  captureBtn: $('captureBtn'),
  preview: $('preview'),
  file: $('file'),
  saveBtn: $('saveBtn'),
  cancelBtn: $('cancelBtn'),
  saveMsg: $('saveMsg'),
  
  // History
  list: $('list'),
  refreshBtn: $('refreshBtn'),
  
  // Global
  logoutBtn: $('logoutBtn')
};

// ==================== STATE ====================
let scanning = false;
let detector = null;
let currentCode = null;
let stream = null;
let user = null;
let items = [];
let capturedBlob = null;
let previewUrl = null;

// ==================== UTILS ====================
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const setLoading = (btn, loading) => {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
};
const setMessage = (el, text, type = '') => {
  el.textContent = text || '';
  el.className = type;
};

// ==================== AUTH ====================
async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    user = session?.user ?? null;
    return user;
  } catch (err) {
    console.error('🔐 Auth check failed:', err);
    user = null;
    return null;
  }
}

function showLogin() {
  hide(els.app);
  show(els.login);
  els.email.focus();
}

function showApp() {
  hide(els.login);
  show(els.app);
  loadItems();
}

// Login form submit handler (handles Enter key reliably)
els.loginForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const email = els.email.value.trim();
  const password = els.password.value;
  
  console.log('🔐 Login attempt:', { email, passwordLength: password.length });
  
  if (!email || !password) {
    setMessage(els.msg, '❌ Enter email & password', 'error');
    return;
  }
  
  setLoading(els.loginBtn, true);
  setMessage(els.msg, '⏳ Signing in...', '');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) throw error;
    
    setMessage(els.msg, '✅ Welcome!', 'success');
    await checkAuth();
    showApp();
    
    // Clear form
    els.email.value = '';
    els.password.value = '';
    
  } catch (err) {
    console.error('❌ Login error:', err);
    setMessage(els.msg, `❌ ${err.message || 'Login failed'}`, 'error');
  } finally {
    setLoading(els.loginBtn, false);
  }
};

// Logout
els.logoutBtn.onclick = async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('🚪 Logout error:', err);
  } finally {
    user = null;
    items = [];
    els.list.innerHTML = '';
    stopScanner();
    showLogin();
    setMessage(els.msg, '');
  }
};

// ==================== SCANNER ====================
async function startScanner() {
  if (scanning) return;
  
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    els.video.srcObject = stream;
    await els.video.play();
    
    detector = new BarcodeDetector({ 
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] 
    });
    
    scanning = true;
    hide(els.startBtn);
    show(els.stopBtn);
    els.result.textContent = '🔍 Scanning...';
    
    scanLoop();
    
  } catch (err) {
    console.error('📷 Camera error:', err);
    els.result.textContent = `❌ ${err.message || 'Camera access denied'}`;
    scanning = false;
  }
}

function resetCapture() {
  capturedBlob = null;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  els.preview.src = '';
  hide(els.preview);
  els.captureBtn.textContent = '📸 Take photo';
  els.captureBtn.disabled = false;
}

function capturePhoto() {
  if (!stream || !els.video) return;

  const videoWidth = els.video.videoWidth || 640;
  const videoHeight = els.video.videoHeight || 480;
  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(els.video, 0, 0, videoWidth, videoHeight);

  canvas.toBlob((blob) => {
    if (!blob) return;
    capturedBlob = blob;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    previewUrl = URL.createObjectURL(blob);
    els.preview.src = previewUrl;
    show(els.preview);
    els.captureBtn.textContent = '🔄 Retake photo';
  }, 'image/jpeg', 0.85);
}

function stopScanner() {
  scanning = false;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  if (els.video.srcObject) {
    els.video.srcObject = null;
  }

  detector = null;
  hide(els.stopBtn);
  show(els.startBtn);
  els.startBtn.disabled = false;
}


async function scanLoop() {
  if (!scanning || !detector) return;
  
  // Wait for video to be ready
  if (els.video.readyState !== 4) {
    requestAnimationFrame(scanLoop);
    return;
  }
  
  try {
    const barcodes = await detector.detect(els.video);
    const bc = barcodes?.[0];
    
    if (bc?.rawValue) {
      currentCode = bc.rawValue;
      els.result.textContent = `✅ ${currentCode}`;
      
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(100);
      
      // Stop scanning loop (keep camera stream open for photo capture)
      scanning = false;
      hide(els.stopBtn);
      show(els.startBtn);

      els.code.textContent = currentCode;
      show(els.save);
      resetCapture();
      els.desc.focus();
      els.desc.select();
    } else {
      requestAnimationFrame(scanLoop);
    }
  } catch (err) {
    console.warn('🔍 Scan error:', err);
    if (scanning) requestAnimationFrame(scanLoop);
  }
}

// Button handlers
els.startBtn.onclick = () => {
  els.result.textContent = '';
  startScanner();
};

els.stopBtn.onclick = () => {
  stopScanner();
  els.result.textContent = 'Tap Start to scan';
};

els.captureBtn.onclick = () => {
  capturePhoto();
};

// ==================== SAVE ITEM ====================

els.saveBtn.onclick = async () => {
  if (!currentCode || !user) return;
  
  setLoading(els.saveBtn, true);
  setMessage(els.saveMsg, '⏳ Saving...', '');
  
  const desc = els.desc.value.trim();
  let imgUrl = null;
  
  try {
    // Determine which image to upload: captured photo (preferred) or file input
    let fileToUpload = null;

    if (capturedBlob) {
      fileToUpload = new File([capturedBlob], `${Date.now()}.jpg`, { type: capturedBlob.type || 'image/jpeg' });
    } else if (els.file.files?.[0]) {
      fileToUpload = els.file.files[0];
    }

    if (fileToUpload) {
      const ext = fileToUpload.name.split('.').pop()?.toLowerCase();
      const allowed = ['jpg', 'jpeg', 'png', 'webp'];
      
      if (!allowed.includes(ext)) {
        throw new Error(`Unsupported image type: .${ext}`);
      }
      
      const path = `${user.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(path, fileToUpload, { upsert: false });
      
      if (uploadError) throw uploadError;
      
      // Get public URL (synchronous call)
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(path);
      
      imgUrl = publicUrl;
    }
    
    // Insert into database
    const { error: dbError } = await supabase
      .from('items')
      .insert([{
        user_id: user.id,
        barcode: currentCode,
        description: desc || null,
        image_url: imgUrl,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    // Optimistic UI update
    items.unshift({
      id: dbError?.id || Date.now(),
      barcode: currentCode,
      description: desc,
      image_url: imgUrl,
      created_at: new Date().toISOString()
    });
    renderItems();
    
    setMessage(els.saveMsg, '✅ Saved!', 'success');
    
    // Reset form
    els.desc.value = '';
    els.file.value = '';
    resetCapture();
    hide(els.save);
    els.result.textContent = 'Tap Start to scan';
    stopScanner();

    // Clear success message after delay
    setTimeout(() => setMessage(els.saveMsg, ''), 1500);
    
  } catch (err) {
    console.error('💾 Save error:', err);
    setMessage(els.saveMsg, `❌ ${err.message || 'Save failed'}`, 'error');
  } finally {
    setLoading(els.saveBtn, false);
  }
};

els.cancelBtn.onclick = () => {
  hide(els.save);
  els.desc.value = '';
  els.file.value = '';
  resetCapture();
  setMessage(els.saveMsg, '');
  els.result.textContent = 'Tap Start to scan';
  stopScanner();
};

// ==================== HISTORY ====================
async function loadItems() {
  if (!user) return;
  
  els.list.innerHTML = '<em style="color:#666">Loading...</em>';
  
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    items = data || [];
    renderItems();
    
  } catch (err) {
    console.error('📋 Load error:', err);
    els.list.innerHTML = `<em class="error">Error: ${err.message}</em>`;
  }
}

function renderItems() {
  if (!items.length) {
    els.list.innerHTML = '<em style="color:#666">Nothing scanned yet</em>';
    return;
  }
  
  els.list.innerHTML = items.map(item => `
    <div class="item">
      ${item.image_url 
        ? `<img src="${item.image_url}" loading="lazy" alt="Item" onerror="this.style.display='none'">` 
        : ''}
      <div class="item-info">
        <strong>${escapeHtml(item.barcode)}</strong>
        ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}
        <small>${formatDate(item.created_at)}</small>
      </div>
    </div>
  `).join('');
}

// Helper: Prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Helper: Format date
function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

els.refreshBtn.onclick = () => {
  els.refreshBtn.disabled = true;
  loadItems().finally(() => {
    setTimeout(() => els.refreshBtn.disabled = false, 500);
  });
};

// ==================== INIT ====================
(async function init() {
  // Check auth on load
  await checkAuth();
  
  if (user) {
    showApp();
  } else {
    showLogin();
  }
  
  // Auth state change listener (handles token refresh, logout from other tabs, etc.)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth state:', event);
    
    if (event === 'SIGNED_IN' && session?.user) {
      user = session.user;
      showApp();
    }
    
    if (event === 'SIGNED_OUT') {
      user = null;
      items = [];
      stopScanner();
      showLogin();
    }
  });
})();