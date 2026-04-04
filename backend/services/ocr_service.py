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

    def parse_pdf(self, pdf_bytes: bytes) -> Dict[str, Any]:
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

        context = self._build_context()
        hints   = self._load_hints()
        result  = self._call_ai(text, context, hints)
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
                page_text = page.extract_text() or ""
                if page_text:
                    parts.append(page_text)
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

        prompt = f"""Eres un extractor experto de facturas de gestión de residuos en Chile.
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
  "number": "número de factura como string",
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
            "max_tokens":  1500,
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

        # Limpiar bloque markdown si el modelo lo incluye
        if content.startswith("```"):
            parts = content.split("```")
            content = parts[1] if len(parts) > 1 else content
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"El AI devolvió JSON inválido: {exc}\n"
                f"Contenido (primeros 500 chars): {content[:500]}"
            ) from exc

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
