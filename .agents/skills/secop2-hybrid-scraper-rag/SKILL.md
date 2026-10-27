---
name: secop2-hybrid-scraper-rag
description: >-
  Advanced web scraping, spidering, site taxonomy mapping, and RAG-ready API generation
  for Colombia's SECOP II (Sistema Electrónico para la Contratación Pública) and Colombia Compra Eficiente.
  Use this skill whenever the user wants to scrape SECOP II processes, contracts, pliegos, map SECOP II links
  and information structures, filter public procurement data, or expose SECOP II data as a REST API / Vector DB
  chunk pipeline for RAG (LangChain, LlamaIndex, Qdrant, Chroma, pgvector).
---

# SECOP II Hybrid Web Scraping & RAG API Skill (`secop2-hybrid-scraper-rag`)

## Overview

SECOP II (**Sistema Electrónico para la Contratación Pública — Colombia Compra Eficiente**) distributes public procurement information across multiple technical layers that cannot be conquered with a naive single-method scraper:

1. **Portal Transaccional Web (`community.secop.gov.co`)**: Built on ASP.NET (`__VIEWSTATE`, `__EVENTVALIDATION`, dynamic notice UIDs like `CO1.NTC.*`), containing deep process timelines, questionnaires, lotes, and downloadable attachments (pliegos, estudios previos, anexos en PDF/DOCX).
2. **Portal Institucional & Normativo (`www.colombiacompra.gov.co`)**: Contains the site taxonomy, Documentos Tipo, manuales de uso, Tienda Virtual del Estado Colombiano (TVEC), and Plan Anual de Adquisiciones (PAA).
3. **Motor Socrata SODA API (`www.datos.gov.co`)**: High-throughput structured datasets (`jbjy-vk9h` for Procesos de Contratación, `p6dx-8zbt` for Contratos Electrónicos) queryable with SoQL (`$where`, `$q`, `$order`, `$limit`, `$offset`).
4. **API OCDS (Open Contracting Data Standard)**: Standardized JSON contracting releases for cross-referencing tender, award, and contract stages.

This skill provides a **Hybrid Spider + SODA + RAG Pipeline Architecture** combined with an **Institutional Swiss Minimalist UI** that organizes the website's information catalog, principal links, advanced multi-faceted filters, spider telemetry, and 1-click RAG API generation.

---

## Core Architecture & Capabilities

When activated, implement or execute the following 4-pillar architecture:

### Pillar 1: Site Information Taxonomy & Principal Links Mapper
Organize all SECOP II domains into a structured catalog before or during crawling so the user has full visibility of what information the portal offers and how each node is extracted:
- **01. Procesos de Contratación (Licitaciones y Convocatorias)** — Transactional HTML (`community.secop.gov.co/Public/Tendering/ContractNoticeManagement/Index`) + SODA (`jbjy-vk9h`).
- **02. Contratos Electrónicos y Ejecución** — Transactional detail + SODA (`p6dx-8zbt`).
- **03. Expediente y Pliegos del Proceso (`OpportunityDetail`)** — Deep Spider target (`community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID={CO1.NTC.*}`). Extracts ASP.NET metadata, cronograma, lotes, and document download links.
- **04. Plan Anual de Adquisiciones (PAA)** — Forecasting & budget planning data.
- **05. Tienda Virtual del Estado Colombiano (TVEC)** — Acuerdos Marco de Precios y Grandes Superficies.
- **06. Documentos Tipo y Manuales Normativos** — Regulatory PDFs/DOCX for RAG legal grounding (`colombiacompra.gov.co/documentos-tipo`).
- **07. Estándar OCDS (Open Contracting Data Standard)** — Graph-ready JSON releases.

See [references/secop2-taxonomy-and-endpoints.md](./references/secop2-taxonomy-and-endpoints.md) for the complete endpoint dictionary, SoQL field mappings, and ASP.NET spider selectors.

### Pillar 2: Hybrid Spider Engine (Spider Crawl + SODA SoQL + ASP.NET Parser)
Combine three extraction strategies in a unified async Python engine (`httpx` + `BeautifulSoup4` + `Playwright` optional):
1. **Multi-Filter SODA Query Builder**:
   - Filter by `entidad`, `nit_entidad`, `departamento_entidad`, `ciudad_entidad`, `modalidad_de_contratacion`, `estado_del_procedimiento`, `precio_base` range (min/max COP), `codigo_principal_de_categoria` (UNSPSC), and full-text keyword (`$q` / `upper(descripci_n_del_procedimiento) like '%...%'`).
2. **Async Web Spider (BFS/DFS Link & Taxonomy Crawler)**:
   - Crawls seed URLs from `colombiacompra.gov.co`, `community.secop.gov.co`, and `datos.gov.co`.
   - Classifies discovered links into semantic categories: `PROCESO_TRANSACCIONAL`, `DOCUMENTO_PLIEGO`, `API_DATOS_ABIERTOS`, `NORMATIVA_DOCUMENTO_TIPO`, `TIENDA_VIRTUAL`, `NAVEGACION_PORTAL`.
   - Extracts HTTP status codes, response latency (ms), content-type headers, ASP.NET hidden state (`__VIEWSTATE` presence), and anchor context.
3. **Deep Opportunity Inspector**:
   - Given any SECOP II `urlproceso` (`https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=...`), inspects the HTML DOM to extract process sections, cronograma tables, and attachment links.

### Pillar 3: RAG-Ready Chunking & Dynamic API Generator
Transform raw procurement records and crawled pages into deterministic, citation-ready RAG artifacts:
- **Deterministic Semantic Chunking**:
  - Generates self-contained **Markdown & JSONL chunks** where every chunk carries full institutional context in its header (`[PROCESO: CO1.PCCNTR.xxx | ENTIDAD: ... | MODALIDAD: ... | CUANTÍA: $... COP | ESTADO: ...]`), preventing orphaned chunks in vector search.
- **Rich Metadata Payload for Vector DBs (Qdrant / Chroma / pgvector / Pinecone)**:
  - Every chunk includes filterable payload fields: `process_id`, `reference`, `entity_name`, `entity_nit`, `department`, `city`, `modality`, `status`, `base_price_cop`, `publication_date`, `unspsc_code`, `source_url`, `chunk_type`, and `content_hash`.
- **Dynamic REST API & Feed Generator**:
  - Exposes instant endpoints:
    - `GET /api/v1/rag/chunks` — Paginated semantic chunks with vector metadata.
    - `GET /api/v1/rag/export.jsonl` — Streaming JSONL ready for bulk vector ingestion.
    - `POST /api/v1/feeds` — Creates a named, persistent custom API endpoint (`/api/v1/feeds/{slug}/data` and `/api/v1/feeds/{slug}/rag`) pre-configured with specific SECOP II filters so any external RAG orchestrator (LangChain, LlamaIndex, n8n, Flowise) can pull live updates via HTTP GET.

See [references/rag-chunking-spec.md](./references/rag-chunking-spec.md) for the exact schema and LangChain / LlamaIndex / Qdrant integration templates.

### Pillar 4: Institutional Swiss Minimalist Interface
When building or updating the user interface for SECOP II scraping:
- **Visual Archetype**: Swiss Institutional Minimalism (`#F6F6F3` architectural paper canvas, `#FFFFFF` pure data cells, `#0D0E11` carbon ink, `1px solid #141519` exposed structural hairlines, `#D9381E` international signal vermilion accent).
- **Typography**: Geometric grotesque headings (`Space Grotesk`) paired with strict tabular monospace (`JetBrains Mono`) for NITs, process IDs (`CO1.PCCNTR.*`), COP currency amounts, HTTP status codes, and API endpoints.
- **Zero AI Slop**: No purple-blue gradients, no generic blurred cards, no emojis in UI controls (use clean SVG technical icons).

---

## Step-by-Step Workflow

1. **Run Quick CLI Verification or Standalone Spider**:
   Use the helper script [scripts/secop_spider_cli.py](./scripts/secop_spider_cli.py) to test connectivity, run a live filtered query against SECOP II, crawl links, or export a `.jsonl` RAG dataset from the terminal:
   ```bash
   python .agents/skills/secop2-hybrid-scraper-rag/scripts/secop_spider_cli.py --keyword "software" --limit 10 --export-rag secop_rag.jsonl
   ```
2. **Launch Full-Stack Platform (FastAPI + React Swiss UI)**:
   - Start Backend: `uvicorn app.main:app --reload --port 8000` (from `backend/`).
   - Start Frontend: `npm run dev` (from `frontend/`).
3. **Verify RAG Readiness**:
   - Inspect `/api/v1/health` and `/api/v1/taxonomy` to confirm all SECOP II domains and principal links are indexed.
   - Test `/api/v1/rag/chunks` to confirm chunks include structured Markdown + metadata and token estimates.
