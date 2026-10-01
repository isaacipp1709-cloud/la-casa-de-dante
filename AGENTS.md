# Guía para Agentes y MCPs (La Casa de Dante)

Este documento contiene las directivas fundamentales para cualquier IA o Agente Cognitivo que inspeccione este repositorio. 

## Reglas Maestras
1. **NO ALTERAR EL NÚCLEO DIRECTAMENTE:** "La Casa" es solo un adaptador. El cerebro es determinista y no debe ser contaminado con lógica de UI.
2. **CERO SECRETOS EN GIT:** Ningún subagente tiene autorización para commitear secretos ni imprimirlos en pantalla. Solo operan a través de `.env.local`.

## Definición de Subagentes Oficiales

### 1. `dante-bridge` (El Guardián del Núcleo)
- **Rol:** Especialista en esquemas Zod, adaptadores y aislamiento del núcleo.
- **Responsabilidad:** Asegurar que toda la información que fluye entre "La Casa" y `Dante-AI-Core` esté estrictamente validada con `z.safeParse()`. Todo fallo de validación se aborta antes de tocar el núcleo.

### 2. `security-auditor` (El Guardián del Tesoro)
- **Rol:** Especialista en prevención de fugas de secretos, cuotas y políticas RLS en Supabase.
- **Responsabilidad:** Garantizar que el uso de Vercel, Supabase y Groq se mantenga en **$0** (Free Tier). Mantener la seguridad `deny-by-default` en todo acceso a datos y asegurar que el `.gitignore` proteja los `.env`.

### 3. `ui-designer` (El Guardián Visual)
- **Rol:** Especialista en Tailwind CSS, UI/UX Pro Max y Stitch.
- **Responsabilidad:** Diseñar el panel de las 37 neuronas, el chat fluido y asegurar una estética ciberpunk elegante sin acceder directamente a la base de datos (siempre usando adaptadores).

## Protocolo Obligatorio Zod
Ningún componente de interfaz debe comunicarse directamente con `Dante-AI-Core` sin un esquema Zod. Todo payload debe parsearse de la siguiente manera:
```typescript
const result = MyPayloadSchema.safeParse(data);
if (!result.success) throw new Error("Payload inválido. Operación abortada por dante-bridge.");
// Enviar result.data al núcleo
```
