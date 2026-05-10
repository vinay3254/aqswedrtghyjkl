/**
 * ESCALATION WORKFLOW DOCUMENTATION
 * Complete guide to mutual aid and escalation workflow
 */

/*
================================================================================
1. ESCALATION RULES ENGINE (escalation-rules.js)
================================================================================

TRIGGERS FOR ESCALATION:

A. Local Capacity Exceeded
   - Threshold: 85% of units busy (configurable)
   - Monitors: Available units vs total units ratio
   - Action: Alert for resource support

B. Mass Casualty Incident (MCI) Declaration
   - Threshold: 3+ patients OR severity = CATASTROPHIC
   - Instant escalation to DISTRICT level
   - Triggers MCI Handler protocols

C. Response Time Degradation
   - Threshold: Average response time > 15 minutes
   - Indicates system overload
   - Suggests mutual aid request

D. High Dispatch Queue
   - Threshold: Pending dispatches > 2x available units
   - Shows backlog of requests
   - Indicates need for external support

ESCALATION LEVELS:

  LOCAL (No escalation)
    └─ All local resources available
    └─ Normal operations

  DISTRICT
    └─ Triggered by: MCI OR multiple factors (2+)
    └─ Request from neighboring districts
    └─ Coordinate through district coordinator

  REGIONAL
    └─ Triggered by: 3+ escalation factors
    └─ Large-scale mutual aid needed
    └─ Potential state-level resources

  MUTUAL_AID
    └─ Maximum escalation level
    └─ Multi-district/region coordination
    └─ May involve federal resources (FEMA, etc.)

WORKFLOW:

  Incident Detected
         │
         ├─ Check Local Capacity
         │        │
         │        ├─ > 85% Utilized ──┐
         │        └─ < 85% Utilized ──┤
         │                             │
         ├─ Check for MCI ────────────────┤
         │        │                       │
         │        ├─ Yes (3+ patients) ──┤──> DISTRICT ESCALATION
         │        └─ No ────────────────┤
         │                               │
         ├─ Check Response Time ─────────┤
         │        │                      │
         │        ├─ Degraded ───────────┤
         │        └─ Normal ─────────────┤
         │                               │
         ├─ Check Dispatch Queue ────────┤
         │        │                      │
         │        ├─ High (>2x) ─────────┤
         │        └─ Normal ─────────────┤
         │                               │
         └─> Evaluate Escalation
                  │
                  ├─ 0 Factors ──> LOCAL (no action)
                  ├─ 1 Factor ──> DISTRICT (optional)
                  ├─ 2 Factors ──> DISTRICT (recommended)
                  └─ 3+ Factors ──> REGIONAL (required)

================================================================================
2. MUTUAL AID COORDINATOR (mutual-aid-coordinator.js)
================================================================================

MUTUAL AID REQUEST WORKFLOW:

  1. REQUEST INITIATION
     ├─ Escalation rules determine DISTRICT/REGIONAL escalation
     ├─ Request created with:
     │  ├─ incidentId: Unique identifier
     │  ├─ location: Geographic coordinates
     │  ├─ requiredUnits: Number of ambulances needed
     │  ├─ patientCount: Total patients
     │  └─ severity: MINOR/MODERATE/HIGH/CRITICAL
     └─ Auto-identify neighboring districts by proximity

  2. REQUEST TRANSMISSION
     ├─ Send requests to all neighboring districts
     │  ├─ Via API call to district dispatch center
     │  ├─ Include incident details
     │  ├─ Timeout: 30 seconds per request
     │  └─ Retry up to 3 times on failure
     ├─ Track transmission status
     └─ Status: PENDING → SENT

  3. RESPONSE COLLECTION
     ├─ Each district responds with:
     │  ├─ Status: ACCEPTED or DECLINED
     │  ├─ Available Units: Number of ambulances available
     │  ├─ Estimated Arrival: ETA in minutes
     │  └─ Notes: Any additional information
     ├─ Responses collected for 60 seconds
     ├─ Update request with each response
     └─ Status: SENT → CONFIRMED

  4. RESOURCE ALLOCATION
     ├─ Sort responses by ETA (shortest first)
     ├─ Accept units until requirement met
     ├─ Notify accepting districts of dispatch authorization
     ├─ Coordinate arrival with local dispatch
     └─ Track unit movement in real-time

  5. ON-SITE COORDINATION
     ├─ Mutual aid units arrive and check in
     ├─ Assign to specific scenes/sectors
     ├─ Coordinate with local command
     ├─ Share patient information
     └─ Maintain communication channels

  6. REQUEST COMPLETION
     ├─ When incident resolved or local capacity restored
     ├─ Return mutual aid units to origin districts
     ├─ Debrief and document performance
     ├─ Generate after-action report
     └─ Status: CONFIRMED → COMPLETED

DISTRICT REGISTRY:

  Each district contains:
  ├─ id: Unique identifier
  ├─ name: District name
  ├─ location: {lat, lng}
  ├─ baseUnits: [unit IDs]
  ├─ contactInfo: Phone, email, API endpoint
  ├─ capabilities: [Advanced Life Support, etc.]
  └─ responseTime: Average response time (minutes)

NEIGHBOR CALCULATION:

  ├─ Geographic proximity (radius ~5km)
  ├─ Terrain considerations
  ├─ Historical mutual aid patterns
  └─ Mutual aid agreements

REQUEST RETRY LOGIC:

  District doesn't respond
    └─> Wait 10 seconds
    └─> Retry with different district
    └─> Max 3 retry attempts per original request
    └─> Escalate to REGIONAL if all fail

================================================================================
3. MASS CASUALTY INCIDENT (MCI) HANDLER (mass-casualty-handler.js)
================================================================================

MCI DECLARATION WORKFLOW:

  1. MCI RECOGNITION
     ├─ Detected when: patientCount >= 3 OR severity = CATASTROPHIC
     ├─ Can be triggered by:
     │  ├─ 911 dispatch center
     │  ├─ Escalation rules engine
     │  ├─ Incident commander
     │  └─ First responder on scene
     └─ Auto-escalates to DISTRICT level

  2. MCI ACTIVATION
     ├─ Declare MCI with incident data
     ├─ Generate unique MCI ID
     ├─ Establish command post
     │  ├─ Location: Near incident scene
     │  ├─ Commander: Senior official assigned
     │  └─ Personnel: Coordinated staff
     ├─ Create 5 operational sectors
     │  ├─ North, South, East, West, Central
     │  ├─ Each has sector leader
     │  └─ Resources assigned by proximity
     └─ Emit MCI-DECLARED event

  3. TRIAGE PROTOCOL (START - Simple Triage And Rapid Treatment)

     Patient Assessment:
     
     Check Breathing?
     ├─ Not breathing ─> Position airway
     │  ├─ Airway opens ─> YELLOW (Delayed)
     │  └─ Still not breathing ─> BLACK (Deceased)
     │
     ├─ Breathing abnormal (>30/min) ─> RED (Immediate)
     │
     └─ Breathing normal
        └─ Check Perfusion
           ├─ Cap refill > 2 sec ─> RED (Immediate)
           ├─ Cap refill normal ─> Check Alertness
           │                       ├─ Alert ─> GREEN (Minor)
           │                       └─ Unalert ─> YELLOW (Delayed)
           └─ Skin Perfusion
               ├─ Normal ─> GREEN (Minor)
               └─ Abnormal ─> YELLOW (Delayed)

     Triage Categories:
     ├─ RED (Immediate):    Critical, life-threatening
     ├─ YELLOW (Delayed):   Serious but stable
     ├─ GREEN (Minor):      Walking wounded, minor injuries
     └─ BLACK (Deceased):   Non-salvageable or deceased

  4. PATIENT REGISTRATION
     ├─ Register each patient with:
     │  ├─ Location: Where found
     │  ├─ Age, Gender: Demographics
     │  ├─ Injuries: Type and severity
     │  ├─ Vitals: Respiratory rate, cap refill, alertness
     │  └─ Triage Category: RED/YELLOW/GREEN/BLACK
     ├─ Perform triage assessment (START protocol)
     ├─ Calculate transport priority
     │  ├─ RED: Priority 1 (Highest)
     │  ├─ YELLOW: Priority 2
     │  ├─ GREEN: Priority 3
     │  └─ BLACK: Priority 4 (Lowest)
     ├─ Assign to nearest sector
     └─ Update triage counts in MCI record

  5. RESOURCE DEPLOYMENT
     ├─ For each MCI:
     │  ├─ Request ambulances from resource pool
     │  ├─ Request additional equipment
     │  └─ Assign personnel (medics, etc.)
     ├─ Dispatch resources to assigned sectors
     ├─ Track arrival and assignment
     └─ Coordinate with sector leaders

  6. TRANSPORT MANAGEMENT
     ├─ Transport patients by priority:
     │  ├─ RED patients first (to nearest trauma center)
     │  ├─ YELLOW patients second
     │  ├─ GREEN patients last
     │  └─ BLACK patients only after all others
     ├─ Maintain patient-unit tracking
     ├─ Update transport status as units leave
     └─ Record transport details and destination

  7. INCIDENT CLOSURE
     ├─ When all patients transported:
     │  ├─ Confirm all sectors clear
     │  ├─ Release unneeded resources
     │  ├─ Close MCI incident
     │  └─ Generate incident report
     ├─ Document final patient count and outcomes
     ├─ Record all transport destinations
     └─ Notify all coordinating agencies

MCI STATUS SUMMARY:

  getMCIStatus(mciId) returns:
  ├─ Registered patients: Total count
  ├─ Triage breakdown:
  │  ├─ RED: Immediate count
  │  ├─ YELLOW: Delayed count
  │  ├─ GREEN: Minor count
  │  └─ BLACK: Deceased count
  ├─ Resources deployed: By type
  ├─ Sector status: Patients per sector
  └─ Transport summary: Transported/waiting/in-treatment

================================================================================
4. RESOURCE POOLING MANAGER (resource-pooling.js)
================================================================================

RESOURCE POOL CONCEPT:

  Instead of each jurisdiction managing resources independently,
  create a shared pool of resources that can be dynamically allocated
  based on need and availability.

JURISDICTION REGISTRATION:

  Register each jurisdiction with:
  ├─ name: District/city name
  ├─ location: {lat, lng}
  ├─ baseUnits: [ambulance IDs]
  ├─ resourceCapacity: Maximum load (100 = full capacity)
  └─ region: Regional grouping

POOLING STRATEGY:

  DYNAMIC (default):
  ├─ Resources allocated based on real-time utilization
  ├─ Continuously rebalance to match demand
  ├─ Maximize resource efficiency
  └─ Minimizes response times

  STATIC:
  ├─ Resources pre-allocated by agreement
  ├─ Fixed allocation levels
  ├─ Less flexible but predictable
  └─ Used for formal mutual aid agreements

RESOURCE REQUEST WORKFLOW:

  1. REQUEST INITIATION
     ├─ Jurisdiction calculates utilization
     │  └─ Load / Capacity >= 70% → needs resources
     ├─ Request resources from pool
     │  ├─ Specify unit type (AMBULANCE, etc.)
     │  ├─ Specify quantity needed
     │  └─ Specify requested duration
     └─ Request ID generated

  2. RESOURCE MATCHING
     ├─ Find jurisdictions that can share
     │  ├─ Utilization < 50% threshold
     │  ├─ Not already fully allocated
     │  └─ Active pooling policy
     ├─ Check pooling rules:
     │  ├─ Maximum units they can share
     │  ├─ Minimum units they must retain
     │  └─ Priority tier
     └─ Allocate best available units

  3. ALLOCATION EXECUTION
     ├─ Move units from source to requesting jurisdiction
     ├─ Record source and destination
     ├─ Set automatic recall timer (default 1 hour)
     ├─ Update jurisdiction status
     └─ Status: ALLOCATED

  4. AUTOMATIC RECALL
     ├─ Allocation duration expires
     ├─ Automatically return units to source
     ├─ OR jurisdiction utilization drops below threshold
     └─ Status: ALLOCATED → RETURNED

  5. MANUAL RETURN
     ├─ Can return units before auto-recall
     ├─ Acknowledge resource improvement
     ├─ Free up units for other needs
     └─ Status: ALLOCATED → RETURNED

POOLING POLICIES:

  Each jurisdiction has a policy:
  ├─ shareWhenUtilization: 70% (can share if < 70% used)
  ├─ recallWhenUtilization: 40% (recall if requesting < 40% used)
  ├─ priorityTier: 1 = highest priority (gets resources first)
  ├─ maxSharedUnits: Maximum to share (e.g., 5)
  └─ minRetainedUnits: Minimum to keep (e.g., 2)

UTILIZATION CALCULATION:

  Utilization = Current Load / Resource Capacity
  
  Current Load:
  ├─ Number of active dispatch calls
  ├─ Units responding to incidents
  └─ Units in transport to hospitals

  Rebalancing Triggers:
  ├─ Every 30 seconds check utilization
  ├─ If any jurisdiction > 70% utilized
  ├─ Find < 50% utilized jurisdiction
  └─ Move excess resources

JURISDICTION STATUS:

  getJurisdictionDetails() returns:
  ├─ Name and location
  ├─ Resource capacity and current load
  ├─ Utilization percentage
  ├─ Base units count
  ├─ Pooled units count (sent out)
  ├─ Received units count (borrowed)
  └─ Active pooling policy

POOL STATUS SUMMARY:

  getPoolStatus() returns:
  ├─ Total jurisdictions in pool
  ├─ Total active allocations
  ├─ Each jurisdiction:
  │  ├─ Current utilization %
  │  ├─ Base units count
  │  ├─ Pooled units sent
  │  └─ Received units
  └─ Overall pooling strategy

================================================================================
5. INTEGRATED ESCALATION WORKFLOW
================================================================================

COMPLETE END-TO-END SCENARIO: MASS CASUALTY INCIDENT

TIMELINE:

  14:23:45 - Vehicle Accident
  └─ Multi-vehicle collision on highway
  └─ Initial 911 call: "Multiple patients, traffic accident"

  14:23:50 - Dispatcher Assessment
  ├─ Initial report suggests 4 patients
  ├─ Triggers escalation rules engine
  ├─ Local capacity check:
  │  ├─ Available units: 3 out of 8 total
  │  ├─ Utilization: 62.5% (below 85% threshold)
  │  └─ Can handle additional calls
  └─ Decision: Dispatch 2 units locally

  14:24:15 - First Unit Arrives on Scene
  ├─ Paramedic assesses situation
  ├─ "Four patients, appears to be MCI"
  ├─ Requests additional units
  └─ Incident severity upgraded to CRITICAL

  14:24:20 - MCI Declaration
  ├─ Escalation rules triggered:
  │  ├─ Factor 1: 4 patients (>= 3 threshold) ✓
  │  ├─ Factor 2: CRITICAL severity ✓
  │  └─ Factors: 2 → DISTRICT escalation
  ├─ Mass Casualty Handler activated
  ├─ MCI ID assigned: MCI-2024-15234-abc123
  ├─ Command post established
  ├─ 5 operational sectors created
  └─ Triage protocol initiated (START)

  14:24:30 - Patient Triage
  ├─ Patient 1: RED (Immediate) - Severe trauma
  ├─ Patient 2: YELLOW (Delayed) - Moderate injuries
  ├─ Patient 3: YELLOW (Delayed) - Head injury
  └─ Patient 4: GREEN (Minor) - Lacerations
  
  Triage Summary:
  ├─ RED: 1 patient
  ├─ YELLOW: 2 patients
  ├─ GREEN: 1 patient
  └─ BLACK: 0 patients

  14:24:45 - Resource Status Check
  ├─ Current local capacity: 2 units available
  ├─ MCI requires: 4+ units for transport
  ├─ Gap: Need 2 additional units
  ├─ Resource pool check:
  │  ├─ District A: Utilization 45% - CAN SHARE
  │  ├─ District B: Utilization 65% - Cannot share
  │  └─ District C: Utilization 30% - CAN SHARE
  └─ Request 2 units from pool

  14:25:00 - Mutual Aid Request (1st)
  ├─ Mutual Aid Coordinator activated
  ├─ Identify neighboring districts:
  │  ├─ District A (5 km away) - 6 min response
  │  ├─ District C (8 km away) - 12 min response
  │  └─ District E (12 km away) - 18 min response
  ├─ Send mutual aid requests to all three
  ├─ Request status: PENDING → SENT
  └─ Await responses

  14:25:30 - District Responses Received
  ├─ District A: ACCEPTED - 2 units, ETA 8 minutes
  ├─ District C: DECLINED - No available units
  └─ District E: ACCEPTED - 1 unit, ETA 15 minutes
  
  Response Summary:
  ├─ Total accepted: 3 units
  ├─ Total requirement: 2 units
  ├─ Request status: CONFIRMED
  └─ Expected arrival: District A in 8 min, District E in 15 min

  14:25:40 - Mutual Aid Resource Pooling
  ├─ 2 units allocated from District A
  ├─ Resource allocation created
  │  ├─ Allocation ID: PR-MCI-2024-15234-xyz789
  │  ├─ Source: District A
  │  ├─ Duration: 2 hours (auto-recall)
  │  └─ Status: ALLOCATED
  ├─ Units en route to incident scene
  └─ Local dispatch notified of ETA

  14:26:00 - Transport Begins
  ├─ Available local unit 1 + mutual aid unit 1
  ├─ Transport RED patient (Patient 1) to trauma center
  │  ├─ Priority: Highest
  │  ├─ Destination: Level 1 Trauma Center
  │  └─ ETA: 18 minutes
  ├─ Update patient transport status: IN_TRANSPORT
  └─ Continue scene assessment

  14:28:45 - Mutual Aid Arrival
  ├─ District A Unit 1 arrives on scene
  ├─ Assigned to North sector
  ├─ Begins treatment of YELLOW patients
  ├─ District A Unit 2 arrives on scene
  ├─ Assigned to South sector
  └─ Sector leaders coordinate with mutual aid crews

  14:30:15 - Additional Transport
  ├─ Local unit returns from hospital
  ├─ Picks up YELLOW patient 2
  ├─ Transport to regional medical center
  └─ Patient status: TRANSPORTED

  14:32:00 - Final Transport
  ├─ District A unit 1 transports YELLOW patient 3
  ├─ LOCAL unit transports GREEN patient 4
  ├─ All patients now in transport
  └─ Scene clearance begins

  14:38:00 - District E Unit Arrives
  ├─ Initially requested for backup
  ├─ All local patients already transported
  ├─ Assigned as standby at scene
  ├─ Available for follow-up emergencies
  └─ Maintain ICS presence

  14:42:00 - Scene Clearance
  ├─ All patients transported and accounted for
  ├─ Confirm with all transport units
  ├─ Mutual aid units prepare to return
  ├─ Scene secured and cleared
  └─ MCI status: COMPLETED

  14:43:00 - MCI Closure
  ├─ Command post operational stats:
  │  ├─ Patients registered: 4
  │  ├─ Triage: 1 RED, 2 YELLOW, 1 GREEN
  │  ├─ Resources deployed: 5 units
  │  ├─ Incident duration: 20 minutes
  │  └─ All patients transported successfully
  ├─ Generate incident report
  ├─ Release all mutual aid units
  └─ MCI ID: MCI-2024-15234-abc123 [CLOSED]

  14:44:00 - Resource Return
  ├─ District A Units 1 & 2 depart scene
  ├─ Return to District A jurisdiction
  ├─ Resource allocation returned:
  │  └─ Allocation ID: PR-MCI-2024-15234-xyz789 [RETURNED]
  ├─ District E Unit dismissed
  ├─ Return to District E
  └─ All mutual aid units accounted for

  14:45:00 - Post-Incident
  ├─ Verify all local units back in service
  ├─ Resource pool rebalancing:
  │  ├─ District A now 45% utilized (had been 45%)
  │  ├─ Local district now 25% utilized (was 62%)
  │  └─ No rebalancing needed
  ├─ After-action review scheduled
  └─ Incident closed

SYSTEM INTEGRATION:

  EscalationRules → Monitors conditions, determines escalation level
  ↓
  MassCasualtyHandler → Activated for MCI, manages triage & sectors
  ↓
  MutualAidCoordinator → Requests resources from neighbors
  ↓
  ResourcePoolingManager → Allocates pooled resources to requesting jurisdiction
  ↓
  All Components → Emit events for real-time monitoring & logging

================================================================================
6. EVENT EMISSION WORKFLOW
================================================================================

Key Events Emitted:

Escalation Rules:
├─ 'escalation-triggered': Escalation rules determine escalation needed
├─ 'mutual-aid-recommended': System recommends mutual aid
└─ 'alert-created': New escalation alert created

Mutual Aid Coordinator:
├─ 'mutual-aid-requested': Request sent to neighboring districts
├─ 'mutual-aid-response': District responds to request
├─ 'mutual-aid-confirmed': Units confirmed available
├─ 'mutual-aid-cancelled': Request cancelled
└─ 'mutual-aid-completed': All units returned

Mass Casualty Handler:
├─ 'mci-declared': MCI officially declared
├─ 'command-structure-initialized': Command post established
├─ 'patient-registered': Patient added to MCI
├─ 'patient-transport-updated': Patient transport status changed
├─ 'resource-deployed': Resource allocated to MCI
└─ 'mci-closed': MCI incident closed

Resource Pooling Manager:
├─ 'jurisdiction-registered': New jurisdiction added to pool
├─ 'resource-allocated': Resources allocated to jurisdiction
├─ 'resource-allocation-failed': Unable to fulfill request
├─ 'resources-returned': Resources returned to origin
├─ 'resource-recall-triggered': Automatic recall activated
└─ 'resources-rebalanced': Resources rebalanced across jurisdictions

================================================================================
*/

module.exports = {
  description: 'Escalation and Mutual Aid Workflow Documentation',
  components: [
    'escalation-rules.js',
    'mutual-aid-coordinator.js',
    'mass-casualty-handler.js',
    'resource-pooling.js',
  ],
};
