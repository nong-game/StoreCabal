import { useState } from 'react';
import { Plus, Power } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, ErrorBox, Field, Spinner, useAsync, useToast } from '../../components/ui.jsx';

const blank = { item_name: '', category: '', has_custom_option: false };

export default function MasterItems() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.masterItems(), []);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.itemUpsert(form); toast('บันทึกไอเทมแล้ว'); setForm(blank); reload(); }
    catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
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
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      <Card title="เพิ่มไอเทมใหม่">
        <form onSubmit={save} className="space-y-3">
          <Field label="ชื่อไอเทม"><input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} required maxLength={100} /></Field>
          <Field label="หมวดหมู่"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={50} /></Field>
          <label className="flex items-center gap-2 !mb-0 cursor-pointer text-sm text-slate-300">
            <input type="checkbox" className="!w-4" checked={form.has_custom_option} onChange={(e) => setForm({ ...form, has_custom_option: e.target.checked })} />
            ไอเทมนี้แยกรุ่น/ออปชั่น (เช่น รถ, อาวุธ) · ของอย่าง GEM ไม่ต้องติ๊ก
          </label>
          <Button type="submit" loading={busy} className="w-full"><Plus size={16} />เพิ่ม</Button>
        </form>
      </Card>
      <Card title={`ไอเทมทั้งหมด (${data.length})`}>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full min-w-[520px]">
            <thead><tr><th className="th">ไอเทม</th><th className="th">หมวด</th><th className="th">ประเภท</th><th className="th" /></tr></thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.item_id} className={i.is_active ? '' : 'opacity-50'}>
                  <td className="td">{i.item_name}</td><td className="td text-slate-400">{i.category}</td>
                  <td className="td text-xs">
                    <button onClick={() => toggleVariants(i)} title="คลิกเพื่อสลับ" className={`rounded-full border px-2 py-0.5 transition active:scale-95 ${i.has_custom_option ? 'border-gold-500/40 text-gold-400 bg-gold-500/10' : 'border-ink-600 text-slate-400 hover:text-slate-200'}`}>
                      {i.has_custom_option ? 'แยกรุ่น' : 'ทั่วไป'}
                    </button>
                  </td>
                  <td className="td text-right">
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
