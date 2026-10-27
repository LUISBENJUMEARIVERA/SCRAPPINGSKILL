import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Layers,
  Link2,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  createCustomFeed,
  fetchCustomFeeds,
  fetchTaxonomy,
  generateRagChunks,
  inspectSingleOpportunity,
  runSpiderCrawl,
  searchSecopProcesses,
} from './api';
import type {
  CustomAPIFeedSpec,
  InformationCategorySummary,
  RAGPipelineResponse,
  SecopFilterParams,
  SecopProcessRecord,
  SecopSearchResponse,
  SpiderCrawlResponse,
} from './types';

type ActiveModule = 'TAXONOMY' | 'SCRAPER' | 'SPIDER' | 'RAG_API';

const DEPARTAMENTOS_COLOMBIA = [
  '',
  'Distrito Capital de Bogotá',
  'Antioquia',
  'Valle del Cauca',
  'Atlántico',
  'Santander',
  'Cundinamarca',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Risaralda',
  'Tolima',
  'Meta',
  'Nariño',
  'Cauca',
  'Magdalena',
];

const MODALIDADES_SECOP2 = [
  '',
  'Licitación pública',
  'Selección abreviada menor cuantía',
  'Selección abreviada subasta inversa',
  'Mínima cuantía',
  'Contratación directa',
  'Concurso de méritos abierto',
  'Solicitud de información a los Proveedores',
];

const ESTADOS_SECOP2 = [
  '',
  'Abierto',
  'Publicado',
  'Evaluación',
  'Adjudicado',
  'Celebrado',
  'Seleccionado',
];

const QUICK_KEYWORD_PRESETS = [
  { label: 'Software & IA', kw: 'software' },
  { label: 'Infraestructura Vial', kw: 'vial' },
  { label: 'Salud & Hospitales', kw: 'salud' },
  { label: 'Ciberseguridad', kw: 'seguridad' },
  { label: 'Interventoría', kw: 'interventoria' },
  { label: 'Nube & Datos', kw: 'nube' },
];

const SPIDER_PRESET_SEEDS = [
  {
    label: 'Portal Central SECOP II (CCE)',
    url: 'https://www.colombiacompra.gov.co/secop-ii',
  },
  {
    label: 'Buscador Transaccional SECOP II (ASP.NET)',
    url: 'https://community.secop.gov.co/Public/Tendering/ContractNoticeManagement/Index',
  },
  {
    label: 'Repositorio Documentos Tipo & Pliegos',
    url: 'https://www.colombiacompra.gov.co/documentos-tipo/documentos-tipo',
  },
  {
    label: 'Tienda Virtual del Estado (TVEC)',
    url: 'https://www.colombiacompra.gov.co/tienda-virtual-del-estado-colombiano/tienda-virtual-del-estado-colombiano',
  },
  {
    label: 'Portal de Datos Abiertos & OCDS',
    url: 'https://www.colombiacompra.gov.co/transparencia-y-acceso-a-la-informacion-publica/datos-abiertos',
  },
];

function formatCopCurrency(amount: number): string {
  if (!amount || Number.isNaN(amount)) return '$0 COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('TAXONOMY');

  // Module 01: Taxonomy state
  const [taxonomy, setTaxonomy] = useState<InformationCategorySummary[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('CAT-01');
  const [loadingTaxonomy, setLoadingTaxonomy] = useState<boolean>(true);

  // Module 02: Hybrid Scraper & Filter state
  const [filters, setFilters] = useState<SecopFilterParams>({
    dataset: 'procesos',
    keyword: 'software',
    entidad: '',
    nit_entidad: '',
    departamento: '',
    ciudad: '',
    modalidad: '',
    estado: '',
    cuantia_min: undefined,
    cuantia_max: undefined,
    unspsc_code: '',
    limit: 15,
    offset: 0,
    spider_enrich_top_n: 0,
  });
  const [searchResult, setSearchResult] = useState<SecopSearchResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [inspectingProcessId, setInspectingProcessId] = useState<string | null>(null);
  const [liveProcessInspection, setLiveProcessInspection] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Module 03: Spider state
  const [spiderSeedUrl, setSpiderSeedUrl] = useState<string>(
    'https://www.colombiacompra.gov.co/secop-ii'
  );
  const [spiderDepth, setSpiderDepth] = useState<number>(1);
  const [spiderMaxLinks, setSpiderMaxLinks] = useState<number>(40);
  const [spiderCategoryFilter, setSpiderCategoryFilter] = useState<string>('');
  const [spiderResult, setSpiderResult] = useState<SpiderCrawlResponse | null>(null);
  const [loadingSpider, setLoadingSpider] = useState<boolean>(false);
  const [spiderError, setSpiderError] = useState<string | null>(null);

  // Module 04: RAG Pipeline & Dynamic API state
  const [ragPipeline, setRagPipeline] = useState<RAGPipelineResponse | null>(null);
  const [chunkSizeChars, setChunkSizeChars] = useState<number>(1400);
  const [loadingRag, setLoadingRag] = useState<boolean>(false);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const [customFeeds, setCustomFeeds] = useState<CustomAPIFeedSpec[]>([]);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string>('');
  const [newFeedName, setNewFeedName] = useState<string>('');
  const [newFeedDescription, setNewFeedDescription] = useState<string>(
    'Endpoint dinámico SECOP II con chunks estructurados y metadatos para Vector DB'
  );
  const [creatingFeed, setCreatingFeed] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    async function bootstrap() {
      try {
        setLoadingTaxonomy(true);
        const [taxData, searchData, feedsData] = await Promise.all([
          fetchTaxonomy(),
          searchSecopProcesses(filters),
          fetchCustomFeeds(),
        ]);
        setTaxonomy(taxData);
        setSearchResult(searchData);
        setCustomFeeds(feedsData);
        if (feedsData.length > 0) {
          setSelectedFeedSlug(feedsData[0].slug);
        }
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : 'Error inicializando conexión con el motor SECOP II.'
        );
      } finally {
        setLoadingTaxonomy(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExecuteSearch(overrideFilters?: SecopFilterParams) {
    const active = overrideFilters || filters;
    setLoadingSearch(true);
    setSearchError(null);
    try {
      const res = await searchSecopProcesses(active);
      setSearchResult(res);
      if (res.records.length > 0) {
        setExpandedProcessId(res.records[0].process_id);
      }
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Fallo al consultar procesos en SECOP II. Verifica que el backend esté activo en el puerto 8000.'
      );
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleRunSpider(customUrl?: string) {
    const targetUrl = customUrl || spiderSeedUrl;
    if (customUrl) {
      setSpiderSeedUrl(customUrl);
      setActiveModule('SPIDER');
    }
    setLoadingSpider(true);
    setSpiderError(null);
    try {
      const res = await runSpiderCrawl({
        seed_url: targetUrl,
        max_links: spiderMaxLinks,
        follow_internal_depth: spiderDepth,
        category_filter: spiderCategoryFilter || undefined,
      });
      setSpiderResult(res);
    } catch (err) {
      setSpiderError(
        err instanceof Error ? err.message : 'No se pudo completar el rastreo Spider.'
      );
    } finally {
      setLoadingSpider(false);
    }
  }

  async function handleInspectOpportunity(rec: SecopProcessRecord) {
    setInspectingProcessId(rec.process_id);
    try {
      const data = await inspectSingleOpportunity(rec.process_url);
      setLiveProcessInspection((prev) => ({
        ...prev,
        [rec.process_id]: data,
      }));
      setExpandedProcessId(rec.process_id);
    } finally {
      setInspectingProcessId(null);
    }
  }

  async function handleSynthesizeRag(switchTab = false) {
    if (switchTab) {
      setActiveModule('RAG_API');
    }
    setLoadingRag(true);
    try {
      const res = await generateRagChunks(filters, chunkSizeChars);
      setRagPipeline(res);
      setSelectedChunkIndex(0);
    } finally {
      setLoadingRag(false);
    }
  }

  async function handleCreateCustomApiFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!newFeedName.trim()) return;
    setCreatingFeed(true);
    try {
      const created = await createCustomFeed({
        name: newFeedName.trim(),
        description: newFeedDescription.trim(),
        filters,
        chunk_size_chars: chunkSizeChars,
        include_spider_links: true,
      });
      const updated = await fetchCustomFeeds();
      setCustomFeeds(updated);
      setSelectedFeedSlug(created.slug);
      setNewFeedName('');
    } finally {
      setCreatingFeed(false);
    }
  }

  function copyToClipboard(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function downloadRagJsonl() {
    if (!ragPipeline) return;
    const lines = ragPipeline.chunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
    const blob = new Blob([lines], { type: 'application/x-ndjson;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secop2_rag_${ragPipeline.pipeline_id}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCategory =
    taxonomy.find((c) => c.code === selectedCategoryCode) || taxonomy[0] || null;
  const activeFeed =
    customFeeds.find((f) => f.slug === selectedFeedSlug) || customFeeds[0] || null;
  const activeChunk =
    ragPipeline && ragPipeline.chunks[selectedChunkIndex]
      ? ragPipeline.chunks[selectedChunkIndex]
      : null;

  return (
    <div className="min-h-[100svh] bg-[#F4F4F0] text-[#0B0C0E] flex flex-col">
      {/* TOP SWISS INSTITUTIONAL SPECIFICATION BAR */}
      <header className="border-b border-[#121316] bg-[#FFFFFF] sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#121316]">
          {/* Brand & Classification Cell */}
          <div className="lg:col-span-4 px-5 py-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-[#D9381E]" aria-hidden="true" />
                <span className="font-mono-tabular text-[11px] font-semibold tracking-widest uppercase text-[#3E4149]">
                  SKILL // SECOP2-HYBRID-SCRAPER-RAG
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-[#0B0C0E] mt-0.5">
                SECOP II — UNIDAD DE EXTRACCIÓN & API RAG
              </h1>
            </div>
            <span className="font-mono-tabular text-[11px] px-2 py-1 border border-[#121316] bg-[#F4F4F0] font-semibold">
              v2.0 SWISS
            </span>
          </div>

          {/* Primary Module Navigation Tabs */}
          <nav
            aria-label="Módulos del sistema SECOP II"
            className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#121316]"
          >
            <button
              type="button"
              onClick={() => setActiveModule('TAXONOMY')}
              className={`min-h-[56px] px-3 py-2 text-left transition-colors flex flex-col justify-between cursor-pointer ${
                activeModule === 'TAXONOMY'
                  ? 'bg-[#0B0C0E] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#EAEAE4]'
              }`}
            >
              <span className="font-mono-tabular text-[10px] opacity-75 flex items-center justify-between">
                <span>01 // MAPA</span>
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-tight leading-tight">
                Taxonomía & Enlaces
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('SCRAPER')}
              className={`min-h-[56px] px-3 py-2 text-left transition-colors flex flex-col justify-between cursor-pointer ${
                activeModule === 'SCRAPER'
                  ? 'bg-[#0B0C0E] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#EAEAE4]'
              }`}
            >
              <span className="font-mono-tabular text-[10px] opacity-75 flex items-center justify-between">
                <span>02 // FILTROS</span>
                <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-tight leading-tight">
                Explorador Procesos
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveModule('SPIDER');
                if (!spiderResult && !loadingSpider) {
                  handleRunSpider();
                }
              }}
              className={`min-h-[56px] px-3 py-2 text-left transition-colors flex flex-col justify-between cursor-pointer ${
                activeModule === 'SPIDER'
                  ? 'bg-[#0B0C0E] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#EAEAE4]'
              }`}
            >
              <span className="font-mono-tabular text-[10px] opacity-75 flex items-center justify-between">
                <span>03 // SPIDER</span>
                <Network className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-tight leading-tight">
                Rastreador Web DOM
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveModule('RAG_API');
                if (!ragPipeline && !loadingRag) {
                  handleSynthesizeRag(false);
                }
              }}
              className={`min-h-[56px] px-3 py-2 text-left transition-colors flex flex-col justify-between cursor-pointer ${
                activeModule === 'RAG_API'
                  ? 'bg-[#D9381E] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#EAEAE4]'
              }`}
            >
              <span className="font-mono-tabular text-[10px] opacity-85 flex items-center justify-between">
                <span>04 // API RAG</span>
                <Database className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-tight leading-tight">
                Generador API & Chunks
              </span>
            </button>
          </nav>

          {/* Live Engine Telemetry Status */}
          <div className="lg:col-span-2 px-4 py-2.5 bg-[#F4F4F0] flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#0D6E52]"
                aria-hidden="true"
              />
              <span className="font-mono-tabular text-[11px] font-bold text-[#0D6E52]">
                MOTOR HÍBRIDO ACTIVO
              </span>
            </div>
            <p className="font-mono-tabular text-[10px] text-[#3E4149] mt-0.5 truncate">
              SODA + SPIDER DOM + OPENAPI 3.1
            </p>
          </div>
        </div>
      </header>

      {/* ASYMMETRIC SWISS ARCHITECTURAL HERO / TELEMETRY STRIP */}
      <section className="border-b border-[#121316] bg-[#FFFFFF]">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#121316]">
          <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 border border-[#121316] px-2.5 py-1 bg-[#F4F4F0] mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                <span className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider">
                  COLOMBIA COMPRA EFICIENTE // SECOP II & DATOS ABIERTOS
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-[#0B0C0E] leading-[1.08]">
                Ingeniería de Scraping Híbrido, Taxonomía de Enlaces y Generación de API para RAG.
              </h2>
              <p className="text-sm md:text-base text-[#3E4149] mt-3 max-w-[68ch]">
                Ordena la arquitectura de información del SECOP II, combina consultas SoQL de alta velocidad con técnicas Spider de inspección DOM/ASP.NET y transforma expedientes públicos en endpoints REST y chunks vectoriales listos para conectar a cualquier flujo RAG.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-[#CFCFC7] flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveModule('SCRAPER')}
                className="min-h-[44px] px-4 py-2 bg-[#0B0C0E] text-[#FFFFFF] hover:bg-[#23252C] text-xs font-mono-tabular font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                Explorar Procesos con Filtros
              </button>
              <button
                type="button"
                onClick={() => handleRunSpider('https://www.colombiacompra.gov.co/secop-ii')}
                className="min-h-[44px] px-4 py-2 bg-[#FFFFFF] text-[#0B0C0E] border border-[#121316] hover:bg-[#EAEAE4] text-xs font-mono-tabular font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <Network className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                Ejecutar Spider de Enlaces
              </button>
              <button
                type="button"
                onClick={() => handleSynthesizeRag(true)}
                className="min-h-[44px] px-4 py-2 bg-[#D9381E] text-[#FFFFFF] hover:bg-[#B82D16] text-xs font-mono-tabular font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                Generar API & Chunks RAG
              </button>
            </div>
          </div>

          {/* Right 5 Columns: Swiss Telemetry Matrix */}
          <div className="lg:col-span-5 grid grid-cols-2 divide-x divide-y divide-[#121316] bg-[#F4F4F0]">
            <div className="p-5 bg-[#FFFFFF]">
              <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                DOMINIOS DE INFORMACIÓN
              </span>
              <div className="font-mono-tabular text-2xl md:text-3xl font-bold text-[#0B0C0E] mt-1">
                06 CATEGORÍAS
              </div>
              <p className="text-xs text-[#3E4149] mt-1">
                {taxonomy.reduce((acc, c) => acc + c.links.length, 0) || 11} enlaces principales clasificados por técnica Spider/API
              </p>
            </div>

            <div className="p-5 bg-[#FFFFFF]">
              <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                PROCESOS EN VISTA ACTIVA
              </span>
              <div className="font-mono-tabular text-2xl md:text-3xl font-bold text-[#0B0C0E] mt-1">
                {searchResult ? searchResult.total_returned : '--'} EXPEDIENTES
              </div>
              <p className="text-xs text-[#0D6E52] font-mono-tabular mt-1">
                {searchResult
                  ? `${searchResult.execution_time_ms} ms // ${searchResult.data_source === 'LIVE_DATOS_GOV_CO_SODA' ? 'SODA EN VIVO' : 'CACHÉ HÍBRIDO'}`
                  : 'Sincronizando...'}
              </p>
            </div>

            <div className="p-5 bg-[#FFFFFF]">
              <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                CUANTÍA AGREGADA EN FILTRO
              </span>
              <div className="font-mono-tabular text-lg md:text-xl font-bold text-[#0B0C0E] mt-1 truncate">
                {searchResult
                  ? formatCopCurrency(searchResult.summary_metrics.total_budget_cop)
                  : '$0 COP'}
              </div>
              <p className="text-xs text-[#3E4149] mt-1">
                {searchResult
                  ? `${searchResult.summary_metrics.unique_entities} entidades estatales únicas`
                  : 'Calculando presupuesto...'}
              </p>
            </div>

            <div className="p-5 bg-[#FFFFFF]">
              <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                ENDPOINTS RAG ACTIVOS
              </span>
              <div className="font-mono-tabular text-2xl md:text-3xl font-bold text-[#D9381E] mt-1">
                {customFeeds.length} FEEDS REST
              </div>
              <p className="text-xs text-[#3E4149] mt-1">
                JSONL + Context Markdown + OpenAPI 3.1
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="max-w-[1440px] w-full mx-auto flex-1">
        {/* =====================================================================
            MODULE 01: SITE TAXONOMY & PRINCIPAL LINKS DIRECTORY
           ===================================================================== */}
        {activeModule === 'TAXONOMY' && (
          <section aria-labelledby="taxonomy-heading" className="border-b border-[#121316]">
            {/* Section Header Bar */}
            <div className="bg-[#EAEAE4] border-b border-[#121316] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#D9381E]">
                  SECCIÓN 01 // ARQUITECTURA DE INFORMACIÓN DEL PORTAL
                </span>
                <h2 id="taxonomy-heading" className="text-xl font-bold text-[#0B0C0E]">
                  Clasificación del Tipo de Información que Ofrece SECOP II y Enlaces Principales
                </h2>
              </div>
              <div className="font-mono-tabular text-xs text-[#3E4149] bg-[#FFFFFF] border border-[#121316] px-3 py-2">
                Selecciona un dominio para inspeccionar sus enlaces oficiales, campos disponibles y disparar el Spider
              </div>
            </div>

            {loadingTaxonomy ? (
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#FFFFFF]">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-40 border border-[#CFCFC7] bg-[#F4F4F0] animate-pulse p-5"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#121316] bg-[#FFFFFF]">
                {/* Left Column: 6 Information Categories Selector */}
                <div className="lg:col-span-4 divide-y divide-[#121316]">
                  {taxonomy.map((cat) => {
                    const isSelected = cat.code === selectedCategoryCode;
                    return (
                      <button
                        key={cat.code}
                        type="button"
                        onClick={() => setSelectedCategoryCode(cat.code)}
                        className={`w-full text-left p-5 transition-colors cursor-pointer block ${
                          isSelected
                            ? 'bg-[#0B0C0E] text-[#FFFFFF]'
                            : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#F4F4F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono-tabular text-xs">
                          <span
                            className={`font-bold px-2 py-0.5 border ${
                              isSelected
                                ? 'border-[#D9381E] bg-[#D9381E] text-[#FFFFFF]'
                                : 'border-[#121316] bg-[#F4F4F0] text-[#0B0C0E]'
                            }`}
                          >
                            {cat.code}
                          </span>
                          <span className={isSelected ? 'text-[#CFCFC7]' : 'text-[#686C77]'}>
                            {cat.links.length} ENLACES PRINCIPALES
                          </span>
                        </div>
                        <h3 className="text-base font-bold mt-2.5 leading-snug">{cat.name}</h3>
                        <p
                          className={`text-xs mt-1 line-clamp-2 ${
                            isSelected ? 'text-[#EAEAE4]' : 'text-[#3E4149]'
                          }`}
                        >
                          {cat.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Active Category Specification + Principal Links Cards */}
                {activeCategory && (
                  <div className="lg:col-span-8 flex flex-col justify-between">
                    <div>
                      {/* Category Technical Dossier Header */}
                      <div className="p-6 md:p-8 border-b border-[#121316] bg-[#F4F4F0]">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className="font-mono-tabular text-xs font-bold uppercase px-2.5 py-1 bg-[#FFFFFF] border border-[#121316]">
                            DOMINIO {activeCategory.code} // ESPECIFICACIÓN TÉCNICA
                          </span>
                          <span className="font-mono-tabular text-xs text-[#0D6E52] font-semibold bg-[#FFFFFF] border border-[#121316] px-2.5 py-1">
                            VOLUMEN: {activeCategory.record_volume_estimate}
                          </span>
                        </div>

                        <h3 className="text-2xl font-bold text-[#0B0C0E]">
                          {activeCategory.name}
                        </h3>
                        <p className="text-sm text-[#3E4149] mt-2 leading-relaxed">
                          {activeCategory.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-[#CFCFC7]">
                          <div>
                            <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                              FORMATO PRIMARIO DEL SITIO
                            </span>
                            <span className="font-mono-tabular text-xs font-semibold text-[#0B0C0E] mt-1 block">
                              {activeCategory.primary_format}
                            </span>
                          </div>
                          <div>
                            <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block">
                              ESTRATEGIA DE SCRAPING / SPIDER RECOMENDADA
                            </span>
                            <span className="font-mono-tabular text-xs font-semibold text-[#D9381E] mt-1 block">
                              {activeCategory.extraction_strategy}
                            </span>
                          </div>
                        </div>

                        {/* Sample Fields Offered */}
                        <div className="mt-5">
                          <span className="font-mono-tabular text-[11px] uppercase text-[#686C77] block mb-2">
                            CAMPOS Y METADATOS CLAVE QUE OFRECE ESTE MÓDULO PARA RAG:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeCategory.sample_fields.map((field) => (
                              <span
                                key={field}
                                className="font-mono-tabular text-[11px] px-2 py-0.5 bg-[#FFFFFF] border border-[#121316] text-[#0B0C0E]"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Principal Links Table / Rows */}
                      <div className="divide-y divide-[#121316]">
                        <div className="px-6 py-3 bg-[#FFFFFF] flex items-center justify-between">
                          <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#0B0C0E]">
                            ENLACES PRINCIPALES Y ENDPOINTS OFICIALES ({activeCategory.links.length})
                          </span>
                          <span className="font-mono-tabular text-[11px] text-[#686C77]">
                            ORDENADOS POR UTILIDAD VECTORIAL RAG
                          </span>
                        </div>

                        {activeCategory.links.map((lnk) => (
                          <div key={lnk.id} className="p-6 bg-[#FFFFFF] hover:bg-[#F4F4F0]/60 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 bg-[#0B0C0E] text-[#FFFFFF]">
                                    {lnk.id}
                                  </span>
                                  <span className="font-mono-tabular text-[11px] font-semibold px-2 py-0.5 border border-[#121316] bg-[#EAEAE4]">
                                    {lnk.information_type}
                                  </span>
                                  {lnk.requires_viewstate_session && (
                                    <span className="font-mono-tabular text-[11px] font-semibold px-2 py-0.5 border border-[#D9381E] text-[#D9381E] bg-[#FFFFFF]">
                                      ASP.NET __VIEWSTATE
                                    </span>
                                  )}
                                  <span className="font-mono-tabular text-[11px] font-bold text-[#0D6E52] ml-auto">
                                    SCORE RAG: {lnk.rag_utility_score}/100
                                  </span>
                                </div>

                                <h4 className="text-base font-bold text-[#0B0C0E]">{lnk.title}</h4>
                                <p className="text-xs text-[#3E4149] mt-1">{lnk.description}</p>

                                <div className="mt-3 p-2.5 bg-[#F4F4F0] border border-[#CFCFC7] font-mono-tabular text-xs break-all flex items-center justify-between gap-2">
                                  <span className="text-[#0B0C0E]">{lnk.url}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(lnk.id, lnk.url)}
                                    aria-label={`Copiar enlace ${lnk.title}`}
                                    className="px-2 py-1 bg-[#FFFFFF] border border-[#121316] text-[11px] shrink-0 hover:bg-[#EAEAE4] cursor-pointer flex items-center gap-1"
                                  >
                                    {copiedKey === lnk.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-[#0D6E52]" aria-hidden="true" />
                                        COPIADO
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" aria-hidden="true" />
                                        COPIAR URL
                                      </>
                                    )}
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                                  <div>
                                    <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                                      TÉCNICA DE EXTRACCIÓN:
                                    </span>
                                    <span className="font-medium text-[#0B0C0E]">
                                      {lnk.extraction_technique}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                                      FRECUENCIA DE ACTUALIZACIÓN:
                                    </span>
                                    <span className="font-medium text-[#0B0C0E]">
                                      {lnk.update_frequency}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {lnk.key_fields_offered.map((kf) => (
                                    <span
                                      key={kf}
                                      className="font-mono-tabular text-[10px] px-2 py-0.5 bg-[#EAEAE4] text-[#0B0C0E]"
                                    >
                                      + {kf}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Action Buttons for this Link */}
                              <div className="flex sm:flex-row md:flex-col gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleRunSpider(lnk.url)}
                                  className="min-h-[40px] px-3.5 py-2 bg-[#0B0C0E] text-[#FFFFFF] hover:bg-[#D9381E] font-mono-tabular text-xs font-semibold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Network className="w-3.5 h-3.5" aria-hidden="true" />
                                  Rastrear con Spider
                                </button>
                                <a
                                  href={lnk.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[40px] px-3.5 py-2 bg-[#FFFFFF] text-[#0B0C0E] border border-[#121316] hover:bg-[#EAEAE4] font-mono-tabular text-xs font-semibold uppercase flex items-center justify-center gap-1.5"
                                >
                                  Abrir Portal Oficial
                                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* =====================================================================
            MODULE 02: HYBRID SCRAPER & ADVANCED MULTI-DIMENSIONAL FILTERS
           ===================================================================== */}
        {activeModule === 'SCRAPER' && (
          <section aria-labelledby="scraper-heading" className="border-b border-[#121316]">
            <div className="bg-[#EAEAE4] border-b border-[#121316] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#D9381E]">
                  SECCIÓN 02 // MOTOR HÍBRIDO SODA SoQL + DEEP SPIDER
                </span>
                <h2 id="scraper-heading" className="text-xl font-bold text-[#0B0C0E]">
                  Explorador de Procesos y Contratos SECOP II con Filtros Avanzados
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSynthesizeRag(true)}
                  className="min-h-[40px] px-4 py-2 bg-[#D9381E] text-[#FFFFFF] font-mono-tabular text-xs font-bold uppercase flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Convertir Filtro Actual en API RAG
                </button>
              </div>
            </div>

            {/* Filter Matrix Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteSearch();
              }}
              className="bg-[#FFFFFF] border-b border-[#121316] p-6"
            >
              {/* Quick Keyword Presets Row */}
              <div className="mb-5 pb-4 border-b border-[#CFCFC7] flex flex-wrap items-center gap-2">
                <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#686C77] mr-2 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                  FILTROS RÁPIDOS DE SECTOR:
                </span>
                {QUICK_KEYWORD_PRESETS.map((preset) => (
                  <button
                    key={preset.kw}
                    type="button"
                    onClick={() => {
                      const updated = { ...filters, keyword: preset.kw };
                      setFilters(updated);
                      handleExecuteSearch(updated);
                    }}
                    className={`px-3 py-1.5 font-mono-tabular text-xs border border-[#121316] cursor-pointer transition-colors ${
                      filters.keyword === preset.kw
                        ? 'bg-[#0B0C0E] text-[#FFFFFF] font-bold'
                        : 'bg-[#F4F4F0] text-[#0B0C0E] hover:bg-[#EAEAE4]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 4-Column Swiss Filter Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Dataset selector */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-dataset"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    1. Fuente de Datos SECOP II
                  </label>
                  <select
                    id="filter-dataset"
                    value={filters.dataset}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dataset: e.target.value as 'procesos' | 'contratos',
                      })
                    }
                    className="min-h-[44px] px-3 py-2 bg-[#F4F4F0] border border-[#121316] text-xs font-mono-tabular font-semibold"
                  >
                    <option value="procesos">
                      Procesos de Contratación (jbjy-vk9h)
                    </option>
                    <option value="contratos">
                      Contratos Electrónicos Adjudicados (p6dx-8zbt)
                    </option>
                  </select>
                </div>

                {/* Keyword */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-keyword"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    2. Palabra Clave en Objeto / Título
                  </label>
                  <input
                    id="filter-keyword"
                    type="text"
                    value={filters.keyword || ''}
                    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                    placeholder="Ej. software, interventoría, salud..."
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  />
                </div>

                {/* Entidad */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-entidad"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    3. Nombre de Entidad Estatal
                  </label>
                  <input
                    id="filter-entidad"
                    type="text"
                    value={filters.entidad || ''}
                    onChange={(e) => setFilters({ ...filters, entidad: e.target.value })}
                    placeholder="Ej. MINISTERIO, INVIAS, ALCALDIA..."
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  />
                </div>

                {/* Departamento */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-depto"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    4. Departamento
                  </label>
                  <select
                    id="filter-depto"
                    value={filters.departamento || ''}
                    onChange={(e) => setFilters({ ...filters, departamento: e.target.value })}
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  >
                    <option value="">Todos los Departamentos</option>
                    {DEPARTAMENTOS_COLOMBIA.filter(Boolean).map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modalidad */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-modalidad"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    5. Modalidad de Contratación
                  </label>
                  <select
                    id="filter-modalidad"
                    value={filters.modalidad || ''}
                    onChange={(e) => setFilters({ ...filters, modalidad: e.target.value })}
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  >
                    <option value="">Todas las Modalidades</option>
                    {MODALIDADES_SECOP2.filter(Boolean).map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-estado"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    6. Estado del Procedimiento
                  </label>
                  <select
                    id="filter-estado"
                    value={filters.estado || ''}
                    onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  >
                    <option value="">Todos los Estados</option>
                    {ESTADOS_SECOP2.filter(Boolean).map((est) => (
                      <option key={est} value={est}>
                        {est}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cuantía Mínima */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-cuantia-min"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    7. Cuantía Mínima (COP)
                  </label>
                  <input
                    id="filter-cuantia-min"
                    type="number"
                    min={0}
                    step={10000000}
                    value={filters.cuantia_min ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        cuantia_min: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="Ej. 100000000"
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                  />
                </div>

                {/* Límite & Spider Enrich */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="filter-limit"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    8. Límite de Registros & Spider
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="filter-limit"
                      value={filters.limit}
                      onChange={(e) =>
                        setFilters({ ...filters, limit: Number(e.target.value) })
                      }
                      className="min-h-[44px] px-2.5 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular"
                    >
                      <option value={10}>10 procesos</option>
                      <option value={15}>15 procesos</option>
                      <option value={25}>25 procesos</option>
                      <option value={50}>50 procesos</option>
                    </select>

                    <select
                      aria-label="Inspección profunda Spider en expedientes"
                      value={filters.spider_enrich_top_n}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          spider_enrich_top_n: Number(e.target.value),
                        })
                      }
                      className="min-h-[44px] px-2.5 py-2 bg-[#F4F4F0] border border-[#121316] text-xs font-mono-tabular"
                    >
                      <option value={0}>Spider: Bajo demanda</option>
                      <option value={2}>Spider Auto: Top 2</option>
                      <option value={3}>Spider Auto: Top 3</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Live SoQL Preview */}
              <div className="mt-5 pt-4 border-t border-[#CFCFC7] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 bg-[#F4F4F0] border border-[#121316] px-3.5 py-2 font-mono-tabular text-[11px] text-[#0B0C0E] overflow-x-auto">
                  <span className="font-bold text-[#D9381E] mr-2">SoQL GENERADO:</span>
                  {searchResult ? searchResult.soql_query_executed : 'SELECT * FROM secop2_procesos...'}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const reset: SecopFilterParams = {
                        dataset: 'procesos',
                        keyword: '',
                        entidad: '',
                        nit_entidad: '',
                        departamento: '',
                        ciudad: '',
                        modalidad: '',
                        estado: '',
                        cuantia_min: undefined,
                        cuantia_max: undefined,
                        unspsc_code: '',
                        limit: 15,
                        offset: 0,
                        spider_enrich_top_n: 0,
                      };
                      setFilters(reset);
                      handleExecuteSearch(reset);
                    }}
                    className="min-h-[44px] px-4 py-2 bg-[#FFFFFF] border border-[#121316] text-xs font-mono-tabular font-semibold uppercase hover:bg-[#EAEAE4] cursor-pointer"
                  >
                    Limpiar Filtros
                  </button>

                  <button
                    type="submit"
                    disabled={loadingSearch}
                    className="min-h-[44px] px-6 py-2 bg-[#0B0C0E] text-[#FFFFFF] hover:bg-[#D9381E] text-xs font-mono-tabular font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {loadingSearch ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Extrayendo de SECOP II...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" aria-hidden="true" />
                        Ejecutar Scraping Híbrido
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error State */}
            {searchError && (
              <div
                role="alert"
                className="p-5 bg-[#FFFFFF] border-b border-[#121316] text-[#D9381E] font-mono-tabular text-xs flex items-center justify-between"
              >
                <span>ERROR TÉCNICO: {searchError}</span>
                <button
                  type="button"
                  onClick={() => handleExecuteSearch()}
                  className="px-3 py-1 border border-[#D9381E] font-bold uppercase cursor-pointer"
                >
                  Reintentar Conexión
                </button>
              </div>
            )}

            {/* Results Table & Expandable Dossiers */}
            <div className="bg-[#FFFFFF]">
              {loadingSearch ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-[#F4F4F0] border border-[#CFCFC7] animate-pulse"
                    />
                  ))}
                </div>
              ) : searchResult && searchResult.records.length > 0 ? (
                <div className="divide-y divide-[#121316]">
                  {searchResult.records.map((rec, idx) => {
                    const isExpanded = expandedProcessId === rec.process_id;
                    const spiderInfo =
                      liveProcessInspection[rec.process_id] || rec.spider_metadata;
                    return (
                      <article
                        key={`${rec.process_id}-${idx}`}
                        className="p-5 md:p-6 hover:bg-[#F4F4F0]/50 transition-colors"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1">
                            {/* Top Metadata Badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 bg-[#0B0C0E] text-[#FFFFFF]">
                                {rec.process_id}
                              </span>
                              <span className="font-mono-tabular text-xs px-2 py-0.5 border border-[#121316] bg-[#F4F4F0] font-semibold">
                                REF: {rec.reference}
                              </span>
                              <span className="font-mono-tabular text-xs px-2 py-0.5 bg-[#EAEAE4] text-[#0B0C0E] font-semibold">
                                {rec.modality}
                              </span>
                              <span className="font-mono-tabular text-xs px-2 py-0.5 border border-[#0D6E52] text-[#0D6E52] font-bold">
                                {rec.status}
                              </span>
                              <span className="font-mono-tabular text-xs text-[#686C77]">
                                {rec.department} — {rec.city}
                              </span>
                            </div>

                            {/* Entity Name & Process Title */}
                            <div className="text-xs font-mono-tabular font-bold uppercase text-[#3E4149]">
                              {rec.entity_name} (NIT: {rec.entity_nit})
                            </div>
                            <h3 className="text-base md:text-lg font-bold text-[#0B0C0E] mt-1">
                              {rec.title}
                            </h3>
                            <p className="text-xs md:text-sm text-[#3E4149] mt-1.5 leading-relaxed max-w-[85ch]">
                              {rec.description}
                            </p>
                          </div>

                          {/* Right Financial & Action Column */}
                          <div className="lg:text-right flex flex-col justify-between shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#CFCFC7]">
                            <div>
                              <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                                PRESUPUESTO OFICIAL / VALOR
                              </span>
                              <div className="font-mono-tabular text-lg md:text-xl font-bold text-[#0B0C0E]">
                                {formatCopCurrency(rec.base_price_cop)}
                              </div>
                              <div className="font-mono-tabular text-[11px] text-[#3E4149] mt-0.5">
                                Publicado: {rec.publication_date} | Cierre: {rec.closing_date}
                              </div>
                            </div>

                            <div className="flex flex-wrap lg:justify-end gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleInspectOpportunity(rec)}
                                disabled={inspectingProcessId === rec.process_id}
                                className="min-h-[38px] px-3 py-1.5 bg-[#F4F4F0] border border-[#121316] hover:bg-[#0B0C0E] hover:text-[#FFFFFF] font-mono-tabular text-[11px] font-semibold uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Network className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                                {inspectingProcessId === rec.process_id
                                  ? 'Inspeccionando DOM...'
                                  : 'Spider Expediente'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProcessId(isExpanded ? null : rec.process_id)
                                }
                                className="min-h-[38px] px-3 py-1.5 bg-[#FFFFFF] border border-[#121316] hover:bg-[#EAEAE4] font-mono-tabular text-[11px] font-semibold uppercase cursor-pointer"
                              >
                                {isExpanded ? 'Ocultar Ficha RAG' : 'Ver Ficha RAG'}
                              </button>

                              <a
                                href={rec.process_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[38px] px-3 py-1.5 bg-[#0B0C0E] text-[#FFFFFF] hover:bg-[#D9381E] font-mono-tabular text-[11px] font-semibold uppercase flex items-center gap-1 transition-colors"
                              >
                                SECOP II
                                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Technical Dossier & Live Spider Telemetry */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-[#121316] bg-[#F4F4F0] p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-7">
                              <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#D9381E] block mb-2">
                                PREVISUALIZACIÓN DE CHUNK MARKDOWN CON CONTEXTO INYECTADO PARA RAG:
                              </span>
                              <pre className="p-3 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-[11px] whitespace-pre-wrap overflow-x-auto text-[#0B0C0E]">
{`# [SECOP II] ${rec.process_id} — ${rec.entity_name}
- Referencia: ${rec.reference} | NIT: ${rec.entity_nit}
- Ubicación: ${rec.department} (${rec.city})
- Modalidad: ${rec.modality} | Estado: ${rec.status}
- Cuantía Oficial: ${formatCopCurrency(rec.base_price_cop)} | UNSPSC: ${rec.unspsc_code}

## Objeto Contractual
${rec.description}

## Enlace Oficial al Expediente
${rec.process_url}`}
                              </pre>
                            </div>

                            <div className="lg:col-span-5 flex flex-col justify-between">
                              <div>
                                <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E] block mb-2">
                                  TELEMETRÍA SPIDER SOBRE EXPEDIENTE (OPPORTUNITY DETAIL):
                                </span>
                                {spiderInfo ? (
                                  <div className="p-3 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-xs space-y-1.5">
                                    <div>
                                      <span className="text-[#686C77]">Estado Inspección: </span>
                                      <span className="font-bold text-[#0D6E52]">
                                        {String(spiderInfo.inspected ? 'DOM RASTREADO EN VIVO' : 'RESILIENT METADATA')}
                                      </span>
                                    </div>
                                    {Boolean(spiderInfo.http_status) && (
                                      <div>
                                        <span className="text-[#686C77]">HTTP Status / Latencia: </span>
                                        <span className="font-bold">
                                          HTTP {String(spiderInfo.http_status)} ({String(spiderInfo.latency_ms)} ms)
                                        </span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-[#686C77]">Token ASP.NET __VIEWSTATE: </span>
                                      <span className="font-bold">
                                        {spiderInfo.aspnet_viewstate_present ? 'DETECTADO' : 'NO REQUERIDO'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#686C77]">Tablas DOM del Expediente: </span>
                                      <span className="font-bold">
                                        {String(spiderInfo.dom_tables_detected ?? 0)} tablas detectadas
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-[#FFFFFF] border border-[#CFCFC7] text-xs text-[#3E4149]">
                                    Haz clic en <strong>"Spider Expediente"</strong> para lanzar el inspector DOM sobre la página transaccional de este proceso en <code>community.secop.gov.co</code>.
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRunSpider(rec.process_url)}
                                  className="px-3 py-2 bg-[#0B0C0E] text-[#FFFFFF] font-mono-tabular text-xs font-semibold uppercase flex items-center gap-1.5 cursor-pointer"
                                >
                                  Abrir URL en Módulo Spider Completo
                                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="font-mono-tabular text-sm font-bold text-[#0B0C0E]">
                    SIN RESULTADOS PARA LOS FILTROS SELECCIONADOS
                  </p>
                  <p className="text-xs text-[#3E4149] mt-1">
                    Amplía el rango de cuantía o cambia la palabra clave para consultar nuevos expedientes en SECOP II.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =====================================================================
            MODULE 03: ADVANCED WEB SPIDER & LIVE LINK CLASSIFIER
           ===================================================================== */}
        {activeModule === 'SPIDER' && (
          <section aria-labelledby="spider-heading" className="border-b border-[#121316]">
            <div className="bg-[#EAEAE4] border-b border-[#121316] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#D9381E]">
                  SECCIÓN 03 // MOTOR SPIDER ASÍNCRONO (BFS/DFS + CLASIFICADOR DE ENLACES)
                </span>
                <h2 id="spider-heading" className="text-xl font-bold text-[#0B0C0E]">
                  Rastreador Estructural de Páginas, Pliegos y Árbol de Enlaces del SECOP II
                </h2>
              </div>
              <span className="font-mono-tabular text-xs bg-[#FFFFFF] border border-[#121316] px-3 py-1.5">
                Detecta __VIEWSTATE, cabeceras HTTP, jerarquía H1-H3 y clasifica enlaces por relevancia RAG
              </span>
            </div>

            {/* Spider Control Form */}
            <div className="bg-[#FFFFFF] border-b border-[#121316] p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#686C77]">
                  SEMILLAS OFICIALES RECOMENDADAS:
                </span>
                {SPIDER_PRESET_SEEDS.map((seed) => (
                  <button
                    key={seed.url}
                    type="button"
                    onClick={() => handleRunSpider(seed.url)}
                    className={`px-2.5 py-1 font-mono-tabular text-xs border border-[#121316] cursor-pointer ${
                      spiderSeedUrl === seed.url
                        ? 'bg-[#0B0C0E] text-[#FFFFFF] font-bold'
                        : 'bg-[#F4F4F0] text-[#0B0C0E] hover:bg-[#EAEAE4]'
                    }`}
                  >
                    {seed.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-6 flex flex-col gap-1.5">
                  <label
                    htmlFor="spider-seed-input"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    URL Semilla para Rastreo Spider (SECOP II / Colombia Compra Eficiente)
                  </label>
                  <input
                    id="spider-seed-input"
                    type="url"
                    value={spiderSeedUrl}
                    onChange={(e) => setSpiderSeedUrl(e.target.value)}
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-xs"
                  />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="spider-depth"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    Profundidad Spider
                  </label>
                  <select
                    id="spider-depth"
                    value={spiderDepth}
                    onChange={(e) => setSpiderDepth(Number(e.target.value))}
                    className="min-h-[44px] px-3 py-2 bg-[#F4F4F0] border border-[#121316] font-mono-tabular text-xs"
                  >
                    <option value={1}>Nivel 1 (Directo)</option>
                    <option value={2}>Nivel 2 (Recursivo)</option>
                  </select>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="spider-cat-filter"
                    className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]"
                  >
                    Filtrar Tipo de Enlace
                  </label>
                  <select
                    id="spider-cat-filter"
                    value={spiderCategoryFilter}
                    onChange={(e) => setSpiderCategoryFilter(e.target.value)}
                    className="min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-xs"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="EXPEDIENTE_PROCESO">EXPEDIENTE_PROCESO</option>
                    <option value="PLIEGO_ANEXO_DOC">PLIEGO_ANEXO_DOC</option>
                    <option value="DATOS_ABIERTOS_API">DATOS_ABIERTOS_API</option>
                    <option value="NORMATIVA_MANUAL">NORMATIVA_MANUAL</option>
                    <option value="PORTAL_TRANSACCIONAL">PORTAL_TRANSACCIONAL</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => handleRunSpider()}
                    disabled={loadingSpider}
                    className="w-full min-h-[44px] px-4 py-2 bg-[#0B0C0E] text-[#FFFFFF] hover:bg-[#D9381E] font-mono-tabular text-xs font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {loadingSpider ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Rastreando...
                      </>
                    ) : (
                      <>
                        <Network className="w-3.5 h-3.5" aria-hidden="true" />
                        Lanzar Spider
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {spiderError && (
              <div className="p-5 bg-[#FFFFFF] border-b border-[#121316] text-[#D9381E] font-mono-tabular text-xs">
                {spiderError}
              </div>
            )}

            {/* Spider Results Matrix */}
            {loadingSpider ? (
              <div className="p-8 bg-[#FFFFFF] space-y-4">
                <div className="h-24 bg-[#F4F4F0] border border-[#CFCFC7] animate-pulse" />
                <div className="h-64 bg-[#F4F4F0] border border-[#CFCFC7] animate-pulse" />
              </div>
            ) : (
              spiderResult && (
                <div className="bg-[#FFFFFF]">
                  {/* Telemetry Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-[#121316] border-b border-[#121316] bg-[#F4F4F0]">
                    <div className="p-4">
                      <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                        ESTADO HTTP / LATENCIA
                      </span>
                      <span className="font-mono-tabular text-base font-bold text-[#0D6E52] mt-0.5 block">
                        HTTP {spiderResult.http_status} // {spiderResult.latency_ms} ms
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                        ENLACES DESCUBIERTOS
                      </span>
                      <span className="font-mono-tabular text-base font-bold text-[#0B0C0E] mt-0.5 block">
                        {spiderResult.total_links_discovered} NODOS
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                        SESIÓN ASP.NET __VIEWSTATE
                      </span>
                      <span className="font-mono-tabular text-base font-bold text-[#D9381E] mt-0.5 block">
                        {spiderResult.aspnet_viewstate_detected ? 'DETECTADO' : 'ESTÁNDAR REST/HTML'}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                        SERVIDOR / GATEWAY
                      </span>
                      <span className="font-mono-tabular text-xs font-bold text-[#0B0C0E] mt-1 block truncate">
                        {spiderResult.server_header}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                        MODO DE EJECUCIÓN
                      </span>
                      <span className="font-mono-tabular text-xs font-bold text-[#0B0C0E] mt-1 block">
                        {spiderResult.execution_mode}
                      </span>
                    </div>
                  </div>

                  {/* Category Breakdown & Extracted Headings */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#121316] border-b border-[#121316]">
                    <div className="lg:col-span-5 p-6">
                      <h3 className="font-mono-tabular text-xs font-bold uppercase text-[#0B0C0E] mb-3">
                        DISTRIBUCIÓN DE ENLACES POR TIPO DE INFORMACIÓN:
                      </h3>
                      <div className="space-y-2.5">
                        {Object.entries(spiderResult.category_breakdown).map(([cat, count]) => {
                          const pct = Math.min(
                            100,
                            Math.round((count / Math.max(1, spiderResult.total_links_discovered)) * 100)
                          );
                          return (
                            <div key={cat} className="font-mono-tabular text-xs">
                              <div className="flex justify-between mb-1">
                                <span className="font-semibold">{cat}</span>
                                <span className="font-bold">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-[#EAEAE4] border border-[#121316]">
                                <div
                                  className="h-full bg-[#D9381E]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-7 p-6 bg-[#F4F4F0]">
                      <h3 className="font-mono-tabular text-xs font-bold uppercase text-[#0B0C0E] mb-2">
                        TÍTULO DOM: {spiderResult.page_title}
                      </h3>
                      <p className="text-xs text-[#3E4149] mb-4">{spiderResult.meta_description}</p>
                      <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#686C77] block mb-2">
                        JERARQUÍA DE ENCABEZADOS EXTRAÍDOS (H1 / H2 / H3):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {spiderResult.extracted_headings.map((h, i) => (
                          <span
                            key={i}
                            className="font-mono-tabular text-[11px] px-2.5 py-1 bg-[#FFFFFF] border border-[#121316]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Discovered Links Table */}
                  <div className="divide-y divide-[#CFCFC7]">
                    <div className="px-6 py-3 bg-[#EAEAE4] font-mono-tabular text-xs font-bold uppercase flex items-center justify-between">
                      <span>ÁRBOL DE ENLACES CLASIFICADOS ({spiderResult.discovered_links.length})</span>
                      <span>HAZ CLIC EN "SPIDER" PARA NAVEGAR RECURSIVAMENTE ESE NODO</span>
                    </div>

                    {spiderResult.discovered_links.map((node, i) => (
                      <div
                        key={`${node.url}-${i}`}
                        className="px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F4F4F0]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono-tabular text-[10px] font-bold px-2 py-0.5 bg-[#0B0C0E] text-[#FFFFFF]">
                              {node.category}
                            </span>
                            <span
                              className={`font-mono-tabular text-[10px] font-bold px-2 py-0.5 border ${
                                node.rag_relevance === 'ALTA'
                                  ? 'border-[#0D6E52] text-[#0D6E52] bg-[#FFFFFF]'
                                  : 'border-[#686C77] text-[#3E4149]'
                              }`}
                            >
                              VALOR RAG: {node.rag_relevance}
                            </span>
                            <span className="font-mono-tabular text-[10px] text-[#686C77]">
                              PROFUNDIDAD: NIVEL {node.depth}
                            </span>
                            {node.file_extension && (
                              <span className="font-mono-tabular text-[10px] font-bold px-2 py-0.5 bg-[#D9381E] text-[#FFFFFF] uppercase">
                                .{node.file_extension}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-[#0B0C0E] truncate">
                            {node.anchor_text}
                          </div>
                          <div className="font-mono-tabular text-xs text-[#3E4149] truncate">
                            {node.url}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRunSpider(node.url)}
                            className="min-h-[36px] px-3 py-1 bg-[#FFFFFF] border border-[#121316] hover:bg-[#0B0C0E] hover:text-[#FFFFFF] font-mono-tabular text-[11px] font-semibold uppercase cursor-pointer transition-colors"
                          >
                            Spider Aquí
                          </button>
                          <a
                            href={node.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[36px] px-3 py-1 bg-[#F4F4F0] border border-[#121316] hover:bg-[#EAEAE4] font-mono-tabular text-[11px] font-semibold uppercase flex items-center gap-1"
                          >
                            Abrir
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </section>
        )}

        {/* =====================================================================
            MODULE 04: DYNAMIC API GENERATOR & RAG PIPELINE STUDIO
           ===================================================================== */}
        {activeModule === 'RAG_API' && (
          <section aria-labelledby="rag-heading" className="border-b border-[#121316]">
            <div className="bg-[#EAEAE4] border-b border-[#121316] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#D9381E]">
                  SECCIÓN 04 // GENERADOR DINÁMICO DE API REST & CHUNKS PARA RAG
                </span>
                <h2 id="rag-heading" className="text-xl font-bold text-[#0B0C0E]">
                  Pipeline de Vectorización, Exportación JSONL y Endpoints Listos para Conectar a un RAG
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSynthesizeRag(false)}
                  className="min-h-[40px] px-4 py-2 bg-[#0B0C0E] text-[#FFFFFF] font-mono-tabular text-xs font-bold uppercase flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Regenerar Chunks
                </button>
                <button
                  type="button"
                  onClick={downloadRagJsonl}
                  disabled={!ragPipeline}
                  className="min-h-[40px] px-4 py-2 bg-[#D9381E] text-[#FFFFFF] font-mono-tabular text-xs font-bold uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Descargar .JSONL para Vector DB
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#121316] bg-[#FFFFFF]">
              {/* Left 5 Columns: Create & Inspect Live Custom API Feeds */}
              <div className="lg:col-span-5 divide-y divide-[#121316]">
                {/* Form to create a new Dynamic RAG API Endpoint from current filters */}
                <form onSubmit={handleCreateCustomApiFeed} className="p-6 bg-[#F4F4F0]">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-[#D9381E]" aria-hidden="true" />
                    <h3 className="font-mono-tabular text-xs font-bold uppercase text-[#0B0C0E]">
                      PUBLICAR NUEVA API DE INFORMACIÓN DESDE TUS FILTROS
                    </h3>
                  </div>
                  <p className="text-xs text-[#3E4149] mb-4">
                    Crea un endpoint persistente (REST JSON + JSONL + OpenAPI 3.1) con los filtros actuales (
                    <code>{filters.keyword || 'todos los procesos'}</code>) para conectarlo directo a LangChain, LlamaIndex, Qdrant o n8n.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="feed-name-input"
                        className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E] block mb-1"
                      >
                        Nombre del Endpoint / Feed RAG
                      </label>
                      <input
                        id="feed-name-input"
                        type="text"
                        required
                        value={newFeedName}
                        onChange={(e) => setNewFeedName(e.target.value)}
                        placeholder="Ej. Licitaciones Ciberseguridad Bogotá 2026"
                        className="w-full min-h-[42px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="chunk-size-input"
                          className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E] block mb-1"
                        >
                          Tamaño de Chunk (Caract.)
                        </label>
                        <input
                          id="chunk-size-input"
                          type="number"
                          min={500}
                          max={4000}
                          step={100}
                          value={chunkSizeChars}
                          onChange={(e) => setChunkSizeChars(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-[#FFFFFF] border border-[#121316] font-mono-tabular text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={creatingFeed}
                          className="w-full min-h-[42px] px-4 py-2 bg-[#D9381E] text-[#FFFFFF] hover:bg-[#B82D16] font-mono-tabular text-xs font-bold uppercase cursor-pointer transition-colors"
                        >
                          {creatingFeed ? 'Publicando API...' : '+ Crear Endpoint API'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Active Custom API Feeds List */}
                <div className="p-6">
                  <span className="font-mono-tabular text-xs font-bold uppercase text-[#0B0C0E] block mb-3">
                    ENDPOINTS API PUBLICADOS Y LISTOS PARA RAG ({customFeeds.length}):
                  </span>
                  <div className="space-y-2.5">
                    {customFeeds.map((feed) => {
                      const isSelected = feed.slug === (activeFeed?.slug || '');
                      return (
                        <button
                          key={feed.slug}
                          type="button"
                          onClick={() => setSelectedFeedSlug(feed.slug)}
                          className={`w-full text-left p-4 border border-[#121316] transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#0B0C0E] text-[#FFFFFF]'
                              : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#F4F4F0]'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                            <span className="font-bold text-[#D9381E]">
                              /api/v1/feeds/{feed.slug}/rag
                            </span>
                            <span>CHUNK: {feed.chunk_size_chars}c</span>
                          </div>
                          <div className="text-sm font-bold mt-1">{feed.name}</div>
                          <div
                            className={`text-xs mt-0.5 ${
                              isSelected ? 'text-[#CFCFC7]' : 'text-[#3E4149]'
                            }`}
                          >
                            {feed.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Feed Endpoints & Code Snippets */}
                  {activeFeed && (
                    <div className="mt-6 pt-5 border-t border-[#121316] space-y-4">
                      <div>
                        <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#686C77] block mb-2">
                          URLS DEL ENDPOINT ACTIVO ({activeFeed.name}):
                        </span>
                        <div className="space-y-1.5 font-mono-tabular text-[11px]">
                          {Object.entries(activeFeed.endpoints).map(([k, url]) => (
                            <div
                              key={k}
                              className="p-2 bg-[#F4F4F0] border border-[#CFCFC7] flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{url}</span>
                              <a
                                href={url.replace('http://localhost:8010', '').replace('http://localhost:8000', '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-[#FFFFFF] border border-[#121316] font-bold uppercase shrink-0 hover:bg-[#EAEAE4]"
                              >
                                Probar GET
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#0B0C0E]">
                            CONECTOR PYTHON (LANGCHAIN / VECTOR STORE):
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                'langchain',
                                activeFeed.integration_snippets.langchain_python
                              )
                            }
                            className="font-mono-tabular text-[10px] px-2 py-0.5 border border-[#121316] bg-[#F4F4F0] cursor-pointer"
                          >
                            {copiedKey === 'langchain' ? 'COPIADO' : 'COPIAR CÓDIGO'}
                          </button>
                        </div>
                        <pre className="p-3 bg-[#0B0C0E] text-[#F4F4F0] font-mono-tabular text-[11px] overflow-x-auto">
                          {activeFeed.integration_snippets.langchain_python}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 7 Columns: Semantic Chunks Inspector & Metadata Payload */}
              <div className="lg:col-span-7 p-6 flex flex-col justify-between">
                {loadingRag ? (
                  <div className="space-y-4">
                    <div className="h-16 bg-[#F4F4F0] border border-[#CFCFC7] animate-pulse" />
                    <div className="h-96 bg-[#F4F4F0] border border-[#CFCFC7] animate-pulse" />
                  </div>
                ) : ragPipeline && ragPipeline.chunks.length > 0 ? (
                  <div>
                    {/* Pipeline Summary Header */}
                    <div className="grid grid-cols-3 gap-3 p-4 bg-[#F4F4F0] border border-[#121316] mb-5">
                      <div>
                        <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                          CHUNKS GENERADOS
                        </span>
                        <span className="font-mono-tabular text-lg font-bold text-[#0B0C0E]">
                          {ragPipeline.total_chunks} CHUNKS
                        </span>
                      </div>
                      <div>
                        <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                          TOKENS ESTIMADOS
                        </span>
                        <span className="font-mono-tabular text-lg font-bold text-[#0D6E52]">
                          ~{ragPipeline.total_estimated_tokens.toLocaleString()} TOKENS
                        </span>
                      </div>
                      <div>
                        <span className="font-mono-tabular text-[10px] uppercase text-[#686C77] block">
                          MODELO EMBEDDING SUGERIDO
                        </span>
                        <span className="font-mono-tabular text-xs font-bold text-[#0B0C0E] block mt-1">
                          bge-m3 / text-embedding-3
                        </span>
                      </div>
                    </div>

                    {/* Chunk Selector Pills */}
                    <div className="mb-4">
                      <span className="font-mono-tabular text-[11px] font-bold uppercase text-[#686C77] block mb-2">
                        SELECCIONA UN CHUNK PARA INSPECCIONAR SU TEXTO Y METADATOS VECTORIALES:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                        {ragPipeline.chunks.map((c, idx) => (
                          <button
                            key={c.chunk_id}
                            type="button"
                            onClick={() => setSelectedChunkIndex(idx)}
                            className={`px-2.5 py-1 font-mono-tabular text-[11px] border border-[#121316] cursor-pointer ${
                              idx === selectedChunkIndex
                                ? 'bg-[#D9381E] text-[#FFFFFF] font-bold'
                                : 'bg-[#FFFFFF] text-[#0B0C0E] hover:bg-[#EAEAE4]'
                            }`}
                          >
                            #{idx + 1} // {c.doc_id} ({c.token_estimate}t)
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Chunk View */}
                    {activeChunk && (
                      <div className="space-y-4">
                        <div className="border border-[#121316]">
                          <div className="px-4 py-2.5 bg-[#0B0C0E] text-[#FFFFFF] font-mono-tabular text-xs flex items-center justify-between">
                            <span>
                              CHUNK ID: {activeChunk.chunk_id} // HASH: {activeChunk.content_hash}
                            </span>
                            <span>{activeChunk.char_count} chars</span>
                          </div>
                          <pre className="p-4 bg-[#F4F4F0] font-mono-tabular text-xs whitespace-pre-wrap text-[#0B0C0E] overflow-x-auto">
                            {activeChunk.text}
                          </pre>
                        </div>

                        <div className="border border-[#121316]">
                          <div className="px-4 py-2 bg-[#EAEAE4] border-b border-[#121316] font-mono-tabular text-xs font-bold uppercase">
                            PAYLOAD DE METADATOS PARA FILTRADO HÍBRIDO EN VECTOR DB (QDRANT / CHROMA / PGVECTOR):
                          </div>
                          <pre className="p-4 bg-[#FFFFFF] font-mono-tabular text-xs text-[#0B0C0E] overflow-x-auto">
                            {JSON.stringify(activeChunk.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="font-mono-tabular text-sm font-bold">
                      HAZ CLIC EN "REGENERAR CHUNKS" PARA SINTETIZAR EL PIPELINE RAG
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* SWISS ARCHITECTURAL FOOTER */}
      <footer className="border-t border-[#121316] bg-[#FFFFFF] mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono-tabular text-xs text-[#3E4149]">
          <div>
            SKILL INSTALADA: <strong>secop2-hybrid-scraper-rag</strong> // ARQUETIPO: MINIMALISMO SUIZO INSTITUCIONAL
          </div>
          <div>
            FASTAPI + SODA SoQL + ASYNC DOM SPIDER + OPENAPI 3.1 RAG ENGINE
          </div>
        </div>
      </footer>
    </div>
  );
}
