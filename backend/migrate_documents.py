"""
migrate_documents.py
────────────────────
Para facturas reciclables que tienen un archivo en el campo 'document':
el bug anterior hacía que el certificado (último en subirse) sobreescribiera
la factura, así que lo que está guardado como 'document' ES el certificado.

Este script:
  1. Renombra el archivo  {id}.pdf  →  {id}_cert.pdf
  2. Mueve el valor  document  →  certificate
  3. Limpia el campo  document

Resultado: solo queda pendiente subir la factura PDF de cada factura reciclable.

Uso:
    cd backend
    python migrate_documents.py [--dry-run]
"""
import json
import shutil
import sys
from pathlib import Path


def migrate(data_path: Path, docs_dir: Path, dry_run: bool = False) -> None:
    invoices: list[dict] = json.loads(data_path.read_text(encoding="utf-8"))

    changed = 0
    for invoice in invoices:
        if invoice.get("type") != "recyclable":
            continue

        doc = invoice.get("document")
        if not doc:
            continue

        # Already migrated (has certificate field set)
        if invoice.get("certificate"):
            print(f"  [{invoice['number']}] Ya migrado, saltando.")
            continue

        old_path = docs_dir / doc
        # Expected new filename: {id}_cert.pdf
        invoice_id = invoice["id"]
        new_filename = f"{invoice_id}_cert.pdf"
        new_path = docs_dir / new_filename

        if not old_path.exists():
            print(f"  [{invoice['number']}] Archivo no encontrado en disco: {doc}, saltando.")
            continue

        print(f"  [{invoice['number']}] {doc} → {new_filename}")

        if not dry_run:
            shutil.move(str(old_path), str(new_path))
            invoice["certificate"] = new_filename
            invoice["document"] = None

        changed += 1

    if changed == 0:
        print("Sin cambios necesarios.")
        return

    print(f"\n{changed} factura(s) migrada(s).")

    if dry_run:
        print("--dry-run: no se escribió nada.")
        return

    data_path.write_text(
        json.dumps(invoices, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Guardado en {data_path}")
    print("\nListo. Ahora solo falta subir la factura PDF de cada factura reciclable.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    base = Path(__file__).parent
    data_file = base / "data" / "invoices.json"
    docs_dir = base / "data" / "documents"

    if not data_file.exists():
        print(f"No se encontró {data_file}")
        sys.exit(1)

    print(f"{'[DRY RUN] ' if dry_run else ''}Migrando documentos en {data_file} ...\n")
    migrate(data_file, docs_dir, dry_run)
