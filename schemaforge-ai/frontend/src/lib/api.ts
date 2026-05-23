const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export type Dialect =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mssql"
  | "oracle"
  | "mongodb"
  | "snowflake"
  | "bigquery"
  | "cassandra"
  | "dynamodb";

export type NamingConvention = "snake_case" | "camelCase" | "PascalCase";

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  unique: boolean;
  default?: string | null;
  references?: string | null;
  comment?: string | null;
  confidence: number;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  indexes: string[];
  comment?: string | null;
  confidence: number;
}

export interface RelationshipDef {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  relationship_type: string;
  confidence: number;
}

export interface SchemaAST {
  name: string;
  dialect: Dialect;
  tables: TableDef[];
  relationships: RelationshipDef[];
  normalization: string;
  domain?: string | null;
  use_case: string;
}

export interface GenerateResponse {
  schema_id: string;
  version: number;
  schema: SchemaAST;
  ddl: string;
  generation_time_ms: number;
  confidence_score: number;
  pipeline_stages: { stage: string; status: string; detail: string }[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  table_count: number;
  prompt: string;
  tags: string[];
}

export interface SchemaListItem {
  id: string;
  dialect: string;
  current_version: number;
  updated_at: string;
  prompt?: string;
  label?: string;
}

export interface UsageStats {
  schemas_this_month: number;
  limit: number;
  plan: string;
  api_calls_remaining: number;
}

export interface SchemaReview {
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  recommendations: { priority: string; title: string; detail: string }[];
}

export interface SchemaDiff {
  from_version: number;
  to_version: number;
  added_tables: string[];
  removed_tables: string[];
  changed_tables: { table: string; added_columns: string[]; removed_columns: string[] }[];
  migration_sql: string;
}

export interface Comment {
  id: string;
  schema_id: string;
  table_name?: string | null;
  column_name?: string | null;
  author: string;
  content: string;
  created_at: string;
}

export type FeedbackType = "support" | "bug" | "billing" | "security" | "general";

export interface FeedbackPayload {
  type: FeedbackType;
  name?: string;
  email?: string;
  subject?: string;
  message: string;
  page_url?: string;
  user_agent?: string;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json();
}

export async function getHealth() {
  return fetchApi<{ openai_configured: boolean; model?: string }>("/health");
}

export async function getUsage(): Promise<UsageStats> {
  return fetchApi("/v1/usage");
}

export async function generateSchema(
  prompt: string,
  dialect: Dialect = "postgresql",
  normalization = "3NF",
  namingConvention: NamingConvention = "snake_case",
  projectName?: string
): Promise<GenerateResponse> {
  return fetchApi("/v1/schema/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      dialect,
      normalization,
      include_audit: true,
      naming_convention: namingConvention,
      project_name: projectName,
    }),
  });
}

export async function generateFromWizard(
  domain: string,
  entities: string[],
  relationships: string,
  dialect: Dialect
): Promise<GenerateResponse> {
  return fetchApi("/v1/schema/wizard", {
    method: "POST",
    body: JSON.stringify({ domain, entities, relationships, dialect, normalization: "3NF" }),
  });
}

export async function inferFromCsv(file: File, dialect: Dialect = "postgresql"): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/v1/schema/infer-csv?dialect=${dialect}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refineSchema(schemaId: string, message: string): Promise<GenerateResponse> {
  return fetchApi("/v1/schema/refine", {
    method: "POST",
    body: JSON.stringify({ schema_id: schemaId, message }),
  });
}

export async function reviewSchema(schemaId: string): Promise<SchemaReview> {
  return fetchApi(`/v1/schema/${schemaId}/review`, { method: "POST" });
}

export async function rollbackSchema(schemaId: string, version: number): Promise<GenerateResponse> {
  return fetchApi(`/v1/schema/${schemaId}/rollback`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export async function getTemplates(category?: string, search?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const q = params.toString() ? `?${params}` : "";
  return fetchApi<{ templates: TemplateInfo[] }>(`/templates${q}`);
}

export async function listSchemas(): Promise<{ schemas: SchemaListItem[] }> {
  return fetchApi("/v1/schemas");
}

export async function listProjects() {
  return fetchApi<{ projects: { id: string; name: string; prompt: string; schema_id?: string }[] }>("/v1/projects");
}

export async function getSchemaDiff(schemaId: string, fromVersion: number, toVersion: number): Promise<SchemaDiff> {
  return fetchApi(`/v1/schema/${schemaId}/diff?from_version=${fromVersion}&to_version=${toVersion}`);
}

export async function compareDialects(schemaId: string, dialects: string[]) {
  return fetchApi<{ dialects: Record<string, string> }>(
    `/v1/schema/${schemaId}/compare?dialects=${dialects.join(",")}`
  );
}

export async function createShareLink(schemaId: string) {
  return fetchApi<{ share_token: string; url: string }>(`/v1/schema/${schemaId}/share`, { method: "POST" });
}

export async function exportSchema(schemaId: string, format: string, dialect?: Dialect): Promise<string> {
  const params = new URLSearchParams({ format });
  if (dialect) params.set("dialect", dialect);
  const res = await fetch(`${API_BASE}/v1/schema/${schemaId}/export?${params}`);
  if (!res.ok) throw new Error("Export failed");
  return res.text();
}

export async function getSchemaVersions(schemaId: string) {
  return fetchApi<{ versions: { version: number; label?: string; created_at: string }[] }>(
    `/v1/schema/${schemaId}/versions`
  );
}

export async function getComments(schemaId: string): Promise<{ comments: Comment[] }> {
  return fetchApi(`/v1/schema/${schemaId}/comments`, { method: "GET" });
}

export async function addComment(
  schemaId: string,
  author: string,
  content: string,
  tableName?: string,
  columnName?: string
): Promise<Comment> {
  return fetchApi(`/v1/schema/${schemaId}/comments`, {
    method: "POST",
    body: JSON.stringify({ author, content, table_name: tableName, column_name: columnName }),
  });
}

export async function submitFeedback(payload: FeedbackPayload): Promise<{ id: string; status: string }> {
  return fetchApi("/v1/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getFeedback(): Promise<{ feedback: (FeedbackPayload & { id: string; created_at: string; status?: string })[] }> {
  return fetchApi("/v1/feedback", {
    method: "GET",
  });
}

export async function updateSchema(schemaId: string, schema: SchemaAST, label = "Manual visual update"): Promise<GenerateResponse> {
  return fetchApi("/v1/schema/update", {
    method: "POST",
    body: JSON.stringify({ schema_id: schemaId, schema_ast: schema, label }),
  });
}

export async function getSchema(schemaId: string): Promise<GenerateResponse> {
  const data = await fetchApi<{
    id: string;
    version: number;
    schema: SchemaAST;
    ddl: string;
    versions: { version: number; label?: string; created_at: string; prompt?: string }[];
  }>(`/v1/schema/${schemaId}`);
  
  const tables = data.schema?.tables || [];
  const totalConf = tables.reduce((acc, t) => acc + (t.confidence || 0.9), 0);
  const avgConf = tables.length > 0 ? totalConf / tables.length : 0.9;
  
  return {
    schema_id: data.id,
    version: data.version,
    schema: data.schema,
    ddl: data.ddl,
    generation_time_ms: 100,
    confidence_score: Number(avgConf.toFixed(3)),
    pipeline_stages: [{ stage: "State Load", status: "complete", detail: "Restored from database" }],
  };
}
