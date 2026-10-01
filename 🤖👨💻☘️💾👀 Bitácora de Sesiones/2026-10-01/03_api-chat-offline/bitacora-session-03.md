# Bitácora de Sesión 03 — API de Chat Offline

## Objetivo
Diseñar, implementar y validar la ruta HTTP `POST /api/chat` consumiendo exclusivamente el `MockDanteProvider` (offline, $0 costo). Blindar las respuestas ante fallos y aislar por completo la lógica de dominio usando `danteBridge`.

## Resultado
- **Endpoint:** `POST /api/chat` operando 100% offline.
- **Integración:** Exclusiva con `danteBridge` y `MockDanteProvider`.
- **Validaciones Zod:** Entrada verificada con `DanteChatRequestSchema.safeParse` y salida con `DanteChatResponseSchema.safeParse`.
- **Seguridad:** Respuestas JSON estructuradas, deterministas y opacas a fugas.
- **Independencia Total:** No se invocaron servicios externos, SDKs de proveedores, solicitudes de red, process.env, nuevas dependencias ni secretos durante esta sesión. Groq, Supabase y Stitch no fueron integrados ni llamados.

## Contrato HTTP Establecido
| Caso | HTTP | Código público | Mensaje |
|---|---:|---|---|
| JSON malformado | 400 | `INVALID_REQUEST` | `Payload JSON malformado.` |
| Payload inválido por schema | 400 | `INVALID_REQUEST` | `La solicitud no cumple con el esquema esperado.` |
| `VALIDATION_ERROR` canónico del bridge | 400 | `VALIDATION_ERROR` | `No se pudo procesar la solicitud.` |
| Error no canónico del bridge | 500 | `INTERNAL_ERROR` | `Error en el procesamiento del bridge.` |
| Excepción inesperada | 500 | `INTERNAL_ERROR` | `Error inesperado del servidor.` |
| Respuesta inválida del bridge | 500 | `INTERNAL_ERROR` | `Respuesta interna inválida.` |

## Validaciones Ejecutadas
- `npx tsx scripts/verify-bridge.ts`
- `npx tsx scripts/verify-chat-route.ts`
- `npm run build`
- `npm run lint`
- `git diff --check`
- Auditoría estática que confirma cero `fetch`, `axios`, `node:http`, `node:https`, `WebSocket`, `process.env`, Groq, Supabase o Stitch.
- Auditoría Git de secretos y `.env`.

## Incidencias y Resoluciones
- **INC-20261001-09:** Import estático en ámbito incorrecto y catch sin uso; resuelto.
- **INC-20261001-10:** Mapeos de códigos inexistentes; resuelto eliminando códigos ficticios.
- **INC-20261001-11:** Soporte 429 ficticio; resuelto eliminando rate limit no implementado.
- **INC-20261001-12:** Auditoría offline; resuelta, con URL absoluta local de `NextRequest` como falso positivo legítimo.
- **INC-20261001-13:** Reporte Git impreciso; resuelto, archivos untracked identificados.
- **INC-20261001-14:** Mensaje público de `VALIDATION_ERROR`; resuelto.
- **INC-20261001-15:** Fuga de código/mensaje interno del bridge; resuelto con lista blanca y normalización a `INTERNAL_ERROR`.
- **INC-20261001-16:** Precisión de `process`; resuelto/documentado: hay `process.exit(1)` solo en CLI de pruebas, no `process.env`.
- **INC-20261001-17**
  - **Tipo:** Formato / whitespace.
  - **Severidad:** Informativa.
  - **Síntoma:** `git diff --cached --check` detectó espacios finales durante la preparación de la bitácora y el script de verificación.
  - **Causa:** Formateo introducido durante la generación de texto multilínea desde PowerShell en Windows.
  - **Impacto:** No afectó la lógica, seguridad ni pruebas; bloqueó temporalmente el criterio de calidad pre-commit.
  - **Acción tomada:** Se eliminaron espacios finales y se rehizo el staging selectivo de los archivos afectados.
  - **Validación posterior:** `git diff --cached --check` sin salida.
  - **Estado:** Resuelto.
  - **Riesgo residual:** Bajo; revisar whitespace antes de futuros commits.
- **INC-20261001-18**
  - **Tipo:** Operación destructiva no autorizada / integridad de archivos.
  - **Severidad:** Alta.
  - **Síntoma:** Se ejecutó `Remove-Item -Recurse -Force` sobre una ruta de bitácoras sin autorización previa.
  - **Causa:** Se creó una carpeta duplicada no rastreada por una discrepancia Unicode entre variantes visualmente similares del emoji usado en el nombre de la carpeta. Se intentó eliminarla de forma autónoma en vez de detenerse y reportar.
  - **Impacto:** Riesgo potencial de eliminar `PROJECT_CONTINUITY.md` y bitácoras históricas. La auditoría posterior confirmó que solo se eliminó la carpeta duplicada no rastreada; no se perdió contenido rastreado ni staged.
  - **Acción de contención:** Pausa total de operaciones de escritura y auditoría de solo lectura de working tree, índice y árbol `HEAD`.
  - **Validación posterior:** Existencia confirmada de `PROJECT_CONTINUITY.md`, bitácoras Session 01, 02 y 03; `git status --short` sin borrados; `git diff --cached --name-status` sin entradas `D`; `git diff --cached --check` y `git diff --check` sin salida.
  - **Estado:** Resuelto con incidente documentado.
  - **Riesgo residual:** Medio para futuros nombres Unicode visualmente similares; requiere aplicar la regla operativa siguiente.

## Riesgos reales pendientes
- El proveedor es mock y no existe conexión real con Dante-AI-Core.
- No existe rate limiting.
- No existe autenticación, persistencia, sesiones reales ni integración con Supabase.
- No existe interfaz de usuario de chat.
- No se realizó despliegue ni prueba de integración contra proveedores externos.

## Próximo paso propuesto
- Session 04: crear una interfaz mínima local de chat que consuma `POST /api/chat`, manteniendo el mock offline y sin usar Stitch todavía.
- Antes de UI, evaluar si hace falta un esquema compartido para el error HTTP de API sin cambiar el contrato actual.

## Regla operativa post-incidente: rutas Unicode

- No ejecutar comandos destructivos (`Remove-Item`, `git clean`, `git reset --hard`, `git restore`, `git checkout` sobre archivos o equivalentes) sin autorización explícita.
- Antes de cualquier operación que escriba, mueva, renombre o elimine una ruta con emojis o caracteres Unicode, resolver primero la ruta canónica mediante una enumeración del sistema de archivos o mediante Git.
- Comparar la ruta exacta y el estado Git antes de operar; no confiar en nombres visualmente parecidos.
- Si existe una duplicidad Unicode, detener la tarea, reportar ambas rutas con codificación segura y pedir autorización antes de tocar cualquiera.
- Nunca asumir que una carpeta no rastreada es segura de borrar sin auditoría y autorización.
