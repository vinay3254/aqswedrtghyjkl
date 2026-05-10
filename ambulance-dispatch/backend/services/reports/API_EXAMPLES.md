# API Reference - Example Requests & Responses

## Sample Data File (incident-data.json)

Save this as `incident-data.json` for quick testing:

```json
{
  "incidentId": "INC-002",
  "callNumber": "CALL-20240115-002",
  "caseNumber": "CASE-20240115-002",
  "incidentType": "MEDICAL",
  "severity": "HIGH",
  "description": "Patient with severe allergic reaction",
  "generatedBy": "Field Paramedic",
  "location": {
    "address": "789 Oak Street, Suite 200",
    "coordinates": {
      "latitude": -1.2945,
      "longitude": 36.8245
    },
    "district": "Lavington",
    "region": "Nairobi",
    "landmark": "Near Lavington Shopping Centre",
    "accessNotes": "Building entrance on Oak Street, security available"
  },
  "patient": {
    "firstName": "Sarah",
    "lastName": "Williams",
    "age": "34",
    "gender": "Female",
    "phoneNumber": "+254788765432",
    "idNumber": "98765432",
    "allergies": ["Peanuts", "Shellfish"],
    "medicalHistory": ["Asthma"],
    "chronicConditions": []
  },
  "ambulance": {
    "ambulanceId": "AMB-003",
    "registrationPlate": "KDN 503P",
    "baseStation": "Lavington Station",
    "crewSize": 2,
    "crew": [
      {
        "name": "John Mwangi",
        "role": "Paramedic",
        "licenseNumber": "PAR-2024-003",
        "yearsExperience": 7
      },
      {
        "name": "Grace Kipchoge",
        "role": "Paramedic",
        "licenseNumber": "PAR-2024-004",
        "yearsExperience": 3
      }
    ]
  },
  "paramedic": {
    "assessment": {
      "primaryComplaint": "Severe allergic reaction to seafood",
      "secondaryComplaints": ["Facial swelling", "Difficulty breathing", "Itching"],
      "consciousness": "Alert and oriented",
      "breathing": "Labored, with wheezing",
      "circulation": "Rapid pulse",
      "skinColor": "Flushed with urticaria"
    },
    "vitals": {
      "bloodPressure": "145/88",
      "heartRate": 115,
      "respirationRate": 26,
      "temperature": "36.9°C",
      "spO2": "96%",
      "glucoseLevel": ""
    },
    "actions": [
      {
        "action": "ASSESSMENT",
        "description": "Allergic reaction assessment performed",
        "outcome": "COMPLETED"
      },
      {
        "action": "EPINEPHRINE_INJECTION",
        "description": "0.3mg IM epinephrine administered",
        "outcome": "COMPLETED"
      },
      {
        "action": "IV_ESTABLISHED",
        "description": "18G IV for medication access",
        "outcome": "COMPLETED"
      },
      {
        "action": "ANTIHISTAMINE",
        "description": "25mg diphenhydramine IV administered",
        "outcome": "COMPLETED"
      }
    ],
    "medications": [
      {
        "name": "Epinephrine",
        "dose": "0.3mg",
        "route": "IM",
        "time": "15:22",
        "administration": "Completed"
      },
      {
        "name": "Diphenhydramine",
        "dose": "25mg",
        "route": "IV",
        "time": "15:25",
        "administration": "Completed"
      }
    ],
    "notes": "Patient had inadvertently consumed shrimp at restaurant. Rapid response with epinephrine. Symptoms improving. Continued monitoring during transport."
  },
  "handover": {
    "hospitalId": "HOSP-002",
    "hospitalName": "Aga Khan University Hospital",
    "arrivalTime": "15:50",
    "dischargeTime": null,
    "receivingStaff": {
      "name": "Dr. Sarah Njoroge",
      "role": "Emergency Physician"
    },
    "department": "Emergency Department",
    "handoverNotes": "34F with allergic reaction to seafood. Epinephrine and antihistamines given. Facial swelling resolving. RR 26, HR 115. Continued observation recommended."
  },
  "metrics": {
    "callToDispatchTime": 2,
    "dispatchToArrivalTime": 10,
    "sceneTime": 12,
    "transportTime": 15,
    "totalIncidentTime": 39,
    "distanceTraveled": 5.2,
    "qualityScore": 0
  },
  "compliance": {
    "hasPhotos": false,
    "hasConsent": true,
    "followUpRequired": false,
    "incidentCategory": "ALLERGIC_REACTION"
  }
}
```

## cURL Examples

### 1. Generate Report from Sample Data

```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d @incident-data.json
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Report generated successfully",
  "data": {
    "report": {
      "reportId": "RPT-1705320450123-ABC123DEF",
      "reportType": "INCIDENT_REPORT",
      "generatedAt": "2024-01-15T10:07:30.123Z",
      "generatedBy": "System",
      "incident": {
        "incidentId": "INC-002",
        "callNumber": "CALL-20240115-002",
        "caseNumber": "CASE-20240115-002",
        "incidentType": "MEDICAL",
        "severity": "HIGH",
        "description": "Patient with severe allergic reaction"
      },
      "patient": {
        "firstName": "Sarah",
        "lastName": "Williams",
        "age": "34",
        "gender": "Female",
        "phoneNumber": "****5432",
        "idNumber": "****5432",
        "allergies": ["Peanuts", "Shellfish"]
      },
      "compliance": {
        "reportStatus": "DRAFT",
        "isComplete": false,
        "requiresReview": true
      }
    },
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": ["Heart rate not recorded", "Paramedic 1 signature missing"],
      "completionPercentage": 91
    }
  }
}
```

### 2. List All Reports

```bash
curl -X GET "http://localhost:3000/api/reports" \
  -H "Accept: application/json"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "reportId": "RPT-1705320450123-ABC123DEF",
      "incident": {
        "incidentType": "MEDICAL",
        "severity": "HIGH"
      },
      "patient": {
        "firstName": "Sarah",
        "lastName": "Williams"
      },
      "generatedAt": "2024-01-15T10:07:30.123Z",
      "compliance": {
        "reportStatus": "DRAFT"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### 3. Filter Reports by Patient

```bash
curl -X GET "http://localhost:3000/api/reports?patientId=PT-001" \
  -H "Accept: application/json"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "reportId": "RPT-1705320450123-ABC123DEF",
      "patient": {
        "patientId": "PT-001",
        "firstName": "Sarah",
        "lastName": "Williams"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### 4. Get Specific Report

```bash
curl -X GET "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "reportId": "RPT-1705320450123-ABC123DEF",
    "reportType": "INCIDENT_REPORT",
    "generatedAt": "2024-01-15T10:07:30.123Z",
    "incident": {
      "incidentId": "INC-002",
      "callNumber": "CALL-20240115-002",
      "incidentType": "MEDICAL",
      "severity": "HIGH"
    },
    "patient": {
      "firstName": "Sarah",
      "lastName": "Williams",
      "age": "34"
    }
  }
}
```

### 5. Add Signature to Report

```bash
curl -X POST "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF/signature" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "paramedic1",
    "name": "John Mwangi",
    "licenseNumber": "PAR-2024-003",
    "signature": null
  }'
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Signature added successfully",
  "data": {
    "reportId": "RPT-1705320450123-ABC123DEF",
    "signatures": {
      "paramedic1": {
        "name": "John Mwangi",
        "licenseNumber": "****2003",
        "timestamp": "2024-01-15T10:08:45.000Z"
      }
    }
  }
}
```

### 6. Validate Report

```bash
curl -X GET "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF/validate"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "Paramedic 2 signature missing",
      "Supervisor signature missing"
    ],
    "completionPercentage": 82
  }
}
```

### 7. Update Report

```bash
curl -X PUT "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF" \
  -H "Content-Type: application/json" \
  -d '{
    "paramedic": {
      "notes": "Updated clinical notes after hospital consultation"
    },
    "compliance": {
      "followUpRequired": true
    }
  }'
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Report updated successfully",
  "data": {
    "report": {
      "reportId": "RPT-1705320450123-ABC123DEF",
      "paramedic": {
        "notes": "Updated clinical notes after hospital consultation"
      }
    },
    "validation": {
      "isValid": true,
      "completionPercentage": 85
    }
  }
}
```

### 8. Generate PDF Report

```bash
curl -X POST "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF/pdf?type=incident" \
  -H "Accept: application/pdf" \
  -o incident-report.pdf
```

**Response**: Binary PDF file

### 9. Download PDF Report

```bash
curl -X GET "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF/download?type=incident" \
  -o incident-report.pdf
```

**Response**: Binary PDF file

### 10. Download Handover PDF

```bash
curl -X GET "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF/download?type=handover" \
  -o handover-summary.pdf
```

**Response**: Binary PDF file (hospital handover format)

### 11. Generate Sample Report

```bash
curl -X POST "http://localhost:3000/api/reports/sample"
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Sample report generated",
  "data": {
    "reportId": "RPT-1705320450456-XYZ789GHI",
    "patient": {
      "firstName": "John",
      "lastName": "Doe",
      "age": "65"
    },
    "incident": {
      "incidentType": "MEDICAL",
      "severity": "HIGH",
      "description": "Patient experiencing chest pain and difficulty breathing"
    }
  }
}
```

### 12. Get Statistics

```bash
curl -X GET "http://localhost:3000/api/reports/statistics"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalReports": 5,
    "submitted": 2,
    "draft": 3,
    "byIncidentType": {
      "MEDICAL": 4,
      "TRAUMA": 1
    },
    "bySeverity": {
      "HIGH": 3,
      "MEDIUM": 2
    },
    "averageSceneTime": 15,
    "averageTransportTime": 20
  }
}
```

### 13. Archive Report

```bash
curl -X DELETE "http://localhost:3000/api/reports/RPT-1705320450123-ABC123DEF"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Report archived"
}
```

## Error Response Examples

### 404 - Report Not Found

```bash
curl -X GET "http://localhost:3000/api/reports/RPT-INVALID"
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": "Report not found"
}
```

### 400 - Invalid Request

```bash
curl -X POST "http://localhost:3000/api/reports/RPT-123/signature" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "invalid_role",
    "name": "John Doe"
  }'
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Invalid role: invalid_role"
}
```

### 500 - Server Error

```json
{
  "success": false,
  "error": "Database connection failed"
}
```

## JavaScript/Node Examples

### Using Fetch API

```javascript
// Generate report
const response = await fetch('http://localhost:3000/api/reports/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(incidentData)
});

const result = await response.json();
console.log('Report ID:', result.data.report.reportId);
```

### Using Axios

```javascript
const axios = require('axios');

// Get all reports
const response = await axios.get('http://localhost:3000/api/reports', {
  params: {
    patientId: 'PT-001',
    limit: 20
  }
});

console.log('Reports:', response.data.data);
```

## Testing Workflow

1. **Generate Sample Report**
   ```bash
   curl -X POST http://localhost:3000/api/reports/sample
   ```
   Note the `reportId` from response

2. **Validate Report**
   ```bash
   curl -X GET http://localhost:3000/api/reports/{reportId}/validate
   ```

3. **Add Signatures** (3 times)
   ```bash
   curl -X POST http://localhost:3000/api/reports/{reportId}/signature \
     -H "Content-Type: application/json" \
     -d '{"role":"paramedic1","name":"Name","licenseNumber":"LIC-001"}'
   ```

4. **Download PDF**
   ```bash
   curl -X GET http://localhost:3000/api/reports/{reportId}/download \
     -o report.pdf
   ```

5. **Get Statistics**
   ```bash
   curl -X GET http://localhost:3000/api/reports/statistics
   ```

---

**Note**: Replace `http://localhost:3000` with your actual server address.
All phone numbers and ID numbers are automatically masked in responses.
