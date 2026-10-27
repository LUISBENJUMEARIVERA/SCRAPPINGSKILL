export interface PrincipalLinkItem {
  id: string;
  title: string;
  url: string;
  domain_category: string;
  information_type:
    | 'TRANSACCIONAL_PROCESOS'
    | 'DATOS_ABIERTOS_SODA'
    | 'CONTRATOS_ELECTRONICOS'
    | 'TIENDA_VIRTUAL_TVEC'
    | 'DOCUMENTOS_TIPO_NORMATIVA'
    | 'PLAN_ANUAL_PAA'
    | 'ESTANDAR_OCDS_API';
  extraction_technique: string;
  update_frequency: string;
  rag_utility_score: number;
  key_fields_offered: string[];
  description: string;
  requires_viewstate_session: boolean;
}

export interface InformationCategorySummary {
  code: string;
  name: string;
  subtitle: string;
  record_volume_estimate: string;
  primary_format: string;
  extraction_strategy: string;
  description: string;
  sample_fields: string[];
  links: PrincipalLinkItem[];
}

export interface DiscoveredLinkNode {
  url: string;
  anchor_text: string;
  category:
    | 'EXPEDIENTE_PROCESO'
    | 'PLIEGO_ANEXO_DOC'
    | 'DATOS_ABIERTOS_API'
    | 'NORMATIVA_MANUAL'
    | 'PORTAL_TRANSACCIONAL'
    | 'ENLACE_EXTERNO';
  depth: number;
  is_internal: boolean;
  file_extension?: string | null;
  rag_relevance: 'ALTA' | 'MEDIA' | 'BAJA';
}

export interface SpiderCrawlResponse {
  seed_url: string;
  resolved_url: string;
  http_status: number;
  latency_ms: number;
  page_title: string;
  server_header: string;
  content_type: string;
  aspnet_viewstate_detected: boolean;
  viewstate_token_preview?: string | null;
  meta_description: string;
  total_links_discovered: number;
  category_breakdown: Record<string, number>;
  discovered_links: DiscoveredLinkNode[];
  extracted_headings: string[];
  crawled_at: string;
  execution_mode: 'LIVE_HTTP_SPIDER' | 'RESILIENT_CACHE_FALLBACK';
}

export interface SecopFilterParams {
  dataset: 'procesos' | 'contratos';
  keyword?: string;
  entidad?: string;
  nit_entidad?: string;
  departamento?: string;
  ciudad?: string;
  modalidad?: string;
  estado?: string;
  cuantia_min?: number;
  cuantia_max?: number;
  unspsc_code?: string;
  limit: number;
  offset: number;
  spider_enrich_top_n: number;
}

export interface SecopProcessRecord {
  process_id: string;
  reference: string;
  entity_name: string;
  entity_nit: string;
  department: string;
  city: string;
  entity_order: string;
  title: string;
  description: string;
  phase: string;
  status: string;
  modality: string;
  contract_type: string;
  base_price_cop: number;
  publication_date: string;
  closing_date: string;
  unspsc_code: string;
  process_url: string;
  provider_awarded?: string | null;
  provider_nit?: string | null;
  spider_metadata?: Record<string, unknown> | null;
}

export interface SecopSearchResponse {
  dataset: string;
  total_returned: number;
  execution_time_ms: number;
  data_source: 'LIVE_DATOS_GOV_CO_SODA' | 'HYBRID_CACHE_FALLBACK';
  soql_query_executed: string;
  applied_filters: Record<string, unknown>;
  summary_metrics: {
    total_budget_cop: number;
    average_budget_cop: number;
    unique_entities: number;
    by_modality: Record<string, number>;
    by_department: Record<string, number>;
    by_status: Record<string, number>;
  };
  records: SecopProcessRecord[];
}

export interface RAGChunkItem {
  chunk_id: string;
  doc_id: string;
  chunk_index: number;
  text: string;
  markdown_body: string;
  token_estimate: number;
  char_count: number;
  content_hash: string;
  embedding_model_hint: string;
  metadata: {
    source: string;
    dataset: string;
    process_id: string;
    reference: string;
    entity_name: string;
    entity_nit: string;
    department: string;
    city: string;
    modality: string;
    status: string;
    contract_type: string;
    base_price_cop: number;
    publication_date: string;
    closing_date: string;
    unspsc_code: string;
    process_url: string;
  };
}

export interface RAGPipelineResponse {
  pipeline_id: string;
  generated_at: string;
  total_processes: number;
  total_chunks: number;
  total_estimated_tokens: number;
  chunk_strategy: string;
  applied_filters: Record<string, unknown>;
  chunks: RAGChunkItem[];
}

export interface CustomAPIFeedSpec {
  feed_id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  filters: SecopFilterParams;
  chunk_size_chars: number;
  include_spider_links: boolean;
  endpoints: {
    rag_json_endpoint: string;
    jsonl_stream_endpoint: string;
    raw_records_endpoint: string;
    openapi_schema_endpoint: string;
  };
  integration_snippets: {
    langchain_python: string;
    llamaindex_python: string;
    curl_cli: string;
  };
}
