# Stitched Features

This is the merged feature set worth carrying forward from the best repos.

## 1. Core user roles

Keep:
- citizen or caller
- dispatcher
- ambulance driver or crew
- hospital staff
- municipal or system admin

Primary source:
- qppd/ambulance-dispatch-management-system

## 2. Incident lifecycle

Use a strict state machine:

- pending
- acknowledged
- dispatched
- en_route
- on_scene
- transporting
- at_hospital
- resolved
- cancelled

Primary source:
- qppd/ambulance-dispatch-management-system

Support:
- souravvoid/-rapid-response-ems

## 3. Ambulance assignment

Keep:
- choose nearest available unit
- include severity weighting
- include unit capability and current status
- support manual override by dispatcher
- track ambulance to patient, then patient to hospital, then return to pool

Primary source:
- souravvoid/-rapid-response-ems
- qppd/ambulance-dispatch-management-system
- ShubhamPhapale/dynamic-emergency-response-vehicle-routing-system

## 4. Routing

Keep:
- route optimization API layer
- ETA returned with distance and duration
- traffic multiplier or traffic-aware score
- fallback routing if external engine fails
- route recalculation after state changes

Primary source:
- hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system

Support:
- ShubhamPhapale/dynamic-emergency-response-vehicle-routing-system

## 5. Hospital selection

Use a score, not just nearest distance.

Recommended score inputs:
- travel time
- available beds
- ICU or emergency capability
- specialty match
- hospital ranking or readiness
- urgency deadline

Primary source:
- dhcsousa/hospitopt
- sweetylearner-max/emergency-hospital-rec-system
- souravvoid/-rapid-response-ems

## 6. Allocation engine

Keep:
- separate optimization worker from API
- re-run allocation when ambulances, patients, or hospital capacity changes
- write assignment results back to storage
- log why an assignment was chosen

Primary source:
- dhcsousa/hospitopt

## 7. Driver and hospital coordination

Keep:
- live ambulance location updates
- driver assignment acceptance
- patient vitals handoff to hospital
- hospital pre-arrival notification
- hospital acknowledgement of incoming case

Primary source:
- souravvoid/-rapid-response-ems
- HariniCJ/Ambulance-Navigation-with-Hospital-Availability-and-Dynamic-Traffic-Routing
- sweetylearner-max/emergency-hospital-rec-system

## 8. Traffic priority and green corridor

Keep later, not first:
- police or traffic-control dashboard
- emergency signal override requests
- route-linked green corridor activation
- optional simulation before real integration

Primary source:
- HariniCJ/Ambulance-Navigation-with-Hospital-Availability-and-Dynamic-Traffic-Routing
- routing subagent shortlist

## 9. Prediction and AI later

Do not force AI first.

Add later:
- demand forecasting by area and hour
- ambulance post positioning
- predicted bed availability
- severity classification from symptoms or incident context

Primary source:
- jamesypeng/Smarter-Emergency-Dispatch
- dhcsousa/hospitopt

## 10. Minimum viable stitched architecture

Recommended shape:

- Frontend app shell and roles from `qppd/ambulance-dispatch-management-system`
- Dispatch and hospital fallback logic from `souravvoid/-rapid-response-ems`
- Routing service pattern from `hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system`
- Allocation worker from `dhcsousa/hospitopt`
- Optional simulation harness from `ShubhamPhapale/dynamic-emergency-response-vehicle-routing-system`

## 11. Things not worth copying directly

Avoid lifting these without redesign:
- hackathon-only UI polish
- repos that are mostly README pitch with light code
- public demo routing service assumptions
- "AI" labels that are really static rules
- hospital selection based only on nearest distance
