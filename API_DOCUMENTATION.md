# Ram Lal Anand Canteen Recommendation System

## Overview

A machine learning-powered recommendation system for the Ram Lal Anand College Canteen. The system analyzes order patterns to recommend popular menu items with time-based filtering capabilities.

## Features

✅ **ML-Powered Recommendations** - Popularity-based algorithm that learns from real orders
✅ **Time-Based Filtering** - Weekly, monthly, and all-time top dishes
✅ **RESTful API** - FastAPI-style endpoints via Supabase Edge Functions
✅ **Real-time Learning** - Automatically switches from mock data to real orders
✅ **Beautiful UI** - Modern, responsive web interface
✅ **Secure** - RLS policies protect user data

## Database Schema

### Tables

#### `menu_items`
- `id` (uuid, primary key)
- `name` (text, unique)
- `category` (text) - Beverages, South Indian, Snacks, Lunch, Sweets, Chinese
- `price` (decimal)
- `description` (text)
- `created_at` (timestamp)

#### `orders`
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users) - Optional for anonymous orders
- `item_id` (uuid, references menu_items)
- `quantity` (integer)
- `total_price` (decimal)
- `ordered_at` (timestamp)
- `created_at` (timestamp)

#### `recommendations`
- `id` (uuid, primary key)
- `item_id` (uuid, references menu_items)
- `recommendation_type` (text) - 'overall', 'weekly', 'monthly'
- `rank` (integer)
- `order_count` (integer)
- `time_period` (text) - e.g., '2024-W01', '2024-01'
- `created_at` (timestamp)
- `updated_at` (timestamp)

## API Endpoints

### 1. Get Recommendations

**Endpoint:** `POST /functions/v1/recommendations`

**Request Body:**
```json
{
  "type": "overall" | "weekly" | "monthly",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "type": "weekly",
  "time_period": "2024-W45",
  "recommendations": [
    {
      "rank": 1,
      "item": {
        "id": "uuid",
        "name": "Masala Dosa",
        "category": "South Indian",
        "price": 30.00
      },
      "order_count": 145,
      "recommendation_type": "weekly",
      "time_period": "2024-W45"
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{"type": "weekly", "limit": 10}'
```

### 2. Place Order

**Endpoint:** `POST /functions/v1/place-order`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "item_id": "uuid",
  "quantity": 2
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "user_id": "uuid",
    "item_id": "uuid",
    "quantity": 2,
    "total_price": 60.00,
    "ordered_at": "2024-11-02T10:30:00Z",
    "item": {
      "name": "Masala Dosa",
      "category": "South Indian",
      "price": 30.00
    }
  }
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/place-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"item_id": "item-uuid", "quantity": 2}'
```

### 3. Seed Mock Data

**Endpoint:** `POST /functions/v1/seed-mock-data`

**Description:** Generates 500 mock orders for testing the recommendation system

**Response:**
```json
{
  "success": true,
  "message": "Generated 500 mock orders",
  "inserted": 500
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/seed-mock-data
```

## ML Algorithm

### Popularity-Based Recommendation

The system uses a simple but effective popularity-based algorithm:

1. **Data Collection:** Aggregates all orders within the specified time period
2. **Scoring:** Calculates total quantity ordered for each menu item
3. **Ranking:** Sorts items by order count (descending)
4. **Caching:** Stores results in `recommendations` table for fast retrieval

### Time Filtering

- **Overall:** All-time popular items (no date filter)
- **Weekly:** Top items from the past 7 days
- **Monthly:** Top items from the current month

### Real Data Integration

The system automatically works with both:
- **Mock Data:** Initial dataset for testing (500 orders across 3 months)
- **Real Orders:** As users place orders, the algorithm incorporates them immediately

No code changes needed - the ML logic reads from the `orders` table regardless of data source.

## Mock Dataset

The seed function generates:
- 500 orders distributed over 3 months
- 70% bias towards popular items (Samosa, Masala Dosa, Pao Bhaji, etc.)
- 30% random orders for variety
- Realistic quantity distribution (1-3 items per order)
- Temporal distribution across days and times

## Menu Categories

1. **Beverages** - Hot Coffee, Tea, Lassi, etc.
2. **South Indian** - Dosa, Idli, Vada, Uttapam
3. **Snacks** - Samosa, Pakora, Sandwich, Burger
4. **Lunch** - Thali, Rice dishes, Curries
5. **Sweets** - Gulab Jamun, Jalebi, Laddu
6. **Chinese** - Noodles, Fried Rice, Momos

## Security

- **Row Level Security (RLS)** enabled on all tables
- **Public access** to menu items and recommendations
- **User-specific access** to personal orders
- **JWT authentication** required for placing orders
- **Anonymous orders** supported for mock data

## Frontend Features

- **Real-time recommendations** based on selected time period
- **Responsive design** optimized for mobile and desktop
- **Beautiful UI** with food-themed gradient design system
- **Interactive filters** for different time periods
- **Visual rankings** with medals for top 3 items
- **Category badges** for easy menu navigation

## Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** PostgreSQL with RLS
- **Authentication:** Supabase Auth
- **API Style:** RESTful (FastAPI-compatible)

## Future Enhancements

- Personalized recommendations based on user history
- Collaborative filtering (users who ordered X also ordered Y)
- Nutritional information and dietary preferences
- Order scheduling and notifications
- Integration with payment systems
- Mobile app with push notifications

## Getting Started

1. Generate mock data using the "Generate Mock Data" button
2. Explore recommendations with different time filters
3. Integrate the API into your own applications
4. Start placing real orders to enhance the ML model

## Support

For questions or issues, please refer to the Lovable Cloud documentation.