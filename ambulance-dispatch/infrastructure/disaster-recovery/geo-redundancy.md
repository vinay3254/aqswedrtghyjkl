# Geo-Redundancy & Multi-Region Deployment Strategy
## Ambulance Dispatch System

**Last Updated:** 2024-01  
**Classification:** Technical - Strategic  
**Review Period:** Quarterly

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Region Selection & Setup](#region-selection--setup)
4. [Data Replication Strategy](#data-replication-strategy)
5. [Network Architecture](#network-architecture)
6. [Traffic Management](#traffic-management)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Operational Procedures](#operational-procedures)
9. [Cost Analysis](#cost-analysis)

---

## Overview

### Goals
- **Availability**: 99.99% uptime (52.6 minutes downtime per year)
- **Resilience**: Survive complete regional failure
- **Latency**: < 100ms response time globally
- **Data Consistency**: RPO < 15 minutes
- **Recovery Time**: RTO < 5 minutes

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Load Balancer                     │
│            (Route 53 / Azure Traffic Manager)               │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
        ┌──────▼──────┐            ┌──────▼──────┐
        │ Primary     │            │ Secondary   │
        │ Region      │            │ Region      │
        │ (us-east-1) │            │ (us-west-2) │
        │             │            │             │
        │ ┌─────────┐ │            │ ┌─────────┐ │
        │ │ Dispatch│ │            │ │ Dispatch│ │
        │ │ API (3) │ │            │ │ API (3) │ │
        │ ├─────────┤ │            │ ├─────────┤ │
        │ │ Database│ │◄──────────►│ │ Database│ │
        │ │ Master  │ │  Streaming │ │ Replica │ │
        │ ├─────────┤ │ Replication│ ├─────────┤ │
        │ │ Redis   │ │            │ │ Redis   │ │
        │ │ Primary │ │            │ │ Replica │ │
        │ ├─────────┤ │            │ ├─────────┤ │
        │ │ RabbitMQ│ │◄───Async──►│ │RabbitMQ │ │
        │ │ Primary │ │ Replication│ │ Replica │ │
        │ └─────────┘ │            │ └─────────┘ │
        │             │            │             │
        │ Multi-AZ    │            │ Multi-AZ    │
        │ (3 zones)   │            │ (3 zones)   │
        └─────────────┘            └─────────────┘
```

---

## Architecture Design

### Primary Region: US-East-1

#### Availability Zones
- us-east-1a (Primary)
- us-east-1b (Secondary)
- us-east-1c (Tertiary)

#### Resources per AZ
```yaml
Primary Region - us-east-1:
  Dispatch API:
    - Instances per AZ: 1 (minimum)
    - Total: 3 instances
    - Instance Type: t3.large (2 vCPU, 8GB RAM)
    - Container: Docker / Kubernetes
    
  Database Cluster:
    - Primary: us-east-1a (PostgreSQL 13)
    - Replica 1: us-east-1b (streaming replication)
    - Replica 2: us-east-1c (streaming replication)
    - Instance Type: db.r5.xlarge (4 vCPU, 32GB RAM)
    - Storage: 500GB gp3, encrypted
    
  Cache Layer:
    - Primary: us-east-1a (Redis 7)
    - Replica 1: us-east-1b
    - Replica 2: us-east-1c
    - Node Type: cache.r6g.large
    - Replication: Automatic multi-AZ
    
  Message Queue:
    - RabbitMQ Cluster (3 nodes)
    - 1 node per AZ
    - Node Type: t3.large
    - Storage: 100GB per node
    
  File Storage:
    - EFS (Elastic File System)
    - Encrypted at rest
    - Multi-AZ replication
    - Capacity: 1TB
    
  DNS & CDN:
    - Route 53 hosted zone
    - CloudFront distribution
    - WAF protection

  Network:
    - VPC: 10.0.0.0/16
      - Subnet AZ-a: 10.0.1.0/24
      - Subnet AZ-b: 10.0.2.0/24
      - Subnet AZ-c: 10.0.3.0/24
    - NAT Gateway: per AZ for HA
    - VPN/Direct Connect: redundant
```

### Secondary Region: US-West-2

#### Availability Zones
- us-west-2a (Primary)
- us-west-2b (Secondary)
- us-west-2c (Tertiary)

#### Resources per AZ
```yaml
Secondary Region - us-west-2:
  Dispatch API:
    - Instances per AZ: 1 (minimum)
    - Total: 3 instances
    - Instance Type: t3.large (2 vCPU, 8GB RAM)
    - Container: Docker / Kubernetes
    - Initial Status: Warm Standby (ready to accept traffic)
    
  Database Cluster:
    - Primary Replica: us-west-2a (PostgreSQL 13)
    - Secondary Replica 1: us-west-2b (streaming replication)
    - Secondary Replica 2: us-west-2c (streaming replication)
    - Instance Type: db.r5.xlarge (4 vCPU, 32GB RAM)
    - Replication from Primary: Cross-region streaming
    - Read-only until promotion
    
  Cache Layer:
    - Primary Replica: us-west-2a (Redis 7)
    - Secondary Replica 1: us-west-2b
    - Secondary Replica 2: us-west-2c
    - Node Type: cache.r6g.large
    - Replication: From primary region
    
  Message Queue:
    - RabbitMQ Cluster (3 nodes)
    - 1 node per AZ
    - Federated with primary region
    - Message buffering: 1 week retention
    
  File Storage:
    - S3 with cross-region replication
    - S3 Transfer Acceleration for faster uploads
    - Capacity: 1TB
    
  DNS & CDN:
    - Route 53 failover routing
    - CloudFront edge locations
    - WAF rules replicated

  Network:
    - VPC: 10.1.0.0/16
      - Subnet AZ-a: 10.1.1.0/24
      - Subnet AZ-b: 10.1.2.0/24
      - Subnet AZ-c: 10.1.3.0/24
    - Inter-region VPC peering: 10.0.0.0/16 ↔ 10.1.0.0/16
    - VPN backup link
```

---

## Region Selection & Setup

### Region Selection Criteria

| Criterion | US-East-1 (Primary) | US-West-2 (Secondary) |
|-----------|-----------------|-------------------|
| **Geographic Coverage** | Eastern US, Canada | Western US, Asia-Pacific |
| **Latency** | Baseline | +50-100ms for west coast |
| **Compliance** | HIPAA, GDPR ready | HIPAA, GDPR ready |
| **Provider Support** | AWS native | AWS native |
| **Cost** | Baseline | +5% premium |
| **Disaster Resistance** | Hurricane risk | Earthquake risk |
| **Network Bandwidth** | 10 Gbps+ | 10 Gbps+ |

### Setup Checklist

#### Phase 1: Infrastructure Provisioning (Week 1)

```bash
#!/bin/bash
# Terraform configuration for multi-region setup

# Variables
PRIMARY_REGION="us-east-1"
SECONDARY_REGION="us-west-2"
ENV="production"
PROJECT="ambulance-dispatch"

# 1. Create VPC and subnets
terraform apply -target=module.primary_region.aws_vpc.main
terraform apply -target=module.secondary_region.aws_vpc.main

# 2. Create security groups
terraform apply -target=module.security_groups

# 3. Create RDS databases
terraform apply -target=module.primary_database
terraform apply -target=module.secondary_database_replica

# 4. Create ElastiCache clusters
terraform apply -target=module.primary_cache
terraform apply -target=module.secondary_cache

# 5. Create message queues
terraform apply -target=module.primary_queue
terraform apply -target=module.secondary_queue

# 6. Configure replication
terraform apply -target=module.cross_region_replication

# 7. Set up load balancing
terraform apply -target=module.load_balancing

# Verify setup
terraform show -json | jq '.values.outputs'
```

#### Phase 2: Application Deployment (Week 2)

```bash
# 1. Deploy Kubernetes clusters
eksctl create cluster \
  --name ambulance-dispatch-primary \
  --region us-east-1 \
  --nodes 6 \
  --node-type t3.large

eksctl create cluster \
  --name ambulance-dispatch-secondary \
  --region us-west-2 \
  --nodes 6 \
  --node-type t3.large

# 2. Deploy applications
kubectl apply -f k8s/dispatch-service.yaml \
  --context ambulance-dispatch-primary

kubectl apply -f k8s/dispatch-service.yaml \
  --context ambulance-dispatch-secondary

# 3. Deploy data stores
helm install postgres-primary bitnami/postgresql \
  -f values/primary-postgres.yaml \
  --kube-context ambulance-dispatch-primary

helm install redis-primary bitnami/redis \
  -f values/primary-redis.yaml \
  --kube-context ambulance-dispatch-primary

# 4. Configure replication
./scripts/setup-replication.sh \
  --primary-region us-east-1 \
  --secondary-region us-west-2
```

#### Phase 3: Network Configuration (Week 3)

```bash
# 1. Set up VPC peering
aws ec2 create-vpc-peering-connection \
  --vpc-id vpc-primary-us-east-1 \
  --peer-vpc-id vpc-secondary-us-west-2 \
  --peer-region us-west-2

# 2. Configure Route 53
aws route53 create-hosted-zone \
  --name ambulance-dispatch.com \
  --caller-reference "primary-$(date +%s)"

# 3. Create health checks
aws route53 create-health-check \
  --health-check-config IPAddress=10.0.1.10,Port=3000,Type=HTTP

# 4. Create failover routing policy
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456 \
  --change-batch file://failover-routing.json
```

---

## Data Replication Strategy

### Database Replication

#### PostgreSQL Streaming Replication

```yaml
# Primary Region Configuration
primary_config:
  # postgresql.conf
  wal_level: replica
  max_wal_senders: 10
  max_replication_slots: 10
  wal_keep_segments: 64
  archive_mode: on
  archive_command: 'aws s3 cp %p s3://ambulance-backup-us-east-1/wal/%f'
  archive_timeout: 60
  
  # Replication slots
  slot_primary_east_1b: |
    SELECT pg_create_physical_replication_slot('slot_east_1b');
  slot_primary_east_1c: |
    SELECT pg_create_physical_replication_slot('slot_east_1c');
  slot_secondary_west_2a: |
    SELECT pg_create_physical_replication_slot('slot_west_2a');

# Secondary Region (Read-Only Replicas)
secondary_config:
  # postgresql.conf
  standby_mode: 'on'
  primary_conninfo: 'user=replication password=<secret> host=primary-db-us-east-1.rds.amazonaws.com port=5432'
  recovery_target_timeline: 'latest'
  
  # Streaming replication to local replicas
  wal_level: replica
  max_wal_senders: 5
  max_replication_slots: 5

# Replication Monitoring
monitoring:
  - query: |
      SELECT 
        client_addr,
        state,
        write_lag,
        flush_lag,
        replay_lag
      FROM pg_stat_replication;
    interval: 30s
    alert_threshold: write_lag > 5s
```

#### Cross-Region Replication Architecture

```
┌─────────────────────────┐
│  Primary DB             │
│  (us-east-1a)           │
│  Master                 │
│                         │
│ ┌───────────────────┐   │
│ │ Write Operations  │   │
│ └────────┬──────────┘   │
└─────────┬────────────────┘
          │
          ├─► Streaming to east-1b (sync)
          ├─► Streaming to east-1c (async)
          └─► Streaming to west-2a (async)
              │
              ├─► WAL archiving to S3
              │
              ▼
          ┌──────────────────────┐
          │ Secondary DB Replica │
          │ (us-west-2a)         │
          │ Read-Only Standby    │
          │ Can promote in       │
          │ ~30 seconds          │
          │                      │
          │ ┌──────────────────┐ │
          │ │ Read Operations  │ │
          │ │ (if configured)  │ │
          │ └──────────────────┘ │
          │                      │
          │ ┌──────────────────┐ │
          │ │ Streaming to     │ │
          │ │ west-2b, west-2c │ │
          │ └──────────────────┘ │
          └──────────────────────┘
```

### Cache Layer Replication

#### Redis Replication Strategy

```yaml
# Primary Region - Master Configuration
redis_primary:
  mode: Cluster
  nodes_per_az: 1  # 3 total in primary region
  multi_az_enabled: true
  automatic_failover: true
  
  configuration:
    # replication.conf
    repl-diskless-sync: yes
    repl-diskless-sync-delay: 5
    repl-disable-tcp-nodelay: no
    
    # Persistence
    save: 900 1 300 10 60 10000
    bgsave_redis_call: background
    appendonly: yes
    appendfsync: everysec

# Secondary Region - Replica Configuration
redis_secondary:
  mode: Cluster
  nodes_per_az: 1  # 3 total in secondary region
  
  # Cross-region replication
  primary_endpoint: primary-redis-us-east-1.cache.amazonaws.com:6379
  replica_configuration:
    slaveof: <primary-endpoint>
    replica-read-only: yes
    replica-serve-stale-data: yes

# Replication Monitoring
redis_monitoring:
  - command: INFO replication
    interval: 30s
    metrics:
      - role
      - connected_slaves
      - master_repl_offset
      - slave_repl_offset
      - repl_backlog_first_byte_offset
```

### Message Queue Replication

#### RabbitMQ Federation & Clustering

```yaml
# RabbitMQ Clustering in Primary Region
primary_cluster:
  nodes:
    - rabbitmq-1.us-east-1a
    - rabbitmq-2.us-east-1b
    - rabbitmq-3.us-east-1c
  
  configuration:
    disk_free_limit: 2GB
    memory_high_watermark: 0.6
    queue_master_locator: min-masters
    
  queue_mirroring:
    pattern: ".*"
    definition: "all"
    ha_sync_batch_size: 5

# RabbitMQ Federation to Secondary Region
federation:
  upstream_rabbitmq_secondary:
    uri: amqp://user:password@rabbitmq-primary.us-west-2.internal
    max_hops: 1
    
  exchange_federation:
    pattern: "^(dispatch|ambulance|hospital)"
    upstream: rabbitmq_secondary
    
  queue_federation:
    pattern: "^(dispatch|ambulance|hospital)"
    upstream: rabbitmq_secondary
    consumer_tag: "fed-queue"

# Replication Behavior
replication_behavior:
  publish_to_primary: "Immediately available in primary"
  federated_to_secondary: "Asynchronous, <5s delay typical"
  failover_queue_rebinding: "Automatic"
  message_persistence: "Durable queues only"
  unacked_messages_on_failover: "Requeued to secondary"
```

---

## Network Architecture

### VPC Peering & Direct Connect

```yaml
# VPC Peering
vpc_peering:
  connection:
    requester_vpc: vpc-primary-us-east-1 (10.0.0.0/16)
    accepter_vpc: vpc-secondary-us-west-2 (10.1.0.0/16)
    status: active
    
  routes:
    primary_to_secondary:
      destination: 10.1.0.0/16
      target: pcx-primary-to-secondary
      
    secondary_to_primary:
      destination: 10.0.0.0/16
      target: pcx-secondary-to-primary

# AWS Direct Connect
direct_connect:
  connections:
    # Primary connection
    - name: ambulance-dispatch-primary
      location: AWS us-east-1
      speed: 10 Gbps
      bandwidth: 1-5 Gbps dedicated
      vlan: 101
      bgp_asn: 65001
      
    # Secondary connection
    - name: ambulance-dispatch-secondary
      location: AWS us-west-2
      speed: 10 Gbps
      bandwidth: 1-5 Gbps dedicated
      vlan: 102
      bgp_asn: 65002
      
    # Backup connection
    - name: ambulance-dispatch-backup
      location: AWS us-east-1
      speed: 1 Gbps
      bandwidth: 500 Mbps dedicated
      vlan: 103

# Network Performance
network_sla:
  inter_region_latency: < 30ms (us-east-1 to us-west-2)
  availability: 99.99%
  bandwidth_utilization: < 70% during peak
  packet_loss: < 0.001%
  jitter: < 5ms
```

### DNS & Traffic Routing

#### Route 53 Configuration

```yaml
# Primary Domain
hosted_zone:
  name: ambulance-dispatch.com
  type: public

# Health Checks
health_checks:
  # Primary region API
  primary_api_health_check:
    type: HTTPS
    ip_address: 10.0.1.10
    port: 443
    path: /health
    interval: 30s
    failure_threshold: 3
    measure_latency: true
    enable_sni: true
    
  # Secondary region API
  secondary_api_health_check:
    type: HTTPS
    ip_address: 10.1.1.10
    port: 443
    path: /health
    interval: 30s
    failure_threshold: 3
    measure_latency: true
    enable_sni: true

# Failover Routing Policy
routing_policies:
  # Primary routing
  dispatch_api_primary:
    name: api.ambulance-dispatch.com
    type: A
    alias_target: primary-lb-us-east-1.elb.amazonaws.com
    set_identifier: primary
    failover_routing_policy: PRIMARY
    health_check_id: primary_api_health_check
    ttl: 60
    
  # Secondary routing (failover)
  dispatch_api_secondary:
    name: api.ambulance-dispatch.com
    type: A
    alias_target: secondary-lb-us-west-2.elb.amazonaws.com
    set_identifier: secondary
    failover_routing_policy: SECONDARY
    health_check_id: secondary_api_health_check
    ttl: 60

# Geolocation Routing (optional, for optimization)
geolocation_routing:
  # East coast users
  eastern_region:
    location: United States, East
    routing_target: primary-us-east-1
    
  # West coast users
  western_region:
    location: United States, West
    routing_target: secondary-us-west-2
    
  # Default
  default_location:
    location: '*'
    routing_target: primary-us-east-1 (with failover to secondary)
```

---

## Traffic Management

### Load Balancing Strategy

```yaml
# Global Traffic Distribution
global_lb:
  provider: AWS Route 53
  algorithm: Failover + Latency-based routing
  
  # Primary region load distribution
  primary_elb:
    name: ambulance-dispatch-primary-alb
    type: Application Load Balancer
    scheme: internet-facing
    subnets:
      - us-east-1a: 10.0.1.0/24
      - us-east-1b: 10.0.2.0/24
      - us-east-1c: 10.0.3.0/24
    
    target_groups:
      dispatch_service_primary:
        port: 3000
        protocol: HTTP
        health_check:
          path: /health
          interval: 5s
          timeout: 2s
          healthy_threshold: 2
          unhealthy_threshold: 2
        targets:
          - dispatch-pod-1a
          - dispatch-pod-1b
          - dispatch-pod-1c
    
    listener:
      port: 443
      protocol: HTTPS
      certificate_arn: arn:aws:acm:us-east-1:...
      target_group: dispatch_service_primary
      rules:
        - path: /api/*
          target_group: dispatch_service_primary
        - path: /health*
          target_group: dispatch_service_primary
        - path: /metrics*
          target_group: dispatch_service_primary

  # Secondary region load distribution
  secondary_elb:
    name: ambulance-dispatch-secondary-alb
    type: Application Load Balancer
    scheme: internet-facing
    subnets:
      - us-west-2a: 10.1.1.0/24
      - us-west-2b: 10.1.2.0/24
      - us-west-2c: 10.1.3.0/24
    
    target_groups:
      dispatch_service_secondary:
        port: 3000
        protocol: HTTP
        health_check:
          path: /health
          interval: 5s
          timeout: 2s
          healthy_threshold: 2
          unhealthy_threshold: 2
        targets:
          - dispatch-pod-2a
          - dispatch-pod-2b
          - dispatch-pod-2c

# Session Affinity
session_management:
  method: cookie-based
  cookie_name: DISPATCH_SESSION
  cookie_ttl: 3600
  cross_region_sync: enabled
  session_store:
    primary: redis-primary-cluster
    secondary: redis-secondary-cluster
    backup: dynamodb-global-table

# Rate Limiting
rate_limiting:
  global:
    requests_per_second: 10000
    burst_size: 15000
  
  per_region:
    primary: 7000 req/s
    secondary: 5000 req/s
  
  per_client:
    standard: 100 req/s
    api_key: 1000 req/s
    premium: 5000 req/s
```

---

## Monitoring & Alerts

### Metrics Collection

```yaml
# Prometheus scrape configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: production
    region: multi-region

scrape_configs:
  # Primary region
  - job_name: 'ambulance-dispatch-primary'
    consul_sd_configs:
      - server: 'consul-primary.us-east-1.internal:8500'
    relabel_configs:
      - source_labels: [__meta_consul_dc]
        target_label: dc
      - source_labels: [__meta_consul_service]
        target_label: service
  
  # Secondary region
  - job_name: 'ambulance-dispatch-secondary'
    consul_sd_configs:
      - server: 'consul-secondary.us-west-2.internal:8500'
    relabel_configs:
      - source_labels: [__meta_consul_dc]
        target_label: dc
      - source_labels: [__meta_consul_service]
        target_label: service

# Key Metrics
metrics:
  # Application metrics
  http_requests_total:
    labels: [method, endpoint, region, status]
    
  http_request_duration_seconds:
    labels: [method, endpoint, region]
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
  
  # Replication metrics
  pg_replication_lag_bytes:
    labels: [region, replica]
    alert: > 100MB
  
  redis_replication_lag:
    labels: [region, replica]
    alert: > 1000ms
  
  # Failover metrics
  failover_events_total:
    labels: [reason, source, target]
  
  active_region:
    labels: [service]
    values: [0: primary, 1: secondary]

# Custom Metrics
dispatch_system:
  active_incidents:
    query: SELECT COUNT(*) FROM dispatches WHERE status='active'
    interval: 30s
  
  average_response_time:
    query: SELECT AVG(response_time) FROM metrics WHERE timestamp > now() - interval '5 minutes'
    interval: 1m
  
  ambulance_availability:
    query: SELECT COUNT(*) FILTER (WHERE available=true) / COUNT(*) FROM ambulances
    interval: 1m
```

### Alert Rules

```yaml
# Critical Alerts
alerts:
  - name: PrimaryRegionDown
    expr: up{job=~".*primary.*"} == 0
    for: 2m
    severity: critical
    action: trigger_failover
    notify: [pagerduty, ops_team, exec]
  
  - name: SecondaryRegionDown
    expr: up{job=~".*secondary.*"} == 0
    for: 5m
    severity: critical
    action: page_ops
    notify: [pagerduty, ops_team]
  
  - name: ReplicationLagCritical
    expr: pg_replication_lag_bytes > 500000000  # 500MB
    for: 5m
    severity: critical
    action: escalate
    notify: [pagerduty, dba_team]
  
  - name: DatabaseFailoverRequired
    expr: pg_stat_replication_count < 1
    for: 3m
    severity: critical
    action: promote_secondary
    notify: [pagerduty, dba_team, exec]

  # Warning Alerts
  - name: HighLatencyBetweenRegions
    expr: network_latency_ms{path=~"primary.*secondary"} > 100
    for: 10m
    severity: warning
    notify: [ops_team, network_team]
  
  - name: ReplicationLagWarning
    expr: pg_replication_lag_bytes > 100000000  # 100MB
    for: 5m
    severity: warning
    notify: [ops_team]
  
  - name: CacheReplicationDelayed
    expr: redis_replication_lag_seconds > 5
    for: 5m
    severity: warning
    notify: [ops_team]

# SLA Monitoring
sla:
  availability_9999:
    alert_threshold: 99.98%  # Alert if below
    window: 30d
    penalty: incident_review
  
  response_time_p99:
    alert_threshold: 500ms
    window: 5m
    penalty: alert_ops_team
  
  failover_rto:
    alert_threshold: 300s
    measurement: from_detection_to_active
    penalty: corrective_action
```

---

## Operational Procedures

### Failover Procedures

#### Automatic Failover (Recommended)

```bash
#!/bin/bash
# Automatic failover triggered by health checks

# 1. Health check detects primary failure
primary_health_check_failures=3

# 2. System evaluates failover criteria
if [ primary_failures >= $primary_health_check_failures ]; then
  if [ secondary_healthy == true ]; then
    
    # 3. Trigger failover
    echo "Initiating automatic failover..."
    
    # Update Route 53
    aws route53 change-resource-record-sets \
      --hosted-zone-id Z123456 \
      --change-batch '{
        "Changes": [{
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "api.ambulance-dispatch.com",
            "Type": "A",
            "SetIdentifier": "primary",
            "Failover": "SECONDARY",
            "TTL": 60,
            "AliasTarget": {
              "HostedZoneId": "Z35SXDOTRQ7X7K",
              "DNSName": "secondary-alb.us-west-2.amazonaws.com",
              "EvaluateTargetHealth": true
            }
          }
        }]
      }'
    
    # 4. Promote secondary database
    aws rds promote-read-replica \
      --db-instance-identifier ambulance-db-secondary
    
    # 5. Update application configuration
    kubectl patch cm dispatch-config \
      -p '{"data":{"ACTIVE_REGION":"secondary"}}'
    
    # 6. Notify all systems
    notify_teams "Failover to secondary region initiated"
    
    # 7. Monitor transition
    sleep 30
    verify_failover_complete
    
  else
    echo "ERROR: Primary down but secondary is also unhealthy!"
    escalate_to_manual_intervention
  fi
fi
```

#### Manual Failover

```bash
#!/bin/bash
# Manual failover when automatic process fails

set -e

INCIDENT_ID=$1
AUTHORIZED_USER=$2

# 1. Verify authorization
verify_authorization $AUTHORIZED_USER

# 2. Pre-flight checks
echo "Running pre-flight checks..."
check_secondary_health
check_data_consistency
check_network_connectivity
read -p "All checks passed. Proceed with failover? (yes/no): " confirm
[ "$confirm" = "yes" ] || exit 1

# 3. Notify stakeholders
notify_incident_channel "Manual failover initiating by $AUTHORIZED_USER"
notify_executive_team "Ambulance dispatch failover in progress"

# 4. Execute failover steps
echo "Step 1: Promoting secondary database..."
aws rds promote-read-replica \
  --db-instance-identifier ambulance-db-secondary \
  --backup-retention-period 7

# Wait for promotion
wait_for_database_promotion "ambulance-db-secondary" 300

echo "Step 2: Switching DNS..."
update_route53_failover "secondary"

echo "Step 3: Updating application config..."
kubectl set env deployment/dispatch-service \
  ACTIVE_REGION=secondary \
  --context ambulance-dispatch-secondary

echo "Step 4: Verifying traffic..."
sleep 30
verify_traffic_flow "secondary"

echo "Step 5: Monitoring failover..."
monitor_failover "secondary" 300  # Monitor for 5 minutes

# 6. Post-failover actions
echo "Failover complete!"
log_incident "$INCIDENT_ID" "Failover to secondary completed"
create_incident_report "$INCIDENT_ID"
notify_incident_channel "Failover complete. System operational in secondary region."
```

### Failback Procedures

```bash
#!/bin/bash
# Failback to primary after recovery

set -e

# 1. Verify primary region is healthy
echo "Verifying primary region health..."
health_check "primary" 5  # 5 successful checks required

# 2. Create backup in secondary before failback
echo "Creating backup in secondary..."
create_database_backup "secondary"

# 3. Resync primary from secondary
echo "Resyncing primary database..."
./scripts/resync-database.sh \
  --source secondary \
  --target primary \
  --method pg_rewind

# 4. Verify sync status
echo "Verifying data sync..."
verify_data_consistency "primary" "secondary"

# 5. Gradual traffic migration
echo "Initiating gradual failback..."
for percentage in 25 50 75 100; do
  echo "Routing $percentage% traffic to primary..."
  update_route53_weight "primary" $percentage
  sleep 300  # 5 minutes at each level
  
  # Monitor error rates
  if error_rate_exceeds_threshold; then
    echo "ERROR: High error rate detected, stopping failback"
    update_route53_weight "primary" 0
    exit 1
  fi
done

# 6. Complete failback
echo "Failback complete"
log_incident "Failback to primary completed"
notify_teams "System returned to primary region"
```

---

## Cost Analysis

### Monthly Cost Breakdown

```yaml
# US-East-1 (Primary)
primary_region_costs:
  compute:
    ec2_dispatch_api: 3 x t3.large x 730 hours = $45/month
    eks_control_plane: managed = $73/month
    nat_gateway: 3 x $32/month = $96/month
    subtotal: $214/month
  
  database:
    rds_postgres: db.r5.xlarge x 730 hours = $1,095/month
    rds_backup_storage: 500GB x $0.023 = $11.50/month
    rds_replication: cross-region x $0.02/GB = $25/month
    subtotal: $1,131.50/month
  
  cache:
    elasticache_redis: cache.r6g.large x 3 = $525/month
    subtotal: $525/month
  
  messaging:
    msk_kafka: 3 brokers x $0.185/hour = $405/month
    subtotal: $405/month
  
  storage:
    efs: 1TB x $0.30/GB-month = $300/month
    s3_storage: 500GB x $0.023 = $11.50/month
    s3_transfer_out: 1TB/month x $0.02 = $20/month
    subtotal: $331.50/month
  
  networking:
    data_transfer_inter_region: 500GB/month x $0.02 = $10/month
    direct_connect: 1x port hour = $730/month
    subtotal: $740/month
  
  monitoring:
    cloudwatch: logs + metrics = $50/month
    route53: hosted zone + queries = $25/month
    subtotal: $75/month
  
  primary_total: $3,421.50/month

# US-West-2 (Secondary)
secondary_region_costs:
  # Similar structure
  primary_total_secondary: $3,421.50/month
  
  # Secondary-specific charges
  cross_region_replication: $100/month
  additional_data_transfer: $50/month
  
  secondary_additional: $150/month

# Total Multi-Region Cost
total_monthly_cost:
  primary: $3,421.50
  secondary: $3,571.50
  total: $6,993.00
  
  # Cost optimization opportunities
  savings_reserved_instances: -$1,200/month (1-year commitment)
  savings_spot_instances: -$500/month (secondary region)
  savings_bulk_discount: -$200/month (AWS commitment)
  
  optimized_total: $5,093/month

# Cost per ambulance/dispatch center
# Assume 100 dispatch centers, 2,500 ambulances
cost_metrics:
  cost_per_dispatch_center: $50.93/month
  cost_per_ambulance: $2.04/month
  cost_per_dispatch: $0.002 (at 10M dispatches/month)
```

### ROI Analysis

```yaml
# Cost vs. Downtime Prevention
disaster_scenarios:
  # Scenario 1: 4-hour outage
  scenario_ambulance_down_4h:
    impact:
      ambulances_affected: 2500
      dispatch_unavailable: true
      estimated_lives_at_risk: 50-100 (based on response times)
      liability_exposure: $1M-5M
      regulatory_fines: $100K-500K
      customer_churn: 10-15%
      revenue_loss: $500K
      business_continuity_cost: $200K
    
    yearly_cost_single_outage: $1.8M
    
    # Probability
    mtbf_without_geo_redundancy: 2 years
    probability_per_year: 50%
    expected_loss_per_year: $900K
  
  # Scenario 2: Database corruption
  scenario_db_corruption:
    impact:
      data_loss: 24-48 hours
      dispatch_downtime: 2-6 hours
      estimated_cost: $300K-500K
    
    mtbf_without_geo_redundancy: 5 years
    probability_per_year: 20%
    expected_loss_per_year: $80K-100K

# ROI Calculation
roi_analysis:
  annual_geo_redundancy_cost: $6,993 x 12 = $83,916
  annual_expected_loss_prevented: $900K + $100K = $1,000,000
  net_benefit: $1,000,000 - $83,916 = $916,084
  roi_percentage: 1,091%
  payback_period: 1.1 months
  
  conclusion: "Geo-redundancy provides exceptional ROI for critical ambulance dispatch system"
```

---

## Disaster Recovery Testing

### Quarterly DR Test Schedule

```yaml
test_schedule:
  q1_january:
    test: "Database failover and recovery"
    scope: "PostgreSQL replication and promotion"
    impact: "Read-only replica test in secondary"
    duration: "2 hours"
    
  q2_april:
    test: "Full regional failover"
    scope: "Complete primary region unavailability"
    impact: "Secondary region absorbs 100% traffic"
    duration: "4 hours"
    cutover_window: "14:00-18:00 UTC"
    
  q3_july:
    test: "Message queue failover"
    scope: "RabbitMQ federation and message replay"
    impact: "Message processing continues to secondary"
    duration: "2 hours"
    
  q4_october:
    test: "Complete end-to-end failover"
    scope: "All systems, all regions, full traffic"
    impact: "Production-like conditions"
    duration: "6 hours"
    cutover_window: "01:00-07:00 UTC"

test_procedures:
  pre_test:
    - Notify all stakeholders
    - Take baseline metrics
    - Prepare rollback procedures
    - Brief incident response team
  
  during_test:
    - Monitor all metrics
    - Document any issues
    - Log all actions taken
    - Record response times
  
  post_test:
    - Verify all systems healthy
    - Collect test artifacts
    - Document lessons learned
    - Update runbooks
    - Publish test report
```

---

**Document Owners:** Infrastructure Team  
**Last Reviewed:** 2024-01-15  
**Next Review:** 2024-04-15
