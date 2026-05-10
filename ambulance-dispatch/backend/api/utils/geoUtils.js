const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

const isWithinRadius = (lat1, lon1, lat2, lon2, radiusKm) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radiusKm;
};

const calculateETA = (distanceKm, averageSpeedKmh = 60) => {
  const hours = distanceKm / averageSpeedKmh;
  const minutes = Math.round(hours * 60);
  return minutes;
};

const sortByDistance = (items, targetLat, targetLon, latKey = 'latitude', lonKey = 'longitude') => {
  return items.map(item => ({
    ...item,
    distance: calculateDistance(targetLat, targetLon, item[latKey], item[lonKey])
  })).sort((a, b) => a.distance - b.distance);
};

module.exports = {
  calculateDistance,
  isWithinRadius,
  calculateETA,
  sortByDistance,
};
