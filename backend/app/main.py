from __future__ import annotations

import json
from typing import Any, Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .models import (
    CustomAPIFeedCreateRequest,
    CustomAPIFeedSpec,
    InformationCategorySummary,
    RAGPipelineResponse,
    SecopFilterParams,
    SecopSearchResponse,
    SpiderCrawlRequest,
    SpiderCrawlResponse,
)
from .rag_engine import (
    CUSTOM_FEEDS_REGISTRY,
    build_rag_pipeline_from_records,
    generate_feed_openapi_schema,
    register_custom_feed,
    seed_default_feeds,
)
from .secop_scraper import search_secop2
from .taxonomy_spider import (
    crawl_secop_portal,
    get_secop2_taxonomy_catalog,
    inspect_opportunity_detail,
)

app = FastAPI(
    title="SECOP II Hybrid Web Scraper & RAG API Engine",
    version="2.0.0",
    description=(
        "Motor híbrido de Web Scraping avanzado (Spider DOM + Socrata SODA SoQL + ASP.NET Inspector), "
        "clasificador taxonómico de enlaces y generador dinámico de APIs listas para RAG sobre SECOP II."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

seed_default_feeds()


@app.get("/api/v1/health")
async def health_check() -> dict[str, Any]:
    taxonomy = get_secop2_taxonomy_catalog()
    total_links = sum(len(cat.links) for cat in taxonomy)
    return {
        "status": "OPERATIONAL",
        "engine": "SECOP II Hybrid Spider + SODA + RAG Pipeline v2.0",
        "skill_name": "secop2-hybrid-scraper-rag",
        "taxonomy_categories": len(taxonomy),
        "principal_links_indexed": total_links,
        "active_rag_feeds": len(CUSTOM_FEEDS_REGISTRY),
        "capabilities": [
            "SODA SoQL Real-Time Filtering (jbjy-vk9h & p6dx-8zbt)",
            "Async BFS/DFS Link Spider & Document Classifier",
            "ASP.NET __VIEWSTATE & OpportunityDetail Inspector",
            "Context-Anchored Markdown RAG Chunker + JSONL Streamer",
            "Dynamic Custom API Feed Generator (LangChain / LlamaIndex / OpenAPI 3.1)",
        ],
    }


@app.get("/api/v1/taxonomy", response_model=list[InformationCategorySummary])
async def get_taxonomy() -> list[InformationCategorySummary]:
    """
    Devuelve la estructura ordenada del tipo de información que ofrece el ecosistema
    SECOP II / Colombia Compra Eficiente junto con sus enlaces principales y métodos de extracción.
    """
    return get_secop2_taxonomy_catalog()


@app.post("/api/v1/spider/crawl", response_model=SpiderCrawlResponse)
async def execute_spider_crawl(req: SpiderCrawlRequest) -> SpiderCrawlResponse:
    """
    Ejecuta el motor Spider asíncrono sobre una URL semilla del ecosistema SECOP II,
    extrayendo y clasificando enlaces, cabeceras, tokens __VIEWSTATE y metadatos.
    """
    return await crawl_secop_portal(req)


@app.get("/api/v1/spider/inspect")
async def inspect_process_url(
    url: str = Query(..., description="URL de OpportunityDetail del proceso en SECOP II")
) -> dict[str, Any]:
    return await inspect_opportunity_detail(url)


@app.get("/api/v1/secop/search", response_model=SecopSearchResponse)
async def search_secop_get(
    dataset: Literal["procesos", "contratos"] = Query("procesos"),
    keyword: str | None = Query(None),
    entidad: str | None = Query(None),
    nit_entidad: str | None = Query(None),
    departamento: str | None = Query(None),
    ciudad: str | None = Query(None),
    modalidad: str | None = Query(None),
    estado: str | None = Query(None),
    cuantia_min: float | None = Query(None),
    cuantia_max: float | None = Query(None),
    unspsc_code: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    spider_enrich_top_n: int = Query(0, ge=0, le=5),
) -> SecopSearchResponse:
    filters = SecopFilterParams(
        dataset=dataset,
        keyword=keyword,
        entidad=entidad,
        nit_entidad=nit_entidad,
        departamento=departamento,
        ciudad=ciudad,
        modalidad=modalidad,
        estado=estado,
        cuantia_min=cuantia_min,
        cuantia_max=cuantia_max,
        unspsc_code=unspsc_code,
        limit=limit,
        offset=offset,
        spider_enrich_top_n=spider_enrich_top_n,
    )
    return await search_secop2(filters)


@app.post("/api/v1/secop/search", response_model=SecopSearchResponse)
async def search_secop_post(filters: SecopFilterParams) -> SecopSearchResponse:
    return await search_secop2(filters)


@app.get("/api/v1/rag/chunks", response_model=RAGPipelineResponse)
async def get_rag_chunks(
    dataset: Literal["procesos", "contratos"] = Query("procesos"),
    keyword: str | None = Query(None),
    entidad: str | None = Query(None),
    departamento: str | None = Query(None),
    modalidad: str | None = Query(None),
    estado: str | None = Query(None),
    cuantia_min: float | None = Query(None),
    cuantia_max: float | None = Query(None),
    limit: int = Query(15, ge=1, le=100),
    chunk_size_chars: int = Query(1400, ge=400, le=4000),
) -> RAGPipelineResponse:
    filters = SecopFilterParams(
        dataset=dataset,
        keyword=keyword,
        entidad=entidad,
        departamento=departamento,
        modalidad=modalidad,
        estado=estado,
        cuantia_min=cuantia_min,
        cuantia_max=cuantia_max,
        limit=limit,
    )
    search_res = await search_secop2(filters)
    return build_rag_pipeline_from_records(
        search_res.records, filters=filters, chunk_size_chars=chunk_size_chars
    )


@app.post("/api/v1/rag/chunks", response_model=RAGPipelineResponse)
async def post_rag_chunks(
    filters: SecopFilterParams,
    chunk_size_chars: int = Query(1400, ge=400, le=4000),
) -> RAGPipelineResponse:
    search_res = await search_secop2(filters)
    return build_rag_pipeline_from_records(
        search_res.records, filters=filters, chunk_size_chars=chunk_size_chars
    )


@app.get("/api/v1/rag/export.jsonl", response_class=PlainTextResponse)
async def export_rag_jsonl(
    dataset: Literal["procesos", "contratos"] = Query("procesos"),
    keyword: str | None = Query(None),
    entidad: str | None = Query(None),
    departamento: str | None = Query(None),
    modalidad: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> PlainTextResponse:
    filters = SecopFilterParams(
        dataset=dataset,
        keyword=keyword,
        entidad=entidad,
        departamento=departamento,
        modalidad=modalidad,
        estado=estado,
        limit=limit,
    )
    search_res = await search_secop2(filters)
    pipeline = build_rag_pipeline_from_records(search_res.records, filters=filters)
    lines = [json.dumps(c.model_dump(), ensure_ascii=False) for c in pipeline.chunks]
    return PlainTextResponse(
        content="\n".join(lines) + "\n",
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="secop2_rag_chunks.jsonl"'},
    )


@app.get("/api/v1/feeds", response_model=list[CustomAPIFeedSpec])
async def list_custom_feeds() -> list[CustomAPIFeedSpec]:
    return list(CUSTOM_FEEDS_REGISTRY.values())


@app.post("/api/v1/feeds", response_model=CustomAPIFeedSpec)
async def create_custom_feed(req: CustomAPIFeedCreateRequest) -> CustomAPIFeedSpec:
    return register_custom_feed(req)


@app.get("/api/v1/feeds/{slug}/rag", response_model=RAGPipelineResponse)
async def execute_custom_feed_rag(slug: str) -> RAGPipelineResponse:
    feed = CUSTOM_FEEDS_REGISTRY.get(slug)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed RAG '{slug}' no encontrado.")
    search_res = await search_secop2(feed.filters)
    return build_rag_pipeline_from_records(
        search_res.records,
        filters=feed.filters,
        chunk_size_chars=feed.chunk_size_chars,
    )


@app.get("/api/v1/feeds/{slug}/records", response_model=SecopSearchResponse)
async def execute_custom_feed_records(slug: str) -> SecopSearchResponse:
    feed = CUSTOM_FEEDS_REGISTRY.get(slug)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed RAG '{slug}' no encontrado.")
    return await search_secop2(feed.filters)


@app.get("/api/v1/feeds/{slug}/jsonl", response_class=PlainTextResponse)
async def execute_custom_feed_jsonl(slug: str) -> PlainTextResponse:
    feed = CUSTOM_FEEDS_REGISTRY.get(slug)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed RAG '{slug}' no encontrado.")
    search_res = await search_secop2(feed.filters)
    pipeline = build_rag_pipeline_from_records(
        search_res.records,
        filters=feed.filters,
        chunk_size_chars=feed.chunk_size_chars,
    )
    lines = [json.dumps(c.model_dump(), ensure_ascii=False) for c in pipeline.chunks]
    return PlainTextResponse(
        content="\n".join(lines) + "\n",
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{slug}.jsonl"'},
    )


@app.get("/api/v1/feeds/{slug}/openapi.json")
async def get_custom_feed_openapi(slug: str) -> dict[str, Any]:
    feed = CUSTOM_FEEDS_REGISTRY.get(slug)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed RAG '{slug}' no encontrado.")
    return generate_feed_openapi_schema(feed)
