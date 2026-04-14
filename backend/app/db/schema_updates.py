from sqlalchemy import text
from sqlalchemy.engine import Engine


def apply_non_destructive_updates(engine: Engine) -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'NOT_SUBMITTED' NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_score DOUBLE PRECISION",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reason VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_ocr_json VARCHAR(4000)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
