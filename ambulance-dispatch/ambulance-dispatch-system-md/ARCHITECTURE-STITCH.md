# Architecture Stitch

Practical combined shape based on the strongest repos.

## Recommended Base

- Product shell:
  `qppd/ambulance-dispatch-management-system`
- Dispatch logic starter:
  `souravvoid/-rapid-response-ems`
- Routing starter:
  `hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system`
- Optimization engine:
  `dhcsousa/hospitopt`

## Suggested System Split

### 1. App Layer
- Dispatcher UI
- Driver UI
- Citizen or caller UI
- Admin UI

### 2. Operational API
- incident management
- ambulance and driver management
- hospital inventory and bed status
- live tracking and mission state transitions

### 3. Routing Service
- shortest path
- ETA
- rerouting
- traffic factor

### 4. Optimization Worker
- ambulance to incident assignment
- patient to hospital assignment
- priority and capacity optimization
- future ambulance repositioning

### 5. Traffic Priority Module
- green corridor requests
- signal preemption hooks
- police / control room overrides

## Data Entities

- incidents
- patients
- ambulances
- drivers
- hospitals
- beds and capabilities
- assignments
- telemetry points
- audit events

## Build Order

1. multi-role dispatch app
2. operational dispatch and status lifecycle
3. hospital inventory and allocation score
4. routing service integration
5. optimization worker
6. traffic-priority subsystem

## What To Avoid

- trusting README claims without checking code depth
- baking "AI" into the first version where rules and optimization are enough
- mixing hardware signal-control logic into the core dispatch app too early
