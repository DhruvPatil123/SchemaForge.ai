import csv
import io
from typing import Any

from app.models.schema import ColumnDef, Dialect, SchemaAST, TableDef


def infer_schema_from_csv(content: str, table_name: str = "imported_data", dialect: Dialect = Dialect.POSTGRESQL) -> SchemaAST:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise ValueError("CSV has no headers")

    columns: list[ColumnDef] = [
        ColumnDef(name="id", type="uuid", nullable=False, primary_key=True, confidence=0.99),
    ]
    sample = next(reader, None)
    reader = csv.DictReader(io.StringIO(content))  # reset

    for field in reader.fieldnames or []:
        safe = field.strip().lower().replace(" ", "_").replace("-", "_")
        col_type = _infer_type(sample.get(field, "") if sample else "")
        columns.append(
            ColumnDef(
                name=safe,
                type=col_type,
                nullable=True,
                confidence=0.75,
                comment=f"Inferred from CSV column: {field}",
            )
        )

    columns.extend([
        ColumnDef(name="created_at", type="timestamp", nullable=False, default="NOW()", confidence=0.9),
    ])

    table = TableDef(
        name=table_name,
        comment="Inferred from CSV upload",
        columns=columns,
        indexes=[f"idx_{table_name}_created"],
        confidence=0.8,
    )

    return SchemaAST(
        name="CSV Imported Schema",
        dialect=dialect,
        tables=[table],
        domain="Imported",
        use_case="OLTP",
    )


def _infer_type(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return "string"
    if v.lower() in ("true", "false", "yes", "no", "0", "1"):
        return "bool"
    try:
        int(v)
        return "int"
    except ValueError:
        pass
    try:
        float(v)
        return "decimal"
    except ValueError:
        pass
    if "T" in v and ":" in v:
        return "timestamp"
    return "string"
