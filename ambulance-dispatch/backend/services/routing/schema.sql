-- Routes table for storing calculated and actual routes
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  
  -- Planned route (from OSRM)
  route_json JSONB NOT NULL,
  distance FLOAT NOT NULL,
  duration FLOAT NOT NULL,
  
  -- Actual route (from GPS tracking)
  actual_route_json JSONB,
  actual_distance FLOAT,
  actual_duration FLOAT,
  
  -- Traffic information
  traffic_multiplier FLOAT DEFAULT 1.0,
  traffic_level VARCHAR(20), -- 'clear', 'light', 'moderate', 'heavy'
  
  -- Route metadata
  waypoints INTEGER DEFAULT 2,
  alternative_rank INTEGER DEFAULT 0, -- 0 = primary route, 1+ = alternatives
  fallback BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_routes_assignment ON routes(assignment_id);
CREATE INDEX idx_routes_created_at ON routes(created_at);
CREATE INDEX idx_routes_completed ON routes(completed_at) WHERE completed_at IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_routes_updated_at();

-- Add route columns to assignments table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignments' AND column_name = 'route_id'
  ) THEN
    ALTER TABLE assignments ADD COLUMN route_id UUID REFERENCES routes(id);
    CREATE INDEX idx_assignments_route ON assignments(route_id);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE routes IS 'Stores planned and actual routes for ambulance assignments';
COMMENT ON COLUMN routes.route_json IS 'GeoJSON LineString of planned route';
COMMENT ON COLUMN routes.actual_route_json IS 'GeoJSON LineString of GPS-tracked actual route';
COMMENT ON COLUMN routes.traffic_multiplier IS 'Traffic delay multiplier applied (1.0 = no traffic)';
COMMENT ON COLUMN routes.fallback IS 'True if route was calculated using fallback (Haversine) instead of OSRM';
