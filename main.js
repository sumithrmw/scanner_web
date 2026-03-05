// main.js - Ultra fast, Supabase backend, CORRECT destructuring
import { BarcodeDetector } from "barcode-detector/pure";
import { supabase } from "./supabase.js";

// ==================== CACHED DOM ====================
const $ = id => document.getElementById(id);
const els = {
  login: $('login'), app: $('app'), email: $('email'), password: $('password'),
  loginBtn: $('loginBtn'), msg: $('msg'), video: $('video'), result: $('result'),
  startBtn: $('startBtn'), save: $('save'), code: $('code'), desc: $('desc'),
  file: $('file'), saveBtn: $('saveBtn'), cancelBtn: $('cancelBtn'),
  saveMsg: $('saveMsg'), list: $('list'), refreshBtn: $('refreshBtn'),
  logoutBtn: $('logoutBtn')
};

// ==================== STATE ====================
let scanning = false, detector, currentCode, user = null, items = [];

// ==================== AUTH ====================
async function checkAuth() {
  // ✅ CORRECT: data: { session }
  const { data: { session } } = await supabase.auth.getSession();
  user = session?.user || null;
  return user;
}

function showLogin() {
  els.login.classList.remove('hidden');
  els.app.classList.add('hidden');
}

function showApp() {
  els.login.classList.add('hidden');
  els.app.classList.remove('hidden');
  loadItems();
}

els.loginBtn.onclick = async () =>  {
  // 🔍 DEBUG: Log what we're sending
  const email = els.email.value.trim();
  const password = els.password.value;
  console.log('🔐 Login attempt:', { email, passwordLength: password.length });
  
  if (!email || !password) { 
    console.error('❌ Missing credentials');
    els.msg.textContent = '❌ Enter email & password'; 
    els.msg.className = 'error'; 
    return; 
  }
  
  els.loginBtn.classList.add('loading');
  els.msg.textContent = '⏳';
  
  // ✅ CORRECT: error at top level
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  els.loginBtn.classList.remove('loading');
  if (error) { 
    els.msg.textContent = '❌ ' + error.message; 
    els.msg.className = 'error'; 
    return; 
  }
  
  els.msg.textContent = '✅';
  els.msg.className = 'success';
  await checkAuth();
  showApp();
};

els.logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  user = null;
  items = [];
  els.list.innerHTML = '';
  showLogin();
  els.email.value = '';
  els.password.value = '';
  els.msg.textContent = '';
};

els.email.onkeypress = e => e.key === 'Enter' && els.loginBtn.click();
els.password.onkeypress = e => e.key === 'Enter' && els.loginBtn.click();

// ==================== SCANNER ====================
els.startBtn.onclick = async () => {
  if (scanning) return;
  scanning = true;
  els.startBtn.disabled = true;
  els.result.textContent = '📷 Starting...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    els.video.srcObject = stream;
    await els.video.play();

    detector = new BarcodeDetector({ 
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] 
    });
    els.result.textContent = '🔍 Scanning...';
    scanLoop();
  } catch (e) {
    els.result.textContent = '❌ ' + e.message;
    scanning = false;
    els.startBtn.disabled = false;
  }
};

async function scanLoop() {
  if (!scanning || !detector || els.video.readyState !== 4) {
    if (scanning) requestAnimationFrame(scanLoop);
    return;
  }
  try {
    const [bc] = await detector.detect(els.video);
    if (bc?.rawValue) {
      currentCode = bc.rawValue;
      els.result.textContent = '✅ ' + currentCode;
      if (navigator.vibrate) navigator.vibrate(100);
      scanning = false;
      els.startBtn.disabled = false;
      els.startBtn.textContent = '🔄 Again';
      els.code.textContent = currentCode;
      els.save.classList.remove('hidden');
      els.desc.focus();
    } else {
      requestAnimationFrame(scanLoop);
    }
  } catch { 
    requestAnimationFrame(scanLoop); 
  }
}

// ==================== SAVE ITEM ====================
els.saveBtn.onclick = async () => {
  els.saveBtn.disabled = true;
  els.saveMsg.textContent = '⏳';

  const desc = els.desc.value.trim();
  let imgUrl = null;

  if (els.file.files[0]) {
    const f = els.file.files[0];
    const ext = f.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    
    // ✅ CORRECT: error and data at top level
    const { error: uploadError,  uploadData } = await supabase.storage
      .from('item-images')
      .upload(path, f);
    
    if (!uploadError) {
      // ✅ CORRECT: data: { publicUrl } - SYNCHRONOUS, no await!
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(path);
      imgUrl = publicUrl;
    }
  }

  // ✅ CORRECT: error at top level
  const { error: dbError } = await supabase
    .from('items')
    .insert([{
      user_id: user.id,
      barcode: currentCode,
      description: desc || null,
      image_url: imgUrl
    }]);

  els.saveBtn.disabled = false;
  if (dbError) { 
    els.saveMsg.textContent = '❌ ' + dbError.message; 
    els.saveMsg.className = 'error'; 
    return; 
  }

  // Optimistic update
  items.unshift({ 
    barcode: currentCode, 
    description: desc, 
    image_url: imgUrl, 
    created_at: new Date().toISOString() 
  });
  renderItems();

  els.saveMsg.textContent = '✅ Saved';
  els.saveMsg.className = 'success';
  els.desc.value = '';
  els.file.value = '';
  els.save.classList.add('hidden');
  els.result.textContent = 'Tap Start to scan';
  setTimeout(() => { els.saveMsg.textContent = ''; }, 1500);
};

els.cancelBtn.onclick = () => {
  els.save.classList.add('hidden');
  els.desc.value = '';
  els.file.value = '';
  els.saveMsg.textContent = '';
  els.result.textContent = 'Tap Start to scan';
};

// ==================== HISTORY ====================
async function loadItems() {
  els.list.innerHTML = '<em style="color:#666">Loading...</em>';
  
  // ✅ CORRECT: { data, error }
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) {
    els.list.innerHTML = `<em class="error">Error: ${error.message}</em>`;
    return;
  }
  
  items = data || [];
  renderItems();
}

function renderItems() {
  if (!items.length) { 
    els.list.innerHTML = '<em style="color:#666">Nothing scanned yet</em>'; 
    return; 
  }
  els.list.innerHTML = items.map(i => `
    <div class="item">
      ${i.image_url ? `<img src="${i.image_url}" loading="lazy" alt="">` : ''}
      <div class="item-info">
        <strong>${i.barcode}</strong><br>
        ${i.description || ''}<br>
        <small>${new Date(i.created_at).toLocaleDateString()}</small>
      </div>
    </div>
  `).join('');
}

els.refreshBtn.onclick = loadItems;

// ==================== INIT ====================
(async () => {
  await checkAuth();
  user ? showApp() : showLogin();
})();