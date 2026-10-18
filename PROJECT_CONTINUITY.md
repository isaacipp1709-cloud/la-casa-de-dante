# La Casa de Dante — Continuidad del Proyecto y Estado de Rescate

**Última Actualización:** 2026-10-18 (Cierre de Sesión y Traslado al Laptop de Isaac)  
**Rama Activa de Rescate:** `rescue/isaac-2026-10-18`  
**Repositorio Privado de Configuración:** `https://github.com/isaacipp1709-cloud/Dante-Private-Config.git`

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

---

## 2. Estado de Infraestructura y Base de Datos (Neon)

- **Proyecto:** `Dante Ai Isaac` (`floral-glitter-53289276`)
- **Rama:** `production` (`br-proud-credit-b5keq62g`)
- **Endpoint:** `ep-quiet-forest-b571toev`
- **Tablas Detectadas:**
  - `provider_settings` (Existe, 0 filas)
  - `user_provider_credentials` (Existe, 0 filas)
- **Bloqueo Actual:**
  - `conversations` y `messages` aún no existen en Neon.
  - La migración para crearlas está en `Dante-AI-Core/migrations/0000_create_conversations_and_messages.sql`.

---

## 3. Respaldo de Configuración y Secretos

Todas las credenciales necesarias están respaldadas y cifradas en:
- Repositorio Privado: `isaacipp1709-cloud/Dante-Private-Config`
- Archivo: `dante-config-2026-10-18.dantevault`
- **SHA-256:** `DBE4E3C5914FBB1E84400D279BF5EE1C615E3F43B41FA3C463E3902CA842E013`

Para usar la herramienta local de inspección y comprobaciones en memoria:
```bash
npm run vault
# Abrir http://127.0.0.1:4179
```

---

## 4. Estado de Pruebas y Suites

- Pruebas de La Casa: **23 suites, 95 tests pasados (0 fallos)**
- Bóveda de Configuración: **1 suite, 12 tests pasados (0 fallos)**
- Cero credenciales ni secretos en texto plano.

---

## 5. Próximos Pasos en el Laptop de Isaac

1. Clonar `la-casa-de-dante` en la rama `rescue/isaac-2026-10-18`.
2. Verificar que la migración `0000` haya sido ejecutada en Neon por Isaac.
3. Desplegar La Casa en Vercel y asociar las variables de producción.
