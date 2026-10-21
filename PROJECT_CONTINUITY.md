# La Casa de Dante — Continuidad del Proyecto y Estado de Producción Oficial

**Última Actualización:** 2026-10-21 (Producción Oficial Verificada en `main`, Hardening en Terminales Públicas y Ecosistema BYOK)  
**Rama Oficial de Producción:** `main` (Commit `162951e`)  
**Estado Certificado:** `PRODUCCIÓN VERIFICADA`  
**Endpoint Oficial Cloud:** `https://la-casa-de-dante.vercel.app`  
**Repositorio Privado de Configuración:** `https://isaacipp1709-cloud@github.com/isaacipp1709-cloud/Dante-Private-Config.git` (`main` / `5428d0e`)  

---

## 1. Arquitectura y Runtime en la Nube ($0.00 USD)

La Casa de Dante es la interfaz de usuario frontend y middleware de acceso de Dante AI:
- **Despliegue:** Vercel (Edge/Serverless).
- **Acceso:** Desde cualquier dispositivo (móvil, tablet, laptop, computadores públicos de universidad o biblioteca).
- **Autenticación:** Supabase Auth (GitHub OAuth) con adaptador de memoria volátil `browserAuthStorage` (cero residuo en disco).
- **Puente con el Núcleo (`Dante Bridge`):**
  - Variable `DANTE_MODE`: En `'cloud'`, despacha peticiones HTTP firmadas con HMAC-SHA256 a `DANTE_CORE_URL`.
  - En producción, `DANTE_CORE_URL` es `https://dante-ai-core.vercel.app`.
- **Persistencia y Bóveda Relacional:** Neon PostgreSQL (`ep-quiet-forest-b571toev` / `neondb`).

---

## 2. Seguridad en Terminales de Acceso Público

Para garantizar que ningún secreto, token de sesión ni clave API quede jamás registrado en la memoria no volátil, disco o historial de computadores ajenos:
- **Almacenamiento en Memoria Volátil (`browserAuthStorage`):**  
  En `src/lib/auth/client-session.ts`, los tokens de sesión (`access_token`, `refresh_token`) residen **exclusivamente en la memoria volátil de JavaScript (`Map<string, string>()`)**.
- **Cero Residuos al Cerrar Ventana:** Al cerrar la pestaña o el navegador, el sistema operativo purga inmediatamente la memoria asignada al proceso. **Cero residuos quedan en disco o en `localStorage`**.
- **Mapeo PKCE Temporal:** Únicamente el verificador efímero de intercambio OAuth (`code-verifier`) utiliza `sessionStorage` durante los milisegundos de la redirección ida y vuelta con GitHub, eliminándose inmediatamente en el callback.
- **Destrucción Determinista de Sesión (`signOut`):** Al presionar el botón "Cerrar sesión" en la barra lateral, se vacía la RAM (`volatileMemoryStorage.clear()`), se invoca `signOut()` en Supabase y se redirige limpiamente a `/login`.

---

## 3. Estado de Infraestructura y Base de Datos (Neon)

- **Proyecto:** `Dante Ai Isaac` (`floral-glitter-53289276`)
- **Rama:** `production` (`br-proud-credit-b5keq62g`)
- **Endpoint:** `ep-quiet-forest-b571toev` (Directo) / `ep-quiet-forest-b571toev-pooler` (Pooler)
- **Base de Datos:** `neondb`
- **Tablas Activas y Auditadas:**
  - `conversations` (UUID PK, `owner_id`, `created_at`, `updated_at`, `mode`, `status`)
  - `messages` (UUID PK, `conversation_id`, `role`, `content`, `request_id`, `created_at`)
  - `provider_settings` (Configuración de modelos por proveedor)
  - `user_provider_credentials` (Credenciales BYOK cifradas con AES-256-GCM por `owner_id`)
- **Aislamiento Multi-Inquilino:** Estricto filtro `WHERE owner_id = $1::uuid` en el 100% de consultas relacionales.

---

## 4. Ecosistema Multi-Proveedor BYOK (Bring Your Own Key)

Catálogo y adaptadores wire activos para 5 proveedores de alta gama:
1. **Google Gemini:** `gemini-3.8-flash` (SDK Nativo `@google/generative-ai`).
2. **NVIDIA NIM:** `meta/llama-3.1-70b-instruct` (`https://integrate.api.nvidia.com/v1/chat/completions`).
3. **Groq LPU:** `llama-3.3-70b-versatile` (`https://api.groq.com/openai/v1/chat/completions`).
4. **OpenRouter:** `meta-llama/llama-3.3-70b-instruct:free` (`https://openrouter.ai/api/v1/chat/completions`).
5. **Hugging Face:** `meta-llama/Meta-Llama-3-8B-Instruct` (`https://router.huggingface.co/hf-inference/v1/chat/completions`).

---

## 5. Aseguramiento de Calidad y Expedientes Maestros

- **Suites Automatizadas:** 138/138 pruebas aprobadas al 100% (`npm test`), incluyendo `tests/public-terminal-security.test.ts`.
- **Next.js Production Build:** Código de salida 0 sin advertencias críticas.
- **Escaneo de Secretos:** 0 fugas de tokens o connection strings.
- **Expedientes Oficiales:** Archivados en `docs/informes/` y en pendrive físico `D:\Expediente_Jarvis_Dante_Produccion_2026-10-21\`:
  - `INFORME_TECNICO_CLINICO_DANTE_2026-10-21` (MD y PDF).
  - `INFORME_CONTEXTO_JARVIS_DANTE_2026-10-21` (MD y PDF).
