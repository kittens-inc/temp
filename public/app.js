const $ = (s) => document.querySelector(s);
const dropZone = $("#drop-zone");
const fileInput = $("#file-input");
const uploadBtn = $("#upload-btn");
const encryptToggle = $("#encrypt-toggle");
const deletePassword = $("#delete-password");
const progress = $("#progress");
const progressFill = $(".progress-fill");
const progressText = $(".progress-text");
const uploadSection = $("#upload-section");
const resultSection = $("#result-section");
const resultUrl = $("#result-url");
const copyBtn = $("#copy-btn");
const expiryInfo = $("#expiry-info");
const newUploadBtn = $("#new-upload-btn");
const downloadSection = $("#download-section");
const fileInfo = $("#file-info");
const downloadBtn = $("#download-btn");
const decryptProgress = $("#decrypt-progress");

let selectedFile = null;

async function generateKey() {
  return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function importKey(b64) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function encrypt(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return combined;
}

async function decrypt(data, key) {
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files.length) selectFile(fileInput.files[0]); });

function selectFile(file) {
  selectedFile = file;
  dropZone.querySelector("p").textContent = `${file.name} (${formatSize(file.size)})`;
  uploadBtn.disabled = false;
}

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  progress.hidden = false;

  let fileData = new Uint8Array(await selectedFile.arrayBuffer());
  let encryptionKey = null;

  if (encryptToggle.checked) {
    progressText.textContent = "Encrypting...";
    encryptionKey = await generateKey();
    fileData = await encrypt(fileData, encryptionKey);
  }

  const formData = new FormData();
  formData.append("file", new Blob([fileData], { type: selectedFile.type }), selectedFile.name);
  if (deletePassword.value) formData.append("password", deletePassword.value);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/");
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + "%";
      progressText.textContent = pct + "%";
    }
  };
  xhr.onload = async () => {
    if (xhr.status === 200) {
      const res = JSON.parse(xhr.responseText);
      let url = res.url;
      if (encryptionKey) url += "#" + await exportKey(encryptionKey);
      resultUrl.value = url;
      expiryInfo.textContent = `Expires in ${res.retention_days} days (${new Date(res.expires_at).toLocaleDateString()})`;
      uploadSection.hidden = true;
      resultSection.hidden = false;
    } else {
      alert("Upload failed: " + xhr.responseText);
      uploadBtn.disabled = false;
    }
    progress.hidden = true;
    progressFill.style.width = "0%";
  };
  xhr.onerror = () => {
    alert("Upload failed");
    uploadBtn.disabled = false;
    progress.hidden = true;
  };
  xhr.send(formData);
});

copyBtn.addEventListener("click", () => {
  resultUrl.select();
  document.execCommand("copy");
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 2000);
});

newUploadBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  dropZone.querySelector("p").textContent = "Drop file here or click to select";
  uploadBtn.disabled = true;
  deletePassword.value = "";
  resultSection.hidden = true;
  uploadSection.hidden = false;
});

async function handleDownload() {
  const path = location.pathname;
  const hash = location.hash.slice(1);
  if (path.length < 2) return;

  const id = path.slice(1);
  if (id === "app.js" || id === "style.css") return;

  try {
    const infoRes = await fetch(`/${id}/info`);
    if (!infoRes.ok) return;
    const info = await infoRes.json();

    uploadSection.hidden = true;
    downloadSection.hidden = false;
    fileInfo.innerHTML = `<strong>${info.filename}</strong><br>${formatSize(info.size)}<br>Expires: ${new Date(info.expires_at).toLocaleDateString()}`;
    if (hash) fileInfo.innerHTML += "<br><em>E2EE enabled</em>";

    downloadBtn.onclick = async () => {
      downloadBtn.disabled = true;
      decryptProgress.hidden = false;

      const res = await fetch(`/${id}`);
      let data = new Uint8Array(await res.arrayBuffer());

      if (hash) {
        decryptProgress.textContent = "Decrypting...";
        const key = await importKey(hash);
        data = new Uint8Array(await decrypt(data, key));
      }

      decryptProgress.hidden = true;
      const blob = new Blob([data], { type: info.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = info.filename;
      a.click();
      URL.revokeObjectURL(url);
      downloadBtn.disabled = false;
    };
  } catch (e) {
    console.error(e);
  }
}

handleDownload();
