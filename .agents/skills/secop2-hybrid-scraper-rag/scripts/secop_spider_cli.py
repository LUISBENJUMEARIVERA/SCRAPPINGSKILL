#!/usr/bin/env python3
"""
Standalone CLI helper for the `secop2-hybrid-scraper-rag` skill.
Allows agents and developers to query SECOP II (SODA + Web Spider), inspect site taxonomy,
and export RAG-ready JSONL files directly from the command line.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

SODA_PROCESSES_URL = "https://www.datos.gov.co/resource/p6dx-8zbt.json"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9",
}


async def fetch_secop_processes(
    keyword: str | None = None,
    entidad: str | None = None,
    departamento: str | None = None,
    modalidad: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    where_clauses: list[str] = []
    if keyword:
        safe_kw = keyword.replace("'", "''").upper()
        where_clauses.append(
            f"(upper(descripci_n_del_procedimiento) like '%{safe_kw}%' "
            f"OR upper(nombre_del_procedimiento) like '%{safe_kw}%')"
        )
    if entidad:
        safe_ent = entidad.replace("'", "''").upper()
        where_clauses.append(f"upper(entidad) like '%{safe_ent}%'")
    if departamento:
        safe_dep = departamento.replace("'", "''").upper()
        where_clauses.append(f"upper(departamento_entidad) like '%{safe_dep}%'")
    if modalidad:
        safe_mod = modalidad.replace("'", "''").upper()
        where_clauses.append(f"upper(modalidad_de_contratacion) like '%{safe_mod}%'")

    params: dict[str, Any] = {
        "$limit": limit,
        "$order": "fecha_de_publicacion_del DESC",
    }
    if where_clauses:
        params["$where"] = " AND ".join(where_clauses)

    async with httpx.AsyncClient(timeout=20.0, headers=HEADERS, follow_redirects=True) as client:
        resp = await client.get(SODA_PROCESSES_URL, params=params)
        resp.raise_for_status()
        return resp.json()


async def spider_url(url: str, max_links: int = 25) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0, headers=HEADERS, follow_redirects=True) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else url
        has_viewstate = bool(soup.find("input", {"name": "__VIEWSTATE"}))
        links = []
        for a in soup.find_all("a", href=True)[:max_links]:
            href = a["href"].strip()
            text = " ".join(a.get_text(" ", strip=True).split())
            if href and not href.startswith("javascript:"):
                links.append({"text": text or "[Sin texto]", "href": href})
        return {
            "url": str(resp.url),
            "status_code": resp.status_code,
            "title": title,
            "aspnet_viewstate_detected": has_viewstate,
            "discovered_links_count": len(links),
            "links": links,
        }


def build_rag_chunk(record: dict[str, Any]) -> dict[str, Any]:
    proc_id = record.get("id_del_proceso") or record.get("referencia_del_proceso") or "UNKNOWN"
    entidad = record.get("entidad", "Entidad no especificada")
    nit = record.get("nit_entidad", "N/A")
    depto = record.get("departamento_entidad", "N/A")
    ciudad = record.get("ciudad_entidad", "N/A")
    modalidad = record.get("modalidad_de_contratacion", "N/A")
    estado = record.get("estado_del_procedimiento", "N/A")
    precio_raw = record.get("precio_base", "0")
    try:
        precio = float(precio_raw)
    except (ValueError, TypeError):
        precio = 0.0
    objeto = record.get("descripci_n_del_procedimiento") or record.get("nombre_del_procedimiento") or ""
    url_field = record.get("urlproceso", "")
    url_proceso = url_field.get("url", "") if isinstance(url_field, dict) else str(url_field)

    markdown_text = (
        f"# [SECOP II] {proc_id} — {entidad}\n"
        f"- **Entidad:** {entidad} (NIT: {nit})\n"
        f"- **Ubicación:** {depto} - {ciudad}\n"
        f"- **Modalidad:** {modalidad} | **Estado:** {estado}\n"
        f"- **Cuantía Base:** ${precio:,.0f} COP\n\n"
        f"## Objeto Contractual\n{objeto}\n\n"
        f"## Enlace Oficial\n{url_proceso}"
    )
    content_hash = hashlib.sha256(markdown_text.encode("utf-8")).hexdigest()[:16]
    return {
        "chunk_id": f"secop2_{proc_id}_00",
        "doc_id": proc_id,
        "text": markdown_text,
        "token_estimate": max(1, len(markdown_text) // 4),
        "content_hash": content_hash,
        "metadata": {
            "source": "secop2_hybrid_cli",
            "process_id": proc_id,
            "entity_name": entidad,
            "entity_nit": nit,
            "department": depto,
            "city": ciudad,
            "modality": modalidad,
            "status": estado,
            "base_price_cop": precio,
            "process_url": url_proceso,
        },
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="SECOP II Hybrid Scraper & RAG Exporter CLI")
    parser.add_argument("--keyword", type=str, help="Palabra clave en el objeto del contrato")
    parser.add_argument("--entidad", type=str, help="Filtro por nombre de entidad estatal")
    parser.add_argument("--departamento", type=str, help="Filtro por departamento")
    parser.add_argument("--modalidad", type=str, help="Filtro por modalidad de contratación")
    parser.add_argument("--limit", type=int, default=10, help="Número máximo de procesos")
    parser.add_argument("--spider-url", type=str, help="Ejecutar spider de enlaces sobre una URL de SECOP II")
    parser.add_argument("--export-rag", type=str, help="Ruta de archivo .jsonl para exportar chunks RAG")
    args = parser.parse_args()

    if args.spider_url:
        result = await spider_url(args.spider_url)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    records = await fetch_secop_processes(
        keyword=args.keyword,
        entidad=args.entidad,
        departamento=args.departamento,
        modalidad=args.modalidad,
        limit=args.limit,
    )
    chunks = [build_rag_chunk(r) for r in records]

    if args.export_rag:
        out_path = Path(args.export_rag)
        with out_path.open("w", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        print(f"[OK] Exportados {len(chunks)} chunks RAG en {out_path.resolve()}")
    else:
        print(json.dumps(chunks, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
