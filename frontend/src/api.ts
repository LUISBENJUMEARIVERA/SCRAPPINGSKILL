import type {
  CustomAPIFeedSpec,
  InformationCategorySummary,
  RAGPipelineResponse,
  SecopFilterParams,
  SecopSearchResponse,
  SpiderCrawlResponse,
} from './types';

const API_BASE = '/api/v1';

export async function fetchTaxonomy(): Promise<InformationCategorySummary[]> {
  const res = await fetch(`${API_BASE}/taxonomy`);
  if (!res.ok) {
    throw new Error(`Error al consultar el catálogo taxonómico SECOP II (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function searchSecopProcesses(
  filters: SecopFilterParams
): Promise<SecopSearchResponse> {
  const res = await fetch(`${API_BASE}/secop/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!res.ok) {
    throw new Error(`Error al ejecutar la consulta híbrida en SECOP II (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function runSpiderCrawl(params: {
  seed_url: string;
  max_links: number;
  follow_internal_depth: number;
  category_filter?: string;
}): Promise<SpiderCrawlResponse> {
  const res = await fetch(`${API_BASE}/spider/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Fallo en la ejecución del Spider Web sobre ${params.seed_url} (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function inspectSingleOpportunity(
  url: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/spider/inspect?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    throw new Error(`No se pudo inspeccionar el expediente (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function generateRagChunks(
  filters: SecopFilterParams,
  chunkSizeChars = 1400
): Promise<RAGPipelineResponse> {
  const res = await fetch(
    `${API_BASE}/rag/chunks?chunk_size_chars=${chunkSizeChars}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    }
  );
  if (!res.ok) {
    throw new Error(`Error al sintetizar chunks para RAG (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function fetchCustomFeeds(): Promise<CustomAPIFeedSpec[]> {
  const res = await fetch(`${API_BASE}/feeds`);
  if (!res.ok) {
    throw new Error(`No se pudieron cargar los endpoints dinámicos RAG (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function createCustomFeed(payload: {
  name: string;
  slug?: string;
  description: string;
  filters: SecopFilterParams;
  chunk_size_chars: number;
  include_spider_links: boolean;
}): Promise<CustomAPIFeedSpec> {
  const res = await fetch(`${API_BASE}/feeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`No se pudo publicar el nuevo endpoint API para RAG (HTTP ${res.status}).`);
  }
  return res.json();
}
