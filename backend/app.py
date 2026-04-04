from pathlib import Path
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from repositories.local_json_repo import LocalInvoiceRepository
from services.ai_service import AIService
from services.invoice_service import InvoiceService
from storage.file_manager import FileManager


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    base_dir = Path(__file__).resolve().parent
    data_dir = base_dir / "data"
    documents_dir = data_dir / "documents"
    data_dir.mkdir(parents=True, exist_ok=True)
    documents_dir.mkdir(parents=True, exist_ok=True)

    repository = LocalInvoiceRepository(data_dir / "invoices.json")
    file_manager = FileManager(documents_dir)
    service = InvoiceService(repository, file_manager)
    ai_service = AIService(service)

    @app.errorhandler(ValueError)
    def handle_value_error(error: ValueError):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        if isinstance(error, HTTPException):
            return jsonify({"error": error.description}), error.code
        app.logger.exception("Unhandled server error")
        return jsonify({"error": "Internal server error"}), 500

    @app.route("/api/health", methods=["GET"])
    def health_check() -> tuple:
        return jsonify({"status": "ok"}), 200

    @app.route("/api/invoices", methods=["GET"])
    def list_invoices() -> tuple:
        filters = {
            "type": request.args.get("type"),
            "year": request.args.get("year"),
            "month": request.args.get("month"),
        }
        invoices = service.list_invoices(filters)
        return jsonify(invoices), 200

    @app.route("/api/invoices", methods=["POST"])
    def create_invoice() -> tuple:
        invoice_data = request.get_json(force=True)
        invoice = service.create_invoice(invoice_data)
        return jsonify(invoice), 201

    @app.route("/api/invoices/<invoice_id>", methods=["PUT"])
    def update_invoice(invoice_id: str) -> tuple:
        invoice_data = request.get_json(force=True)
        updated = service.update_invoice(invoice_id, invoice_data)
        return jsonify(updated), 200

    @app.route("/api/invoices/<invoice_id>", methods=["DELETE"])
    def delete_invoice(invoice_id: str) -> tuple:
        service.delete_invoice(invoice_id)
        return "", 204

    @app.route("/api/invoices/<invoice_id>/document", methods=["POST"])
    def upload_document(invoice_id: str) -> tuple:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        file = request.files["file"]
        doc_type = request.args.get("doc_type", "invoice")
        document_info = service.attach_document(invoice_id, file, doc_type)
        return jsonify(document_info), 201

    @app.route("/api/invoices/<invoice_id>/document", methods=["GET"])
    def download_document(invoice_id: str):
        doc_type = request.args.get("doc_type", "invoice")
        file_path = service.get_document(invoice_id, doc_type)
        if not file_path:
            return jsonify({"error": "Document not found"}), 404
        return send_file(file_path, mimetype='application/pdf')

    @app.route("/api/analytics", methods=["GET"])
    def analytics() -> tuple:
        year = request.args.get("year")
        data = service.get_analytics(year)
        return jsonify(data), 200

    @app.route("/api/chat", methods=["POST"])
    def chat() -> tuple:
        data = request.get_json(force=True)
        messages = data.get("messages", [])
        if not isinstance(messages, list) or not messages:
            return jsonify({"error": "Se requiere una lista de mensajes"}), 400
        for msg in messages:
            if (
                not isinstance(msg, dict)
                or msg.get("role") not in ("user", "assistant")
                or not isinstance(msg.get("content"), str)
            ):
                return jsonify({"error": "Formato de mensaje inválido"}), 400
        result = ai_service.chat(messages)
        return jsonify(result), 200

    return app


if __name__ == "__main__":
    create_app().run(debug=True)
