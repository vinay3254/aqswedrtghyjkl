-- ==============================================================================
-- 1. EXTENSIONS & ENUMS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('DISPATCHER', 'DRIVER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ambulance_type AS ENUM ('ALS', 'BLS', 'PTS', 'NEONATAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ambulance_status AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'EN_ROUTE_TO_SCENE',
    'ON_SCENE',
    'TRANSPORTING_TO_HOSPITAL',
    'ARRIVED_AT_HOSPITAL',
    'RETURNING_TO_BASE',
    'MAINTENANCE',
    'OFFLINE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_lifecycle_status AS ENUM (
    'PENDING',
    'ASSIGNED',
    'EN_ROUTE_TO_SCENE',
    'ON_SCENE',
    'TRANSPORTING_TO_HOSPITAL',
    'ARRIVED_AT_HOSPITAL',
    'RESOLVED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. TABLES & CONSTRAINTS
-- ==============================================================================

-- Profiles (Tied 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'DRIVER',
  phone TEXT,
  license_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hospitals (Receiving Facilities)
CREATE TABLE IF NOT EXISTS public.hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  available_beds INT NOT NULL DEFAULT 10 CHECK (available_beds >= 0),
  icu_beds_available INT NOT NULL DEFAULT 2 CHECK (icu_beds_available >= 0),
  total_beds INT NOT NULL DEFAULT 100 CHECK (total_beds > 0),
  icu_beds_total INT NOT NULL DEFAULT 20 CHECK (icu_beds_total >= 0),
  contact_number TEXT,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ambulances (Fleet Vehicles & Telemetry Snapshot)
CREATE TABLE IF NOT EXISTS public.ambulances (
  id TEXT PRIMARY KEY,
  call_sign TEXT NOT NULL UNIQUE,
  vehicle_number TEXT NOT NULL UNIQUE,
  type ambulance_type NOT NULL DEFAULT 'ALS',
  status ambulance_status NOT NULL DEFAULT 'AVAILABLE',
  assigned_driver_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_incident_id TEXT,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 12.9716,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 77.5946,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed INT NOT NULL DEFAULT 0,
  battery_level INT NOT NULL DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  destination TEXT,
  last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incidents (Full 7-Stage Lifecycle with Safety Constraints)
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY,
  incident_type TEXT NOT NULL,
  severity incident_severity NOT NULL DEFAULT 'HIGH',
  status incident_lifecycle_status NOT NULL DEFAULT 'PENDING',
  location_address TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  caller_name TEXT,
  caller_phone TEXT,
  patients_count INT NOT NULL DEFAULT 1 CHECK (patients_count >= 1 AND patients_count <= 50),
  description TEXT,
  is_sos BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_ambulance_id TEXT REFERENCES public.ambulances(id) ON DELETE SET NULL,
  assigned_hospital_id TEXT REFERENCES public.hospitals(id) ON DELETE SET NULL,
  
  -- Milestone Timestamps
  dispatched_at TIMESTAMPTZ,
  arrived_scene_at TIMESTAMPTZ,
  transport_started_at TIMESTAMPTZ,
  arrived_hospital_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Trail / Timeline Events
CREATE TABLE IF NOT EXISTS public.incident_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  ambulance_id TEXT REFERENCES public.ambulances(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stage incident_lifecycle_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ambulances_driver ON public.ambulances(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_ambulances_status ON public.ambulances(status);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_ambulance ON public.incidents(assigned_ambulance_id);

-- ==============================================================================
-- 3. SECURITY HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_driver_ambulance_id()
RETURNS TEXT AS $$
  SELECT id FROM public.ambulances WHERE assigned_driver_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 4. TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_incident_ambulance_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- ── INSERT BRANCH ──
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_ambulance_id IS NOT NULL THEN
      UPDATE public.ambulances
      SET assigned_incident_id = NEW.id,
          status = CASE 
            WHEN NEW.status = 'PENDING'                  THEN 'ASSIGNED'::ambulance_status 
            WHEN NEW.status = 'ASSIGNED'                 THEN 'ASSIGNED'::ambulance_status
            WHEN NEW.status = 'EN_ROUTE_TO_SCENE'        THEN 'EN_ROUTE_TO_SCENE'::ambulance_status
            WHEN NEW.status = 'ON_SCENE'                 THEN 'ON_SCENE'::ambulance_status
            WHEN NEW.status = 'TRANSPORTING_TO_HOSPITAL' THEN 'TRANSPORTING_TO_HOSPITAL'::ambulance_status
            WHEN NEW.status = 'ARRIVED_AT_HOSPITAL'      THEN 'ARRIVED_AT_HOSPITAL'::ambulance_status
            ELSE 'ASSIGNED'::ambulance_status 
          END,
          destination = CASE
            WHEN NEW.assigned_hospital_id IS NOT NULL THEN
              COALESCE((SELECT name FROM public.hospitals WHERE id = NEW.assigned_hospital_id), NEW.location_address)
            ELSE NEW.location_address
          END,
          updated_at = NOW()
      WHERE id = NEW.assigned_ambulance_id;
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE BRANCH ──
  IF TG_OP = 'UPDATE' THEN
    -- Condition A: Lifecycle Stage Status Changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status IN ('RESOLVED', 'CANCELLED') THEN
        IF NEW.assigned_ambulance_id IS NOT NULL THEN
          UPDATE public.ambulances
          SET assigned_incident_id = NULL,
              status = 'AVAILABLE',
              destination = NULL,
              updated_at = NOW()
          WHERE id = NEW.assigned_ambulance_id;
        END IF;
      ELSIF NEW.assigned_ambulance_id IS NOT NULL THEN
        UPDATE public.ambulances
        SET status = CASE 
              WHEN NEW.status = 'PENDING'                  THEN 'ASSIGNED'::ambulance_status 
              WHEN NEW.status = 'ASSIGNED'                 THEN 'ASSIGNED'::ambulance_status
              WHEN NEW.status = 'EN_ROUTE_TO_SCENE'        THEN 'EN_ROUTE_TO_SCENE'::ambulance_status
              WHEN NEW.status = 'ON_SCENE'                 THEN 'ON_SCENE'::ambulance_status
              WHEN NEW.status = 'TRANSPORTING_TO_HOSPITAL' THEN 'TRANSPORTING_TO_HOSPITAL'::ambulance_status
              WHEN NEW.status = 'ARRIVED_AT_HOSPITAL'      THEN 'ARRIVED_AT_HOSPITAL'::ambulance_status
              ELSE status
            END,
            destination = CASE
              WHEN NEW.status = 'TRANSPORTING_TO_HOSPITAL' AND NEW.assigned_hospital_id IS NOT NULL THEN
                COALESCE((SELECT name FROM public.hospitals WHERE id = NEW.assigned_hospital_id), NEW.location_address)
              ELSE NEW.location_address
            END,
            updated_at = NOW()
        WHERE id = NEW.assigned_ambulance_id;
      END IF;
    END IF;

    -- Condition B: Ambulance Assignment Swapped / Reassigned
    IF NEW.assigned_ambulance_id IS DISTINCT FROM OLD.assigned_ambulance_id THEN
      -- Unlink previous unit
      IF OLD.assigned_ambulance_id IS NOT NULL THEN
        UPDATE public.ambulances
        SET assigned_incident_id = NULL,
            status = 'AVAILABLE',
            destination = NULL,
            updated_at = NOW()
        WHERE id = OLD.assigned_ambulance_id AND assigned_incident_id = OLD.id;
      END IF;

      -- Link new unit
      IF NEW.assigned_ambulance_id IS NOT NULL AND NEW.status NOT IN ('RESOLVED', 'CANCELLED') THEN
        UPDATE public.ambulances
        SET assigned_incident_id = NEW.id,
            status = CASE 
              WHEN NEW.status = 'PENDING'                  THEN 'ASSIGNED'::ambulance_status 
              WHEN NEW.status = 'ASSIGNED'                 THEN 'ASSIGNED'::ambulance_status 
              WHEN NEW.status = 'EN_ROUTE_TO_SCENE'        THEN 'EN_ROUTE_TO_SCENE'::ambulance_status
              WHEN NEW.status = 'ON_SCENE'                 THEN 'ON_SCENE'::ambulance_status
              WHEN NEW.status = 'TRANSPORTING_TO_HOSPITAL' THEN 'TRANSPORTING_TO_HOSPITAL'::ambulance_status
              WHEN NEW.status = 'ARRIVED_AT_HOSPITAL'      THEN 'ARRIVED_AT_HOSPITAL'::ambulance_status
              ELSE 'ASSIGNED'::ambulance_status
            END,
            destination = CASE
              WHEN NEW.assigned_hospital_id IS NOT NULL THEN
                COALESCE((SELECT name FROM public.hospitals WHERE id = NEW.assigned_hospital_id), NEW.location_address)
              ELSE NEW.location_address
            END,
            updated_at = NOW()
        WHERE id = NEW.assigned_ambulance_id;
      END IF;
    END IF;

    -- Condition C: Assigned Hospital Changed (Independent of status change)
    IF NEW.assigned_hospital_id IS DISTINCT FROM OLD.assigned_hospital_id AND NEW.assigned_ambulance_id IS NOT NULL THEN
      UPDATE public.ambulances
      SET destination = CASE
            WHEN NEW.assigned_hospital_id IS NOT NULL THEN
              COALESCE((SELECT name FROM public.hospitals WHERE id = NEW.assigned_hospital_id), destination)
            ELSE destination
          END,
          updated_at = NOW()
      WHERE id = NEW.assigned_ambulance_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_incident_assignment ON public.incidents;
CREATE TRIGGER trg_sync_incident_assignment
AFTER INSERT OR UPDATE OF assigned_ambulance_id, status, assigned_hospital_id
ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.sync_incident_ambulance_assignment();

-- ── Driver Immutability Trigger on Ambulances ──
CREATE OR REPLACE FUNCTION public.enforce_ambulance_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF public.current_user_role() NOT IN ('DISPATCHER', 'ADMIN') THEN
    IF OLD.assigned_driver_id IS DISTINCT FROM NEW.assigned_driver_id OR
       OLD.id IS DISTINCT FROM NEW.id OR
       OLD.call_sign IS DISTINCT FROM NEW.call_sign OR
       OLD.vehicle_number IS DISTINCT FROM NEW.vehicle_number OR
       OLD.type IS DISTINCT FROM NEW.type THEN
      RAISE EXCEPTION 'Unauthorized: Only Dispatchers or Admins can reassign drivers or alter vehicle specifications.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_ambulance_security ON public.ambulances;
CREATE TRIGGER trg_enforce_ambulance_security
BEFORE UPDATE ON public.ambulances
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ambulance_update_security();

-- ── Incident Column Protection Trigger ──
CREATE OR REPLACE FUNCTION public.enforce_incident_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF public.current_user_role() = 'DRIVER' THEN
    IF OLD.location_address IS DISTINCT FROM NEW.location_address OR
       OLD.location_lat IS DISTINCT FROM NEW.location_lat OR
       OLD.location_lng IS DISTINCT FROM NEW.location_lng OR
       OLD.severity IS DISTINCT FROM NEW.severity OR
       OLD.incident_type IS DISTINCT FROM NEW.incident_type OR
       OLD.caller_name IS DISTINCT FROM NEW.caller_name OR
       OLD.caller_phone IS DISTINCT FROM NEW.caller_phone OR
       OLD.is_sos IS DISTINCT FROM NEW.is_sos OR
       OLD.assigned_ambulance_id IS DISTINCT FROM NEW.assigned_ambulance_id THEN
      RAISE EXCEPTION 'Unauthorized: Drivers can only update lifecycle status, hospital destination, patient count, and timeline milestones.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_incident_security ON public.incidents;
CREATE TRIGGER trg_enforce_incident_security
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_incident_update_security();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline_events ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ──
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() IN ('DISPATCHER', 'ADMIN')
);

DROP POLICY IF EXISTS "profiles_update_self_policy" ON public.profiles;
CREATE POLICY "profiles_update_self_policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND (
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    OR public.current_user_role() = 'ADMIN'
  )
);

CREATE OR REPLACE VIEW public.roster_public_view AS
  SELECT id, full_name, role, avatar_url, created_at
  FROM public.profiles;

GRANT SELECT ON public.roster_public_view TO authenticated;

-- ── HOSPITALS POLICIES ──
DROP POLICY IF EXISTS "hospitals_select_policy" ON public.hospitals;
CREATE POLICY "hospitals_select_policy"
ON public.hospitals FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "hospitals_update_policy" ON public.hospitals;
CREATE POLICY "hospitals_update_policy"
ON public.hospitals FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('DISPATCHER', 'ADMIN'));

-- ── AMBULANCES POLICIES ──
DROP POLICY IF EXISTS "ambulances_select_policy" ON public.ambulances;
CREATE POLICY "ambulances_select_policy"
ON public.ambulances FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_driver_id = auth.uid()
  OR status = 'AVAILABLE'
);

DROP POLICY IF EXISTS "ambulances_insert_policy" ON public.ambulances;
CREATE POLICY "ambulances_insert_policy"
ON public.ambulances FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() IN ('DISPATCHER', 'ADMIN'));

DROP POLICY IF EXISTS "ambulances_delete_policy" ON public.ambulances;
CREATE POLICY "ambulances_delete_policy"
ON public.ambulances FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('DISPATCHER', 'ADMIN'));

DROP POLICY IF EXISTS "ambulances_update_policy" ON public.ambulances;
CREATE POLICY "ambulances_update_policy"
ON public.ambulances FOR UPDATE
TO authenticated
USING (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_driver_id = auth.uid()
)
WITH CHECK (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_driver_id = auth.uid()
);

-- ── INCIDENTS POLICIES ──
DROP POLICY IF EXISTS "incidents_select_policy" ON public.incidents;
CREATE POLICY "incidents_select_policy"
ON public.incidents FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_ambulance_id = public.current_driver_ambulance_id()
);

DROP POLICY IF EXISTS "incidents_insert_policy" ON public.incidents;
CREATE POLICY "incidents_insert_policy"
ON public.incidents FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() IN ('DISPATCHER', 'ADMIN'));

DROP POLICY IF EXISTS "incidents_update_policy" ON public.incidents;
CREATE POLICY "incidents_update_policy"
ON public.incidents FOR UPDATE
TO authenticated
USING (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_ambulance_id = public.current_driver_ambulance_id()
)
WITH CHECK (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR assigned_ambulance_id = public.current_driver_ambulance_id()
);

-- ── TIMELINE EVENTS POLICIES ──
DROP POLICY IF EXISTS "timeline_select_policy" ON public.incident_timeline_events;
CREATE POLICY "timeline_select_policy"
ON public.incident_timeline_events FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR ambulance_id = public.current_driver_ambulance_id()
);

DROP POLICY IF EXISTS "timeline_insert_policy" ON public.incident_timeline_events;
CREATE POLICY "timeline_insert_policy"
ON public.incident_timeline_events FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() IN ('DISPATCHER', 'ADMIN')
  OR ambulance_id = public.current_driver_ambulance_id()
);

-- ==============================================================================
-- 6. INITIAL SEED DATA
-- ==============================================================================

INSERT INTO public.hospitals (id, name, latitude, longitude, available_beds, icu_beds_available, total_beds, icu_beds_total, contact_number, address)
VALUES
  ('H-001', 'Apollo Hospital',   12.8933, 77.5984, 24, 8,  500, 40, '+91 80 2630 4050', 'Bannerghatta Road, Bengaluru'),
  ('H-002', 'Manipal Hospital',  12.9550, 77.6445, 12, 5,  600, 60, '+91 80 2502 4444', 'Old Airport Road, Bengaluru'),
  ('H-003', 'Fortis Hospital',   12.9975, 77.5937, 31, 10, 300, 30, '+91 80 6621 4444', 'Cunningham Road, Bengaluru')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ambulances (id, call_sign, vehicle_number, type, status, latitude, longitude, heading, speed)
VALUES
  ('AMB-001', 'Alpha-1',   'KA-01-A-0001', 'ALS', 'AVAILABLE', 12.9716, 77.5946, 0, 0),
  ('AMB-002', 'Bravo-2',   'KA-01-B-0002', 'BLS', 'AVAILABLE', 12.9352, 77.6245, 0, 0),
  ('AMB-003', 'Charlie-3', 'KA-01-C-0003', 'ALS', 'AVAILABLE', 13.0359, 77.5967, 0, 0),
  ('AMB-004', 'Delta-4',   'KA-01-D-0004', 'BLS', 'AVAILABLE', 12.9698, 77.7200, 0, 0),
  ('AMB-005', 'Echo-5',    'KA-01-E-0005', 'ALS', 'AVAILABLE', 12.9308, 77.5838, 0, 0)
ON CONFLICT (id) DO NOTHING;
