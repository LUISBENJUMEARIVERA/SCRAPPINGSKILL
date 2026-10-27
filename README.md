# SECOP II Hybrid Web Scraper, Spider Taxonomy & RAG API Engine (`secop2-hybrid-scraper-rag`)

<div align="center">

**Hybrid Public Procurement Scraping Engine (SODA SoQL + Async DOM Spider + ASP.NET ViewState Inspector), Site Information Taxonomy Mapper & Dynamic RAG API Generator for Colombia's SECOP II**

[![Language: English](https://img.shields.io/badge/Docs-English-0B0C0E?style=for-the-badge)](#-english-documentation)
[![Idioma: Español](https://img.shields.io/badge/Docs-Español-D9381E?style=for-the-badge)](#-documentación-en-español)
[![Spanish File](https://img.shields.io/badge/Archivo-README.es.md-0D6E52?style=for-the-badge)](./README.es.md)
[![Tests](https://img.shields.io/badge/Pytest-5%2F5_Passing-0D6E52?style=for-the-badge)](#5-automated-test-suite-55-passing)
[![Skill](https://img.shields.io/badge/Antigravity_Skill-secop2--hybrid--scraper--rag-D9381E?style=for-the-badge)](./.agents/skills/secop2-hybrid-scraper-rag/SKILL.md)

> **🌐 Language Switch / Selector de Idioma:**  
> [🇺🇸 **Read Documentation in English**](#-english-documentation) &nbsp;|&nbsp; [🇪🇸 **Leer Documentación en Español (Abajo)**](#-documentación-en-español) &nbsp;|&nbsp; [📄 **Abrir `README.es.md`**](./README.es.md)

</div>

---

# 🇺🇸 English Documentation

## 1. Author, Architecture & Engineering Vision

**Author:** **Eng. Luis Benjumea Rivera** — *Fullstack Engineer & AI Systems Architect*  
**Repository:** [`https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL`](https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL)  
**Skill Identifier:** `secop2-hybrid-scraper-rag` (Included in [`.agents/skills/secop2-hybrid-scraper-rag/`](./.agents/skills/secop2-hybrid-scraper-rag/SKILL.md))

### Core Engineering Challenges Solved for SECOP II

Colombia's **SECOP II (*Sistema Electrónico para la Contratación Pública — Colombia Compra Eficiente*)** distributes public contracting data across multiple heterogeneous layers:
1. **Transactional ASP.NET Web Portals (`community.secop.gov.co`)**: Protected by dynamic `__VIEWSTATE` / `__EVENTVALIDATION` tokens and notice UIDs (`CO1.NTC.*`), holding process timelines, lots, questionnaires, and attachment links (PDF/DOCX pliegos).
2. **Institutional & Regulatory Portals (`www.colombiacompra.gov.co`)**: Hosting *Documentos Tipo*, *Tienda Virtual del Estado Colombiano (TVEC)*, and the *Plan Anual de Adquisiciones (PAA)*.
3. **Socrata Open Data SODA APIs (`www.datos.gov.co`)**: High-volume datasets (`p6dx-8zbt` for *Procesos de Contratación* and `jbjy-vk9h` for *Contratos Electrónicos*).
4. **Vector RAG Context Loss**: Standard text splitters strip entity names, NITs, COP budgets, and modalities from document chunks, causing severe retrieval hallucinations in public procurement RAG systems.

This project solves all four challenges by combining a **reusable AI Agent Skill** with a **Full-Stack Platform** featuring a **Swiss Institutional Minimalist UI** (`Space Grotesk` + `JetBrains Mono`).

---

## 2. System Architecture & Technical Stack

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   SWISS INSTITUTIONAL FRONTEND (REACT + VITE)                   │
│   01 // Taxonomy & Links   02 // Hybrid Filters   03 // DOM Spider   04 // RAG  │
│   Space Grotesk + JetBrains Mono | Exposed 1px Grid (#121316) | Signal #D9381E  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST JSON / NDJSON Stream (/api/v1/*)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                       FASTAPI HYBRID ENGINE (PYTHON 3.11+)                      │
│          Pydantic v2 Strict Schemas | AsyncIO HTTPX | BeautifulSoup4 DOM        │
└───────┬──────────────────────────┬──────────────────────────┬───────────────────┘
        │                          │                          │
┌───────▼───────────┐      ┌───────▼───────────┐      ┌───────▼───────────────────┐
│ SODA SoQL ENGINE  │      │ ASYNC WEB SPIDER  │      │ DYNAMIC RAG API BUILDER   │
│ datos.gov.co      │      │ BFS/DFS Crawler   │      │ Context-Anchored Markdown │
│ p6dx-8zbt (Proc.) │      │ __VIEWSTATE Check │      │ .jsonl Bulk Vector Export │
│ jbjy-vk9h (Cont.) │      │ Link Classifier   │      │ Custom OpenAPI 3.1 Feeds  │
└───────────────────┘      └───────────────────┘      └───────────────────────────┘
```

### Repository Structure

```text
SCRAPPINGSKILL/
├── .agents/
│   └── skills/
│       └── secop2-hybrid-scraper-rag/          # Installable Antigravity Skill
│           ├── SKILL.md                        # Main agent instructions & workflow
│           ├── references/
│           │   ├── secop2-taxonomy-and-endpoints.md
│           │   └── rag-chunking-spec.md
│           └── scripts/
│               └── secop_spider_cli.py         # Standalone CLI scraper & JSONL exporter
├── backend/
│   ├── app/
│   │   ├── main.py                             # FastAPI endpoints (/taxonomy, /secop, /spider, /rag, /feeds)
│   │   ├── models.py                           # Pydantic v2 contracts
│   │   ├── taxonomy_spider.py                  # 6-Domain SECOP II catalog + Async BFS/DFS Spider
│   │   ├── secop_scraper.py                    # Hybrid SODA SoQL builder + OpportunityDetail inspector
│   │   └── rag_engine.py                       # Context-anchored chunker + Dynamic API Feed generator
│   ├── tests/
│   │   └── test_api.py                         # Automated Pytest suite (5/5 passing)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                             # 4-Module Swiss Institutional Minimalist Workbench
│   │   ├── api.ts                              # Typed REST client
│   │   ├── types.ts                            # TypeScript interfaces
│   │   └── index.css                           # Swiss design tokens & accessibility rules
│   ├── package.json
│   └── vite.config.ts
├── start.ps1                                   # 1-Click launcher for Windows PowerShell
├── README.md                                   # Bilingual Documentation (EN / ES)
└── README.es.md                                # Dedicated Spanish Documentation
```

---

## 3. Prerequisites

- **Python:** `>= 3.11` (`fastapi`, `uvicorn`, `httpx`, `beautifulsoup4`, `pydantic`, `pytest`)
- **Node.js:** `>= 20.x` & `npm >= 10.x`

---

## 4. One-Line Commands (Quick Reference)

| Task | One-Line Command (PowerShell / Bash) |
| :--- | :--- |
| **1. Install Backend Deps** | `cd backend && pip install -r requirements.txt` |
| **2. Run Automated Tests (`5/5`)** | `cd backend && python -m pytest tests/test_api.py -v` |
| **3. Run Standalone Skill CLI** | `python .agents/skills/secop2-hybrid-scraper-rag/scripts/secop_spider_cli.py --keyword "software" --limit 5` |
| **4. Start Backend API (`:8010`)** | `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload` |
| **5. Start Frontend UI (`:5173`)** | `cd frontend && npm install && npm run dev` |
| **6. Build Production Frontend** | `cd frontend && npm run build` |

---

## 5. Automated Test Suite (`5/5 Passing`)

- `test_health_endpoint`: Verifies engine status, indexed SECOP II taxonomy domains, and active RAG feeds.
- `test_taxonomy_catalog`: Verifies the 6 SECOP II information domains (`CAT-01` to `CAT-06`) and principal links.
- `test_secop_search_with_filters`: Verifies live SoQL query construction and hybrid record extraction.
- `test_spider_crawl_endpoint`: Verifies asynchronous DOM spidering, link classification, and HTTP telemetry.
- `test_rag_chunks_and_custom_feed_creation`: Verifies context-anchored Markdown chunking, custom REST feed registration (`/api/v1/feeds/{slug}/rag`), and dynamic OpenAPI 3.1 schema generation.

---
---

# 🇪🇸 Documentación en Español

## 1. Autoría y Propósito del Proyecto

**Autor:** **Ing. Luis Benjumea Rivera** — *Desarrollador Fullstack & Arquitecto de Sistemas IA*  
**Repositorio Oficial:** [`https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL`](https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL)

Este proyecto entrega una **SKILL especializada (`secop2-hybrid-scraper-rag`)** junto con una **Aplicación Full-Stack Profesional** diseñada bajo el arquetipo de **Minimalismo Suizo Institucional** para hacer web scraping avanzado del **SECOP II (Colombia Compra Eficiente)**, ordenar taxonómicamente toda la información y enlaces principales que ofrece el portal, filtrar licitaciones/contratos en tiempo real y **generar APIs REST + Chunks listos para conectar directamente a un sistema RAG**.

---

## 2. Los 4 Módulos de la Plataforma

### `01 // MAPA` — Taxonomía de Información y Enlaces Principales del SECOP II
Ordena en la interfaz el tipo de información que ofrece el ecosistema de contratación pública en **6 dominios estructurales**:
1. **`CAT-01` Procesos de Contratación y Licitaciones Públicas** (`p6dx-8zbt` + Buscador Transaccional `community.secop.gov.co`).
2. **`CAT-02` Contratos Electrónicos y Ejecución Contractual** (`jbjy-vk9h` — contratistas adjudicados, valores y fechas).
3. **`CAT-03` Documentos Tipo, Pliegos Estándar y Normativa** (`colombiacompra.gov.co/documentos-tipo` — matrices y pliegos obligatorios en PDF/DOCX/XLSX).
4. **`CAT-04` Tienda Virtual del Estado Colombiano (TVEC)** (Acuerdos Marco de Precios y Grandes Superficies).
5. **`CAT-05` Plan Anual de Adquisiciones (PAA)** (Proyección anticipada de compras por vigencia y código UNSPSC).
6. **`CAT-06` Estándar de Contratación Abierta (OCDS & Analítica)** (Trazabilidad end-to-end en formato JSON OCDS).

Cada enlace principal incluye su **Score de Utilidad RAG (`91-99/100`)**, campos ofrecidos, detección de sesión `ASP.NET __VIEWSTATE` y un botón **"Rastrear con Spider"** para lanzar el crawler sobre ese nodo en un clic.

### `02 // FILTROS` — Explorador Híbrido (SODA SoQL + Deep Spider)
Permite filtrar procesos y contratos combinando:
- **Fuente de datos:** Procesos de Contratación (`p6dx-8zbt`) o Contratos Electrónicos (`jbjy-vk9h`).
- **Palabra clave en objeto contractual / título** (con presets rápidos para *Software & IA*, *Infraestructura Vial*, *Salud*, *Ciberseguridad*, *Interventoría* y *Nube*).
- **Entidad Estatal, NIT, Departamento, Modalidad de Contratación, Estado y Cuantía Mínima en COP**.
- **Inspector Spider por Expediente:** Botón `"Spider Expediente"` en cada resultado para inspeccionar el DOM de `OpportunityDetail` y previsualizar su ficha Markdown para RAG.

### `03 // SPIDER` — Rastreador Web Asíncrono y Clasificador de Enlaces
- Ejecuta rastreo Spider (`Nivel 1` directo o `Nivel 2` recursivo) sobre cualquier URL del SECOP II o Colombia Compra Eficiente.
- Detecta estado HTTP, latencia en milisegundos, servidor, tokens `__VIEWSTATE`, encabezados `H1-H3` y clasifica cada enlace descubierto en:
  - `EXPEDIENTE_PROCESO`
  - `PLIEGO_ANEXO_DOC` (`.pdf`, `.docx`, `.xlsx`, `.zip`)
  - `DATOS_ABIERTOS_API`
  - `NORMATIVA_MANUAL`
  - `PORTAL_TRANSACCIONAL`

### `04 // API RAG` — Generador Dinámico de API de Información y Chunks Vectoriales
- **Chunks con Contexto Institucional Inyectado:** Cada fragmento generado incluye cabecera determinista con ID del proceso, referencia, entidad, NIT, ubicación, modalidad, estado, cuantía en COP y código UNSPSC para evitar pérdida de contexto en bases vectoriales (`Qdrant`, `ChromaDB`, `pgvector`, `Pinecone`).
- **Publicador de API en 1 Clic:** Permite convertir cualquier búsqueda filtrada en un **Endpoint REST persistente**:
  - `GET /api/v1/feeds/{slug}/rag` (Chunks semánticos + metadatos JSON)
  - `GET /api/v1/feeds/{slug}/jsonl` (Stream `.jsonl` para ingesta masiva)
  - `GET /api/v1/feeds/{slug}/openapi.json` (Esquema OpenAPI 3.1 listo para conectar a agentes IA, LangChain, LlamaIndex, n8n o Flowise).
