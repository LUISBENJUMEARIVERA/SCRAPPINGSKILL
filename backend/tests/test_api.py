from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OPERATIONAL"
    assert data["taxonomy_categories"] >= 6
    assert data["principal_links_indexed"] >= 10


def test_taxonomy_catalog() -> None:
    resp = client.get("/api/v1/taxonomy")
    assert resp.status_code == 200
    categories = resp.json()
    assert len(categories) == 6
    first = categories[0]
    assert first["code"] == "CAT-01"
    assert len(first["links"]) >= 2


def test_secop_search_with_filters() -> None:
    resp = client.post(
        "/api/v1/secop/search",
        json={
            "dataset": "procesos",
            "keyword": "software",
            "limit": 5,
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total_returned"] >= 1
    assert "SELECT * FROM secop2_procesos" in payload["soql_query_executed"]
    assert len(payload["records"]) >= 1


def test_spider_crawl_endpoint() -> None:
    resp = client.post(
        "/api/v1/spider/crawl",
        json={
            "seed_url": "https://www.colombiacompra.gov.co/secop-ii",
            "max_links": 20,
            "follow_internal_depth": 1,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["http_status"] == 200
    assert data["total_links_discovered"] >= 1
    assert isinstance(data["category_breakdown"], dict)


def test_rag_chunks_and_custom_feed_creation() -> None:
    # 1. Generate RAG chunks
    rag_resp = client.get("/api/v1/rag/chunks?keyword=interoperabilidad&limit=3")
    assert rag_resp.status_code == 200
    rag_data = rag_resp.json()
    assert rag_data["total_chunks"] >= 1
    first_chunk = rag_data["chunks"][0]
    assert "[SECOP II]" in first_chunk["text"]
    assert "process_id" in first_chunk["metadata"]

    # 2. Create custom dynamic API feed
    feed_resp = client.post(
        "/api/v1/feeds",
        json={
            "name": "Feed Licitaciones Salud Bogotá",
            "slug": "salud-bogota-rag",
            "description": "Endpoint para RAG hospitalario en Bogotá",
            "filters": {
                "dataset": "procesos",
                "keyword": "salud",
                "departamento": "Distrito Capital de Bogotá",
                "limit": 5,
            },
            "chunk_size_chars": 1200,
            "include_spider_links": True,
        },
    )
    assert feed_resp.status_code == 200
    feed_spec = feed_resp.json()
    assert feed_spec["slug"] == "salud-bogota-rag"

    # 3. Call the newly generated feed RAG endpoint & OpenAPI spec
    exec_resp = client.get("/api/v1/feeds/salud-bogota-rag/rag")
    assert exec_resp.status_code == 200
    assert exec_resp.json()["total_chunks"] >= 1

    openapi_resp = client.get("/api/v1/feeds/salud-bogota-rag/openapi.json")
    assert openapi_resp.status_code == 200
    assert openapi_resp.json()["openapi"] == "3.1.0"
