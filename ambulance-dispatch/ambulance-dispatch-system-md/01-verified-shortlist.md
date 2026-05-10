# Verified Shortlist

These are the repos that looked worth checking after direct README review.

## Tier 1: Strongest starting points

### 1. qppd/ambulance-dispatch-management-system
Link: https://github.com/qppd/ambulance-dispatch-management-system

Why keep it:
- strongest app architecture of the group
- multi-role flows for dispatcher, driver, citizen, municipal admin, super admin
- real-time state updates, notifications, GPS tracking, analytics, tests
- clean incident lifecycle and operational dashboards

Keep from it:
- role model and dashboard split
- dispatch lifecycle states
- audit logging and analytics pattern
- Firebase-based real-time update flow

Ignore or defer:
- hospital allocation is still not the core finished module
- nearest-unit auto-dispatch is simple, not a robust optimization engine

Confidence:
- high for implementation depth
- medium for fit to hospital allocation

### 2. souravvoid/-rapid-response-ems
Link: https://github.com/souravvoid/-rapid-response-ems

Why keep it:
- closest direct feature match to ambulance plus hospital dispatch
- explicit ambulance assignment, ETA, hospital bed checking, driver GPS
- simple enough to lift logic from quickly

Keep from it:
- graph-based dispatch selection
- hospital fallback logic
- driver dashboard concepts
- user-visible ETA and assigned-hospital flow

Ignore or defer:
- AI branding is light
- routing is simpler than a real traffic-aware engine

Confidence:
- medium-high for feature fit
- medium for engineering depth

### 3. hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system
Link: https://github.com/hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system

Why keep it:
- best routing-focused full-stack repo from the group
- hospitals, ambulances, severity scoring, nearest-hospital API, OSRM routing
- clear API shape for emergency request and routing optimization

Keep from it:
- API boundaries
- OSRM route optimization calls
- live ambulance position updates
- weighted severity and priority scoring

Ignore or defer:
- demo-only assumptions
- pseudo-ML marketing
- public OSRM dependency for anything serious

Confidence:
- high for reusable API ideas
- medium for implementation depth

### 4. dhcsousa/hospitopt
Link: https://github.com/dhcsousa/hospitopt

Why keep it:
- best allocation and optimization engine by far
- strongest engineering discipline in the set
- explicitly models hospitals, patients, ambulances, urgency deadlines, and bed capacity

Keep from it:
- optimization worker pattern
- assignment objective and constraints
- dashboard concepts for assignments and SITREP
- API plus worker plus frontend separation

Ignore or defer:
- not a citizen-facing dispatch product
- heavier than needed if you only want a quick demo

Confidence:
- high for implementation depth
- high for hospital allocation value

## Tier 2: Good supporting repos

### 5. ShubhamPhapale/dynamic-emergency-response-vehicle-routing-system
Link: https://github.com/ShubhamPhapale/dynamic-emergency-response-vehicle-routing-system

Why keep it:
- useful simulation of dispatch to accident, hospital, and return-to-base
- good for testing fleet behavior before adding real users

Keep from it:
- simulation flow
- routing integration ideas
- dashboard metrics

Ignore or defer:
- not a production app
- hospital choice is simple

Confidence:
- medium

### 6. jamesypeng/Smarter-Emergency-Dispatch
Link: https://github.com/jamesypeng/Smarter-Emergency-Dispatch

Why keep it:
- good predictive EMS framing
- useful for later AI demand forecasting and ambulance pre-positioning

Keep from it:
- prediction layer concepts
- post-positioning logic
- traffic-aware assignment framing

Ignore or defer:
- not a full operational repo

Confidence:
- medium

### 7. sweetylearner-max/emergency-hospital-rec-system
Link: https://github.com/sweetylearner-max/emergency-hospital-rec-system

Why keep it:
- clean hospital recommendation scoring idea
- distance plus beds plus specialist plus ranking is a usable first-pass formula

Keep from it:
- hospital scoring model
- geospatial hospital search
- pre-arrival hospital alert workflow

Ignore or defer:
- hackathon-grade implementation
- not a dispatch system

Confidence:
- medium for feature reuse
- low-medium for production depth

### 8. HariniCJ/Ambulance-Navigation-with-Hospital-Availability-and-Dynamic-Traffic-Routing
Link: https://github.com/HariniCJ/Ambulance-Navigation-with-Hospital-Availability-and-Dynamic-Traffic-Routing

Why keep it:
- useful combined concept for hospital availability plus route scoring plus police dashboard

Keep from it:
- multi-role concept
- route score formula
- vitals-to-hospital handoff idea

Ignore or defer:
- prototype-level polish
- claims exceed verified depth

Confidence:
- low-medium
