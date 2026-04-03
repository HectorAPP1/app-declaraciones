"""
migrate_categories.py
─────────────────────
Corrige residue_category en facturas reciclables guardadas con el
mapping roto (todo quedaba en 'otros' o 'vidrio').

Mapea el campo `description` al key correcto del backend y
recalcula `aggregates` para cada factura afectada.

Uso:
    cd backend
    python migrate_categories.py [--dry-run]
"""
import json
import sys
from pathlib import Path

# ─── Mapeo description → residue_category ─────────────────────────────────────
DESCRIPTION_MAP: dict[str, str] = {
    # Cartón
    "cartón corrugado":     "carton",
    "carton corrugado":     "carton",
    "cartón":               "carton",
    "carton":               "carton",
    # Plásticos
    "mezcla de plásticos":  "plastico",
    "mezcla de plasticos":  "plastico",
    "plástico pet":         "plastico",
    "plastico pet":         "plastico",
    "plástico hdpe":        "plastico",
    "plastico hdpe":        "plastico",
    "plástico":             "plastico",
    "plastico":             "plastico",
    # Papel
    "papel":                "papel",
    # Vidrio
    "vidrio":               "vidrio",
    # Metales
    "metales ferrosos":     "metal",
    "aluminio":             "metal",
    "metales":              "metal",
    "metal":                "metal",
    # Resto
    "tetrapak":             "tetrapak",
    "orgánico":             "organico",
    "organico":             "organico",
    "textil":               "textil",
    "raee":                 "raee",
    "otro":                 "otros",
    "otros":                "otros",
}


def resolve_category(description: str, current_category: str) -> str:
    key = description.strip().lower()
    return DESCRIPTION_MAP.get(key, current_category)


def recompute_aggregates(items: list[dict]) -> dict:
    total_amount = 0.0
    residue_totals: dict[str, float] = {}
    residue_amounts: dict[str, float] = {}
    for item in items:
        amount = float(item.get("amount", 0))
        total_amount += amount
        cat = item.get("residue_category", "otros")
        qty_ton = float(item.get("quantity_ton", item.get("quantity", 0)))
        residue_totals[cat] = residue_totals.get(cat, 0.0) + qty_ton
        residue_amounts[cat] = residue_amounts.get(cat, 0.0) + amount
    return {
        "total_amount": total_amount,
        "residue_totals": residue_totals,
        "residue_amounts": residue_amounts,
    }


def migrate(data_path: Path, dry_run: bool = False) -> None:
    invoices: list[dict] = json.loads(data_path.read_text(encoding="utf-8"))

    changed = 0
    for invoice in invoices:
        if invoice.get("type") != "recyclable":
            continue

        items = invoice.get("items", [])
        invoice_changed = False
        for item in items:
            desc = item.get("description", "")
            old_cat = item.get("residue_category", "otros")
            new_cat = resolve_category(desc, old_cat)
            if new_cat != old_cat:
                print(f"  [{invoice['number']}] '{desc}': {old_cat!r} → {new_cat!r}")
                item["residue_category"] = new_cat
                invoice_changed = True

        if invoice_changed:
            invoice["aggregates"] = recompute_aggregates(items)
            changed += 1

    if changed == 0:
        print("Sin cambios necesarios.")
        return

    print(f"\n{changed} factura(s) modificada(s).")

    if dry_run:
        print("--dry-run: no se escribió nada.")
        return

    data_path.write_text(
        json.dumps(invoices, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Guardado en {data_path}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    data_file = Path(__file__).parent / "data" / "invoices.json"
    if not data_file.exists():
        print(f"No se encontró {data_file}")
        sys.exit(1)
    print(f"{'[DRY RUN] ' if dry_run else ''}Migrando {data_file} ...\n")
    migrate(data_file, dry_run=dry_run)
