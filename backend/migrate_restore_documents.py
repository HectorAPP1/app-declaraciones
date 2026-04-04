"""
migrate_restore_documents.py
Reconcilia los campos document/certificate en invoices.json
basándose en los archivos que existen físicamente en backend/data/documents/.

Ejecutar en PythonAnywhere:
  cd ~/app-declaraciones/backend
  python migrate_restore_documents.py
"""
import json
import os

BASE_DIR      = os.path.dirname(__file__)
INVOICES_PATH = os.path.join(BASE_DIR, 'data', 'invoices.json')
DOCUMENTS_DIR = os.path.join(BASE_DIR, 'data', 'documents')

with open(INVOICES_PATH, encoding='utf-8') as f:
    invoices = json.load(f)

# Clasificar archivos en disco por invoice_id
doc_ids  = set()
cert_ids = set()

for filename in os.listdir(DOCUMENTS_DIR):
    if filename.endswith('_cert.pdf'):
        cert_ids.add(filename[:-len('_cert.pdf')])
    elif filename.endswith('.pdf'):
        doc_ids.add(filename[:-len('.pdf')])

print(f"Archivos en disco: {len(doc_ids)} facturas, {len(cert_ids)} certificados\n")

updated = 0
for inv in invoices:
    inv_id  = inv.get('id', '')
    changed = False

    if inv_id in doc_ids:
        expected = f'{inv_id}.pdf'
        if inv.get('document') != expected:
            inv['document'] = expected
            changed = True

    if inv_id in cert_ids:
        expected = f'{inv_id}_cert.pdf'
        if inv.get('certificate') != expected:
            inv['certificate'] = expected
            changed = True

    # Limpiar referencias huerfanas (campo seteado pero archivo no existe)
    if inv.get('document') and inv_id not in doc_ids:
        print(f"  WARN: {inv.get('number')} tiene document={inv['document']} pero el archivo no existe — limpiando")
        inv['document'] = None
        changed = True

    if inv.get('certificate') and inv_id not in cert_ids:
        print(f"  WARN: {inv.get('number')} tiene certificate={inv['certificate']} pero el archivo no existe — limpiando")
        inv['certificate'] = None
        changed = True

    if changed:
        updated += 1
        print(f"  OK: {inv.get('number', inv_id)[:20]:<20} document={inv.get('document') or '—':<45} certificate={inv.get('certificate') or '—'}")

with open(INVOICES_PATH, 'w', encoding='utf-8') as f:
    json.dump(invoices, f, ensure_ascii=False, indent=2)

print(f"\nListo. {updated} facturas actualizadas en invoices.json.")
