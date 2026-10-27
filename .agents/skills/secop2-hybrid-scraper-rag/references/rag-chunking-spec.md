# Especificación de Chunking y Esquema de Datos para RAG (SECOP II)

## 1. Diseño de Chunks con Contexto Institucional Inyectado

En licitaciones públicas, un fragmento de texto aislado (por ejemplo: *"El plazo de ejecución será de 6 meses y el presupuesto es de $450.000.000"*) pierde su valor semántico si al recuperar el vector no se sabe a qué entidad, proceso o modalidad pertenece.

Por ello, cada chunk generado por el motor **DEBE** incluir un encabezado de anclaje contextual determinista en Markdown antes del texto:

```markdown
# [SECOP II] CO1.PCCNTR.5891204 — MINISTERIO DE TECNOLOGÍAS DE LA INFORMACIÓN Y LAS COMUNICACIONES
- **Referencia:** MINTIC-LP-014-2026
- **Entidad:** MINISTERIO DE TECNOLOGÍAS DE LA INFORMACIÓN Y LAS COMUNICACIONES (NIT: 899999053)
- **Ubicación:** Distrito Capital de Bogotá - Bogotá D.C.
- **Modalidad:** Licitación pública | **Estado:** Publicado / Abierto
- **Cuantía Base:** $2,450,000,000 COP | **Código UNSPSC:** V1.43230000
- **Fecha Publicación:** 2026-10-15 | **Cierre Ofertas:** 2026-11-08

## Objeto Contractual y Alcance
Contratar el desarrollo, implementación y soporte de una plataforma de interoperabilidad e inteligencia artificial para gestión documental...

## Enlaces Oficiales
- Expediente SECOP II: https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.5891204
```

## 2. Esquema JSON de Salida (`RAGChunk`)

```json
{
  "chunk_id": "secop2_CO1.PCCNTR.5891204_00",
  "doc_id": "CO1.PCCNTR.5891204",
  "chunk_index": 0,
  "text": "# [SECOP II] CO1.PCCNTR.5891204 ...",
  "token_estimate": 248,
  "content_hash": "a94f8d2c1e903284...",
  "metadata": {
    "source": "secop2_hybrid_engine",
    "process_id": "CO1.PCCNTR.5891204",
    "reference": "MINTIC-LP-014-2026",
    "entity_name": "MINISTERIO DE TECNOLOGÍAS DE LA INFORMACIÓN Y LAS COMUNICACIONES",
    "entity_nit": "899999053",
    "department": "Distrito Capital de Bogotá",
    "city": "Bogotá",
    "modality": "Licitación pública",
    "status": "Abierto",
    "base_price_cop": 2450000000.0,
    "publication_date": "2026-10-15",
    "closing_date": "2026-11-08",
    "unspsc_code": "V1.43230000",
    "process_url": "https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.5891204",
    "spider_enriched": true
  }
}
```

## 3. Integración Directa con LangChain / Qdrant / LlamaIndex

```python
import requests
from langchain_core.documents import Document

resp = requests.get("http://localhost:8000/api/v1/rag/chunks", params={
    "keyword": "inteligencia artificial",
    "departamento": "Distrito Capital de Bogotá",
    "limit": 25
})
payload = resp.json()

documents = [
    Document(page_content=chunk["text"], metadata=chunk["metadata"])
    for chunk in payload["chunks"]
]
```
