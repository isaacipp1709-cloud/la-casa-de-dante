# Bitácora de Sesión 05 — Paso 2: Alineación de Modelo Gemini Vigente, Coherente y de Costo Cero

- **Fecha:** 2026-10-20
- **Rama:** `rescue/isaac-2026-10-18`
- **Workspace:** `la-casa-de-dante` (en coordinación con `Dante-AI-Core`)
- **Alcance:** Eliminación de modelos Gemini obsoletos/retirados del recorrido efectivo de chat, unificación del default y catálogo vigentes con nivel gratuito documentado, y rechazo explícito de overrides obsoletos sin llamadas reales al proveedor.

---

## 1. Evidencia Oficial de Selección de Modelo (Google Gemini API)

Consultada la documentación oficial vigente de Google Gemini API (`gemini-api-guides/models.md`, `gemini-api-guides/deprecations.md`, `gemini-api-guides/pricing.md`, `gemini-api-guides/models/gemini-2.0-flash.md`, `gemini-api-guides/models/gemini-3.8-flash.md` y `gemini-api-guides/models/gemini-3.5-flash-lite.md`):

1. **Baja definitiva de `gemini-2.0-flash` (`deprecations.md#gemini-20-models`):**
   - `gemini-2.0-flash`, `gemini-2.0-flash-001`, `gemini-2.0-flash-exp` y `gemini-2.0-flash-lite` fueron apagados definitivamente (*shut down*) el **1 de junio de 2026**. El endpoint ya no está disponible.
2. **Restricción de `gemini-2.5-flash` para proyectos nuevos (`models.md#gemini-25-flash`):**
   - Google limita el acceso a los modelos 2.5 a cuentas con uso histórico activo previo y recomienda explícitamente para proyectos nuevos: **`gemini-3.8-flash`** o **`gemini-3.5-flash-lite`**.
3. **Modelo elegido por defecto (`DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'`) y catálogo (`ALLOWED_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']`):**
   - **`gemini-3.8-flash` (Selección inicial / default aprobado):** Estable (GA, lanzado el 2 de septiembre de 2026), sin fecha de retiro anunciada (`No shutdown date announced`) y con **Free Tier estándar documentado** (`Input price: Free of charge`, `Output price (including thinking tokens): Free of charge`, `Context caching: Free of charge`).
   - **`gemini-3.5-flash-lite` (Segunda opción válida en catálogo):** Estable (GA, lanzado el 21 de julio de 2026), sin fecha de retiro anunciada y con **Free Tier estándar documentado** (`Free of charge` en entrada y salida).
   - **Compatibilidad con SDK `@google/generative-ai` (`^0.24.1`):** El cliente utiliza `v1beta/models/${model}:generateContent` con el mismo contrato estándar `contents`/`candidates`/`usageMetadata`, sin requerir actualización de SDK ni instalación de dependencias.

---

## 2. Cambios Aplicados en `la-casa-de-dante`

1. **`src/lib/providers/gemini.ts`:**
   - Unificación de `DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'` y `ALLOWED_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const`.
   - Implementación de `InvalidGeminiModelError` (`code = 'INVALID_MODEL'`), `isAllowedGeminiModel` y `resolveGeminiModel`, validando tanto overrides de solicitud como `process.env.DEFAULT_GEMINI_MODEL` antes de invocar el SDK.
2. **`src/app/api/providers/route.ts`, `src/components/chat/provider-selector.tsx` y `src/lib/dante-bridge/mock-provider.ts`:**
   - Consumo directo de `ALLOWED_GEMINI_MODELS` importado desde `@/lib/providers/gemini`, garantizando que el selector, el catálogo del endpoint `/api/providers` y el proveedor mock expongan `['gemini-3.8-flash', 'gemini-3.5-flash-lite']` con `'gemini-3.8-flash'` en la posición inicial (`models[0]`).
3. **`src/lib/services/credential-handlers.ts`:**
   - Validación de `model` mediante `resolveGeminiModel` en `executeChatWithCredential` y `runWithResolvedCredential`:
     - Sin `model` explícito en el recorrido local de Gemini, selecciona `DEFAULT_GEMINI_MODEL` (`'gemini-3.8-flash'`).
     - Preserva modelos permitidos explícitos (`'gemini-3.8-flash'`, `'gemini-3.5-flash-lite'`).
     - Rechaza explícitamente overrides obsoletos (`'gemini-2.0-flash'`, `'gemini-2.5-flash'`, `'gemini-1.5-*'`, `'gemini-pro'`) con `400 INVALID_REQUEST` sin invocar a `Dante-AI-Core` ni al adaptador del proveedor.
4. **`scripts/verify-chat-route.ts` y `tests/*.test.ts`:**
   - Actualización de fixtures positivos al modelo vigente `'gemini-3.8-flash'` / `'gemini-3.5-flash-lite'` y adición de pruebas negativas aisladas para el rechazo de modelos obsoletos.
