# Continuidad de Proyecto y Estado Activo

Este documento sirve como registro maestro del contexto actual. Todo Agente debe leer este archivo antes de comenzar una nueva sesión de trabajo para mantener la cohesión del proyecto.

## Estado Actual

- **Fase Activa:** Cierre documental local de Session 04 — Interfaz de Chat Local (Offline).
- **Última sesión publicada:** Session 03, commit `8410540` en `origin/main`: `POST /api/chat` offline, validación Zod y pruebas de ruta.
- **Estado local actual:** Session 04 implementada y validada en el working tree; incluye UI mínima de chat, componentes locales y auditoría estática de UI.
- **Estado Git actual:** bitácora y continuidad actualizadas localmente; staging selectivo, commit, push y verificación post-push pendientes de autorización explícita.
- **Siguiente acción autorizable:** revisar el diff documental final y, solo tras aprobación de Isaac, preparar staging selectivo.

## Estado técnico confirmado

- `POST /api/chat` existe y opera sobre `danteBridge` y `MockDanteProvider` offline.
- La UI de Session 04 usa exclusivamente `fetch('/api/chat')`.
- No hay integración activa con Dante-AI-Core real, Stitch, Groq, Supabase, Vercel ni proveedores externos.
- No hay autenticación, rate limiting, persistencia, cookies, localStorage ni base de datos.
- `.env.local` y `.env.local.txt` permanecen ignorados y fuera de Git.

## Entorno Local
- Las dependencias críticas (groq-sdk, @supabase/supabase-js, zod, tailwind, etc.) han sido instaladas satisfactoriamente y no se usarán aún.

## Riesgos Pendientes

- La UI no tiene pruebas E2E o de navegador; `verify-chat-ui.ts` realiza validaciones estáticas y no sustituye pruebas visuales o de interacción real.
- No existe persistencia conversacional por decisión de alcance.
- Session 04 aún no está staged, committeada, publicada ni verificada post-push.
- Las rutas Unicode de bitácoras requieren resolución canónica antes de futuras operaciones de escritura.
- Las integraciones externas permanecen fuera de alcance hasta autorización específica.

## Estado de Session 04

Estado local: UI mínima de chat offline implementada y validada.
Validaciones declaradas exitosas: verify-chat-ui, verify-bridge, verify-chat-route, build, lint, diff check y auditoría de ignore de .env.
Estado Git: bitácora y continuidad documentadas localmente; staging selectivo, commit, push y verificación post-push pendientes de autorización.

## Archivos de Session 04

- `src/app/page.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/chat/chat-composer.tsx`
- `src/components/chat/chat-shell.tsx`
- `scripts/verify-chat-ui.ts`
- Bitácora de Session 04

## Próximo hito previsto

Session 05: diseño visual y componentes; evaluar Stitch únicamente después de validar la UI básica y bajo autorización explícita.
No integrar proveedores, base de datos, persistencia, autenticación ni servicios externos durante ese hito.
