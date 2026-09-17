-- Production RDS (leaflog) only. Raises the default reporting interval to 1 hour.
--
-- Soil in a pot dries roughly 7-15% per day, which is 3-6 mV per hour - about the
-- same size as the ADC noise. Sampling every 10 minutes therefore stores noise, not
-- signal, so the default moves from 600 to 3600 seconds.
--
-- Devices read this value from the reading-upload response, so no reflashing is needed.
-- Rows that already carry the old default are moved too; a value a person set on
-- purpose (anything other than 600) is left alone.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
    IF current_database() <> 'leaflog' THEN
        RAISE EXCEPTION 'This migration requires leaflog';
    END IF;
END;
$$;

ALTER TABLE public.soil_sensor ALTER COLUMN report_interval_sec SET DEFAULT 3600;

UPDATE public.soil_sensor
   SET report_interval_sec = 3600,
       updated_at = now()
 WHERE report_interval_sec = 600;

COMMIT;
