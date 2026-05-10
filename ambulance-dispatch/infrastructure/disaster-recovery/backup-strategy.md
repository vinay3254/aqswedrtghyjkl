# Backup Strategy - Ambulance Dispatch System

## Overview
Comprehensive backup and recovery strategy to ensure business continuity for the ambulance dispatch system. Focuses on database, configurations, and critical data protection.

## Backup Schedule

### Database Backups
- **Full Backup**: Daily at 2:00 AM UTC
- **Incremental Backup**: Every 6 hours
- **Transaction Log Backup**: Every 15 minutes
- **Retention Policy**: 
  - Daily backups: 7 days
  - Weekly backups: 4 weeks
  - Monthly backups: 12 months

### Configuration Backups
- **Frequency**: Every 6 hours (or on change)
- **Retention**: 30 days
- **Storage**: Version-controlled git repository

## Database Backup Procedures

### PostgreSQL Backups
```bash
# Full backup using pg_dump
pg_dump -U dispatch_user -h localhost ambulance_db > \
  /backups/db/ambulance_db_$(date +%Y%m%d_%H%M%S).sql.gz

# Continuous WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'
```

### Backup Locations
1. **Primary Storage**: Network-attached storage (NAS)
   - Path: `/mnt/backups/primary`
   - Capacity: 2TB
   - Replication: Real-time sync

2. **Secondary Storage**: Cloud backup
   - Provider: AWS S3 / Azure Blob Storage
   - Bucket: `ambulance-dispatch-backups`
   - Replication: Cross-region

3. **Tertiary Storage**: Offline archive
   - Location: Secure vault
   - Media: External hard drive
   - Update frequency: Weekly

## Configuration Backups

### System Configurations
```yaml
backup_targets:
  - /etc/docker/
  - /etc/kubernetes/
  - /etc/nginx/
  - /var/www/config/
  - ~/.ssh/authorized_keys
  - /etc/ssl/certs/
```

### Application Configurations
```yaml
app_configs:
  - docker-compose.yml
  - kubernetes/manifests/
  - .env files (encrypted)
  - Database connection strings
  - API keys (encrypted vault)
  - SSL/TLS certificates
```

### Backup Method
```bash
#!/bin/bash
# Automated configuration backup
BACKUP_DIR="/backups/config/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup system configs
tar -czf "$BACKUP_DIR/system-config.tar.gz" \
  /etc/docker /etc/kubernetes /etc/nginx

# Backup application configs
tar -czf "$BACKUP_DIR/app-config.tar.gz" \
  docker-compose.yml kubernetes/ configs/

# Upload to cloud
aws s3 cp "$BACKUP_DIR" s3://ambulance-backups/ --recursive

# Verify backup integrity
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/checksums.txt"
```

## Data Protection

### Encryption
- **At Rest**: AES-256 encryption for all backups
- **In Transit**: TLS 1.2+ for backup transfers
- **Key Management**: AWS KMS / Azure Key Vault

### Access Control
- **Backup Server**: Limited to backup service account
- **Restore Operations**: Require 2-person approval
- **Audit Logging**: All backup/restore operations logged

## Backup Testing

### Recovery Testing Schedule
- **Monthly**: Full database restoration test
- **Weekly**: Configuration restore verification
- **After Major Changes**: Immediate backup test

### Test Procedures
```bash
#!/bin/bash
# Test restore on isolated environment
docker run -d --name test-db postgres:13
pg_restore -U test_user -d ambulance_test < /backups/db/latest.sql
psql -U test_user -d ambulance_test -c "SELECT COUNT(*) FROM dispatches;"
docker stop test-db && docker rm test-db
```

### Success Criteria
- [ ] Database restore completes without errors
- [ ] All tables present with correct row counts
- [ ] Foreign key constraints valid
- [ ] Indexes rebuild successfully
- [ ] Application can connect and query
- [ ] Data integrity checks pass

## Backup Metrics

### Monitoring
```yaml
metrics:
  backup_duration: < 30 minutes
  backup_size: Database size + 10%
  restore_time: < 45 minutes
  data_loss_potential: < 15 minutes
  recovery_point_objective: 15 minutes
  recovery_time_objective: 45 minutes
```

### Alerting
- Backup failure notification: Immediate email/Slack
- Backup duration exceeded: Alert after 45 minutes
- Storage capacity warning: At 80% capacity
- Restore test failures: Immediate escalation

## Disaster Recovery Procedures

### Database Recovery Priority
1. **Critical Systems** (0-5 minutes)
   - Dispatch center operations
   - Real-time location tracking
   - Alert systems

2. **High Priority** (5-15 minutes)
   - Patient records
   - Ambulance assignments
   - Hospital bed availability

3. **Standard Priority** (15-60 minutes)
   - Historical records
   - Analytics data
   - Audit logs

### Recovery Point Objective (RPO)
- **Target**: 15 minutes maximum data loss
- **Actual**: Transaction log backups every 15 minutes

### Recovery Time Objective (RTO)
- **Target**: 45 minutes to full recovery
- **Actual**: Measured from backup test results

## Compliance

### Regulatory Requirements
- **HIPAA**: Patient data encryption and audit trails
- **GDPR**: Data retention policies and deletion procedures
- **State EMS Requirements**: Backup availability proof

### Documentation
- Annual backup procedure review
- Quarterly testing and validation
- Incident report on all recoveries

## Backup Infrastructure

### Backup Server Specifications
```yaml
backup_server:
  cpu: 8 vCPU (Intel Xeon or equivalent)
  memory: 32 GB RAM
  storage: 4TB SSD (backup cache)
  network: 1 Gbps minimum
  availability: N+1 redundancy
```

### Network Requirements
- Dedicated backup network segment
- 1 Gbps minimum bandwidth
- Isolated from production traffic
- Firewall rules for backup traffic only

## Backup Software Stack

- **Database Backups**: PostgreSQL native tools + Barman
- **File Backups**: Bacula or Duplicati
- **Cloud Sync**: AWS DataSync or Azure Backup
- **Monitoring**: Grafana + Prometheus
- **Automation**: Ansible playbooks

## Emergency Contact

**Backup Operations Team**
- Primary: infrastructure@ambulance-dispatch.local
- Escalation: operations-manager@ambulance-dispatch.local
- 24/7 Hotline: Available in operations manual

---
*Last Updated: 2024-01*
*Next Review: 2024-04*
