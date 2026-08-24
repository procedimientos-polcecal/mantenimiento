# Mudanza / unificación a otro proyecto (otro Supabase)

Guía para llevar esta app (frontend + backend + datos) al **Supabase del otro
sistema** y unificar todo en un solo proyecto.

> Idea clave: **no todo se migra igual.** Varias tablas son espejo de Google
> Sheets → se **re-sincronizan** en el destino (no se migran). Solo se migran
> los datos maestros y los propios de la app. Y ojo con los **IDs de usuario**,
> que NO coinciden entre dos Supabase.

---

## 0. Antes de empezar — decisiones

- **Código**: si el otro sistema es **Next.js + Supabase**, se puede fusionar
  el código; si es otro stack, montá esta app como app aparte que usa el mismo
  Supabase. (Esta app es **Next.js 16 / React 19** — si el otro está en otra
  major, resolvé eso primero.)
- **Cuenta de Google**: decidí si seguís usando la **misma service account**
  (`sheets-reader@mantenimientopp…`) o la del otro proyecto. Si cambiás, hay
  que **re-compartir** todas las planillas y la carpeta de Drive con el nuevo
  email de service account.

---

## 1. Esquema (estructura de la base)

En el Supabase **destino** → SQL Editor, corré **`supabase/schema.sql`**
(son las 36 migraciones concatenadas, idempotentes).

- Si `ALTER TYPE user_role ADD VALUE 'jefe_produccion'` (migración 032) tira
  error de transacción, corré esa línea sola y volvé a ejecutar el resto.
- **Colisiones**: si el otro sistema ya tiene tablas con estos nombres
  (`equipment`, `sectors`, `plants`, `work_orders`, `app_users`, el enum
  `user_role`, la función `is_admin()`), NO corras a ciegas: hay que resolver
  el conflicto (renombrar, o unificar el modelo de usuarios). Revisá la lista
  de tablas en la sección 6.

---

## 2. Usuarios (lo más delicado)

`app_users.id` referencia `auth.users(id)`. **Los IDs de auth NO se pueden
copiar** entre proyectos (Supabase asigna uno nuevo al crear cada usuario).
Por eso:

1. **Recreá los usuarios** en el Supabase destino (por la Admin API o
   invitándolos). Guardá el mapeo **email → nuevo id**.
2. Creá sus filas en `app_users` con ese **nuevo id**, su `full_name` y su
   `role` (incluí `jefe_produccion` si corresponde).
3. Los datos que migres traen los IDs **viejos** en las columnas
   `created_by / executed_by / updated_by / changed_by / assigned_to`. Como
   esos IDs no existen en el destino, hay dos caminos:
   - **Simple (recomendado)**: dejarlos en `NULL` (casi todas esas columnas ya
     son nullable). Se pierde el "quién lo hizo" en el historial, nada más.
   - **Fiel**: remapear viejo→nuevo por email antes de importar (más trabajo).

> Si unificás con el sistema de usuarios del otro proyecto, los usuarios pasan
> a ser los de ese sistema; solo asegurate de que cada uno tenga su fila en
> `app_users` con el rol correcto.

---

## 3. Datos — qué se migra y qué se re-sincroniza

**A. Espejo de Google Sheets → NO migrar, re-sincronizar en el destino:**
`work_orders`, `avisos`, `ordenes_servicio`, `os_comparativas`.
→ Configurá las env de Sheets (sección 5) y tocá **Sync** en cada módulo.

**B. Datos maestros → migrar (o re-importar del Excel "BD Equipos"):**
`plants`, `sectors`, `equipment_types`, `equipment`, `equipment_components`,
`equipment_parts`, `equipment_checklists`.

**C. Propios de la app → migrar:**
`operarios`, `contratistas`, `production_plan`, `maintenance_executions`,
`work_order_parts`, `daily_plans`, `daily_plan_items`, `maintenance_schedules`.

**D. Historial → opcional:**
`equipment_status_log`, `sector_status_log`, `plant_status_log`.

### Cómo migrar B/C/D

Con `pg_dump` (script incluido):

```bash
OLD_DB_URL="postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres" \
  bash scripts/exportar-datos.sh
```

Genera `export-mantenimiento/datos.sql`. Restaurar en el destino:

```bash
psql "$NEW_DB_URL" -c "SET session_replication_role = replica;" -f export-mantenimiento/datos.sql
```

`session_replication_role = replica` desactiva triggers y chequeo de FKs
durante la carga (evita que el trigger de estado se dispare y que fallen los
`*_by`). Alternativa sin consola: exportar cada tabla a CSV desde el Table
Editor de Supabase e importarlas en orden (plants → sectors → equipment_types
→ equipment → resto).

> Si preferís lo más limpio: **no migres nada de historial**, re-sincronizá A,
> re-importá B con el Excel de equipos, y cargá C a mano (son pocas filas).

---

## 4. Storage (fotos de ejecución)

El bucket `execution-photos` (público) guarda las fotos de la app.
1. En el destino, creá un bucket **`execution-photos`** público.
2. Copiá los archivos (descargá del viejo y subí al nuevo, o con la Storage
   API / `supabase storage`). Si no te importa el historial de fotos, podés
   saltear esto: las fotos nuevas se generan solas.

*(Las fotos que van a la planilla ahora se guardan en **Drive** vía Apps
Script, no en Storage — ver sección 5.)*

---

## 5. Integraciones Google + variables de entorno

Cargá TODAS estas env en el destino (Vercel). Las que faltan hacen fallar
endpoints en silencio:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | conexión y auth (del **nuevo** Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | rutas API admin (del **nuevo** Supabase) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JWT de Google |
| `GOOGLE_SHEETS_ID` / `GOOGLE_SHEETS_TAB` | planilla de OT |
| `GOOGLE_SHEETS_OS_ID` | planilla de OS |
| `GOOGLE_SHEETS_AVISOS_ID` / `GOOGLE_SHEETS_AVISOS_TAB` | planilla de avisos |
| `GOOGLE_SHEETS_COMPARATIVAS_ID` | planilla de comparativas |
| `DRIVE_WEBAPP_URL` / `DRIVE_WEBAPP_SECRET` | fotos a Drive (Apps Script) |
| `CRON_SECRET` | cron de sync/alertas |
| `SHEETS_WEBHOOK_SECRET` | webhook onEdit de Sheets |
| `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_ALERTS_TO` | mails de alerta |
| `NEXT_PUBLIC_APP_URL` | links en los mails / redirects |

Además:
- **Compartir** cada planilla y la carpeta de Drive con el email de la service
  account que uses en el destino (si cambia la cuenta).
- **Apps Script de fotos**: si cambia la cuenta/carpeta, re-desplegá el Web App
  (ver `docs/apps-script-fotos-drive.gs`) y actualizá `DRIVE_WEBAPP_URL`.
- **Webhook de Sheets** (`onEdit`): en el Apps Script de la planilla de OT,
  apuntá la URL a `https://NUEVO-DOMINIO/api/work-orders/webhook`.
- **Supabase Auth**: en el nuevo proyecto, Authentication → URL Configuration →
  Site URL y Redirect URLs con el nuevo dominio (si no, rompe el login).

---

## 6. Código

Traé al otro repo (o dejá esta app como módulo):
- `app/(app)/*` (páginas), `app/api/*` (endpoints), `app/layout.tsx`,
  `app/globals.css`, `app/components/*`
- `lib/*` (sheets-sync, email, supabase, db), `src/middleware.ts`
- `supabase/migrations/*` (o `supabase/schema.sql`)
- `docs/apps-script-fotos-drive.gs`
- Configs: `next.config.ts`, `postcss.config.mjs`, Tailwind, y las deps del
  `package.json` (Next 16, React 19, @supabase/*, recharts, xlsx, resend, etc.)

**Tablas de la app** (para chequear colisiones con el otro sistema):
`app_users, avisos, contratistas, daily_plans, daily_plan_items, equipment,
equipment_checklists, equipment_components, equipment_parts,
equipment_status_log, equipment_types, maintenance_executions,
maintenance_schedules, operarios, ordenes_servicio, os_comparativas,
plant_status_log, plants, production_plan, sector_status_log, sectors,
work_order_parts, work_orders`.

---

## 7. Vercel / deploy

- Recreá el **cron** (ver `vercel.json`: `/api/cron/sync`).
- Verificá las **cabeceras de seguridad** (`next.config.ts`).
- **Dominio**: apuntá el DNS; actualizá Supabase Auth URLs, `NEXT_PUBLIC_APP_URL`
  y la URL del webhook (sección 5). Ver también `MIGRACION.md`.

---

## 8. Verificación final

- [ ] Login OK en el nuevo dominio
- [ ] Sync de OT / OS / avisos / comparativas trae datos
- [ ] Cambiar estado de una OT → se refleja en Sheets (columna correcta)
- [ ] Registrar OT realizada → fecha a col K, foto a Drive (col V), obs a col W
- [ ] Dashboard: KPIs, "OTs por mes", ventanas de reparación
- [ ] Roles: admin_sistema / administrador / jefe_produccion editan lo suyo
- [ ] Mails de alerta llegan con el link al dominio nuevo

---

## Gotchas propios de esta app

- El `@import` de Google Fonts va **antes** de `@import "tailwindcss"`
  (`app/layout.tsx` lo carga por `<link>`); no lo muevas dentro del CSS.
- Sheets se lee con `valueRenderOption=UNFORMATTED_VALUE` (si no, las fechas
  vuelven `null`).
- Las migraciones son idempotentes (`IF NOT EXISTS` / `CREATE OR REPLACE`):
  re-correrlas es seguro.
- RLS: escrituras vía cliente admin (service role) saltan RLS; los permisos
  reales se gatean por rol en cada endpoint. `is_admin()` = admin_sistema /
  administrador.
