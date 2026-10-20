# Session 03: Corrección de Continuidad y Estado de Persistencia del Chat BYOK

**Fecha:** 2026-10-20  
**Fase:** CORRECCIÓN DE CONTINUIDAD, IDENTIFICADORES Y ESTADO DE PERSISTENCIA  
**Rama:** `rescue/isaac-2026-10-18`  
**Repositorio:** `la-casa-de-dante`  

---

## 1. Contexto y Objetivo

Resolver tres deficiencias en el flujo de chat interactivo con credenciales BYOK (`handleChatWithStoredCredentialFromBody` y `handleChatWithCredential`):
1. **Pérdida del identificador de conversación:** La UI (`ChatShell`) enviaba `conversationId` y `sessionId`, pero el despachador de credenciales en `credential-handlers.ts` no lo extraía ni lo propagaba hacia `core.chatWithStoredCredential` ni a las cabeceras `X-Conversation-ID`.
2. **Pérdida del estado de persistencia:** Dante AI Core informa el estado de guardado relacional (`persistence: 'saved' | 'unavailable' | 'disabled'`), pero dicho campo era descartado por el esquema de respuesta Zod (`DanteChatResponseSchema`), por el cliente bridge y por el cuerpo de respuesta JSON devuelto al cliente web.
3. **Colisiones de identificadores:** Se utilizaban identificadores fijos (`conv-01-arquitectura`) o dependientes de porciones del reloj del sistema (`conv-${Date.now().toString().slice(-6)}`, `byok-${Date.now()}`), propensos a colisiones entre diferentes usuarios o hilos concurrentes.

---

## 2. Acciones y Correcciones Implementadas

### A. Propagación Robusta del `conversationId`
- **UI (`src/components/chat/chat-shell.tsx`):**
  - Mantiene el envío explícito de `conversationId` y `sessionId` en el payload de `POST /api/chat`.
- **Servicio y Handlers (`src/lib/services/credential-handlers.ts`):**
  - Se implementó la función auxiliar `extractConversationId(body)` para validar y normalizar `conversationId` o `sessionId` no vacíos (`string.trim()`).
  - Se extendió la interfaz `CoreCredentialPort.chatWithStoredCredential` y la función interna `executeChatWithCredential` para aceptar `conversationId?: string`.
  - Se garantiza que `ownerId` provenga exclusivamente del resolvedor de sesión autenticada en el servidor (`requireOwner`). Cualquier `ownerId` o `userId` enviado en el cuerpo de la solicitud es completamente ignorado.
- **Puente y Cabeceras (`src/lib/dante-bridge/index.ts` y `mock-provider.ts`):**
  - En `chatWithStoredCredential`, se resuelve un identificador estable: si `input.conversationId` está presente se utiliza sanitizado; si no, se genera un UUID criptográfico único (`randomUUID()`).
  - Dicho identificador se envía a Core mediante la cabecera `X-Conversation-ID` y se mapea en `correlationId`.

### B. Propagación y Visibilidad del Estado de Persistencia
- **Contratos Zod (`src/contracts/dante.ts`):**
  - Se agregó `persistence: z.enum(["saved", "unavailable", "disabled"]).optional()` a `DanteChatResponseSchema`.
- **Tipos del Cliente Core (`src/lib/dante-bridge/client.ts` y `types.ts`):**
  - Se agregó `persistence?: 'saved' | 'unavailable' | 'disabled'` a la interfaz `DanteChatResponse`.
- **Mapeo en Bridge (`src/lib/dante-bridge/index.ts`):**
  - Se extrae `data.persistence` validando que pertenezca estrictamente a `'saved' | 'unavailable' | 'disabled'`. Si el Core no informa el estado o viene un valor no reconocido, se asigna `undefined` (sin inventar "saved").
- **Respuesta de Handlers (`src/lib/services/credential-handlers.ts`):**
  - Se agregó `persistence` a la interfaz `ChatResponseLike`.
  - Ambos endpoints (`handleChatWithStoredCredentialFromBody` y `handleChatWithCredential`) propagan `persistence` en el objeto JSON de respuesta.
- **Interfaz de Usuario (`src/components/chat/chat-shell.tsx`):**
  - Se constató que `ChatShell` ya contaba con la guarda `if (data.persistence === 'unavailable')` para renderizar un mensaje de sistema alertando que la respuesta se generó pero no se pudo guardar en la base de datos. Al propagarse ahora dicho campo desde el backend, el aviso visual queda plenamente operativo.

### C. Eliminación de Colisiones de Identificadores
- **Identificadores Criptográficos Estables:**
  - En `src/components/chat/chat-shell.tsx`, la función `generateThreadId` utiliza `crypto.randomUUID()` o genera un UUID v4 según RFC 4122 mediante `crypto.getRandomValues()`. Si ninguna API criptográfica está disponible, lanza un error explícito. Quedó completamente eliminado cualquier uso de `Date.now()` o `Math.random()` para identificadores de hilo.
  - La sesión activa inicial de `ChatShell` se genera mediante `createDefaultSessions()` con un UUID criptográfico v4, eliminando el ID estático `"conv-01-arquitectura"`.
  - En `src/lib/dante-bridge/index.ts`, se eliminaron los fallbacks basados en reloj `byok-${Date.now()}` sustituyéndolos por `randomUUID()`.
  - En `src/lib/dante-bridge/mock-provider.ts`, se eliminaron los sufijos `Date.now().toString(36)` en favor de `randomUUID()`.

---

## 3. Pruebas Automatizadas y Validación

Se estructuró la suite `tests/conversation-continuity.test.ts` con 11 casos de prueba organizados en dos niveles:
1. **Nivel Handlers (`handleChatWithStoredCredentialFromBody` y `handleChatWithCredential`):**
   - Caso 1: Dos turnos del mismo hilo transmiten el mismo `conversationId` al Core.
   - Caso 2: Soporte de `sessionId` como fallback si `conversationId` no viene explícito.
   - Caso 3: `ownerId` continúa siendo el autenticado y NUNCA el del cuerpo (inyección prevenida).
   - Caso 4: Estados `'saved'`, `'unavailable'` y `'disabled'` se propagan íntegros en la respuesta.
   - Caso 5: Estado ausente o inválido de `persistence` NO se convierte en `'saved'`.
   - Caso 6: Rechazo con código 400 (`INVALID_REQUEST`) de credenciales ausentes o compuestas exclusivamente de espacios en blanco.
   - Caso 7: Compatibilidad hacia atrás: callers legacy sin `conversationId` no se rompen.
   - Caso 8: Endpoint alternativo `POST /api/chat/credentials` propaga `conversationId` y `persistence`.
2. **Nivel Transporte Bridge HTTP (`DanteBridgeImpl` con mock de transporte):**
   - Caso 9: `DanteBridgeImpl` propaga la cabecera HTTP `X-Conversation-ID`, la cabecera de identidad firmada HMAC (`x-dante-owner-assertion`) y el Bearer token hacia Core.
   - Caso 10: `DanteBridgeImpl` genera identificadores únicos distintos cuando no se envía `conversationId` (prevención real de colisiones con dos solicitudes consecutivas).
   - Caso 11: `DanteBridgeImpl` descarta estados no reconocidos de `persistence` mapeándolos a `undefined`.

### Aislamiento de Entorno en Pruebas
- **Restauración de `global.fetch`:** Garantizada mediante bloques `finally` verificando si existía implementación previa o eliminando la propiedad (`delete global.fetch`).
- **Limpieza de variables de entorno:** Se utiliza `delete process.env[VAR]` cuando la variable no existía previamente, evitando la asignación del string `"undefined"`.
- **Corrección de secreto de firma:** Se retiró `DANTE_SIGNING_SECRET` al verificarse que el firmador productivo (`owner-assertion.ts`) opera exclusivamente sobre `DANTE_CORE_TOKEN`.

### Actualización de Scripts Verificadores (`verify:*`)
- `verify:bridge`: **PASÓ (Código 0)**. Adaptado para enviar `verifiedOwnerId` e interceptar peticiones salientes con fixtures aisladas en memoria sin contactar servicios externos.
- `verify:chat-route`: **PASÓ (Código 0)**. Comprueba el rechazo obligatorio de solicitudes sin autenticación (HTTP 401 UNAUTHORIZED) y el recorrido autorizado mediante fixtures de Supabase Auth en memoria, sin eludir `requireAuthorizedOwner` ni introducir bypasses en código productivo.
- `verify:chat-ui`: **PASÓ (Código 0)**. Adaptado para auditar estáticamente el uso de `authorizedFetch` hacia `/api/chat` (prohibiendo `fetch` plano), la propagación de `conversationId`/`sessionId`, la generación criptográfica de identificadores y el aviso de persistencia no disponible.

### Resolución Definitiva de Formato y Finales de Línea (`git diff --check`)
- **Diagnóstico Exacto:**
  - `git check-attr text eol whitespace -- src/lib/dante-bridge/index.ts` reportó `unspecified` para todos los atributos (no existían directivas en `.gitattributes`).
  - `git ls-files --eol` reportó `i/-text w/-text attr/` para `index.ts`.
  - La causa de la alerta `trailing whitespace` fue que las adiciones introducían `\r\n` literales en un archivo evaluado sin normalización automática por Git, disparando la regla predeterminada `blank-at-eol` sobre los retornos de carro `\r`.
- **Corrección Acotada:** Se normalizó exclusivamente `src/lib/dante-bridge/index.ts` a finales de línea LF (`\n`), preservando íntegros todos los cambios funcionales.
- **Resultado:** `git diff --check` finaliza limpiamente con **código de salida 0**.
- **Configuración Git:** `core.whitespace` se mantiene desconfigurado (unset / estado original intacto).

### Resultados de Ejecución
- **Tests de Continuidad (`conversation-continuity.test.ts`):** 11/11 pasaron (100%, código 0).
- **Verificador Bridge (`verify:bridge`):** Código de salida 0.
- **Verificador Rutas (`verify:chat-route`):** Código de salida 0.
- **Verificador UI (`verify:chat-ui`):** Código de salida 0 (auditoría estática).
- **Suite Completa de Casa (`npm test`):** 24 suites, **106 pruebas pasadas, 0 fallidas** (código 0).
- **Comprobación de Tipos (`npm run typecheck`):** `tsc --noEmit` completado con código 0 y cero errores.
- **Auditoría Git de Whitespace (`git diff --check`):** Código de salida 0 (cero advertencias o errores).
