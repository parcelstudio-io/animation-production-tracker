-- Migration: Update unique constraint to prevent scene/shot duplicates across all animators/weeks
-- Date: 2025-01-03
-- Description: Change unique constraint from (animator, project_type, episode_title, scene, shot, week_yyyymmdd) 
--              to (project_type, episode_title, scene, shot) to prevent any duplicate scene/shot combinations

BEGIN;

-- Step 1: Drop the old unique constraint
-- Note: PostgreSQL creates constraint names automatically, so we need to find the constraint name first
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name for the old unique constraint
    SELECT conname INTO constraint_name 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'production_summary' 
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 6; -- The old constraint had 6 columns
    
    -- Drop the old constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE production_summary DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped old unique constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'Old unique constraint not found or already dropped';
    END IF;
END $$;

-- Step 2: Check for existing duplicates that would violate the new constraint
WITH duplicates AS (
    SELECT 
        project_type, 
        episode_title, 
        scene, 
        shot,
        COUNT(*) as duplicate_count,
        STRING_AGG(DISTINCT animator, ', ') as animators,
        STRING_AGG(DISTINCT week_yyyymmdd, ', ') as weeks
    FROM production_summary
    GROUP BY project_type, episode_title, scene, shot
    HAVING COUNT(*) > 1
)
SELECT 
    'DUPLICATE DETECTED' as warning,
    project_type, 
    episode_title, 
    scene, 
    shot, 
    duplicate_count,
    animators,
    weeks
FROM duplicates;

-- Step 3: Create the new unique constraint
-- This will fail if there are existing duplicates - they must be resolved first
ALTER TABLE production_summary 
ADD CONSTRAINT unique_scene_shot_combination 
UNIQUE (project_type, episode_title, scene, shot);

-- Step 4: Create an index to support the new constraint for performance
CREATE INDEX IF NOT EXISTS idx_production_summary_scene_shot ON production_summary(project_type, episode_title, scene, shot);

COMMIT;

-- Verification query to check the new constraint is in place
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'production_summary' 
AND c.contype = 'u';