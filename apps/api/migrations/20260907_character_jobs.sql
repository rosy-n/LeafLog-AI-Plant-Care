-- Apply to the restored AWS DB, not the current shared school DB.
BEGIN;
CREATE TABLE IF NOT EXISTS character_job (
    job_id VARCHAR(32) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    idempotency_key VARCHAR(100),
    input_sha256 VARCHAR(64) NOT NULL,
    bucket_name VARCHAR(255) NOT NULL,
    input_key TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT 'Queued',
    current_candidate INTEGER NOT NULL DEFAULT 0,
    candidates JSON NOT NULL DEFAULT '[]',
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    lease_hash VARCHAR(64),
    lease_until TIMESTAMPTZ,
    last_dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    plant_id INTEGER REFERENCES plant(plant_id) ON DELETE SET NULL,
    selected_candidate_id VARCHAR(40),
    CONSTRAINT uq_character_job_request UNIQUE (user_id, idempotency_key),
    CONSTRAINT ck_character_job_progress CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT ck_character_job_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_character_job_status CHECK (status IN (
        'queued','preprocessing','starting_gpu','generating','postprocessing','completed','failed'
    ))
);
CREATE INDEX IF NOT EXISTS ix_character_job_user_id ON character_job(user_id);
CREATE INDEX IF NOT EXISTS ix_character_job_status ON character_job(status);
COMMIT;
