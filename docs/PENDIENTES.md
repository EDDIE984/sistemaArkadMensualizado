# Pendientes y compromisos de Kuantiq

Registro de lo que está **comprometido o propuesto, pero aún no implementado**. Actualizar este archivo cuando un punto se complete (moverlo a "Completado" con la fecha) o cuando aparezca un pendiente nuevo.

_Última actualización: 2026-10-20_

---

## 1. Configuración de producción

- [ ] **Variable `DEEPSEEK_API_KEY` en Vercel** (Settings → Environment Variables) y volver a desplegar. Sin ella, el asistente de soporte en producción solo muestra el aviso de contacto. `DEEPSEEK_MODEL=deepseek-flash` es opcional porque ya es el valor por defecto.

## 2. Plan de contingencia: "Fortalecimiento"

Compromisos presentados a las aseguradoras en la presentación comercial (slides de contingencia), que aún no están implementados.

### Base de datos (Supabase)
- [ ] Activar **PITR** (recuperación a un punto en el tiempo, add-on de Supabase Pro, ~US$100/mes con 7 días). Lleva la pérdida máxima de datos (RPO) de 24 h a 2 min. Requiere al menos compute Small.
- [ ] **Respaldo externo diario cifrado** (`pg_dump`) en otra nube y cuenta, aislado del proveedor principal (regla 3-2-1).
- [ ] **Prueba de restauración mensual** documentada, midiendo el tiempo real de recuperación (RTO).
- [ ] **Réplica de lectura** para reportes y continuidad.
- [ ] **Alertas** de uso, conexiones y errores de la base.

### Servidor y aplicación (Vercel)
- [ ] **Monitoreo de disponibilidad externo** cada minuto, con alertas a la guardia técnica (llamada, WhatsApp, correo).
- [ ] **Página de estado** pública para aseguradoras y canales.
- [ ] **Registro centralizado de errores**.
- [ ] **Ambiente de pruebas (staging)** para validar cada cambio antes de producción.
- [ ] **Cola de reintentos** para correos, WhatsApp e IA.
- [ ] **Plan documentado ante caída del proveedor** (DNS y región alterna).

### Objetivos de recuperación comprometidos (validar que el equipo puede cumplirlos)

| Escenario | RTO objetivo |
|---|---|
| Versión nueva con errores | < 5 min |
| Caída de la aplicación | ≤ 15 min |
| Caída o corrupción de la base de datos | ≤ 2 h |
| Borrado accidental o ataque (ransomware) | ≤ 4 h |
| Falla de servicios externos | Sin corte |
| Caída total del proveedor de nube | ≤ 24 h |

## 3. Soporte 24/7

- [ ] **Ticketera**: definir la herramienta (Jira Service Management, Freshdesk, etc.) y registrar cada incidente con severidad, responsable y cierre con causa raíz.
- [ ] **Guardia técnica 24/7** organizada (turnos y responsables) para la línea +593 98 403 5410.
- [ ] Validar que se cumplen los **tiempos de respuesta comprometidos**:

| Severidad | Ejemplo | Primera respuesta | Atención |
|---|---|---|---|
| P1 · Crítica | Plataforma caída o sin acceso | ≤ 15 min | 24/7 |
| P2 · Alta | Una función crítica no opera | ≤ 1 h | 24/7 |
| P3 · Normal | Consulta o falla menor | ≤ 8 h hábiles | Horario laboral |

- [ ] **Protocolo de incidentes**: comunicación a la aseguradora con actualizaciones cada 30 min en P1, informe post-mortem en ≤ 5 días hábiles y simulacro de contingencia semestral.
- [ ] (Técnico, opcional) Mover el límite de consultas del asistente IA (20 cada 10 min por sesión) de memoria a la base de datos, para que sea estricto entre instancias de Vercel.

## 4. Hoja de ruta de seguridad

- [ ] **Prueba de penetración anual** por un tercero independiente, con plan de corrección.
- [ ] **Doble factor (2FA)** obligatorio para administradores de aseguradora.
- [ ] **Escaneo continuo** de dependencias y vulnerabilidades en cada versión.
- [ ] **Plan formal de respuesta a incidentes**, con roles, comunicación y notificación según la LOPDP de Ecuador.

## 5. Módulos en curso

- [ ] **Módulo de Cobranzas con IA**: plan completo pausado en `.claude/plans/modulo-cobranzas-ia.md`; existe un mockup de demostración.
- [ ] **Inspección con IA**: falta la prueba completa de punta a punta (captura → análisis → revisión de la aseguradora).

---

## Completado

- **2026-10-19:** RLS activado y permisos públicos (`anon`, `authenticated`) retirados en todas las tablas de `public` (migración `20261019000000_rls_todas_las_tablas.sql`, aplicada en producción). Regla documentada en el ER §6.
- **2026-10-19:** Asistente de soporte con IA (DeepSeek) en los paneles de aseguradora y canal, sin acceso a la base de datos.
- **2026-10-20:** Marca unificada como **Kuantiq** en toda la aplicación y logos antiguos eliminados.
