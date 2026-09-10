-- Rehearsal RDS only. Review and back up before running as the schema owner.
-- No reconnect, legacy data cleanup, or changes to the shared school database.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
    IF current_database() <> 'leaflog_rehearsal' THEN
        RAISE EXCEPTION 'This migration requires leaflog_rehearsal';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.plant_species_image (
    image_id BIGSERIAL PRIMARY KEY,
    species_id BIGINT NOT NULL REFERENCES public.plant_species(species_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    artist TEXT,
    license VARCHAR(100),
    source_page TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_plant_species_image_order UNIQUE (species_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_plant_species_image_species_id
    ON public.plant_species_image (species_id);

-- The restored DB uses plant_location_name_check; the current model uses ck_*.
ALTER TABLE public.plant DROP CONSTRAINT IF EXISTS plant_location_name_check;
ALTER TABLE public.plant DROP CONSTRAINT IF EXISTS ck_plant_location_name;
ALTER TABLE public.plant ADD CONSTRAINT ck_plant_location_name
    CHECK (location_name IN ('LIVING_ROOM', 'BEDROOM', 'BALCONY', 'KITCHEN', 'OFFICE', 'BATHROOM'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_species_image TO leaflog_app;
DO $$
DECLARE sequence_name TEXT;
BEGIN
    sequence_name := pg_get_serial_sequence('public.plant_species_image', 'image_id');
    IF sequence_name IS NULL THEN
        RAISE EXCEPTION 'plant_species_image.image_id has no sequence';
    END IF;
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO leaflog_app', sequence_name::regclass);
END;
$$;
COMMIT;
