import { useState } from 'react';
import { Plus, Power, Pencil, Save, X } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, ErrorBox, Field, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import ImagePicker from '../../components/ImagePicker.jsx';
import ItemVisual from '../../components/ItemVisual.jsx';

const blank = { item_id: '', item_name: '', category: '', has_custom_option: false, image_url: '', description: '' };

export default function MasterItems() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.masterItems(), []);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const isEdit = !!form.item_id;
  const reset = () => setForm(blank);
  const startEdit = (i) => {
    setForm({
      item_id: i.item_id,
      item_name: i.item_name || '',
      category: i.category || '',
      has_custom_option: !!i.has_custom_option,
      image_url: i.image_url || '',
      description: i.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.itemUpsert({ ...form, item_id: form.item_id || undefined });
      toast(isEdit ? 'อัปเดตไอเทมแล้ว' : 'เพิ่มไอเทมแล้ว');
      reset();
      reload();
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };

  const toggleVariants = async (i) => {
    try {
      await api.itemUpsert({ item_id: i.item_id, item_name: i.item_name, category: i.category, has_custom_option: !i.has_custom_option });
      toast(i.has_custom_option ? 'ปิดการแยกรุ่นแล้ว' : 'เปิดการแยกรุ่นแล้ว'); reload();
    } catch (x) { toast(x.message, 'err'); }
  };

  const toggle = async (it) => {
    try { await api.itemToggle(it.item_id, !it.is_active); reload(); } catch (x) { toast(x.message, 'err'); }
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
      <Card
        title={isEdit ? 'แก้ไขไอเทม & รูปสินค้า' : 'เพิ่มไอเทมใหม่'}
        action={isEdit && <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"><X size={13} />ยกเลิก</button>}
      >
        <form onSubmit={save} className="space-y-3">
          <Field label="ชื่อไอเทม"><input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} required maxLength={100} /></Field>
          <Field label="หมวดหมู่"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={50} placeholder="เช่น Currency, Material, Vehicle, Equipment" /></Field>
          <Field label="คำอธิบายสั้น (แสดงหน้าลูกค้า)">
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} placeholder="รายละเอียดจุดเด่นสินค้า (ไม่บังคับ)" />
          </Field>
          <ImagePicker
            label="รูปภาพสินค้า (แสดงหน้าลูกค้า)"
            value={form.image_url}
            onChange={(image_url) => setForm({ ...form, image_url })}
            maxDim={640}
          />
          <label className="flex items-center gap-2 !mb-0 cursor-pointer text-sm text-slate-300">
            <input type="checkbox" className="!w-4" checked={form.has_custom_option} onChange={(e) => setForm({ ...form, has_custom_option: e.target.checked })} />
            ไอเทมนี้แยกรุ่น/ออปชั่น (เช่น รถ, อาวุธ) · ของอย่าง GEM ไม่ต้องติ๊ก
          </label>
          <div className="flex gap-2">
            {isEdit && <Button type="button" variant="ghost" onClick={reset} className="flex-1">ยกเลิก</Button>}
            <Button type="submit" variant={isEdit ? 'gold' : 'primary'} loading={busy} className="flex-1">
              {isEdit ? <><Save size={16} />บันทึกการแก้ไข</> : <><Plus size={16} />เพิ่มไอเทม</>}
            </Button>
          </div>
        </form>
      </Card>

      <Card title={`ไอเทมทั้งหมด (${data.length})`}>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full min-w-[580px]">
            <thead><tr><th className="th">ไอเทม</th><th className="th">หมวด</th><th className="th">ประเภท</th><th className="th" /></tr></thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.item_id} className={`tr-hover ${i.is_active ? '' : 'opacity-50'} ${form.item_id === i.item_id ? 'bg-arcane-600/10' : ''}`}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <ItemVisual src={i.image_url} name={i.item_name} category={i.category} size="sm" className="h-10 w-10 rounded-lg border border-ink-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-100 truncate">{i.item_name}</div>
                        {i.description && <div className="text-[11px] text-slate-500 truncate max-w-[240px]">{i.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="td text-slate-400">{i.category}</td>
                  <td className="td text-xs">
                    <button onClick={() => toggleVariants(i)} title="คลิกเพื่อสลับ" className={`rounded-full border px-2 py-0.5 transition active:scale-95 ${i.has_custom_option ? 'border-gold-500/40 text-gold-400 bg-gold-500/10' : 'border-ink-600 text-slate-400 hover:text-slate-200'}`}>
                      {i.has_custom_option ? 'แยกรุ่น' : 'ทั่วไป'}
                    </button>
                  </td>
                  <td className="td text-right whitespace-nowrap space-x-1.5">
                    <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => startEdit(i)}><Pencil size={13} />แก้ไข / รูป</Button>
                    <Button variant={i.is_active ? 'danger' : 'ghost'} className="!px-2.5 !py-1 text-xs" onClick={() => toggle(i)}><Power size={13} />{i.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
