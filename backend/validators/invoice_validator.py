from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

ALLOWED_TYPES = {"domiciliary", "recyclable"}
ALLOWED_CURRENCIES = {"CLP", "UF"}
ALLOWED_UNITS = {"TON", "KG"}

DOMICILIARY_RESIDUES = {"relleno_sanitario": "Relleno sanitario"}
RECYCLABLE_RESIDUES = {
    "plastico": "Plástico",
    "carton": "Cartón",
    "papel": "Papel",
    "vidrio": "Vidrio",
    "metal": "Metales",
    "tetrapak": "Tetrapak",
    "organico": "Orgánico",
    "textil": "Textil",
    "raee": "RAEE",
    "otros": "Otros",
}


def _to_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        return json.loads(value)
    return {}


def _to_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return json.loads(value)
    return []


def _to_float(value: Any, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Campo '{field}' debe ser numérico")


def validate_invoice_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Formato de factura inválido")

    number = str(payload.get("number", "")).strip()
    provider = str(payload.get("provider", "")).strip()
    date = str(payload.get("date", "")).strip()
    currency = str(payload.get("currency", "CLP")).strip().upper()
    invoice_type = str(payload.get("type", "domiciliary")).strip()

    if not number or not provider or not date:
        raise ValueError("Número, proveedor y fecha son obligatorios")

    try:
        datetime.fromisoformat(date)
    except ValueError as exc:
        raise ValueError("Fecha debe estar en formato ISO yyyy-mm-dd") from exc

    if invoice_type not in ALLOWED_TYPES:
        raise ValueError("Tipo de factura inválido")

    if currency not in ALLOWED_CURRENCIES:
        raise ValueError("Moneda inválida")

    items_raw = _to_list(payload.get("items", []))
    residue_catalog = DOMICILIARY_RESIDUES if invoice_type == "domiciliary" else RECYCLABLE_RESIDUES
    residue_allowed = set(residue_catalog.keys())
    normalized_items: List[Dict[str, Any]] = []
    for idx, item in enumerate(items_raw):
        if not isinstance(item, dict):
            raise ValueError(f"Item {idx + 1} debe ser un objeto")
        description = str(item.get("description", "")).strip()
        residue_category = str(item.get("residue_category", "")).strip() or next(iter(residue_allowed))
        if residue_category not in residue_allowed:
            raise ValueError(f"Item {idx + 1}: categoría de residuo inválida")
        unit = str(item.get("unit", "TON")).strip().upper() or "TON"
        if unit not in ALLOWED_UNITS:
            raise ValueError(f"Item {idx + 1}: unidad debe ser TON o KG")
        quantity = _to_float(item.get("quantity", 0), f"items[{idx}].quantity")
        amount = _to_float(item.get("amount", 0), f"items[{idx}].amount")
        quantity_ton = quantity if unit == "TON" else quantity / 1000
        normalized_items.append({
            "description": description,
            "residue_category": residue_category,
            "unit": unit,
            "quantity": quantity,
            "quantity_ton": quantity_ton,
            "amount": amount,
        })

    totals_raw = _to_dict(payload.get("totals", {}))
    totals = {
        "subtotal": _to_float(totals_raw.get("subtotal", 0), "totals.subtotal"),
        "tax": _to_float(totals_raw.get("tax", 0), "totals.tax"),
        "total": _to_float(totals_raw.get("total", 0), "totals.total"),
    }

    return {
        "number": number,
        "provider": provider,
        "date": date,
        "currency": currency,
        "type": invoice_type,
        "items": normalized_items,
        "totals": totals,
        "document": payload.get("document"),
    }
