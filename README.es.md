# SECOP II — Unidad de Scraping Híbrido, Taxonomía Spider & API RAG (`README.es.md`)

<div align="center">

[![Read in English](https://img.shields.io/badge/Docs-Read_in_English-0B0C0E?style=for-the-badge)](./README.md)
[![Tests](https://img.shields.io/badge/Pytest-5%2F5_Aprobadas-0D6E52?style=for-the-badge)](#3-ejecución-rápida-y-pruebas)
[![Skill](https://img.shields.io/badge/SKILL-secop2--hybrid--scraper--rag-D9381E?style=for-the-badge)](./.agents/skills/secop2-hybrid-scraper-rag/SKILL.md)

</div>

---

## 1. Autoría y Arquitectura

**Autor:** **Ing. Luis Benjumea Rivera** — *Desarrollador Fullstack & Arquitecto de Sistemas IA*  
**Repositorio:** [`https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL`](https://github.com/LUISBENJUMEARIVERA/SCRAPPINGSKILL)

Plataforma completa y **Skill de Antigravity (`secop2-hybrid-scraper-rag`)** para realizar Web Scraping avanzado sobre el **SECOP II (Colombia Compra Eficiente)** combinando técnicas **Spider asíncronas (BFS/DFS + inspección DOM/ASP.NET)** con consultas estructuradas **SODA SoQL (`datos.gov.co`)**, organizando en una interfaz de **Minimalismo Suizo Institucional** toda la taxonomía de información y enlaces principales del sitio web, e incluyendo un **Generador Dinámico de APIs REST y Chunks `.jsonl` listos para conectar a un RAG**.

---

## 2. Capacidades Principales

1. **Taxonomía Ordenada del Sitio y Enlaces Principales (`01 // MAPA`)**:
   - Clasifica los 6 dominios de información de SECOP II (`Procesos de Contratación`, `Contratos Electrónicos`, `Documentos Tipo y Normativa`, `Tienda Virtual TVEC`, `Plan Anual PAA` y `Estándar OCDS`).
   - Detalla para cada enlace oficial su técnica de extracción, frecuencia de actualización, campos clave para RAG y permite **lanzar el Spider en vivo** con un clic.
2. **Filtros Multidimensionales en Tiempo Real (`02 // FILTROS`)**:
   - Filtra por palabra clave en el objeto contractual, entidad estatal, NIT, departamento, modalidad de contratación, estado del procedimiento y cuantía mínima en COP.
3. **Motor Spider Web Asíncrono (`03 // SPIDER`)**:
   - Rastrea páginas de `colombiacompra.gov.co`, `community.secop.gov.co` y `datos.gov.co`, detectando sesiones `__VIEWSTATE`, latencia HTTP, jerarquía `H1-H3` y clasificando automáticamente todos los enlaces descubiertos según su relevancia para RAG.
4. **Generador de API y Pipeline RAG (`04 // API RAG`)**:
   - Sintetiza chunks en Markdown con cabecera contextual institucional inyectada + metadatos vectoriales (`process_id`, `entity_nit`, `base_price_cop`, `unspsc_code`, `process_url`).
   - Publica endpoints personalizados (`/api/v1/feeds/{slug}/rag`, `/api/v1/feeds/{slug}/jsonl`, `/api/v1/feeds/{slug}/openapi.json`) con fragmentos de código listos para **LangChain**, **LlamaIndex** y **cURL**.

---

## 3. Ejecución Rápida y Pruebas

| Acción | Comando |
| :--- | :--- |
| **1. Ejecutar las 5 pruebas automáticas** | `cd backend ; python -m pytest tests/test_api.py -v` |
| **2. Iniciar Backend FastAPI (`:8010`)** | `cd backend ; python -m uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload` |
| **3. Iniciar Frontend React Swiss UI (`:5173`)** | `cd frontend ; npm install ; npm run dev` |
| **4. Usar la CLI de la Skill por terminal** | `python .agents/skills/secop2-hybrid-scraper-rag/scripts/secop_spider_cli.py --keyword "software" --limit 5 --export-rag salida_rag.jsonl` |
