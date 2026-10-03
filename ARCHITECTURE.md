# Arquitectura del Sistema (La Casa de Dante)

La arquitectura sigue el principio de separación de responsabilidades, aislando el núcleo cognitivo de las interfaces y adaptadores externos.

## Flujo de Datos por Capas

```text
+-------------------------------------------------------------+
|                        LA CASA DE DANTE                     |
|                                                             |
|  +----------------+     +-------------------+               |
|  |                |     |                   |               |
|  |  UI Components |<--->|    API Routes     |               |
|  | (Dashboard,    |     | (Next.js Edge)    |               |
|  |  Chat Stream)  |     |                   |               |
|  +----------------+     +-------------------+               |
|                                  |                          |
|                                  v                          |
|                         +-------------------+               |
|                         |  Adaptadores (Zod)|               |
|                         | (Frontera Segura) |               |
|                         +-------------------+               |
|                                  |                          |
+----------------------------------|--------------------------+
                                   | (Inyección / Interfaces puras)
                                   v
+-------------------------------------------------------------+
|                         DANTE-AI-CORE                       |
|  (Cerebro Puro, Determinista, 37 Neuronas de von Neumann)   |
+-------------------------------------------------------------+
                                   |
+----------------------------------|--------------------------+
|                        PROVEEDORES EXTERNOS                 |
|  - Groq Cloud (LLM Fast Engine)                             |
|  - Supabase (DB & Storage)                                  |
|  - NotebookLM (Memoria/RAG)                                 |
+-------------------------------------------------------------+
```

## Fronteras Inmutables
- **Dante-AI-Core (El Cerebro) es Puro:** No contiene llamadas a red, fetch, ni acceso a la base de datos. Solo recibe inputs y devuelve outputs en estado determinista. No conoce la interfaz de usuario.
- **La Casa (El Adaptador) gestiona la I/O:** El mundo exterior (Groq, base de datos de Supabase, subida de documentos, interactividad en React) está gestionado en La Casa.
- **Inyección de Dependencias:** Los adaptadores de la Casa envuelven los clientes de Groq y Supabase en interfaces que el Core espera, pasando dichas dependencias durante el tiempo de ejecución.

---

## Resiliencia

### Timeout
- Default: 30s (`chatWithDante` timeoutMs).
- Configurable vía variable de entorno futura (`DANTE_CORE_TIMEOUT_MS`).

### Reintentos
- 1 reintento inmediato (sin backoff en esta fase).
- Si falla → error propagado a UI.

### Estados del bridge
- `CONNECTED`: Core responde correctamente.
- `DEGRADED`: Timeout o error transitorio.
- `DISCONNECTED`: Modo mock activo.
- `ERROR`: Error no recuperable.
- `LOADING`: Request en curso.

### Headers HTTP
- `Authorization: Bearer <token>`
- `X-User-Timezone`, `X-User-Locale`, `X-User-ID`, `X-Conversation-ID`

