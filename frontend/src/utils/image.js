/**
 * Client-side image compression for uploads (keeps localStorage & Google Apps Script payloads compact).
 * Converts any chosen image file into a WebP/JPEG data URL resized to fit maxDim.
 */
export async function compressImage(file, { maxDim = 960, quality = 0.8, maxChars = 0 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('ไฟล์รูปใหญ่เกิน 12 MB');
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  let w = Math.max(1, Math.round(bitmap.width * scale));
  let h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูป');

  const encode = (width, height, q, mime) => {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL(mime, q);
  };

  // Prefer webp (smaller), fallback to jpeg if browser does not support webp encoding
  let mime = 'image/webp';
  let dataUrl = encode(w, h, quality, mime);
  if (!dataUrl.startsWith('data:image/webp')) {
    mime = 'image/jpeg';
    dataUrl = encode(w, h, quality, mime);
  }

  // Optional hard cap (e.g. when fitting into a sheet cell fallback)
  if (maxChars > 0) {
    let q = quality;
    while (dataUrl.length > maxChars && q > 0.35) {
      q -= 0.12;
      dataUrl = encode(w, h, q, mime);
    }
    while (dataUrl.length > maxChars && w > 240 && h > 240) {
      w = Math.round(w * 0.78);
      h = Math.round(h * 0.78);
      dataUrl = encode(w, h, q, mime);
    }
  }

  if (bitmap.close) bitmap.close();
  return { dataUrl, width: w, height: h, approxKb: Math.round((dataUrl.length * 3) / 4 / 1024) };
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่สำเร็จ')); };
    img.src = url;
  });
}

export function isValidImageSrc(v) {
  const s = String(v || '').trim();
  return s.startsWith('data:image/') || /^https?:\/\//i.test(s);
}
