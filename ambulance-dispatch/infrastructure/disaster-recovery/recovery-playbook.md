# Disaster Recovery & Recovery Playbook
## Ambulance Dispatch System

**Last Updated:** 2024-01  
**Next Review:** 2024-04  
**Classification:** Operational - Critical

---

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Pre-Incident Preparation](#pre-incident-preparation)
3. [Incident Response](#incident-response)
4. [Recovery Procedures](#recovery-procedures)
5. [Verification Steps](#verification-steps)
6. [Post-Incident Actions](#post-incident-actions)

---

## Quick Reference

### Critical Contact Numbers
```
Operations Manager:       +1-XXX-XXX-XXXX (24/7)
Infrastructure Lead:      +1-XXX-XXX-XXXX
Database Administrator:   +1-XXX-XXX-XXXX
Network Administrator:    +1-XXX-XXX-XXXX
Incident Commander:       page-duty escalation

Slack Channel:            #ambulance-dispatch-incidents
Email Escalation:         incidents@ambulance-dispatch.local
```

### Quick Links
- **Status Dashboard**: https://status.ambulance-dispatch.local
- **Failover Dashboard**: https://failover.ambulance-dispatch.local
- **Backup Status**: https://backup.ambulance-dispatch.local
- **Logs Dashboard**: https://logs.ambulance-dispatch.local
- **Runbook Repository**: https://github.com/ambulance-dispatch/runbooks

### Recovery Time Targets
| Component | RTO | RPO |
|-----------|-----|-----|
| Dispatch API | 5 min | 15 min |
| Database | 15 min | 15 min |
| Message Queue | 10 min | 5 min |
| Cache | 5 min | 0 (not critical) |
| File Storage | 30 min | 1 hour |

---

## Pre-Incident Preparation

### Phase 1: Weekly Preparation (Every Friday)

#### 1.1 Review Incident Log
```bash
# Check recent incidents
cat /var/log/incidents/recovery-events.log | tail -50

# Analyze incident patterns
grep "ERROR\|FAILURE" /var/log/incidents/* | sort | uniq -c
```

#### 1.2 Verify Backup Status
```bash
# Check latest backups
ls -lah /backups/db/ambulance_db_*.sql.gz | tail -5

# Verify backup integrity
sha256sum -c /backups/db/checksums.txt

# Test backup restoration
./scripts/test-backup-restore.sh
```

#### 1.3 Review Recovery Scripts
```bash
# Validate all recovery scripts
cd /opt/recovery-scripts
for script in *.sh; do
  bash -n "$script" && echo "✓ $script"
done

# Check script permissions
ls -la /opt/recovery-scripts/*.sh
```

#### 1.4 Update Contact Information
```bash
# Verify escalation contacts
cat /etc/incident/contacts.yaml

# Test notification channels
./scripts/test-notifications.sh
```

### Phase 2: Monthly Preparation (First Monday)

#### 2.1 Full Recovery Drill
```bash
# Schedule recovery test
./scripts/schedule-recovery-test.sh --date "2024-02-05" --time "14:00 UTC"

# Document test results
# Submit to: incidents@ambulance-dispatch.local
```

#### 2.2 Update Documentation
```bash
# Review and update all recovery playbooks
cd /docs/recovery-playbooks
git status
git diff

# Update contact list if changed
nano /etc/incident/contacts.yaml
git commit -am "Update incident contacts"
```

#### 2.3 Review Metrics and Capacity
```bash
# Check disk usage
df -h /backups /data

# Check database size trend
psql -U dispatch_user ambulance_db \
  -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Verify backup rotation
./scripts/check-backup-rotation.sh
```

---

## Incident Response

### Phase 1: Detection & Assessment

#### Step 1.1: Confirm the Incident
```bash
# When alerted about potential issue:

# 1. Check status dashboard
curl -s https://status.ambulance-dispatch.local/api/health

# 2. Verify primary region
curl -s http://dispatch-primary.ambulance-dispatch.local/health

# 3. Check secondary region
curl -s http://dispatch-secondary.ambulance-dispatch.local/health

# 4. Review recent logs
tail -100 /var/log/dispatch/error.log | grep -i "error\|fail\|timeout"

# 5. Check system resources
free -h
df -h /
ps aux | grep -E "postgres|redis|dispatch" | head -20
```

#### Step 1.2: Declare Incident
```bash
# Create incident record
./scripts/declare-incident.sh \
  --severity critical \
  --component "dispatch-api" \
  --description "Primary dispatch API unresponsive" \
  --incident-commander "john.doe"

# This generates: /tmp/incident-YYYYMMDD-HHMMSS.txt
# Notify team: Post to #ambulance-dispatch-incidents Slack
```

#### Step 1.3: Assess Impact
```bash
# Check active dispatch operations
curl -s http://localhost:3000/api/dispatch/active-incidents | jq '.count'

# Check current ambulance status
curl -s http://localhost:3000/api/ambulance/status | jq '.summary'

# Estimate data loss
echo "Last backup: $(ls -l /backups/db | tail -1 | awk '{print $6,$7,$8}')"
echo "Minutes since backup: $(($(date +%s) - $(stat /backups/db/*.gz | tail -1 | grep Modify | awk '{print $NF}'))  / 60)"
```

### Phase 2: Initial Response

#### Step 2.1: Establish War Room
```bash
# Start incident war room on Zoom
zoom-cli start-meeting --topic "Ambulance Dispatch Incident" \
  --duration 120 \
  --include-recording

# Post link to: #ambulance-dispatch-incidents
```

#### Step 2.2: Triage Decision
```bash
# Run triage decision tree

if [ primary_completely_down ]; then
  echo "→ Proceed to AUTOMATIC FAILOVER (Step 2.3)"
elif [ primary_degraded ]; then
  echo "→ Proceed to MONITOR & STABILIZE (Step 2.4)"
elif [ regional_issue ]; then
  echo "→ Proceed to REGIONAL ISOLATION (Step 2.5)"
else
  echo "→ Proceed to NORMAL TROUBLESHOOTING"
fi
```

#### Step 2.3: Automatic Failover (if triggered)
```bash
# System should automatically failover, but if manual intervention needed:

# 1. Verify secondary is healthy
curl -s http://dispatch-secondary.ambulance-dispatch.local/health | jq '.status'

# 2. Trigger manual failover
curl -X POST http://localhost:8080/failover/trigger \
  -H "Content-Type: application/json" \
  -d '{"reason": "primary_unreachable"}'

# 3. Verify active region switched
curl -s http://localhost:8080/status | jq '.currentActive'

# 4. Monitor traffic switch
watch -n 2 'curl -s http://localhost:8080/status | jq .'
```

#### Step 2.4: Monitor & Stabilize
```bash
# If degraded, stabilization before failover:

# 1. Check resource constraints
top -b -n 1 | head -20
iostat -x 1 5

# 2. Check connection pool status
psql -U dispatch_user ambulance_db -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Review recent errors
tail -50 /var/log/dispatch/error.log

# 4. Identify blocking processes
lsof -i :3000
lsof -i :5432
```

#### Step 2.5: Regional Isolation
```bash
# If primary region network partition detected:

# 1. Isolate primary region
iptables -A INPUT -s 10.0.1.0/24 -j DROP
iptables -A OUTPUT -d 10.0.1.0/24 -j DROP

# 2. Verify secondary is active
watch -n 1 'curl -s http://localhost:8080/status'

# 3. Block DNS resolution to primary
cat >> /etc/hosts << EOF
# Blocked during incident
# 10.0.1.10 dispatch-primary.ambulance-dispatch.local
EOF

# 4. Monitor secondary load
vmstat 2 10
```

---

## Recovery Procedures

### Database Recovery

#### Scenario A: Minor Database Corruption

```bash
# 1. Verify issue
psql -U dispatch_user ambulance_db -c "\dt" > /tmp/tables-before.txt

# 2. Run integrity check
psql -U dispatch_user ambulance_db << SQL
REINDEX DATABASE ambulance_db;
VACUUM ANALYZE;
PRAGMA integrity_check;
SQL

# 3. If still corrupted, restore from backup
./scripts/restore-database.sh \
  --backup /backups/db/ambulance_db_20240101_020000.sql.gz \
  --target-time "2024-01-01 01:50:00" \
  --verify

# 4. Verify restore
psql -U dispatch_user ambulance_db -c "SELECT COUNT(*) FROM dispatches;"
psql -U dispatch_user ambulance_db -c "SELECT COUNT(*) FROM ambulances;"
```

#### Scenario B: Complete Database Loss

```bash
# 1. Prepare isolated restore environment
docker run -d \
  --name recovery-db \
  -e POSTGRES_PASSWORD=$DB_PASSWORD \
  -e POSTGRES_USER=dispatch_user \
  postgres:13

sleep 10

# 2. Restore from backup
docker exec recovery-db bash << 'BASH'
zcat /backups/db/ambulance_db_20240101_020000.sql.gz | \
  psql -U dispatch_user ambulance_db
BASH

# 3. Run integrity checks
docker exec recovery-db psql -U dispatch_user ambulance_db << SQL
-- Verify tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verify row counts
SELECT COUNT(*) FROM dispatches;
SELECT COUNT(*) FROM ambulances;
SELECT COUNT(*) FROM hospitals;

-- Verify foreign keys
SELECT constraint_name FROM information_schema.table_constraints 
  WHERE constraint_type = 'FOREIGN KEY';
SQL

# 4. Promote recovery database as primary
docker stop postgres-primary
docker rename recovery-db postgres-primary
docker start postgres-primary

# 5. Verify application connectivity
curl -s http://localhost:3000/health | jq '.database'
```

#### Scenario C: Transaction Log Recovery

```bash
# 1. Enable WAL archiving if disabled
psql -U dispatch_user ambulance_db << SQL
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /backups/wal/%f';
SELECT pg_reload_conf();
SQL

# 2. List available WAL files
ls -la /backups/wal/ | tail -20

# 3. Recover to point in time
./scripts/point-in-time-recovery.sh \
  --backup-file /backups/db/ambulance_db_20240101_020000.sql.gz \
  --recovery-target-time "2024-01-01 03:30:00" \
  --wal-directory /backups/wal

# 4. Verify recovery
psql -U dispatch_user ambulance_db -c "SELECT max(timestamp) FROM audit_log;"
```

### Application Recovery

#### Scenario A: Dispatch API Service Failure

```bash
# 1. Check service status
systemctl status ambulance-dispatch
docker ps -a | grep dispatch-service

# 2. Check logs for errors
tail -100 /var/log/dispatch/app.log | grep ERROR

# 3. Restart service
systemctl restart ambulance-dispatch
# OR
docker restart dispatch-service-primary

# 4. Verify startup
sleep 10
curl -s http://localhost:3000/health | jq '.status'

# 5. Check integration
curl -s http://localhost:3000/api/dispatch/status | jq '..'
```

#### Scenario B: Container Image Corruption

```bash
# 1. Stop current container
docker stop dispatch-service-primary

# 2. Pull latest image
docker pull ambulance-dispatch/dispatch-service:latest

# 3. Remove corrupted image
docker image rm ambulance-dispatch/dispatch-service:corrupted

# 4. Start new container
docker run -d \
  --name dispatch-service-primary \
  --restart always \
  -p 3000:3000 \
  -e DATABASE_HOST=postgres-primary \
  ambulance-dispatch/dispatch-service:latest

# 5. Verify
sleep 10
curl -s http://localhost:3000/health
```

#### Scenario C: Memory Leak / Resource Exhaustion

```bash
# 1. Identify resource hog
top -b -n 1 | head -15
ps aux --sort=-%mem | head -10

# 2. Graceful restart
./scripts/rolling-restart.sh \
  --service dispatch-service \
  --delay 30 \
  --health-check-url "http://localhost:3000/health"

# 3. Monitor during restart
watch -n 2 'docker stats --no-stream dispatch-service-primary'

# 4. Verify all healthy
curl -s http://localhost:8080/status | jq '.healthStatus'
```

### Network Recovery

#### Scenario A: DNS Resolution Failure

```bash
# 1. Verify DNS
nslookup dispatch.ambulance-dispatch.local
dig +short dispatch.ambulance-dispatch.local

# 2. Check resolv.conf
cat /etc/resolv.conf

# 3. Restart DNS service
systemctl restart systemd-resolved

# 4. Flush DNS cache
systemctl restart nscd
resolvectl flush-caches

# 5. Re-verify
nslookup dispatch.ambulance-dispatch.local
```

#### Scenario B: Network Partition

```bash
# 1. Ping primary region
ping -c 3 dispatch-primary.ambulance-dispatch.local
mtr -r -c 10 dispatch-primary.ambulance-dispatch.local

# 2. Check network routes
ip route
netstat -rn

# 3. Verify firewall rules
iptables -L -v | grep -E "ambulance|10.0"

# 4. If partition detected, isolate
iptables -A OUTPUT -d 10.0.1.0/24 -j DROP

# 5. Switch to secondary
curl -X POST http://localhost:8080/failover/trigger \
  -d '{"reason": "network_partition"}'

# 6. Verify secondary active
curl -s http://localhost:8080/status | jq '.currentActive'
```

### Configuration Recovery

#### Scenario A: Configuration File Corruption

```bash
# 1. Restore from backup
./scripts/restore-config.sh \
  --component "dispatch-service" \
  --backup-date "2024-01-01 02:00:00" \
  --verify

# 2. Verify config syntax
docker exec dispatch-service-primary \
  node -c /etc/dispatch/config.js

# 3. Apply config
docker exec dispatch-service-primary \
  kill -HUP 1

# 4. Verify service health
sleep 5
curl -s http://localhost:3000/health
```

#### Scenario B: Lost Credentials

```bash
# 1. Retrieve from secure vault
vault kv get secret/ambulance-dispatch/db-password
vault kv get secret/ambulance-dispatch/api-keys

# 2. Inject into environment
export DB_PASSWORD=$(vault kv get -field=password secret/ambulance-dispatch/db)
export API_KEYS=$(vault kv get -field=keys secret/ambulance-dispatch/api)

# 3. Restart affected services
docker restart dispatch-service-primary

# 4. Verify connectivity
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:3000/health
```

---

## Verification Steps

### Comprehensive System Check

```bash
#!/bin/bash
# Complete verification script

echo "=== AMBULANCE DISPATCH RECOVERY VERIFICATION ==="
echo "Time: $(date)"
echo ""

# 1. Network Connectivity
echo "[1] Network Connectivity:"
ping -c 1 dispatch-primary.ambulance-dispatch.local && echo "  ✓ Primary reachable" || echo "  ✗ Primary unreachable"
ping -c 1 dispatch-secondary.ambulance-dispatch.local && echo "  ✓ Secondary reachable" || echo "  ✗ Secondary unreachable"
echo ""

# 2. Service Health
echo "[2] Service Health:"
curl -s http://localhost:3000/health | jq '.status' && echo "  ✓ API healthy" || echo "  ✗ API unhealthy"
curl -s http://localhost:8080/status | jq '.currentActive' && echo "  ✓ Failover controller healthy" || echo "  ✗ Failover controller unhealthy"
echo ""

# 3. Database Health
echo "[3] Database Health:"
psql -U dispatch_user ambulance_db -c "SELECT 'healthy' AS status;" && echo "  ✓ Database connected" || echo "  ✗ Database connection failed"
psql -U dispatch_user ambulance_db -c "SELECT COUNT(*) FROM dispatches;" && echo "  ✓ Dispatch table exists" || echo "  ✗ Dispatch table missing"
echo ""

# 4. Cache Health
echo "[4] Cache Health:"
redis-cli ping && echo "  ✓ Redis responsive" || echo "  ✗ Redis unresponsive"
redis-cli --info stats | grep connected_clients && echo "  ✓ Cache clients connected" || echo "  ✗ No cache clients"
echo ""

# 5. Message Queue Health
echo "[5] Message Queue Health:"
curl -s -u guest:guest http://localhost:15672/api/vhosts | jq '.[] | .name' && echo "  ✓ RabbitMQ responsive" || echo "  ✗ RabbitMQ unresponsive"
echo ""

# 6. Backup Status
echo "[6] Backup Status:"
ls -la /backups/db | tail -1 && echo "  ✓ Recent backup exists" || echo "  ✗ No backups found"
sha256sum -c /backups/db/checksums.txt > /dev/null 2>&1 && echo "  ✓ Backup integrity verified" || echo "  ✗ Backup integrity check failed"
echo ""

# 7. Disk Space
echo "[7] Disk Space:"
df -h / | tail -1 | awk '{print "  Root: " $5 " used, " $4 " free"}'
df -h /backups | tail -1 | awk '{print "  Backups: " $5 " used, " $4 " free"}'
echo ""

# 8. Active Ambulances
echo "[8] Active Ambulances:"
curl -s http://localhost:3000/api/ambulance/active-count | jq '.' && echo "" || echo "  Error querying ambulances"
echo ""

# 9. Recent Dispatch Incidents
echo "[9] Recent Dispatch Incidents:"
curl -s http://localhost:3000/api/dispatch/recent-count | jq '.' && echo "" || echo "  Error querying incidents"
echo ""

echo "=== VERIFICATION COMPLETE ==="
```

### Data Integrity Checks

```sql
-- Run in psql to verify data integrity

-- Check for orphaned records
SELECT 'Orphaned dispatch_events' AS check_name,
  COUNT(*) AS count
FROM dispatch_events de
WHERE NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.id = de.dispatch_id);

-- Check for inconsistent ambulance states
SELECT 'Inconsistent ambulance_states' AS check_name,
  COUNT(*) AS count
FROM ambulances
WHERE status NOT IN ('available', 'assigned', 'responding', 'at_location', 'transporting', 'at_hospital', 'out_of_service');

-- Check for pending transactions
SELECT 'Pending transactions' AS check_name,
  COUNT(*) AS count
FROM dispatches
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';

-- Verify key counts
SELECT 'Table Records Count' AS check_type,
  'dispatches' AS table_name, COUNT(*) AS record_count FROM dispatches
UNION ALL
SELECT 'Table Records Count', 'ambulances', COUNT(*) FROM ambulances
UNION ALL
SELECT 'Table Records Count', 'hospitals', COUNT(*) FROM hospitals
UNION ALL
SELECT 'Table Records Count', 'personnel', COUNT(*) FROM personnel;
```

---

## Post-Incident Actions

### Phase 1: Immediate (0-2 hours)

#### 1.1 Declare All-Clear
```bash
# 1. Get final verification
./scripts/comprehensive-verification.sh

# 2. Document resolution time
echo "Incident resolved at: $(date)" >> /var/log/incidents/recovery-events.log

# 3. Notify all teams
./scripts/notify-all-clear.sh \
  --slack-channel "#ambulance-dispatch-incidents" \
  --email-recipients "ops-team@ambulance-dispatch.local"

# 4. Update status page
curl -X POST https://status.ambulance-dispatch.local/api/incidents/resolve \
  -H "Authorization: Bearer $STATUS_PAGE_TOKEN" \
  -d '{"incident_id": "'$INCIDENT_ID'"}'
```

#### 1.2 Assess System State
```bash
# 1. Backup current state (for forensics)
./scripts/backup-incident-state.sh --incident-id $INCIDENT_ID

# 2. Check for any cascading issues
curl -s http://localhost:8080/status | jq '.healthStatus'

# 3. Monitor system for next 30 minutes
watch -n 10 'curl -s http://localhost:3000/health'
```

### Phase 2: Short-term (2-24 hours)

#### 2.1 Conduct Incident Review
```bash
# 1. Gather all logs
./scripts/collect-incident-logs.sh \
  --incident-id $INCIDENT_ID \
  --start-time "01:00" \
  --end-time "05:00" \
  --output /tmp/incident-logs-$INCIDENT_ID.tar.gz

# 2. Document timeline
cat > /tmp/incident-timeline-$INCIDENT_ID.md << EOF
# Incident Timeline

## Detection: $(date)
## Initial Response: 
## Failover: 
## Recovery: 
## All-Clear: 

## Summary:

## Root Cause:

## Resolution:

## Impact:
- Dispatch unavailable for X minutes
- X active incidents affected
- X ambulances impacted
EOF

# 3. Review with team
zoom-cli schedule-meeting \
  --topic "Incident Post-Mortem: $INCIDENT_ID" \
  --start-time "2024-01-02 10:00 UTC" \
  --send-invites-to incidents@ambulance-dispatch.local
```

#### 2.2 Identify Root Cause
```bash
# Review incident logs for root cause
grep -i "error\|fail\|timeout" /var/log/dispatch/*.log | \
  grep -B5 -A5 "$(date -d '1 hour ago' '+%H:%M')" > /tmp/error-context.txt

# Check system metrics during incident
cat /var/log/sysstat/sa$(date +%d) | \
  sar -f - -s 01:00:00 -e 05:00:00 > /tmp/metrics-during-incident.txt

# Analyze with team
cat /tmp/error-context.txt | head -50
```

### Phase 3: Medium-term (1-7 days)

#### 3.1 Create Incident Report
```markdown
# Incident Report: [INCIDENT-ID]

## Executive Summary
- Incident Duration: X min
- Systems Affected: dispatch-api, database
- Customer Impact: dispatch-center temporarily offline
- Severity: Critical

## Detailed Timeline
[Minute-by-minute breakdown]

## Root Cause Analysis
[Technical details]

## Contributing Factors
- [Factor 1]
- [Factor 2]

## Actions Taken
1. Automatic failover triggered
2. Secondary region activated
3. Database recovered from backup

## Corrective Actions
- [ ] Increase monitoring thresholds
- [ ] Add redundancy to component X
- [ ] Update runbook procedures
- [ ] Training for team on procedure Y

## Lessons Learned
[Key takeaways]
```

#### 3.2 Implement Corrective Actions
```bash
# Create tickets for each corrective action
for action in "Increase monitoring" "Add redundancy" "Update runbooks"; do
  jira create-issue \
    --project INFRA \
    --type Task \
    --summary "Post-Incident: $action - Incident $INCIDENT_ID" \
    --priority High \
    --assignee infrastructure-team \
    --description "Corrective action from incident post-mortem"
done

# Track progress
jira search "project=INFRA AND summary ~ 'Post-Incident'" --output-format table
```

### Phase 4: Long-term (1-4 weeks)

#### 4.1 Preventive Improvements
```bash
# 1. Review metrics and alerts
./scripts/analyze-incident-metrics.sh \
  --incident-id $INCIDENT_ID \
  --output-file /tmp/metrics-analysis.html

# 2. Improve monitoring
# Example: Add alert for database connection pool exhaustion
cat > /tmp/new-alert-rule.yaml << 'EOF'
- alert: HighDatabaseConnections
  expr: pg_stat_activity_count > 90
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High database connection count"
EOF

# 3. Update runbooks based on learnings
git -C /docs/runbooks checkout -b "improve-recovery-proc-$INCIDENT_ID"
# ... make updates ...
git -C /docs/runbooks commit -am "Improve recovery procedures based on $INCIDENT_ID"
git -C /docs/runbooks push origin "improve-recovery-proc-$INCIDENT_ID"

# 4. Schedule follow-up training
echo "DR Training scheduled for: $(date -d '+2 weeks' '+%Y-%m-%d 14:00 UTC')"
```

#### 4.2 Scheduled Recovery Drill
```bash
# Schedule full DR test in 30 days
./scripts/schedule-recovery-test.sh \
  --date "$(date -d '+30 days' '+%Y-%m-%d')" \
  --time "14:00 UTC" \
  --test-type full \
  --team-lead "john.doe" \
  --observers "mary.smith,bob.jones"

# Send advance notice
mail -s "Upcoming DR Test - Scheduled for $(date -d '+30 days' '+%Y-%m-%d')" \
  dispatch-team@ambulance-dispatch.local << 'EOF'
This is to notify you of an upcoming Disaster Recovery test.

Date: $(date -d '+30 days' '+%Y-%m-%d')
Time: 14:00 UTC
Duration: ~2 hours
Location: War room + Zoom

This test will involve:
- Simulating primary region failure
- Testing automatic failover
- Verifying recovery procedures
- Validating data integrity

No impact to production dispatch operations expected.
EOF
```

---

## Emergency Escalation

### If Standard Recovery Fails

```bash
# 1. Activate emergency protocol
export EMERGENCY_MODE=true
export INCIDENT_SEVERITY=critical
echo "EMERGENCY MODE ACTIVATED - $(date)" | tee -a /var/log/incidents/emergency.log

# 2. Immediately notify C-level
./scripts/notify-executive-escalation.sh \
  --severity critical \
  --reason "Standard recovery procedures exhausted"

# 3. Contact cloud provider if infrastructure issue
aws support create-case \
  --service-code general-guidance \
  --severity-code urgent \
  --subject "CRITICAL: Ambulance dispatch system non-recoverable"

# 4. Manual intervention request
echo "MANUAL INTERVENTION REQUIRED" | wall
echo "Expert assessment needed. Contact: db-expert@ambulance-dispatch.local"

# 5. Begin forensic analysis
./scripts/begin-forensic-analysis.sh \
  --output-directory /forensics/incident-$INCIDENT_ID \
  --preserve-state true
```

---

## Contact & Escalation

**For questions or updates to this playbook:**
- Submit PR to: https://github.com/ambulance-dispatch/runbooks
- Contact: infrastructure@ambulance-dispatch.local
- Last verified: 2024-01-15 by Infrastructure Team

---

*This playbook is maintained by the Infrastructure Team and reviewed quarterly. Recommendations for improvements are welcome.*
