from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class Dialect(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    MSSQL = "mssql"
    ORACLE = "oracle"
    MONGODB = "mongodb"
    SNOWFLAKE = "snowflake"
    BIGQUERY = "bigquery"
    CASSANDRA = "cassandra"
    DYNAMODB = "dynamodb"


class ExportFormat(str, Enum):
    DDL = "ddl"
    PRISMA = "prisma"
    JSON_SCHEMA = "json_schema"
    SQLALCHEMY = "sqlalchemy"
    DJANGO = "django"
    TYPEORM = "typeorm"
    DBML = "dbml"
    MERMAID = "mermaid"
    LIQUIBASE = "liquibase"
    FLYWAY = "flyway"


class NamingConvention(str, Enum):
    SNAKE_CASE = "snake_case"
    CAMEL_CASE = "camelCase"
    PASCAL_CASE = "PascalCase"


class FeedbackType(str, Enum):
    SUPPORT = "support"
    BUG = "bug"
    BILLING = "billing"
    SECURITY = "security"
    GENERAL = "general"


class ColumnDef(BaseModel):
    name: str
    type: str
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    default: str | None = None
    references: str | None = None
    comment: str | None = None
    confidence: float = 0.95


class RelationshipDef(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    relationship_type: str  # one_to_one, one_to_many, many_to_many
    confidence: float = 0.9


class TableDef(BaseModel):
    name: str
    columns: list[ColumnDef]
    indexes: list[str] = Field(default_factory=list)
    comment: str | None = None
    confidence: float = 0.92


class SchemaAST(BaseModel):
    name: str
    dialect: Dialect
    tables: list[TableDef]
    relationships: list[RelationshipDef] = Field(default_factory=list)
    normalization: str = "3NF"
    domain: str | None = None
    use_case: str = "OLTP"


class GenerateRequest(BaseModel):
    prompt: str
    dialect: Dialect = Dialect.POSTGRESQL
    normalization: str = "3NF"
    include_audit: bool = True
    naming_convention: NamingConvention = NamingConvention.SNAKE_CASE
    project_name: str | None = None


class RefineRequest(BaseModel):
    schema_id: str
    message: str


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.DDL


class SchemaVersion(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    version: int
    schema_ast: SchemaAST = Field(..., alias="schema")
    ddl: str
    prompt: str | None = None
    created_at: datetime
    label: str | None = None


class SchemaRecord(BaseModel):
    id: str
    current_version: int
    versions: list[SchemaVersion]
    dialect: Dialect
    created_at: datetime
    updated_at: datetime


class GenerateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_id: str
    version: int
    schema_ast: SchemaAST = Field(..., alias="schema")
    ddl: str
    generation_time_ms: int
    confidence_score: float
    pipeline_stages: list[dict[str, Any]]


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime | None = None


class TemplateInfo(BaseModel):
    id: str
    name: str
    category: str
    description: str
    table_count: int
    prompt: str
    tags: list[str]


class RollbackRequest(BaseModel):
    version: int


class MigrateRequest(BaseModel):
    from_version: int = 1
    to_version: int | None = None


class CommentRequest(BaseModel):
    author: str = "User"
    content: str
    table_name: str | None = None
    column_name: str | None = None


class ProjectRequest(BaseModel):
    name: str
    prompt: str
    schema_id: str | None = None


class WizardRequest(BaseModel):
    domain: str
    entities: list[str]
    relationships: str = ""
    dialect: Dialect = Dialect.POSTGRESQL
    normalization: str = "3NF"


class FeedbackRequest(BaseModel):
    type: FeedbackType = FeedbackType.SUPPORT
    name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=254)
    subject: str = Field(default="", max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    page_url: str | None = Field(default=None, max_length=500)
    user_agent: str | None = Field(default=None, max_length=500)
