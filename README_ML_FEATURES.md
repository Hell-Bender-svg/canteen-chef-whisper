# ML-Powered Recommendations & Demand Forecasting

This document describes the machine learning features implemented in the canteen system.

## Features Implemented

### 1. Personalized Recommendations (ML-Powered)

**Database Tables:**
- `user_preferences` - Stores user preference scores based on order history
- `user_similarity` - Stores collaborative filtering similarity matrix

**Edge Functions:**
- `personalized-recommendations` - Generates personalized recommendations using hybrid ML approach
- `calculate-user-similarity` - Computes user similarity matrix for collaborative filtering

**Algorithm:**
The system uses a **hybrid recommendation approach** combining:
1. **User Preference Scores**: Based on individual order history with time decay
2. **Collaborative Filtering**: Finds similar users and recommends items they liked
3. **Popularity Baseline**: Falls back to popular items for cold-start scenarios

**Score Calculation:**
```
Final Score = (User Preference × 1.5) + (Collaborative Score × 1.2) + (Popularity × 0.5)
```

**Time Decay:**
- Orders within 7 days: 100% weight
- Orders within 30 days: 80% weight
- Orders within 90 days: 50% weight
- Older orders: 30% weight

### 2. Stock Demand Forecasting

**Database Tables:**
- `item_forecast` - Stores predicted demand for menu items

**Edge Functions:**
- `demand-forecast` - Generates demand forecasts using time-series analysis

**Algorithm:**
The system uses **moving average with trend adjustment**:
1. Calculate average from recent window (7 days for daily, 4 weeks for weekly)
2. Detect trend by comparing first half vs second half of window
3. Apply trend factor to project future demand
4. Calculate confidence score based on historical variance

**Forecast Types:**
- Daily forecasts: 7-day moving average
- Weekly forecasts: 4-week moving average
- Monthly forecasts: 3-month moving average

**Confidence Score:**
```
Confidence = max(0, min(1, 1 - (stdDev / avgQuantity)))
```

### 3. Automatic Preference Learning

**Triggers:**
- `trigger_update_user_preferences` - Automatically updates user preferences when orders are placed

**Preference Score Calculation:**
```
New Score = Old Score + (Quantity × 10)
```

## UI Components

### RecommendationCard
Displays both popularity-based and ML-powered recommendations with:
- Rank badges (🥇🥈🥉)
- Category tags
- Order counts / ML scores
- Time period indicators

### ForecastCard
Displays demand forecasts with:
- Trend indicators (increasing/decreasing/stable)
- Predicted quantity and revenue
- Confidence score
- Forecast date

### Tabs Interface
Users can switch between:
1. **Popular** - Time-filtered popularity recommendations
2. **For You** - Personalized ML recommendations (requires login)
3. **Forecasts** - Demand predictions for upcoming days

## API Endpoints

### Personalized Recommendations
```typescript
POST /functions/v1/personalized-recommendations
Authorization: Bearer <token>
Body: { 
  user_id: string,
  limit?: number 
}
```

### Demand Forecast
```typescript
POST /functions/v1/demand-forecast
Body: {
  item_id?: string,
  forecast_type?: 'daily' | 'weekly' | 'monthly',
  days_ahead?: number
}
```

### Calculate User Similarity
```typescript
POST /functions/v1/calculate-user-similarity
(No parameters - processes all users)
```

## Data Flow

### Order Placement → ML Learning
1. User places order
2. Trigger automatically updates `user_preferences` table
3. Preference score increases based on quantity
4. Time decay applied on subsequent fetches

### Generating Personalized Recommendations
1. Fetch user's preference data
2. Find similar users via collaborative filtering
3. Get items similar users liked
4. Combine with popularity baseline
5. Sort by hybrid score
6. Return top N items

### Generating Forecasts
1. Fetch 90 days of historical order data
2. Group by item and date
3. Calculate moving averages
4. Detect trends
5. Project future demand
6. Calculate confidence scores
7. Store in `item_forecast` table

## Performance Optimizations

- **Indexes** on user_id, item_id, and scores for fast lookups
- **Batch processing** for similarity calculations
- **Materialized results** stored in forecast table
- **Efficient queries** using Supabase's query builder

## Future Enhancements

- Real-time model updates via webhooks
- Deep learning models for better predictions
- Multi-objective optimization (revenue + waste reduction)
- A/B testing framework for recommendation strategies
- Seasonal pattern detection
- Weather-based demand adjustments
