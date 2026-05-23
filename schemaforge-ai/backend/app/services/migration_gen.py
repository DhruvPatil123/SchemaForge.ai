from app.models.schema import SchemaAST


def generate_migration(from_schema: SchemaAST, to_schema: SchemaAST, dialect: str = "postgresql") -> str:
    lines = [
        "-- SchemaForge AI — Migration Script",
        f"-- From: {from_schema.name} -> To: {to_schema.name}",
        "",
    ]
    tables_from = {t.name: t for t in from_schema.tables}
    tables_to = {t.name: t for t in to_schema.tables}

    for name in sorted(tables_to.keys() - tables_from.keys()):
        t = tables_to[name]
        cols = ", ".join(f"{c.name} {_sql_type(c.type, dialect)}" for c in t.columns)
        lines.append(f"CREATE TABLE {name} ({cols});")

    for name in sorted(tables_from.keys() - tables_to.keys()):
        lines.append(f"DROP TABLE IF EXISTS {name};")

    for name in tables_from.keys() & tables_to.keys():
        cols_from = {c.name: c for c in tables_from[name].columns}
        cols_to = {c.name: c for c in tables_to[name].columns}
        for col_name in sorted(cols_to.keys() - cols_from.keys()):
            c = cols_to[col_name]
            nullable = "" if c.nullable else " NOT NULL"
            lines.append(
                f"ALTER TABLE {name} ADD COLUMN {col_name} {_sql_type(c.type, dialect)}{nullable};"
            )
        for col_name in sorted(cols_from.keys() - cols_to.keys()):
            if dialect == "postgresql":
                lines.append(f"ALTER TABLE {name} DROP COLUMN {col_name};")
            else:
                lines.append(f"-- ALTER TABLE {name} DROP COLUMN {col_name}; -- verify dialect support")

    lines.append("")
    return "\n".join(lines)


def _sql_type(t: str, dialect: str) -> str:
    mapping = {
        "uuid": "UUID" if dialect == "postgresql" else "CHAR(36)",
        "string": "VARCHAR(255)",
        "text": "TEXT",
        "int": "INTEGER",
        "bigint": "BIGINT",
        "bool": "BOOLEAN",
        "decimal": "DECIMAL(12,2)",
        "timestamp": "TIMESTAMPTZ" if dialect == "postgresql" else "DATETIME",
        "date": "DATE",
        "json": "JSONB" if dialect == "postgresql" else "JSON",
    }
    base = t.lower().split("(")[0]
    return mapping.get(base, t.upper())
