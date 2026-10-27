from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import re
from typing import Any
import uuid

from .models import (
    CustomAPIFeedCreateRequest,
    CustomAPIFeedSpec,
    RAGChunkItem,
    RAGChunkMetadata,
    RAGPipelineResponse,
    SecopFilterParams,
    SecopProcessRecord,
)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return slug or f"secop2-feed-{uuid.uuid4().hex[:6]}"


def record_to_rag_chunks(
    record: SecopProcessRecord,
    dataset: str = "procesos",
    chunk_size_chars: int = 1400,
) -> list[RAGChunkItem]:
    header_context = (
        f"# [SECOP II] {record.process_id} — {record.entity_name}\n"
        f"- **Referencia:** {record.reference} | **Orden:** {record.entity_order}\n"
        f"- **Entidad Estatal:** {record.entity_name} (NIT: {record.entity_nit})\n"
        f"- **Ubicación:** {record.department} — {record.city}\n"
        f"- **Modalidad:** {record.modality} | **Tipo de Contrato:** {record.contract_type}\n"
        f"- **Estado Actual:** {record.status} (Fase: {record.phase})\n"
        f"- **Cuantía / Presupuesto Oficial:** ${record.base_price_cop:,.0f} COP\n"
        f"- **Código UNSPSC:** {record.unspsc_code}\n"
        f"- **Fecha Publicación:** {record.publication_date} | **Fecha Cierre / Fin:** {record.closing_date}\n"
    )
    if record.provider_awarded:
        header_context += (
            f"- **Proveedor Adjudicado:** {record.provider_awarded} "
            f"(NIT/Doc: {record.provider_nit or 'N/A'})\n"
        )

    body_text = (
        f"## Título del Proceso\n{record.title}\n\n"
        f"## Objeto Contractual y Alcance Técnico\n{record.description}\n\n"
        f"## Enlace Oficial al Expediente Electrónico\n{record.process_url}\n"
    )

    if record.spider_metadata:
        body_text += (
            f"\n## Telemetría Spider del Expediente\n"
            f"- Inspeccionado en vivo: {record.spider_metadata.get('inspected')}\n"
            f"- Tablas DOM detectadas: {record.spider_metadata.get('dom_tables_detected', 0)}\n"
            f"- Estado ViewState ASP.NET: {record.spider_metadata.get('aspnet_viewstate_present', False)}\n"
        )

    # Split body if very long while preserving the header context in every chunk
    max_body = max(300, chunk_size_chars - len(header_context))
    body_segments = [
        body_text[i : i + max_body] for i in range(0, len(body_text), max_body)
    ] or [body_text]

    chunks: list[RAGChunkItem] = []
    meta = RAGChunkMetadata(
        source="secop2_hybrid_scraper_rag",
        dataset=dataset,
        process_id=record.process_id,
        reference=record.reference,
        entity_name=record.entity_name,
        entity_nit=record.entity_nit,
        department=record.department,
        city=record.city,
        modality=record.modality,
        status=record.status,
        contract_type=record.contract_type,
        base_price_cop=record.base_price_cop,
        publication_date=record.publication_date,
        closing_date=record.closing_date,
        unspsc_code=record.unspsc_code,
        process_url=record.process_url,
    )

    for idx, segment in enumerate(body_segments):
        full_markdown = f"{header_context}\n{segment}".strip()
        content_hash = hashlib.sha256(full_markdown.encode("utf-8")).hexdigest()[:16]
        token_est = max(1, len(full_markdown) // 4)
        chunks.append(
            RAGChunkItem(
                chunk_id=f"secop2_{record.process_id}_{idx:02d}",
                doc_id=record.process_id,
                chunk_index=idx,
                text=full_markdown,
                markdown_body=segment.strip(),
                token_estimate=token_est,
                char_count=len(full_markdown),
                content_hash=content_hash,
                metadata=meta,
            )
        )
    return chunks


def build_rag_pipeline_from_records(
    records: list[SecopProcessRecord],
    filters: SecopFilterParams,
    chunk_size_chars: int = 1400,
) -> RAGPipelineResponse:
    all_chunks: list[RAGChunkItem] = []
    for rec in records:
        all_chunks.extend(
            record_to_rag_chunks(rec, dataset=filters.dataset, chunk_size_chars=chunk_size_chars)
        )

    total_tokens = sum(c.token_estimate for c in all_chunks)
    applied = {
        k: v
        for k, v in filters.model_dump().items()
        if v is not None and v != ""
    }
    return RAGPipelineResponse(
        pipeline_id=f"rag_pipe_{uuid.uuid4().hex[:8]}",
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_processes=len(records),
        total_chunks=len(all_chunks),
        total_estimated_tokens=total_tokens,
        chunk_strategy="Context-Anchored Institutional Markdown (Header + Semantic Body + Vector Metadata)",
        applied_filters=applied,
        chunks=all_chunks,
    )


def build_integration_snippets(slug: str, base_url: str = "http://localhost:8010") -> dict[str, str]:
    rag_url = f"{base_url}/api/v1/feeds/{slug}/rag"
    jsonl_url = f"{base_url}/api/v1/feeds/{slug}/jsonl"
    openapi_url = f"{base_url}/api/v1/feeds/{slug}/openapi.json"

    langchain_snippet = f'''# Conector directo SECOP II -> LangChain + Qdrant / ChromaDB
import requests
from langchain_core.documents import Document

response = requests.get("{rag_url}", timeout=30)
payload = response.json()

lc_documents = [
    Document(
        page_content=chunk["text"],
        metadata=chunk["metadata"],
        id=chunk["chunk_id"]
    )
    for chunk in payload["chunks"]
]
print(f"Cargados {{len(lc_documents)}} chunks listos para Vector Store ({slug})")
'''

    llamaindex_snippet = f'''# Conector directo SECOP II -> LlamaIndex TextNodes
import requests
from llama_index.core.schema import TextNode

payload = requests.get("{rag_url}", timeout=30).json()
nodes = [
    TextNode(
        id_=c["chunk_id"],
        text=c["text"],
        metadata=c["metadata"],
    )
    for c in payload["chunks"]
]
'''

    curl_snippet = f'''# Consulta REST de Chunks JSON o descarga masiva JSONL para RAG
curl -s "{rag_url}" | jq .
curl -s "{jsonl_url}" -o "{slug}.jsonl"
curl -s "{openapi_url}" -o "{slug}-openapi.json"'''

    return {
        "langchain_python": langchain_snippet,
        "llamaindex_python": llamaindex_snippet,
        "curl_cli": curl_snippet,
    }


CUSTOM_FEEDS_REGISTRY: dict[str, CustomAPIFeedSpec] = {}


def register_custom_feed(
    req: CustomAPIFeedCreateRequest,
    base_url: str = "http://localhost:8010",
) -> CustomAPIFeedSpec:
    slug = _slugify(req.slug or req.name)
    feed_id = f"feed_{uuid.uuid4().hex[:8]}"
    endpoints = {
        "rag_json_endpoint": f"{base_url}/api/v1/feeds/{slug}/rag",
        "jsonl_stream_endpoint": f"{base_url}/api/v1/feeds/{slug}/jsonl",
        "raw_records_endpoint": f"{base_url}/api/v1/feeds/{slug}/records",
        "openapi_schema_endpoint": f"{base_url}/api/v1/feeds/{slug}/openapi.json",
    }
    spec = CustomAPIFeedSpec(
        feed_id=feed_id,
        name=req.name,
        slug=slug,
        description=req.description,
        created_at=datetime.now(timezone.utc).isoformat(),
        filters=req.filters,
        chunk_size_chars=req.chunk_size_chars,
        include_spider_links=req.include_spider_links,
        endpoints=endpoints,
        integration_snippets=build_integration_snippets(slug, base_url=base_url),
    )
    CUSTOM_FEEDS_REGISTRY[slug] = spec
    return spec


def seed_default_feeds() -> None:
    if CUSTOM_FEEDS_REGISTRY:
        return
    register_custom_feed(
        CustomAPIFeedCreateRequest(
            name="Licitaciones de Software, Nube e IA en Colombia",
            slug="licitaciones-software-ia-colombia",
            description=(
                "Endpoint preconfigurado para sistemas RAG de empresas de tecnología: "
                "extrae procesos activos de software, nube e inteligencia artificial en SECOP II."
            ),
            filters=SecopFilterParams(
                dataset="procesos",
                keyword="software",
                limit=15,
            ),
            chunk_size_chars=1400,
        )
    )
    register_custom_feed(
        CustomAPIFeedCreateRequest(
            name="Contratos de Infraestructura e Interventoría Vial",
            slug="contratos-infraestructura-vial",
            description=(
                "Feed RAG especializado en contratos y procesos de obra pública e interventoría "
                "bajo Documentos Tipo en Colombia."
            ),
            filters=SecopFilterParams(
                dataset="procesos",
                keyword="vial",
                limit=15,
            ),
            chunk_size_chars=1400,
        )
    )


def generate_feed_openapi_schema(feed: CustomAPIFeedSpec) -> dict[str, Any]:
    return {
        "openapi": "3.1.0",
        "info": {
            "title": f"SECOP II RAG Data API — {feed.name}",
            "version": "1.0.0",
            "description": feed.description,
        },
        "paths": {
            f"/api/v1/feeds/{feed.slug}/rag": {
                "get": {
                    "operationId": f"get_{feed.slug.replace('-', '_')}_rag_chunks",
                    "summary": f"Obtiene chunks semánticos con metadatos de SECOP II para '{feed.name}'",
                    "responses": {
                        "200": {
                            "description": "Lista de chunks RAG con contexto institucional inyectado",
                        }
                    },
                }
            },
            f"/api/v1/feeds/{feed.slug}/jsonl": {
                "get": {
                    "operationId": f"get_{feed.slug.replace('-', '_')}_jsonl",
                    "summary": "Descarga stream JSONL listo para ingesta en Qdrant, Chroma o pgvector",
                    "responses": {
                        "200": {
                            "description": "Stream JSON Lines (application/x-ndjson)",
                        }
                    },
                }
            },
        },
    }
