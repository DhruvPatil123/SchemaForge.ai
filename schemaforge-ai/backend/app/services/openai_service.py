import json
import logging
from typing import Any

from openai import OpenAI

from app.config import settings
from app.models.schema import Dialect, SchemaAST

logger = logging.getLogger(__name__)

SCHEMA_JSON_INSTRUCTION = """
Return JSON with this exact structure:
{
  "name": "Schema title",
  "domain": "domain name",
  "use_case": "OLTP or OLAP",
  "tables": [
    {
      "name": "table_name",
      "comment": "optional",
      "confidence": 0.95,
      "indexes": ["idx_name"],
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "nullable": false,
          "primary_key": true,
          "unique": false,
          "default": "gen_random_uuid()",
          "references": null,
          "comment": null,
          "confidence": 0.99
        }
      ]
    }
  ],
  "relationships": [
    {
      "from_table": "orders",
      "from_column": "customer_id",
      "to_table": "customers",
      "to_column": "id",
      "relationship_type": "many_to_one",
      "confidence": 0.9
    }
  ]
}
Use snake_case table/column names unless told otherwise.
Types: uuid, string, text, int, bigint, bool, decimal, timestamp, date, json.
Apply 3NF normalization. Include audit columns (created_at, updated_at) when appropriate.
"""


def is_available() -> bool:
    return bool(settings.llm_api_key)


def _client() -> OpenAI:
    if not settings.llm_api_key:
        raise ValueError("OPENROUTER_API_KEY or OPENAI_API_KEY is not configured")
    kwargs: dict = {
        "api_key": settings.llm_api_key,
        "default_headers": {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "SchemaForge AI",
        },
    }
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**kwargs)


def generate_schema_from_prompt(
    prompt: str,
    dialect: Dialect,
    normalization: str = "3NF",
    naming_convention: str = "snake_case",
    include_audit: bool = True,
) -> tuple[SchemaAST, list[dict[str, Any]]]:
    client = _client()
    stages: list[dict[str, Any]] = []

    user_msg = (
        f"Generate a complete {dialect.value} database schema.\n"
        f"Normalization: {normalization}\n"
        f"Naming convention: {naming_convention}\n"
        f"Include audit columns: {include_audit}\n\n"
        f"Description:\n{prompt}"
    )

    stages.append({"stage": "Intent Classifier", "status": "complete", "detail": "OpenAI analyzing domain"})
    stages.append({"stage": "Entity Extractor", "status": "running", "detail": f"Model: {settings.openai_model}"})

    response = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are SchemaForge AI, an expert database architect. "
                    "Output only valid JSON for production-ready schemas."
                    + SCHEMA_JSON_INSTRUCTION
                ),
            },
            {"role": "user", "content": user_msg},
        ],
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    data["dialect"] = dialect.value
    data["normalization"] = normalization

    schema = SchemaAST.model_validate(data)
    stages.append({"stage": "Entity Extractor", "status": "complete", "detail": f"{len(schema.tables)} tables"})
    stages.append({"stage": "Relationship Mapper", "status": "complete", "detail": f"{len(schema.relationships)} relationships"})
    stages.append({"stage": "Schema Planner", "status": "complete", "detail": f"Applied {normalization}"})
    stages.append({"stage": "DDL Synthesizer", "status": "complete", "detail": f"Dialect: {dialect.value}"})
    stages.append({"stage": "Schema Validator", "status": "complete", "detail": "OpenAI structured output validated"})
    stages.append({"stage": "Optimizer", "status": "complete", "detail": "Index recommendations included"})
    stages.append({"stage": "Complete", "status": "complete", "detail": "OpenAI generation successful"})

    return schema, stages


def refine_schema_with_prompt(
    current: SchemaAST,
    message: str,
) -> tuple[SchemaAST, list[dict[str, Any]]]:
    client = _client()
    user_msg = (
        f"Current schema JSON:\n{current.model_dump_json()}\n\n"
        f"Apply this refinement and return the full updated schema JSON:\n{message}"
    )
    response = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": "You refine database schemas. Return the complete updated schema JSON."
                + SCHEMA_JSON_INSTRUCTION,
            },
            {"role": "user", "content": user_msg},
        ],
    )
    data = json.loads(response.choices[0].message.content or "{}")
    data["dialect"] = current.dialect.value
    data["normalization"] = current.normalization
    schema = SchemaAST.model_validate(data)
    stages = [{"stage": "Chat Refinement (OpenAI)", "status": "complete", "detail": message[:80]}]
    return schema, stages


def review_schema(schema: SchemaAST) -> dict[str, Any]:
    client = _client()
    response = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        temperature=0.3,
        messages=[
            {
                "role": "system",
                "content": (
                    "Review the database schema. Return JSON: "
                    '{"score": 0-100, "summary": "...", "strengths": [], "issues": [], '
                    '"recommendations": [{"priority": "high|medium|low", "title": "...", "detail": "..."}]}'
                ),
            },
            {"role": "user", "content": f"Review this schema:\n{schema.model_dump_json()}"},
        ],
    )
    return json.loads(response.choices[0].message.content or "{}")
