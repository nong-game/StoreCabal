import { useEffect, useMemo, useState } from 'react';
import {
  LogIn, RefreshCw, Search, Maximize2, X, Copy, Check, MessageCircle, ArrowLeft
} from 'lucide-react';
import { api, IS_MOCK } from '../services/api.js';
import { Button, Empty, ErrorBox, QtyInput, Spinner, useAsync, useToast } from '../components/ui.jsx';
import ItemVisual from '../components/ItemVisual.jsx';
import { fmtGame, fmtNum, fmtUnit } from '../utils/format.js';

function ContactChip({ label, value, tone }) {
  const toast = useToast();
  if (!value) return null;
  const isUrl = /^https?:\/\//i.test(value);
  if (isUrl) {
    return (
      <a href={value} target="_blank" rel="noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-px ${tone}`}>
        <MessageCircle size={13} />{label}
      </a>
    );
  }
  return (
    <button type="button"
      onClick={() => { navigator.clipboard?.writeText(value); toast(`คัดลอก ${label}: ${value} แล้ว`); }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-px active:scale-95 ${tone}`}>
      <MessageCircle size={13} />{label}: {value}
    </button>
  );
}

export default function Storefront({ onLoginClick, onBackToPortal, isLoggedIn = false }) {
  const { data, error, loading, reload } = useAsync(() => api.publicCatalog(true), []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('ALL');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { image_url, title, caption, tag }
  const [detail, setDetail] = useState(null);     // item object

  const items = data?.items || [];
  const settings = data?.settings || {};
  const rawStats = data?.stats || { total_available: 0, item_types_in_stock: 0, total_items: 0, server: 'CABAL Revolution' };
  const stats = { ...rawStats, server: fmtGame(rawStats.server) };

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { if (i.category) set.add(i.category); });
    return ['ALL', ...set];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== 'ALL' && it.category !== cat) return false;
      if (onlyInStock && it.available_count <= 0) return false;
      if (!q) return true;
      const inName = it.item_name.toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q);
      const inVar = (it.variants || []).some((v) => v.variant && v.variant.toLowerCase().includes(q));
      return inName || inVar;
    });
  }, [items, cat, onlyInStock, query]);

  const hasContact = !!(settings.contact_facebook || settings.contact_line || settings.contact_discord);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-ink-700/90 bg-ink-900/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="./game/logo.webp" alt="CABAL Revolution" className="h-9 sm:h-10 w-auto object-contain shrink-0 drop-shadow-[0_2px_10px_rgba(230,75,34,0.35)]" />
            <div className="min-w-0 border-l border-bone/15 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold tracking-wide text-bone truncate">{settings.shop_title || 'CABAL Revolution Shop'}</span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-arcane-400/35 bg-arcane-600/15 px-2.5 py-0.5 text-[10px] font-semibold text-arcane-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" />{stats.server}
                </span>
              </div>
              <div className="text-[11px] text-ash truncate">หน้าร้านเช็กสต็อกสำหรับลูกค้า</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={reload} loading={loading} className="!px-3 !py-1.5 text-xs">
              <RefreshCw size={14} /><span className="hidden sm:inline">รีเฟรช</span>
            </Button>
            {isLoggedIn ? (
              <Button variant="gold" onClick={onBackToPortal} className="!px-3.5 !py-1.5 text-xs">
                <ArrowLeft size={14} />กลับหลังบ้าน
              </Button>
            ) : (
              <Button variant="primary" onClick={onLoginClick} className="!px-3.5 !py-1.5 text-xs">
                <LogIn size={14} />เข้าสู่ระบบ
              </Button>
            )}
          </div>
        </div>
        {IS_MOCK && (
          <div className="bg-amber-500/10 text-amber-300 text-[11px] text-center py-1 px-2">
            โหมดทดลอง (Mock) – แอดมินสามารถอัปโหลดรูปสินค้าและรูปโชว์หน้าร้านได้ทันที
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {loading && !data ? (
          <Spinner label="กำลังโหลดหน้าร้าน" />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : (
          <>
            {hasContact && (
              <div className="flex flex-wrap items-center gap-2 animate-fade-up">
                <ContactChip label="Facebook" value={settings.contact_facebook} tone="border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20" />
                <ContactChip label="Line" value={settings.contact_line} tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" />
                <ContactChip label="Discord" value={settings.contact_discord} tone="border-arcane-500/30 bg-arcane-500/10 text-arcane-300 hover:bg-arcane-500/20" />
              </div>
            )}

            {/* Filter & Search Toolbar */}
            <section className="card p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-up">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาชื่อไอเทม, รุ่น เช่น EX 2, +12..."
                  className="!pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={`px-3 py-1 rounded-full text-xs border transition active:scale-95 ${
                      cat === c
                        ? 'bg-arcane-600/25 border-arcane-500/40 text-arcane-400 font-semibold'
                        : 'border-ink-600 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c === 'ALL' ? 'ทั้งหมด' : c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOnlyInStock((v) => !v)}
                  className={`ml-auto md:ml-2 px-3 py-1 rounded-full text-xs border transition active:scale-95 ${
                    onlyInStock
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                      : 'border-ink-600 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {onlyInStock ? '✓ เฉพาะพร้อมส่ง' : 'เฉพาะพร้อมส่ง'}
                </button>
              </div>
            </section>

            {/* Product Grid */}
            {!filtered.length ? (
              <div className="card p-6"><Empty>ไม่พบไอเทมที่ตรงกับการค้นหา</Empty></div>
            ) : (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((it, idx) => {
                  const inStock = it.available_count > 0;
                  const unit = fmtUnit(it.unit);
                  const namedVars = (it.variants || []).filter((v) => v.variant);
                  const showVariants = it.has_custom_option && namedVars.length > 0;
                  return (
                    <article
                      key={it.item_id}
                      onClick={() => setDetail(it)}
                      style={{ animationDelay: `${Math.min(idx, 9) * 45}ms` }}
                      className={`group card card-hover overflow-hidden flex flex-col cursor-pointer animate-fade-up ${!inStock ? 'opacity-75' : ''}`}
                    >
                      <div className="relative aspect-[16/10] border-b border-ink-700 overflow-hidden">
                        <ItemVisual src={it.image_url} name={it.item_name} category={it.category} className="h-full w-full" />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="rounded-full bg-ink-950/80 backdrop-blur border border-ink-600 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                            {it.category || 'Item'}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          {inStock ? (
                            <span className="rounded-full bg-emerald-950/90 backdrop-blur border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 tabular-nums">
                              พร้อมส่ง {fmtNum(it.available_count)} {unit}
                            </span>
                          ) : (
                            <span className="rounded-full bg-ink-950/85 backdrop-blur border border-ink-600 px-2.5 py-0.5 text-[11px] text-slate-400">
                              หมดชั่วคราว
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-slate-100 group-hover:text-gold-400 transition">{it.item_name}</h3>
                            {showVariants && (
                              <span className="shrink-0 text-[10px] text-gold-400 border border-gold-500/30 bg-gold-500/10 rounded px-1.5 py-0.5">
                                แยกรุ่น
                              </span>
                            )}
                          </div>
                          {it.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{it.description}</p>
                          )}
                          {showVariants && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {it.variants.slice(0, 4).map((v, vi) => (
                                <span key={vi} className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-900/70 px-2 py-0.5 text-[11px] text-slate-300">
                                  <span className="text-gold-400 font-medium">{v.variant || it.item_name}</span>
                                  <span className="text-slate-500">· {v.count} {unit}</span>
                                </span>
                              ))}
                              {it.variants.length > 4 && (
                                <span className="text-[11px] text-slate-500 px-1 py-0.5">+{it.variants.length - 4} รุ่น</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-ink-700/80 flex items-center justify-between text-xs">
                          <span className="text-slate-500">{fmtGame(it.server)}</span>
                          <span className="font-semibold text-arcane-400 group-hover:translate-x-0.5 transition">
                            {inStock ? 'ดูรายละเอียด / สั่งซื้อ →' : 'ดูรายละเอียด →'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>

      {/* Product Detail Modal */}
      <ItemDetailModal
        item={detail}
        settings={settings}
        onClose={() => setDetail(null)}
        onZoom={(item) => setLightbox({ image_url: item.image_url, title: item.item_name, caption: item.description, tag: item.category })}
      />

      {/* Lightbox Modal */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl w-full card overflow-hidden animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="ปิดรูปภาพ"
              className="absolute top-3 right-3 z-10 rounded-full bg-ink-950/80 hover:bg-ink-800 border border-ink-600 p-2 text-slate-200 transition"
            >
              <X size={18} />
            </button>
            <div className="bg-ink-950 flex items-center justify-center max-h-[75vh]">
              <img src={lightbox.image_url} alt={lightbox.title} className="max-h-[75vh] w-auto object-contain" />
            </div>
            {(lightbox.title || lightbox.caption) && (
              <div className="p-4 border-t border-ink-700">
                <div className="flex items-center gap-2">
                  {lightbox.tag && <span className="rounded-full bg-gold-500/15 border border-gold-500/30 px-2 py-0.5 text-[10px] font-semibold text-gold-400">{lightbox.tag}</span>}
                  <h3 className="font-bold text-slate-100">{lightbox.title}</h3>
                </div>
                {lightbox.caption && <p className="text-xs text-slate-400 mt-1">{lightbox.caption}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemDetailModal({ item, settings, onClose, onZoom }) {
  const toast = useToast();
  const [selVar, setSelVar] = useState(0);
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelVar(0);
    setQty(1);
    setCopied(false);
  }, [item]);

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;
  const unit = fmtUnit(item.unit);
  const variants = item.has_custom_option ? (item.variants || []) : [];
  const hasNamedVariants = variants.some((v) => v.variant);
  const pickedVar = variants[selVar] || null;
  const maxQty = item.has_custom_option ? (pickedVar?.count || 0) : item.available_count;
  const orderCount = maxQty > 0 ? Math.max(1, Math.min(Number(qty) || 1, maxQty)) : 1;

  const copyOrder = async () => {
    const lines = [
      `สนใจสั่งซื้อสินค้า (${fmtGame(item.server)})`,
      `• รายการ: ${item.item_name}`,
      ...(item.has_custom_option && pickedVar?.variant ? [`• รุ่น/ออปชั่น: ${pickedVar.variant}`] : []),
      `• จำนวน: ${orderCount} ${unit}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      toast('คัดลอกข้อความสั่งซื้อแล้ว ส่งให้แอดมินได้เลย');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('คัดลอกไม่สำเร็จ กรุณาแคปหน้าจอส่งแอดมิน', 'err');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="card max-w-lg w-full overflow-hidden animate-pop-in shadow-2xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/9] bg-ink-950 border-b border-ink-700">
          <ItemVisual src={item.image_url} name={item.item_name} category={item.category} size="lg" className="h-full w-full" />
          <button type="button" onClick={onClose} aria-label="ปิด"
            className="absolute top-3 right-3 rounded-full bg-ink-950/80 hover:bg-ink-800 border border-ink-600 p-1.5 text-slate-200 transition">
            <X size={16} />
          </button>
          {item.image_url && (
            <button type="button" onClick={() => onZoom(item)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-ink-950/80 hover:bg-ink-800 border border-ink-600 px-2.5 py-1 text-[11px] text-slate-200 transition">
              <Maximize2 size={12} />ดูรูปใหญ่
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">{item.category || 'Item'} · {fmtGame(item.server)}</div>
              <h2 className="text-lg font-bold text-slate-100">{item.item_name}</h2>
            </div>
            {item.available_count > 0 ? (
              <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-300 tabular-nums">
                พร้อมส่ง {fmtNum(item.available_count)} {unit}
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-ink-600 bg-ink-700 px-3 py-0.5 text-xs text-slate-400">
                สินค้าหมดชั่วคราว
              </span>
            )}
          </div>

          {item.description && <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>}

          {item.has_custom_option && hasNamedVariants && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400">รุ่น / ออปชั่นที่มีพร้อมส่ง</div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelVar(idx); setQty(1); }}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition active:scale-95 ${
                      selVar === idx
                        ? 'border-gold-400 bg-gold-500/15 text-gold-300 font-semibold'
                        : 'border-ink-600 bg-ink-900/50 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {v.variant || item.item_name} <span className="ml-1 text-emerald-300 font-bold">({v.count} {unit})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {maxQty > 0 && (
            <div className="rounded-xl border border-ink-600 bg-ink-900/50 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">จำนวนที่ต้องการ ({unit})</span>
                <div className="w-full sm:w-56"><QtyInput value={qty} onChange={setQty} max={maxQty} /></div>
              </div>
              <Button variant="gold" className="w-full" onClick={copyOrder}>
                {copied ? <><Check size={16} />คัดลอกข้อความสั่งซื้อแล้ว!</> : <><Copy size={16} />คัดลอกข้อความสั่งซื้อส่งแอดมิน</>}
              </Button>
            </div>
          )}

          {(settings.contact_facebook || settings.contact_line || settings.contact_discord) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">ติดต่อร้าน:</span>
              <ContactChip label="Facebook" value={settings.contact_facebook} tone="border-sky-500/30 bg-sky-500/10 text-sky-300" />
              <ContactChip label="Line" value={settings.contact_line} tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
              <ContactChip label="Discord" value={settings.contact_discord} tone="border-arcane-500/30 bg-arcane-500/10 text-arcane-300" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
