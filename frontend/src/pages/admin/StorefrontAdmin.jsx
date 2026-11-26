import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Trash2, Eye, EyeOff, Save, Store, X, ExternalLink } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, Confirm, Empty, ErrorBox, Field, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import ImagePicker from '../../components/ImagePicker.jsx';

const BLANK_MEDIA = { media_id: '', title: '', caption: '', tag: 'สินค้าแนะนำ', image_url: '', sort_order: 1, is_active: true };

export default function StorefrontAdmin({ onPreviewStorefront }) {
  const toast = useToast();
  const mediaReq = useAsync(() => api.mediaList(), []);
  const catalogReq = useAsync(() => api.publicCatalog(), []);

  const [form, setForm] = useState(BLANK_MEDIA);
  const [busyMedia, setBusyMedia] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const [cfg, setCfg] = useState({
    shop_title: '', shop_subtitle: '', notice_text: '',
    contact_facebook: '', contact_line: '', contact_discord: ''
  });
  const [busyCfg, setBusyCfg] = useState(false);

  useEffect(() => {
    if (catalogReq.data?.settings) setCfg(catalogReq.data.settings);
  }, [catalogReq.data]);

  if (mediaReq.loading && !mediaReq.data) return <Spinner />;
  if (mediaReq.error) return <ErrorBox error={mediaReq.error} onRetry={mediaReq.reload} />;

  const mediaList = mediaReq.data || [];
  const isEdit = !!form.media_id;

  const resetForm = () => setForm({ ...BLANK_MEDIA, sort_order: mediaList.length + 1 });
  const editMedia = (m) => {
    setForm({
      media_id: m.media_id,
      title: m.title || '',
      caption: m.caption || '',
      tag: m.tag || '',
      image_url: m.image_url || '',
      sort_order: m.sort_order ?? 0,
      is_active: !!m.is_active
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMedia = async (e) => {
    e.preventDefault();
    if (!form.image_url) { toast('กรุณาอัปโหลดรูปหรือใส่ลิงก์รูปก่อน', 'err'); return; }
    setBusyMedia(true);
    try {
      await api.mediaUpsert({ ...form, media_id: form.media_id || undefined });
      toast(isEdit ? 'อัปเดตรูปโชว์หน้าร้านแล้ว' : 'เพิ่มรูปโชว์หน้าร้านแล้ว');
      setForm(BLANK_MEDIA);
      mediaReq.reload();
    } catch (x) { toast(x.message, 'err'); } finally { setBusyMedia(false); }
  };

  const toggleActive = async (m) => {
    try {
      await api.mediaUpsert({ ...m, is_active: !m.is_active });
      toast(m.is_active ? 'ซ่อนรูปจากหน้าร้านแล้ว' : 'แสดงรูปบนหน้าร้านแล้ว');
      mediaReq.reload();
    } catch (x) { toast(x.message, 'err'); }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setBusyMedia(true);
    try {
      await api.mediaDelete(delTarget.media_id);
      toast('ลบรูปโชว์แล้ว');
      if (form.media_id === delTarget.media_id) setForm(BLANK_MEDIA);
      setDelTarget(null);
      mediaReq.reload();
    } catch (x) { toast(x.message, 'err'); } finally { setBusyMedia(false); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusyCfg(true);
    try {
      const updated = await api.storefrontSettingsSave(cfg);
      setCfg(updated);
      toast('บันทึกข้อมูลหน้าร้านแล้ว');
    } catch (x) { toast(x.message, 'err'); } finally { setBusyCfg(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100">จัดการหน้าร้าน & รูปโชว์สินค้า</h1>
          <p className="text-xs text-slate-500">อัปโหลดรูปโชว์สินค้า สเตตัสไอเทม หรือแบนเนอร์ประกอบให้ลูกค้าขาจรดูไม่โล่ง</p>
        </div>
        {onPreviewStorefront && (
          <Button variant="gold" onClick={onPreviewStorefront} className="shrink-0">
            <ExternalLink size={15} />เปิดดูหน้าร้านลูกค้า
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-[370px_1fr] gap-4 items-start">
        {/* Upload / Edit Showcase Form */}
        <Card
          title={isEdit ? 'แก้ไขรูปโชว์สินค้า' : 'เพิ่มรูปโชว์สินค้า / รูปประกอบ'}
          action={isEdit && <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"><X size={13} />ยกเลิก</button>}
        >
          <form onSubmit={saveMedia} className="space-y-3">
            <ImagePicker
              label="รูปภาพโชว์สินค้า / แบนเนอร์"
              value={form.image_url}
              onChange={(image_url) => setForm({ ...form, image_url })}
              maxDim={960}
              aspectClass="aspect-[16/9]"
              hint="แนะนำรูปแนวนอน 16:9 (เช่น สเตตัสไอเทมในเกม หรือแบนเนอร์ร้าน)"
            />
            <Field label="หัวข้อรูปภาพ">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="เช่น รถ RW3 EX 2 +12 พร้อมโอน" />
            </Field>
            <Field label="คำบรรยายสั้น (ไม่บังคับ)">
              <textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} maxLength={240} placeholder="รายละเอียดเพิ่มเติมที่แสดงบนรูป" />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="ป้ายกำกับ (Tag)">
                <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} maxLength={40} placeholder="สินค้าแนะนำ" />
              </Field>
              <Field label="ลำดับการแสดง">
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 !mb-0 cursor-pointer text-sm text-slate-300">
              <input type="checkbox" className="!w-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              แสดงบนหน้าร้านทันที
            </label>
            <div className="flex gap-2">
              {isEdit && <Button type="button" variant="ghost" onClick={resetForm} className="flex-1">ยกเลิก</Button>}
              <Button type="submit" variant={isEdit ? 'gold' : 'primary'} loading={busyMedia} className="flex-1">
                {isEdit ? <><Save size={16} />บันทึกการแก้ไข</> : <><ImagePlus size={16} />เพิ่มรูปโชว์</>}
              </Button>
            </div>
          </form>
        </Card>

        {/* Showcase Gallery List */}
        <div className="space-y-4">
          <Card title={`รูปโชว์หน้าร้าน (${mediaList.length})`} delay={1}>
            {!mediaList.length ? (
              <Empty>ยังไม่มีรูปโชว์สินค้า อัปโหลดทางซ้ายเพื่อให้หน้าร้านดูน่าสนใจขึ้น</Empty>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {mediaList.map((m) => (
                  <div key={m.media_id} className={`rounded-xl border border-ink-600 bg-ink-900/50 overflow-hidden flex flex-col ${m.is_active ? '' : 'opacity-55'}`}>
                    <div className="relative aspect-[16/9] bg-ink-950">
                      <img src={m.image_url} alt={m.title} className="h-full w-full object-cover" />
                      {m.tag && (
                        <span className="absolute top-2 left-2 rounded-full bg-ink-950/80 border border-gold-500/40 px-2 py-0.5 text-[10px] font-semibold text-gold-400">
                          {m.tag}
                        </span>
                      )}
                      <span className="absolute top-2 right-2 rounded-full bg-ink-950/80 border border-ink-600 px-2 py-0.5 text-[10px] text-slate-300 tabular-nums">
                        #{m.sort_order}
                      </span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-slate-100 truncate">{m.title}</div>
                        {m.caption && <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">{m.caption}</div>}
                      </div>
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-ink-700/80">
                        <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => toggleActive(m)}>
                          {m.is_active ? <><Eye size={13} />แสดงอยู่</> : <><EyeOff size={13} />ซ่อนอยู่</>}
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => editMedia(m)}><Pencil size={13} />แก้ไข</Button>
                          <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setDelTarget(m)}><Trash2 size={13} /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Storefront Text & Contact Settings */}
          <Card title={<span className="flex items-center gap-2"><Store size={15} className="text-gold-400" />ข้อความต้อนรับ & ช่องทางติดต่อหน้าร้าน</span>} delay={2}>
            <form onSubmit={saveSettings} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="ชื่อร้าน (แสดงบนหน้าร้าน)">
                  <input value={cfg.shop_title} onChange={(e) => setCfg({ ...cfg, shop_title: e.target.value })} maxLength={120} />
                </Field>
                <Field label="คำโปรยใต้ชื่อร้าน">
                  <input value={cfg.shop_subtitle} onChange={(e) => setCfg({ ...cfg, shop_subtitle: e.target.value })} maxLength={200} />
                </Field>
              </div>
              <Field label="ประกาศ / วิธีสั่งซื้อสำหรับลูกค้าขาจร">
                <input value={cfg.notice_text} onChange={(e) => setCfg({ ...cfg, notice_text: e.target.value })} maxLength={300} />
              </Field>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Facebook (ลิงก์หรือชื่อเพจ)">
                  <input value={cfg.contact_facebook} onChange={(e) => setCfg({ ...cfg, contact_facebook: e.target.value })} placeholder="https://fb.me/..." />
                </Field>
                <Field label="Line (ลิงก์หรือ Line ID)">
                  <input value={cfg.contact_line} onChange={(e) => setCfg({ ...cfg, contact_line: e.target.value })} placeholder="@cabalshop" />
                </Field>
                <Field label="Discord (ลิงก์หรือ Tag)">
                  <input value={cfg.contact_discord} onChange={(e) => setCfg({ ...cfg, contact_discord: e.target.value })} placeholder="https://discord.gg/..." />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="gold" loading={busyCfg}><Save size={15} />บันทึกข้อมูลหน้าร้าน</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      <Confirm
        open={!!delTarget}
        danger
        loading={busyMedia}
        title="ลบรูปโชว์สินค้า"
        confirmLabel="ลบรูป"
        onCancel={() => setDelTarget(null)}
        onConfirm={confirmDelete}
        body={delTarget && <>ต้องการลบรูป <b className="text-slate-200">{delTarget.title}</b> ออกจากหน้าร้านใช่ไหม?</>}
      />
    </div>
  );
}
