import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.models.schema import Dialect, SchemaAST, SchemaRecord, SchemaVersion

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "schemaforge.db"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS schemas (
            id TEXT PRIMARY KEY,
            dialect TEXT NOT NULL,
            current_version INTEGER NOT NULL,
            naming_convention TEXT DEFAULT 'snake_case',
            share_token TEXT,
            branch TEXT DEFAULT 'main',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schema_versions (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            schema_json TEXT NOT NULL,
            ddl TEXT NOT NULL,
            prompt TEXT,
            label TEXT,
            branch TEXT DEFAULT 'main',
            created_at TEXT NOT NULL,
            FOREIGN KEY (schema_id) REFERENCES schemas(id)
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            prompt TEXT,
            schema_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            table_name TEXT,
            column_name TEXT,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT NOT NULL,
            page_url TEXT,
            user_agent TEXT,
            status TEXT DEFAULT 'open',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_versions_schema ON schema_versions(schema_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
    """)
    conn.commit()
    conn.close()


class SchemaStore:
    def save(
        self,
        schema: SchemaAST,
        ddl: str,
        prompt: str | None = None,
        label: str | None = None,
        naming_convention: str = "snake_case",
    ) -> SchemaRecord:
        sid = str(uuid.uuid4())
        now = _now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO schemas (id, dialect, current_version, naming_convention, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (sid, schema.dialect.value, 1, naming_convention, now, now),
        )
        vid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO schema_versions (id, schema_id, version, schema_json, ddl, prompt, label, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (vid, sid, 1, schema.model_dump_json(), ddl, prompt, label or "Initial generation", now),
        )
        conn.execute("INSERT INTO usage_log (action, created_at) VALUES (?,?)", ("generate", now))
        conn.commit()
        conn.close()
        return self.get(sid)  # type: ignore

    def add_version(
        self,
        record_id: str,
        schema: SchemaAST,
        ddl: str,
        prompt: str | None,
        label: str,
        branch: str = "main",
    ) -> SchemaRecord | None:
        record = self.get(record_id)
        if not record:
            return None
        new_v = record.current_version + 1
        now = _now().isoformat()
        vid = str(uuid.uuid4())
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO schema_versions (id, schema_id, version, schema_json, ddl, prompt, label, branch, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (vid, record_id, new_v, schema.model_dump_json(), ddl, prompt, label, branch, now),
        )
        conn.execute(
            "UPDATE schemas SET current_version=?, updated_at=? WHERE id=?",
            (new_v, now, record_id),
        )
        conn.execute("INSERT INTO usage_log (action, created_at) VALUES (?,?)", ("refine", now))
        conn.commit()
        conn.close()
        return self.get(record_id)

    def rollback(self, record_id: str, target_version: int) -> SchemaRecord | None:
        record = self.get(record_id)
        if not record:
            return None
        target = next((v for v in record.versions if v.version == target_version), None)
        if not target:
            return None
        return self.add_version(
            record_id,
            target.schema_ast,
            target.ddl,
            None,
            f"Rollback to v{target_version}",
        )

    def get(self, record_id: str) -> SchemaRecord | None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM schemas WHERE id=?", (record_id,)).fetchone()
        if not row:
            conn.close()
            return None
        vrows = conn.execute(
            "SELECT * FROM schema_versions WHERE schema_id=? ORDER BY version",
            (record_id,),
        ).fetchall()
        conn.close()
        versions = []
        for vr in vrows:
            schema_data = json.loads(vr["schema_json"])
            versions.append(
                SchemaVersion(
                    id=vr["id"],
                    version=vr["version"],
                    schema_ast=SchemaAST.model_validate(schema_data),
                    ddl=vr["ddl"],
                    prompt=vr["prompt"],
                    created_at=datetime.fromisoformat(vr["created_at"]),
                    label=vr["label"],
                )
            )
        return SchemaRecord(
            id=row["id"],
            current_version=row["current_version"],
            versions=versions,
            dialect=Dialect(row["dialect"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def list_all(self, limit: int = 50) -> list[dict]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT s.id, s.dialect, s.current_version, s.updated_at, v.prompt, v.label "
            "FROM schemas s LEFT JOIN schema_versions v ON s.id=v.schema_id AND v.version=s.current_version "
            "ORDER BY s.updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def create_share_token(self, record_id: str) -> str | None:
        token = str(uuid.uuid4())[:12]
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("UPDATE schemas SET share_token=? WHERE id=?", (token, record_id))
        conn.commit()
        conn.close()
        return token if cur.rowcount else None

    def get_by_share_token(self, token: str) -> SchemaRecord | None:
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute("SELECT id FROM schemas WHERE share_token=?", (token,)).fetchone()
        conn.close()
        return self.get(row[0]) if row else None

    def add_comment(
        self, schema_id: str, author: str, content: str, table_name: str | None = None, column_name: str | None = None
    ) -> dict:
        cid = str(uuid.uuid4())
        now = _now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO comments (id, schema_id, table_name, column_name, author, content, created_at) VALUES (?,?,?,?,?,?,?)",
            (cid, schema_id, table_name, column_name, author, content, now),
        )
        conn.commit()
        conn.close()
        return {"id": cid, "schema_id": schema_id, "author": author, "content": content, "created_at": now}

    def list_comments(self, schema_id: str) -> list[dict]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM comments WHERE schema_id=? ORDER BY created_at DESC", (schema_id,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def save_project(self, name: str, prompt: str, schema_id: str | None = None) -> dict:
        pid = str(uuid.uuid4())
        now = _now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO projects (id, name, prompt, schema_id, created_at) VALUES (?,?,?,?,?)",
            (pid, name, prompt, schema_id, now),
        )
        conn.commit()
        conn.close()
        return {"id": pid, "name": name, "prompt": prompt, "schema_id": schema_id, "created_at": now}

    def list_projects(self) -> list[dict]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC LIMIT 100").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def add_feedback(
        self,
        feedback_type: str,
        name: str,
        email: str,
        subject: str,
        message: str,
        page_url: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        fid = str(uuid.uuid4())
        now = _now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO feedback (id, type, name, email, subject, message, page_url, user_agent, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (fid, feedback_type, name, email, subject, message, page_url, user_agent, now),
        )
        conn.commit()
        conn.close()
        return {"id": fid, "status": "open", "created_at": now}

    def usage_stats(self) -> dict:
        conn = sqlite3.connect(DB_PATH)
        month_start = _now().replace(day=1).isoformat()
        count = conn.execute(
            "SELECT COUNT(*) FROM usage_log WHERE action='generate' AND created_at >= ?", (month_start,)
        ).fetchone()[0]
        conn.close()
        from app.config import settings
        return {
            "schemas_this_month": count,
            "limit": settings.free_schemas_per_month,
            "plan": "free",
            "api_calls_remaining": max(0, 5000 - count * 10),
        }


store = SchemaStore()
