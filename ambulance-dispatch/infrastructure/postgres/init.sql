-- Canonical PostgreSQL bootstrap schema for the Ambulance Dispatch System.
-- This schema intentionally supports the current Phase 1 auth, incidents,
-- hospitals, ambulances, dispatch, and audit modules together.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_hospital_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_ambulance_location()
RETURNS TRIGGER AS $$
DECLARE
  effective_lat NUMERIC(10, 8);
  effective_lng NUMERIC(11, 8);
BEGIN
  effective_lat := COALESCE(NEW.latitude, NEW.current_location_lat);
  effective_lng := COALESCE(NEW.longitude, NEW.current_location_lng);

  IF effective_lat IS NOT NULL AND effective_lng IS NOT NULL THEN
    NEW.latitude := effective_lat;
    NEW.longitude := effective_lng;
    NEW.current_location_lat := effective_lat;
    NEW.current_location_lng := effective_lng;
    NEW.location := ST_SetSRID(ST_MakePoint(effective_lng, effective_lat), 4326)::geography;
    NEW.current_location := NEW.location;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  name TEXT GENERATED ALWAYS AS (btrim(concat_ws(' ', first_name, last_name))) STORED,
  role VARCHAR(50) NOT NULL DEFAULT 'CITIZEN',
  phone_number VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_users_role CHECK (role IN ('CITIZEN', 'DISPATCHER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event ON auth_audit_log(event);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  location GEOGRAPHY(Point, 4326),
  phone VARCHAR(20),
  email VARCHAR(255),
  total_beds INTEGER NOT NULL DEFAULT 0,
  available_beds INTEGER NOT NULL DEFAULT 0,
  icu_beds INTEGER NOT NULL DEFAULT 0,
  available_icu_beds INTEGER NOT NULL DEFAULT 0,
  trauma_bays INTEGER NOT NULL DEFAULT 0,
  available_trauma_bays INTEGER NOT NULL DEFAULT 0,
  emergency_beds INTEGER NOT NULL DEFAULT 0,
  trauma_level VARCHAR(20),
  emergency_capacity INTEGER NOT NULL DEFAULT 0,
  current_wait_time INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  specialties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '{}'::jsonb,
  blood_inventory JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_accepting_patients BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_hospital_coordinates_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_hospital_coordinates_lng CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals USING GIST(location);

CREATE TABLE IF NOT EXISTS ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sign VARCHAR(50) UNIQUE NOT NULL,
  vehicle_number VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'BLS',
  equipment_type VARCHAR(20) NOT NULL DEFAULT 'BLS',
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  current_location_lat NUMERIC(10, 8),
  current_location_lng NUMERIC(11, 8),
  location GEOGRAPHY(Point, 4326),
  current_location GEOGRAPHY(Point, 4326),
  fuel_level INTEGER NOT NULL DEFAULT 100,
  base_station VARCHAR(100),
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  driver_name VARCHAR(255),
  driver_phone VARCHAR(20),
  crew_capacity INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_maintenance_date TIMESTAMPTZ,
  next_maintenance_date TIMESTAMPTZ,
  mileage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_ambulance_type CHECK (type IN ('ALS', 'BLS', 'NEONATAL')),
  CONSTRAINT chk_ambulance_equipment_type CHECK (equipment_type IN ('ALS', 'BLS', 'NEONATAL')),
  CONSTRAINT chk_ambulance_status CHECK (status IN ('AVAILABLE', 'DISPATCHED', 'BUSY', 'OFFLINE', 'OUT_OF_SERVICE', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'AT_HOSPITAL')),
  CONSTRAINT chk_ambulance_fuel_level CHECK (fuel_level BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ambulances_type ON ambulances(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ambulances_location ON ambulances USING GIST(location);

CREATE TABLE IF NOT EXISTS ambulance_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  license_expiry DATE NOT NULL,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  shift_status VARCHAR(20) NOT NULL DEFAULT 'OFF_DUTY',
  current_ambulance_id UUID REFERENCES ambulances(id) ON DELETE SET NULL,
  shift_start_time TIMESTAMPTZ,
  shift_end_time TIMESTAMPTZ,
  location GEOGRAPHY(Point, 4326),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  performance_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_driver_shift_status CHECK (shift_status IN ('ON_DUTY', 'OFF_DUTY', 'BREAK'))
);

CREATE INDEX IF NOT EXISTS idx_ambulance_drivers_user_id ON ambulance_drivers(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ambulance_drivers_current_ambulance_id ON ambulance_drivers(current_ambulance_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ambulance_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
  equipment_name VARCHAR(100) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPERATIONAL',
  quantity INTEGER NOT NULL DEFAULT 1,
  expiry_date DATE,
  last_checked TIMESTAMPTZ,
  next_check_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_equipment_status CHECK (status IN ('OPERATIONAL', 'NEEDS_CHECK', 'DEFECTIVE', 'MISSING'))
);

CREATE INDEX IF NOT EXISTS idx_ambulance_equipment_ambulance_id ON ambulance_equipment(ambulance_id);

CREATE TABLE IF NOT EXISTS ambulance_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  incident_id UUID,
  location GEOGRAPHY(Point, 4326),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambulance_status_history_ambulance_id ON ambulance_status_history(ambulance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ambulance_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  cost NUMERIC(10, 2),
  performed_by VARCHAR(100),
  mileage_at_service INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_maintenance_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_ambulance_maintenance_ambulance_id ON ambulance_maintenance(ambulance_id, scheduled_date DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(50) UNIQUE,
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20) NOT NULL,
  location_lat NUMERIC(10, 8) NOT NULL,
  location_lng NUMERIC(11, 8) NOT NULL,
  location_address TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  incident_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  patient_count INTEGER NOT NULL DEFAULT 1,
  priority_score INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  en_route_at TIMESTAMPTZ,
  on_scene_at TIMESTAMPTZ,
  transporting_at TIMESTAMPTZ,
  at_hospital_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_incident_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_incident_type CHECK (incident_type IN ('MEDICAL', 'ACCIDENT', 'CARDIAC', 'STROKE', 'TRAUMA', 'MATERNITY', 'OTHER')),
  CONSTRAINT chk_incident_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT chk_incident_patient_count CHECK (patient_count BETWEEN 1 AND 100),
  CONSTRAINT chk_incident_coordinates_lat CHECK (location_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_incident_coordinates_lng CHECK (location_lng BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);
CREATE INDEX IF NOT EXISTS idx_incidents_hospital_id ON incidents(hospital_id);
CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(status, priority_score DESC)
  WHERE status NOT IN ('RESOLVED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS incident_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  previous_state VARCHAR(20),
  new_state VARCHAR(20),
  action_type VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_audit_log_incident_id ON incident_audit_log(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_audit_log_changed_at ON incident_audit_log(changed_at DESC);

CREATE TABLE IF NOT EXISTS incident_timeline (
  id BIGSERIAL PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);

CREATE TABLE IF NOT EXISTS ambulance_location_history (
  id BIGSERIAL PRIMARY KEY,
  ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  speed NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  accuracy NUMERIC(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambulance_location_history_ambulance_id ON ambulance_location_history(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_location_history_recorded_at ON ambulance_location_history(recorded_at DESC);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE RESTRICT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  dispatcher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ambulance_reasoning TEXT,
  hospital_reasoning TEXT,
  auto_selected BOOLEAN NOT NULL DEFAULT true,
  override_reason TEXT,
  estimated_arrival_time INTEGER,
  route_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT,
  timeout_handled BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assignment_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_incident_id ON assignments(incident_id);
CREATE INDEX IF NOT EXISTS idx_assignments_ambulance_id ON assignments(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments(assigned_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS cached_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat NUMERIC(10, 7) NOT NULL,
  origin_lng NUMERIC(10, 7) NOT NULL,
  destination_lat NUMERIC(10, 7) NOT NULL,
  destination_lng NUMERIC(10, 7) NOT NULL,
  route_geometry JSONB NOT NULL,
  distance NUMERIC(10, 2),
  duration NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_cached_routes_expires_at ON cached_routes(expires_at);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sync_hospital_location_trigger ON hospitals;
CREATE TRIGGER sync_hospital_location_trigger
BEFORE INSERT OR UPDATE ON hospitals
FOR EACH ROW EXECUTE FUNCTION sync_hospital_location();

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON hospitals;
CREATE TRIGGER update_hospitals_updated_at
BEFORE UPDATE ON hospitals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sync_ambulance_location_trigger ON ambulances;
CREATE TRIGGER sync_ambulance_location_trigger
BEFORE INSERT OR UPDATE ON ambulances
FOR EACH ROW EXECUTE FUNCTION sync_ambulance_location();

DROP TRIGGER IF EXISTS update_ambulances_updated_at ON ambulances;
CREATE TRIGGER update_ambulances_updated_at
BEFORE UPDATE ON ambulances
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ambulance_drivers_updated_at ON ambulance_drivers;
CREATE TRIGGER update_ambulance_drivers_updated_at
BEFORE UPDATE ON ambulance_drivers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ambulance_equipment_updated_at ON ambulance_equipment;
CREATE TRIGGER update_ambulance_equipment_updated_at
BEFORE UPDATE ON ambulance_equipment
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ambulance_maintenance_updated_at ON ambulance_maintenance;
CREATE TRIGGER update_ambulance_maintenance_updated_at
BEFORE UPDATE ON ambulance_maintenance
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  RAISE NOTICE 'Ambulance Dispatch System schema initialized successfully.';
END $$;
