import time

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from app.config import settings
from app.models.schema import (
    CommentRequest,
    Dialect,
    ExportFormat,
    FeedbackRequest,
    GenerateRequest,
    GenerateResponse,
    MigrateRequest,
    NamingConvention,
    ProjectRequest,
    RefineRequest,
    RollbackRequest,
    WizardRequest,
)
from app.services import email_service, openai_service, supabase_service
from app.services.csv_infer import infer_schema_from_csv
from app.services.ddl_synthesizer import synthesize_ddl
from app.services.exports_extended import export_by_format
from app.services.migration_gen import generate_migration
from app.services.persistence import store
from app.services.schema_engine import generate_schema, refine_schema
from app.services.templates import get_templates

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "schemaforge-api",
        "version": "2.0.0",
        "openai_configured": openai_service.is_available(),
        "supabase_configured": settings.supabase_public_configured,
        "provider": "openrouter" if "openrouter" in settings.openai_base_url else "openai",
        "model": settings.openai_model if openai_service.is_available() else None,
    }


@router.get("/v1/integrations/supabase")
def supabase_status():
    return supabase_service.status()


@router.get("/v1/usage")
def usage():
    return store.usage_stats()


@router.post("/v1/feedback", status_code=201)
def submit_feedback(req: FeedbackRequest):
    email = req.email.strip()
    if email and ("@" not in email or "." not in email.rsplit("@", 1)[-1]):
        raise HTTPException(400, "Enter a valid email address.")

    message = req.message.strip()
    if len(message) < 10:
        raise HTTPException(400, "Message must be at least 10 characters.")

    feedback = store.add_feedback(
        req.type.value,
        req.name.strip(),
        email,
        req.subject.strip(),
        message,
        req.page_url.strip() if req.page_url else None,
        req.user_agent.strip() if req.user_agent else None,
    )
    notification = email_service.send_feedback_notification(
        feedback_id=feedback["id"],
        feedback_type=req.type.value,
        name=req.name.strip(),
        sender_email=email,
        subject=req.subject.strip(),
        message=message,
        page_url=req.page_url.strip() if req.page_url else None,
        user_agent=req.user_agent.strip() if req.user_agent else None,
    )
    return {**feedback, "email_notification": notification}


@router.get("/dialects")
def list_dialects():
    return {
        "relational": [
            {"id": "postgresql", "name": "PostgreSQL 14/15/16", "launch": True},
            {"id": "mysql", "name": "MySQL 8", "launch": True},
            {"id": "sqlite", "name": "SQLite", "launch": True},
            {"id": "mssql", "name": "SQL Server 2019+", "launch": True},
            {"id": "oracle", "name": "Oracle 19c+", "launch": True},
        ],
        "cloud": [
            {"id": "snowflake", "name": "Snowflake", "launch": True},
            {"id": "bigquery", "name": "BigQuery", "launch": True},
        ],
        "document": [{"id": "mongodb", "name": "MongoDB", "launch": True}],
        "wide_column": [{"id": "cassandra", "name": "Apache Cassandra", "launch": True}],
        "key_value": [{"id": "dynamodb", "name": "DynamoDB", "launch": True}],
    }


@router.get("/templates")
def list_templates(category: str | None = None, search: str | None = None):
    return {"templates": get_templates(category, search)}


@router.get("/v1/projects")
def list_projects():
    return {"projects": store.list_projects()}


@router.post("/v1/projects")
def create_project(req: ProjectRequest):
    return store.save_project(req.name, req.prompt, req.schema_id)


@router.get("/v1/schemas")
def list_schemas():
    return {"schemas": store.list_all()}


@router.post("/v1/schema/generate", response_model=GenerateResponse)
def api_generate(request: GenerateRequest):
    stats = store.usage_stats()
    if stats["schemas_this_month"] >= stats["limit"]:
        raise HTTPException(429, "Monthly schema limit reached. Upgrade to Pro.")

    start = time.perf_counter()
    schema, stages = generate_schema(request)
    ddl = synthesize_ddl(schema)
    record = store.save(
        schema,
        ddl,
        request.prompt,
        "Initial generation",
        naming_convention=request.naming_convention.value,
    )
    if request.project_name:
        store.save_project(request.project_name, request.prompt, record.id)

    elapsed = int((time.perf_counter() - start) * 1000)
    avg_conf = sum(t.confidence for t in schema.tables) / max(len(schema.tables), 1)

    return GenerateResponse(
        schema_id=record.id,
        version=record.current_version,
        schema_ast=schema,
        ddl=ddl,
        generation_time_ms=elapsed,
        confidence_score=round(avg_conf, 3),
        pipeline_stages=stages,
    )


@router.post("/v1/schema/wizard", response_model=GenerateResponse)
def api_wizard(req: WizardRequest):
    prompt = (
        f"Build a {req.domain} database. Entities: {', '.join(req.entities)}. "
        f"Relationships: {req.relationships or 'infer from domain best practices'}."
    )
    gen_req = GenerateRequest(
        prompt=prompt,
        dialect=req.dialect,
        normalization=req.normalization,
    )
    return api_generate(gen_req)


@router.post("/v1/schema/infer-csv", response_model=GenerateResponse)
async def api_infer_csv(
    file: UploadFile = File(...),
    dialect: Dialect = Dialect.POSTGRESQL,
    table_name: str = "imported_data",
):
    content = (await file.read()).decode("utf-8", errors="replace")
    schema = infer_schema_from_csv(content, table_name, dialect)
    ddl = synthesize_ddl(schema)
    record = store.save(schema, ddl, f"CSV import: {file.filename}", "CSV inference")
    avg_conf = sum(t.confidence for t in schema.tables) / max(len(schema.tables), 1)
    return GenerateResponse(
        schema_id=record.id,
        version=1,
        schema_ast=schema,
        ddl=ddl,
        generation_time_ms=500,
        confidence_score=round(avg_conf, 3),
        pipeline_stages=[{"stage": "CSV Inference", "status": "complete", "detail": file.filename or "upload"}],
    )


@router.post("/v1/schema/refine", response_model=GenerateResponse)
def api_refine(request: RefineRequest):
    record = store.get(request.schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")

    start = time.perf_counter()
    schema, stages = refine_schema(record, request.message)
    ddl = synthesize_ddl(schema)
    updated = store.add_version(record.id, schema, ddl, request.message, f"Refinement: {request.message[:50]}")
    elapsed = int((time.perf_counter() - start) * 1000)
    avg_conf = sum(t.confidence for t in schema.tables) / max(len(schema.tables), 1)

    return GenerateResponse(
        schema_id=record.id,
        version=updated.current_version if updated else record.current_version,
        schema_ast=schema,
        ddl=ddl,
        generation_time_ms=elapsed,
        confidence_score=round(avg_conf, 3),
        pipeline_stages=stages,
    )


@router.post("/v1/schema/{schema_id}/review")
def api_review(schema_id: str):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    schema = record.versions[-1].schema_ast
    if openai_service.is_available():
        try:
            return openai_service.review_schema(schema)
        except Exception as e:
            raise HTTPException(502, f"OpenAI review failed: {e}") from e
    return {
        "score": 78,
        "summary": "Rule-based review (set OPENAI_API_KEY for AI critique)",
        "strengths": ["Normalized structure", "Primary keys defined"],
        "issues": ["Enable OpenAI for deeper analysis"],
        "recommendations": [{"priority": "medium", "title": "Add OpenAI API key", "detail": "Set OPENAI_API_KEY in backend/.env"}],
    }


@router.post("/v1/schema/{schema_id}/rollback", response_model=GenerateResponse)
def api_rollback(schema_id: str, req: RollbackRequest):
    updated = store.rollback(schema_id, req.version)
    if not updated:
        raise HTTPException(404, "Schema or version not found")
    current = updated.versions[-1]
    schema = current.schema_ast
    avg_conf = sum(t.confidence for t in schema.tables) / max(len(schema.tables), 1)
    return GenerateResponse(
        schema_id=schema_id,
        version=updated.current_version,
        schema_ast=schema,
        ddl=current.ddl,
        generation_time_ms=50,
        confidence_score=round(avg_conf, 3),
        pipeline_stages=[{"stage": "Rollback", "status": "complete", "detail": f"Restored to v{req.version}"}],
    )


@router.post("/v1/schema/{schema_id}/migrate")
def api_migrate(schema_id: str, req: MigrateRequest):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    to_v = req.to_version or record.current_version
    v_from = next((v for v in record.versions if v.version == req.from_version), None)
    v_to = next((v for v in record.versions if v.version == to_v), None)
    if not v_from or not v_to:
        raise HTTPException(400, "Invalid version numbers")
    sql = generate_migration(v_from.schema_ast, v_to.schema_ast, record.dialect.value)
    return {"migration_sql": sql, "from_version": req.from_version, "to_version": to_v}


@router.post("/v1/schema/{schema_id}/share")
def api_share(schema_id: str):
    token = store.create_share_token(schema_id)
    if not token:
        raise HTTPException(404, "Schema not found")
    return {"share_token": token, "url": f"/shared/{token}"}


@router.get("/v1/shared/{token}")
def get_shared(token: str):
    record = store.get_by_share_token(token)
    if not record:
        raise HTTPException(404, "Shared schema not found")
    current = record.versions[-1]
    return {"id": record.id, "schema": current.schema_ast, "ddl": current.ddl, "read_only": True}


@router.get("/v1/schema/{schema_id}/comments")
def list_comments(schema_id: str):
    return {"comments": store.list_comments(schema_id)}


@router.post("/v1/schema/{schema_id}/comments")
def add_comment(schema_id: str, req: CommentRequest):
    if not store.get(schema_id):
        raise HTTPException(404, "Schema not found")
    return store.add_comment(schema_id, req.author, req.content, req.table_name, req.column_name)


@router.get("/v1/schema/{schema_id}")
def get_schema(schema_id: str):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    current = record.versions[-1]
    return {
        "id": record.id,
        "version": record.current_version,
        "schema": current.schema_ast,
        "ddl": current.ddl,
        "versions": [
            {"version": v.version, "label": v.label, "created_at": v.created_at, "prompt": v.prompt}
            for v in record.versions
        ],
    }


@router.get("/v1/schema/{schema_id}/compare")
def compare_dialects(schema_id: str, dialects: str = "postgresql,mysql"):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    base = record.versions[-1].schema_ast
    result = {}
    for d in dialects.split(","):
        d = d.strip()
        try:
            dialect = Dialect(d)
            updated = base.model_copy(update={"dialect": dialect})
            result[d] = synthesize_ddl(updated)
        except ValueError:
            continue
    return {"dialects": result}


@router.get("/v1/schema/{schema_id}/export")
def export_schema(schema_id: str, format: ExportFormat = ExportFormat.DDL, dialect: Dialect | None = None):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    schema = record.versions[-1].schema_ast
    ddl = record.versions[-1].ddl
    if dialect:
        schema = schema.model_copy(update={"dialect": dialect})
        ddl = synthesize_ddl(schema)
    content = export_by_format(schema, format.value, ddl)
    return PlainTextResponse(content, media_type="text/plain")


@router.get("/v1/schema/{schema_id}/versions")
def list_versions(schema_id: str):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    return {"versions": record.versions}


@router.get("/v1/schema/{schema_id}/diff")
def schema_diff(schema_id: str, from_version: int = 1, to_version: int | None = None):
    record = store.get(schema_id)
    if not record:
        raise HTTPException(404, "Schema not found")
    to_v = to_version or record.current_version
    v_from = next((v for v in record.versions if v.version == from_version), None)
    v_to = next((v for v in record.versions if v.version == to_v), None)
    if not v_from or not v_to:
        raise HTTPException(400, "Invalid version numbers")

    tables_from = {t.name for t in v_from.schema_ast.tables}
    tables_to = {t.name for t in v_to.schema_ast.tables}
    added = tables_to - tables_from
    removed = tables_from - tables_to

    changed = []
    cols_from = {t.name: {c.name for c in t.columns} for t in v_from.schema_ast.tables}
    cols_to = {t.name: {c.name for c in t.columns} for t in v_to.schema_ast.tables}
    for name in tables_from & tables_to:
        added_cols = cols_to.get(name, set()) - cols_from.get(name, set())
        removed_cols = cols_from.get(name, set()) - cols_to.get(name, set())
        if added_cols or removed_cols:
            changed.append({"table": name, "added_columns": list(added_cols), "removed_columns": list(removed_cols)})

    migration_sql = generate_migration(v_from.schema_ast, v_to.schema_ast, record.dialect.value)

    return {
        "from_version": from_version,
        "to_version": to_v,
        "added_tables": list(added),
        "removed_tables": list(removed),
        "changed_tables": changed,
        "migration_sql": migration_sql,
    }
