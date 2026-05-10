-- Migration: Create incidents and incident_audit_log tables
-- Description: Complete schema for incident management with 8-state FSM

-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Caller information
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20) NOT NULL,
  
  -- Location information
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  location_address TEXT NOT NULL,
  
  -- Incident details
  severity VARCHAR(20) NOT NULL,
  incident_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  patient_count INTEGER DEFAULT 1 CHECK (patient_count >= 1 AND patient_count <= 100),
  priority_score INTEGER NOT NULL,
  
  -- Status and state
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  
  -- Assignments
  hospital_id UUID,
  
  -- User tracking
  created_by UUID NOT NULL,
  updated_by UUID,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- State transition timestamps
  acknowledged_at TIMESTAMP,
  dispatched_at TIMESTAMP,
  en_route_at TIMESTAMP,
  on_scene_at TIMESTAMP,
  transporting_at TIMESTAMP,
  at_hospital_at TIMESTAMP,
  resolved_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_incident_type CHECK (incident_type IN ('MEDICAL', 'ACCIDENT', 'CARDIAC', 'STROKE', 'TRAUMA', 'MATERNITY', 'OTHER')),
  CONSTRAINT chk_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT chk_coordinates_lat CHECK (location_lat >= -90 AND location_lat <= 90),
  CONSTRAINT chk_coordinates_lng CHECK (location_lng >= -180 AND location_lng <= 180)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_incident_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);
CREATE INDEX IF NOT EXISTS idx_incidents_hospital ON incidents(hospital_id);

-- Create spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents USING GIST (point(location_lng, location_lat));

-- Create composite index for active incidents dashboard
CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(status, priority_score DESC) 
  WHERE status NOT IN ('RESOLVED', 'CANCELLED');

-- Create incident audit log table
CREATE TABLE IF NOT EXISTS incident_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  
  -- State change tracking
  previous_state VARCHAR(20),
  new_state VARCHAR(20),
  
  -- Generic action tracking
  action_type VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  
  -- User and reason
  changed_by UUID,
  reason TEXT,
  
  -- Timestamp
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_incident ON incident_audit_log(incident_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON incident_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON incident_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON incident_audit_log(action_type);

-- Add comments for documentation
COMMENT ON TABLE incidents IS 'Emergency incidents with 8-state FSM lifecycle management';
COMMENT ON COLUMN incidents.priority_score IS 'Auto-calculated priority: severity_weight × type_weight × 10';
COMMENT ON COLUMN incidents.status IS 'Current FSM state: PENDING → ACKNOWLEDGED → DISPATCHED → EN_ROUTE → ON_SCENE → TRANSPORTING → AT_HOSPITAL → RESOLVED';

COMMENT ON TABLE incident_audit_log IS 'Complete audit trail of all incident state changes and modifications';

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE ON incidents TO dispatcher_role;
-- GRANT SELECT, INSERT, UPDATE ON incident_audit_log TO dispatcher_role;
-- GRANT SELECT ON incidents TO citizen_role;
-- GRANT SELECT, INSERT ON incidents TO citizen_role;
