const $ = (s) => document.querySelector(s);
const fileInput = $("#file-input");
const uploadBtn = $("#upload-btn");
const deletePassword = $("#delete-password");
const progress = $("#progress");
const uploadSection = $("#upload-section");
const resultSection = $("#result-section");
const resultUrl = $("#result-url");
const copyBtn = $("#copy-btn");
const expiryInfo = $("#expiry-info");
const newUploadBtn = $("#new-upload-btn");
const downloadSection = $("#download-section");
const fileInfo = $("#file-info");
const preview = $("#preview");
const downloadBtn = $("#download-btn");
const decryptProgress = $("#decrypt-progress");

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

fileInput.addEventListener("change", () => {
  uploadBtn.disabled = !fileInput.files.length;
});

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  uploadBtn.disabled = true;
  progress.hidden = false;
  progress.textContent = "Encrypting...";

  const fileData = new Uint8Array(await file.arrayBuffer());
  const encryptionKey = await generateKey();
  const encryptedData = await encrypt(fileData, encryptionKey);

  progress.textContent = "Uploading...";
  const formData = new FormData();
  formData.append("file", new Blob([encryptedData], { type: file.type }), file.name);
  if (deletePassword.value) formData.append("password", deletePassword.value);

  try {
    const res = await fetch("/", { method: "POST", body: formData });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    resultUrl.value = `${location.origin}/${data.id}#${await exportKey(encryptionKey)}`;
    expiryInfo.textContent = `Expires in ${data.retention_days} days`;
    uploadSection.hidden = true;
    resultSection.hidden = false;
  } catch (e) {
    alert("Upload failed: " + e.message);
    uploadBtn.disabled = false;
  }
  progress.hidden = true;
});

copyBtn.addEventListener("click", () => {
  resultUrl.select();
  document.execCommand("copy");
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 2000);
});

newUploadBtn.addEventListener("click", () => {
  fileInput.value = "";
  deletePassword.value = "";
  uploadBtn.disabled = true;
  resultSection.hidden = true;
  uploadSection.hidden = false;
});

async function fetchAndDecrypt(id, key) {
  const res = await fetch(`/${id}/raw`);
  const data = new Uint8Array(await res.arrayBuffer());
  return new Uint8Array(await decrypt(data, key));
}

async function handleDownload() {
  const path = location.pathname;
  const hash = location.hash.slice(1);
  if (path.length < 2 || !hash) return;

  const id = path.slice(1);
  if (id === "app.js") return;

  try {
    const infoRes = await fetch(`/${id}/info`);
    if (!infoRes.ok) return;
    const info = await infoRes.json();

    uploadSection.hidden = true;
    downloadSection.hidden = false;

    fileInfo.textContent = "";
    const fileName = document.createElement("strong");
    fileName.textContent = info.filename;

    fileInfo.appendChild(fileName);
    fileInfo.appendChild(document.createTextNode(` (${formatSize(info.size)})`));

    const linebreak = document.createElement("br");
    fileInfo.appendChild(linebreak);

    fileInfo.appendChild(document.createTextNode(`Expires: ${new Date(info.expires_at).toLocaleDateString()}`));

    const key = await importKey(hash);

    if (info.mime_type.startsWith("image/") || info.mime_type.startsWith("video/") || info.mime_type.startsWith("audio/")) {
      decryptProgress.hidden = false;
      decryptProgress.textContent = "Decrypting...";
      const data = await fetchAndDecrypt(id, key);
      const blob = new Blob([data], { type: info.mime_type });
      const url = URL.createObjectURL(blob);
      decryptProgress.hidden = true;

      if (info.mime_type.startsWith("image/")) {
        preview.innerHTML = `<img src="${url}" style="max-width:100%">`;
      } else if (info.mime_type.startsWith("video/")) {
        preview.innerHTML = `<video src="${url}" controls style="max-width:100%"></video>`;
      } else {
        preview.innerHTML = `<audio src="${url}" controls></audio>`;
      }
    }

    downloadBtn.onclick = async () => {
      downloadBtn.disabled = true;
      decryptProgress.hidden = false;
      decryptProgress.textContent = "Decrypting...";
      const data = await fetchAndDecrypt(id, key);
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
