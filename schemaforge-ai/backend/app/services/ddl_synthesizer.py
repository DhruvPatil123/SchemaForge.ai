import json

from app.models.schema import ColumnDef, Dialect, SchemaAST, TableDef


TYPE_MAP: dict[Dialect, dict[str, str]] = {
    Dialect.POSTGRESQL: {
        "uuid": "UUID",
        "string": "VARCHAR(255)",
        "text": "TEXT",
        "int": "INTEGER",
        "bigint": "BIGINT",
        "bool": "BOOLEAN",
        "decimal": "DECIMAL(12,2)",
        "timestamp": "TIMESTAMPTZ",
        "date": "DATE",
        "json": "JSONB",
    },
    Dialect.MYSQL: {
        "uuid": "CHAR(36)",
        "string": "VARCHAR(255)",
        "text": "TEXT",
        "int": "INT",
        "bigint": "BIGINT",
        "bool": "TINYINT(1)",
        "decimal": "DECIMAL(12,2)",
        "timestamp": "DATETIME(6)",
        "date": "DATE",
        "json": "JSON",
    },
    Dialect.SQLITE: {
        "uuid": "TEXT",
        "string": "TEXT",
        "text": "TEXT",
        "int": "INTEGER",
        "bigint": "INTEGER",
        "bool": "INTEGER",
        "decimal": "REAL",
        "timestamp": "TEXT",
        "date": "TEXT",
        "json": "TEXT",
    },
    Dialect.MSSQL: {
        "uuid": "UNIQUEIDENTIFIER",
        "string": "NVARCHAR(255)",
        "text": "NVARCHAR(MAX)",
        "int": "INT",
        "bigint": "BIGINT",
        "bool": "BIT",
        "decimal": "DECIMAL(12,2)",
        "timestamp": "DATETIMEOFFSET",
        "date": "DATE",
        "json": "NVARCHAR(MAX)",
    },
    Dialect.ORACLE: {
        "uuid": "RAW(16)",
        "string": "VARCHAR2(255)",
        "text": "CLOB",
        "int": "NUMBER(10)",
        "bigint": "NUMBER(19)",
        "bool": "NUMBER(1)",
        "decimal": "NUMBER(12,2)",
        "timestamp": "TIMESTAMP WITH TIME ZONE",
        "date": "DATE",
        "json": "CLOB",
    },
    Dialect.SNOWFLAKE: {
        "uuid": "VARCHAR(36)",
        "string": "VARCHAR",
        "text": "TEXT",
        "int": "INTEGER",
        "bigint": "BIGINT",
        "bool": "BOOLEAN",
        "decimal": "NUMBER(12,2)",
        "timestamp": "TIMESTAMP_TZ",
        "date": "DATE",
        "json": "VARIANT",
    },
    Dialect.BIGQUERY: {
        "uuid": "STRING",
        "string": "STRING",
        "text": "STRING",
        "int": "INT64",
        "bigint": "INT64",
        "bool": "BOOL",
        "decimal": "NUMERIC",
        "timestamp": "TIMESTAMP",
        "date": "DATE",
        "json": "JSON",
    },
    Dialect.CASSANDRA: {
        "uuid": "uuid",
        "string": "text",
        "text": "text",
        "int": "int",
        "bigint": "bigint",
        "bool": "boolean",
        "decimal": "decimal",
        "timestamp": "timestamp",
        "date": "date",
        "json": "text",
    },
}

RELATIONAL_DIALECTS = {
    Dialect.POSTGRESQL,
    Dialect.MYSQL,
    Dialect.SQLITE,
    Dialect.MSSQL,
    Dialect.ORACLE,
    Dialect.SNOWFLAKE,
    Dialect.BIGQUERY,
}


def _map_type(col: ColumnDef, dialect: Dialect) -> str:
    base = col.type.lower().split("(")[0]
    mapping = TYPE_MAP.get(dialect, TYPE_MAP[Dialect.POSTGRESQL])
    return mapping.get(base, col.type.upper())


def _column_line(col: ColumnDef, dialect: Dialect) -> str:
    parts = [f"  {col.name} {_map_type(col, dialect)}"]
    if col.primary_key and dialect not in {Dialect.BIGQUERY}:
        parts.append("PRIMARY KEY")
    if not col.nullable and not col.primary_key:
        parts.append("NOT NULL")
    if col.unique and not col.primary_key and dialect not in {Dialect.BIGQUERY}:
        parts.append("UNIQUE")
    if col.default and dialect not in {Dialect.BIGQUERY}:
        parts.append(f"DEFAULT {col.default}")
    if col.references and dialect not in {Dialect.SQLITE, Dialect.BIGQUERY}:
        parts.append(f"REFERENCES {col.references}")
    line = " ".join(parts)
    if col.comment and dialect == Dialect.POSTGRESQL:
        line += f"  -- {col.comment}"
    return line


def _primary_key(table: TableDef) -> ColumnDef:
    return next((c for c in table.columns if c.primary_key), table.columns[0])


def _index_column(table: TableDef, index_name: str) -> str | None:
    normalized = index_name.lower()
    for column in sorted(table.columns, key=lambda c: len(c.name), reverse=True):
        if column.name.lower() in normalized:
            return column.name
    return None


def _synthesize_sql(schema: SchemaAST) -> str:
    dialect = schema.dialect
    lines: list[str] = [
        "-- SchemaForge AI Generated Schema",
        f"-- Domain: {schema.domain or 'Custom'} | Dialect: {dialect.value} | Normalization: {schema.normalization}",
        "",
    ]

    for table in schema.tables:
        if table.comment:
            lines.append(f"-- {table.comment}")
        lines.append(f"CREATE TABLE {table.name} (")
        col_lines = [_column_line(c, dialect) for c in table.columns]
        lines.append(",\n".join(col_lines))
        lines.append(");")
        lines.append("")

        if dialect in {Dialect.BIGQUERY, Dialect.SNOWFLAKE} and table.indexes:
            lines.append(f"-- {dialect.value} does not use traditional secondary indexes for {table.name}.")
            lines.append("")
            continue

        for idx in table.indexes:
            index_col = _index_column(table, idx)
            if dialect == Dialect.MYSQL:
                lines.append(f"CREATE INDEX {idx} ON {table.name} ({index_col or ''});")
            else:
                lines.append(f"CREATE INDEX {idx} ON {table.name}{f' ({index_col})' if index_col else ''};")
            lines.append("")

    for rel in schema.relationships:
        if rel.relationship_type == "many_to_many" or dialect in {Dialect.SQLITE, Dialect.BIGQUERY}:
            continue
        fk_name = f"fk_{rel.from_table}_{rel.to_table}"
        lines.append(
            f"ALTER TABLE {rel.from_table} ADD CONSTRAINT {fk_name} "
            f"FOREIGN KEY ({rel.from_column}) REFERENCES {rel.to_table}({rel.to_column});"
        )
        lines.append("")

    if dialect == Dialect.BIGQUERY and schema.relationships:
        lines.append("-- BigQuery relationships are documented in the ERD; enforce them in application logic or metadata constraints.")

    return "\n".join(lines).strip() + "\n"


def _synthesize_cassandra(schema: SchemaAST) -> str:
    lines = [
        "-- SchemaForge AI Generated Cassandra CQL",
        f"-- Domain: {schema.domain or 'Custom'} | Normalization: {schema.normalization}",
        "",
    ]

    for table in schema.tables:
        pk = _primary_key(table)
        if table.comment:
            lines.append(f"-- {table.comment}")
        lines.append(f"CREATE TABLE IF NOT EXISTS {table.name} (")
        col_lines = [f"  {col.name} {_map_type(col, Dialect.CASSANDRA)}" for col in table.columns]
        col_lines.append(f"  PRIMARY KEY ({pk.name})")
        lines.append(",\n".join(col_lines))
        lines.append(");")
        lines.append("")

        for idx in table.indexes:
            index_col = _index_column(table, idx)
            if index_col and index_col != pk.name:
                lines.append(f"CREATE INDEX IF NOT EXISTS {idx} ON {table.name} ({index_col});")
                lines.append("")

    if schema.relationships:
        lines.append("-- Cassandra does not enforce foreign keys. Relationships are denormalization guidance:")
        for rel in schema.relationships:
            lines.append(f"-- {rel.from_table}.{rel.from_column} -> {rel.to_table}.{rel.to_column}")

    return "\n".join(lines).strip() + "\n"


def _mongo_bson_type(col: ColumnDef) -> str:
    base = col.type.lower().split("(")[0]
    if base in {"int", "bigint"}:
        return "long"
    if base == "bool":
        return "bool"
    if base == "decimal":
        return "decimal"
    if base in {"timestamp", "date"}:
        return "date"
    if base == "json":
        return "object"
    return "string"


def _synthesize_mongodb(schema: SchemaAST) -> str:
    lines = [
        "// SchemaForge AI Generated MongoDB Collection Setup",
        f"// Domain: {schema.domain or 'Custom'} | Normalization source: {schema.normalization}",
        "",
    ]

    for table in schema.tables:
        properties = {}
        for col in table.columns:
            prop = {"bsonType": _mongo_bson_type(col)}
            if col.comment:
                prop["description"] = col.comment
            properties[col.name] = prop

        validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": [c.name for c in table.columns if not c.nullable or c.primary_key],
                "properties": properties,
            }
        }
        options = {"validator": validator, "validationLevel": "moderate"}
        lines.append(f'db.createCollection("{table.name}", {json.dumps(options, indent=2)});')

        for col in table.columns:
            if col.primary_key or col.unique:
                lines.append(
                    f'db.{table.name}.createIndex({{ "{col.name}": 1 }}, {{ unique: true }});'
                )

        for idx in table.indexes:
            index_col = _index_column(table, idx)
            if index_col:
                lines.append(f'db.{table.name}.createIndex({{ "{index_col}": 1 }}, {{ name: "{idx}" }});')
        lines.append("")

    if schema.relationships:
        lines.append("// Relationships are represented by reference fields or embedded documents:")
        for rel in schema.relationships:
            lines.append(f"// {rel.from_table}.{rel.from_column} -> {rel.to_table}.{rel.to_column}")

    return "\n".join(lines).strip() + "\n"


def _dynamo_attr_type(col: ColumnDef) -> str:
    base = col.type.lower().split("(")[0]
    if base in {"int", "bigint", "decimal"}:
        return "N"
    if base == "binary":
        return "B"
    return "S"


def _synthesize_dynamodb(schema: SchemaAST) -> str:
    tables = []
    relationship_notes = []

    for table in schema.tables:
        pk = _primary_key(table)
        attribute_definitions = [{"AttributeName": pk.name, "AttributeType": _dynamo_attr_type(pk)}]
        global_secondary_indexes = []
        known_attrs = {pk.name}

        for idx in table.indexes:
            index_col = _index_column(table, idx)
            if not index_col or index_col in known_attrs:
                continue
            col = next(c for c in table.columns if c.name == index_col)
            known_attrs.add(index_col)
            attribute_definitions.append({"AttributeName": index_col, "AttributeType": _dynamo_attr_type(col)})
            global_secondary_indexes.append(
                {
                    "IndexName": idx,
                    "KeySchema": [{"AttributeName": index_col, "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                }
            )

        table_plan = {
            "TableName": table.name,
            "BillingMode": "PAY_PER_REQUEST",
            "AttributeDefinitions": attribute_definitions,
            "KeySchema": [{"AttributeName": pk.name, "KeyType": "HASH"}],
            "GlobalSecondaryIndexes": global_secondary_indexes,
            "DocumentAttributes": [
                {
                    "name": col.name,
                    "type": col.type,
                    "required": not col.nullable or col.primary_key,
                    "unique": col.unique,
                    "reference": col.references,
                }
                for col in table.columns
                if col.name not in known_attrs
            ],
        }
        tables.append(table_plan)

    for rel in schema.relationships:
        relationship_notes.append(f"{rel.from_table}.{rel.from_column} -> {rel.to_table}.{rel.to_column}")

    return json.dumps(
        {
            "dialect": "dynamodb",
            "domain": schema.domain or "Custom",
            "tables": tables,
            "relationshipNotes": relationship_notes,
        },
        indent=2,
    ) + "\n"


def synthesize_ddl(schema: SchemaAST) -> str:
    if schema.dialect == Dialect.MONGODB:
        return _synthesize_mongodb(schema)
    if schema.dialect == Dialect.CASSANDRA:
        return _synthesize_cassandra(schema)
    if schema.dialect == Dialect.DYNAMODB:
        return _synthesize_dynamodb(schema)
    if schema.dialect in RELATIONAL_DIALECTS:
        return _synthesize_sql(schema)
    return _synthesize_sql(schema)


def to_prisma(schema: SchemaAST) -> str:
    lines = [
        "// SchemaForge AI — Prisma Schema",
        f"// Dialect target: {schema.dialect.value}",
        "",
        "generator client {",
        "  provider = \"prisma-client-js\"",
        "}",
        "",
        "datasource db {",
        "  provider = \"postgresql\"",
        "  url      = env(\"DATABASE_URL\")",
        "}",
        "",
    ]
    for table in schema.tables:
        lines.append(f"model {table.name.title().replace('_', '')} {{")
        for col in table.columns:
            prisma_type = "String"
            if "int" in col.type.lower():
                prisma_type = "Int"
            elif "bool" in col.type.lower():
                prisma_type = "Boolean"
            elif "timestamp" in col.type.lower():
                prisma_type = "DateTime"
            elif "decimal" in col.type.lower():
                prisma_type = "Decimal"
            attrs = []
            if col.primary_key:
                attrs.append("@id @default(uuid())")
            if col.unique:
                attrs.append("@unique")
            attr_str = " ".join(attrs)
            lines.append(f"  {col.name} {prisma_type}{' ' + attr_str if attr_str else ''}")
        lines.append("}")
        lines.append("")
    return "\n".join(lines)


def to_sqlalchemy(schema: SchemaAST) -> str:
    lines = [
        '"""SchemaForge AI — SQLAlchemy Models"""',
        "from sqlalchemy import Column, String, Integer, Boolean, DateTime, Numeric, ForeignKey",
        "from sqlalchemy.orm import declarative_base",
        "",
        "Base = declarative_base()",
        "",
    ]
    for table in schema.tables:
        class_name = "".join(w.capitalize() for w in table.name.split("_"))
        lines.append(f"class {class_name}(Base):")
        lines.append(f'    __tablename__ = "{table.name}"')
        for col in table.columns:
            sa_type = "String(255)"
            if "int" in col.type.lower():
                sa_type = "Integer"
            elif "bool" in col.type.lower():
                sa_type = "Boolean"
            elif "timestamp" in col.type.lower():
                sa_type = "DateTime"
            elif "decimal" in col.type.lower():
                sa_type = "Numeric(12, 2)"
            pk = ", primary_key=True" if col.primary_key else ""
            lines.append(f"    {col.name} = Column({sa_type}{pk})")
        lines.append("")
    return "\n".join(lines)
