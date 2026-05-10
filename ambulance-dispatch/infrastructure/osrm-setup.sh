#!/bin/bash

# OSRM Data Setup Script
# This script downloads and prepares OpenStreetMap data for OSRM routing

set -e

REGION=${1:-"delhi"}
DATA_DIR="./osrm-data"

echo "=== OSRM Setup Script ==="
echo "Region: $REGION"
echo "Data directory: $DATA_DIR"

# Create data directory
mkdir -p "$DATA_DIR"

case $REGION in
  "delhi")
    OSM_URL="http://download.geofabrik.de/asia/india/delhi-latest.osm.pbf"
    OSM_FILE="delhi-latest.osm.pbf"
    ;;
  "india")
    OSM_URL="http://download.geofabrik.de/asia/india-latest.osm.pbf"
    OSM_FILE="india-latest.osm.pbf"
    ;;
  "maharashtra")
    OSM_URL="http://download.geofabrik.de/asia/india/maharashtra-latest.osm.pbf"
    OSM_FILE="maharashtra-latest.osm.pbf"
    ;;
  *)
    echo "Unknown region: $REGION"
    echo "Available regions: delhi, india, maharashtra"
    exit 1
    ;;
esac

cd "$DATA_DIR"

# Download OSM data
if [ ! -f "$OSM_FILE" ]; then
  echo "Downloading OSM data from $OSM_URL..."
  wget -O "$OSM_FILE" "$OSM_URL"
else
  echo "OSM data already exists: $OSM_FILE"
fi

# Extract base name
BASE_NAME="${OSM_FILE%.osm.pbf}"

# Run OSRM extract
echo "Running OSRM extract..."
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/$OSM_FILE

# Run OSRM partition
echo "Running OSRM partition..."
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-partition /data/$BASE_NAME.osrm

# Run OSRM customize
echo "Running OSRM customize..."
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-customize /data/$BASE_NAME.osrm

echo "=== OSRM Setup Complete ==="
echo "To start OSRM server:"
echo "docker-compose -f docker-compose.osrm.yml up -d"
