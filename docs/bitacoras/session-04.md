# Bitácora de Sesión 04 — Checkpoint Local y Cierre Endurecido de Historial Real (Casa → Core)

- **Fecha:** 2026-10-20
- **Rama:** `rescue/isaac-2026-10-18`
- **Workspace:** `la-casa-de-dante`
- **Autorización:** Edición acotada en `la-casa-de-dante`, pruebas aisladas de comportamiento real sin servicios externos ni secretos, y commit local de checkpoint al cierre de Fase B (sin push/merge/deploy).

---

## 1. Fase A — Checkpoint Local del Bloque Previo (Intacto)

El bloque previo (continuidad BYOK, propagación de `conversationId`, estado de `persistence`, generación criptográfica de identificadores, verificadores y normalización LF de `src/lib/dante-bridge/index.ts`) permanece preservado en el commit local:

- **SHA del Checkpoint:** `d2440810b40bba17c3c7f53bfa13e58b6d159f3c` (corto: `d244081`)
- **Mensaje:** `fix(chat): preserve conversation identity and persistence status`
- **Operaciones no realizadas:** Sin push, sin merge, sin deploy, sin alteración de ramas ni de `session-02.md` / `session-03.md`.

---

## 2. Fase B — Cierre Endurecido de Historial Real, Concurrencia y Contratos

### 2.1 Coordinación por Roles
- **Rol C (Revisión de Contratos, Aislamiento y Seguridad — Solo Lectura):** Subagente `research` ejecutado en modo estrictamente de solo lectura para auditar los contratos entre `la-casa-de-dante` y `Dante-AI-Core` (solo lectura). Confirmó que `ownerId` proviene siempre de `requireAuthorizedOwner` y que la aserción HMAC firmada se exige en todas las rutas hacia Core, identificando los puntos exactos a blindar en validación de fechas, codificación de URLs, no ocultamiento de errores en resolución secundaria y condiciones de carrera en UI.
- **Rol A (Implementación de Historial, Estado de UI y Contratos):** Extracción del motor real de estado y concurrencia `src/components/chat/chat-history-state.ts` usado directamente por `ChatShell`, endurecimiento de `DanteTimestampSchema` en `src/contracts/dante.ts`, blindaje de `getConversations` y `getConversationMessages` en `src/lib/dante-bridge/index.ts` y soporte de `await context.params` en `src/app/api/conversations/[id]/messages/route.ts`.
- **Rol B (QA de Comportamiento y Concurrencia):** Ampliación de `tests/conversation-history.test.ts` a 13 escenarios deterministas ejecutados sobre `createChatHistoryController` (la lógica real usada por `ChatShell`), las rutas API y el puente.

### 2.2 Defectos Críticos Corregidos (Secciones 5.A–5.E y Cierre Final de Fase B)

1. **Primer Envío desde Lista Vacía (`src/components/chat/chat-history-state.ts` & `chat-shell.tsx`):**
   - Cuando el usuario inicia sin conversaciones (`sessions = []`, `activeSessionId = null`) o pulsa nueva conversación y envía el primer mensaje, `submitMessage` resuelve o crea síncronamente un único hilo con `newId = generateThreadId()` y fija `targetThreadId = targetThread.id`.
   - Todas las actualizaciones de estado (`updateThreadById(targetThreadId, ...)`) reciben explícitamente `targetThreadId` sin depender jamás de un `currentSession.id` capturado en el closure de un render anterior (`"nueva-conversacion"`).
   - Se añade el mensaje del usuario a `targetThreadId`, se envía `sessionId: targetThreadId` y `conversationId: targetThreadId` a `POST /api/chat`, se añade la respuesta del asistente al mismo `targetThreadId` y el segundo turno reutiliza exactamente ese identificador.

2. **ID Único por Mensaje Independiente de `correlationId` (`src/components/chat/chat-history-state.ts`):**
   - Se eliminó la construcción del identificador del mensaje del asistente a partir de `correlationId` (`${validData.correlationId}-a`), dado que el puente puede devolver el mismo `correlationId` en varios turnos de una misma conversación.
   - Se incorporó `generateMessageId()` con generación criptográfica RFC 4122 v4 (`crypto.randomUUID` / `crypto.getRandomValues` sin nuevas dependencias ni `Date.now()` / `Math.random()`) para asignar un identificador único a cada mensaje (`userMessage.id` y `assistantMessage.id`), conservando por separado `conversationId` y `assistantMessage.correlationId = validData.correlationId`.

3. **Bloqueo de Envío Durante Carga o Error de Historial Remoto (`src/components/chat/chat-history-state.ts` & `chat-shell.tsx`):**
   - Para un hilo remoto existente cuyos mensajes están pendientes de carga (`messagesStatus === "idle"` o `!messagesLoaded`), cargándose (`messagesStatus === "loading"`) o en error (`messagesStatus === "error"`), se bloquea el envío **tanto en el controlador (`submitMessage`) como en la interfaz (`ChatShell`)**.
   - La validación en `submitMessage` se ejecuta **antes** de crear/añadir un mensaje del usuario al hilo y **antes** de invocar `/api/chat`.
   - La interfaz ofrece acción explícita de carga (`"Cargar mensajes de la conversación"`) o reintento (`"Reintentar carga de mensajes"`) antes de continuar.
   - Un hilo local nuevo y vacío (`createNewSession()` o primer envío desde lista vacía) mantiene `messagesLoaded: true` y `messagesStatus: "loaded-empty"`, pudiendo enviar normalmente.
   - Al resolver la carga de mensajes remotos (`fetchMessagesForThread`), se preservan posibles mensajes locales válidos no incluidos aún en la respuesta (`!loadedIds.has(m.id)`).

4. **Respuestas Obsoletas, Contadores de Época y Cambio de Identidad (`authEpoch` + `requestId` + `AbortController`):**
   - El controlador mantiene un contador de época de autenticación (`authEpoch`) y contadores monotónicos independientes por operación (`conversationsRequestId`, `messagesRequestId`, `sendRequestId`), además de `AbortController` dedicados para listado, carga de mensajes y envío de chat.
   - Al desmontar (`dispose()`), al ocurrir `SIGNED_OUT` o al cambiar de propietario autenticado (Usuario A → Usuario B), se incrementa `authEpoch`, se abortan las solicitudes en vuelo, se invalidan los IDs de solicitud y se limpian conversaciones, hilo activo, mensajes, errores y banderas de carga.
   - Antes de aplicar cualquier resultado asíncrono o de limpiar banderas en `finally`, se verifica explícitamente que `requestEpoch === authEpoch` y `requestId === activeRequestId` (y `activeSessionId === canonicalThreadId` en carga de mensajes).
   - En `onAuthStateChange`, la invalidación de estado es síncrona y la recarga del listado se difiere de forma segura al siguiente turno del event loop (`setTimeout(..., 0)`) verificando que el controlador no haya sido desmontado y que `authEpoch` siga vigente.

5. **Separación Estricta de Estados (`loading | loaded-empty | loaded | error | unauthorized`) y Reintentos:**
   - Un fallo en la carga de mensajes (`!res.ok`, error de red o error de validación Zod) **nunca** marca `messagesLoaded: true` (`messagesStatus = "error"`, `messagesLoaded = false`).
   - Los errores de transporte o almacenamiento se guardan en campos dedicados (`conversationsError`, `messagesError`, `sendError`, `persistenceWarning`) y **jamás** se inyectan como mensajes falsos `role: "system"` dentro del arreglo `session.messages` ni borran mensajes válidos previos.
   - Se incorporaron acciones explícitas de reintento (`retryLoadConversations` y `retryLoadMessages`) con botones visibles en `ChatShell`.
   - El bloque `finally` de una solicitud antigua o cancelada (p. ej. al cambiar rápido de Conversación 1 a Conversación 2) está protegido por `requestId === messagesRequestId`, por lo que nunca apaga el indicador `isLoadingMessages` de la solicitud nueva en curso.

6. **Contratos de Datos, Fechas y Resolución de Identificadores (`src/contracts/dante.ts`, `src/lib/dante-bridge/index.ts`):**
   - `DanteTimestampSchema`: Valida cadenas ISO-8601 y marcas `TIMESTAMPTZ` de PostgreSQL (`YYYY-MM-DD HH:mm:ss.ssssss+00`), verifica validez calendárica real (rechazando cadenas vacías, arbitrarias o fechas imposibles como `2026-02-30`), y normaliza determinísticamente a ISO-8601 UTC (`new Date(parsedMs).toISOString()`).
   - En `DanteConversationMessageSchema`, `created_at` y `timestamp` usan `DanteTimestampSchema.optional()`, distinguiendo entre campo opcional ausente (`undefined`) y dato inválido (rechazado por Zod). El cliente nunca inventa `new Date().toISOString()` para ocultar fechas inválidas del historial.
   - En `SessionThread`, se mantienen explícitos `internalId` (UUID interno `id` de Core), `externalId` (`external_id`) e `id` operativo (`externalId ?? internalId`).
   - En `danteBridge.getConversations` y `danteBridge.getConversationMessages`, se exige aserción firmada válida en modo `local-core` (`ownerAssertionHeaders(ownerId)` no vacío), se aplica `encodeURIComponent` en todos los segmentos dinámicos de URL hacia Core y se eliminó el `catch {}` que tragaba fallos remotos durante la resolución secundaria de `external_id`.

---

## 3. Verificación y Suite de Pruebas (Rol B)

### 3.1 Escenarios Verificados en `tests/conversation-history.test.ts` (13/13 PASS)
1. **Lista vacía → primer envío:** Crea un único hilo válido, envía ese ID en `sessionId` y `conversationId`, y conserva tanto el mensaje del usuario como la respuesta del asistente en ese hilo.
2. **Segundo turno en la misma conversación:** Reutiliza el mismo `conversationId`/`sessionId` y mantiene ambos turnos completos.
3. **Dos conversaciones distintas:** Cambiar entre dos conversaciones mantiene mensajes e identificadores separados sin mezclarlos.
4. **Solicitud de listado pendiente → `SIGNED_OUT` → resolución tardía:** La respuesta tardía no repuebla conversaciones tras el cierre de sesión.
5. **Solicitud de usuario A → cambio a usuario B:** Las respuestas tardías de listado o chat de A no contaminan el estado de B.
6. **Cambio rápido Conversación 1 → Conversación 2:** La respuesta tardía de la Conversación 1 no pisa los mensajes de la Conversación 2 ni apaga su estado `isLoadingMessages`.
7. **Error de carga → reintento:** El fallo de carga deja el estado en `error` con `messagesLoaded: false` sin mensajes falsos, y el reintento posterior recupera los datos reales.
8. **Error remoto sin fallback vacío:** Cuando Core falla (503), `GET /api/conversations` y `GET /api/conversations/[id]/messages` devuelven `503 STORAGE_ERROR` sin simular `[]` ni datos mock.
9. **`external_id` frente a UUID interno:** Usa el identificador correcto, codifica URLs con `encodeURIComponent` y propaga errores si la resolución secundaria falla en Core.
10. **Fechas inválidas:** Rechaza fechas corruptas o imposibles en Zod y en el controlador sin inventar `new Date().toISOString()`.
11. **Contratos previos intactos:** `sessionId` como fallback, `ownerId` exclusivo de `requireAuthorizedOwner`, aserción HMAC firmada, `persistence: saved | unavailable | disabled` y generador criptográfico RFC 4122 v4.
12. **Dos turnos con exactamente el mismo `correlationId`:** Mismo `conversationId`, 4 mensajes conservados, 4 identificadores de mensaje distintos (`generateMessageId()`) y `correlationId` preservado por separado.
13. **Respuesta diferida de historial y bloqueo de envío:** Intentar enviar mientras el historial remoto está pendiente, cargándose o en error se bloquea en el controlador sin añadir mensaje ni llamar a `/api/chat`; al resolver el historial se conservan los mensajes y el envío posterior incluye el contexto recuperado; un hilo local nuevo y vacío envía normalmente.

### 3.2 Resultados de Comandos de Verificación
- `npx tsx --test tests/conversation-history.test.ts` → **13/13 PASS** (Código 0)
- `npx tsx --test tests/conversation-continuity.test.ts` → **11/11 PASS** (Código 0)
- `npm run typecheck` → **PASS** (Código 0)
- `npm run verify:bridge` → **PASS** (Código 0)
- `npm run verify:chat-route` → **PASS** (Código 0)
- `npm run verify:chat-ui` → **PASS** (Código 0)
- `npm test` → **119/119 PASS** en 25 suites (Código 0)
- `npm run lint` → **PASS** (Código 0)
- `npm run build` → **PASS** (Compilación de producción Next.js verificada localmente sin efectos externos)
- `git diff --check` → **PASS** (Código 0, finales de línea LF preservados)
