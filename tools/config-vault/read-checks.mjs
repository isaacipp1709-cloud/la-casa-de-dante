/**
 * Dante Config Vault · Comprobaciones de Solo Lectura en Memoria
 *
 * Ejecuta validaciones estrictamente de SOLO LECTURA y NO DESTRUCTIVAS
 * utilizando las credenciales residentes únicamente en memoria RAM.
 *
 * Principios:
 * - Cero escritura de secretos en disco (.env.local no se genera).
 * - Cero alteración de esquemas, tablas o datos en bases de datos.
 * - Cero consultas de contenido sensible (mensajes de chat o textos cifrados).
 * - Cero inferencia con coste en proveedores de IA (solo validación estática de adaptadores).
 * - Sanitización estricta de todos los mensajes de error para no filtrar credenciales.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sanitizeText(text, secrets = []) {
  if (typeof text !== 'string') return '';
  let sanitized = text;
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 4) {
      sanitized = sanitized.split(secret).join('••••••••');
    }
  }
  // Limpieza adicional de patrones comunes de cadenas de conexión
  sanitized = sanitized.replace(/:\/\/[^:]+:([^@]+)@/g, '://***:***@');
  return sanitized;
}

export const NEON_PG_SSL_CONFIG = { rejectUnauthorized: true };

/**
 * Genera la configuración de conexión segura con TLS estricto hacia Neon.
 * Requiere explícitamente TLS seguro con rejectUnauthorized en true.
 */
export function buildPgClientOptions(connectionString) {
  return {
    connectionString,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
  };
}

/**
 * Obtiene el cliente pg resolviendo dinámicamente el módulo disponible.
 */
async function getPgClient(connectionString) {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    // Buscar en node_modules locales o en proyectos hermanos si existen
    const candidatePaths = [
      path.resolve(__dirname, 'node_modules', 'pg', 'lib', 'index.js'),
      path.resolve(__dirname, '..', '..', 'node_modules', 'pg', 'lib', 'index.js'),
      path.resolve(__dirname, '..', '..', '..', 'Dante-AI-Core', 'node_modules', 'pg', 'lib', 'index.js'),
    ];
    let loaded = false;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          pg = await import(pathToFileURL(p).href);
          loaded = true;
          break;
        } catch {}
      }
    }
    if (!loaded) {
      throw new Error("Módulo 'pg' no instalado en este entorno. Instale dependencias con 'npm install' para ejecutar comprobaciones de Neon.");
    }
  }
  const Client = pg.default?.Client || pg.Client;
  return new Client(buildPgClientOptions(connectionString));
}

/**
 * Comprobación no destructiva de Neon PostgreSQL con inspección profunda de esquemas.
 */
export async function checkNeonReadOnly(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    return {
      status: 'SKIPPED',
      isOperativo: false,
      message: 'DATABASE_URL no configurada en la bóveda.',
    };
  }

  let client = null;
  const secrets = [connectionString];
  const match = connectionString.match(/:\/\/([^:]+):([^@]+)@/);
  if (match && match[2]) secrets.push(match[2]);

  // Identificación segura del destino (endpoint, pooling, base de datos; jamás exponer credenciales)
  let destination = {
    endpointId: 'desconocido',
    baseEndpointId: 'desconocido',
    isPooled: false,
    regionCloud: 'desconocida',
    databaseInUrl: 'desconocida',
    port: '5432',
    ssl: 'require',
  };
  try {
    const url = new URL(connectionString);
    const hostParts = url.hostname.split('.');
    const rawEndpoint = hostParts[0] || '';
    const isPooled = rawEndpoint.endsWith('-pooler');
    const baseEndpoint = isPooled ? rawEndpoint.slice(0, -7) : rawEndpoint;
    const regionCloud = hostParts.slice(1, -2).join('.');

    const EXPECTED_ENDPOINT_ID = 'ep-quiet-forest-b571toev';
    const EXPECTED_DATABASE = 'neondb';
    const matchesEndpoint = baseEndpoint.toLowerCase() === EXPECTED_ENDPOINT_ID.toLowerCase();
    const matchesDatabase = (url.pathname.replace(/^\//, '') || '').toLowerCase() === EXPECTED_DATABASE.toLowerCase();

    destination = {
      endpointId: rawEndpoint,
      baseEndpointId: baseEndpoint,
      isPooled,
      regionCloud,
      databaseInUrl: url.pathname.replace(/^\//, '') || 'desconocida',
      port: url.port || '5432',
      ssl: url.searchParams.get('sslmode') || 'require',
      verifiedMatch: {
        expectedEndpoint: EXPECTED_ENDPOINT_ID,
        expectedDatabase: EXPECTED_DATABASE,
        endpointMatches: matchesEndpoint,
        databaseMatches: matchesDatabase,
        isFullyConfirmed: matchesEndpoint && matchesDatabase,
      },
    };
  } catch {}

  try {
    client = await getPgClient(connectionString);
    await client.connect();

    // 1. SELECT 1 ping
    await client.query('SELECT 1 as ping');

    // 2. Base actual, esquema activo y search_path
    const metaRes = await client.query(`
      SELECT 
        current_database() as db_name, 
        current_schema() as schema_name, 
        current_setting('search_path') as search_path,
        version() as pg_version
    `);
    const dbName = metaRes.rows[0]?.db_name || 'desconocida';
    const schemaName = metaRes.rows[0]?.schema_name || 'public';
    const searchPath = metaRes.rows[0]?.search_path || 'desconocido';
    const versionSnippet = (metaRes.rows[0]?.pg_version || '').split(' ')[0] || 'PostgreSQL';

    // 3. Esquemas accesibles en la base de datos (excluyendo catálogos del sistema)
    const schemasRes = await client.query(`
      SELECT nspname 
      FROM pg_namespace 
      WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
      ORDER BY nspname
    `);
    const accessibleSchemas = schemasRes.rows.map((r) => r.nspname);

    // 4. Búsqueda exhaustiva de tablas en TODOS los esquemas accesibles
    const allTablesRes = await client.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND (
          table_name IN ('provider_settings', 'user_provider_credentials', 'conversations', 'messages')
          OR table_name ILIKE '%conversation%'
          OR table_name ILIKE '%message%'
        )
      ORDER BY table_schema, table_name
    `);

    // 5. Columnas de tablas existentes
    const columnsRes = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_name IN ('provider_settings', 'user_provider_credentials', 'conversations', 'messages')
      ORDER BY table_schema, table_name, ordinal_position
    `);

    // 6. Índices de tablas existentes
    const indexesRes = await client.query(`
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND tablename IN ('provider_settings', 'user_provider_credentials', 'conversations', 'messages')
      ORDER BY schemaname, tablename, indexname
    `);

    // 7. Inspección granular y sin ambigüedades por tabla
    // Distingue estrictamente: NO_EXISTE, NO_SE_PUDO_CONSULTAR, EXISTE_CON_0_FILAS, EXISTE_CON_FILAS
    const targetTables = ['provider_settings', 'user_provider_credentials', 'conversations', 'messages'];
    const tablesReport = {};

    for (const tableName of targetTables) {
      const matchInSchema = allTablesRes.rows.find((t) => t.table_name === tableName);
      if (!matchInSchema) {
        tablesReport[tableName] = {
          exists: false,
          state: 'NO_EXISTE',
          rowCount: null,
          schema: null,
          columns: [],
          indexes: [],
          message: 'La tabla NO EXISTE en ningún esquema accesible.',
        };
        continue;
      }

      const tableSchema = matchInSchema.table_schema;
      const cols = columnsRes.rows
        .filter((c) => c.table_schema === tableSchema && c.table_name === tableName)
        .map((c) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          default: c.column_default,
        }));
      const idxs = indexesRes.rows
        .filter((i) => i.schemaname === tableSchema && i.tablename === tableName)
        .map((i) => ({
          name: i.indexname,
          definition: sanitizeText(i.indexdef, secrets),
        }));

      // Conteo seguro no destructivo
      let rowCount = null;
      let state = 'NO_SE_PUDO_CONSULTAR';
      let countError = null;

      try {
        if (!/^[a-zA-Z0-9_]+$/.test(tableSchema) || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
          throw new Error('Identificador inválido');
        }
        const cntRes = await client.query(`SELECT count(*)::int as total FROM "${tableSchema}"."${tableName}"`);
        rowCount = cntRes.rows[0]?.total ?? 0;
        state = rowCount === 0 ? 'EXISTE_CON_0_FILAS' : 'EXISTE_CON_FILAS';
      } catch (err) {
        countError = sanitizeText(err.message, secrets);
      }

      tablesReport[tableName] = {
        exists: true,
        state,
        rowCount,
        schema: tableSchema,
        columns: cols,
        indexes: idxs,
        message:
          state === 'EXISTE_CON_0_FILAS'
            ? `Tabla presente en '${tableSchema}', actualmente vacía (0 filas).`
            : state === 'EXISTE_CON_FILAS'
            ? `Tabla presente en '${tableSchema}' con ${rowCount} filas.`
            : `Error de consulta: ${countError}`,
      };
    }

    // 8. Verificación específica de conversaciones y columna owner_id
    const convInfo = tablesReport.conversations;
    let ownerIdColumnDetail = null;
    let hasOwnerIndex = false;

    if (convInfo.exists) {
      const ownerCol = convInfo.columns.find((c) => c.name === 'owner_id');
      if (ownerCol) {
        ownerIdColumnDetail = {
          exists: true,
          type: ownerCol.type,
          nullable: ownerCol.nullable,
        };
      } else {
        ownerIdColumnDetail = {
          exists: false,
          message: 'Columna owner_id NO existe en la tabla conversations.',
        };
      }
      hasOwnerIndex = convInfo.indexes.some((i) => i.name === 'conversations_owner_idx');
    }

    // 9. Evaluación de Bloqueo del Sistema (NO clasificar como operativo si falta esquema)
    let systemStatus = 'OK';
    let blockingMessage = null;

    if (!tablesReport.conversations.exists) {
      systemStatus = 'BLOQUEO_ESQUEMA_CONVERSACIONES_AUSENTE';
      blockingMessage =
        'Falta el esquema de conversaciones: la tabla "conversations" NO EXISTE en Neon. Persistencia bloqueada si se activa USE_DATABASE=true.';
    } else if (!tablesReport.messages.exists) {
      systemStatus = 'BLOQUEO_ESQUEMA_MENSAJES_AUSENTE';
      blockingMessage =
        'Falta la tabla "messages" en Neon: las conversaciones no podrán guardar mensajes.';
    } else if (!ownerIdColumnDetail?.exists) {
      systemStatus = 'BLOQUEO_MIGRACION_0003_PENDIENTE';
      blockingMessage =
        'Falta la columna "owner_id" en conversations: la migración 0003_add_conversation_owner.sql está pendiente.';
    }

    return {
      status: systemStatus,
      isOperativo: systemStatus === 'OK',
      blockingMessage,
      destination,
      database: dbName,
      schema: schemaName,
      searchPath,
      engine: versionSnippet,
      accessibleSchemas,
      tables: tablesReport,
      conversationsSchema: {
        tableExists: convInfo.exists,
        ownerIdColumn: ownerIdColumnDetail,
        hasOwnerIndex,
      },
      matchesAcrossAllSchemas: allTablesRes.rows.map((r) => `${r.table_schema}.${r.table_name}`),
    };
  } catch (err) {
    return {
      status: 'ERROR',
      isOperativo: false,
      destination,
      error: sanitizeText(err.message, secrets),
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {}
    }
  }
}

/**
 * Comprobación no invasiva de Supabase Auth.
 */
export async function checkSupabaseReadOnly(url, anonKey) {
  if (!url || !anonKey) {
    return {
      status: 'SKIPPED',
      message: 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    };
  }

  const cleanUrl = url.trim().replace(/\/+$/, '');
  const secrets = [anonKey];

  try {
    // Consulta al endpoint público de configuración de auth en Supabase
    const response = await fetch(`${cleanUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const githubEnabled = Boolean(data.external?.github);
      return {
        status: 'OK',
        endpointReachable: true,
        projectUrl: cleanUrl,
        githubAuthEnabled: githubEnabled,
        authService: 'Supabase GoTrue Active',
      };
    }

    // Si settings está restringido, probamos health
    const healthRes = await fetch(`${cleanUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(3000),
    });

    return {
      status: healthRes.ok ? 'OK' : 'WARNING',
      endpointReachable: healthRes.ok,
      httpStatus: response.status,
      projectUrl: cleanUrl,
      message: healthRes.ok ? 'Servicio Supabase Auth respondiendo (health OK).' : `Respuesta HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      status: 'ERROR',
      error: sanitizeText(err.message, secrets),
    };
  }
}

/**
 * Comprobación de rutas de salud públicas (Core y Casa).
 */
export async function checkServicesHealth(coreUrl) {
  const targetCore = coreUrl || 'http://localhost:3001';
  const casaProdUrl = 'https://la-casa-de-dante.vercel.app';

  const results = {
    coreLocal: { url: targetCore, reachable: false, status: null, data: null },
    casaProduction: { url: casaProdUrl, reachable: false, status: null, data: null },
  };

  // 1. Core Health
  try {
    const res = await fetch(`${targetCore.replace(/\/+$/, '')}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    results.coreLocal.reachable = res.ok;
    results.coreLocal.status = res.status;
    if (res.ok) {
      results.coreLocal.data = await res.json().catch(() => null);
    }
  } catch (err) {
    results.coreLocal.error = err.message;
  }

  // 2. Casa Producción Health
  try {
    const res = await fetch(`${casaProdUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    results.casaProduction.reachable = res.ok;
    results.casaProduction.status = res.status;
    if (res.ok) {
      results.casaProduction.data = await res.json().catch(() => null);
    }
  } catch (err) {
    results.casaProduction.error = err.message;
  }

  return results;
}

/**
 * Análisis estático de adaptadores de proveedores (sin inferencia ni costes).
 * No muestra fragmentos de claves: estrictamente PRESENTE / AUSENTE.
 */
export function analyzeProvidersCatalog(values = {}) {
  const hasGeminiKey = Boolean(values.GOOGLE_AI_API_KEY && values.GOOGLE_AI_API_KEY.trim().length > 0);
  const hasHfKey = Boolean(values.HUGGING_FACE_API_KEY && values.HUGGING_FACE_API_KEY.trim().length > 0);
  const hasOllamaUrl = Boolean(values.OLLAMA_BASE_URL && values.OLLAMA_BASE_URL.trim().length > 0);
  const hasGroqKey = Boolean(values.GROQ_API_KEY && values.GROQ_API_KEY.trim().length > 0);

  return [
    {
      providerId: 'gemini',
      name: 'Google Gemini',
      keyConfigured: hasGeminiKey,
      keyState: hasGeminiKey ? 'PRESENTE' : 'AUSENTE',
      activeModel: values.DEFAULT_GEMINI_MODEL || 'gemini-2.0-flash',
      coreAdapterStatus: 'IMPLEMENTADO (byok-executor + GeminiProvider)',
      casaAdapterStatus: 'IMPLEMENTADO (chatWithGemini + defaultProviderAdapters)',
      status: hasGeminiKey ? 'CLAVE_CONFIGURADA (Inferencia no probada / sin coste)' : 'PENDIENTE_CLAVE',
      nextAction: hasGeminiKey
        ? 'Inferencia pendiente para la primera prueba de chat controlada'
        : 'Ingresar clave en la bóveda',
    },
    {
      providerId: 'huggingface',
      name: 'Hugging Face',
      keyConfigured: hasHfKey,
      keyState: hasHfKey ? 'PRESENTE' : 'AUSENTE',
      coreAdapterStatus: 'PARCIAL (Servidor por variable estática)',
      casaAdapterStatus: 'CATÁLOGO VISUAL (adapterReady: false en BYOK)',
      status: 'ADAPTADOR_BYOK_PENDIENTE',
      nextAction: 'Implementar cliente BYOK en Casa',
    },
    {
      providerId: 'ollama',
      name: 'Ollama (Local $0)',
      keyConfigured: hasOllamaUrl,
      keyState: hasOllamaUrl ? 'PRESENTE' : 'AUSENTE',
      coreAdapterStatus: 'PARCIAL (Conexión local)',
      casaAdapterStatus: 'CATÁLOGO VISUAL (adapterReady: false en BYOK)',
      status: 'ADAPTADOR_BYOK_PENDIENTE',
      nextAction: 'Implementar cliente BYOK en Casa',
    },
    {
      providerId: 'groq',
      name: 'Groq (Llama)',
      keyConfigured: hasGroqKey,
      keyState: hasGroqKey ? 'PRESENTE' : 'AUSENTE',
      coreAdapterStatus: 'NO IMPLEMENTADO',
      casaAdapterStatus: 'CATÁLOGO VISUAL (adapterReady: false)',
      status: 'ADAPTADOR_NO_IMPLEMENTADO',
      nextAction: 'Implementar ejecutor en Core y adaptador en Casa',
    },
    {
      providerId: 'openrouter',
      name: 'OpenRouter',
      keyConfigured: false,
      keyState: 'AUSENTE',
      coreAdapterStatus: 'NO IMPLEMENTADO',
      casaAdapterStatus: 'NO IMPLEMENTADO',
      status: 'PENDIENTE_DESARROLLO (Objetivo multiproveedor)',
      nextAction: 'Desarrollar contrato y adaptador',
    },
    {
      providerId: 'nvidia',
      name: 'NVIDIA NIM / Inception',
      keyConfigured: false,
      keyState: 'AUSENTE',
      coreAdapterStatus: 'NO IMPLEMENTADO',
      casaAdapterStatus: 'NO IMPLEMENTADO',
      status: 'PENDIENTE_DESARROLLO (Objetivo multiproveedor)',
      nextAction: 'Desarrollar contrato y adaptador',
    },
  ];
}

/**
 * Ejecutor maestro de comprobaciones no destructivas en memoria.
 */
export async function executeAllReadOnlyChecks(values = {}) {
  const [neon, supabase, services] = await Promise.all([
    checkNeonReadOnly(values.DATABASE_URL),
    checkSupabaseReadOnly(values.NEXT_PUBLIC_SUPABASE_URL, values.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    checkServicesHealth(values.DANTE_CORE_URL),
  ]);

  const providers = analyzeProvidersCatalog(values);

  return {
    timestamp: new Date().toISOString(),
    neon,
    supabase,
    services,
    providers,
  };
}
