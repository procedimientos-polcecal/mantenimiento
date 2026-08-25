# Integración al ERP (merge del modelo de mantenimiento)

El Supabase destino es un **ERP multi-módulo** (RRHH, remises, compras,
mantenimiento) y **ya tiene un módulo de mantenimiento** con las mismas tablas
que esta app, en español. Este proyecto y ese módulo son **dos versiones
divergentes de la misma app**. Integrar = reconciliar + **portar el delta**.

> Implicación clave: la integración conviene hacerla **en el proyecto/sesión del
> ERP** (donde viven las tablas canónicas, el modelo de usuarios y compras),
> portando lo que construimos acá. Este repo es el "origen de features", no el
> destino.

---

## 1. Mapeo tabla por tabla

| Esta app | ERP destino | Acción |
|---|---|---|
| `plants` | **`empresas`** (+ `empresa_status_log`) | Reusar. Renombre conceptual planta→empresa. |
| `sectors` (+log) | **`sectores`** (+`sectores_status_log`) | Reusar (estructura igual). |
| `equipment` | **`equipos`** | Reusar (columnas idénticas). |
| `equipment_checklists` | **`equipos_checklists`** | Reusar. |
| `equipment_status_log` | **`equipos_status_log`** | Reusar. |
| `maintenance_schedules` | **`mantenimientos_programados`** | Reusar. |
| `maintenance_executions` | **`mantenimientos_ejecuciones`** | Reusar. |
| `work_orders` | **`ordenes_trabajo`** | Reusar; **falta** `requiere_parada_sector` y comparar columnas (ver §3). |
| `daily_plans` / `daily_plan_items` | **`planificacion_diaria`** / `_items` | Reusar (comparar columnas). |
| `app_users` + enum `user_role` + `is_admin()` | **`usuarios`** + **`usuario_modulos`** (`modulo` × `nivel_acceso`) | **Reemplazar** nuestro modelo por el del ERP. Es el cambio más grande (ver §2). |
| `contratistas` | ≈ **`proveedores`** | Mapear a proveedores, o agregar aparte. |
| `ordenes_servicio` (OS) | ≈ **`compras_requerimientos`** | **Decisión**: el ERP ya tiene módulo Compras que solapa las OS (ver §4). |
| `os_comparativas` | ≈ **`compras_cotizaciones`** | idem — el ERP ya tiene comparativa de compras. |
| `avisos` | — (no existe) | **Agregar** (adaptado a `equipos`/`usuarios`). |
| `operarios` | — | **Agregar**. |
| `production_plan` | — (`planificacion_diaria` es otra cosa) | **Agregar**. |
| `equipment_types` | — | **Agregar**. |
| `equipment_components` | — | **Agregar**. |
| `equipment_parts` | — | **Agregar**. |
| `work_order_parts` | — | **Agregar**. |

### Enums (nombres iguales)
- `equipment_status`, `criticality_level`, `plant_status`, `schedule_status`
  → **idénticos**, reusar los del ERP.
- `maintenance_type` → **mismo nombre, otros valores** (ERP:
  Lubricacion/Inspeccion/…). Casi no lo usamos; usar el del ERP.
- Nuestro `user_role` **no se usa** (se adopta `nivel_acceso` del ERP).

---

## 2. Usuarios y permisos (lo más delicado)

- ERP: `usuarios` + `usuario_modulos` con `modulo ∈ {rrhh, mantenimiento,
  remises, compras}` y `nivel_acceso ∈ {lectura, edicion, admin}`.
- Esta app: un único `role` en `app_users` (admin_sistema / administrador /
  gerente / operario / jefe_produccion) + helper `is_admin()`.

**Hay que traducir los chequeos de permisos de TODA la app** a
`usuario_modulos WHERE modulo='mantenimiento'`. Mapeo sugerido:

| Rol de esta app | nivel_acceso (módulo mantenimiento) |
|---|---|
| admin_sistema / administrador | `admin` |
| jefe_produccion | `edicion` (solo planificación) |
| gerente | `lectura` |
| operario | `lectura` (o `edicion` acotada) |

En el código: reemplazar cada `role IN ('admin_sistema','administrador')` /
`is_admin()` por una consulta de `nivel_acceso` sobre `usuario_modulos`.

---

## 3. `work_orders` → `ordenes_trabajo`: diferencias a chequear

El `ordenes_trabajo` del ERP ya tiene: ot_number, fecha, sector_raw, equipo_raw,
equipo_code, equipment_id, especialidad, tipo, quien, descripcion, repuesto,
fecha_ejecucion, fecha_cierre, estado, contratista, horas, operario_1/2/3,
prioridad, synced_at, app_created, sheets_row, sector_id, created_by,
created_at_app.

**Le falta (agregar como columnas):**
- `requiere_parada_sector boolean` (feature nueva)
- comparar: `frecuencia`, `proxima_fecha`, `reference_photos` (si las usa esta
  versión y el ERP no las tiene).

---

## 4. OS / Comparativas vs módulo Compras del ERP

El ERP ya tiene **Compras**: `compras_requerimientos` (≈ nuestras OS) +
`compras_cotizaciones` (≈ `os_comparativas`) + `compras_areas` /
`compras_aprobadores` / flujo de aprobación con enums
`compras_estado_aprobacion` / `compras_estado_compra`.

**Decisión de producto**: ¿las "Órdenes de Servicio + Comparativa" de esta app
se **funden con el módulo Compras** del ERP (reusar `compras_*`), o se mantienen
como feature de mantenimiento aparte? Solapan mucho — probablemente convenga
**usar Compras del ERP** y no duplicar.

---

## 5. Delta a portar (features construidas en esta app)

Además del esquema, portar estas **features/código** al ERP:
- Dashboard: KPIs (fuera de servicio / críticos no operativos), "OTs del mes" +
  gráfico de OTs por mes, ventanas de reparación, gráfico de OT realizadas por
  semana (por fecha de cierre), indicadores con drill-down.
- OT: filtro por especialidad; alerta "requiere parar el sector" (listado +
  producción + dashboard); registrar realizado → fecha a col K, foto a Drive
  (col V, vía Apps Script), observaciones a col W; iniciar OT pregunta estado
  del equipo (ya no fuerza "en mantenimiento").
- Producción (production_plan): estados por día + turnos + motivo + responsable,
  filtro por turno, cruce con OT/OS pendientes.
- OS: seguimiento (fecha_pedido / cierre + demora), estado "EN PROCESO" con
  proveedor de la comparativa, filtros; comparativa de proveedores por OS.
- Equipos: unificación de estados (En reparación → En mantenimiento).
- Integraciones: lectura de Sheets con `UNFORMATTED_VALUE` (arregla fechas en
  null); fotos a Drive vía Apps Script; sync de comparativas.
- Rol nuevo "Jefe de Producción" (a mapear a `nivel_acceso`).

---

## 6. Recomendación

1. **La integración se hace en el proyecto del ERP** (tablas canónicas + usuarios
   + compras están ahí). Este repo = referencia de features.
2. Reusar directo lo idéntico (equipos, sectores, empresas, ordenes_trabajo,
   mantenimientos_*, checklists, logs).
3. Adoptar el modelo de usuarios/permisos del ERP y reescribir los chequeos.
4. Definir OS vs Compras (§4) antes de portar esa parte.
5. Agregar el delta (§1 "Agregar" + §5) como columnas/tablas/código nuevos,
   siempre contra `equipos`/`usuarios`/`sectores` del ERP.
6. Migrar datos solo de lo que no sea espejo de Sheets (OT/OS/avisos se
   re-sincronizan); los maestros (equipos/sectores/empresas) ya existen en el
   ERP → probablemente no haga falta migrarlos.

> **OS aparte** (decisión tomada): no se fusiona con Compras. El delta crea
> `ordenes_servicio` + `os_comparativas` propias del módulo mantenimiento.

---

## 7. Permisos — unificar con el esquema del ERP

El ERP ya maneja permisos por módulo: `usuario_modulos` (por usuario) con
`modulo ∈ {…, mantenimiento, compras}` y `nivel_acceso ∈ {lectura, edicion,
admin}`. Compras además usa `compras_aprobadores` para la capa de aprobación.

**Decisión: unificar** — mantenimiento usa el MISMO mecanismo que compras
(`usuario_modulos WHERE modulo='mantenimiento'`), sin inventar un modelo nuevo.

Mapeo de los roles de esta app → `nivel_acceso`:

| Rol de esta app | nivel_acceso (mantenimiento) | Puede |
|---|---|---|
| admin_sistema / administrador | **admin** | todo + config (tipos, contratistas, operarios) + gestión de usuarios del módulo |
| jefe_produccion | **edicion** | operar (incluida planificación de producción) |
| gerente | **lectura** | solo ver |
| operario | **lectura** (o edicion acotada) | ver (o registrar, si se decide) |

Gating por acción (equivalencias en el código de esta app):

| Acción | Hoy (esta app) | Con el ERP |
|---|---|---|
| Ver (dashboard, listados) | autenticado | `nivel >= lectura` en mantenimiento |
| Crear/editar OT, cambiar estado, registrar ejecución | admin_sistema / administrador | `nivel >= edicion` |
| Cargar producción | admin_sistema / **jefe_produccion** | `nivel >= edicion` |
| Cargar/editar comparativas y OS | admin_sistema / administrador | `nivel >= edicion` |
| Config (tipos, contratistas, operarios) y usuarios | admin_sistema | `nivel = admin` |

**Implementación**: crear un helper en la base (p. ej. `mant_nivel(uid)` que
lea `usuario_modulos`) y reemplazar en cada endpoint los chequeos
`role IN ('admin_sistema','administrador')` / `is_admin()` por el nivel
correspondiente. Si más adelante hace falta una capa de "aprobador" para las OS
(estado POR APROBAR), se puede sumar una tabla análoga a `compras_aprobadores`.

> Si preferís **más granularidad** que lectura/edicion/admin (p. ej. distinguir
> "solo producción"), se agrega un permiso fino puntual en ese endpoint; pero la
> base sigue siendo `usuario_modulos`, no un modelo paralelo.

---

## 8. Paso a paso (a ejecutar en el proyecto del ERP)

1. **No tocar** lo idéntico: `equipos`, `sectores`, `empresas`,
   `ordenes_trabajo`, `mantenimientos_programados/ejecuciones`,
   `equipos_checklists`, `*_status_log`. Ya existen y sirven.
2. **Correr el delta**: aplicar `supabase/integracion-delta.sql` en el Supabase
   del ERP (crea `avisos`, `operarios`, `contratistas`, `production_plan`,
   `ordenes_servicio`, `os_comparativas`, `equipment_types/components/parts`,
   `work_order_parts`, y las columnas `requiere_parada_sector` /
   `fecha_pedido` / ficha de equipos). Revisá primero que no colisione con algo
   del ERP (usa `IF NOT EXISTS`).
3. **RLS**: definir las policies de las tablas nuevas según el patrón del ERP
   (helper sobre `usuario_modulos`). El delta las dejó afuera a propósito.
4. **Permisos (§7)**: crear el helper de nivel y reescribir los chequeos de
   permisos en los endpoints de mantenimiento.
5. **Portar el código** (features de §5) al repo del ERP, adaptando:
   - Nombres de tabla en las queries: `equipment`→`equipos`,
     `work_orders`→`ordenes_trabajo`, `plants`→`empresas`,
     `sectors`→`sectores`, `app_users`→`usuarios`,
     `equipment_checklists`→`equipos_checklists`,
     `maintenance_executions`→`mantenimientos_ejecuciones`,
     `maintenance_schedules`→`mantenimientos_programados`.
   - Los chequeos de permisos (§7).
   *(Las tablas nuevas del delta conservan su nombre en inglés — menos cambios
   de código.)*
6. **Integraciones**: cargar las env de Google/Drive/Resend en el ERP (ver
   MIGRACION.md), compartir planillas + carpeta de Drive con la service account
   que use el ERP, re-desplegar el Apps Script de fotos si cambia.
7. **Datos**: re-sincronizar OT/OS/avisos/comparativas desde Sheets en el ERP;
   los maestros (equipos/sectores/empresas) ya están. Migrar a mano lo poco que
   sea propio (operarios, contratistas, production_plan) si querés conservarlo.
8. **Verificar**: checklist de MUDANZA.md §8 adaptado (login, syncs, estados a
   Sheets, registrar realizado → K/V/W, dashboard, permisos por nivel).
