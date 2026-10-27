from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class PrincipalLinkItem(BaseModel):
    id: str
    title: str
    url: str
    domain_category: str
    information_type: Literal[
        "TRANSACCIONAL_PROCESOS",
        "DATOS_ABIERTOS_SODA",
        "CONTRATOS_ELECTRONICOS",
        "TIENDA_VIRTUAL_TVEC",
        "DOCUMENTOS_TIPO_NORMATIVA",
        "PLAN_ANUAL_PAA",
        "ESTANDAR_OCDS_API",
    ]
    extraction_technique: str
    update_frequency: str
    rag_utility_score: int = Field(ge=1, le=100)
    key_fields_offered: list[str]
    description: str
    requires_viewstate_session: bool = False


class InformationCategorySummary(BaseModel):
    code: str
    name: str
    subtitle: str
    record_volume_estimate: str
    primary_format: str
    extraction_strategy: str
    description: str
    sample_fields: list[str]
    links: list[PrincipalLinkItem]


class DiscoveredLinkNode(BaseModel):
    url: str
    anchor_text: str
    category: Literal[
        "EXPEDIENTE_PROCESO",
        "PLIEGO_ANEXO_DOC",
        "DATOS_ABIERTOS_API",
        "NORMATIVA_MANUAL",
        "PORTAL_TRANSACCIONAL",
        "ENLACE_EXTERNO",
    ]
    depth: int
    is_internal: bool
    file_extension: str | None = None
    rag_relevance: Literal["ALTA", "MEDIA", "BAJA"]


class SpiderCrawlRequest(BaseModel):
    seed_url: str = Field(
        default="https://www.colombiacompra.gov.co/secop-ii",
        description="URL semilla del ecosistema SECOP II o Colombia Compra Eficiente",
    )
    max_links: int = Field(default=40, ge=5, le=150)
    follow_internal_depth: int = Field(default=1, ge=1, le=2)
    category_filter: str | None = None


class SpiderCrawlResponse(BaseModel):
    seed_url: str
    resolved_url: str
    http_status: int
    latency_ms: float
    page_title: str
    server_header: str
    content_type: str
    aspnet_viewstate_detected: bool
    viewstate_token_preview: str | None = None
    meta_description: str
    total_links_discovered: int
    category_breakdown: dict[str, int]
    discovered_links: list[DiscoveredLinkNode]
    extracted_headings: list[str]
    crawled_at: str
    execution_mode: Literal["LIVE_HTTP_SPIDER", "RESILIENT_CACHE_FALLBACK"]


class SecopFilterParams(BaseModel):
    dataset: Literal["procesos", "contratos"] = "procesos"
    keyword: str | None = None
    entidad: str | None = None
    nit_entidad: str | None = None
    departamento: str | None = None
    ciudad: str | None = None
    modalidad: str | None = None
    estado: str | None = None
    cuantia_min: float | None = None
    cuantia_max: float | None = None
    unspsc_code: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    spider_enrich_top_n: int = Field(default=0, ge=0, le=5)


class SecopProcessRecord(BaseModel):
    process_id: str
    reference: str
    entity_name: str
    entity_nit: str
    department: str
    city: str
    entity_order: str
    title: str
    description: str
    phase: str
    status: str
    modality: str
    contract_type: str
    base_price_cop: float
    publication_date: str
    closing_date: str
    unspsc_code: str
    process_url: str
    provider_awarded: str | None = None
    provider_nit: str | None = None
    spider_metadata: dict[str, Any] | None = None


class SecopSearchResponse(BaseModel):
    dataset: str
    total_returned: int
    execution_time_ms: float
    data_source: Literal["LIVE_DATOS_GOV_CO_SODA", "HYBRID_CACHE_FALLBACK"]
    soql_query_executed: str
    applied_filters: dict[str, Any]
    summary_metrics: dict[str, Any]
    records: list[SecopProcessRecord]


class RAGChunkMetadata(BaseModel):
    source: str
    dataset: str
    process_id: str
    reference: str
    entity_name: str
    entity_nit: str
    department: str
    city: str
    modality: str
    status: str
    contract_type: str
    base_price_cop: float
    publication_date: str
    closing_date: str
    unspsc_code: str
    process_url: str


class RAGChunkItem(BaseModel):
    chunk_id: str
    doc_id: str
    chunk_index: int
    text: str
    markdown_body: str
    token_estimate: int
    char_count: int
    content_hash: str
    embedding_model_hint: str = "text-embedding-3-large / bge-m3"
    metadata: RAGChunkMetadata


class RAGPipelineResponse(BaseModel):
    pipeline_id: str
    generated_at: str
    total_processes: int
    total_chunks: int
    total_estimated_tokens: int
    chunk_strategy: str
    applied_filters: dict[str, Any]
    chunks: list[RAGChunkItem]


class CustomAPIFeedCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=80)
    slug: str | None = None
    description: str = Field(default="Feed dinámico de SECOP II listo para ingesta RAG")
    filters: SecopFilterParams
    chunk_size_chars: int = Field(default=1400, ge=400, le=4000)
    include_spider_links: bool = True


class CustomAPIFeedSpec(BaseModel):
    feed_id: str
    name: str
    slug: str
    description: str
    created_at: str
    filters: SecopFilterParams
    chunk_size_chars: int
    include_spider_links: bool
    endpoints: dict[str, str]
    integration_snippets: dict[str, str]
