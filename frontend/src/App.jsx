import { useCallback, useState } from 'react';
import { LayoutDashboard, PackagePlus, ListPlus, ListOrdered, Boxes, Swords, ClipboardList, Database, Users, ScrollText, UserCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Splash from './components/Splash.jsx';
import Login from './pages/Login.jsx';
import SupplierDashboard from './pages/supplier/Dashboard.jsx';
import AddStock from './pages/supplier/AddStock.jsx';
import Enqueue from './pages/supplier/Enqueue.jsx';
import MyStock from './pages/supplier/MyStock.jsx';
import Overview from './pages/admin/Overview.jsx';
import Fulfillment from './pages/admin/Fulfillment.jsx';
import Orders from './pages/admin/Orders.jsx';
import MasterItems from './pages/admin/MasterItems.jsx';
import UsersAdmin from './pages/admin/UsersAdmin.jsx';
import Logs from './pages/admin/Logs.jsx';
import Account from './pages/Account.jsx';

// Supplier flow:  1 ลงสต็อก (เข้าคลัง)  →  2 ลงคิวขาย (เลือกจากคลัง)  →  3 คิวของฉัน (ติดตาม)
const SUPPLIER_TABS = [
  { key: 'dash', label: 'ภาพรวม', icon: LayoutDashboard, view: SupplierDashboard },
  { key: 'add', label: 'ลงสต็อก', icon: PackagePlus, view: AddStock, step: 1 },
  { key: 'enqueue', label: 'ลงคิวขาย', icon: ListPlus, view: Enqueue, step: 2 },
  { key: 'mine', label: 'คิวของฉัน', icon: ListOrdered, view: MyStock, step: 3 },
  { key: 'me', label: 'บัญชี', icon: UserCircle, view: Account }
];
const ADMIN_TABS = [
  { key: 'overview', label: 'สต็อกร้าน', icon: Boxes, view: Overview },
  { key: 'fifo', label: 'คิวขาย', icon: Swords, view: Fulfillment },
  { key: 'orders', label: 'ออเดอร์', icon: ClipboardList, view: Orders },
  { key: 'items', label: 'ไอเทม', icon: Database, view: MasterItems },
  { key: 'users', label: 'ผู้ใช้', icon: Users, view: UsersAdmin },
  { key: 'logs', label: 'Log', icon: ScrollText, view: Logs },
  { key: 'me', label: 'บัญชี', icon: UserCircle, view: Account }
];

export default function App() {
  const { user, booting } = useAuth();
  const [tab, setTab] = useState(null);
  const [params, setParams] = useState(null); // e.g. { focus: 'I-4|ex 2 +12' } when jumping to a page with something pre-selected
  const goTo = useCallback((key, p = null) => { setTab(key); setParams(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  if (booting) return <Splash />;
  if (!user) return <Login />;

  const tabs = user.role === 'admin' ? ADMIN_TABS : SUPPLIER_TABS;
  const current = tabs.find((t) => t.key === tab) || tabs[0];
  const View = current.view;
  // key={user_id} drops page state when another user logs in
  return (
    <Layout key={user.user_id} tabs={tabs} active={current.key} onChange={(k) => goTo(k)}>
      <View goTo={goTo} params={params} />
    </Layout>
  );
}
