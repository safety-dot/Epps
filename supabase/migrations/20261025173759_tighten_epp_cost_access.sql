/*
# Endurecer acceso a costos y políticas CRUD

1. Seguridad de columnas
- El catálogo general ya no expone costo_unitario ni proveedor a través de la tabla directa.
- El administrador consulta costos mediante una función que valida su rol usando la sesión.

2. Políticas
- Se reemplazan políticas FOR ALL por políticas separadas para lectura, creación, edición y eliminación en las tablas de negocio.
- Los permisos de escritura administrativa se verifican desde perfiles.

3. Notas
- No se eliminan datos existentes.
- Las entregas y sus costos congelados permanecen auditables.
*/

-- Costos: lectura pública del catálogo sin valores sensibles.
revoke select on public.epps from authenticated;
grant select (id, nombre, norma, vida_util_dias, tallas_disponibles, moneda, tipo, stock_minimo, activo, created_at) on public.epps to authenticated;
grant insert, update, delete on public.epps to authenticated;

create or replace function public.obtener_epps_con_costo_admin()
returns table (
  id uuid,
  nombre text,
  norma text,
  vida_util_dias integer,
  tallas_disponibles text[],
  costo_unitario numeric,
  moneda text,
  proveedor text,
  tipo text,
  stock_minimo integer,
  activo boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.perfiles where perfiles.id = auth.uid() and perfiles.rol = 'administrador' and perfiles.activo = true) then
    raise exception 'not authorized';
  end if;
  return query select e.id, e.nombre, e.norma, e.vida_util_dias, e.tallas_disponibles, e.costo_unitario, e.moneda, e.proveedor, e.tipo, e.stock_minimo, e.activo from public.epps e order by e.nombre;
end;
$$;
revoke execute on function public.obtener_epps_con_costo_admin() from public, anon;
grant execute on function public.obtener_epps_con_costo_admin() to authenticated;

-- Empresas
 drop policy if exists "authenticated_manage_empresas" on public.empresas;
 drop policy if exists "authenticated_read_empresas" on public.empresas;
 create policy "empresas_select" on public.empresas for select to authenticated using (true);
 create policy "empresas_insert_admin" on public.empresas for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "empresas_update_admin" on public.empresas for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "empresas_delete_admin" on public.empresas for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

-- Sedes
 drop policy if exists "admin_manage_sedes" on public.sedes;
 drop policy if exists "authenticated_read_sedes" on public.sedes;
 create policy "sedes_select" on public.sedes for select to authenticated using (true);
 create policy "sedes_insert_admin" on public.sedes for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "sedes_update_admin" on public.sedes for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "sedes_delete_admin" on public.sedes for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

-- Perfiles
 drop policy if exists "profile_admin_manage" on public.perfiles;
 drop policy if exists "profile_self_or_admin_read" on public.perfiles;
 create policy "perfiles_select" on public.perfiles for select to authenticated using (id = auth.uid() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "perfiles_insert_admin" on public.perfiles for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "perfiles_update_admin" on public.perfiles for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "perfiles_delete_admin" on public.perfiles for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

-- Trabajadores
 drop policy if exists "workers_role_read" on public.trabajadores;
 drop policy if exists "workers_manager_write" on public.trabajadores;
 drop policy if exists "workers_manager_update" on public.trabajadores;
 create policy "trabajadores_select" on public.trabajadores for select to authenticated using (usuario_id = auth.uid() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
 create policy "trabajadores_insert" on public.trabajadores for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
 create policy "trabajadores_update" on public.trabajadores for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero'))) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('administrador','almacenero')));
 create policy "trabajadores_delete_admin" on public.trabajadores for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));

-- EPP y matriz
 drop policy if exists "catalog_admin_write" on public.epps;
 drop policy if exists "catalog_read" on public.epps;
 create policy "epps_select" on public.epps for select to authenticated using (true);
 create policy "epps_insert_admin" on public.epps for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "epps_update_admin" on public.epps for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "epps_delete_admin" on public.epps for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 drop policy if exists "matrix_admin_write" on public.matriz_puesto_epp;
 drop policy if exists "matrix_read" on public.matriz_puesto_epp;
 create policy "matriz_select" on public.matriz_puesto_epp for select to authenticated using (true);
 create policy "matriz_insert_admin" on public.matriz_puesto_epp for insert to authenticated with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "matriz_update_admin" on public.matriz_puesto_epp for update to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador')) with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
 create policy "matriz_delete_admin" on public.matriz_puesto_epp for delete to authenticated using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'));
