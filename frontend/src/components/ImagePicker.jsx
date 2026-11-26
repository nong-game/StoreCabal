import { useId, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload, Loader2 } from 'lucide-react';
import { compressImage } from '../utils/image.js';
import { useToast } from './ui.jsx';

/**
 * Image upload + URL input with live preview and automatic client-side compression.
 * Calls `onChange(nextValue)` with either a compressed Data URL, an http(s) URL, or ''.
 */
export default function ImagePicker({
  value = '',
  onChange,
  label = 'รูปภาพสินค้า',
  maxDim = 800,
  aspectClass = 'aspect-[16/10]',
  hint = 'อัปโหลดจากเครื่อง (ระบบบีบอัดให้อัตโนมัติ) หรือวางลิงก์รูป'
}) {
  const inputId = useId();
  const fileRef = useRef(null);
  const toast = useToast();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(value?.startsWith('http') ? 'url' : 'upload');

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await compressImage(file, { maxDim, quality: 0.8 });
      onChange(res.dataUrl);
      toast(`เตรียมรูปแล้ว (${res.width}×${res.height}px · ~${res.approxKb} KB)`);
    } catch (e) {
      toast(e.message || 'อัปโหลดรูปไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="!mb-0">{label}</label>
        <div className="flex rounded-md border border-ink-600 bg-ink-900/60 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition ${mode === 'upload' ? 'bg-arcane-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Upload size={11} />อัปโหลด
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition ${mode === 'url' ? 'bg-arcane-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Link2 size={11} />ลิงก์ URL
          </button>
        </div>
      </div>

      {value && (
        <div className={`relative overflow-hidden rounded-xl border border-ink-600 bg-ink-900 ${aspectClass}`}>
          <img src={value} alt="ตัวอย่างรูป" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 py-2">
            <span className="text-[11px] text-slate-300 truncate">
              {value.startsWith('data:') ? `รูปที่อัปโหลด (~${Math.round((value.length * 3) / 4 / 1024)} KB)` : 'รูปจากลิงก์ URL'}
            </span>
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600/80 hover:bg-rose-500 px-2 py-1 text-[11px] font-medium text-white transition active:scale-95"
            >
              <Trash2 size={12} />ลบรูป
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !busy && fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-3 py-4 text-center transition ${
            drag
              ? 'border-arcane-400 bg-arcane-600/15'
              : 'border-ink-600 bg-ink-900/40 hover:border-arcane-500/50 hover:bg-ink-800/70'
          }`}
        >
          <input
            id={inputId}
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {busy ? (
            <div className="flex items-center justify-center gap-2 text-xs text-arcane-300">
              <Loader2 size={16} className="animate-spin" />กำลังย่อและเตรียมรูป…
            </div>
          ) : (
            <div className="space-y-1">
              <ImagePlus size={20} className="mx-auto text-slate-400" />
              <div className="text-xs font-medium text-slate-300">
                {value ? 'คลิกหรือลากรูปใหม่มาเปลี่ยน' : 'คลิกเลือกรูป หรือลากรูปมาวางที่นี่'}
              </div>
              <div className="text-[11px] text-slate-500">รองรับ JPG, PNG, WebP</div>
            </div>
          )}
        </div>
      ) : (
        <input
          id={inputId}
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/item.png"
        />
      )}

      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
