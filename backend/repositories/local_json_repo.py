import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class LocalInvoiceRepository:
    """Persists invoices in a local JSON file for quick prototyping."""

    def __init__(self, file_path: Path) -> None:
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            self._write([])

    def list_all(self) -> List[Dict[str, Any]]:
        return self._read()

    def get(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        return next((inv for inv in self._read() if inv.get("id") == invoice_id), None)

    def insert(self, invoice: Dict[str, Any]) -> Dict[str, Any]:
        invoices = self._read()
        invoices.append(invoice)
        self._write(invoices)
        return invoice

    def update(self, invoice_id: str, invoice: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        invoices = self._read()
        for index, stored in enumerate(invoices):
            if stored.get("id") == invoice_id:
                invoices[index] = invoice
                self._write(invoices)
                return invoice
        return None

    def delete(self, invoice_id: str) -> bool:
        invoices = self._read()
        filtered = [inv for inv in invoices if inv.get("id") != invoice_id]
        if len(filtered) == len(invoices):
            return False
        self._write(filtered)
        return True

    def _read(self) -> List[Dict[str, Any]]:
        try:
            raw = self.file_path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw else []
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _write(self, invoices: List[Dict[str, Any]]) -> None:
        serialized = json.dumps(invoices, ensure_ascii=False, indent=2)
        self.file_path.write_text(serialized, encoding="utf-8")
