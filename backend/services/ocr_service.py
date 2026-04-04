"""
ocr_service.py
Extrae datos de facturas desde PDFs usando AI con contexto de la base de datos.

Características:
- Normaliza proveedores contra los ya existentes en la DB
- Valida fechas (solo 2024+) con corrección inteligente de errores OCR
- Aprende de correcciones del usuario (ocr_hints.json)
- Toma referencia de categorías de residuos ya usadas por cada proveedor
"""
from __future__ import annotations

import io
import json
import os
import urllib.request
import urllib.error
from typing import Any, Dict, List

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

BASE_DIR   = os.path.dirname(os.path.dirname(__file__))
HINTS_PATH = os.path.join(BASE_DIR, "data", "ocr_hints.json")

MIN_INVOICE_YEAR = 2024

RECYCLABLE_RESIDUES = {
    "plastico": "Plástico",
    "carton":   "Cartón",
    "papel":    "Papel",
    "vidrio":   "Vidrio",
    "metal":    "Metales",
    "tetrapak": "Tetrapak",
    "organico": "Orgánico",
    "textil":   "Textil",
    "raee":     "RAEE",
    "otros":    "Otros",
}

DOMICILIARY_RESIDUES = {
    "relleno_sanitario": "Relleno sanitario",
}


class OCRService:
    """
    Importación inteligente de facturas desde PDF.

    Flujo:
    1. Extrae texto del PDF con pdfplumber (texto + tablas)
    2. Construye contexto desde la DB (proveedores conocidos, categorías, fechas)
    3. Carga hints aprendidos de correcciones previas del usuario
    4. Llama al AI con prompt enriquecido para extraer y normalizar datos
    5. Retorna JSON listo para preview editable en el frontend
    """

    OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, invoice_service, api_key: str, model: str) -> None:
        self.invoice_service = invoice_service
        self.api_key = api_key
        self.model = model

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def parse_pdf(
        self,
        pdf_bytes: bytes,
        invoice_type: str | None = None,
        certificate_bytes: bytes | None = None,
    ) -> Dict[str, Any]:
        """Extrae y normaliza datos de una factura PDF. Retorna dict para preview."""
        if not HAS_PDFPLUMBER:
            raise RuntimeError(
                "pdfplumber no está instalado. Ejecuta: pip install pdfplumber"
            )

        text = self._extract_text(pdf_bytes)
        if not text.strip():
            raise ValueError(
                "No se pudo extraer texto del PDF. "
                "¿Es un PDF escaneado sin capa de texto?"
            )

        # If a certificate PDF was provided, append its text as extra context
        if certificate_bytes:
            cert_text = self._extract_text(certificate_bytes)
            if cert_text.strip():
                text += "\n\n--- CERTIFICADO DE RECICLAJE ---\n" + cert_text

        context = self._build_context()
        hints   = self._load_hints()
        result  = self._call_ai(text, context, hints, invoice_type=invoice_type)
        return result

    def learn_correction(self, raw: Dict[str, Any], corrected: Dict[str, Any]) -> None:
        """
        Guarda correcciones hechas por el usuario en el preview para mejorar
        futuros análisis OCR.
        """
        hints   = self._load_hints()
        changed = False

        # Proveedor
        raw_p  = (raw.get("provider") or "").strip()
        corr_p = (corrected.get("provider") or "").strip()
        if raw_p and corr_p and raw_p.upper() != corr_p.upper():
            hints.setdefault("provider_mappings", {})[raw_p.upper()] = corr_p
            changed = True

        # Categorías de items
        for raw_item, corr_item in zip(
            raw.get("items", []), corrected.get("items", [])
        ):
            raw_cat  = (raw_item.get("residue_category") or "").strip()
            corr_cat = (corr_item.get("residue_category") or "").strip()
            if raw_cat and corr_cat and raw_cat != corr_cat:
                hints.setdefault("category_mappings", {})[raw_cat] = corr_cat
                changed = True

        if changed:
            self._save_hints(hints)

    # ------------------------------------------------------------------ #
    # PDF text extraction
    # ------------------------------------------------------------------ #

    def _extract_text(self, pdf_bytes: bytes) -> str:
        parts: List[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                # Primary extraction: default layout
                page_text = page.extract_text() or ""
                if page_text:
                    parts.append(page_text)

                # Secondary extraction: x_density layout to capture multi-column
                # headers (e.g. "Fecha Emisión" on the right side of the page)
                try:
                    alt_text = page.extract_text(layout=True, x_density=7.25) or ""
                    if alt_text and alt_text.strip() != page_text.strip():
                        parts.append(alt_text)
                except Exception:
                    pass

                # Include tables for structured data (amounts, quantities)
                for table in page.extract_tables():
                    for row in table:
                        if row:
                            parts.append(
                                " | ".join(str(cell or "").strip() for cell in row)
                            )
        return "\n".join(parts)

    # ------------------------------------------------------------------ #
    # Context building from DB
    # ------------------------------------------------------------------ #

    def _build_context(self) -> Dict[str, Any]:
        """Construye contexto de facturas existentes para enriquecer el prompt."""
        try:
            invoices = self.invoice_service.list_invoices()
        except Exception:
            return {
                "known_providers": [],
                "categories_by_provider": {},
                "date_range": {},
                "total_invoices": 0,
            }

        providers:              Dict[str, int]              = {}
        categories_by_provider: Dict[str, Dict[str, int]]  = {}
        dates: List[str] = []

        for inv in invoices:
            p = (inv.get("provider") or "").strip()
            if p:
                providers[p] = providers.get(p, 0) + 1

            d = inv.get("date", "")
            if d:
                dates.append(d)

            for item in inv.get("items", []):
                cat = item.get("residue_category")
                if cat and p:
                    categories_by_provider.setdefault(p, {})
                    categories_by_provider[p][cat] = (
                        categories_by_provider[p].get(cat, 0) + 1
                    )

        sorted_providers = sorted(providers.items(), key=lambda x: -x[1])

        return {
            "known_providers": [
                {
                    "name": name,
                    "count": count,
                    "common_categories": sorted(
                        categories_by_provider.get(name, {}).items(),
                        key=lambda x: -x[1],
                    ),
                }
                for name, count in sorted_providers
            ],
            "date_range": {
                "min": min(dates) if dates else f"{MIN_INVOICE_YEAR}-01-01",
                "max": max(dates) if dates else None,
            },
            "total_invoices": len(invoices),
        }

    # ------------------------------------------------------------------ #
    # AI extraction
    # ------------------------------------------------------------------ #

    def _call_ai(
        self,
        text: str,
        context: Dict[str, Any],
        hints: Dict[str, Any],
        invoice_type: str | None = None,
    ) -> Dict[str, Any]:

        # ── Sección de proveedores conocidos ──────────────────────────────
        if context.get("known_providers"):
            provider_lines = []
            for p in context["known_providers"]:
                cats = (
                    ", ".join(k for k, _ in p["common_categories"][:3])
                    if p["common_categories"]
                    else "sin categorías previas"
                )
                provider_lines.append(
                    f'  - "{p["name"]}" ({p["count"]} facturas, residuos: {cats})'
                )
            known_providers_block = "\n".join(provider_lines)
        else:
            known_providers_block = "  (sin facturas previas en el sistema)"

        # ── Correcciones aprendidas ────────────────────────────────────────
        learned_block = ""
        if hints.get("provider_mappings"):
            lines = [
                f'  - "{k}" → "{v}"'
                for k, v in hints["provider_mappings"].items()
            ]
            learned_block += (
                "\nCORRECCIONES DE PROVEEDOR APRENDIDAS (aplica SIEMPRE sin excepción):\n"
                + "\n".join(lines)
            )
        if hints.get("category_mappings"):
            lines = [
                f'  - "{k}" → "{v}"'
                for k, v in hints["category_mappings"].items()
            ]
            learned_block += (
                "\nCORRECCIONES DE CATEGORÍA APRENDIDAS (aplica SIEMPRE sin excepción):\n"
                + "\n".join(lines)
            )

        valid_recyclable   = ", ".join(RECYCLABLE_RESIDUES.keys())
        valid_domiciliary  = ", ".join(DOMICILIARY_RESIDUES.keys())
        date_range = context.get("date_range", {})

        # Type hint from user selection
        if invoice_type == "recyclable":
            type_hint_block = (
                "\n══════════════════════════════════════════════════════\n"
                "TIPO DE FACTURA CONFIRMADO POR EL USUARIO\n"
                "══════════════════════════════════════════════════════\n"
                'El usuario indicó que es una factura RECICLABLE. Usa type="recyclable" y\n'
                "solo categorías reciclables para los ítems.\n"
            )
        elif invoice_type == "domiciliary":
            type_hint_block = (
                "\n══════════════════════════════════════════════════════\n"
                "TIPO DE FACTURA CONFIRMADO POR EL USUARIO\n"
                "══════════════════════════════════════════════════════\n"
                'El usuario indicó que es una factura DOMICILIARIA. Usa type="domiciliary"\n'
                'y residue_category="relleno_sanitario" para todos los ítems.\n'
            )
        else:
            type_hint_block = ""

        prompt = f"""Eres un extractor experto de facturas de gestión de residuos en Chile.{type_hint_block}
Tu tarea es analizar el texto de un PDF y devolver un JSON estructurado con los datos de la factura.

══════════════════════════════════════════════════════
CONTEXTO DE LA BASE DE DATOS
══════════════════════════════════════════════════════
Total de facturas en el sistema: {context.get('total_invoices', 0)}
Rango de fechas registradas: {date_range.get('min', str(MIN_INVOICE_YEAR) + '-01-01')} → {date_range.get('max', 'hoy')}

PROVEEDORES CONOCIDOS (si detectas un nombre similar, usa EXACTAMENTE el nombre listado aquí):
{known_providers_block}
{learned_block}

══════════════════════════════════════════════════════
REGLAS CRÍTICAS — FECHAS
══════════════════════════════════════════════════════
1. Este sistema SOLO maneja facturas desde el año {MIN_INVOICE_YEAR} en adelante.
2. Si detectas un año < {MIN_INVOICE_YEAR} (ej: 2015, 2020, 2022), es casi con certeza
   un error de OCR o de impresión. NO lo uses tal cual.
3. En ese caso, infiere el año correcto usando:
   - El contexto del documento (mes, correlativo de folio, referencias a períodos)
   - Los años de facturas ya registradas en el sistema
   - El año más probable es 2024 o 2025
4. Reporta tu nivel de confianza en el campo "date_confidence".
5. Formato obligatorio: YYYY-MM-DD

══════════════════════════════════════════════════════
REGLAS DE NORMALIZACIÓN DE PROVEEDOR
══════════════════════════════════════════════════════
1. Si el proveedor detectado coincide (ignorando mayúsculas, acentos, Ltda/SPA/S.A.)
   con alguno de los proveedores conocidos → usa EXACTAMENTE ese nombre.
2. Si no hay match → usa Title Case (ej: "CICLO VERDE SPA" → "Ciclo Verde Spa").
3. Nunca mezcles formatos: o todo mayúsculas, o Title Case, no mezcles.

══════════════════════════════════════════════════════
REGLA 1 — NÚMERO DE FACTURA (FOLIO)
══════════════════════════════════════════════════════
Las facturas electrónicas chilenas tienen un campo "Folio N°" o "N°" en el encabezado
superior derecho. Es un número entero (ej: 14788, 4638, 1023).
- Busca el patrón: "Folio", "N°", "Nº", "Número", o un número de 3-6 dígitos destacado
  en el encabezado.
- Devuélvelo SIEMPRE como string (ej: "14788"). Si realmente no aparece, devuelve null.

══════════════════════════════════════════════════════
REGLA 2 — ÍTEMS: SOLO RESIDUOS CON UNIDAD DE PESO
══════════════════════════════════════════════════════
INSTRUCCIÓN ABSOLUTA: Incluye en "items" ÚNICAMENTE las líneas de la factura donde
la unidad de medida (columna UM o Unidad) sea una medida de PESO o MASA:
  TONELADAS, TON, KG, KILOGRAMOS, KGS

CUALQUIER línea con otra unidad → IGNORAR COMPLETAMENTE:
  CONTENEDOR, RETIRO, UNIDAD, UN, C/U, SERVICIO, FLETE, HRS, DÍAS → NO incluir

Ejemplos de lo que EXCLUIR (aunque tenga un monto):
  ✗ "ARRIENDO TOLVA 14M3" — unidad: CONTENEDOR
  ✗ "RETIRO AMPLIROLL TOLVA" — unidad: RETIRO
  ✗ "FLETE" — unidad: VIAJE
  ✗ "CARGO ADMINISTRATIVO" — unidad: SERVICIO

Ejemplos de lo que INCLUIR:
  ✓ "DISPOSICION RESIDUOS INDUSTRIALES ASIMILABLES" — unidad: TONELADAS → incluir
  ✓ "RETIRO RESIDUOS SOLIDOS DOMICILIARIOS" — unidad: TON → incluir
  ✓ "CARTON" — unidad: KG → incluir

En facturas DOMICILIARIAS habrá típicamente UN SOLO ítem de residuos.

══════════════════════════════════════════════════════
REGLA 3 — MONTOS EN PESOS CHILENOS (CLP)
══════════════════════════════════════════════════════
En Chile el punto (.) es separador de miles y la coma (,) es decimal.
Ejemplo: "328.100" = trescientos veintiocho mil cien = 328100 en JSON.
NUNCA interpretes "328.100" como 328.1 — eso es incorrecto.
- Si la factura muestra montos en $ (pesos): usa esos valores → currency="CLP"
- Si la factura muestra montos en UF: usa esos valores → currency="UF"
- Si muestra ambos: prefiere los $ (pesos) → currency="CLP"
- Los subtotales, IVA y total deben ser números enteros grandes (ej: 328100, 62339, 390439)
  no decimales pequeños como 328.1

══════════════════════════════════════════════════════
CATEGORÍAS DE RESIDUOS VÁLIDAS
══════════════════════════════════════════════════════
Tipo domiciliario : {valid_domiciliary}
Tipo reciclable   : {valid_recyclable}

Si una categoría en el documento no coincide exactamente con alguna de las anteriores,
elige la más cercana semánticamente.
Ejemplos: "HDPE", "PET", "polietileno" → plastico | "fierro", "acero", "aluminio" → metal
          "kraft", "corrugado" → carton | "tetra pak" → tetrapak

══════════════════════════════════════════════════════
TEXTO DEL PDF
══════════════════════════════════════════════════════
{text[:6000]}
══════════════════════════════════════════════════════

Devuelve ÚNICAMENTE JSON válido (sin markdown, sin explicaciones):
{{
  "number": "número de folio de la factura como string, o null si no aparece",
  "provider": "nombre normalizado",
  "provider_rut": "RUT si aparece, null si no",
  "date": "YYYY-MM-DD",
  "type": "domiciliary | recyclable",
  "currency": "CLP | UF",
  "items": [
    {{
      "description": "descripción del ítem",
      "residue_category": "clave válida de la lista",
      "unit": "TON | KG",
      "quantity": 0.0,
      "amount": 0.0
    }}
  ],
  "totals": {{
    "subtotal": 0.0,
    "tax": 0.0,
    "total": 0.0
  }},
  "date_confidence": "high | medium | low",
  "date_notes": "explicación si la fecha fue inferida o corregida, null si no hubo corrección"
}}"""

        payload = json.dumps({
            "model":       self.model,
            "messages":    [{"role": "user", "content": prompt}],
            "max_tokens":  3000,
            "temperature": 0.1,
        }).encode()

        req = urllib.request.Request(
            self.OPENROUTER_API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type":  "application/json",
                "HTTP-Referer":  "https://app-declaraciones.vercel.app",
                "X-Title":       "EcoMetrics OCR",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenRouter HTTP {e.code}: {body}") from e

        content = data["choices"][0]["message"]["content"].strip()

        return self._extract_json(content)

    # ------------------------------------------------------------------ #
    # JSON extraction (handles thinking models that write reasoning first)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _extract_json(content: str) -> Dict[str, Any]:
        """
        Robustly extract a JSON object from model output.
        Handles:
        - Pure JSON responses
        - Markdown code blocks (```json ... ```)
        - Thinking models that write reasoning before/after the JSON
        """
        import re

        # 1. Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 2. Strip markdown code blocks
        md_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if md_match:
            candidate = md_match.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        # 3. Find first '{' and last '}' — handles reasoning text before/after JSON
        start = content.find('{')
        end   = content.rfind('}')
        if start != -1 and end != -1 and end > start:
            candidate = content[start:end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        raise ValueError(
            f"El AI no devolvió JSON válido.\n"
            f"Contenido (primeros 500 chars): {content[:500]}"
        )

    # ------------------------------------------------------------------ #
    # Hints persistence
    # ------------------------------------------------------------------ #

    def _load_hints(self) -> Dict[str, Any]:
        if os.path.exists(HINTS_PATH):
            try:
                with open(HINTS_PATH, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_hints(self, hints: Dict[str, Any]) -> None:
        with open(HINTS_PATH, "w", encoding="utf-8") as f:
            json.dump(hints, f, ensure_ascii=False, indent=2)
