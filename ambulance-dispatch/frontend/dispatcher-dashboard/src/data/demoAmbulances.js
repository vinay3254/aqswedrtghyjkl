/* Shared ambulance demo data — kept in its own module so it doesn't
   conflict with React Fast Refresh (which requires component-only exports). */
export const DEMO_AMBULANCES = [
  { id:'AMB-001', call_sign:'Alpha-1',   vehicle_number:'KA-01-A-0001', type:'ALS', status:'EN_ROUTE',    battery:87,  signal:4, latitude:12.9540, longitude:77.6010, speed:58, destination:'Incident #SOS-001', driver:'Rajesh Kumar',  targetLat:13.0100, targetLng:77.6450, etaSeconds:300 },
  { id:'AMB-002', call_sign:'Bravo-2',   vehicle_number:'KA-01-B-0002', type:'BLS', status:'AVAILABLE',   battery:100, signal:5, latitude:12.9716, longitude:77.5946, speed:0,  destination:null,               driver:'Suresh Patel' },
  { id:'AMB-003', call_sign:'Charlie-3', vehicle_number:'KA-01-C-0003', type:'ALS', status:'TRANSPORTING',battery:62,  signal:3, latitude:12.9900, longitude:77.5650, speed:42, destination:'Manipal Hospital',  driver:'Priya Singh',   targetLat:12.9250, targetLng:77.6100, etaSeconds:420 },
  { id:'AMB-004', call_sign:'Delta-4',   vehicle_number:'KA-01-D-0004', type:'BLS', status:'ON_SCENE',    battery:45,  signal:4, latitude:13.0050, longitude:77.6200, speed:0,  destination:'Incident #2',       driver:'Amit Sharma' },
  { id:'AMB-005', call_sign:'Echo-5',    vehicle_number:'KA-01-E-0005', type:'ALS', status:'AVAILABLE',   battery:95,  signal:5, latitude:12.9380, longitude:77.6140, speed:0,  destination:null,                driver:'Neha Verma' },
];
