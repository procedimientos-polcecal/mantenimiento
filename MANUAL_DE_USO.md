# Manual de uso — Sistema de Gestión de Mantenimiento
## POLCECAL / POLYSAN

**Acceso:** https://mantenimiento-kfi9.vercel.app

---

## Roles de usuario

| Rol | Puede hacer |
|-----|-------------|
| **Admin sistema** | Todo: usuarios, equipos, mantenimientos, ejecuciones |
| **Administrador** | Equipos, mantenimientos, ejecuciones |
| **Técnico** | Ver equipos, registrar ejecuciones |
| **Operador** | Ver equipos, registrar ejecuciones |

---

## 1. Ingresar al sistema

1. Abrí el navegador y entrá a `https://mantenimiento-kfi9.vercel.app`
2. Ingresá tu **email** y **contraseña**
3. Tocá **Ingresar**

> En Android podés instalar la app: menú del navegador → "Agregar a pantalla de inicio"

---

## 2. Dashboard

La pantalla de inicio muestra de un vistazo:

- **Contadores de estado** de todos los equipos (operativos, en reparación, etc.)
- **Mantenimientos vencidos** — en rojo, requieren atención inmediata
- **Próximos 7 días** — mantenimientos que vencen esta semana

---

## 3. Equipos

### Ver la lista
- Tocá **Equipos** en el menú
- Usá los filtros para buscar por **planta**, **sector**, **estado** o escribí el nombre/código

### Ver detalle de un equipo
- Tocá cualquier fila de la lista
- Ves: código, descripción, potencia, criticidad, observaciones e historial de cambios de estado

### Editar un equipo *(Administrador / Admin sistema)*
- Desde el detalle → botón **Editar**
- Modificá los campos necesarios → **Guardar**
- Si cambiás el **estado**, queda registrado en el historial automáticamente

### Checklist de un equipo *(Administrador / Admin sistema)*
- Desde el detalle → botón **Checklist**
- Agregá ítems con el botón **+ Agregar ítem**
- Tipos de ítem disponibles:
  - ✓ **Verificación** — el técnico marca si/no
  - **# Valor numérico** — para registrar temperaturas, presiones, rpm, etc.
  - **T Texto libre** — para observaciones específicas
  - **📷 Foto** — indica que se debe adjuntar foto
- Marcá **Obligatorio** en los ítems críticos
- Reordenás los ítems con las flechas ▲ ▼
- Tocá **Guardar** cuando termines

---

## 4. Mantenimientos

### Ver los mantenimientos programados
- Tocá **Mantenimientos** en el menú
- Los que tienen fondo **rojo** están vencidos
- Filtrá por estado: Activos / Pausados / Completados

### Crear un mantenimiento *(Administrador / Admin sistema)*
1. Tocá **+ Nuevo**
2. Seleccioná el **equipo**
3. Elegí el **tipo**: Preventivo, Predictivo, Correctivo, Lubricación o Inspección
4. Elegí la **frecuencia**:
   - Diario / Semanal / Quincenal / Mensual / Trimestral / Semestral / Anual
   - Personalizado: indicás cada cuántos días
   - Fecha fija: para tareas únicas
5. Ingresá la **próxima fecha**
6. Opcionalmente asignás un responsable y estimás las horas
7. Tocá **Guardar**

### Pausar / reactivar
- Desde la lista → botón **Pausar** o **Activar** en la fila

---

## 5. Ejecuciones

Acá se registra el trabajo realizado.

### Registrar una ejecución
1. Tocá **Ejecuciones** en el menú
2. En la pestaña **Pendientes** buscá el equipo que vas a mantener
3. Tocá el botón verde **Registrar**
4. Completá:
   - **Estado**: Completado / Parcial / Cancelado
   - **Duración** en horas
   - **Fecha y hora** de ejecución
   - **Checklist** — si el equipo tiene checklist, aparece aquí para completar
   - **Observaciones** — detallá lo realizado, piezas reemplazadas, anomalías
   - **Fotos** — podés adjuntar hasta 5 fotos (desde cámara o galería)
5. Tocá **Guardar**

> Al guardar como **Completado**, el sistema calcula automáticamente la próxima fecha según la frecuencia configurada.

### Sin conexión a internet
- Si no hay red, podés registrar igual — el botón dice **"Guardar offline"**
- Los registros quedan guardados en el dispositivo
- Cuando vuelve la conexión, aparece una barra amarilla arriba con un botón **"Sincronizar ahora"**
- La sincronización también ocurre automáticamente al reconectar

### Ver ejecuciones recientes
- Pestaña **Recientes** — últimas 50 ejecuciones registradas con estado, duración y observaciones

---

## 6. Historial

- Tocá **Historial** en el menú
- Mostrá todas las ejecuciones registradas
- Filtrá por **estado**, **tipo** o buscá por nombre/código de equipo
- Botón **Exportar CSV** — descarga el historial para Excel

---

## 7. Usuarios *(solo Admin sistema)*

1. Tocá **Usuarios** en el menú
2. **+ Nuevo** para crear un usuario:
   - Nombre completo
   - Email
   - Contraseña inicial
   - Rol
3. **Editar** para cambiar nombre o rol
4. **Desactivar** para bloquear el acceso sin eliminar el usuario

---

## 8. Alertas por email

El sistema envía emails automáticamente:
- **Al registrar una ejecución** — notificación inmediata a los administradores
- **Resumen diario a las 7am** — lista de mantenimientos vencidos

---

## Solución de problemas frecuentes

| Problema | Solución |
|----------|----------|
| No puedo ingresar | Verificá email y contraseña. Pedile al Admin sistema que revise tu usuario |
| No veo el botón Editar | Tu rol no tiene permisos. Solo Administrador y Admin sistema pueden editar |
| No aparece el checklist al registrar | El equipo no tiene checklist configurado. Pedile al Administrador que lo cree |
| La app no sincroniza offline | Tocá "Sincronizar ahora" en la barra amarilla o reiniciá la app con conexión |
| No recibo emails | Verificá que tu email esté bien cargado en Usuarios |
