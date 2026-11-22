import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  Building2,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  Upload,
  Users,
  Wifi,
  X,
} from 'lucide-react';

type Role = 'administrador' | 'almacenero' | 'trabajador';
type Screen = 'inicio' | 'entrega' | 'trabajadores' | 'sedes' | 'catalogo' | 'stock' | 'historial' | 'configuracion';
type ItemReason = 'Primera entrega' | 'Reposición' | 'Deterioro' | 'Pérdida';

type Site = {
  id: string;
  name: string;
  address: string;
  active: boolean;
};

type Worker = {
  id: string;
  name: string;
  dni: string;
  area: string;
  position: string;
  site: string;
  siteId: string;
  sizes: string;
  renewal: string;
  active: boolean;
};

type Equipment = {
  id: string;
  name: string;
  standard: string;
  stock: number;
  size: string;
  quantity: number;
  reason: ItemReason;
  unitCost: number;
  checked: boolean;
};

type WorkerImportRow = {
  rowNumber: number;
  values: string[];
  errors: string[];
  worker?: Worker;
};

const workerTemplateHeaders = ['Nombres y apellidos', 'DNI', 'Área', 'Puesto', 'Sede', 'Talla de casco', 'Talla de chaleco', 'Talla de calzado', 'Estado'];

const demoWorkers: Worker[] = [
  { id: 'w1', name: 'Luis Alberto Mendoza Rojas', dni: '45872136', area: 'Operaciones', position: 'Operario de almacén', site: 'Sede Callao', siteId: 'site-callao', sizes: 'M / 40', renewal: '15/02/2027', active: true },
  { id: 'w2', name: 'María Fernanda Salazar Díaz', dni: '70451289', area: 'Mantenimiento', position: 'Técnica de mantenimiento', site: 'Sede Lima', siteId: 'site-lima', sizes: 'S / 38', renewal: '08/01/2027', active: true },
  { id: 'w3', name: 'Carlos Eduardo Paredes Vega', dni: '41782365', area: 'Operaciones', position: 'Supervisor de planta', site: 'Sede Callao', siteId: 'site-callao', sizes: 'L / 42', renewal: '20/03/2027', active: true },
];

const demoSites: Site[] = [
  { id: 'site-callao', name: 'Sede Callao', address: 'Av. Néstor Gambetta 1450, Callao', active: true },
  { id: 'site-lima', name: 'Sede Lima', address: 'Av. Argentina 1860, Lima', active: true },
];

const equipmentSeed: Equipment[] = [
  { id: 'e1', name: 'Casco de seguridad', standard: 'NTP 399.018', stock: 42, size: 'Única', quantity: 1, reason: 'Primera entrega', unitCost: 38.5, checked: true },
  { id: 'e2', name: 'Chaleco reflectivo', standard: 'ANSI/ISEA 107', stock: 18, size: 'M', quantity: 1, reason: 'Primera entrega', unitCost: 29.9, checked: true },
  { id: 'e3', name: 'Guantes anticorte', standard: 'EN 388:2016', stock: 7, size: '9', quantity: 1, reason: 'Reposición', unitCost: 24.75, checked: false },
  { id: 'e4', name: 'Lentes de seguridad', standard: 'ANSI Z87.1', stock: 31, size: 'Única', quantity: 1, reason: 'Primera entrega', unitCost: 18.4, checked: true },
  { id: 'e5', name: 'Botas con punta de acero', standard: 'NTP ISO 20345', stock: 12, size: '40', quantity: 1, reason: 'Primera entrega', unitCost: 128, checked: false },
];

const navItems: Array<{ id: Screen; label: string; icon: typeof LayoutDashboard; roles: Role[] }> = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, roles: ['administrador', 'almacenero', 'trabajador'] },
  { id: 'trabajadores', label: 'Trabajadores', icon: Users, roles: ['administrador', 'almacenero'] },
  { id: 'sedes', label: 'Incluir sedes', icon: Building2, roles: ['administrador'] },
  { id: 'catalogo', label: 'Catálogo y matriz', icon: ShieldCheck, roles: ['administrador', 'almacenero'] },
  { id: 'stock', label: 'Stock', icon: Package, roles: ['administrador', 'almacenero'] },
  { id: 'historial', label: 'Historial', icon: History, roles: ['administrador', 'almacenero'] },
  { id: 'configuracion', label: 'Configuración', icon: Settings, roles: ['administrador'] },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function readStoredData<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

async function persistSite(site: Site) {
  const { error } = await supabase.from('sedes').insert({ nombre: site.name, direccion: site.address, activo: site.active });
  if (error) console.warn('No se pudo sincronizar la sede.', error.message);
}

async function persistWorker(worker: Worker) {
  const { error } = await supabase.from('trabajadores').insert({ nombre_completo: worker.name, dni: worker.dni, area: worker.area, puesto: worker.position, sede_id: worker.siteId, talla_casco: worker.sizes.split(' / ')[0], talla_calzado: worker.sizes.split(' / ')[1], activo: worker.active });
  if (error) console.warn('No se pudo sincronizar el trabajador.', error.message);
}

async function persistWorkers(workers: Worker[]) {
  const { error } = await supabase.from('trabajadores').insert(workers.map((worker) => ({ nombre_completo: worker.name, dni: worker.dni, area: worker.area, puesto: worker.position, sede_id: worker.siteId, talla_casco: worker.sizes.split(' / ')[0], talla_calzado: worker.sizes.split(' / ')[1], activo: worker.active })));
  if (error) console.warn('No se pudo sincronizar la carga masiva.', error.message);
}

async function updateWorkerRemote(worker: Worker) {
  const { error } = await supabase.from('trabajadores').update({ nombre_completo: worker.name, dni: worker.dni, area: worker.area, sede_id: worker.siteId, activo: worker.active }).eq('dni', worker.dni);
  if (error) console.warn('No se pudo sincronizar la actualización del trabajador.', error.message);
}

async function deleteWorkerRemote(dni: string) {
  const { error } = await supabase.from('trabajadores').delete().eq('dni', dni);
  if (error) console.warn('No se pudo sincronizar la eliminación del trabajador.', error.message);
}

function downloadWorkerTemplate() {
  const workbook = XLSX.utils.book_new();
  const template = [workerTemplateHeaders, ['Luis Alberto Mendoza Rojas', '45872136', 'Operaciones', 'Operario de almacén', 'Sede Callao', 'M', 'M', '40', 'Activo']];
  const instructions = [['Campo', 'Descripción'], ['Nombres y apellidos', 'Campo obligatorio. Nombre completo del trabajador.'], ['DNI', 'Campo obligatorio. Solo números, sin espacios.'], ['Área', 'Área de trabajo.'], ['Puesto', 'Puesto o cargo del trabajador.'], ['Sede', 'Debe coincidir con una sede activa registrada en SegurEPP.'], ['Talla de casco', 'Talla o medida del casco.'], ['Talla de chaleco', 'Talla del chaleco.'], ['Talla de calzado', 'Número de calzado.'], ['Estado', 'Usa Activo o Inactivo.']];
  const sheet = XLSX.utils.aoa_to_sheet(template);
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  sheet['!cols'] = workerTemplateHeaders.map(() => ({ wch: 22 }));
  instructionsSheet['!cols'] = [{ wch: 24 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Trabajadores');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instrucciones');
  XLSX.writeFile(workbook, 'plantilla-trabajadores-segurepp.xlsx');
}

function normalizeImportHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function App() {
  const [session, setSession] = useState<{ role: Role; name: string } | null>(null);
  const [screen, setScreen] = useState<Screen>('inicio');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loginValue, setLoginValue] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryState>(createInitialDelivery());
  const [sites, setSites] = useState<Site[]>(() => readStoredData('segurepp-sites', demoSites));
  const [workers, setWorkers] = useState<Worker[]>(() => readStoredData<Worker[]>('segurepp-workers', demoWorkers).map((worker) => ({ ...worker, active: worker.active ?? true })));
  const [equipment] = useState(equipmentSeed);
  const [showHelp, setShowHelp] = useState(false);

  const login = (role: Role) => {
    setLoginLoading(true);
    setTimeout(() => {
      const names: Record<Role, string> = {
        administrador: 'Ana Torres',
        almacenero: 'Jorge Ramírez',
        trabajador: 'Luis Mendoza',
      };
      setSession({ role, name: names[role] });
      setLoginLoading(false);
      setLoginError('');
    }, 350);
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginValue || !loginPassword) {
      setLoginError('Ingresa tu correo o DNI y tu contraseña.');
      return;
    }
    login(loginValue.includes('@') ? 'almacenero' : 'trabajador');
  };

  if (!session) {
    return (
      <LoginScreen
        loginValue={loginValue}
        setLoginValue={setLoginValue}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        error={loginError}
        loading={loginLoading}
        onSubmit={handleLogin}
        onDemo={login}
      />
    );
  }

  const roleLabel = session.role === 'administrador' ? 'Administrador' : session.role === 'almacenero' ? 'Almacenero' : 'Trabajador';
  const currentLabel = navItems.find((item) => item.id === screen)?.label ?? 'Inicio';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark"><ShieldCheck size={22} strokeWidth={2.5} /></div>
          <div><strong>SegurEPP</strong><span>Control de entregas</span></div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="site-selector"><span className="status-dot" /> Sede Callao <ChevronDown size={15} /></div>
        <nav className="main-nav" aria-label="Navegación principal">
          <span className="nav-caption">MENÚ PRINCIPAL</span>
          {navItems.filter((item) => item.roles.includes(session.role)).map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => { setScreen(item.id); setMobileMenu(false); }}><Icon size={19} />{item.label}</button>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sync-card"><span className="sync-icon"><Wifi size={15} /></span><div><strong>Sincronizado</strong><small>Todos los cambios guardados</small></div></div>
          <button className="nav-item" onClick={() => setShowHelp(true)}><HelpCircle size={19} /> Centro de ayuda</button>
          <button className="nav-item logout" onClick={() => setSession(null)}><LogOut size={19} /> Cerrar sesión</button>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={22} /></button>
          <div className="breadcrumb"><span>SegurEPP</span><span>/</span><strong>{currentLabel}</strong></div>
          <div className="topbar-actions">
            <span className="connection-label"><span className="status-dot" /> En línea</span>
            <button className="icon-button notification-button" aria-label="Notificaciones"><Bell size={20} /><i /></button>
            <div className="profile-chip"><div className="avatar">{session.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{session.name}</strong><span>{roleLabel}</span></div><ChevronDown size={15} /></div>
          </div>
        </header>
        <div className="page-content">
          {screen === 'inicio' && <HomeScreen session={session} onNewDelivery={() => { setDelivery(createInitialDelivery()); setScreen('entrega'); }} onGo={(next) => setScreen(next)} />}
          {screen === 'entrega' && <DeliveryFlow session={session} delivery={delivery} setDelivery={setDelivery} workers={workers} setWorkers={setWorkers} sites={sites} onSiteCreated={(site) => { void persistSite(site); setSites((current) => [...current, site]); localStorage.setItem('segurepp-sites', JSON.stringify([...sites, site])); }} onCancel={() => setScreen('inicio')} onDone={() => setScreen('inicio')} />}
          {screen === 'trabajadores' && <WorkersScreen workers={workers} sites={sites} isAdmin={session.role === 'administrador'} onWorkerCreated={(worker) => { void persistWorker(worker); setWorkers((current) => { const next = [...current, worker]; localStorage.setItem('segurepp-workers', JSON.stringify(next)); return next; }); }} onWorkersImported={(importedWorkers) => { void persistWorkers(importedWorkers); setWorkers((current) => { const next = [...current, ...importedWorkers]; localStorage.setItem('segurepp-workers', JSON.stringify(next)); return next; }); }} onWorkerUpdated={(worker) => { void updateWorkerRemote(worker); setWorkers((current) => { const next = current.map((item) => item.id === worker.id ? worker : item); localStorage.setItem('segurepp-workers', JSON.stringify(next)); return next; }); }} onWorkerDeleted={(id) => { const target = workers.find((item) => item.id === id); if (target) void deleteWorkerRemote(target.dni); setWorkers((current) => { const next = current.filter((item) => item.id !== id); localStorage.setItem('segurepp-workers', JSON.stringify(next)); return next; }); }} onSiteCreated={(site) => { void persistSite(site); setSites((current) => { const next = [...current, site]; localStorage.setItem('segurepp-sites', JSON.stringify(next)); return next; }); }} />}
          {screen === 'sedes' && <SitesScreen sites={sites} onSiteCreated={(site) => { void persistSite(site); setSites((current) => { const next = [...current, site]; localStorage.setItem('segurepp-sites', JSON.stringify(next)); return next; }); }} />}
          {screen === 'catalogo' && <CatalogScreen equipment={equipment} />}
          {screen === 'stock' && <StockScreen equipment={equipment} role={session.role} />}
          {screen === 'historial' && <HistoryScreen role={session.role} />}
          {screen === 'configuracion' && <SettingsScreen />}
        </div>
      </main>
      {showHelp && <Modal title="Centro de ayuda" onClose={() => setShowHelp(false)}><p className="modal-copy">Completa la entrega en cinco pasos. Las dos firmas se capturan al momento y el registro individual queda listo para descargar en PDF.</p><button className="primary-button full" onClick={() => setShowHelp(false)}>Entendido</button></Modal>}
    </div>
  );
}

type DeliveryState = { step: number; worker: Worker | null; items: Equipment[]; type: 'personal' | 'emergencia'; conform: boolean; training: boolean; workerSignature: string; delivererSignature: string; completed: boolean };
function createInitialDelivery(): DeliveryState { return { step: 1, worker: null, items: equipmentSeed.map((item) => ({ ...item })), type: 'personal', conform: false, training: false, workerSignature: '', delivererSignature: '', completed: false }; }

function LoginScreen(props: { loginValue: string; setLoginValue: (value: string) => void; loginPassword: string; setLoginPassword: (value: string) => void; error: string; loading: boolean; onSubmit: (event: React.FormEvent) => void; onDemo: (role: Role) => void }) {
  return <div className="login-page login-only"><div className="login-panel"><div className="login-panel-inner"><div className="mobile-logo"><div className="brand-mark"><ShieldCheck size={22} /></div><strong>SegurEPP</strong></div><div className="login-heading"><span className="eyebrow">PORTAL DE CONTROL</span><h2>Bienvenido de vuelta</h2><p>Ingresa para continuar con la gestión de EPPs.</p></div><form onSubmit={props.onSubmit} className="login-form"><label>Correo electrónico o DNI<input value={props.loginValue} onChange={(e) => props.setLoginValue(e.target.value)} placeholder="ej. 45872136" autoComplete="username" /></label><label>Contraseña<div className="password-field"><input type="password" value={props.loginPassword} onChange={(e) => props.setLoginPassword(e.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" /><span className="password-hint">DNI</span></div></label>{props.error && <div className="form-error"><AlertTriangle size={16} />{props.error}</div>}<button className="primary-button login-button" disabled={props.loading}>{props.loading ? 'Ingresando…' : 'Ingresar al portal'}<ArrowRight size={18} /></button></form><div className="login-divider"><span>Acceso de demostración</span></div><div className="demo-buttons"><button onClick={() => props.onDemo('administrador')}><span className="demo-avatar admin">AT</span><span><strong>Administrador</strong><small>Ve todo y gestiona costos</small></span><ArrowRight size={16} /></button><button onClick={() => props.onDemo('almacenero')}><span className="demo-avatar store">JR</span><span><strong>Almacenero</strong><small>Entrega y controla stock</small></span><ArrowRight size={16} /></button><button onClick={() => props.onDemo('trabajador')}><span className="demo-avatar worker">LM</span><span><strong>Trabajador</strong><small>Consulta sus entregas</small></span><ArrowRight size={16} /></button></div><p className="login-help">¿Necesitas ayuda? <button>Contacta al administrador</button></p></div></div></div>;
}

function HomeScreen({ session, onNewDelivery, onGo }: { session: { role: Role; name: string }; onNewDelivery: () => void; onGo: (screen: Screen) => void }) {
  const isWorker = session.role === 'trabajador';
  return <div className="screen-stack"><div className="welcome-row"><div><span className="eyebrow">{isWorker ? 'MI ESPACIO' : 'RESUMEN DE HOY'}</span><h1>{isWorker ? 'Hola, Luis' : `Buenos días, ${session.name.split(' ')[0]}`}</h1><p>{isWorker ? 'Aquí puedes consultar tus equipos recibidos y próximas reposiciones.' : 'Todo en orden. Esto es lo que está pasando en tus sedes.'}</p></div>{!isWorker && <button className="primary-button large-action" onClick={onNewDelivery}><Plus size={21} /> Nueva entrega</button>}</div>{isWorker ? <WorkerHome onGo={onGo} /> : <><div className="stat-grid"><StatCard label="Entregas este mes" value="128" change="+12.5%" icon={ClipboardCheck} tone="blue" /><StatCard label="Por renovar pronto" value="18" change="En los próximos 30 días" icon={AlertTriangle} tone="amber" /><StatCard label="Stock disponible" value="92%" change="Nivel saludable" icon={Package} tone="green" /><StatCard label="Gasto del mes" value="S/ 8,426" change="+8.2% vs. mes anterior" icon={Activity} tone="slate" /></div><div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-header"><div><span className="eyebrow">ACTIVIDAD RECIENTE</span><h2>Últimas entregas</h2></div><button className="text-button" onClick={() => onGo('historial')}>Ver historial <ArrowRight size={16} /></button></div><div className="delivery-list"><RecentRow name="Luis Alberto Mendoza Rojas" detail="Casco, chaleco y lentes" time="Hoy, 10:42 a. m." status="Completada" initials="LM" /><RecentRow name="María Fernanda Salazar Díaz" detail="Guantes anticorte" time="Hoy, 09:18 a. m." status="Completada" initials="MS" /><RecentRow name="Carlos Eduardo Paredes Vega" detail="Botas con punta de acero" time="Ayer, 04:36 p. m." status="Completada" initials="CP" /></div></section><section className="panel alerts-panel"><div className="panel-header"><div><span className="eyebrow">ATENCIÓN REQUERIDA</span><h2>Alertas</h2></div><button className="icon-button" aria-label="Configuración de alertas"><SlidersHorizontal size={18} /></button></div><div className="alert-list"><div className="alert-item warning"><div className="alert-icon"><AlertTriangle size={17} /></div><div><strong>18 equipos por renovar</strong><span>Durante los próximos 30 días</span></div><ArrowRight size={16} /></div><div className="alert-item danger"><div className="alert-icon"><Package size={17} /></div><div><strong>Stock bajo: guantes anticorte</strong><span>Solo quedan 7 unidades en Callao</span></div><ArrowRight size={16} /></div><div className="alert-item info"><div className="alert-icon"><Bell size={17} /></div><div><strong>3 trabajadores sin entrega</strong><span>Asignados a Operaciones</span></div><ArrowRight size={16} /></div></div></section></div></>}</div>;
}

function WorkerHome({ onGo }: { onGo: (screen: Screen) => void }) { return <><div className="worker-highlight panel"><div><span className="eyebrow">PRÓXIMA REPOSICIÓN</span><h2>Guantes anticorte</h2><p>Tu equipo se puede renovar en 12 días.</p><div className="progress"><span style={{ width: '84%' }} /></div><small>Entrega realizada el 04/03/2026</small></div><div className="renewal-date"><strong>16</strong><span>ABR</span></div></div><section className="panel recent-panel"><div className="panel-header"><div><span className="eyebrow">MI HISTORIAL</span><h2>Mis entregas</h2></div><button className="text-button" onClick={() => onGo('historial')}>Ver todo <ArrowRight size={16} /></button></div><div className="delivery-list"><RecentRow name="Entrega de EPP" detail="Casco, chaleco y lentes" time="04 mar 2026" status="PDF disponible" initials="04" /><RecentRow name="Entrega de EPP" detail="Botas con punta de acero" time="15 feb 2026" status="PDF disponible" initials="15" /></div></section></> }
function StatCard({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof Activity; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small className={tone === 'amber' ? 'amber-text' : 'green-text'}>{change}</small></div>; }
function RecentRow({ name, detail, time, status, initials }: { name: string; detail: string; time: string; status: string; initials: string }) { return <div className="recent-row"><div className="person-avatar">{initials}</div><div className="recent-info"><strong>{name}</strong><span>{detail}</span></div><div className="recent-meta"><span>{time}</span><b><Check size={13} /> {status}</b></div><button className="icon-button"><ArrowRight size={17} /></button></div>; }

function DeliveryFlow({ session, delivery, setDelivery, workers, setWorkers, sites, onSiteCreated, onCancel, onDone }: { session: { role: Role; name: string }; delivery: DeliveryState; setDelivery: (value: DeliveryState) => void; workers: Worker[]; setWorkers: (value: Worker[]) => void; sites: Site[]; onSiteCreated: (site: Site) => void; onCancel: () => void; onDone: () => void }) {
  const update = (patch: Partial<DeliveryState>) => setDelivery({ ...delivery, ...patch });
  const [search, setSearch] = useState('');
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [saved, setSaved] = useState(false);
  const filteredWorkers = workers.filter((worker) => worker.active).filter((worker) => `${worker.name} ${worker.dni}`.toLowerCase().includes(search.toLowerCase()));
  const selectedTotal = delivery.items.filter((item) => item.checked).reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const canContinue = delivery.step === 1 ? Boolean(delivery.worker) : delivery.step === 2 ? delivery.items.some((item) => item.checked) : delivery.step === 3 ? delivery.conform && delivery.training : delivery.step === 4 ? Boolean(delivery.workerSignature && delivery.delivererSignature) : true;
  const next = () => { if (delivery.step < 5) update({ step: delivery.step + 1 }); else { setSaved(true); update({ completed: true }); } };
  if (saved || delivery.completed) return <ConfirmationScreen delivery={delivery} includeCosts={session.role === 'administrador'} onNew={() => { setSaved(false); setDelivery(createInitialDelivery()); }} onDone={onDone} />;
  return <div className="screen-stack delivery-screen"><div className="delivery-top"><div><button className="back-link" onClick={onCancel}><ArrowLeft size={16} /> Volver al inicio</button><span className="eyebrow">NUEVA ENTREGA</span><h1>Registrar entrega de EPP</h1><p>Completa los datos para generar el registro individual.</p></div><div className="draft-badge"><span className="status-dot" /> Borrador guardado</div></div><div className="stepper">{['Trabajador', 'Equipos', 'Resumen', 'Firmas', 'Confirmación'].map((label, index) => <div key={label} className={`step ${delivery.step === index + 1 ? 'current' : ''} ${delivery.step > index + 1 ? 'done' : ''}`}><span>{delivery.step > index + 1 ? <Check size={15} /> : index + 1}</span><label>{label}</label></div>)}</div><section className="panel flow-panel">{delivery.step === 1 && <WorkerStep search={search} setSearch={setSearch} workers={filteredWorkers} selected={delivery.worker} onSelect={(worker) => update({ worker })} onNew={() => setShowNewWorker(true)} />}{delivery.step === 2 && <EquipmentStep items={delivery.items} setItems={(items) => update({ items })} isAdmin={session.role === 'administrador'} type={delivery.type} setType={(type) => update({ type })} />}{delivery.step === 3 && <SummaryStep delivery={delivery} isAdmin={session.role === 'administrador'} conform={delivery.conform} training={delivery.training} setConform={(conform) => update({ conform })} setTraining={(training) => update({ training })} />}{delivery.step === 4 && <SignatureStep worker={delivery.worker} setWorkerSignature={(workerSignature) => update({ workerSignature })} setDelivererSignature={(delivererSignature) => update({ delivererSignature })} delivererName={session.name} />}{delivery.step === 5 && <ReviewStep delivery={delivery} isAdmin={session.role === 'administrador'} total={selectedTotal} />}</section><div className="flow-footer"><button className="secondary-button" onClick={delivery.step === 1 ? onCancel : () => update({ step: delivery.step - 1 })}><ArrowLeft size={17} /> {delivery.step === 1 ? 'Cancelar' : 'Anterior'}</button><div><span className="step-counter">Paso {delivery.step} de 5</span><button className="primary-button" disabled={!canContinue} onClick={next}>{delivery.step === 5 ? 'Guardar y generar PDF' : 'Continuar'} <ArrowRight size={17} /></button></div></div>{showNewWorker && <NewWorkerModal sites={sites} onSiteCreated={onSiteCreated} onClose={() => setShowNewWorker(false)} onSave={(worker) => { void persistWorker(worker); setWorkers([...workers, worker]); update({ worker }); setShowNewWorker(false); }} />}</div>;
}

function WorkerStep({ search, setSearch, workers, selected, onSelect, onNew }: { search: string; setSearch: (value: string) => void; workers: Worker[]; selected: Worker | null; onSelect: (worker: Worker) => void; onNew: () => void }) { return <div className="flow-content"><div className="flow-heading"><div><span className="step-kicker">PASO 1 DE 5</span><h2>¿A quién entregaremos los equipos?</h2><p>Busca por DNI o nombre completo del trabajador.</p></div><div className="big-step-number">01</div></div><div className="search-box"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por DNI o nombre…" autoFocus /><kbd>⌘ K</kbd></div><div className="result-heading"><span>Trabajadores encontrados</span><button className="text-button" onClick={onNew}><Plus size={16} /> Alta rápida</button></div><div className="worker-results">{workers.map((worker) => <button key={worker.id} className={`worker-result ${selected?.id === worker.id ? 'selected' : ''}`} onClick={() => onSelect(worker)}><div className="person-avatar large">{worker.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{worker.name}</strong><span>DNI {worker.dni} <i /> {worker.area} <i /> {worker.position}</span></div><div className="worker-site">{worker.site}</div>{selected?.id === worker.id ? <CheckCircle2 className="selected-check" size={21} /> : <span className="radio-circle" />}</button>)}</div>{selected && <div className="selected-worker-card"><CheckCircle2 size={18} /><div><span>Trabajador seleccionado</span><strong>{selected.name} · DNI {selected.dni}</strong></div><button className="icon-button"><X size={16} /></button></div>}</div>; }

function EquipmentStep({ items, setItems, isAdmin, type, setType }: { items: Equipment[]; setItems: (items: Equipment[]) => void; isAdmin: boolean; type: 'personal' | 'emergencia'; setType: (type: 'personal' | 'emergencia') => void }) { const toggle = (id: string) => setItems(items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item)); const updateItem = (id: string, patch: Partial<Equipment>) => setItems(items.map((item) => item.id === id ? { ...item, ...patch } : item)); return <div className="flow-content"><div className="flow-heading"><div><span className="step-kicker">PASO 2 DE 5</span><h2>Selecciona los equipos a entregar</h2><p>La matriz sugiere equipos según el puesto. Puedes ajustar la entrega.</p></div><div className="big-step-number">02</div></div><div className="type-toggle"><span>Tipo de registro</span><button className={type === 'personal' ? 'active' : ''} onClick={() => setType('personal')}><ShieldCheck size={16} /> Protección personal</button><button className={type === 'emergencia' ? 'active' : ''} onClick={() => setType('emergencia')}><AlertTriangle size={16} /> Emergencia</button></div><div className="equipment-table"><div className="equipment-head"><span>EQUIPO / NORMA</span><span>STOCK</span><span>TALLA</span><span>CANT.</span>{isAdmin && <span>COSTO</span>}</div>{items.map((item) => <div className={`equipment-row ${item.checked ? 'checked' : ''}`} key={item.id}><button className={`check-box ${item.checked ? 'checked' : ''}`} onClick={() => toggle(item.id)} aria-label={`Seleccionar ${item.name}`}>{item.checked && <Check size={14} />}</button><div className="equipment-name"><strong>{item.name}</strong><span>{item.standard}</span></div><div className={`stock-pill ${item.stock < 10 ? 'low' : ''}`}><span /> {item.stock} und.</div><select value={item.size} onChange={(e) => updateItem(item.id, { size: e.target.value })}><option>{item.size}</option><option>Única</option><option>S</option><option>M</option><option>L</option><option>40</option><option>42</option></select><input className="quantity-input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} />{isAdmin && <strong className="cost-cell">{formatMoney(item.unitCost)}</strong>}<select className="reason-select" value={item.reason} onChange={(e) => updateItem(item.id, { reason: e.target.value as ItemReason })}><option>Primera entrega</option><option>Reposición</option><option>Deterioro</option><option>Pérdida</option></select></div>)}</div><button className="add-item-button"><Plus size={17} /> Agregar otro equipo</button>{items.some((item) => item.checked && item.stock < item.quantity) && <div className="inline-warning"><AlertTriangle size={17} /><span>Hay equipos con stock insuficiente. Verifica las cantidades antes de continuar.</span></div>}</div>; }

function SummaryStep({ delivery, isAdmin, conform, training, setConform, setTraining }: { delivery: DeliveryState; isAdmin: boolean; conform: boolean; training: boolean; setConform: (value: boolean) => void; setTraining: (value: boolean) => void }) { const activeItems = delivery.items.filter((item) => item.checked); return <div className="flow-content"><div className="flow-heading"><div><span className="step-kicker">PASO 3 DE 5</span><h2>Revisa y confirma la entrega</h2><p>Verifica los datos antes de pasar a las firmas.</p></div><div className="big-step-number">03</div></div><div className="summary-grid"><div className="summary-worker"><span className="eyebrow">TRABAJADOR</span><div className="summary-person"><div className="person-avatar large">{delivery.worker?.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{delivery.worker?.name}</strong><span>DNI {delivery.worker?.dni}</span><span>{delivery.worker?.area} · {delivery.worker?.position}</span></div></div><div className="summary-details"><div><span>Sede</span><strong>{delivery.worker?.site}</strong></div><div><span>Fecha y hora</span><strong>25 oct 2026 · 11:24 a. m.</strong></div><div><span>Tipo de registro</span><strong>{delivery.type === 'personal' ? 'Protección personal' : 'Equipo de emergencia'}</strong></div></div></div><div className="summary-items"><div className="summary-items-head"><span className="eyebrow">EQUIPOS SELECCIONADOS</span><strong>{activeItems.length} equipos</strong></div>{activeItems.map((item) => <div className="summary-item" key={item.id}><span className="summary-item-check"><Check size={13} /></span><div><strong>{item.name}</strong><span>{item.size} · {item.reason}</span></div><b>{item.quantity} und.</b>{isAdmin && <strong className="summary-cost">{formatMoney(item.unitCost * item.quantity)}</strong>}</div>)}{isAdmin && <div className="summary-total"><span>Total estimado</span><strong>{formatMoney(activeItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0))}</strong></div>}</div></div><div className="declarations"><label className={conform ? 'selected' : ''}><input type="checkbox" checked={conform} onChange={(e) => setConform(e.target.checked)} /><span className="custom-check">{conform && <Check size={13} />}</span><span><strong>Recepción conforme</strong><small>Declaro haber recibido los equipos descritos en buen estado.</small></span></label><label className={training ? 'selected' : ''}><input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} /><span className="custom-check">{training && <Check size={13} />}</span><span><strong>Capacitación en uso</strong><small>Se explicó el uso, cuidado y conservación de los equipos.</small></span></label></div></div>; }

function SignatureStep({ worker, setWorkerSignature, setDelivererSignature, delivererName }: { worker: Worker | null; setWorkerSignature: (value: string) => void; setDelivererSignature: (value: string) => void; delivererName: string }) { return <div className="flow-content"><div className="flow-heading"><div><span className="step-kicker">PASO 4 DE 5</span><h2>Captura las firmas</h2><p>Ambas firmas deben realizarse ahora, en el momento de la entrega.</p></div><div className="big-step-number">04</div></div><div className="signature-grid"><SignaturePad title="Firma del trabajador" subtitle={worker?.name ?? 'Trabajador'} onChange={setWorkerSignature} /><SignaturePad title="Firma del responsable" subtitle={delivererName} onChange={setDelivererSignature} /></div><div className="signature-note"><ShieldCheck size={18} /><span>Las firmas se guardarán junto con este registro y aparecerán en el PDF individual.</span></div></div>; }

function SignaturePad({ title, subtitle, onChange }: { title: string; subtitle: string; onChange: (value: string) => void }) { const canvasRef = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext('2d'); if (!context) return; context.lineWidth = 2.4; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#17324d'; }, []); const getPoint = (event: PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current; if (!canvas) return null; const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; }; const begin = (event: PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current; const context = canvas?.getContext('2d'); const point = getPoint(event); if (!canvas || !context || !point) return; event.currentTarget.setPointerCapture(event.pointerId); context.beginPath(); context.moveTo(point.x, point.y); drawing.current = true; }; const draw = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const canvas = canvasRef.current; const context = canvas?.getContext('2d'); const point = getPoint(event); if (!canvas || !context || !point) return; context.lineTo(point.x, point.y); context.stroke(); onChange(canvas.toDataURL('image/png')); }; const finish = (event: PointerEvent<HTMLCanvasElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drawing.current = false; }; const clear = () => { const canvas = canvasRef.current; const context = canvas?.getContext('2d'); if (!canvas || !context) return; context.clearRect(0, 0, canvas.width, canvas.height); drawing.current = false; onChange(''); }; return <div className="signature-card"><div className="signature-card-head"><div><strong>{title}</strong><span>{subtitle}</span></div><button className="clear-signature" onClick={clear}>Limpiar</button></div><div className="canvas-wrap"><canvas ref={canvasRef} width={640} height={240} onPointerDown={begin} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish} /><span className="signature-placeholder">Firma aquí</span></div><small><CheckCircle2 size={14} /> Capturada en este momento</small></div>; }

function ReviewStep({ delivery, isAdmin, total }: { delivery: DeliveryState; isAdmin: boolean; total: number }) { return <div className="flow-content"><div className="flow-heading"><div><span className="step-kicker">PASO 5 DE 5</span><h2>Todo listo para guardar</h2><p>Se generará un PDF individual con el registro de {delivery.worker?.name}.</p></div><div className="big-step-number">05</div></div><div className="review-card"><div className="review-icon"><FileText size={27} /></div><div><span className="eyebrow">REGISTRO INDIVIDUAL</span><h3>Registro de Equipos de Seguridad o Emergencia</h3><p>Incluye datos del empleador, equipos entregados, fechas de renovación, declaraciones y las dos firmas capturadas.</p></div><span className="ready-badge"><Check size={14} /> Listo</span></div><div className="review-points"><div><CheckCircle2 size={18} /><span>Trabajador identificado por DNI</span></div><div><CheckCircle2 size={18} /><span>{delivery.items.filter((item) => item.checked).length} equipos seleccionados</span></div><div><CheckCircle2 size={18} /><span>Dos firmas capturadas</span></div>{isAdmin && <div><CheckCircle2 size={18} /><span>Total congelado: {formatMoney(total)}</span></div>}</div></div>; }

function ConfirmationScreen({ delivery, includeCosts, onNew, onDone }: { delivery: DeliveryState; includeCosts: boolean; onNew: () => void; onDone: () => void }) { const [downloading, setDownloading] = useState(false); const code = `EPP-2026-${delivery.worker?.dni ?? '000000'}-001`; const download = () => { setDownloading(true); generatePdf(delivery, code, includeCosts); setTimeout(() => setDownloading(false), 650); }; return <div className="confirmation-screen"><div className="success-orb"><Check size={36} /></div><span className="eyebrow">ENTREGA REGISTRADA</span><h1>¡Entrega completada!</h1><p>El registro de <strong>{delivery.worker?.name}</strong> está listo y firmado.</p><div className="confirmation-code"><span>CÓDIGO ÚNICO</span><strong>{code}</strong><button className="icon-button"><FileText size={16} /></button></div><div className="confirmation-actions"><button className="primary-button" onClick={download} disabled={downloading}><Download size={18} /> {downloading ? 'Generando PDF…' : 'Descargar PDF'}</button><button className="secondary-button"><Truck size={17} /> Compartir</button></div><button className="text-button new-delivery-button" onClick={onNew}><Plus size={16} /> Registrar otra entrega</button><button className="back-link" onClick={onDone}>Volver al inicio</button></div>; }

function generatePdf(delivery: DeliveryState, code: string, includeCosts: boolean) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 8;
  const contentWidth = 194;
  const pageBottom = 289;
  const worker = delivery.worker;
  const checkedItems = delivery.items.filter((item) => item.checked);
  let y = 7;

  const split = (value: string, width: number, size: number) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(value || '—', width);
  };
  const centeredText = (value: string, x: number, top: number, width: number, height: number, size: number, bold = false) => {
    const lines = split(value, width - 4, size);
    const lineHeight = Math.max(2.3, size * 0.38);
    const startY = top + height / 2 - ((lines.length - 1) * lineHeight) / 2;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(lines, x + width / 2, startY, { align: 'center', lineHeightFactor: 1.05 });
  };
  const leftText = (value: string, x: number, top: number, width: number, height: number, size: number, bold = false) => {
    const lines = split(value, width - 4, size);
    const lineHeight = Math.max(2.3, size * 0.38);
    const startY = top + height / 2 - ((lines.length - 1) * lineHeight) / 2;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(lines, x + 2, startY, { lineHeightFactor: 1.05 });
  };
  const drawFullRow = (height: number, label: string, size = 6.2) => {
    doc.rect(margin, y, contentWidth, height);
    centeredText(label, margin, y, contentWidth, height, size, true);
    y += height;
  };
  const startContinuationPage = (label: string) => {
    doc.addPage();
    y = 10;
    doc.setDrawColor(43, 55, 66);
    doc.setTextColor(23, 50, 77);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, contentWidth, 13);
    centeredText('SEGUREPP', margin, y, 34, 13, 10, true);
    centeredText(label, margin + 34, y, contentWidth - 34, 13, 7.2, true);
    y += 18;
  };
  const drawEquipmentRow = (text: string, rowHeight: number) => {
    doc.rect(margin, y, contentWidth, rowHeight);
    leftText(text, margin, y, contentWidth, rowHeight, 5.6);
    y += rowHeight;
  };
  const ensureSpace = (height: number, label: string) => {
    if (y + height > pageBottom) startContinuationPage(label);
  };

  doc.setDrawColor(43, 55, 66);
  doc.setTextColor(23, 50, 77);
  doc.setLineWidth(0.35);
  const headerHeight = 17;
  const logoWidth = 30;
  const codeWidth = 36;
  const titleWidth = contentWidth - logoWidth - codeWidth;
  doc.rect(margin, y, contentWidth, headerHeight);
  doc.line(margin + logoWidth, y, margin + logoWidth, y + headerHeight);
  doc.line(margin + logoWidth + titleWidth, y, margin + logoWidth + titleWidth, y + headerHeight);
  centeredText('SEGUREPP', margin, y, logoWidth, headerHeight, 9.5, true);
  centeredText('REGISTRO DE EQUIPOS DE SEGURIDAD O EMERGENCIA', margin + logoWidth, y, titleWidth, headerHeight, 8.4, true);
  doc.line(margin + logoWidth + titleWidth, y + headerHeight / 2, margin + contentWidth, y + headerHeight / 2);
  leftText('CÓDIGO:', margin + logoWidth + titleWidth, y, codeWidth, headerHeight / 2, 6, true);
  leftText(code, margin + logoWidth + titleWidth, y + headerHeight / 2, codeWidth, headerHeight / 2, 5.8);
  y += headerHeight + 3;

  drawFullRow(5, 'DATOS DEL EMPLEADOR:', 6.2);
  const employerColumns = [28, 20, 57, 54, 35];
  const employerHeaders = [
    '1. RAZÓN SOCIAL O DENOMINACIÓN SOCIAL',
    '2. RUC',
    '3. DOMICILIO (Dirección, distrito, departamento, provincia)',
    '4. ACTIVIDAD ECONÓMICA',
    '5. N° TRABAJADORES EN EL CENTRO LABORAL',
  ];
  const employerValues = [
    'Industrias Andinas S.A.C.',
    '20604578129',
    'Av. Néstor Gambetta 1450, Callao',
    'Logística y distribución',
    '86',
  ];
  const employerHeaderHeight = 11;
  const employerValueHeight = 16;
  let x = margin;
  employerColumns.forEach((columnWidth, index) => {
    doc.rect(x, y, columnWidth, employerHeaderHeight);
    centeredText(employerHeaders[index], x, y, columnWidth, employerHeaderHeight, 4.8, true);
    x += columnWidth;
  });
  x = margin;
  employerColumns.forEach((columnWidth, index) => {
    doc.rect(x, y + employerHeaderHeight, columnWidth, employerValueHeight);
    centeredText(employerValues[index], x, y + employerHeaderHeight, columnWidth, employerValueHeight, 5.8);
    x += columnWidth;
  });
  y += employerHeaderHeight + employerValueHeight + 3;

  drawFullRow(5, 'MARCAR (X)', 6.2);
  drawFullRow(5, 'TIPO DE EQUIPO DE SEGURIDAD O EMERGENCIA ENTREGADO', 6.2);
  const typeWidth = contentWidth / 2;
  doc.rect(margin, y, typeWidth, 7);
  doc.rect(margin + typeWidth, y, typeWidth, 7);
  centeredText('EQUIPO DE PROTECCIÓN PERSONAL', margin, y, typeWidth, 7, 5.8, true);
  centeredText('EQUIPO DE EMERGENCIA', margin + typeWidth, y, typeWidth, 7, 5.8, true);
  y += 7;
  doc.rect(margin, y, typeWidth, 12);
  doc.rect(margin + typeWidth, y, typeWidth, 12);
  centeredText(delivery.type === 'personal' ? 'X' : '', margin, y, typeWidth, 12, 10, true);
  centeredText(delivery.type === 'emergencia' ? 'X' : '', margin + typeWidth, y, typeWidth, 12, 10, true);
  y += 15;

  drawFullRow(6, 'NOMBRE(S) DEL(LOS) EQUIPO(S) DE SEGURIDAD O EMERGENCIA ENTREGADO', 5.8);
  const equipmentRowHeight = 7;
  const visibleEquipmentRows = 6;
  for (let index = 0; index < visibleEquipmentRows; index += 1) {
    const item = checkedItems[index];
    const text = item ? `${item.name} | ${item.standard} | Talla: ${item.size} | Cantidad: ${item.quantity} | ${item.reason}` : '';
    drawEquipmentRow(text, equipmentRowHeight);
  }

  if (checkedItems.length > visibleEquipmentRows) {
    startContinuationPage('EQUIPOS ENTREGADOS (CONTINUACIÓN)');
    checkedItems.slice(visibleEquipmentRows).forEach((item) => {
      ensureSpace(equipmentRowHeight + 2, 'EQUIPOS ENTREGADOS (CONTINUACIÓN)');
      drawEquipmentRow(`${item.name} | ${item.standard} | Talla: ${item.size} | Cantidad: ${item.quantity} | ${item.reason}`, equipmentRowHeight);
    });
    y += 5;
  }

  ensureSpace(120, 'LISTA DE DATOS DEL TRABAJADOR (CONTINUACIÓN)');
  drawFullRow(6, 'LISTA DE DATOS DEL(LOS) TRABAJADOR(ES)', 5.8);
  const workerColumns = [7, 59, 18, 28, 25, 25, 32];
  const workerHeaders = ['N°', 'NOMBRES Y APELLIDOS', 'DNI', 'ÁREA', 'FECHA DE ENTREGA', 'FECHA DE RENOVACIÓN', 'FIRMA'];
  const workerHeaderHeight = 12;
  const workerRowHeight = 17;
  x = margin;
  workerColumns.forEach((columnWidth, index) => {
    doc.rect(x, y, columnWidth, workerHeaderHeight);
    centeredText(workerHeaders[index], x, y, columnWidth, workerHeaderHeight, 5.1, true);
    x += columnWidth;
  });
  const workerValues = [worker?.name ?? '', worker?.dni ?? '', worker?.area ?? '', '25/10/2026', worker?.renewal ?? '—'];
  for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
    x = margin;
    workerColumns.forEach((columnWidth, columnIndex) => {
      doc.rect(x, y + workerHeaderHeight + rowIndex * workerRowHeight, columnWidth, workerRowHeight);
      if (rowIndex === 0 && columnIndex === 0) centeredText('1', x, y + workerHeaderHeight, columnWidth, workerRowHeight, 6.2);
      if (rowIndex === 0 && columnIndex > 0 && columnIndex < 6) {
        const value = workerValues[columnIndex - 1];
        centeredText(value, x, y + workerHeaderHeight, columnWidth, workerRowHeight, columnIndex === 1 ? 5.6 : 5.8);
      }
      if (rowIndex === 0 && columnIndex === 6 && delivery.workerSignature) {
        doc.addImage(delivery.workerSignature, 'PNG', x + 2, y + workerHeaderHeight + 2, columnWidth - 4, workerRowHeight - 4);
      }
      x += columnWidth;
    });
  }
  y += workerHeaderHeight + workerRowHeight * 6 + 3;

  ensureSpace(34, 'RESPONSABLE DEL REGISTRO (CONTINUACIÓN)');
  drawFullRow(6, 'RESPONSABLE DEL REGISTRO', 5.8);
  const responsibleHeight = 24;
  const responsibleInfoWidth = 63;
  const responsibleSignatureWidth = 18;
  doc.rect(margin, y, contentWidth, responsibleHeight);
  doc.line(margin + responsibleInfoWidth, y, margin + responsibleInfoWidth, y + responsibleHeight);
  doc.line(margin + responsibleInfoWidth + responsibleSignatureWidth, y, margin + responsibleInfoWidth + responsibleSignatureWidth, y + responsibleHeight);
  doc.line(margin, y + 8, margin + responsibleInfoWidth, y + 8);
  doc.line(margin, y + 16, margin + responsibleInfoWidth, y + 16);
  leftText('Nombre:', margin, y, 20, 8, 5.8);
  leftText('Ana Torres', margin + 20, y, responsibleInfoWidth - 20, 8, 5.8);
  leftText('Cargo:', margin, y + 8, 20, 8, 5.8);
  leftText('Responsable de almacén', margin + 20, y + 8, responsibleInfoWidth - 20, 8, 5.8);
  leftText('Fecha:', margin, y + 16, 20, 8, 5.8);
  leftText('25/10/2026', margin + 20, y + 16, responsibleInfoWidth - 20, 8, 5.8);
  centeredText('Firma', margin + responsibleInfoWidth, y, responsibleSignatureWidth, responsibleHeight, 5.8);
  const signatureX = margin + responsibleInfoWidth + responsibleSignatureWidth;
  if (delivery.delivererSignature) doc.addImage(delivery.delivererSignature, 'PNG', signatureX + 3, y + 3, contentWidth - responsibleInfoWidth - responsibleSignatureWidth - 6, responsibleHeight - 6);
  y += responsibleHeight + 2;

  const legalText = 'Tratamiento de datos personales conforme a la Ley 29733. La información será utilizada exclusivamente para la gestión de seguridad y salud en el trabajo.';
  const legalWidth = includeCosts ? contentWidth - 55 : contentWidth;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.6);
  doc.text(split(legalText, legalWidth, 4.6), margin, y + 3, { lineHeightFactor: 1.05 });
  if (includeCosts) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.text(`Total interno: ${formatMoney(checkedItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0))}`, margin + contentWidth - 52, y + 3, { maxWidth: 52 });
  }
  doc.save(`${code}.pdf`);
}

function WorkersScreen({ workers, sites, isAdmin, onWorkerCreated, onWorkersImported, onWorkerUpdated, onWorkerDeleted, onSiteCreated }: { workers: Worker[]; sites: Site[]; isAdmin: boolean; onWorkerCreated: (worker: Worker) => void; onWorkersImported: (workers: Worker[]) => void; onWorkerUpdated: (worker: Worker) => void; onWorkerDeleted: (id: string) => void; onSiteCreated: (site: Site) => void }) { const [showNewWorker, setShowNewWorker] = useState(false); const [showBulkImport, setShowBulkImport] = useState(false); const [detailWorker, setDetailWorker] = useState<Worker | null>(null); const [editWorker, setEditWorker] = useState<Worker | null>(null); const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null); const saveWorker = (worker: Worker) => { if (workers.some((item) => item.dni === worker.dni)) return; onWorkerCreated(worker); setShowNewWorker(false); }; const toggleActive = (worker: Worker) => onWorkerUpdated({ ...worker, active: !worker.active }); return <><ListScreen eyebrow="MAESTROS" title="Trabajadores" titleIcon={Users} description="Administra las fichas y el historial de entrega del personal." action="Nuevo trabajador" onAction={() => setShowNewWorker(true)}><div className="worker-toolbar"><div className="toolbar"><div className="search-box compact"><Search size={18} /><input placeholder="Buscar por nombre o DNI…" /></div><button className="secondary-button"><SlidersHorizontal size={16} /> Filtrar</button></div><div className="bulk-actions"><button className="secondary-button" onClick={downloadWorkerTemplate}><FileSpreadsheet size={16} /> Descargar plantilla Excel</button><button className="secondary-button" onClick={() => setShowBulkImport(true)}><Upload size={16} /> Subir trabajadores</button></div></div><div className="worker-table-scroll"><div className="data-table worker-table-shell"><div className="table-head worker-table-head"><span className="sortable-heading">TRABAJADOR <ChevronsUpDown size={12} /></span><span className="sortable-heading">ÁREA / PUESTO <ChevronsUpDown size={12} /></span><span className="sortable-heading">SEDE <ChevronsUpDown size={12} /></span><span className="sortable-heading">ÚLTIMA ENTREGA <ChevronsUpDown size={12} /></span><span className="sortable-heading">ESTADO <ChevronsUpDown size={12} /></span>{isAdmin && <span>ACCIONES</span>}</div>{workers.map((worker) => <div className={`table-row worker-table-row ${worker.active ? '' : 'inactive-row'}`} key={worker.id}><div className="table-person"><div className="person-avatar">{worker.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{worker.name}</strong><span className="worker-dni">DNI {worker.dni}</span></div></div><span className="worker-area-cell">{worker.area}<i />{worker.position}</span><span className="worker-site-cell"><MapPin size={14} />{worker.site}</span><span className="worker-date-cell"><CalendarDays size={14} />04 mar 2026</span><b className={`table-status ${worker.active ? '' : 'inactive'}`}>{worker.active ? 'Activo' : 'Inactivo'}</b>{isAdmin && <div className="row-actions"><button className="icon-button" title="Ver ficha" aria-label={`Ver ficha de ${worker.name}`} onClick={() => setDetailWorker(worker)}><Eye size={15} /></button><button className="icon-button" title="Editar" aria-label={`Editar a ${worker.name}`} onClick={() => setEditWorker(worker)}><Pencil size={15} /></button><button className={`icon-button ${worker.active ? '' : 'state-on'}`} title={worker.active ? 'Desactivar' : 'Activar'} aria-label={`${worker.active ? 'Desactivar' : 'Activar'} a ${worker.name}`} onClick={() => toggleActive(worker)}><Power size={15} /></button><button className="icon-button danger" title="Eliminar" aria-label={`Eliminar a ${worker.name}`} onClick={() => setDeleteWorker(worker)}><Trash2 size={15} /></button></div>}</div>)}</div><div className="table-scroll-hint"><ArrowRight size={14} /> Desliza horizontalmente para ver todas las columnas</div></div></ListScreen>{showNewWorker && <NewWorkerModal sites={sites} onSiteCreated={onSiteCreated} onClose={() => setShowNewWorker(false)} onSave={saveWorker} />}{showBulkImport && <BulkWorkerModal existingWorkers={workers} sites={sites} onClose={() => setShowBulkImport(false)} onImport={(importedWorkers) => { onWorkersImported(importedWorkers); setShowBulkImport(false); }} />}{detailWorker && <WorkerDetailModal worker={detailWorker} onClose={() => setDetailWorker(null)} />}{editWorker && <EditWorkerModal sites={sites} worker={editWorker} onSiteCreated={onSiteCreated} onClose={() => setEditWorker(null)} onSave={(updated) => { onWorkerUpdated(updated); setEditWorker(null); }} />}{deleteWorker && <ConfirmDeleteWorkerModal worker={deleteWorker} onClose={() => setDeleteWorker(null)} onConfirm={() => { onWorkerDeleted(deleteWorker.id); setDeleteWorker(null); }} />}</>; }
function WorkerDetailModal({ worker, onClose }: { worker: Worker; onClose: () => void }) { return <Modal title="Ficha del trabajador" onClose={onClose}><p className="modal-copy">Datos registrados de {worker.name}.</p><div className="detail-grid"><div><span>Nombre completo</span><strong>{worker.name}</strong></div><div><span>DNI</span><strong>{worker.dni}</strong></div><div><span>Área</span><strong>{worker.area}</strong></div><div><span>Puesto</span><strong>{worker.position}</strong></div><div><span>Sede</span><strong>{worker.site}</strong></div><div><span>Tallas (casco / calzado)</span><strong>{worker.sizes}</strong></div><div><span>Próxima renovación</span><strong>{worker.renewal}</strong></div><div><span>Estado</span><strong>{worker.active ? 'Activo' : 'Inactivo'}</strong></div></div><button className="primary-button full" onClick={onClose}>Cerrar</button></Modal>; }
function EditWorkerModal({ sites, worker, onSiteCreated, onClose, onSave }: { sites: Site[]; worker: Worker; onSiteCreated: (site: Site) => void; onClose: () => void; onSave: (worker: Worker) => void }) { const [name, setName] = useState(worker.name); const [dni, setDni] = useState(worker.dni); const [area, setArea] = useState(worker.area); const [position, setPosition] = useState(worker.position); const [siteId, setSiteId] = useState(worker.siteId); const [availableSites, setAvailableSites] = useState(sites); const [showNewSite, setShowNewSite] = useState(false); const selectedSite = availableSites.find((site) => site.id === siteId); const saveSite = (site: Site) => { setAvailableSites((current) => [...current, site]); setSiteId(site.id); onSiteCreated(site); setShowNewSite(false); }; return <>{showNewSite ? <SiteFormModal sites={availableSites} onClose={() => setShowNewSite(false)} onSave={saveSite} /> : <Modal title="Editar trabajador" onClose={onClose}><p className="modal-copy">Actualiza los datos de {worker.name}.</p><div className="modal-form"><label>Nombres y apellidos<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>DNI<input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="8 dígitos" /></label><label>Área<input value={area} onChange={(e) => setArea(e.target.value)} /></label><label>Puesto<input value={position} onChange={(e) => setPosition(e.target.value)} /></label><label>Sede<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Selecciona una sede</option>{availableSites.filter((site) => site.active).map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label><button className="text-button modal-inline-action" onClick={() => setShowNewSite(true)}><Plus size={15} /> Crear nueva sede</button></div>{!name.trim() || !/^\d{8}$/.test(dni) || !siteId ? <div className="form-error"><AlertTriangle size={15} /> Completa el nombre, un DNI de 8 dígitos y la sede.</div> : null}<button className="primary-button full" disabled={!name.trim() || !/^\d{8}$/.test(dni) || !siteId} onClick={() => onSave({ ...worker, name: name.trim(), dni, area, position, site: selectedSite?.name ?? worker.site, siteId })}>Guardar cambios</button></Modal>}</>; }
function ConfirmDeleteWorkerModal({ worker, onClose, onConfirm }: { worker: Worker; onClose: () => void; onConfirm: () => void }) { return <Modal title="Eliminar trabajador" onClose={onClose}><p className="modal-copy">¿Seguro que deseas eliminar a <strong>{worker.name}</strong> (DNI {worker.dni})? Esta acción no se puede deshacer.</p><div className="confirm-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button danger-button" onClick={onConfirm}>Sí, eliminar</button></div></Modal>; }
function SitesScreen({ sites, onSiteCreated }: { sites: Site[]; onSiteCreated: (site: Site) => void }) { const [showNewSite, setShowNewSite] = useState(false); const [siteList, setSiteList] = useState(sites); const toggleSite = (id: string) => { const next = siteList.map((site) => site.id === id ? { ...site, active: !site.active } : site); setSiteList(next); localStorage.setItem('segurepp-sites', JSON.stringify(next)); }; return <><ListScreen eyebrow="MAESTROS" title="Incluir sedes" description="Administra las sedes donde se entregan y controlan los equipos." action="Nueva sede" onAction={() => setShowNewSite(true)}><div className="site-cards">{siteList.map((site) => <div className="site-card" key={site.id}><div className="site-card-top"><div className="catalog-icon"><Building2 size={19} /></div><button className={`site-state ${site.active ? 'active' : ''}`} onClick={() => toggleSite(site.id)}>{site.active ? 'Activa' : 'Inactiva'}</button></div><h3>{site.name}</h3><p>{site.address || 'Dirección pendiente de completar'}</p><div className="site-card-footer"><span><Users size={14} /> Trabajadores asignados</span><strong>{siteList.filter((item) => item.id === site.id).length ? 'Disponible' : '—'}</strong></div></div>)}</div></ListScreen>{showNewSite && <SiteFormModal sites={siteList} onClose={() => setShowNewSite(false)} onSave={(site) => { const next = [...siteList, site]; setSiteList(next); localStorage.setItem('segurepp-sites', JSON.stringify(next)); onSiteCreated(site); setShowNewSite(false); }} />}</>; }
function CatalogScreen({ equipment }: { equipment: Equipment[] }) { return <ListScreen eyebrow="CONFIGURACIÓN OPERATIVA" title="Catálogo y matriz" description="Consulta los equipos disponibles y sus reglas por puesto." action="Nuevo EPP"><div className="catalog-cards">{equipment.map((item) => <div className="catalog-card" key={item.id}><div className="catalog-card-top"><div className="catalog-icon"><ShieldCheck size={19} /></div><span className="active-label">Activo</span></div><h3>{item.name}</h3><p>{item.standard}</p><div className="catalog-meta"><span>Vida útil <strong>365 días</strong></span><span>Stock <strong>{item.stock} und.</strong></span></div></div>)}</div></ListScreen>; }
function StockScreen({ equipment, role }: { equipment: Equipment[]; role: Role }) { return <ListScreen eyebrow="INVENTARIO" title="Stock por sede" description="Controla los saldos y registra nuevos ingresos de mercadería." action="Registrar ingreso"><div className="stock-summary"><div><Package size={19} /><span>Total de unidades</span><strong>110</strong></div><div><AlertTriangle size={19} /><span>Requieren atención</span><strong>3 equipos</strong></div><div><Activity size={19} /><span>Movimientos del mes</span><strong>46</strong></div></div><div className="data-table"><div className="table-head"><span>EQUIPO</span><span>SEDE CALLAO</span><span>SEDE LIMA</span><span>ESTADO</span>{role === 'administrador' && <span>VALOR</span>}</div>{equipment.map((item) => <div className="table-row" key={item.id}><div className="table-person"><div className="catalog-icon small"><ShieldCheck size={16} /></div><div><strong>{item.name}</strong><span>{item.standard}</span></div></div><span>{item.stock} und.</span><span>{Math.max(0, item.stock - 8)} und.</span><b className={`stock-state ${item.stock < 10 ? 'low' : ''}`}>{item.stock < 10 ? 'Bajo stock' : 'Normal'}</b>{role === 'administrador' && <strong>{formatMoney(item.stock * item.unitCost)}</strong>}</div>)}</div></ListScreen>; }
function HistoryScreen({ role }: { role: Role }) { return <ListScreen eyebrow="TRAZABILIDAD" title="Historial de entregas" description="Consulta, filtra y reimprime tus registros individuales." action="Exportar"><div className="toolbar"><div className="search-box compact"><Search size={18} /><input placeholder="Buscar trabajador o código…" /></div><button className="secondary-button"><SlidersHorizontal size={16} /> Filtros <span className="filter-count">2</span></button></div><div className="data-table"><div className="table-head"><span>REGISTRO</span><span>TRABAJADOR</span><span>FECHA</span><span>EQUIPOS</span>{role === 'administrador' && <span>TOTAL</span>}<span>ESTADO</span></div>{[['EPP-2026-45872136-001','Luis Alberto Mendoza Rojas','25 oct 2026','3 equipos','S/ 86.80'],['EPP-2026-70451289-001','María Fernanda Salazar Díaz','25 oct 2026','1 equipo','S/ 24.75'],['EPP-2026-41782365-004','Carlos Eduardo Paredes Vega','24 oct 2026','2 equipos','S/ 166.50']].map((row) => <div className="table-row" key={row[0]}><div><strong className="code-text">{row[0]}</strong><small>Registro individual</small></div><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span>{role === 'administrador' && <strong>{row[4]}</strong>}<b className="table-status">Activa</b></div>)}</div></ListScreen>; }
function SettingsScreen() { return <ListScreen eyebrow="ADMINISTRACIÓN" title="Configuración" description="Personaliza la empresa, el documento y el acceso de usuarios." action="Guardar cambios"><div className="settings-grid"><div className="settings-card"><div className="settings-card-head"><div className="settings-icon"><Settings size={18} /></div><div><h3>Datos de la empresa</h3><p>Información que aparecerá en cada registro.</p></div></div><label>Razón social<input defaultValue="Industrias Andinas S.A.C." /></label><div className="two-inputs"><label>RUC<input defaultValue="20604578129" /></label><label>Código<input defaultValue="EPP-REG-001" /></label></div><label>Domicilio<input defaultValue="Av. Néstor Gambetta 1450, Callao" /></label></div><div className="settings-card"><div className="settings-card-head"><div className="settings-icon green"><FileText size={18} /></div><div><h3>Formato PDF</h3><p>Controla el contenido de los registros.</p></div></div><div className="setting-switch"><div><strong>Incluir costos en PDF</strong><span>Solo se aplicará a PDFs generados por administradores.</span></div><span className="switch on"><i /></span></div><div className="setting-switch"><div><strong>Aviso Ley 29733</strong><span>Mostrar tratamiento de datos personales.</span></div><span className="switch on"><i /></span></div></div></div></ListScreen>; }
function ListScreen({ eyebrow, title, titleIcon: TitleIcon, description, action, onAction, children }: { eyebrow: string; title: string; titleIcon?: typeof Users; description: string; action: string; onAction?: () => void; children: React.ReactNode }) { return <div className="screen-stack"><div className="welcome-row"><div className="screen-heading"><div className="screen-title-row">{TitleIcon && <span className="screen-title-icon"><TitleIcon size={24} /></span>}<div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div></div><p>{description}</p></div><button className="primary-button" onClick={onAction}><Plus size={18} /> {action}</button></div>{children}</div>; }
function NewWorkerModal({ sites, onSiteCreated, onClose, onSave }: { sites: Site[]; onSiteCreated: (site: Site) => void; onClose: () => void; onSave: (worker: Worker) => void }) { const [name, setName] = useState(''); const [dni, setDni] = useState(''); const [area, setArea] = useState(''); const [siteId, setSiteId] = useState(sites.find((site) => site.active)?.id ?? ''); const [availableSites, setAvailableSites] = useState(sites); const [showNewSite, setShowNewSite] = useState(false); const selectedSite = availableSites.find((site) => site.id === siteId); const saveSite = (site: Site) => { setAvailableSites((current) => [...current, site]); setSiteId(site.id); onSiteCreated(site); setShowNewSite(false); }; return <>{showNewSite ? <SiteFormModal sites={availableSites} onClose={() => setShowNewSite(false)} onSave={saveSite} /> : <Modal title="Nuevo trabajador" onClose={onClose}><p className="modal-copy">Registra los datos principales y asigna la sede donde trabaja.</p><div className="modal-form"><label>Nombres y apellidos<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" /></label><label>DNI<input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="8 dígitos" /></label><label>Área<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área de trabajo" /></label><label>Sede<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Selecciona una sede</option>{availableSites.filter((site) => site.active).map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label><button className="text-button modal-inline-action" onClick={() => setShowNewSite(true)}><Plus size={15} /> Crear nueva sede</button></div><button className="primary-button full" disabled={!name || !dni || !siteId} onClick={() => onSave({ id: `w${Date.now()}`, name, dni, area, position: 'Por completar', site: selectedSite?.name ?? '', siteId, sizes: 'Por registrar', renewal: '—', active: true })}>Guardar trabajador</button></Modal>}</>; }
function BulkWorkerModal({ existingWorkers, sites, onClose, onImport }: { existingWorkers: Worker[]; sites: Site[]; onClose: () => void; onImport: (workers: Worker[]) => void }) { const [fileName, setFileName] = useState(''); const [rows, setRows] = useState<WorkerImportRow[]>([]); const [error, setError] = useState(''); const fileInputRef = useRef<HTMLInputElement>(null); const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setError(''); setFileName(file.name); try { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const firstSheet = workbook.Sheets[workbook.SheetNames[0]]; const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' }); const usedDnis = new Set(existingWorkers.map((worker) => worker.dni)); const fileDnis = new Set<string>(); const parsedRows = rawRows.map((rawRow, index) => { const normalized = new Map(Object.entries(rawRow).map(([key, value]) => [normalizeImportHeader(key), String(value ?? '').trim().replace(/\.0$/, '')])); const get = (...keys: string[]) => keys.map((key) => normalized.get(normalizeImportHeader(key)) ?? '').find(Boolean) ?? ''; const name = get('Nombres y apellidos'); const dni = get('DNI'); const area = get('Área', 'Area'); const position = get('Puesto'); const siteName = get('Sede'); const casco = get('Talla de casco'); const chaleco = get('Talla de chaleco'); const calzado = get('Talla de calzado'); const status = get('Estado') || 'Activo'; const errors: string[] = []; const site = sites.find((candidate) => candidate.active && normalizeImportHeader(candidate.name) === normalizeImportHeader(siteName)); if (!name) errors.push('Falta el nombre'); if (!/^\d{8}$/.test(dni)) errors.push('El DNI debe tener 8 números'); if (!area) errors.push('Falta el área'); if (!position) errors.push('Falta el puesto'); if (!siteName || !site) errors.push('La sede no existe o está inactiva'); if (!['activo', 'inactivo'].includes(normalizeImportHeader(status))) errors.push('Estado inválido'); if (usedDnis.has(dni)) errors.push('El DNI ya está registrado'); if (fileDnis.has(dni)) errors.push('DNI repetido en el archivo'); if (dni) fileDnis.add(dni); const worker = errors.length === 0 && site ? { id: `w-${Date.now()}-${index}`, name, dni, area, position, site: site.name, siteId: site.id, sizes: `${casco || '—'} / ${calzado || '—'}`, renewal: '—', active: normalizeImportHeader(status) === 'activo' } : undefined; return { rowNumber: index + 2, values: [name, dni, area, position, siteName, casco, chaleco, calzado, status], errors, worker }; }); setRows(parsedRows); } catch { setRows([]); setError('No pudimos leer el archivo. Usa la plantilla Excel descargable.'); } }; const validRows = rows.filter((row) => row.worker).map((row) => row.worker as Worker); return <Modal title="Subir trabajadores desde Excel" onClose={onClose}><p className="modal-copy">Usa un archivo Excel con columnas independientes. Primero descarga la plantilla si aún no la tienes.</p><div className="bulk-modal-actions"><button className="secondary-button" onClick={downloadWorkerTemplate}><FileSpreadsheet size={16} /> Descargar plantilla</button><button className="primary-button" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Seleccionar Excel</button><input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls" onChange={handleFile} /></div>{fileName && <div className="selected-file"><FileSpreadsheet size={17} /><span>{fileName}</span><strong>{rows.length} filas</strong></div>}{error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}{rows.length > 0 && <div className="import-summary"><span className="import-valid">{validRows.length} listas para importar</span><span className="import-invalid">{rows.length - validRows.length} con errores</span></div>}{rows.length > 0 && <div className="import-preview"><div className="import-preview-head"><span>FILA</span><span>TRABAJADOR</span><span>DNI</span><span>SEDE</span><span>RESULTADO</span></div>{rows.map((row) => <div className={`import-preview-row ${row.errors.length ? 'invalid' : 'valid'}`} key={row.rowNumber}><span>{row.rowNumber}</span><span>{row.values[0] || '—'}</span><span>{row.values[1] || '—'}</span><span>{row.values[4] || '—'}</span><span>{row.errors.length ? row.errors.join(' · ') : 'Lista'}</span></div>)}</div>}<button className="primary-button full" disabled={!validRows.length} onClick={() => onImport(validRows)}>Importar {validRows.length} trabajadores</button></Modal>; }

function SiteFormModal({ sites, onClose, onSave }: { sites: Site[]; onClose: () => void; onSave: (site: Site) => void }) { const [name, setName] = useState(''); const [address, setAddress] = useState(''); const duplicate = sites.some((site) => site.name.trim().toLowerCase() === name.trim().toLowerCase()); return <Modal title="Nueva sede" onClose={onClose}><p className="modal-copy">Añade una sede para poder asignarla a los trabajadores y sus entregas.</p><div className="modal-form"><label>Nombre de la sede<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sede Arequipa" /></label><label>Dirección<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección de la sede" /></label>{duplicate && <div className="form-error"><AlertTriangle size={15} /> Ya existe una sede con ese nombre.</div>}</div><button className="primary-button full" disabled={!name.trim() || duplicate} onClick={() => onSave({ id: `site-${Date.now()}`, name: name.trim(), address: address.trim(), active: true })}>Guardar sede</button></Modal>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }

export default App;
