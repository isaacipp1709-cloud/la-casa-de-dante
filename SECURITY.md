# Políticas de Seguridad (La Casa de Dante)

La seguridad y la optimización de recursos financieros son pilares críticos del ecosistema.

## 1. Zero Secrets en Git
- Todos los secretos y credenciales de API se administrarán en el archivo `.env.local`, el cual está permanentemente anclado y protegido por `.gitignore`.
- Jamás se hará push de tokens a GitHub (incluso ramas temporales).
- El único archivo de configuración autorizado para subir es `.env.example`, sin valores reales.
- El `security-auditor` está autorizado a rechazar operaciones que rompan estas reglas.

## 2. Costo Cero ($0) y Rate-Limiting
- **Supabase:** Se debe implementar `Row Level Security (RLS)` para que todas las tablas comiencen con `deny-by-default` para todos. Solamente se debe conceder el acceso explícito (lectura/escritura) requerido por el sistema.
- **Groq & Vercel:** Para evitar un sobrecosto no anticipado y mantener el sistema operando en los "Free Tiers", se implementará `rate-limiting` a nivel del adaptador.
- Fallback: Si se superan las cuotas gratuitas, el sistema debe degradarse graciosamente y reportar el error en vez de recurrir automáticamente a un tier pagado.

## 3. Sanitización de Inputs y Validación
- Toda subida de documentos o input por chat pasará por validación estricta utilizando **Zod**.
- Los documentos cargados deben someterse a verificación de tipos MIME en el backend (No confiar únicamente en la cabecera enviada por el navegador).
- Prevención XSS al renderizar markdown proveniente del chat.
