/**
 * API Testing Examples - Feedback & Rating System
 * Use these examples with Postman, curl, or REST client
 */

// ============================================================================
// RATING SERVICE - TESTING EXAMPLES
// ============================================================================

/**
 * 1. SUBMIT A RATING
 * Method: POST
 * Endpoint: /api/feedback/ratings/submit
 * Auth: Required
 */
{
  "dispatch_id": 123,
  "driver_id": 45,
  "hospital_id": 67,
  "rating": 5,
  "service_type": "driver_conduct"
}

// Response (201):
{
  "success": true,
  "message": "Rating submitted successfully",
  "rating_id": 1001,
  "timestamp": "2024-05-04T19:20:00Z"
}

---

/**
 * 2. GET MY RATINGS
 * Method: GET
 * Endpoint: /api/feedback/ratings/my-ratings?limit=10&offset=0
 * Auth: Required
 */

// Response (200):
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
      "hospital_name": "City Hospital",
      "pickup_location": "123 Main St",
      "dropoff_location": "456 Oak St"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 45
  }
}

---

/**
 * 3. GET AVERAGE RATING FOR DISPATCH
 * Method: GET
 * Endpoint: /api/feedback/ratings/dispatch/123/average
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "dispatch_id": 123,
  "overall_average": 4.5,
  "total_ratings": 12,
  "by_service_type": [
    {
      "service_type": "driver_conduct",
      "total_ratings": 3,
      "average_rating": "4.67",
      "min_rating": 4,
      "max_rating": 5
    },
    {
      "service_type": "ambulance_response",
      "total_ratings": 4,
      "average_rating": "4.50",
      "min_rating": 4,
      "max_rating": 5
    }
  ]
}

---

/**
 * 4. UPDATE A RATING
 * Method: PUT
 * Endpoint: /api/feedback/ratings/1001
 * Auth: Required
 */
{
  "rating": 4
}

// Response (200):
{
  "success": true,
  "message": "Rating updated successfully",
  "rating_id": 1001
}

---

// ============================================================================
// FEEDBACK FORM - TESTING EXAMPLES
// ============================================================================

/**
 * 1. SUBMIT FEEDBACK
 * Method: POST
 * Endpoint: /api/feedback/form/submit
 * Auth: Required
 */
{
  "dispatch_id": 123,
  "driver_id": 45,
  "hospital_id": 67,
  "feedback_type": "complaint",
  "category": "Safety",
  "title": "Poor response time",
  "message": "Ambulance took too long to arrive at the location",
  "priority": "high",
  "contact_preference": "email",
  "contact_info": "patient@example.com"
}

// Response (201):
{
  "success": true,
  "message": "Feedback submitted successfully",
  "feedback_id": 2001,
  "timestamp": "2024-05-04T19:20:00Z"
}

---

/**
 * 2. GET MY FEEDBACK WITH FILTERS
 * Method: GET
 * Endpoint: /api/feedback/form/my-feedback?limit=20&offset=0&status=pending&feedback_type=complaint
 * Auth: Required
 */

// Response (200):
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

---

/**
 * 3. SEARCH FEEDBACK
 * Method: GET
 * Endpoint: /api/feedback/form/search?query=response+time&limit=20&offset=0
 * Auth: Not required
 */

// Response (200):
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

---

/**
 * 4. ADMIN RESPOND TO FEEDBACK
 * Method: POST
 * Endpoint: /api/feedback/form/2001/respond
 * Auth: Admin required
 */
{
  "resolution_notes": "We have reviewed this incident. Response time has been improved in this area.",
  "status": "resolved"
}

// Response (200):
{
  "success": true,
  "message": "Response added successfully",
  "feedback_id": 2001
}

---

// ============================================================================
// ANALYTICS - TESTING EXAMPLES
// ============================================================================

/**
 * 1. GET TRENDS
 * Method: GET
 * Endpoint: /api/feedback/analytics/trends?period=30&metric=count
 * Auth: Not required
 */

// Response (200):
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
    },
    {
      "date": "2024-05-03",
      "feedback_type": "complaint",
      "total": 3,
      "resolution_rate": 1,
      "resolution_percentage": "100.00"
    }
  ]
}

---

/**
 * 2. GET RECURRING ISSUES
 * Method: GET
 * Endpoint: /api/feedback/analytics/issues/recurring?period=90&min_occurrences=3
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "period": "90 days",
  "minimum_occurrences": 3,
  "recurring_issues": [
    {
      "category": "Safety",
      "feedback_type": "complaint",
      "occurrences": 15,
      "percentage": "12.50",
      "feedback_ids": "2001,2002,2003",
      "sample_feedback": [
        {
          "id": 2001,
          "title": "Reckless driving",
          "message": "Driver was speeding",
          "priority": "high",
          "timestamp": "2024-05-04T19:20:00Z"
        }
      ]
    }
  ],
  "total_unique_issues": 8
}

---

/**
 * 3. GET SENTIMENT ANALYSIS
 * Method: GET
 * Endpoint: /api/feedback/analytics/sentiment-analysis?period=30
 * Auth: Not required
 */

// Response (200):
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

---

/**
 * 4. GET HOTSPOTS
 * Method: GET
 * Endpoint: /api/feedback/analytics/hotspots?period=30&top=10
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "period": "30 days",
  "hotspots": {
    "drivers": [
      {
        "id": 45,
        "driver_name": "John Doe",
        "complaint_count": 8,
        "average_rating": "2.50",
        "affected_dispatches": 45
      }
    ],
    "hospitals": [
      {
        "id": 67,
        "hospital_name": "City Hospital",
        "complaint_count": 12,
        "average_rating": "3.20",
        "affected_dispatches": 120
      }
    ]
  }
}

---

/**
 * 5. GET RESPONSE METRICS
 * Method: GET
 * Endpoint: /api/feedback/analytics/response-metrics?period=30
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "period": "30 days",
  "response_metrics": [
    {
      "status": "resolved",
      "count": 45,
      "avg_response_hours": "24.50",
      "fastest_hours": 2,
      "slowest_hours": 168,
      "avg_response_days": "1.02"
    }
  ],
  "sla_compliance": {
    "total_closed": 45,
    "within_sla": 40,
    "sla_compliance_percentage": "88.89"
  }
}

---

// ============================================================================
// DRIVER PERFORMANCE - TESTING EXAMPLES
// ============================================================================

/**
 * 1. GET DRIVER OVERALL PERFORMANCE
 * Method: GET
 * Endpoint: /api/feedback/driver-performance/driver/45/overall
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "driver": {
    "id": 45,
    "driver_name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "status": "active",
    "total_trips": 450,
    "rated_trips": 360,
    "average_rating": "4.50",
    "performance_score": "88.50",
    "performance_level": "good",
    "complaint_count": 5,
    "compliment_count": 95,
    "evaluation_date": "2024-05-04",
    "total_ratings": 120,
    "current_rating": "4.50"
  }
}

---

/**
 * 2. GET DETAILED DRIVER PERFORMANCE
 * Method: GET
 * Endpoint: /api/feedback/driver-performance/driver/45/detailed?period=30
 * Auth: Not required
 */

// Response (200):
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
      "message": "Very safe driving throughout the journey",
      "timestamp": "2024-05-04T19:20:00Z"
    }
  ],
  "trip_statistics": {
    "total_trips": 150,
    "rated_trips": 120,
    "rating_percentage": "80.00"
  }
}

---

/**
 * 3. CALCULATE DRIVER PERFORMANCE SCORE
 * Method: POST
 * Endpoint: /api/feedback/driver-performance/calculate-score/45
 * Auth: Not required (typically called by system)
 */

// Response (200):
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

---

/**
 * 4. GET DRIVER COMPARISON
 * Method: GET
 * Endpoint: /api/feedback/driver-performance/comparison?period=30
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "period": "30 days",
  "drivers": [
    {
      "id": 45,
      "driver_name": "John Doe",
      "total_ratings": 120,
      "average_rating": "4.75",
      "complaints": 2,
      "compliments": 95
    },
    {
      "id": 88,
      "driver_name": "Jane Smith",
      "total_ratings": 85,
      "average_rating": "4.20",
      "complaints": 8,
      "compliments": 65
    }
  ],
  "statistics": {
    "average_rating_across_all": "4.20",
    "highest_rating": 4.75,
    "lowest_rating": 2.8,
    "total_drivers": 25
  }
}

---

// ============================================================================
// HOSPITAL RATING - TESTING EXAMPLES
// ============================================================================

/**
 * 1. SUBMIT HOSPITAL RATING
 * Method: POST
 * Endpoint: /api/feedback/hospital/67/rate
 * Auth: Required
 */
{
  "dispatch_id": 123,
  "rating": 5,
  "staff_courtesy": 5,
  "treatment_quality": 4,
  "facility_cleanliness": 5,
  "wait_time": 3,
  "comments": "Good treatment but long wait times"
}

// Response (201):
{
  "success": true,
  "message": "Hospital rating submitted successfully",
  "rating_id": 3001,
  "timestamp": "2024-05-04T19:20:00Z"
}

---

/**
 * 2. GET HOSPITAL OVERALL RATING
 * Method: GET
 * Endpoint: /api/feedback/hospital/hospital/67/rating
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "hospital": {
    "id": 67,
    "hospital_name": "City Hospital",
    "address": "123 Main St",
    "phone": "+0987654321",
    "email": "info@cityhospital.com",
    "total_ratings": 250,
    "average_rating": "4.30",
    "five_star_count": 150,
    "four_star_count": 70,
    "three_star_count": 20,
    "two_star_count": 8,
    "one_star_count": 2,
    "first_rating_date": "2024-01-15T10:30:00Z",
    "last_rating_date": "2024-05-04T19:20:00Z"
  }
}

---

/**
 * 3. GET DETAILED HOSPITAL RATINGS
 * Method: GET
 * Endpoint: /api/feedback/hospital/hospital/67/details?period=30
 * Auth: Not required
 */

// Response (200):
{
  "success": true,
  "hospital_id": 67,
  "period": "30 days",
  "category_ratings": {
    "avg_staff_courtesy": "4.50",
    "avg_treatment_quality": "4.30",
    "avg_facility_cleanliness": "4.60",
    "avg_wait_time": "3.20",
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

---

/**
 * 4. CALCULATE HOSPITAL PERFORMANCE SCORE
 * Method: POST
 * Endpoint: /api/feedback/hospital/hospital/67/calculate-score
 * Auth: Not required (typically called by system)
 */

// Response (200):
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

---

// ============================================================================
// CURL EXAMPLES
// ============================================================================

// Submit rating via curl
curl -X POST http://localhost:3000/api/feedback/ratings/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "dispatch_id": 123,
    "driver_id": 45,
    "rating": 5,
    "service_type": "driver_conduct"
  }'

// Get trends via curl
curl http://localhost:3000/api/feedback/analytics/trends?period=30 \
  -H "Authorization: Bearer YOUR_TOKEN"

// Get driver performance via curl
curl http://localhost:3000/api/feedback/driver-performance/driver/45/overall \
  -H "Authorization: Bearer YOUR_TOKEN"

---

// ============================================================================
// ERROR RESPONSE EXAMPLES
// ============================================================================

// 400 - Bad Request
{
  "success": false,
  "message": "Rating must be between 1 and 5",
  "error": "Validation error"
}

// 401 - Unauthorized
{
  "success": false,
  "message": "Missing or invalid authorization token",
  "error": "Unauthorized"
}

// 403 - Forbidden
{
  "success": false,
  "message": "Unauthorized to update this rating",
  "error": "Forbidden"
}

// 404 - Not Found
{
  "success": false,
  "message": "Feedback not found"
}

// 409 - Conflict
{
  "success": false,
  "message": "Rating already submitted for this service type"
}

// 500 - Server Error
{
  "success": false,
  "message": "Failed to submit rating",
  "error": "Database connection error"
}
