from sqlalchemy import text
from sqlalchemy.engine import Engine


def apply_non_destructive_updates(engine: Engine) -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'NOT_SUBMITTED' NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_score DOUBLE PRECISION",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reason VARCHAR(255)",
        # rename legacy column to reflect its content (verification metadata, not OCR)
        (
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='id_document_ocr_json') THEN "
            "ALTER TABLE users RENAME COLUMN id_document_ocr_json TO verification_metadata_json; "
            "END IF; END $$"
        ),
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_metadata_json VARCHAR(4000)",
        # drop redundant denormalized full name (derivable from first_name + last_name)
        "ALTER TABLE users DROP COLUMN IF EXISTS name",
        # role check: add ORGANIZER
        "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check",
        (
            "ALTER TABLE users ADD CONSTRAINT users_role_check "
            "CHECK (role IN ('USER', 'ORGANIZER', 'ADMIN'))"
        ),
        (
            "ALTER TABLE tourist_attractions "
            "ADD COLUMN IF NOT EXISTS importance_score DOUBLE PRECISION DEFAULT 0 NOT NULL"
        ),
        "DROP TABLE IF EXISTS user_preferences",
        # support thread owner
        "ALTER TABLE activity_chat_messages ADD COLUMN IF NOT EXISTS thread_user_id INTEGER",
        (
            "ALTER TABLE activity_chat_messages "
            "ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE NOT NULL"
        ),
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
