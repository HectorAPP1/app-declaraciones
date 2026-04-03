from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from repositories.local_json_repo import LocalInvoiceRepository
from storage.file_manager import FileManager
from validators.invoice_validator import (
    DOMICILIARY_RESIDUES,
    RECYCLABLE_RESIDUES,
    validate_invoice_payload,
)


class InvoiceService:
    """Domain logic for invoices (domiciliary & recyclable)."""

    def __init__(self, repository: LocalInvoiceRepository, file_manager: FileManager) -> None:
        self.repository = repository
        self.file_manager = file_manager

    def list_invoices(self, filters: Optional[Dict[str, Optional[str]]] = None) -> List[Dict[str, Any]]:
        filters = filters or {}
        invoices = self.repository.list_all()
        result: List[Dict[str, Any]] = []
        for invoice in invoices:
            if filters.get("type") and invoice.get("type") != filters["type"]:
                continue
            if filters.get("year") and not self._matches_year(invoice.get("date"), filters["year"]):
                continue

            if filters.get("month") and not self._matches_month(invoice.get("date"), filters["month"]):
                continue
            result.append(invoice)
        return result

    def create_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        validated = validate_invoice_payload(invoice_data)
        invoice = self._build_invoice(validated)
        return self.repository.insert(invoice)

    def update_invoice(self, invoice_id: str, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        stored = self.repository.get(invoice_id)
        if not stored:
            raise ValueError("Invoice not found")
        validated = validate_invoice_payload({**stored, **invoice_data})
        invoice = self._build_invoice(validated, invoice_id)
        updated = self.repository.update(invoice_id, invoice)
        if not updated:
            raise ValueError("Invoice not found")
        return updated

    def delete_invoice(self, invoice_id: str) -> None:
        deleted = self.repository.delete(invoice_id)
        if not deleted:
            raise ValueError("Invoice not found")
        self.file_manager.delete(invoice_id)

    def attach_document(self, invoice_id: str, file_storage, doc_type: str = "invoice") -> Dict[str, Any]:
        invoice = self.repository.get(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        suffix = "_cert" if doc_type == "certificate" else ""
        field = "certificate" if doc_type == "certificate" else "document"
        document_path = self.file_manager.save(invoice_id, file_storage, suffix)
        invoice[field] = document_path.name
        updated = self.repository.update(invoice_id, invoice)
        if not updated:
            raise ValueError("Failed to update invoice with document")
        return {"filename": document_path.name}

    def get_document(self, invoice_id: str, doc_type: str = "invoice") -> Optional[str]:
        invoice = self.repository.get(invoice_id)
        if not invoice:
            return None
        field = "certificate" if doc_type == "certificate" else "document"
        filename = invoice.get(field)
        if not filename:
            return None
        file_path = self.file_manager.path_for(filename)
        return str(file_path) if file_path.exists() else None

    def _build_invoice(self, data: Dict[str, Any], invoice_id: Optional[str] = None) -> Dict[str, Any]:
        now = datetime.utcnow()
        issue_date = None
        try:
            issue_date = datetime.fromisoformat(data.get("date", ""))
        except (ValueError, TypeError):
            pass

        # Auto-calculate compliance deadlines if not provided
        def _payment_status_default():
            if not issue_date:
                return "pending"
            days = (now - issue_date).days
            if days > 30:
                return "overdue"
            return "pending"

        def _sinader_status_default():
            if not issue_date:
                return "pending"
            days = (now - issue_date).days
            if days > 10:
                return "overdue"
            return "pending"

        invoice = {
            "id": invoice_id or str(uuid.uuid4()),
            "number": data.get("number"),
            "provider": data.get("provider"),
            "date": data.get("date"),  # ISO yyyy-mm-dd
            "currency": data.get("currency", "CLP"),
            "type": data.get("type", "domiciliary"),
            "items": data.get("items", []),
            "totals": data.get("totals", {}),
            "document": data.get("document"),
            # Compliance tracking fields
            "payment_status": data.get("payment_status") or _payment_status_default(),
            "payment_note": data.get("payment_note", ""),
            "sinader_status": data.get("sinader_status") or _sinader_status_default(),
            "sinader_note": data.get("sinader_note", ""),
            "sinader_folio": data.get("sinader_folio", ""),
            "created_at": data.get("created_at") or now.isoformat(),
            "updated_at": now.isoformat(),
        }
        self._validate(invoice)
        invoice["aggregates"] = self._compute_aggregates(invoice["items"])
        return invoice


    def get_analytics(self, year: Optional[str] = None) -> Dict[str, Any]:
        target_year = None
        if year:
            try:
                target_year = int(year)
            except (TypeError, ValueError):
                target_year = None
        invoices = self.repository.list_all()
        dom_months = {month: {"amount": 0.0, "tons": 0.0} for month in range(1, 13)}
        rec_months = {month: {"amount": 0.0, "tons": 0.0} for month in range(1, 13)}
        dom_totals = {"amount": 0.0, "tons": 0.0}
        rec_totals = {"amount": 0.0, "tons": 0.0}
        rec_categories = {
            key: {"label": label, "amount": 0.0, "tons": 0.0}
            for key, label in RECYCLABLE_RESIDUES.items()
        }
        
        historical = {} # year -> totals

        for invoice in invoices:
            date_str = invoice.get("date")
            if not date_str:
                continue
            try:
                dt = datetime.fromisoformat(date_str)
            except ValueError:
                continue

            # Historical tracking (all years)
            y = dt.year
            if y not in historical:
                historical[y] = {"domiciliario": 0.0, "reciclable": 0.0, "dom_tons": 0.0, "rec_tons": 0.0}

            invoice_type = invoice.get("type", "domiciliary")
            amount = self._invoice_amount(invoice)
            agg = invoice.get("aggregates") or {}
            rt = agg.get("residue_totals") or {}
            hist_tons = sum(rt.values()) if rt else 0.0

            if invoice_type == "domiciliary":
                historical[y]["domiciliario"] += amount
                historical[y]["dom_tons"] += hist_tons
            else:
                historical[y]["reciclable"] += amount
                historical[y]["rec_tons"] += hist_tons

            if target_year and dt.year != target_year:
                continue
            aggregates = invoice.get("aggregates") or {}
            residue_totals = aggregates.get("residue_totals") or {}
            residue_amounts = aggregates.get("residue_amounts")

            if invoice_type == "domiciliary":
                tons = residue_totals.get("relleno_sanitario")
                if tons is None:
                    tons = sum(residue_totals.values()) if residue_totals else 0.0
                dom_months[dt.month]["amount"] += amount
                dom_months[dt.month]["tons"] += tons
                dom_totals["amount"] += amount
                dom_totals["tons"] += tons
            else:
                tons = sum(residue_totals.values()) if residue_totals else 0.0
                rec_months[dt.month]["amount"] += amount
                rec_months[dt.month]["tons"] += tons
                rec_totals["amount"] += amount
                rec_totals["tons"] += tons
                has_amounts = residue_amounts and any(v > 0 for v in residue_amounts.values())
                resolved_amounts = residue_amounts if has_amounts else self._distribute_amounts(amount, residue_totals)
                for category, tons_value in residue_totals.items():
                    rec_categories.setdefault(
                        category,
                        {
                            "label": RECYCLABLE_RESIDUES.get(category, category.title()),
                            "amount": 0.0,
                            "tons": 0.0,
                        },
                    )
                    rec_categories[category]["tons"] += tons_value
                    rec_categories[category]["amount"] += float(resolved_amounts.get(category, 0.0))

        historical_list = [
            {
                "name": str(y),
                "domiciliario": data["domiciliario"],
                "reciclable": data["reciclable"],
                "dom_tons": round(data["dom_tons"], 3),
                "rec_tons": round(data["rec_tons"], 3),
            }
            for y, data in sorted(historical.items())
        ]

        return {
            "year": target_year,
            "domiciliary": {
                "monthly": self._series_from_months(dom_months),
                "totals": dom_totals,
            },
            "recyclable": {
                "monthly": self._series_from_months(rec_months),
                "totals": rec_totals,
                "categories": self._categories_list(rec_categories),
            },
            "historical": historical_list,
        }

    def _compute_aggregates(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_amount = 0.0
        residue_totals: Dict[str, float] = {}
        residue_amounts: Dict[str, float] = {}
        for item in items:
            amount = float(item.get("amount", 0))
            total_amount += amount
            residue_category = item.get("residue_category", "otros")
            quantity_ton = float(item.get("quantity_ton", item.get("quantity", 0)))
            residue_totals[residue_category] = residue_totals.get(residue_category, 0.0) + quantity_ton
            residue_amounts[residue_category] = residue_amounts.get(residue_category, 0.0) + amount
        return {
            "total_amount": total_amount,
            "residue_totals": residue_totals,
            "residue_amounts": residue_amounts,
        }

    def _validate(self, invoice: Dict[str, Any]) -> None:
        required = ["number", "provider", "date", "type"]
        missing = [field for field in required if not invoice.get(field)]
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")

    def _matches_month(self, date_str: Optional[str], month: str) -> bool:
        if not date_str:
            return False
        try:
            dt = datetime.fromisoformat(date_str)
            return f"{dt.month:02d}" == month
        except ValueError:
            return False

    def _matches_year(self, date_str: Optional[str], year: str) -> bool:
        if not date_str:
            return False
        try:
            dt = datetime.fromisoformat(date_str)
            return str(dt.year) == str(year)
        except ValueError:
            return False

    def _invoice_amount(self, invoice: Dict[str, Any]) -> float:
        totals = invoice.get("totals") or {}
        aggregates = invoice.get("aggregates") or {}
        return float(
            totals.get("total")
            or totals.get("subtotal")
            or aggregates.get("total_amount")
            or 0.0
        )

    def _distribute_amounts(self, amount: float, residue_totals: Dict[str, float]) -> Dict[str, float]:
        total_tons = sum(residue_totals.values()) or 1.0
        return {
            category: amount * (tons / total_tons)
            for category, tons in residue_totals.items()
        }

    def _series_from_months(self, data: Dict[int, Dict[str, float]]) -> List[Dict[str, Any]]:
        return [
            {
                "month": month,
                "amount": round(values["amount"], 2),
                "tons": round(values["tons"], 3),
            }
            for month, values in sorted(data.items())
        ]

    def _categories_list(self, data: Dict[str, Dict[str, float]]) -> List[Dict[str, Any]]:
        return [
            {
                "category": key,
                "label": values["label"],
                "amount": round(values["amount"], 2),
                "tons": round(values["tons"], 3),
            }
            for key, values in data.items()
        ]
