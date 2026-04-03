from __future__ import annotations

from pathlib import Path
from typing import BinaryIO


class FileManager:
    """Handles storing and deleting invoice documents locally."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, invoice_id: str, file_storage, suffix: str = "") -> Path:
        filename = f"{invoice_id}{suffix}.pdf"
        dest_path = self.base_dir / filename
        with dest_path.open("wb") as dest:
            file_storage.save(dest)
        return dest_path

    def path_for(self, filename: str) -> Path:
        return self.base_dir / filename

    def delete(self, invoice_id: str) -> None:
        for suffix in ("", "_cert"):
            path = self.base_dir / f"{invoice_id}{suffix}.pdf"
            if path.exists():
                path.unlink()
