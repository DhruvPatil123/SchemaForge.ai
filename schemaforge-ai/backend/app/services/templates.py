from app.models.schema import TemplateInfo

TEMPLATES: list[TemplateInfo] = [
    TemplateInfo(
        id="ecommerce-multivendor",
        name="Multi-Vendor E-Commerce",
        category="E-commerce",
        description="Vendors, products with variants, orders, discounts, and reviews.",
        table_count=14,
        prompt=(
            "I'm building a multi-vendor e-commerce platform. Each vendor has multiple "
            "products with variants (size, color). Customers place orders, each order has "
            "line items. Support discount codes and product reviews."
        ),
        tags=["ecommerce", "marketplace", "orders"],
    ),
    TemplateInfo(
        id="saas-multitenancy",
        name="SaaS Multi-Tenancy",
        category="SaaS",
        description="Organizations, users, subscriptions, and row-level tenant isolation.",
        table_count=12,
        prompt=(
            "SaaS application with organizations as tenants. Users belong to organizations "
            "with roles. Subscription plans with feature limits. Audit logs per tenant."
        ),
        tags=["saas", "multi-tenant", "billing"],
    ),
    TemplateInfo(
        id="cms-blog",
        name="CMS / Blogging Platform",
        category="CMS",
        description="Authors, posts, categories, tags, comments, and media assets.",
        table_count=10,
        prompt=(
            "Content management system with authors, blog posts, categories, tags, "
            "comments with moderation, and media library for images."
        ),
        tags=["cms", "blog", "content"],
    ),
    TemplateInfo(
        id="healthcare-fhir",
        name="Healthcare (FHIR-aligned)",
        category="Healthcare",
        description="Patients, practitioners, encounters, observations, and medications.",
        table_count=16,
        prompt=(
            "Healthcare patient management aligned with FHIR. Patients, practitioners, "
            "encounters, observations, conditions, medications, and appointments."
        ),
        tags=["healthcare", "fhir", "clinical"],
    ),
    TemplateInfo(
        id="finance-ledger",
        name="Financial Ledger & Payments",
        category="Financial",
        description="Double-entry accounting, accounts, transactions, and payment processing.",
        table_count=13,
        prompt=(
            "Financial services with double-entry ledger. Chart of accounts, journal entries, "
            "transactions, payment methods, invoices, and reconciliation."
        ),
        tags=["finance", "payments", "ledger"],
    ),
    TemplateInfo(
        id="social-community",
        name="Social Media Platform",
        category="Social",
        description="Users, posts, follows, likes, messages, and notifications.",
        table_count=11,
        prompt=(
            "Social media community platform. User profiles, posts with media, follows, "
            "likes, direct messages, groups, and push notifications."
        ),
        tags=["social", "community", "messaging"],
    ),
    TemplateInfo(
        id="iot-sensors",
        name="IoT Sensor Pipeline",
        category="IoT",
        description="Devices, sensor readings, alerts, and time-series aggregates.",
        table_count=9,
        prompt=(
            "IoT platform with devices, sensor types, time-series readings, alert rules, "
            "device groups, and firmware versions."
        ),
        tags=["iot", "sensors", "telemetry"],
    ),
    TemplateInfo(
        id="inventory-warehouse",
        name="Inventory & Warehouse",
        category="Logistics",
        description="SKUs, warehouses, stock levels, transfers, and purchase orders.",
        table_count=12,
        prompt=(
            "Inventory and warehouse management. Products/SKUs, warehouses, stock levels, "
            "purchase orders, suppliers, and stock transfers between locations."
        ),
        tags=["inventory", "warehouse", "supply-chain"],
    ),
    TemplateInfo(
        id="hr-payroll",
        name="HR & Payroll",
        category="HR",
        description="Employees, departments, payroll runs, benefits, and time tracking.",
        table_count=14,
        prompt=(
            "HR and payroll system. Employees, departments, job positions, payroll runs, "
            "salary components, benefits enrollment, and time-off requests."
        ),
        tags=["hr", "payroll", "employees"],
    ),
    TemplateInfo(
        id="analytics-star",
        name="Analytics Star Schema",
        category="Analytics",
        description="Fact tables, dimensions, and slowly changing dimensions for warehousing.",
        table_count=10,
        prompt=(
            "Data warehouse star schema for e-commerce analytics. Fact orders and fact "
            "pageviews with dimension tables for customers, products, dates, and campaigns."
        ),
        tags=["analytics", "warehouse", "olap"],
    ),
]


def get_templates(category: str | None = None, search: str | None = None) -> list[TemplateInfo]:
    result = TEMPLATES
    if category:
        result = [t for t in result if t.category.lower() == category.lower()]
    if search:
        q = search.lower()
        result = [
            t
            for t in result
            if q in t.name.lower()
            or q in t.description.lower()
            or any(q in tag for tag in t.tags)
        ]
    return result
