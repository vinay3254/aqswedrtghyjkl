# OSRM Setup Instructions

## Quick Start (Windows)

### Prerequisites
- Docker Desktop installed and running
- At least 10GB free disk space (for India map data)
- 4GB RAM available for Docker

### Option 1: Delhi Region (Recommended for Testing)

1. **Download OSM Data**
   ```powershell
   # Create data directory
   mkdir infrastructure\osrm-data
   cd infrastructure\osrm-data
   
   # Download Delhi map data (~20MB)
   Invoke-WebRequest -Uri "http://download.geofabrik.de/asia/india/delhi-latest.osm.pbf" -OutFile "delhi-latest.osm.pbf"
   ```

2. **Process Map Data**
   ```powershell
   # Extract
   docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/delhi-latest.osm.pbf
   
   # Partition
   docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/delhi-latest.osrm
   
   # Customize
   docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/delhi-latest.osrm
   ```

3. **Start OSRM Server**
   ```powershell
   cd ..
   docker-compose -f docker-compose.osrm.yml up -d
   ```

4. **Test OSRM**
   ```powershell
   # Test route (Delhi coordinates)
   curl "http://localhost:5000/route/v1/driving/77.2090,28.6139;77.1025,28.7041?overview=false"
   ```

### Option 2: Full India Map

⚠️ **Warning**: India map is ~1GB download, requires 8GB RAM and takes ~30 minutes to process.

```powershell
cd infrastructure\osrm-data
Invoke-WebRequest -Uri "http://download.geofabrik.de/asia/india-latest.osm.pbf" -OutFile "india-latest.osm.pbf"

# Process (same commands as above, replace "delhi" with "india")
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/india-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/india-latest.osrm
```

### Option 3: No Map Data (Fallback Only)

If you don't want to download maps, the routing service will work in fallback mode:

```javascript
// Fallback uses Haversine distance calculations
// Less accurate but works without OSRM
```

## Verify Installation

```powershell
# Check Docker container status
docker ps | Select-String osrm

# Check OSRM health
curl http://localhost:5000/route/v1/driving/77.2090,28.6139;77.1025,28.7041

# Check API health
curl http://localhost:3000/api/routing/health
```

## Update Map Data

To update OSM data with latest road changes:

```powershell
cd infrastructure\osrm-data

# Download latest
Invoke-WebRequest -Uri "http://download.geofabrik.de/asia/india/delhi-latest.osm.pbf" -OutFile "delhi-latest.osm.pbf"

# Reprocess
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/delhi-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/delhi-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/delhi-latest.osrm

# Restart OSRM
cd ..
docker-compose -f docker-compose.osrm.yml restart
```

## Troubleshooting

### OSRM won't start
- Check if files exist: `ls infrastructure\osrm-data\*.osrm*`
- Check Docker logs: `docker logs osrm-backend`
- Ensure Docker has enough memory (Settings → Resources → Memory: 4GB+)

### Route calculation fails
- Verify coordinates are within map boundaries (Delhi: 77.0-77.5 lng, 28.4-28.9 lat)
- Check OSRM health endpoint
- Service will automatically fallback to Haversine calculations

### Performance issues
- Use route caching (enabled by default)
- Enable geometry simplification for mobile: `{ simplify: true }`
- Increase Docker memory allocation
- Use batch endpoints for multiple requests

## Available Regions

Download from: http://download.geofabrik.de/asia/india.html

- Delhi: ~20MB
- Mumbai (Maharashtra): ~50MB
- Bangalore (Karnataka): ~40MB
- Chennai (Tamil Nadu): ~30MB
- Full India: ~1GB

Choose based on your deployment region!
