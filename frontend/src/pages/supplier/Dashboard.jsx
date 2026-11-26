import { Hourglass, Lock, BadgeCheck, PackagePlus, Warehouse, ListPlus, ArrowRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { ErrorBox, Spinner, Stat, useAsync } from '../../components/ui.jsx';
import FlowSteps from '../../components/FlowSteps.jsx';
import { fmtNum } from '../../utils/format.js';

/** Big, obvious next actions — what a supplier usually wants to do right now */
function ActionCard({ icon: Icon, title, desc, tone, onClick, delay }) {
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${delay * 70}ms` }}
      className="group card card-hover p-4 text-left flex items-center gap-3 animate-fade-up active:scale-[.98]">
      <div className={`p-3 rounded-xl ${tone}`}><Icon size={22} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-100">{title}</div>
        <div className="text-xs text-slate-500 truncate">{desc}</div>
      </div>
      <ArrowRight size={18} className="text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-slate-200" />
    </button>
  );
}

export default function SupplierDashboard({ goTo }) {
  const { data, error, loading, reload } = useAsync(() => api.supplierDashboard(), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const c = data.counts;
  return (
    <>
      <h1 className="text-lg font-bold text-slate-100 animate-fade-up">ภาพรวมของฉัน</h1>
      <FlowSteps active={null} goTo={goTo} badges={{ enqueue: c.STOCKED }} />

      <div className="grid sm:grid-cols-2 gap-3">
        <ActionCard icon={PackagePlus} title="ลงสต็อกเข้าคลัง" desc="เพิ่มของใหม่ เก็บไว้ก่อน ยังไม่เข้าคิว" tone="bg-sky-500/15 text-sky-300" onClick={() => goTo('add')} delay={1} />
        <ActionCard icon={ListPlus} title="ลงคิวขาย" desc={c.STOCKED ? `มีของในคลัง ${fmtNum(c.STOCKED)} ชิ้น พร้อมเข้าคิว` : 'คลังว่าง ลงสต็อกก่อน'} tone="bg-gold-500/15 text-gold-400" onClick={() => goTo('enqueue')} delay={2} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ในคลัง" value={c.STOCKED} delay={3} icon={Warehouse} tone="text-sky-300" />
        <Stat label="ในคิว (ชิ้น)" value={c.AVAILABLE} delay={4} icon={Hourglass} tone="text-emerald-300" />
        <Stat label="ติดจอง" value={c.RESERVED} delay={5} icon={Lock} tone="text-amber-300" />
        <Stat label="ขายแล้ว" value={c.SOLD} delay={6} icon={BadgeCheck} tone="text-arcane-400" />
      </div>
      <p className="text-xs text-slate-500">ทั้งหมด {fmtNum(data.total)} ชิ้น · ถอนออกแล้ว {fmtNum(c.WITHDRAWN)} ชิ้น</p>
    </>
  );
}
