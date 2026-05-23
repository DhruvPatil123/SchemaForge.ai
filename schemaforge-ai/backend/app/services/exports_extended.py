import json

from app.models.schema import SchemaAST
from app.services.ddl_synthesizer import synthesize_ddl, to_prisma, to_sqlalchemy


def to_dbml(schema: SchemaAST) -> str:
    lines = ["// SchemaForge AI — DBML", ""]
    table_ids = {}
    for i, t in enumerate(schema.tables):
        table_ids[t.name] = i + 1
        lines.append(f"Table {t.name} {{")
        for col in t.columns:
            flags = []
            if col.primary_key:
                flags.append("pk")
            if col.unique:
                flags.append("unique")
            if not col.nullable:
                flags.append("not null")
            note = f' // {col.comment}' if col.comment else ""
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            lines.append(f"  {col.name} {col.type}{flag_str}{note}")
        if t.comment:
            lines.append(f"  Note: '{t.comment}'")
        lines.append("}")
        lines.append("")

    for rel in schema.relationships:
        lines.append(
            f"Ref: {rel.from_table}.{rel.from_column} > {rel.to_table}.{rel.to_column}"
        )
    return "\n".join(lines)


def to_mermaid_erd(schema: SchemaAST) -> str:
    lines = ["erDiagram"]
    for rel in schema.relationships:
        card = "||--o{"
        if rel.relationship_type == "one_to_one":
            card = "||--||"
        elif rel.relationship_type == "many_to_many":
            card = "}o--o{"
        lines.append(f"    {rel.from_table} {card} {rel.to_table} : \"\"")

    for table in schema.tables:
        lines.append(f"    {table.name} {{")
        for col in table.columns[:12]:
            pk = "PK" if col.primary_key else ""
            lines.append(f"        {col.type} {col.name} {pk}".strip())
        lines.append("    }")
    return "\n".join(lines)


def _ts_type(t: str) -> str:
    t = t.lower()
    if "int" in t or "decimal" in t or "float" in t or "double" in t or "numeric" in t:
        return "number"
    if "bool" in t:
        return "boolean"
    if "date" in t or "time" in t or "timestamp" in t:
        return "Date"
    return "string"


def to_typeorm(schema: SchemaAST) -> str:
    lines = [
        '/** SchemaForge AI — TypeORM Entities */',
        'import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn } from "typeorm";',
        ""
    ]
    for table in schema.tables:
        class_name = "".join(w.capitalize() for w in table.name.split("_"))
        lines.append(f"@Entity(\"{table.name}\")")
        lines.append(f"export class {class_name} {{")
        for col in table.columns:
            if col.primary_key:
                if "uuid" in col.type.lower():
                    dec = "@PrimaryGeneratedColumn('uuid')"
                elif "int" in col.type.lower():
                    dec = "@PrimaryGeneratedColumn()"
                else:
                    dec = "@PrimaryColumn()"
            else:
                dec = "@Column()"
            
            ts_type = _ts_type(col.type)
            lines.append(f"  {dec}")
            lines.append(f"  {col.name}: {ts_type};")
        lines.append("}")
        lines.append("")
    return "\n".join(lines)


def to_django(schema: SchemaAST) -> str:
    lines = [
        "# SchemaForge AI — Django Models",
        "import uuid",
        "from django.db import models",
        ""
    ]
    for table in schema.tables:
        class_name = "".join(w.capitalize() for w in table.name.split("_"))
        lines.append(f"class {class_name}(models.Model):")
        for col in table.columns:
            if col.primary_key:
                if "uuid" in col.type.lower():
                    field = "models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)"
                elif "int" in col.type.lower():
                    field = "models.AutoField(primary_key=True)"
                else:
                    field = "models.CharField(max_length=255, primary_key=True)"
            elif "int" in col.type:
                field = "models.IntegerField()"
            elif "bool" in col.type:
                field = "models.BooleanField(default=False)"
            elif "timestamp" in col.type:
                field = "models.DateTimeField(auto_now_add=True)" if col.name == "created_at" else "models.DateTimeField(auto_now=True)"
            elif "text" in col.type:
                field = "models.TextField(blank=True, null=True)"
            else:
                field = "models.CharField(max_length=255)"
            lines.append(f"    {col.name} = {field}")
        lines.append("")
        lines.append("    class Meta:")
        lines.append(f"        db_table = '{table.name}'")
        lines.append("")
    return "\n".join(lines)


def to_liquibase(schema: SchemaAST) -> str:
    lines = [
        "--liquibase formatted sql",
        "--changeset schemaforge:1",
        "",
    ]
    lines.append(synthesize_ddl(schema))
    return "\n".join(lines)


def to_flyway(schema: SchemaAST) -> str:
    return f"-- Flyway migration V1__schemaforge_init.sql\n\n{synthesize_ddl(schema)}"


def to_json_schema_doc(schema: SchemaAST) -> str:
    doc = {}
    for table in schema.tables:
        props = {}
        for col in table.columns:
            props[col.name] = {"type": _json_type(col.type), "description": col.comment or ""}
        doc[table.name] = {"type": "object", "properties": props, "required": [c.name for c in table.columns if not c.nullable]}
    return json.dumps(doc, indent=2)


def _json_type(t: str) -> str:
    t = t.lower()
    if "int" in t:
        return "integer"
    if "bool" in t:
        return "boolean"
    if "decimal" in t:
        return "number"
    return "string"


def export_by_format(schema: SchemaAST, fmt: str, ddl: str) -> str:
    exporters = {
        "ddl": lambda: ddl or synthesize_ddl(schema),
        "prisma": lambda: to_prisma(schema),
        "sqlalchemy": lambda: to_sqlalchemy(schema),
        "dbml": lambda: to_dbml(schema),
        "mermaid": lambda: to_mermaid_erd(schema),
        "typeorm": lambda: to_typeorm(schema),
        "django": lambda: to_django(schema),
        "liquibase": lambda: to_liquibase(schema),
        "flyway": lambda: to_flyway(schema),
        "json_schema": lambda: to_json_schema_doc(schema),
    }
    fn = exporters.get(fmt)
    if not fn:
        return ddl
    return fn()
