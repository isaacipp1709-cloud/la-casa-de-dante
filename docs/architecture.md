# Arquitectura Fundacional: La Casa de Dante

## Identidad
**La Casa de Dante** es la interfaz, el dashboard y el centro de mando del núcleo cognitivo `Dante-AI-Core`. Actúa como la capa periférica y sensorial de Dante.

## Reglas Innegociables de Arquitectura

1. **Aislamiento Estricto (Unidireccional)**
   - `la-casa-de-dante` depende del contrato de `Dante-AI-Core` a través de adaptadores explícitos.
   - `Dante-AI-Core` **jamás** conoce, importa, ni depende de nada en `la-casa-de-dante`. Es un cerebro aislado, puro y determinista.

2. **Cero I/O en el Núcleo**
   - El cerebro (Dante) no hace *fetch*, no consulta bases de datos y no lee secretos directamente.
   - Toda inyección de estado, memoria o configuración debe entrar a la función `verification` (o su equivalente) a través del adaptador en La Casa.

3. **Validación Zod Obligatoria**
   - Todo *payload* que cruce desde La Casa hacia el Cerebro (o viceversa), y cualquier dato recibido de APIs externas (Supabase, Groq), debe ser validado y tipado con `z.safeParse()` antes de su uso.

4. **Operación Serverless / Cloud a Costo $0**
   - **Frontend & Edge:** Vercel (Capa gratuita).
   - **Base de Datos & Auth:** Supabase (Capa gratuita, Postgres, RLS).
   - **Inferencia Rápida:** Groq (Capa gratuita).
   - **Memoria y RAG Externo:** NotebookLM.

5. **Seguridad de Secretos (Zero Leak)**
   - `.env`, `.env.local`, y cualquier token nunca se versionan.
   - Todo secreto se gestiona mediante Variables de Entorno en Vercel o de manera local segregada.
