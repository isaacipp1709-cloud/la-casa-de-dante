# La Casa de Dante


## Gestión de Proveedores y Modelos de IA (PLANIFICADO - Incremento Funcional en Rama feature/providers-ia)

### Características Implementadas (Este Incremento)
- Selector UI: Dropdowns de proveedor/modelo en ChatComposer
- Propagación: Selección enviada desde UI -> API -> Bridge -> Orquestador -> Proveedor
- Validación: Esquemas actualizados en contracts/dante.ts para aceptar providerId/model
- Identificación: Mensajes de assistant incluyen providerId y model utilizados
- Rechazo Claro: Si backend no puede usar selección, devuelve error (no cambia silenciosamente)
- Mock Identificado: Respuestas de fallback marcadas explícitamente como [Fallback Mock]

### Limitaciones de Este Incremento
- Sin Persistencia: Las selecciones NO se guardan entre recargas (requiere autenticación)
- Sin Credenciales Reales: API keys NO se solicitan ni almacenan (BYOK pendiente autorización)
- Sin Validación de Proveedor Disponible: El backend intenta la selección; si falla, usa fallback mock o devuelve error según disponibilidad real
- Sin Lista Dinámica: Selector usa datos mock; futuro: consumir /api/providers para lista real

### Cambios en el Código
- src/components/chat/provider-selector.tsx (nuevo)
- src/components/chat/chat-composer.tsx (modificado)
- src/components/chat/chat-shell.tsx (modificado)
- src/contracts/dante.ts (actualizado)
- tests/provider-selection.test.ts (nuevo - verifica propagación)

### Pruebas del Incremento
- La selección llega desde la petición hasta el ejecutor
- Se rechaza una combinación proveedor/modelo no soportada (por falta de credenciales)
- La respuesta identifica el proveedor y modelo efectivamente usados
- Una simulación no se muestra como un LLM real (prefijo [Fallback Mock] claro)
- NOTA: Estas pruebas usan proveedores falsos/mock en entorno controlado
- NOTA: No verifican llamadas reales a APIs externas (requieren credenciales y autorización específica)

### Seguridad y Modo Degradado
- Nunca se envía credencial de un proveedor a otro (aislamiento por selection)
- Modo degradado explícito: Respuestas de fallback claramente identificadas, nunca presentadas como LLM real
- Errores claros: Ante falta de credenciales, se devuelve estado explícito, no se simula éxito

### Próximos Pasos (Tras Este Incremento)
1. Probar build local y tipos: pnpm run build && pnpm run test
2. Solucionar permisos de GitHub (403) para publicar rama
3. Abrir Pull Request hacia main con cambios funcionales
4. Continuar con incremento BYOK (requiere resolución de identidad/autenticación)

## Identidad y Relación con el Cerebro
- **Dante-AI-Core:** Cerebro puro, sin dependencias externas directas ni gestión de I/O de usuario.
- **La Casa de Dante (Este repositorio):** Aplicación web que encapsula el cerebro, maneja los clientes de API (Groq, Supabase), la ingestión documental y la experiencia interactiva (chat con streaming y UI).

## Stack Tecnológico ($0 Cost Policy)
- **Framework:** Next.js 14 (App Router)
- **Estilos:** Tailwind CSS, clsx, tailwind-merge
- **UI & Gráficos:** Lucide React, Recharts
- **Base de Datos & Auth:** Supabase (Capa Gratuita con políticas RLS estrictas)
- **LLM Engine:** Groq Cloud (Vía `groq-sdk` en Free Tier) / NotebookLM
- **Validación Estricta:** Zod
- **Alojamiento:** Vercel

## Instrucciones de Desarrollo Local

1. Clona este repositorio y el del cerebro en un mismo workspace (idealmente):
   ```bash
   git clone https://github.com/isaacipp1709-cloud/la-casa-de-dante.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura el entorno local creando el archivo `.env.local` basado en `.env.example`:
   ```bash
   cp .env.example .env.local
   # Llena los secretos reales. Jamás subas .env.local a Git.
   ```
4. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Despliegue en Vercel
El proyecto está optimizado para Vercel. Asegúrate de configurar las variables de entorno en el panel de Vercel antes de desplegar, prestando especial atención a mantener los costos en el nivel gratuito.
