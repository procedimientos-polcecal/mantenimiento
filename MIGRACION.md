# Checklist de migración de dominio

Pasos a seguir cuando se cambie el dominio de la aplicación. Ordenado por
importancia — el paso 1 es el que rompe el login si se olvida.

## 1. Supabase — URLs de autenticación (CRÍTICO)

Dashboard de Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://NUEVO-DOMINIO`
- **Redirect URLs**: agregar `https://NUEVO-DOMINIO/**`

Si no se actualiza, el login y los correos de recuperación de contraseña
rompen (redirigen al dominio viejo).

## 2. Vercel — Variables de entorno

Verificar que TODAS estén cargadas en el proyecto (Settings → Environment
Variables). Varias hacen que ciertos endpoints **fallen cerrado** si faltan:

| Variable                      | Qué pasa si falta                                   |
|-------------------------------|-----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`    | La app no conecta a la base                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth no funciona                                   |
| `SUPABASE_SERVICE_ROLE_KEY`   | Las rutas API (admin) fallan                         |
| `CRON_SECRET`                 | El cron de alertas devuelve 503 (no manda mails)     |
| `SHEETS_WEBHOOK_SECRET`       | El webhook de Sheets devuelve 503 (no sincroniza)    |
| `RESEND_API_KEY`              | No se envían correos (se saltea silenciosamente)     |
| `GOOGLE_SHEETS_ID`            | No hay lectura/escritura de Sheets                   |
| `GOOGLE_SHEETS_TAB`           | Default "OT"                                          |
| `GOOGLE_SHEETS_COMPARATIVAS_ID` | No sincroniza ni escribe las comparativas de proveedores |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JWT de Google no se firma                            |
| `EMAIL_FROM` / `EMAIL_ALERTS_TO` | Remitente/destinatarios de alertas                |
| `NEXT_PUBLIC_APP_URL`         | Los links de los mails apuntan al dominio viejo      |

**Agregar nueva**: `NEXT_PUBLIC_APP_URL=https://NUEVO-DOMINIO`

## 3. Google Apps Script — URL del webhook

En el script de la planilla (trigger `onEdit`), actualizar la URL destino:

```
https://NUEVO-DOMINIO/api/work-orders/webhook
```

## 4. Vercel — Dominio

- Settings → Domains → agregar el dominio nuevo y apuntar el DNS.
- Dejar el dominio viejo redirigiendo un tiempo, o quitarlo si ya no se usa.

## 5. Verificación post-migración

- [ ] Login funciona en el dominio nuevo
- [ ] Recuperación de contraseña llega y redirige bien
- [ ] Sincronización desde Sheets (editar una celda → se refleja en la app)
- [ ] Cambio de estado de OT desde la app → se refleja en Sheets
- [ ] Los mails de alerta llegan con el link al dominio nuevo
- [ ] Las cabeceras de seguridad responden (probar en https://securityheaders.com)

## Rotación de secretos (recomendado al migrar)

Si el dominio cambia por un motivo de seguridad, conviene rotar:
- `SUPABASE_SERVICE_ROLE_KEY` (regenerar en Supabase → Settings → API)
- `CRON_SECRET` y `SHEETS_WEBHOOK_SECRET` (generar nuevos y actualizar en
  Vercel + Apps Script)
