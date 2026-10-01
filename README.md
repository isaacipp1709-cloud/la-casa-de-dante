# La Casa de Dante

**La Casa de Dante** es la interfaz moderna, centro de mando, sistema de telemetría y memoria periférica del ecosistema cognitivo **JARVIS**. Actúa como el hogar y los sentidos periféricos de [Dante-AI-Core](https://github.com/isaacipp1709-cloud/Dante-AI-Core), el cual es el cerebro puro y determinista basado en la arquitectura de 37 neuronas de von Neumann.

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
