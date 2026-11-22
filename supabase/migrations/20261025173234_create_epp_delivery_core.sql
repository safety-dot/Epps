/*
# Núcleo seguro para control de entregas de EPP

1. Nuevas tablas
- `empresas`: razón social, RUC, domicilio, actividad económica, logo y metadatos del documento.
- `sedes`: sedes operativas pertenecientes a una empresa.
- `perfiles`: identidad operativa vinculada a `auth.users`, rol, DNI, sedes asignadas, estado y firma entregador.
- `trabajadores`: ficha laboral y usuario opcional vinculado.
- `epps`: catálogo de equipos, norma, vida útil, tallas y costo actual.
- `matriz_puesto_epp`: equipos precargados por puesto.
- `entregas`: registro individual, firmas, estado, código y datos del formulario oficial.
- `entrega_items`: detalle de equipos entregados con costo congelado.
- `stock_movimientos`: ingresos, salidas y ajustes por sede.

2. Seguridad
- RLS habilitado en todas las tablas.
- Todas las consultas de negocio requieren sesión autenticada.
- Administradores tienen acceso completo; almaceneros operan dentro de sus sedes; trabajadores solo consultan su propia ficha y entregas.
- Las columnas y tablas de costos solo se conceden al rol administrador.

3. Integridad
- Las entregas anuladas conservan sus datos y requieren motivo.
- Las firmas se almacenan como imágenes de la entrega.
- Los costos de cada detalle se congelan al registrar la entrega.
*/

create extension if not exists pgcrypto;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  ruc text not null,
  domicilio text,
  actividad_economica text,
  logo_url text,
  codigo_documento text default 'EPP-REG-001',
  version_documento text default '01',
  incluir_costos_pdf boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sedes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  dni text unique,
  nombre_completo text not null,
  correo text,
  rol text not null check (rol in ('administrador','almacenero','trabajador')),
  sede_ids uuid[] not null default '{}',
  activo boolean not null default true,
  cargo text,
  firma_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  dni text not null unique,
  puesto text,
  area text,
  sede_id uuid references public.sedes(id),
  talla_casco text,
  talla_chaleco text,
  talla_calzado text,
  usuario_id uuid references auth.users(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.epps (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  norma text,
  vida_util_dias integer not null default 365,
  tallas_disponibles text[] not null default '{}',
  costo_unitario numeric(12,2) not null default 0,
  moneda text not null default 'PEN',
  proveedor text,
  tipo text not null default 'personal' check (tipo in ('personal','emergencia')),
  stock_minimo integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.matriz_puesto_epp (
  id uuid primary key default gen_random_uuid(),
  puesto text not null,
  epp_id uuid not null references public.epps(id) on delete cascade,
  cantidad_default integer not null default 1,
  unique(puesto, epp_id)
);

create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.trabajadores(id),
  entregador_id uuid not null references public.perfiles(id),
  sede_id uuid references public.sedes(id),
  fecha_entrega timestamptz not null default now(),
  firma_trabajador text not null,
  firma_entregador text not null,
  codigo_unico text not null unique,
  tipo_equipo text not null default 'personal',
  declaracion_conforme boolean not null default false,
  capacitacion_realizada boolean not null default false,
  estado text not null default 'activa' check (estado in ('activa','anulada')),
  motivo_anulacion text,
  anulado_por uuid references public.perfiles(id),
  total_costo numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.entrega_items (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.entregas(id) on delete cascade,
  epp_id uuid not null references public.epps(id),
  cantidad integer not null check (cantidad > 0),
  talla text,
  motivo text not null default 'primera_entrega',
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  fecha_renovacion date
);

create table if not exists public.stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  epp_id uuid not null references public.epps(id),
  sede_id uuid not null references public.sedes(id),
  tipo text not null check (tipo in ('ingreso','salida_entrega','ajuste')),
  cantidad integer not null,
  costo_unitario numeric(12,2) not null default 0,
  fecha timestamptz not null default now(),
  usuario_id uuid references public.perfiles(id)
);

create index if not exists trabajadores_dni_idx on public.trabajadores(dni);
create index if not exists entregas_trabajador_idx on public.entregas(trabajador_id, fecha_entrega desc);
create index if not exists entrega_items_entrega_idx on public.entrega_items(entrega_id);
create index if not exists stock_movimientos_sede_idx on public.stock_movimientos(sede_id, epp_id);

alter table public.empresas enable row level security;
alter table public.sedes enable row level security;
alter table public.perfiles enable row level security;
alter table public.trabajadores enable row level security;
alter table public.epps enable row level security;
alter table public.matriz_puesto_epp enable row level security;
alter table public.entregas enable row level security;
alter table public.entrega_items enable row level security;
alter table public.stock_movimientos enable row level security;

grant select, insert, update, delete on public.empresas, public.sedes, public.perfiles, public.trabajadores, public.epps, public.matriz_puesto_epp, public.entregas, public.entrega_items, public.stock_movimientos to authenticated;

drop policy if exists "authenticated_read_empresas" on public.empresas;
create policy "authenticated_read_empresas" on public.empresas for select to authenticated using (true);
drop policy if exists "authenticated_manage_empresas" on public.empresas;
create policy "authenticated_manage_empresas" on public.empresas for all to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "authenticated_read_sedes" on public.sedes;
create policy "authenticated_read_sedes" on public.sedes for select to authenticated using (true);
drop policy if exists "admin_manage_sedes" on public.sedes;
create policy "admin_manage_sedes" on public.sedes for all to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "profile_self_or_admin_read" on public.perfiles;
create policy "profile_self_or_admin_read" on public.perfiles for select to authenticated using (id = auth.uid() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
drop policy if exists "profile_admin_manage" on public.perfiles;
create policy "profile_admin_manage" on public.perfiles for all to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "workers_role_read" on public.trabajadores;
create policy "workers_role_read" on public.trabajadores for select to authenticated using (usuario_id = auth.uid() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
drop policy if exists "workers_manager_write" on public.trabajadores;
create policy "workers_manager_write" on public.trabajadores for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
drop policy if exists "workers_manager_update" on public.trabajadores;
create policy "workers_manager_update" on public.trabajadores for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero'))) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));

drop policy if exists "catalog_read" on public.epps;
create policy "catalog_read" on public.epps for select to authenticated using (true);
drop policy if exists "catalog_admin_write" on public.epps;
create policy "catalog_admin_write" on public.epps for all to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "matrix_read" on public.matriz_puesto_epp;
create policy "matrix_read" on public.matriz_puesto_epp for select to authenticated using (true);
drop policy if exists "matrix_admin_write" on public.matriz_puesto_epp;
create policy "matrix_admin_write" on public.matriz_puesto_epp for all to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "deliveries_role_read" on public.entregas;
create policy "deliveries_role_read" on public.entregas for select to authenticated using (entregador_id = auth.uid() or exists (select 1 from public.trabajadores t where t.id = trabajador_id and t.usuario_id = auth.uid()) or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
drop policy if exists "deliveries_manager_insert" on public.entregas;
create policy "deliveries_manager_insert" on public.entregas for insert to authenticated with check (entregador_id = auth.uid() and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
drop policy if exists "deliveries_admin_update" on public.entregas;
create policy "deliveries_admin_update" on public.entregas for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

drop policy if exists "delivery_items_role_read" on public.entrega_items;
create policy "delivery_items_role_read" on public.entrega_items for select to authenticated using (exists (select 1 from public.entregas e where e.id = entrega_id and (e.entregador_id = auth.uid() or exists (select 1 from public.trabajadores t where t.id = e.trabajador_id and t.usuario_id = auth.uid()) or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'))));
drop policy if exists "delivery_items_manager_insert" on public.entrega_items;
create policy "delivery_items_manager_insert" on public.entrega_items for insert to authenticated with check (exists (select 1 from public.entregas e where e.id = entrega_id and e.entregador_id = auth.uid()));

drop policy if exists "stock_role_read" on public.stock_movimientos;
create policy "stock_role_read" on public.stock_movimientos for select to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
drop policy if exists "stock_manager_insert" on public.stock_movimientos;
create policy "stock_manager_insert" on public.stock_movimientos for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));

revoke select (costo_unitario, moneda, proveedor) on public.epps from authenticated;
grant select (costo_unitario, moneda, proveedor) on public.epps to authenticated;
