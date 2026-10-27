# SECOP II Taxonomy, Principal Links & Extraction Endpoints Reference

## 1. Taxonomía de Información del Ecosistema SECOP II

El ecosistema de contratación pública de Colombia Compra Eficiente se divide en **7 dominios estructurales de información**:

| ID | Dominio de Información | Fuente Primaria | Método de Extracción | Tipo de Datos para RAG |
| :--- | :--- | :--- | :--- | :--- |
| `DOM-01` | **Procesos de Contratación (Convocatorias y Licitaciones)** | `datos.gov.co/resource/jbjy-vk9h.json` + `community.secop.gov.co` | Híbrido: SODA SoQL + Spider HTML `OpportunityDetail` | Objeto contractual, cuantía, cronograma, entidad, modalidad, UNSPSC, estado. |
| `DOM-02` | **Contratos Electrónicos Adjudicados y en Ejecución** | `datos.gov.co/resource/p6dx-8zbt.json` | SODA SoQL + Deep Link de Contrato | Proveedor adjudicado, NIT proveedor, valor del contrato, fechas de inicio/fin, enlaces a minutas. |
| `DOM-03` | **Buscador Público Transaccional SECOP II** | `community.secop.gov.co/Public/Tendering/ContractNoticeManagement/Index` | Spider Web + Manejo de sesión ASP.NET (`__VIEWSTATE`) | Pliegos definitivos, estudios previos, observaciones, adendas, respuestas a oferentes. |
| `DOM-04` | **Tienda Virtual del Estado Colombiano (TVEC)** | `www.colombiacompra.gov.co/tienda-virtual-del-estado-colombiano` | Spider de Catálogo y Acuerdos Marco | Acuerdos Marco de Precios vigentes, catálogos de nube, software, conectividad y grandes superficies. |
| `DOM-05` | **Documentos Tipo y Normativa Contractual** | `www.colombiacompra.gov.co/documentos-tipo/documentos-tipo` | Spider Documental (HTML + enlaces a PDF/DOCX/XLSX) | Pliegos tipo obligatorios para infraestructura, interventoría, consultoría y sistemas. |
| `DOM-06` | **Plan Anual de Adquisiciones (PAA)** | `www.colombiacompra.gov.co/plan-anual-de-adquisiciones` + SODA PAA | SODA API + Spider Institucional | Proyección de compras futuras de entidades estatales por vigencia fiscal y código UNSPSC. |
| `DOM-07` | **API OCDS (Open Contracting Data Standard)** | `www.colombiacompra.gov.co/transparencia-y-acceso-a-la-informacion-publica/datos-abiertos` | REST JSON Releases (`planning`, `tender`, `award`, `contract`) | Trazabilidad completa del ciclo de contratación bajo estándar internacional OCDS. |

---

## 2. Diccionario de Campos Clave SODA (`jbjy-vk9h` — Procesos SECOP II)

- `id_del_proceso`: Identificador interno único (ej. `CO1.REQ.4829102`)
- `referencia_del_proceso`: Referencia institucional asignada por la entidad
- `entidad`: Nombre oficial de la Entidad Estatal
- `nit_entidad`: NIT de la Entidad Estatal
- `departamento_entidad`: Departamento de ubicación de la entidad
- `ciudad_entidad`: Municipio/Ciudad de la entidad
- `orden_entidad`: Nivel (`Nacional`, `Territorial`, `Corporación Autónoma`)
- `nombre_del_procedimiento`: Título del proceso de contratación
- `descripci_n_del_procedimiento`: Objeto contractual detallado (campo crítico para embeddings RAG)
- `fase`: Fase actual del proceso (`Presentación de oferta`, `Presentación de observaciones`, `Seleccionado`)
- `estado_del_procedimiento`: Estado (`Publicado`, `Abierto`, `Evaluación`, `Adjudicado`, `Celebrado`, `Cancelado`)
- `precio_base`: Presupuesto oficial estimado en COP
- `modalidad_de_contratacion`: Modalidad (`Licitación pública`, `Selección abreviada menor cuantía`, `Mínima cuantía`, `Contratación directa`, `Concurso de méritos`, `Solicitud de información a los Proveedores`)
- `fecha_de_publicacion_del`: Fecha oficial de publicación
- `fecha_de_ultima_publicaci`: Última actualización en plataforma
- `fecha_de_recepcion_de`: Fecha límite de recepción de ofertas
- `codigo_principal_de_categoria`: Código clasificador de bienes y servicios UNSPSC (ej. `V1.80111600`)
- `urlproceso`: Objeto o URL hacia `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=...`

---

## 3. Anatomía Técnica del Spider sobre `community.secop.gov.co`

Las páginas de detalle de proceso en SECOP II (`OpportunityDetail/Index?noticeUID=CO1.NTC.*`) utilizan **ASP.NET WebForms / MVC híbrido** de Vortal:
- **Cabeceras requeridas**: `User-Agent` realista de navegador moderno, `Accept-Language: es-CO,es;q=0.9,en;q=0.8`.
- **Campos ocultos ASP.NET**: `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTTARGET`, `__EVENTARGUMENT`.
- **Extracción de Tablas y Anexos**:
  - Los metadatos clave del expediente se ubican en contenedores `.VortalTable`, `.SectionPanel`, tablas con atributos `id*="tbl"` o filas de formulario `tr.FormRow`.
  - Los documentos anexos (Pliegos, Estudios Previos, Adendas) usan enlaces con patrones `AttachmentDownload`, `DownloadDocument`, o extensiones `.pdf`, `.docx`, `.xlsx`, `.zip`.
