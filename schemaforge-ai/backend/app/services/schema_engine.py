import re
import time
import uuid
from datetime import datetime, timezone

from app.models.schema import (
    ColumnDef,
    Dialect,
    ExportFormat,
    GenerateRequest,
    GenerateResponse,
    RefineRequest,
    RelationshipDef,
    SchemaAST,
    SchemaRecord,
    SchemaVersion,
    TableDef,
)
from app.services.ddl_synthesizer import synthesize_ddl, to_prisma, to_sqlalchemy
from app.services.templates import TEMPLATES


def _uuid_col(name: str = "id", comment: str | None = None) -> ColumnDef:
    return ColumnDef(
        name=name,
        type="uuid",
        nullable=False,
        primary_key=True,
        default="gen_random_uuid()" if name == "id" else None,
        comment=comment,
        confidence=0.99,
    )


def _ts_cols(include_audit: bool) -> list[ColumnDef]:
    cols = [
        ColumnDef(
            name="created_at",
            type="timestamp",
            nullable=False,
            default="NOW()",
            comment="Record creation timestamp",
            confidence=0.98,
        ),
        ColumnDef(
            name="updated_at",
            type="timestamp",
            nullable=False,
            default="NOW()",
            comment="Last update timestamp",
            confidence=0.98,
        ),
    ]
    if include_audit:
        cols.append(
            ColumnDef(
                name="deleted_at",
                type="timestamp",
                nullable=True,
                comment="Soft delete timestamp",
                confidence=0.85,
            )
        )
    return cols


def _build_ecommerce_schema(dialect: Dialect, include_audit: bool) -> SchemaAST:
    audit = _ts_cols(include_audit)
    tables = [
        TableDef(
            name="vendors",
            comment="Marketplace vendors/sellers",
            columns=[
                _uuid_col(),
                ColumnDef(name="name", type="string", nullable=False, comment="Vendor display name"),
                ColumnDef(name="slug", type="string", nullable=False, unique=True),
                ColumnDef(name="email", type="string", nullable=False, unique=True),
                ColumnDef(name="is_active", type="bool", nullable=False, default="TRUE"),
                *audit,
            ],
            indexes=["idx_vendors_slug", "idx_vendors_active"],
        ),
        TableDef(
            name="customers",
            comment="Registered customers",
            columns=[
                _uuid_col(),
                ColumnDef(name="email", type="string", nullable=False, unique=True),
                ColumnDef(name="full_name", type="string", nullable=False),
                ColumnDef(name="phone", type="string", nullable=True),
                *audit,
            ],
            indexes=["idx_customers_email"],
        ),
        TableDef(
            name="products",
            comment="Products listed by vendors",
            columns=[
                _uuid_col(),
                ColumnDef(name="vendor_id", type="uuid", nullable=False, references="vendors(id)"),
                ColumnDef(name="name", type="string", nullable=False),
                ColumnDef(name="description", type="text", nullable=True),
                ColumnDef(name="base_price", type="decimal", nullable=False),
                ColumnDef(name="sku", type="string", nullable=False, unique=True),
                ColumnDef(name="is_published", type="bool", nullable=False, default="FALSE"),
                *audit,
            ],
            indexes=["idx_products_vendor", "idx_products_sku"],
        ),
        TableDef(
            name="product_variants",
            comment="Size, color, and other variant options",
            columns=[
                _uuid_col(),
                ColumnDef(name="product_id", type="uuid", nullable=False, references="products(id)"),
                ColumnDef(name="size", type="string", nullable=True),
                ColumnDef(name="color", type="string", nullable=True),
                ColumnDef(name="price_adjustment", type="decimal", nullable=False, default="0"),
                ColumnDef(name="stock_quantity", type="int", nullable=False, default="0"),
                *audit,
            ],
            indexes=["idx_variants_product"],
        ),
        TableDef(
            name="orders",
            comment="Customer purchase orders",
            columns=[
                _uuid_col(),
                ColumnDef(name="customer_id", type="uuid", nullable=False, references="customers(id)"),
                ColumnDef(name="status", type="string", nullable=False, default="'pending'"),
                ColumnDef(name="total_amount", type="decimal", nullable=False),
                ColumnDef(name="currency", type="string", nullable=False, default="'USD'"),
                *audit,
            ],
            indexes=["idx_orders_customer", "idx_orders_status"],
        ),
        TableDef(
            name="order_items",
            comment="Line items within an order",
            columns=[
                _uuid_col(),
                ColumnDef(name="order_id", type="uuid", nullable=False, references="orders(id)"),
                ColumnDef(name="product_variant_id", type="uuid", nullable=False, references="product_variants(id)"),
                ColumnDef(name="quantity", type="int", nullable=False),
                ColumnDef(name="unit_price", type="decimal", nullable=False),
                ColumnDef(name="product_name_snapshot", type="string", nullable=True, comment="Historical product name"),
                *audit[:2],
            ],
            indexes=["idx_order_items_order"],
        ),
        TableDef(
            name="discount_codes",
            comment="Promotional discount codes",
            columns=[
                _uuid_col(),
                ColumnDef(name="code", type="string", nullable=False, unique=True),
                ColumnDef(name="discount_type", type="string", nullable=False),
                ColumnDef(name="value", type="decimal", nullable=False),
                ColumnDef(name="max_uses", type="int", nullable=True),
                ColumnDef(name="expires_at", type="timestamp", nullable=True),
                *audit,
            ],
            indexes=["idx_discount_codes_code"],
        ),
        TableDef(
            name="order_discounts",
            comment="Discounts applied to orders",
            columns=[
                _uuid_col(),
                ColumnDef(name="order_id", type="uuid", nullable=False, references="orders(id)"),
                ColumnDef(name="discount_code_id", type="uuid", nullable=False, references="discount_codes(id)"),
                ColumnDef(name="amount_applied", type="decimal", nullable=False),
            ],
        ),
        TableDef(
            name="product_reviews",
            comment="Customer product reviews and ratings",
            columns=[
                _uuid_col(),
                ColumnDef(name="product_id", type="uuid", nullable=False, references="products(id)"),
                ColumnDef(name="customer_id", type="uuid", nullable=False, references="customers(id)"),
                ColumnDef(name="rating", type="int", nullable=False),
                ColumnDef(name="title", type="string", nullable=True),
                ColumnDef(name="body", type="text", nullable=True),
                ColumnDef(name="is_verified_purchase", type="bool", nullable=False, default="FALSE"),
                *audit,
            ],
            indexes=["idx_reviews_product", "idx_reviews_customer"],
        ),
        TableDef(
            name="carts",
            comment="Shopping carts (pre-checkout)",
            columns=[
                _uuid_col(),
                ColumnDef(name="customer_id", type="uuid", nullable=True, references="customers(id)"),
                ColumnDef(name="session_id", type="string", nullable=True),
                *audit,
            ],
        ),
        TableDef(
            name="cart_items",
            comment="Items in shopping cart",
            columns=[
                _uuid_col(),
                ColumnDef(name="cart_id", type="uuid", nullable=False, references="carts(id)"),
                ColumnDef(name="product_variant_id", type="uuid", nullable=False, references="product_variants(id)"),
                ColumnDef(name="quantity", type="int", nullable=False, default="1"),
            ],
        ),
        TableDef(
            name="addresses",
            comment="Customer shipping and billing addresses",
            columns=[
                _uuid_col(),
                ColumnDef(name="customer_id", type="uuid", nullable=False, references="customers(id)"),
                ColumnDef(name="line1", type="string", nullable=False),
                ColumnDef(name="city", type="string", nullable=False),
                ColumnDef(name="country", type="string", nullable=False),
                ColumnDef(name="postal_code", type="string", nullable=False),
                ColumnDef(name="is_default", type="bool", nullable=False, default="FALSE"),
            ],
        ),
        TableDef(
            name="payments",
            comment="Payment transactions for orders",
            columns=[
                _uuid_col(),
                ColumnDef(name="order_id", type="uuid", nullable=False, references="orders(id)"),
                ColumnDef(name="provider", type="string", nullable=False),
                ColumnDef(name="external_id", type="string", nullable=True),
                ColumnDef(name="amount", type="decimal", nullable=False),
                ColumnDef(name="status", type="string", nullable=False),
                *audit[:2],
            ],
        ),
    ]
    relationships = [
        RelationshipDef(from_table="products", from_column="vendor_id", to_table="vendors", to_column="id", relationship_type="many_to_one"),
        RelationshipDef(from_table="product_variants", from_column="product_id", to_table="products", to_column="id", relationship_type="many_to_one"),
        RelationshipDef(from_table="orders", from_column="customer_id", to_table="customers", to_column="id", relationship_type="many_to_one"),
        RelationshipDef(from_table="order_items", from_column="order_id", to_table="orders", to_column="id", relationship_type="many_to_one"),
        RelationshipDef(from_table="product_reviews", from_column="product_id", to_table="products", to_column="id", relationship_type="many_to_one"),
    ]
    return SchemaAST(
        name="Multi-Vendor E-Commerce",
        dialect=dialect,
        tables=tables,
        relationships=relationships,
        normalization="3NF",
        domain="E-commerce",
        use_case="OLTP",
    )


def _build_saas_schema(dialect: Dialect, include_audit: bool) -> SchemaAST:
    audit = _ts_cols(include_audit)
    tables = [
        TableDef(
            name="organizations",
            comment="Tenant organizations",
            columns=[_uuid_col(), ColumnDef(name="name", type="string", nullable=False), ColumnDef(name="slug", type="string", unique=True), ColumnDef(name="plan_id", type="uuid", references="subscription_plans(id)"), *audit],
            indexes=["idx_orgs_slug"],
        ),
        TableDef(
            name="users",
            comment="Application users",
            columns=[_uuid_col(), ColumnDef(name="email", type="string", unique=True), ColumnDef(name="full_name", type="string"), ColumnDef(name="avatar_url", type="string", nullable=True), *audit],
        ),
        TableDef(
            name="organization_members",
            comment="User membership in organizations",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="user_id", type="uuid", references="users(id)"), ColumnDef(name="role", type="string", nullable=False), *audit[:2]],
            indexes=["idx_org_members_org"],
        ),
        TableDef(
            name="subscription_plans",
            comment="Available subscription tiers",
            columns=[_uuid_col(), ColumnDef(name="name", type="string"), ColumnDef(name="price_monthly", type="decimal"), ColumnDef(name="max_users", type="int"), ColumnDef(name="features", type="json")],
        ),
        TableDef(
            name="subscriptions",
            comment="Active organization subscriptions",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="plan_id", type="uuid", references="subscription_plans(id)"), ColumnDef(name="status", type="string"), ColumnDef(name="current_period_end", type="timestamp"), *audit],
        ),
        TableDef(
            name="api_keys",
            comment="Organization API keys",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="key_hash", type="string"), ColumnDef(name="name", type="string"), ColumnDef(name="last_used_at", type="timestamp", nullable=True), *audit[:2]],
        ),
        TableDef(
            name="audit_logs",
            comment="Tenant-scoped audit trail",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="actor_id", type="uuid", references="users(id)"), ColumnDef(name="action", type="string"), ColumnDef(name="metadata", type="json"), ColumnDef(name="created_at", type="timestamp", default="NOW()")],
            indexes=["idx_audit_org"],
        ),
        TableDef(
            name="invitations",
            comment="Pending team invitations",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="email", type="string"), ColumnDef(name="role", type="string"), ColumnDef(name="token", type="string", unique=True), ColumnDef(name="expires_at", type="timestamp")],
        ),
        TableDef(
            name="feature_flags",
            comment="Per-organization feature toggles",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="flag_key", type="string"), ColumnDef(name="enabled", type="bool", default="FALSE")],
        ),
        TableDef(
            name="usage_records",
            comment="Metered usage for billing",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="metric", type="string"), ColumnDef(name="quantity", type="int"), ColumnDef(name="recorded_at", type="timestamp")],
        ),
        TableDef(
            name="webhooks",
            comment="Outbound webhook configurations",
            columns=[_uuid_col(), ColumnDef(name="organization_id", type="uuid", references="organizations(id)"), ColumnDef(name="url", type="string"), ColumnDef(name="events", type="json"), ColumnDef(name="secret", type="string")],
        ),
        TableDef(
            name="sessions",
            comment="User authentication sessions",
            columns=[_uuid_col(), ColumnDef(name="user_id", type="uuid", references="users(id)"), ColumnDef(name="token_hash", type="string"), ColumnDef(name="expires_at", type="timestamp"), ColumnDef(name="created_at", type="timestamp", default="NOW()")],
        ),
    ]
    return SchemaAST(name="SaaS Multi-Tenancy", dialect=dialect, tables=tables, domain="SaaS", use_case="OLTP")


def _detect_domain(prompt: str) -> str:
    p = prompt.lower()
    if any(k in p for k in ["e-commerce", "ecommerce", "vendor", "marketplace", "order", "product"]):
        return "ecommerce"
    if any(k in p for k in ["saas", "tenant", "organization", "subscription"]):
        return "saas"
    if any(k in p for k in ["blog", "cms", "content", "post", "author"]):
        return "cms"
    if any(k in p for k in ["health", "patient", "fhir", "clinical"]):
        return "healthcare"
    if any(k in p for k in ["ledger", "payment", "finance", "invoice"]):
        return "finance"
    if any(k in p for k in ["social", "follow", "like", "feed"]):
        return "social"
    if any(k in p for k in ["iot", "sensor", "device"]):
        return "iot"
    if any(k in p for k in ["warehouse", "inventory", "stock", "sku"]):
        return "inventory"
    if any(k in p for k in ["hr", "payroll", "employee"]):
        return "hr"
    if any(k in p for k in ["analytics", "star schema", "fact", "dimension", "olap"]):
        return "analytics"
    return "generic"


def _build_generic_schema(prompt: str, dialect: Dialect, include_audit: bool) -> SchemaAST:
    """Extract entities from prompt keywords and build a reasonable schema."""
    words = re.findall(r"\b[a-z]{4,}\b", prompt.lower())
    entities = []
    skip = {"building", "platform", "system", "application", "support", "with", "each", "have", "that", "this", "from", "into", "their", "multiple"}
    for w in words:
        if w.endswith("s") and len(w) > 5:
            singular = w[:-1] if not w.endswith("ies") else w[:-3] + "y"
            if singular not in skip and singular not in entities:
                entities.append(singular)
        elif w not in skip and w not in entities:
            entities.append(w)

    domain_entities = list(dict.fromkeys(entities))[:8]
    if not domain_entities:
        domain_entities = ["user", "resource", "event"]

    audit = _ts_cols(include_audit)
    tables: list[TableDef] = []
    relationships: list[RelationshipDef] = []

    for entity in domain_entities:
        table_name = entity + "s" if not entity.endswith("s") else entity
        tables.append(
            TableDef(
                name=table_name,
                comment=f"Entity: {entity}",
                columns=[
                    _uuid_col(),
                    ColumnDef(name="name", type="string", nullable=False, comment=f"{entity.title()} name"),
                    ColumnDef(name="description", type="text", nullable=True),
                    *audit,
                ],
                indexes=[f"idx_{table_name}_name"],
                confidence=0.78,
            )
        )

    if len(tables) >= 2:
        relationships.append(
            RelationshipDef(
                from_table=tables[1].name,
                from_column=f"{tables[0].name.rstrip('s')}_id",
                to_table=tables[0].name,
                to_column="id",
                relationship_type="many_to_one",
                confidence=0.72,
            )
        )
        tables[1].columns.insert(
            1,
            ColumnDef(
                name=f"{tables[0].name.rstrip('s')}_id",
                type="uuid",
                nullable=True,
                references=f"{tables[0].name}(id)",
                confidence=0.72,
            ),
        )

    return SchemaAST(
        name="Custom Domain Schema",
        dialect=dialect,
        tables=tables,
        relationships=relationships,
        normalization="3NF",
        domain="Custom",
        use_case="OLTP",
    )


def _generate_fallback(request: GenerateRequest) -> tuple[SchemaAST, list[dict]]:
    stages = []
    stages.append({"stage": "Intent Classifier", "status": "complete", "detail": "Rule-based fallback (no OpenAI key)"})
    domain = _detect_domain(request.prompt)
    use_case = "OLAP" if "analytics" in request.prompt.lower() or "warehouse" in request.prompt.lower() else "OLTP"
    if domain == "ecommerce":
        schema = _build_ecommerce_schema(request.dialect, request.include_audit)
    elif domain == "saas":
        schema = _build_saas_schema(request.dialect, request.include_audit)
    else:
        schema = _build_generic_schema(request.prompt, request.dialect, request.include_audit)
    schema.normalization = request.normalization
    schema.use_case = use_case
    stages.append({"stage": "Complete", "status": "complete", "detail": "Fallback engine"})
    return schema, stages


def generate_schema(request: GenerateRequest) -> tuple[SchemaAST, list[dict]]:
    from app.services import openai_service
    from app.services.cache_service import get_cached, set_cached

    cached = get_cached(request.prompt, request.dialect.value, request.normalization)
    if cached:
        schema = SchemaAST.model_validate(cached["schema"])
        return schema, cached.get("stages", [{"stage": "Cache", "status": "complete", "detail": "Returned cached schema"}])

    if openai_service.is_available():
        try:
            schema, stages = openai_service.generate_schema_from_prompt(
                request.prompt,
                request.dialect,
                request.normalization,
                request.naming_convention.value,
                request.include_audit,
            )
            set_cached(request.prompt, request.dialect.value, request.normalization, {
                "schema": schema.model_dump(),
                "stages": stages,
            })
            return schema, stages
        except Exception:
            pass

    schema, stages = _generate_fallback(request)
    set_cached(request.prompt, request.dialect.value, request.normalization, {
        "schema": schema.model_dump(),
        "stages": stages,
    })
    return schema, stages


def refine_schema(record: SchemaRecord, message: str) -> tuple[SchemaAST, list[dict]]:
    from app.services import openai_service

    current = record.versions[-1].schema_ast
    if openai_service.is_available():
        try:
            return openai_service.refine_schema_with_prompt(current, message)
        except Exception:
            pass
    return _refine_schema_rules(current, message), [{"stage": "Chat Refinement", "status": "complete", "detail": message[:80]}]


def _refine_schema_rules(schema: SchemaAST, message: str) -> SchemaAST:
    msg = message.lower()
    tables = [TableDef(**t.model_dump()) for t in schema.tables]

    if "soft delete" in msg or "deleted_at" in msg:
        for table in tables:
            if "order" in table.name and not any(c.name == "deleted_at" for c in table.columns):
                table.columns.append(
                    ColumnDef(name="deleted_at", type="timestamp", nullable=True, comment="Soft delete")
                )
                table.indexes.append(f"idx_{table.name}_not_deleted")

    if "denormalize" in msg or "snapshot" in msg or "historical" in msg:
        for table in tables:
            if table.name == "order_items" and not any(c.name == "product_name_snapshot" for c in table.columns):
                table.columns.append(
                    ColumnDef(
                        name="product_name_snapshot",
                        type="string",
                        nullable=True,
                        comment="Denormalized product name for historical accuracy",
                    )
                )

    if "full-text" in msg or "full text" in msg or "search" in msg:
        for table in tables:
            if "product" in table.name and table.name == "products":
                table.columns.append(
                    ColumnDef(name="search_vector", type="text", nullable=True, comment="Full-text search vector")
                )
                table.indexes.append("idx_products_search_gin")

    if "audit" in msg:
        for table in tables:
            if not any(c.name == "created_by" for c in table.columns):
                table.columns.extend([
                    ColumnDef(name="created_by", type="uuid", nullable=True),
                    ColumnDef(name="updated_by", type="uuid", nullable=True),
                ])

    return SchemaAST(**{**schema.model_dump(), "tables": tables})


from app.services.persistence import store  # noqa: E402
