import {
  DanteChatRequest,
  DanteChatResponse,
  DanteNeuronsResponse,
  DanteAnalytics,
  DanteConversationsResponse,
  DanteLogsResponse,
  DanteProvidersResponse,
  DanteConnectionsResponse,
  DanteHealthResponse,
  DanteDocumentIngestionResponse,
} from "./types";
import {
  DanteChatResponseSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationsResponseSchema,
  DanteLogsResponseSchema,
  DanteProvidersResponseSchema,
  DanteProviderCreateRequestSchema,
  DanteConnectionsResponseSchema,
  DanteHealthResponseSchema,
  DanteDocumentIngestionRequestSchema,
  DanteDocumentIngestionResponseSchema,
} from "@/contracts/dante";
import { ValidationError } from "./errors";
import type {
  ConnectionsStatusResponse,
  AgentConnectionsResponse,
} from "@/contracts/connections";
import { buildMockCoreConnections } from "@/lib/connections/mock-connections";

export class MockDanteProvider {
  private providers: DanteProvidersResponse = [
    {
      id: "groq-llama3",
      name: "Groq LPU (Llama 3.3 70B)",
      category: "llm-fast",
      is_active: true,
      usageToday: 14,
      dailyLimit: 14400,
      is_public: false,
      models: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"],
    },
    {
      id: "gemini-flash",
      name: "Google Gemini 2.0 Flash",
      category: "llm-multimodal",
      is_active: true,
      usageToday: 6,
      dailyLimit: 1500,
      is_public: false,
      models: ["gemini-2.0-flash", "gemini-1.5-pro"],
    },
    {
      id: "mock-local",
      name: "Dante Mock Provider ($0 Offline)",
      category: "deterministic-fallback",
      is_active: true,
      usageToday: 28,
      dailyLimit: 999999,
      is_public: true,
      models: ["mock-dante"],
    },
  ];

  private conversations: DanteConversationsResponse = [
    {
      id: "conv-01-arquitectura",
      external_id: "Auditoría de Frontera Zod (dante-bridge)",
      updated_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: "conv-02-neuronas",
      external_id: "Sincronización de 37 Neuronas Cognitivas",
      updated_at: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    },
    {
      id: "conv-03-seguridad",
      external_id: "Verificación Zero-Cost & RLS Deny-by-Default",
      updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];

  private ingestedDocs: DanteDocumentIngestionResponse = [
    {
      id: "doc-01-agents-directive",
      title: "Directivas Maestras AGENTS.md (La Casa de Dante)",
      category: "arquitectura",
      chunksCount: 4,
      charCount: 1420,
      ingestedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      neuronHandler: "N26 · Ingestor Semántico Documental",
    },
    {
      id: "doc-02-rls-zero-cost",
      title: "Política Deny-by-Default & Gobernador $0 Tier",
      category: "seguridad",
      chunksCount: 3,
      charCount: 980,
      ingestedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      neuronHandler: "N26 · Ingestor Semántico Documental",
    },
  ];

  private totalMessagesCount = 42;

  async processChat(
    request: DanteChatRequest,
    options?: {
      financialCalculations?: Record<string, unknown>;
      fromCoreFallback?: boolean;
    }
  ): Promise<DanteChatResponse> {
    const sessionId = request.sessionId ?? "local-session";
    const correlationId = `${sessionId}-${request.messages.length}`;
    const now = new Date().toISOString();

    const lastUserMessage =
      [...request.messages].reverse().find((m) => m.role === "user")?.content ??
      request.messages[request.messages.length - 1]?.content ??
      "";

    const cleanQuery = lastUserMessage
      .replace(/\n*\[System Context:\s*Financial calculations:\s*\{[\s\S]*?\}\]/gi, "")
      .trim();

    this.totalMessagesCount += 2;
    const convId = request.conversationId ?? sessionId;
    const existingConv = this.conversations.find((c) => c.id === convId);
    if (existingConv) {
      existingConv.updated_at = now;
    } else {
      const shortTitle =
        cleanQuery.length > 38 ? `${cleanQuery.slice(0, 38)}...` : cleanQuery || `Sesión ${convId.slice(0, 8)}`;
      this.conversations.unshift({
        id: convId,
        external_id: shortTitle,
        updated_at: now,
      });
    }

    const content = this.synthesizeCognitiveResponse(cleanQuery, options);
    const promptTokens = Math.max(8, Math.ceil(cleanQuery.length / 4));
    const completionTokens = Math.max(24, Math.ceil(content.length / 4));

    const response: DanteChatResponse = {
      message: {
        role: "assistant",
        content,
        timestamp: now,
      },
      status: "success",
      correlationId: correlationId,
      providerId: options?.fromCoreFallback ? "dante-cognitive-core" : "mock-local",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };

    // Validar determinísticamente la respuesta antes de enviarla
    const result = DanteChatResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error("El mock provider generó una respuesta inválida");
    }

    return result.data;
  }

  private synthesizeCognitiveResponse(
    rawQuery: string,
    options?: {
      financialCalculations?: Record<string, unknown>;
      fromCoreFallback?: boolean;
    }
  ): string {
    const query = rawQuery.trim();
    const q = query.toLowerCase();
    const financialCalc = options?.financialCalculations;
    const hasFinancialCalc =
      Boolean(financialCalc) && Object.keys(financialCalc ?? {}).length > 0;

    // 1. Saludos y consulta de capacidades ("hola, qué tal, qué puedes hacer?")
    const isGreetingOrCapabilities =
      /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos)\b/i.test(q) ||
      q.includes("qué puedes hacer") ||
      q.includes("que puedes hacer") ||
      q.includes("en qué me puedes ayudar") ||
      q.includes("en que me puedes ayudar") ||
      q.includes("quién eres") ||
      q.includes("quien eres") ||
      q.includes("cómo funcionas") ||
      q.includes("como funcionas");

    if (isGreetingOrCapabilities && !hasFinancialCalc) {
      return [
        "¡Hola! Estoy operativo y conectado a través de **dante-bridge** con validación determinista activa (`z.safeParse()`).",
        "",
        "Soy **Dante AI Core**, un organismo cognitivo inspirado en la arquitectura de **John von Neumann** con **37 neuronas especializadas** organizadas en 6 subsistemas:",
        "",
        "1. **Ejecución y Finanzas Forenses (`N01–N06`):** Cálculo determinista de IVA (19% Chile), desglose Neto/Bruto, evaluación de flujos de caja (VAN/TIR) y planificación jerárquica de tareas.",
        "2. **Seguridad y Frontera Zod (`N07–N12`):** Protección `deny-by-default`, validación estricta de contratos de entrada/salida y resguardo de cuota `$0.00 Free Tier`.",
        "3. **Memoria e Ingesta Documental (`N13–N18`, `N26`):** Consulta sobre los documentos técnicos ingeridos en el sistema (`AGENTS.md`, políticas RLS y arquitectura).",
        "4. **Razonamiento Formal (`N19–N25`):** Verificación lógica sin contradicciones, diagnóstico de arquitectura TypeScript/Next.js y síntesis de soluciones mínimas.",
        "5. **Percepción y Normalización (`N26–N31`):** Adaptación regional (`America/Santiago · es-CL`) y extracción de entidades técnicas.",
        "6. **Auditoría y Trazabilidad (`N32–N37`):** Registro inmutable con `correlationId` y monitoreo de latencia en tiempo real.",
        "",
        "¿Qué te gustaría analizar o ejecutar ahora? Por ejemplo, puedes pedirme un **cálculo financiero con IVA**, consultar el **estado de las 37 neuronas**, o revisar las **directivas de seguridad e ingesta N26**.",
      ].join("\n");
    }

    // 2. Consultas financieras, contables o con cálculos deterministas del Core
    const isFinancialQuery =
      hasFinancialCalc ||
      /\b(iva|impuesto|neto|bruto|factura|boleta|van|tir|flujo|margen|costo|precio|uf|clp|pesos|contabilidad|finanzas)\b/i.test(
        q
      );

    if (isFinancialQuery) {
      const numericMatches = query.match(/\d+(?:[.,]\d+)*/g) ?? [];
      const parsedNumbers = numericMatches
        .map((n) => Number(n.replace(/\./g, "").replace(",", ".")))
        .filter((n) => Number.isFinite(n) && n > 0);

      const details: string[] = [
        "**[Neuronas Activas: N01 · Orquestador Ejecutivo | N19 · Verificador Lógico de Von Neumann]**",
        "",
      ];

      if (hasFinancialCalc) {
        details.push(
          "**Resultado determinista verificado por Dante-AI-Core:**",
          `\`\`\`json\n${JSON.stringify(financialCalc, null, 2)}\n\`\`\``
        );
      } else if (parsedNumbers.length > 0) {
        const baseAmount = parsedNumbers[0];
        const iva = Math.round(baseAmount * 0.19);
        const totalBruto = baseAmount + iva;
        const netoDesdeBruto = Math.round(baseAmount / 1.19);
        const ivaDesdeBruto = baseAmount - netoDesdeBruto;

        details.push(
          `He procesado el monto **$${baseAmount.toLocaleString("es-CL")} CLP** bajo normativa tributaria chilena (IVA 19%):`,
          "",
          `- **Escenario A (Si $${baseAmount.toLocaleString("es-CL")} es Neto):**`,
          `  - Monto Neto: **$${baseAmount.toLocaleString("es-CL")} CLP**`,
          `  - IVA (19%): **$${iva.toLocaleString("es-CL")} CLP**`,
          `  - Total Bruto: **$${totalBruto.toLocaleString("es-CL")} CLP**`,
          `- **Escenario B (Si $${baseAmount.toLocaleString("es-CL")} es Bruto con IVA incluido):**`,
          `  - Monto Neto: **$${netoDesdeBruto.toLocaleString("es-CL")} CLP**`,
          `  - IVA contenido (19%): **$${ivaDesdeBruto.toLocaleString("es-CL")} CLP**`
        );
      } else {
        details.push(
          "El motor financiero determinista está listo para operar con **precisión contable (es-CL · IVA 19%, VAN, TIR y márgenes operativos)**.",
          "",
          "Indícame los montos o flujos que deseas evaluar (por ejemplo: *\"Calcula el IVA y bruto de 1.500.000\"* o *\"Evalúa un margen sobre costos de 850.000\"*) para entregarte el desglose exacto."
        );
      }

      return details.join("\n");
    }

    // 3. Consultas sobre las 37 neuronas, arquitectura o subagentes
    if (
      /\b(neurona|neuronas|37|von neumann|arquitectura|subagente|subagentes|dante-bridge|zod|seguridad|rls)\b/i.test(
        q
      )
    ) {
      return [
        "**[Neuronas Activas: N07 · Centinela de Contratos (dante-bridge) | N18 · Sincronizador de Continuidad | N36 · Inspector de Esquemas]**",
        "",
        "El estado arquitectónico actual de **La Casa de Dante** cumple estrictamente las directivas maestras:",
        "",
        "- **Topología de 37 Neuronas:** 34 neuronas en estado `activo` y 3 en `en_espera` (`N16`, `N24`, `N31`), distribuidas en 6 subsistemas (Ejecutivo, Seguridad, Memoria, Razonamiento, Percepción y Auditoría).",
        "- **Frontera Zod v4 (`dante-bridge`):** Las 8 rutas API (`/api/chat`, `/api/neurons`, `/api/analytics`, `/api/conversations`, `/api/logs`, `/api/providers`, `/api/connections`, `/api/health`) validan entrada y salida con `z.safeParse()`.",
        "- **Gobernanza $0 (`security-auditor`):** Cabeceras de endurecimiento HTTP activas, aislamiento de variables de entorno en servidor y protección `deny-by-default`.",
      ].join("\n");
    }

    // 4. Consultas sobre documentos ingeridos o N26
    if (/\b(documento|documentos|ingesta|n26|agents\.md|conocimiento|memoria)\b/i.test(q)) {
      const docList = this.ingestedDocs
        .map(
          (d) =>
            `- **${d.title}** (\`${d.category}\` · ${d.chunksCount} fragmentos · ${d.charCount} caracteres · procesado por *${d.neuronHandler}*)`
        )
        .join("\n");

      return [
        "**[Neuronas Activas: N26 · Ingestor Semántico Documental | N14 · Memoria Semántica Vectorial]**",
        "",
        `Actualmente mantengo **${this.ingestedDocs.length} documentos indexados** en la memoria semántica del puente:`,
        "",
        docList,
        "",
        "Puedes agregar nuevos documentos desde la vista **Sistema (`/connections`)** o consultarme directamente sobre cualquiera de estas directivas.",
      ].join("\n");
    }

    // 5. Respuesta analítica contextual para cualquier otra instrucción del usuario
    return [
      "**[Neuronas Activas: N01 · Orquestador Ejecutivo Frontal | N20 · Motor de Inferencia Causal | N29 · Detector de Intención]**",
      "",
      `He analizado tu solicitud: *"${query}"*.`,
      "",
      "- **Diagnóstico Ejecutivo:** La consulta fue validada por la frontera `dante-bridge` sin anomalías de contrato y enrutada bajo el perfil regional `es-CL` (`$0.00 Free Tier`).",
      "- **Síntesis Determinista:** Para profundizar con precisión forense, indícame si deseas aplicar **cálculo financiero/tributario (IVA, flujo de caja, costos)**, **auditoría técnica de arquitectura/código**, o **estructuración estratégica por etapas** sobre este requerimiento.",
    ].join("\n");
  }

  getNeurons(): DanteNeuronsResponse {
    const now = Date.now();
    const specs: Array<{
      code: string;
      title: string;
      category: string;
      status: "activo" | "en_espera" | "degradado";
      description: string;
      offsetSec: number;
      latencyMs: number;
      activationsToday: number;
    }> = [
      // Subsistema Ejecutivo (6)
      { code: "N01", title: "Orquestador Ejecutivo Frontal", category: "ejecutivo", status: "activo", description: "Coordina la distribución de intenciones entre las 37 neuronas y selecciona la ruta determinista óptima.", offsetSec: 8, latencyMs: 18, activationsToday: 142 },
      { code: "N02", title: "Planificador Jerárquico de Tareas", category: "ejecutivo", status: "activo", description: "Descompone objetivos complejos en subgrafos ejecutables de baja latencia.", offsetSec: 22, latencyMs: 24, activationsToday: 98 },
      { code: "N03", title: "Enrutador de Prioridad Cognitiva", category: "ejecutivo", status: "activo", description: "Asigna peso computacional según urgencia y contexto del usuario.", offsetSec: 35, latencyMs: 12, activationsToday: 134 },
      { code: "N04", title: "Arbitrador de Consenso Inter-Neuronal", category: "ejecutivo", status: "activo", description: "Resuelve discrepancias entre módulos de razonamiento y memoria.", offsetSec: 50, latencyMs: 29, activationsToday: 76 },
      { code: "N05", title: "Controlador de Atención Selectiva", category: "ejecutivo", status: "activo", description: "Filtra ruido contextual antes de invocar al modelo generativo.", offsetSec: 65, latencyMs: 15, activationsToday: 120 },
      { code: "N06", title: "Gestor de Estado de Sesión", category: "ejecutivo", status: "activo", description: "Mantiene la máquina de estados determinista de la conversación activa.", offsetSec: 14, latencyMs: 11, activationsToday: 142 },

      // Subsistema Seguridad y Frontera (6)
      { code: "N07", title: "Centinela de Contratos (dante-bridge)", category: "seguridad", status: "activo", description: "Inspecciona y valida cada payload entrante y saliente mediante esquemas estrictos z.safeParse().", offsetSec: 5, latencyMs: 4, activationsToday: 284 },
      { code: "N08", title: "Escudo Anti-Prompt Injection", category: "seguridad", status: "activo", description: "Detecta y neutraliza intentos de evasión de instrucciones del núcleo.", offsetSec: 19, latencyMs: 14, activationsToday: 142 },
      { code: "N09", title: "Sanitizador de Salida Determinista", category: "seguridad", status: "activo", description: "Garantiza que ningún secreto, token o traza interna cruce hacia el cliente.", offsetSec: 9, latencyMs: 6, activationsToday: 284 },
      { code: "N10", title: "Validador de Políticas Deny-by-Default", category: "seguridad", status: "activo", description: "Aplica control de acceso estricto antes de consultar memoria periférica.", offsetSec: 44, latencyMs: 9, activationsToday: 91 },
      { code: "N11", title: "Aislador de Contexto por Usuario", category: "seguridad", status: "activo", description: "Asegura particionamiento lógico entre sesiones y correlationIds.", offsetSec: 31, latencyMs: 7, activationsToday: 142 },
      { code: "N12", title: "Detector de Anomalías de Tráfico", category: "seguridad", status: "activo", description: "Monitorea ráfagas inusuales para proteger cuotas gratuitas.", offsetSec: 90, latencyMs: 10, activationsToday: 64 },

      // Subsistema Memoria (6)
      { code: "N13", title: "Memoria Episódica de Corto Plazo", category: "memoria", status: "activo", description: "Retiene la ventana inmediata de diálogo con compresión sin pérdida.", offsetSec: 12, latencyMs: 19, activationsToday: 142 },
      { code: "N14", title: "Memoria Semántica Vectorial", category: "memoria", status: "activo", description: "Indexa conceptos clave y relaciones de largo plazo del proyecto.", offsetSec: 75, latencyMs: 42, activationsToday: 53 },
      { code: "N15", title: "Consolidador de Resúmenes Contextuales", category: "memoria", status: "activo", description: "Compacta historiales extensos para ahorrar tokens de entrada.", offsetSec: 180, latencyMs: 55, activationsToday: 29 },
      { code: "N16", title: "Recuperador Híbrido Léxico-Denso", category: "memoria", status: "en_espera", description: "Cruza coincidencias exactas con similitud semántica en documentos ingeridos.", offsetSec: 420, latencyMs: 48, activationsToday: 18 },
      { code: "N17", title: "Caché Determinista de Respuestas", category: "memoria", status: "activo", description: "Evita llamadas redundantes ante consultas equivalentes ($0 Cost).", offsetSec: 40, latencyMs: 3, activationsToday: 87 },
      { code: "N18", title: "Sincronizador de Continuidad", category: "memoria", status: "activo", description: "Mantiene la coherencia con el estado arquitectónico del repositorio.", offsetSec: 110, latencyMs: 21, activationsToday: 44 },

      // Subsistema Razonamiento de Von Neumann (7)
      { code: "N19", title: "Verificador Lógico de Von Neumann", category: "razonamiento", status: "activo", description: "Evalúa la consistencia formal y ausencia de contradicciones antes de responder.", offsetSec: 16, latencyMs: 36, activationsToday: 138 },
      { code: "N20", title: "Motor de Inferencia Causal", category: "razonamiento", status: "activo", description: "Modela relaciones causa-efecto en diagnósticos de código y arquitectura.", offsetSec: 48, latencyMs: 44, activationsToday: 82 },
      { code: "N21", title: "Analizador de Restricciones Técnicas", category: "razonamiento", status: "activo", description: "Comprueba compatibilidad de tipos, dependencias y límites de plataforma.", offsetSec: 55, latencyMs: 31, activationsToday: 74 },
      { code: "N22", title: "Crítico Reflexivo Auto-Corrector", category: "razonamiento", status: "activo", description: "Audita borradores internos y corrige imprecisiones antes de emitirlos.", offsetSec: 28, latencyMs: 49, activationsToday: 95 },
      { code: "N23", title: "Sintetizador de Soluciones Mínimas", category: "razonamiento", status: "activo", description: "Prioriza cambios quirúrgicos y reversibles sobre reescrituras innecesarias.", offsetSec: 62, latencyMs: 27, activationsToday: 68 },
      { code: "N24", title: "Simulador de Casos Borde", category: "razonamiento", status: "en_espera", description: "Proyecta fallos de red, timeouts y entradas malformadas.", offsetSec: 310, latencyMs: 52, activationsToday: 24 },
      { code: "N25", title: " Abductor de Hipótesis Rápidas", category: "razonamiento", status: "activo", description: "Selecciona la hipótesis más probable con el menor costo de verificación.", offsetSec: 39, latencyMs: 23, activationsToday: 89 },

      // Subsistema Percepción e Ingestión (6)
      { code: "N26", title: "Ingestor Semántico Documental", category: "percepción", status: "activo", description: "Preprocesa y estructura documentos autorizados bajo validación estricta.", offsetSec: 95, latencyMs: 34, activationsToday: 31 },
      { code: "N27", title: "Analizador Sintáctico de Código (AST)", category: "percepción", status: "activo", description: "Extrae contratos, rutas e interfaces de archivos TypeScript.", offsetSec: 70, latencyMs: 28, activationsToday: 62 },
      { code: "N28", title: "Normalizador de Zona Horaria y Locale", category: "percepción", status: "activo", description: "Adapta marcas temporales y formatos regionales (America/Santiago · es-CL).", offsetSec: 11, latencyMs: 5, activationsToday: 142 },
      { code: "N29", title: "Detector de Intención Conversacional", category: "percepción", status: "activo", description: "Clasifica si el usuario solicita análisis, ejecución, auditoría o consulta.", offsetSec: 7, latencyMs: 13, activationsToday: 142 },
      { code: "N30", title: "Extractor de Entidades Técnicas", category: "percepción", status: "activo", description: "Identifica rutas, variables, esquemas y comandos mencionados en el prompt.", offsetSec: 18, latencyMs: 16, activationsToday: 129 },
      { code: "N31", title: "receptor de Eventos de Telemetría", category: "percepción", status: "en_espera", description: "Escucha señales de salud y latencia de los adaptadores externos.", offsetSec: 240, latencyMs: 19, activationsToday: 48 },

      // Subsistema Auditoría y Gobernanza (6)
      { code: "N32", title: "Gobernador de Cuotas ($0 Tier)", category: "auditoría", status: "activo", description: "Supervisa el consumo de tokens y llamadas para mantener costo $0.00.", offsetSec: 6, latencyMs: 8, activationsToday: 284 },
      { code: "N33", title: "Registrador de Trazabilidad (Correlation ID)", category: "auditoría", status: "activo", description: "Vincula cada solicitud HTTP con su identificador único de extremo a extremo.", offsetSec: 10, latencyMs: 5, activationsToday: 284 },
      { code: "N34", title: "Monitor de Latencia y SLA Interno", category: "auditoría", status: "activo", description: "Calcula tiempos de respuesta promedio y detecta degradación temprana.", offsetSec: 25, latencyMs: 9, activationsToday: 180 },
      { code: "N35", title: "Orquestador de Fallback Determinista", category: "auditoría", status: "activo", description: "Conmuta sin fricción al proveedor local seguro si la red externa falla.", offsetSec: 15, latencyMs: 7, activationsToday: 96 },
      { code: "N36", title: "Inspector de Integridad de Esquemas", category: "auditoría", status: "activo", description: "Verifica que las 8 rutas API mantengan paridad con src/contracts/dante.ts.", offsetSec: 33, latencyMs: 11, activationsToday: 112 },
      { code: "N37", title: "Custodio de Bitácora Inmutable", category: "auditoría", status: "activo", description: "Consolida eventos de info, advertencia y error sin filtrar datos sensibles.", offsetSec: 20, latencyMs: 10, activationsToday: 155 },
    ];

    const rawNeurons: DanteNeuronsResponse = specs.map((item) => ({
      id: `neuron-${item.code.toLowerCase()}`,
      name: `${item.code} · ${item.title.trim()}`,
      status: item.status,
      category: item.category,
      description: item.description,
      lastExecution: new Date(now - item.offsetSec * 1000).toISOString(),
      latencyMs: item.latencyMs,
      activationsToday: item.activationsToday,
    }));

    const parsed = DanteNeuronsResponseSchema.safeParse(rawNeurons);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getAnalytics(): DanteAnalytics {
    const rawAnalytics = {
      totalConversations: this.conversations.length,
      totalMessages: this.totalMessagesCount,
      averageLatencyMs: 38,
    };

    const parsed = DanteAnalyticsSchema.safeParse(rawAnalytics);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getConversations(): DanteConversationsResponse {
    const parsed = DanteConversationsResponseSchema.safeParse(this.conversations);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getLogs(): DanteLogsResponse {
    const now = Date.now();
    const rawLogs = {
      logs: [
        {
          id: "log-01",
          timestamp: new Date(now - 1000 * 10).toISOString(),
          level: "info" as const,
          module: "dante-bridge",
          message: "Frontera Zod activa. Todos los contratos de API validados mediante z.safeParse().",
        },
        {
          id: "log-02",
          timestamp: new Date(now - 1000 * 45).toISOString(),
          level: "info" as const,
          module: "security-auditor",
          message: "Verificación de cuotas completada: consumo en $0.00 (Free Tier protegido).",
        },
        {
          id: "log-03",
          timestamp: new Date(now - 1000 * 120).toISOString(),
          level: "warn" as const,
          module: "local-core",
          message: "Dante-AI-Core externo no detectado en localhost:3001; operando con adaptador determinista local.",
        },
        {
          id: "log-04",
          timestamp: new Date(now - 1000 * 300).toISOString(),
          level: "info" as const,
          module: "ui-designer",
          message: "Telemetría de interfaz sincronizada con el estado del puente.",
        },
      ],
    };

    const parsed = DanteLogsResponseSchema.safeParse(rawLogs);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getProviders(): DanteProvidersResponse {
    const parsed = DanteProvidersResponseSchema.safeParse(this.providers);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  addProvider(payload: unknown): DanteProvidersResponse {
    const parsedReq = DanteProviderCreateRequestSchema.safeParse(payload);
    if (!parsedReq.success) {
      throw new ValidationError(parsedReq.error.format());
    }

    const id = `${parsedReq.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    this.providers.push({
      id,
      name: parsedReq.data.name,
      category: parsedReq.data.category,
      is_active: true,
      usageToday: 0,
      dailyLimit: 1000,
      is_public: false,
      models: [],
    });

    return this.getProviders();
  }

  removeProvider(id: string): DanteProvidersResponse {
    if (!id || typeof id !== "string") {
      throw new ValidationError({ id: ["ID de proveedor requerido"] });
    }
    this.providers = this.providers.filter((p) => p.id !== id);
    return this.getProviders();
  }

  getConnections(coreOnline: boolean, latencyMs?: number, version?: string): DanteConnectionsResponse {
    const rawConnections: DanteConnectionsResponse = [
      {
        id: "dante-core",
        name: "Dante AI Core (Puente Cognitivo)",
        status: coreOnline
          ? latencyMs && latencyMs > 1500
            ? "unstable"
            : "online"
          : "online",
        details: coreOnline
          ? `v${version || "1.0.0"} · local-core (${latencyMs ?? 0}ms)`
          : "v1.0.0 · Adaptador determinista activo (Modo Seguro $0)",
      },
      {
        id: "dante-bridge-zod",
        name: "Dante Bridge (Frontera Zod v4)",
        status: "online",
        details: "Validación estricta z.safeParse() activa en 8 rutas",
      },
      {
        id: "neon-db",
        name: "Memoria Periférica (Supabase / PostgreSQL)",
        status: coreOnline ? "online" : "unstable",
        details: coreOnline
          ? "Conectado de forma segura a través del Core"
          : "Modo en memoria local (sin persistencia remota activa)",
      },
    ];

    const parsed = DanteConnectionsResponseSchema.safeParse(rawConnections);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getHealth(): DanteHealthResponse {
    const rawHealth = {
      status: "ok" as const,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    const parsed = DanteHealthResponseSchema.safeParse(rawHealth);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getIngestedDocuments(): DanteDocumentIngestionResponse {
    const parsed = DanteDocumentIngestionResponseSchema.safeParse(this.ingestedDocs);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  ingestDocument(payload: unknown): DanteDocumentIngestionResponse {
    const parsedReq = DanteDocumentIngestionRequestSchema.safeParse(payload);
    if (!parsedReq.success) {
      throw new ValidationError(parsedReq.error.format());
    }

    const { title, content, category } = parsedReq.data;
    const chunksCount = Math.max(1, Math.ceil(content.length / 500));

    this.ingestedDocs = [
      {
        id: `doc-${Date.now().toString(36)}`,
        title,
        category,
        chunksCount,
        charCount: content.length,
        ingestedAt: new Date().toISOString(),
        neuronHandler: "N26 · Ingestor Semántico Documental",
      },
      ...this.ingestedDocs,
    ];

    return this.getIngestedDocuments();
  }
  private readonly connectionToggles = new Map<string, boolean>();

  /** Estado sintetico de conexiones en modo mock (temporal, sin Core real). */
  getConnectionsStatus(): ConnectionsStatusResponse {
    const disabled: string[] = [];
    this.connectionToggles.forEach((enabled, id) => {
      if (!enabled) disabled.push(id);
    });
    return buildMockCoreConnections({ disabled });
  }

  /** Activa o desactiva un proveedor en modo mock. No toca credenciales. */
  toggleProviderConnection(providerId: string, enabled: boolean): ConnectionsStatusResponse {
    const status = this.getConnectionsStatus();
    const connection = status.connections.find((item) => item.id === `ai.${providerId}`);
    if (!connection || !connection.canToggle) {
      throw new ValidationError({ providerId: ['Proveedor no disponible'] });
    }
    this.connectionToggles.set(providerId, enabled);
    return this.getConnectionsStatus();
  }

  /** Solo conexiones activas y seguras para agentes. */
  getAvailableConnections(): AgentConnectionsResponse {
    const status = this.getConnectionsStatus();
    return {
      generatedAt: status.generatedAt,
      connections: status.connections
        .filter((connection) => connection.status === 'active')
        .map((connection) => ({
          id: connection.id,
          name: connection.name,
          type: connection.type,
          owner: connection.owner,
          status: 'active' as const,
        })),
    };
  }

}
