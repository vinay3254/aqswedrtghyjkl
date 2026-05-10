# Feedback & Rating System

A comprehensive feedback and rating system for the ambulance dispatch platform. Allows patients to rate services, provide detailed feedback, and enables administrators to analyze trends and track performance metrics.

## Overview

The system consists of 5 integrated services:
- **Rating Service**: 1-5 star ratings for different service aspects
- **Feedback Form**: Detailed feedback collection (compliments, complaints, suggestions)
- **Analytics**: Trend analysis, issue identification, sentiment analysis
- **Driver Performance**: Track driver performance metrics and performance scores
- **Hospital Rating**: Rate hospital response quality and track hospital performance

## Files

### 1. rating-service.js
Core rating functionality for collecting 1-5 star ratings from patients.

#### Key Endpoints:

**Submit Rating**
```
POST /api/feedback/ratings/submit
Authorization: Bearer token
Content-Type: application/json

{
  "dispatch_id": 123,
  "driver_id": 45,
  "hospital_id": 67,
  "rating": 5,
  "service_type": "ambulance_response" | "driver_conduct" | "hospital_care" | "overall"
}

Response:
{
  "success": true,
  "message": "Rating submitted successfully",
  "rating_id": 1001,
  "timestamp": "2024-05-04T19:20:00Z"
}
```

**Get Patient's Ratings**
```
GET /api/feedback/ratings/my-ratings?limit=10&offset=0
Authorization: Bearer token

Response:
{
  "success": true,
  "ratings": [
    {
      "id": 1001,
      "dispatch_id": 123,
      "rating": 5,
      "service_type": "driver_conduct",
      "timestamp": "2024-05-04T19:20:00Z",
      "driver_name": "John Doe",
      "hospital_name": "City Hospital"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 45
  }
}
```

**Get Average Rating for Dispatch**
```
GET /api/feedback/ratings/dispatch/:dispatch_id/average

Response:
{
  "success": true,
  "dispatch_id": 123,
  "overall_average": 4.5,
  "total_ratings": 12,
  "by_service_type": [
    {
      "service_type": "driver_conduct",
      "total_ratings": 3,
      "average_rating": 4.67,
      "min_rating": 4,
      "max_rating": 5
    }
  ]
}
```

**Get Driver Rating Distribution**
```
GET /api/feedback/ratings/driver/:driver_id/distribution

Response:
{
  "success": true,
  "driver_id": 45,
  "statistics": {
    "average_rating": 4.5,
    "total_ratings": 120,
    "min_rating": 2,
    "max_rating": 5
  },
  "distribution": [
    {
      "rating": 5,
      "count": 80,
      "percentage": 66.67
    },
    {
      "rating": 4,
      "count": 30,
      "percentage": 25.00
    }
  ]
}
```

**Get Rating Summary**
```
GET /api/feedback/ratings/summary/:entity_type/:entity_id

entity_type: "driver" | "hospital"

Response:
{
  "success": true,
  "entity_type": "driver",
  "entity_id": 45,
  "star_summary": [
    {
      "stars": 5,
      "count": 80
    },
    {
      "stars": 4,
      "count": 30
    }
  ]
}
```

**Update Rating**
```
PUT /api/feedback/ratings/:rating_id
Authorization: Bearer token
Content-Type: application/json

{
  "rating": 4
}

Response:
{
  "success": true,
  "message": "Rating updated successfully",
  "rating_id": 1001
}
```

**Delete Rating**
```
DELETE /api/feedback/ratings/:rating_id
Authorization: Bearer token

Response:
{
  "success": true,
  "message": "Rating deleted successfully"
}
```

---

### 2. feedback-form.js
Detailed feedback collection with support for compliments, complaints, and suggestions.

#### Key Endpoints:

**Submit Feedback**
```
POST /api/feedback/form/submit
Authorization: Bearer token
Content-Type: application/json

{
  "dispatch_id": 123,
  "driver_id": 45,
  "hospital_id": 67,
  "feedback_type": "complaint" | "compliment" | "suggestion" | "other",
  "category": "Safety",
  "title": "Poor response time",
  "message": "Ambulance took too long to arrive",
  "priority": "low" | "medium" | "high" | "urgent",
  "contact_preference": "email" | "phone",
  "contact_info": "patient@example.com"
}

Response:
{
  "success": true,
  "message": "Feedback submitted successfully",
  "feedback_id": 2001,
  "timestamp": "2024-05-04T19:20:00Z"
}
```

**Get Patient's Feedback**
```
GET /api/feedback/form/my-feedback?limit=20&offset=0&status=pending&feedback_type=complaint
Authorization: Bearer token

Response:
{
  "success": true,
  "feedback": [
    {
      "id": 2001,
      "dispatch_id": 123,
      "feedback_type": "complaint",
      "category": "Safety",
      "title": "Poor response time",
      "message": "Ambulance took too long to arrive",
      "priority": "high",
      "status": "pending",
      "timestamp": "2024-05-04T19:20:00Z",
      "resolved_at": null,
      "resolution_notes": null,
      "driver_name": "John Doe",
      "hospital_name": "City Hospital"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 15
  }
}
```

**Get Feedback Details**
```
GET /api/feedback/form/:feedback_id
Authorization: Bearer token

Response:
{
  "success": true,
  "feedback": {
    "id": 2001,
    "dispatch_id": 123,
    "feedback_type": "complaint",
    "category": "Safety",
    "title": "Poor response time",
    "message": "Ambulance took too long to arrive",
    "priority": "high",
    "status": "pending",
    "timestamp": "2024-05-04T19:20:00Z",
    "driver_name": "John Doe",
    "driver_phone": "+1234567890",
    "hospital_name": "City Hospital",
    "hospital_phone": "+0987654321"
  }
}
```

**Update Feedback**
```
PUT /api/feedback/form/:feedback_id
Authorization: Bearer token
Content-Type: application/json

{
  "title": "Updated title",
  "message": "Updated message",
  "priority": "urgent",
  "contact_preference": "phone",
  "contact_info": "+1234567890"
}

Response:
{
  "success": true,
  "message": "Feedback updated successfully",
  "feedback_id": 2001
}
```

**Admin Response to Feedback**
```
POST /api/feedback/form/:feedback_id/respond
Authorization: Bearer admin_token
Content-Type: application/json

{
  "resolution_notes": "We have addressed the safety concerns...",
  "status": "resolved" | "acknowledged" | "under_review" | "closed"
}

Response:
{
  "success": true,
  "message": "Response added successfully",
  "feedback_id": 2001
}
```

**Get Feedback Statistics**
```
GET /api/feedback/form/stats/dashboard

Response:
{
  "success": true,
  "statistics": {
    "by_type": [
      {
        "feedback_type": "complaint",
        "count": 45
      },
      {
        "feedback_type": "compliment",
        "count": 120
      }
    ],
    "by_status": [
      {
        "status": "pending",
        "count": 12
      },
      {
        "status": "resolved",
        "count": 150
      }
    ],
    "resolution_metrics": {
      "avg_resolution_hours": 24.5,
      "min_hours": 2,
      "max_hours": 168
    }
  }
}
```

**Search Feedback**
```
GET /api/feedback/form/search?query=response+time&limit=20&offset=0

Response:
{
  "success": true,
  "results": [
    {
      "id": 2001,
      "feedback_type": "complaint",
      "title": "Poor response time",
      "message": "Ambulance took too long to arrive",
      "status": "pending",
      "timestamp": "2024-05-04T19:20:00Z",
      "relevance": 0.95
    }
  ],
  "query": "response time"
}
```

---

### 3. analytics.js
Analyzes feedback trends, identifies issues, and provides insights.

#### Key Endpoints:

**Get Trends**
```
GET /api/feedback/analytics/trends?period=30&metric=count

Response:
{
  "success": true,
  "period": "30 days",
  "trends": [
    {
      "date": "2024-05-04",
      "feedback_type": "complaint",
      "total": 5,
      "resolution_rate": 0.8,
      "resolution_percentage": "80.00"
    }
  ]
}
```

**Get Recurring Issues**
```
GET /api/feedback/analytics/issues/recurring?period=90&min_occurrences=3

Response:
{
  "success": true,
  "period": "90 days",
  "minimum_occurrences": 3,
  "recurring_issues": [
    {
      "category": "Safety",
      "feedback_type": "complaint",
      "occurrences": 15,
      "percentage": "12.5",
      "sample_feedback": [
        {
          "id": 2001,
          "title": "Poor response time",
          "message": "Took too long",
          "priority": "high",
          "timestamp": "2024-05-04T19:20:00Z"
        }
      ]
    }
  ],
  "total_unique_issues": 8
}
```

**Get Critical Issues**
```
GET /api/feedback/analytics/issues/critical

Response:
{
  "success": true,
  "critical_issues": {
    "urgent": [
      {
        "id": 2001,
        "feedback_type": "complaint",
        "category": "Safety",
        "title": "Critical safety issue",
        "message": "Driver was reckless",
        "priority": "urgent",
        "status": "pending",
        "timestamp": "2024-05-04T19:20:00Z",
        "patient_phone": "+1234567890",
        "driver_name": "John Doe",
        "hospital_name": "City Hospital"
      }
    ],
    "high": []
  },
  "total": 1
}
```

**Sentiment Analysis**
```
GET /api/feedback/analytics/sentiment-analysis?period=30

Response:
{
  "success": true,
  "period": "30 days",
  "overall_sentiment": {
    "total": 150,
    "positive": 100,
    "negative": 30,
    "neutral": 20,
    "positive_percentage": "66.67",
    "negative_percentage": "20.00"
  },
  "by_category": []
}
```

**Identify Hotspots**
```
GET /api/feedback/analytics/hotspots?period=30&top=10

Response:
{
  "success": true,
  "period": "30 days",
  "hotspots": {
    "drivers": [
      {
        "id": 45,
        "driver_name": "John Doe",
        "complaint_count": 8,
        "average_rating": 2.5,
        "affected_dispatches": 45
      }
    ],
    "hospitals": [
      {
        "id": 67,
        "hospital_name": "City Hospital",
        "complaint_count": 12,
        "average_rating": 3.2,
        "affected_dispatches": 120
      }
    ]
  }
}
```

**Response Metrics**
```
GET /api/feedback/analytics/response-metrics?period=30

Response:
{
  "success": true,
  "period": "30 days",
  "response_metrics": [
    {
      "status": "resolved",
      "count": 45,
      "avg_response_hours": 24.5,
      "fastest_hours": 2,
      "slowest_hours": 168,
      "avg_response_days": 1.02
    }
  ],
  "sla_compliance": {
    "total_closed": 45,
    "within_sla": 40,
    "sla_compliance_percentage": "88.89"
  }
}
```

**Word Frequency Analysis**
```
GET /api/feedback/analytics/word-frequency?limit=20

Response:
{
  "success": true,
  "word_frequency": [
    {
      "word": "response",
      "count": 45
    },
    {
      "word": "time",
      "count": 42
    },
    {
      "word": "driver",
      "count": 38
    }
  ]
}
```

---

### 4. driver-performance.js
Track driver performance metrics and ratings.

#### Key Endpoints:

**Get Driver Overall Performance**
```
GET /api/feedback/driver-performance/driver/:driver_id/overall

Response:
{
  "success": true,
  "driver": {
    "id": 45,
    "driver_name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "status": "active",
    "average_rating": 4.5,
    "performance_score": 88.5,
    "performance_level": "good",
    "complaint_count": 5,
    "compliment_count": 95,
    "total_ratings": 120
  }
}
```

**Get Detailed Performance Metrics**
```
GET /api/feedback/driver-performance/driver/:driver_id/detailed?period=30

Response:
{
  "success": true,
  "period": "30 days",
  "driver_id": 45,
  "rating_distribution": [
    {
      "rating": 5,
      "count": 80
    },
    {
      "rating": 4,
      "count": 30
    }
  ],
  "category_feedback": [
    {
      "category": "Safety",
      "feedback_count": 15,
      "complaints": 2,
      "compliments": 13
    }
  ],
  "recent_feedback": [
    {
      "id": 2001,
      "feedback_type": "compliment",
      "category": "Safety",
      "title": "Excellent driving",
      "message": "Very safe driving",
      "timestamp": "2024-05-04T19:20:00Z"
    }
  ],
  "trip_statistics": {
    "total_trips": 150,
    "rated_trips": 120,
    "rating_percentage": "80.00"
  }
}
```

**Get Top Performers**
```
GET /api/feedback/driver-performance/top-performers?limit=10&period=30

Response:
{
  "success": true,
  "period": "30 days",
  "top_performers": [
    {
      "id": 45,
      "driver_name": "John Doe",
      "total_ratings": 120,
      "average_rating": 4.75,
      "compliments": 95,
      "complaints": 2,
      "feedback_rate": "85.30"
    }
  ]
}
```

**Get Drivers Needing Improvement**
```
GET /api/feedback/driver-performance/needs-improvement?limit=10&min_ratings=3

Response:
{
  "success": true,
  "minimum_ratings": 3,
  "drivers_needing_improvement": [
    {
      "id": 88,
      "driver_name": "Jane Smith",
      "phone": "+0987654321",
      "total_ratings": 45,
      "average_rating": 2.8,
      "complaints": 20,
      "compliments": 10,
      "issue_areas": "Safety, Courtesy, Vehicle Condition"
    }
  ]
}
```

**Get Performance Trend**
```
GET /api/feedback/driver-performance/driver/:driver_id/trend

Response:
{
  "success": true,
  "driver_id": 45,
  "period": "Last 90 days",
  "trend_data": [
    {
      "date": "2024-03-05",
      "rating_count": 5,
      "daily_average": 4.6
    }
  ]
}
```

**Calculate Performance Score**
```
POST /api/feedback/driver-performance/calculate-score/:driver_id

Response:
{
  "success": true,
  "driver_id": 45,
  "performance_score": "88.50",
  "performance_level": "good",
  "breakdown": {
    "rating_score": "54.00",
    "feedback_score": "34.50",
    "average_rating": 4.5,
    "total_ratings": 120,
    "compliments": 95,
    "complaints": 5
  }
}
```

**Get Performance Comparison**
```
GET /api/feedback/driver-performance/comparison?period=30

Response:
{
  "success": true,
  "period": "30 days",
  "drivers": [
    {
      "id": 45,
      "driver_name": "John Doe",
      "total_ratings": 120,
      "average_rating": 4.75,
      "complaints": 2,
      "compliments": 95
    }
  ],
  "statistics": {
    "average_rating_across_all": "4.20",
    "highest_rating": 4.75,
    "lowest_rating": 2.8,
    "total_drivers": 25
  }
}
```

---

### 5. hospital-rating.js
Rate and track hospital performance metrics.

#### Key Endpoints:

**Submit Hospital Rating**
```
POST /api/feedback/hospital/:hospital_id/rate
Authorization: Bearer token
Content-Type: application/json

{
  "dispatch_id": 123,
  "rating": 5,
  "staff_courtesy": 5,
  "treatment_quality": 4,
  "facility_cleanliness": 5,
  "wait_time": 3,
  "comments": "Good treatment but long wait"
}

Response:
{
  "success": true,
  "message": "Hospital rating submitted successfully",
  "rating_id": 3001,
  "timestamp": "2024-05-04T19:20:00Z"
}
```

**Get Hospital Overall Rating**
```
GET /api/feedback/hospital/hospital/:hospital_id/rating

Response:
{
  "success": true,
  "hospital": {
    "id": 67,
    "hospital_name": "City Hospital",
    "address": "123 Main St",
    "phone": "+0987654321",
    "email": "info@cityhospital.com",
    "total_ratings": 250,
    "average_rating": 4.3,
    "five_star_count": 150,
    "four_star_count": 70,
    "three_star_count": 20,
    "two_star_count": 8,
    "one_star_count": 2,
    "first_rating_date": "2024-01-15T10:30:00Z",
    "last_rating_date": "2024-05-04T19:20:00Z"
  }
}
```

**Get Detailed Hospital Ratings**
```
GET /api/feedback/hospital/hospital/:hospital_id/details?period=30

Response:
{
  "success": true,
  "hospital_id": 67,
  "period": "30 days",
  "category_ratings": {
    "avg_staff_courtesy": 4.5,
    "avg_treatment_quality": 4.3,
    "avg_facility_cleanliness": 4.6,
    "avg_wait_time": 3.2,
    "total_detailed_ratings": 80
  },
  "recent_comments": [
    {
      "rating": 5,
      "comments": "Excellent care and friendly staff",
      "timestamp": "2024-05-04T19:20:00Z"
    }
  ]
}
```

**Get Top Rated Hospitals**
```
GET /api/feedback/hospital/top-hospitals?limit=10&min_ratings=5&period=30

Response:
{
  "success": true,
  "period": "30 days",
  "minimum_ratings": 5,
  "top_hospitals": [
    {
      "id": 67,
      "hospital_name": "City Hospital",
      "address": "123 Main St",
      "total_ratings": 250,
      "average_rating": 4.75,
      "first_rating": "2024-01-15T10:30:00Z",
      "last_rating": "2024-05-04T19:20:00Z"
    }
  ]
}
```

**Get Hospitals Needing Attention**
```
GET /api/feedback/hospital/needs-attention?limit=10&max_rating=3

Response:
{
  "success": true,
  "hospitals_needing_attention": [
    {
      "id": 89,
      "hospital_name": "District Hospital",
      "address": "456 Oak St",
      "phone": "+1122334455",
      "total_ratings": 120,
      "average_rating": 2.8,
      "complaints": 35,
      "issue_areas": "Wait Time, Cleanliness, Staff Courtesy"
    }
  ]
}
```

**Get Hospital Performance Trend**
```
GET /api/feedback/hospital/hospital/:hospital_id/trend

Response:
{
  "success": true,
  "hospital_id": 67,
  "period": "Last 90 days",
  "trend_data": [
    {
      "date": "2024-03-05",
      "rating_count": 8,
      "daily_average": 4.5
    }
  ]
}
```

**Calculate Hospital Performance Score**
```
POST /api/feedback/hospital/hospital/:hospital_id/calculate-score

Response:
{
  "success": true,
  "hospital_id": 67,
  "performance_score": "86.50",
  "performance_level": "good",
  "breakdown": {
    "rating_score": "51.60",
    "feedback_score": "34.90",
    "average_rating": 4.3,
    "total_ratings": 250,
    "compliments": 180,
    "complaints": 25
  }
}
```

**Compare Hospitals**
```
GET /api/feedback/hospital/comparison?period=30

Response:
{
  "success": true,
  "period": "30 days",
  "hospitals": [
    {
      "id": 67,
      "hospital_name": "City Hospital",
      "address": "123 Main St",
      "total_ratings": 250,
      "average_rating": 4.75,
      "complaints": 5,
      "compliments": 180
    }
  ],
  "statistics": {
    "average_rating_across_all": "4.35",
    "highest_rating": 4.75,
    "lowest_rating": 2.8,
    "total_hospitals": 12
  }
}
```

---

## Database Tables

### ratings
Stores all 1-5 star ratings with service type categorization.

### feedback
Detailed feedback with status tracking and resolution notes.

### driver_performance
Aggregated driver performance metrics updated daily.

### hospital_performance
Aggregated hospital performance metrics updated daily.

### feedback_activity_log
Audit trail for feedback status changes and admin responses.

### hospital_ratings_detail
Detailed category ratings for hospitals (staff, treatment, cleanliness, wait time).

---

## Integration with Mobile App

### Rating Flow:
1. Patient completes ambulance trip
2. Mobile app prompts for 1-5 star rating
3. Optional detailed feedback form
4. Data submitted via `/submit` endpoint
5. Ratings updated in real-time on dispatch record

### Feedback Flow:
1. Patient accesses feedback section
2. Selects feedback type (complaint/compliment/suggestion)
3. Fills detailed form with category and comments
4. Submits with optional contact preference
5. Admin receives notification for high-priority feedback

### Performance Tracking:
1. System aggregates ratings and feedback daily
2. Performance scores calculated automatically
3. Drivers/hospitals ranked by performance
4. Trend reports generated for management
5. Critical issues flagged for immediate action

---

## Authentication

All POST/PUT/DELETE endpoints require Bearer token authentication:
```
Authorization: Bearer {jwt_token}
```

Admin endpoints require elevated privileges for feedback responses and performance calculations.

---

## Error Handling

Standard HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request
- `403`: Forbidden/Unauthorized
- `404`: Not found
- `409`: Conflict (duplicate rating)
- `500`: Server error

All error responses include:
```json
{
  "success": false,
  "message": "Error description",
  "error": "error details"
}
```

---

## Performance Scoring Algorithm

**Driver/Hospital Performance Score = (Rating Score × 60%) + (Feedback Score × 40%)**

- **Rating Score**: (Average Rating / 5) × 60
- **Feedback Score**: ((Compliments / Total) × 40) - ((Complaints / Total) × 20)

**Performance Levels**:
- 90-100: Excellent
- 75-89: Good
- 60-74: Average
- 45-59: Below Average
- < 45: Poor

---

## Setup Instructions

1. Copy all files to `/backend/services/feedback/`
2. Import tables using provided schema
3. Add middleware for authentication and validation
4. Configure database connection in config/database.js
5. Mount routes in main app router:

```javascript
const { router: ratingRouter } = require('./services/feedback/rating-service');
const { router: feedbackRouter } = require('./services/feedback/feedback-form');
const analyticsRouter = require('./services/feedback/analytics');
const { router: driverPerfRouter } = require('./services/feedback/driver-performance');
const { router: hospitalRouter } = require('./services/feedback/hospital-rating');

app.use('/api/feedback/ratings', ratingRouter);
app.use('/api/feedback/form', feedbackRouter);
app.use('/api/feedback/analytics', analyticsRouter);
app.use('/api/feedback/driver-performance', driverPerfRouter);
app.use('/api/feedback/hospital', hospitalRouter);
```

---

## Features Summary

✅ 1-5 star rating system
✅ Detailed feedback collection
✅ Compliments/complaints/suggestions
✅ Real-time analytics and trends
✅ Recurring issue identification
✅ Sentiment analysis
✅ Driver performance tracking
✅ Hospital quality assessment
✅ SLA compliance tracking
✅ Admin response system
✅ Audit logging
✅ Performance scoring algorithm
✅ Hotspot identification
✅ Word frequency analysis
✅ RESTful API endpoints
✅ Mobile app integration
