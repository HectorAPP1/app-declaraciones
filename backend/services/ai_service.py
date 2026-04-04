"""
AI Assistant — EcoMetrics SINADER Assistant
Usa Google Gemini API almacenada de forma segura en el backend (nunca expuesta al frontend).
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Constantes de dominio
# ---------------------------------------------------------------------------

MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

LER_CODES: Dict[str, Dict[str, str]] = {
    "relleno_sanitario": {"code": "20 03 01", "label": "Residuos municipales mezclados (domiciliarios)"},
    "plastico":          {"code": "20 01 39", "label": "Plásticos"},
    "carton":            {"code": "20 01 01", "label": "Papel y cartón"},
    "papel":             {"code": "20 01 01", "label": "Papel y cartón"},
    "vidrio":            {"code": "20 01 02", "label": "Vidrio"},
    "metal":             {"code": "20 01 40", "label": "Metal (ferroso y no ferroso)"},
    "tetrapak":          {"code": "15 01 05", "label": "Envases compuestos (Tetrapak)"},
    "organico":          {"code": "20 01 08", "label": "Residuos biodegradables de cocinas"},
    "textil":            {"code": "20 01 10", "label": "Ropa y textiles"},
    "raee":              {"code": "20 01 35", "label": "Equipos eléctricos y electrónicos desechados"},
    "otros":             {"code": "20 03 99", "label": "Residuos municipales no especificados"},
}

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Eres el **Asistente SINADER** de EcoMetrics — una IA especializada exclusivamente en:

1. **Gestión de declaraciones SINADER** (portal: portalvu.mma.gob.cl/sinader/ — Ministerio del Medio Ambiente de Chile)
2. **Análisis de facturas de residuos** de la plataforma EcoMetrics

## ALCANCE ESTRICTO
Respondes ÚNICAMENTE sobre:
- Declaraciones SINADER: códigos LER, procedimientos, plazos, tipos de residuos
- Datos reales de facturas EcoMetrics: toneladas, montos, categorías, estado de declaración
- Estadísticas de residuos domiciliarios y reciclables
- Uso correcto de la aplicación EcoMetrics

Si te preguntan algo fuera de este alcance, responde amablemente: "Solo puedo ayudarte con gestión de residuos SINADER y el uso de EcoMetrics."

## TABLA DE CÓDIGOS LER (Lista Europea de Residuos) — Usados en SINADER Chile
| Categoría EcoMetrics | Código LER | Descripción oficial |
|---------------------|-----------|---------------------|
| Domiciliarios | **20 03 01** | Residuos municipales mezclados |
| Plástico | **20 01 39** | Plásticos |
| Papel / Cartón | **20 01 01** | Papel y cartón |
| Vidrio | **20 01 02** | Vidrio |
| Metal | **20 01 40** | Metal |
| Orgánico | **20 01 08** | Residuos biodegradables de cocinas |
| Textil / Ropa | **20 01 10** | Ropa y textiles |
| RAEE (electrónicos) | **20 01 35** | Equipos eléctricos y electrónicos |
| Tetrapak | **15 01 05** | Envases compuestos |
| Otros | **20 03 99** | Residuos municipales no especificados |

## PLAZOS SINADER
- **Declaración mensual:** 10 días hábiles después del cierre del mes de generación
- **Pago de facturas proveedor:** 30 días desde la fecha de la factura
- **Unidad de declaración:** Toneladas métricas (ton) — EcoMetrics ya almacena todo en toneladas

## USO DE HERRAMIENTAS
Tienes acceso a herramientas para consultar los datos REALES del usuario en EcoMetrics.
**SIEMPRE** usa las herramientas cuando el usuario pregunte por datos específicos (toneladas, montos, fechas, estados, tendencias). Nunca inventes o estimes datos — usa los datos reales.

## VISUALIZACIONES
Cuando tengas datos relevantes, INCLUYE un gráfico para facilitar la comprensión. Para generarlo, inserta este bloque al final de tu respuesta (después del texto):

```chart
{"type":"bar","title":"Título aquí","data":[{"mes":"Enero","valor":10.5}],"xKey":"mes","yKey":"valor","color":"#6366f1"}
```

Tipos de gráfico disponibles:
- **`bar`**: Barras — para comparar categorías o meses. Campos: `xKey`, `yKey`, `color`
- **`line`**: Líneas — para tendencias temporales. Campos: `xKey`, `yKey` o `keys[]`, `color` o `colors[]`
- **`pie`**: Torta — para distribución por categoría. Campos: `xKey` (nombre), `yKey` (valor numérico)
- **`multibar`**: Barras múltiples — para comparar domiciliario vs reciclable. Campos: `xKey`, `keys[]`, `colors[]`

Ejemplo multibar:
```chart
{"type":"multibar","title":"Toneladas domiciliario vs reciclable","data":[{"mes":"Enero","domiciliario":10.5,"reciclable":3.2}],"xKey":"mes","keys":["domiciliario","reciclable"],"colors":["#6366f1","#22c55e"]}
```

## ESTILO
- Profesional y preciso, español chileno
- Siempre especifica unidades (ton, CLP, UF)
- Cuando indiques SINADER, incluye el código LER correspondiente
- Cuando generes tabla de declaración, usa formato: Código LER | Descripción | Toneladas
- Sé conciso: responde lo que se pregunta, sin redundancias
"""

# ---------------------------------------------------------------------------
# Tool definitions (OpenAI function-calling format)
# ---------------------------------------------------------------------------

TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_invoice_summary",
            "description": (
                "Obtiene un resumen estadístico de facturas para un período. "
                "Úsalo cuando el usuario pide totales de toneladas o montos para un año/mes. "
                "Devuelve conteo, total CLP y total toneladas separados por tipo (domiciliario/reciclable)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer", "description": "Año (ej: 2025). Omitir para todos."},
                    "month": {"type": "integer", "description": "Mes 1-12. Omitir para todo el año."},
                    "invoice_type": {
                        "type": "string",
                        "enum": ["domiciliary", "recyclable", "all"],
                        "description": "Tipo de factura. Default: 'all'.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_monthly_series",
            "description": (
                "Obtiene las toneladas y montos MES A MES para un año. "
                "Úsalo para identificar el mes con más/menos toneladas, tendencias o gráficos mensuales. "
                "Devuelve una serie con domiciliario_ton y reciclable_ton por mes, y el mes pico de cada tipo."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer", "description": "Año a analizar (ej: 2025)"},
                },
                "required": ["year"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_category_breakdown",
            "description": (
                "Obtiene el desglose de residuos RECICLABLES por categoría con toneladas y código LER. "
                "Úsalo cuando el usuario pregunta qué declarar en SINADER, qué categorías tiene, "
                "o quiere ver distribución por tipo de reciclable (cartón, plástico, etc.). "
                "Devuelve cada categoría con su código LER y toneladas."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer", "description": "Año. Omitir para todos."},
                    "month": {"type": "integer", "description": "Mes 1-12. Omitir para todo el año."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_sinader",
            "description": (
                "Lista las facturas con declaración SINADER pendiente o vencida. "
                "Úsalo cuando el usuario pregunta qué tiene pendiente de declarar, "
                "qué facturas tienen SINADER atrasado, o necesita saber qué urgente declarar."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

# ---------------------------------------------------------------------------
# AIService
# ---------------------------------------------------------------------------


class AIService:
    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    DEFAULT_MODEL = "gemini-2.0-flash"
    MAX_TOOL_ROUNDS = 4

    def __init__(self, invoice_service) -> None:
        self.invoice_service = invoice_service
        self.api_key = os.environ.get("GEMINI_API_KEY", "")
        self.model = os.environ.get("GEMINI_MODEL", self.DEFAULT_MODEL)

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    def chat(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Procesa una conversación y devuelve {content: str, charts: list}.
        messages: lista de {role: 'user'|'assistant', content: str}
        """
        if not self.api_key:
            return {
                "content": (
                    "⚠️ El servicio de IA no está configurado. "
                    "El administrador debe definir la variable de entorno `GEMINI_API_KEY` en el servidor."
                ),
                "charts": [],
            }

        api_messages: List[Dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ] + messages

        for _ in range(self.MAX_TOOL_ROUNDS):
            try:
                response_data = self._call_api(api_messages)
            except TimeoutError:
                return {"content": "⏱️ La solicitud tardó demasiado. Intenta nuevamente.", "charts": []}
            except Exception as exc:
                return {"content": f"❌ Error al conectar con el servicio de IA: {exc}", "charts": []}

            choices = response_data.get("choices") or []
            if not choices:
                error_msg = response_data.get("error", {}).get("message", "Respuesta vacía del modelo.")
                return {"content": f"❌ {error_msg}", "charts": []}

            message = choices[0].get("message", {})
            tool_calls = message.get("tool_calls") or []

            if not tool_calls:
                # Respuesta final — extraer gráficos embebidos
                content = message.get("content") or ""
                charts = self._extract_charts(content)
                clean_content = self._strip_chart_blocks(content).strip()
                return {"content": clean_content, "charts": charts}

            # Ejecutar herramientas y agregar resultados al contexto
            api_messages.append({
                "role": "assistant",
                "content": message.get("content") or "",
                "tool_calls": tool_calls,
            })
            for tool_call in tool_calls:
                fn_name = tool_call["function"]["name"]
                try:
                    fn_args = json.loads(tool_call["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    fn_args = {}
                result = self._execute_tool(fn_name, fn_args)
                api_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                })

        return {
            "content": "No pude completar la solicitud. Por favor reformula tu pregunta.",
            "charts": [],
        }

    # -----------------------------------------------------------------------
    # Gemini API call (OpenAI-compatible endpoint)
    # -----------------------------------------------------------------------

    def _call_api(self, messages: List[Dict]) -> Dict:
        payload = json.dumps({
            "model": self.model,
            "messages": messages,
            "tools": TOOLS,
            "tool_choice": "auto",
            "max_tokens": 2048,
            "temperature": 0.2,
        }).encode("utf-8")

        req = urllib.request.Request(
            self.GEMINI_API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise Exception(f"Gemini HTTP {exc.code}: {body}")

    # -----------------------------------------------------------------------
    # Tool dispatcher
    # -----------------------------------------------------------------------

    def _execute_tool(self, name: str, args: Dict) -> Any:
        try:
            if name == "get_invoice_summary":
                return self._tool_summary(**args)
            if name == "get_monthly_series":
                return self._tool_monthly_series(**args)
            if name == "get_category_breakdown":
                return self._tool_category_breakdown(**args)
            if name == "get_pending_sinader":
                return self._tool_pending_sinader()
            return {"error": f"Herramienta '{name}' no encontrada"}
        except TypeError as exc:
            return {"error": f"Parámetros inválidos para {name}: {exc}"}
        except Exception as exc:
            return {"error": f"Error ejecutando {name}: {exc}"}

    # -----------------------------------------------------------------------
    # Tool implementations
    # -----------------------------------------------------------------------

    def _tool_summary(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
        invoice_type: str = "all",
    ) -> Dict:
        filters: Dict[str, Any] = {}
        if year:
            filters["year"] = str(year)
        if month:
            filters["month"] = f"{month:02d}"
        if invoice_type != "all":
            filters["type"] = invoice_type

        invoices = self.invoice_service.list_invoices(filters)
        dom = [i for i in invoices if i.get("type") == "domiciliary"]
        rec = [i for i in invoices if i.get("type") == "recyclable"]

        def _agg(lst: List[Dict]) -> Dict:
            total_amount = sum(
                float(
                    (i.get("totals") or {}).get("total")
                    or (i.get("aggregates") or {}).get("total_amount")
                    or 0
                )
                for i in lst
            )
            total_tons = sum(
                sum((i.get("aggregates") or {}).get("residue_totals", {}).values())
                for i in lst
            )
            return {
                "count": len(lst),
                "total_clp": round(total_amount, 0),
                "total_tons": round(total_tons, 3),
            }

        period_str = (
            f"{MONTH_NAMES.get(month, '')} {year or '(todos los años)'}"
            if month
            else str(year or "todos los años")
        )
        return {
            "period": period_str,
            "domiciliary": _agg(dom),
            "recyclable": _agg(rec),
            "total": _agg(invoices),
        }

    def _tool_monthly_series(self, year: int) -> Dict:
        invoices = self.invoice_service.list_invoices({"year": str(year)})
        months: Dict[int, Dict[str, float]] = {
            m: {"dom_tons": 0.0, "rec_tons": 0.0, "dom_amount": 0.0, "rec_amount": 0.0}
            for m in range(1, 13)
        }

        for invoice in invoices:
            try:
                dt = datetime.fromisoformat(invoice.get("date", ""))
            except (ValueError, TypeError):
                continue
            agg = invoice.get("aggregates") or {}
            rt = agg.get("residue_totals") or {}
            tons = round(sum(rt.values()), 3)
            amount = float(
                (invoice.get("totals") or {}).get("total")
                or agg.get("total_amount")
                or 0
            )
            if invoice.get("type") == "domiciliary":
                months[dt.month]["dom_tons"] += tons
                months[dt.month]["dom_amount"] += amount
            else:
                months[dt.month]["rec_tons"] += tons
                months[dt.month]["rec_amount"] += amount

        series = [
            {
                "mes": MONTH_NAMES[m],
                "domiciliario_ton": round(data["dom_tons"], 3),
                "reciclable_ton": round(data["rec_tons"], 3),
                "domiciliario_clp": round(data["dom_amount"], 0),
                "reciclable_clp": round(data["rec_amount"], 0),
            }
            for m, data in months.items()
            if data["dom_tons"] > 0 or data["rec_tons"] > 0
        ]

        peak_rec = max(series, key=lambda x: x["reciclable_ton"], default=None)
        peak_dom = max(series, key=lambda x: x["domiciliario_ton"], default=None)

        return {
            "year": year,
            "series": series,
            "months_with_data": len(series),
            "peak_recyclable_month": peak_rec,
            "peak_domiciliary_month": peak_dom,
        }

    def _tool_category_breakdown(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> Dict:
        filters: Dict[str, Any] = {"type": "recyclable"}
        if year:
            filters["year"] = str(year)
        if month:
            filters["month"] = f"{month:02d}"

        invoices = self.invoice_service.list_invoices(filters)
        categories: Dict[str, Dict] = {}

        for invoice in invoices:
            agg = invoice.get("aggregates") or {}
            for cat, tons in (agg.get("residue_totals") or {}).items():
                if cat not in categories:
                    ler = LER_CODES.get(cat, {"code": "20 03 99", "label": cat.replace("_", " ").title()})
                    categories[cat] = {
                        "categoria": cat,
                        "descripcion": ler["label"],
                        "codigo_ler": ler["code"],
                        "toneladas": 0.0,
                    }
                categories[cat]["toneladas"] = round(categories[cat]["toneladas"] + tons, 3)

        result = sorted(categories.values(), key=lambda x: x["toneladas"], reverse=True)
        total_tons = sum(c["toneladas"] for c in result)

        period_str = (
            f"{MONTH_NAMES.get(month, '')} {year}" if month else str(year or "período completo")
        )
        return {
            "period": period_str,
            "categories": result,
            "total_tons": round(total_tons, 3),
            "sinader_note": (
                "Declara cada categoría en SINADER usando su código LER. "
                "Unidad: toneladas métricas. Plazo: 10 días hábiles tras cierre del mes."
            ),
        }

    def _tool_pending_sinader(self) -> Dict:
        invoices = self.invoice_service.list_invoices({})
        pending = [
            i for i in invoices
            if i.get("sinader_status") in ("pending", "overdue")
        ]

        result = []
        for inv in pending:
            agg = inv.get("aggregates") or {}
            rt = agg.get("residue_totals") or {}
            total_tons = round(sum(rt.values()), 3)
            result.append({
                "numero": inv.get("number"),
                "proveedor": inv.get("provider"),
                "fecha": inv.get("date"),
                "tipo": "Domiciliario" if inv.get("type") == "domiciliary" else "Reciclable",
                "estado_sinader": inv.get("sinader_status"),
                "total_toneladas": total_tons,
                "folio_sinader": inv.get("sinader_folio") or "Sin folio",
            })

        overdue = [r for r in result if r["estado_sinader"] == "overdue"]
        pending_only = [r for r in result if r["estado_sinader"] == "pending"]

        return {
            "total_pendientes": len(result),
            "vencidas": len(overdue),
            "pendientes": len(pending_only),
            "facturas": result,
            "resumen": (
                f"{len(result)} facturas con SINADER sin declarar: "
                f"{len(overdue)} vencidas y {len(pending_only)} en plazo."
            ),
        }

    # -----------------------------------------------------------------------
    # Chart extraction helpers
    # -----------------------------------------------------------------------

    def _extract_charts(self, content: str) -> List[Dict]:
        charts = []
        pattern = r"```chart\s*\n([\s\S]*?)\n?```"
        for match in re.finditer(pattern, content):
            try:
                spec = json.loads(match.group(1).strip())
                if isinstance(spec, dict) and "type" in spec:
                    charts.append(spec)
            except json.JSONDecodeError:
                pass
        return charts

    def _strip_chart_blocks(self, content: str) -> str:
        return re.sub(r"```chart\s*\n[\s\S]*?\n?```", "", content).strip()
