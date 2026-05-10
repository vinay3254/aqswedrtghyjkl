# Fastest Safe Start

If you want to move quickly, do this first.

## Base stack

Use:
- `qppd/ambulance-dispatch-management-system` as the app shell and role model
- `dhcsousa/hospitopt` as the allocation engine
- `hackathon-NareshIT/liferoute-ai-smart-emergency-ambulance-routing-system` as the routing-service reference

## Build order

1. Implement incident state machine and user roles.
2. Add ambulance availability and live location.
3. Add route and ETA service.
4. Add hospital scoring using travel time, beds, ICU, specialty, and urgency.
5. Add optimization worker for ambulance plus hospital assignment.
6. Add dispatcher override and audit log.
7. Add hospital acknowledgement and pre-arrival alert.
8. Add traffic-priority and predictive AI only after the operational path is stable.

## Hard rules

- Every assignment must be overrideable by a human dispatcher.
- Every auto-hospital choice must show why it was chosen.
- Every route service needs a fallback path if the map API fails.
- Never assign by nearest distance alone.
- Never hide capacity, severity, or ETA assumptions from operators.

## What not to do first

- do not start with RL or fancy AI
- do not start with traffic signal control hardware
- do not trust a repo just because its title matches the idea
- do not merge everything blindly into one codebase

Start with a reliable operations core, then add optimization, then add AI.
