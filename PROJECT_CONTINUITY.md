# La Casa de Dante — Continuidad del Proyecto y Estado de Rescate

**Última Actualización:** 2026-10-18 (Cierre de Sesión y Traslado al Laptop de Isaac)  
**Rama Activa de Rescate:** `rescue/isaac-2026-10-18`  
**Repositorio Privado de Configuración:** `https://isaacipp1709-cloud@github.com/isaacipp1709-cloud/Dante-Private-Config.git`

---

## 1. Arquitectura y Runtime en la Nube ($0 Cost Policy)

La Casa de Dante es la interfaz de usuario frontend y middleware de acceso de Dante AI:
- **Despliegue:** Vercel (Edge/Serverless).
- **Acceso:** Desde cualquier dispositivo (móvil, tablet, laptop) sin mantener un PC local encendido.
- **Autenticación:** Supabase Auth (GitHub OAuth).
- **Puente con el Núcleo (`Dante Bridge`):**
  - Variable `DANTE_MODE`: Si es diferente de `'mock'`, despacha peticiones HTTP a `DANTE_CORE_URL`.
  - En producción, `DANTE_CORE_URL` será la URL remota del servicio `Dante-AI-Core` desplegado en Vercel.
- **Persistencia y Bóveda Relacional:** Neon PostgreSQL (`ep-quiet-forest-b571toev` / `neondb`).

> **ACLARACIÓN DE URLs Y PUERTOS:**  
> La dirección local `http://127.0.0.1:4179` corresponde **únicamente a la herramienta local de la bóveda** para gestión efímera de secretos en memoria RAM. **NO es la URL de Dante Core**. En producción, `DANTE_CORE_URL` será la URL remota HTTPS asignada a `Dante-AI-Core` en Vercel.

---

## 2. Requisitos de Entorno y Dependencias

- **Node.js:** Versión 18 o 20 LTS (Next.js 14 App Router, React 18, Tailwind, Supabase JS, Zod).
- **Herramienta Bóveda (`tools/config-vault`):** Requiere Node.js >= 18. Opera con **cero dependencias externas** para descifrar, inspeccionar en RAM y exportar variables.
- **Dependencia `pg`:** Es requerida **únicamente** para ejecutar comprobaciones directas contra Neon vía red (`npm run vault:check` o botón en UI), **no para desbloquear la bóveda ni leer secretos en memoria**.

---

## 3. Estado de Infraestructura y Base de Datos (Neon)

- **Proyecto:** `Dante Ai Isaac` (`floral-glitter-53289276`)
- **Rama:** `production` (`br-proud-credit-b5keq62g`)
- **Endpoint:** `ep-quiet-forest-b571toev` (Directo) / `ep-quiet-forest-b571toev-pooler` (Pooler)
- **Base de Datos:** `neondb`
- **Tablas Detectadas:**
  - `provider_settings` (Existe, 0 filas)
  - `user_provider_credentials` (Existe, 0 filas)
- **Bloqueo Actual:**
  - `conversations` y `messages` aún no existen en Neon.

### Procedimiento SQL Obligatorio al Retomar:
1. **Verificar Destino y Esquema Previos:**  
   Antes de aplicar cualquier sentencia DDL, abrir Neon Console, confirmar endpoint `ep-quiet-forest-b571toev` y base `neondb`. Ejecutar comprobaciones de solo lectura `migrations/0000_checks.sql` y `migrations/0003_checks.sql` (PRE) en `Dante-AI-Core` para auditar el estado sin alterar datos.
2. **Migración Base `0000` (`Dante-AI-Core/migrations/0000_create_conversations_and_messages.sql`):**  
   Crea tablas reales con las columnas exactas:
   - `conversations`: `id` (UUID PK), `external_id` (TEXT UNIQUE), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `mode` (TEXT DEFAULT 'local-core'), `status` (TEXT DEFAULT 'active'). *(Sin columnas title ni metadata no versionadas)*.
   - `messages`: `id` (UUID PK), `conversation_id` (UUID FK ON DELETE CASCADE), `role` (TEXT), `content` (TEXT), `request_id` (TEXT), `created_at` (TIMESTAMPTZ). Índice `messages_conversation_idx`.
3. **Migración `0003` (`Dante-AI-Core/migrations/0003_add_conversation_owner.sql`):**  
   Añade columna `owner_id UUID NULL` e índice `conversations_owner_idx` en `conversations (owner_id, updated_at DESC)`.
4. **Comprobación Posterior:**  
   Ejecutar `migrations/0000_checks.sql` y `migrations/0003_checks.sql` (POST) para verificar columnas, nulabilidad de `owner_id` e índices.

---

## 4. Estado de Secretos, Credenciales y Continuidad

1. **`CREDENTIAL_MASTER_SECRET` Conservada:** La clave secreta maestra original utilizada para el cifrado AES-256-GCM se encuentra conservada íntegra y de forma segura dentro de la bóveda cifrada `dante-config-2026-10-18.dantevault` en el repositorio privado `Dante-Private-Config`.
2. **`DANTE_CORE_TOKEN` Pendiente de Vercel:** Es el token de aserción interna y firma HMAC entre La Casa y el Core para proteger las comunicaciones backend a backend. Es un valor nuevo que queda pendiente de coordinar y configurar en las variables de entorno de Vercel en ambos proyectos.
3. **Login Real, UUID Autorizado y Persistencia E2E Pendientes:**
   - El inicio de sesión real vía Supabase Auth (GitHub) debe ser completado por Isaac en el navegador.
   - El UUID de usuario resultante de Supabase debe registrarse en `DANTE_AUTHORIZED_OWNER_IDS`.
   - La persistencia integral E2E (turnos de chat almacenándose durablemente en Neon) se validará una vez aplicadas las migraciones y desplegados los servicios en Vercel.
4. **Modelo Gemini Pendiente de Actualizar/Verificar:** El modelo configurado en los adaptadores requiere verificación de cuotas e inferencia real en la nube sin costo.
5. **OpenRouter y NVIDIA NIM:** Su presencia en los selectores de la interfaz de usuario, contratos Zod y catálogo estático refleja la arquitectura multimodelo planificada, pero **NO equivalen a adaptadores cliente implementados en La Casa** (únicamente Gemini tiene adaptador activo en esta fase).

---

## 5. Incidentes y Desviaciones Registradas en Esta Sesión

### Incidente Sanitizado: Bloqueo de Git Credential Manager (GCM)
- **Problema:** Durante la sincronización inicial con GitHub, el comando `git push` quedó suspendido en segundo plano con 0 bytes de salida.
- **Causa Raíz:** El equipo prestado contenía en el Administrador de Credenciales de Windows una credencial genérica predeterminada para `git:https://github.com` perteneciente a otra cuenta (`nexuslabsaihq-svg`). Al usar URLs estándar, GCM intentó autenticarse con esa cuenta ajena en lugar de la cuenta de Isaac (`isaacipp1709-cloud`), disparando un diálogo interactivo invisible en procesos no atendidos.
- **Solución Aplicada:** Se canceló de forma aislada la tarea de push sin afectar otros procesos. Se actualizó la URL de origen de los repositorios a `https://isaacipp1709-cloud@github.com/...`, permitiendo a GCM resolver la credencial específica de Isaac y completar el push de manera síncrona.

### Registro de Desviación: Borrado de Directorio Temporal
- **Hecho:** Tras verificar el clon limpio de prueba en la carpeta temporal de scratch, dicho directorio fue eliminado para mantener limpio el entorno.
- **Desviación:** Esto constituyó una desviación respecto a la instrucción estricta de "no borrar nada". Queda formalmente asentado como lección aprendida: no ejecutar borrados de directorios temporales sin confirmación previa del usuario. No se repitieron borrados posteriores.

---

## 6. Estado de Dispositivos y Accesos Locales en el Equipo Prestado

- **Unidad USB Externa:** **NO VERIFICADO**. No se inspeccionó ni validó ninguna unidad de almacenamiento USB física durante esta sesión.
- **Accesos y Credenciales en el Equipo Prestado:** **NO RETIRADOS**. Los archivos de trabajo locales en Documentos y Escritorio, así como las credenciales de Isaac en el Administrador de Credenciales de Windows, continúan en este equipo. Isaac deberá cerrar sesión y retirar manualmente sus credenciales antes de devolver el computador.

---

## 7. Continuidad y Persistencia del Chat BYOK (2026-10-20)

### Objetivo y Alcance
Resolver las fallas de continuidad del hilo de conversación y la pérdida del estado de persistencia en el flujo de chat con credenciales BYOK (`ChatShell` → `/api/chat` / `/api/chat/credentials` → `credential-handlers` → `dante-bridge` → `Dante-AI-Core`), garantizando contratos tipados y seguridad de identidad sin modificar credenciales ni bases de datos.

### Modificaciones Clave Implementadas

1. **Propagación Integral de `conversationId`:**
   - La interfaz (`ChatShell`) envía `conversationId` o `sessionId` en la carga útil.
   - Los handlers `handleChatWithStoredCredentialFromBody` y `handleChatWithCredential` extraen y validan el identificador (`input.conversationId?.trim() || input.sessionId?.trim()`), reenviándolo a `executeChatWithCredential` y `core.chatWithStoredCredential`.
   - `dante-bridge` (`chatWithStoredCredential`) formatea el encabezado HTTP estándar `X-Conversation-ID` con el ID resuelto. Si el caller no suministra ninguno, genera un UUID v4 criptográfico (`randomUUID()`), manteniendo retrocompatibilidad total con consumidores previos.

2. **Propagación del Estado de Persistencia (`persistence`):**
   - El Core responde con `persistence: 'saved' | 'unavailable' | 'disabled'`.
   - Se actualizó el esquema Zod `DanteChatResponseSchema` (`src/contracts/dante.ts`) y la interfaz TypeScript `DanteChatResponse` (`src/lib/dante-bridge/client.ts`) para incluir `persistence?: 'saved' | 'unavailable' | 'disabled'`.
   - Si el Core no informa el estado o emite un valor no reconocido, **no se inventa "saved"**: se deja como `undefined`.
   - `credential-handlers` propaga `persistence` directamente en la respuesta JSON retornada a la interfaz.
   - En `ChatShell`, si `data.persistence === 'unavailable'`, se activa la notificación de advertencia en la interfaz ("Advertencia: No se pudo guardar la conversación en el servidor"), asegurando visibilidad clara para el usuario sin bloquear el chat.

3. **Prevención de Colisiones de Identificadores:**
   - Se eliminaron los IDs estáticos fijos (como `conv-01-arquitectura`) y los generados mediante fragmentos de reloj `Date.now()` (`conv-${Date.now().toString().slice(-6)}` o `byok-${Date.now()}`).
   - Toda generación de identificadores de sesión/conversación utiliza ahora UUID v4 universales (`crypto.randomUUID()` en navegador / `randomUUID()` en Node.js), previniendo solapamiento o colisiones en sesiones concurrentes.

4. **Blindaje de Identidad de Servidor:**
   - El `ownerId` proviene **exclusivamente** de la sesión autenticada validada en el servidor (`requireOwner`), impidiendo la inyección o suplantación de propietarios desde el cuerpo JSON de la petición HTTP (`body.ownerId` / `body.userId`).
   - Se corrigió la validación de `credentialId` con `.trim()` para rechazar cadenas compuestas exclusivamente de espacios en blanco (`'   '`) con código HTTP 400 (`INVALID_REQUEST`).

5. **Verificación Automatizada:**
   - Se implementó la suite `tests/conversation-continuity.test.ts` con 11 escenarios cubriendo:
     - Envío de `conversationId` hacia Core como `X-Conversation-ID`.
     - Fallback de `sessionId` cuando `conversationId` no se envía.
     - Fallback a UUID criptográfico sin colisión cuando no se envía ningún ID.
     - Propagación de `persistence: 'saved'` y `persistence: 'unavailable'`.
     - No invención de estado si Core no lo informa (`persistence: undefined`).
     - Rechazo de `credentialId` vacío o con solo espacios.
     - Paridad de propagación en endpoint `/api/chat/credentials`.
     - Preservación estricta de `ownerId` de servidor contra inyecciones en el cuerpo.
     - Transporte HTTP en `DanteBridgeImpl` con cabeceras `X-Conversation-ID` y aserción firmada HMAC (`x-dante-owner-assertion`).
     - Generación de identificadores únicos distintos ante solicitudes sin ID (prevención de colisiones).
     - Descarte de estados de persistencia desconocidos o no válidos.
   - **Resultados:** 11/11 pruebas de continuidad pasando; suite completa de 24 archivos y 106 pruebas ejecutada exitosamente sin regresiones (`npm test`); chequeo estricto de tipos TypeScript sin errores (`npm run typecheck`).
   - **Actualización y Cierre de Verificadores (`verify:*`):**
     - `verify:bridge`: Adaptado al contrato de identidad firmada (`verifiedOwnerId`) con dependencias interceptadas en memoria (Código 0).
     - `verify:chat-route`: Valida rechazo de llamadas anónimas (401 UNAUTHORIZED) y recorrido autorizado con fixtures de Supabase Auth en memoria, sin alterar `requireAuthorizedOwner` ni introducir bypasses (Código 0).
     - `verify:chat-ui`: Adaptado a `authorizedFetch` (prohibiendo `fetch` plano hacia `/api/chat`), distinguiendo explícitamente auditoría estática de prueba de navegador interactiva (Código 0).
   - **Revisión Git de Whitespace:** `core.whitespace` fue restaurado a su estado original desconfigurado (unset). La alerta en `git diff --check` se debe a los retornos de carro en el blob histórico `-text` de `index.ts` y no a espacios en blanco reales.
