# Notifications & Analytics Features

## Overview
Complete notifications system and analytics dashboard implemented for the AKGEC Canteen system.

## Features Implemented

### 1. In-App Notifications
- **Notification Bell Component**: Real-time notification indicator with unread count
- **Notification Center**: Sheet drawer showing all notifications
- **Real-time Updates**: Using Supabase realtime for instant notifications
- **Read/Unread Tracking**: Mark individual or all notifications as read
- **Notification Types**: order, payment, system, promotion

### 2. Email Notifications
- **Resend Integration**: Professional email sending via Resend.com
- **Email Queue System**: Reliable async email processing
- **Order Confirmations**: Automatic email when order is placed
- **Queue Processing**: Edge function processes pending emails every 5 minutes
- **Retry Logic**: Failed emails automatically retried up to 3 times

### 3. Analytics Dashboard
- **Key Metrics Cards**:
  - Total Revenue (last 30 days)
  - Total Orders
  - Unique Customers
  - Average Order Value

- **Charts & Visualizations**:
  - Sales Trend Line Chart (30-day revenue & order trends)
  - Peak Hours Bar Chart (busiest hours analysis)
  - Top 10 Items Revenue Bar Chart
  - Revenue Distribution Pie Chart

- **Analytics Tables**:
  - `item_stats`: Daily statistics per menu item
  - Sales summary view
  - Peak hours analysis view
  - Top items view

### 4. Database Views
- **sales_summary**: Daily aggregated sales data
- **peak_hours**: Hourly order patterns (30-day window)
- **top_items**: Best-selling items by revenue

## Usage

### Notifications
Notifications appear automatically when:
- Order is placed
- Order status changes
- Payment is processed
- System announcements

Access via the bell icon in the navbar (shows unread count).

### Email Setup
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain at [resend.com/domains](https://resend.com/domains)
3. Create API key at [resend.com/api-keys](https://resend.com/api-keys)
4. API key has been added as `RESEND_API_KEY` secret

### Analytics Access
- **Owner Role**: Navigate to `/analytics` via navbar "Analytics" button
- **Views Available**:
  - 30-day sales trends
  - Peak hour analysis
  - Top performing items
  - Revenue distribution

## Edge Functions

### send-email
**Path**: `supabase/functions/send-email/index.ts`
**Purpose**: Send individual emails via Resend
**Auth**: Public (verify_jwt = false)

### process-email-queue
**Path**: `supabase/functions/process-email-queue/index.ts`
**Purpose**: Process queued emails (runs via cron every 5 minutes)
**Auth**: Public (verify_jwt = false)

## Database Functions

### create_notification(user_id, title, message, type, metadata)
Creates a notification for a user.

### queue_email(user_id, to_email, subject, html_content)
Adds an email to the processing queue.

### update_item_stats()
Updates daily statistics for all menu items.

## Automated Tasks (Manual Setup Required)

Note: Cron jobs need to be manually configured as pg_cron extension wasn't available.

You can manually trigger these operations:

1. **Process Email Queue**:
```javascript
// Call via frontend or manually
await supabase.functions.invoke('process-email-queue')
```

2. **Update Item Stats**:
```sql
-- Run via SQL editor
SELECT update_item_stats();
```

3. **Cleanup Rate Limits**:
```sql
-- Run via SQL editor
SELECT cleanup_old_rate_limits();
```

## Components

### NotificationBell
**Location**: `src/components/NotificationBell.tsx`
**Props**: `userId: string`
**Features**:
- Real-time notification updates
- Unread count badge
- Mark as read functionality
- Mark all as read

### Analytics Dashboard
**Location**: `src/pages/Analytics.tsx`
**Access**: `/analytics` route
**Features**:
- Responsive charts using Recharts
- Key metrics overview
- Multiple visualization types
- 30-day data window

## Navigation

- `/analytics` - Analytics Dashboard (Owner only)
- `/audit-logs` - Audit Logs (Admin only)
- Notification Bell - Available to all logged-in users

## Security

- All tables have RLS policies
- Email queue only accessible via service role
- Notifications scoped to user
- Analytics restricted to owner role
- Audit logs restricted to admin role

## Email Templates

Emails are sent as HTML with order details including:
- Order confirmation
- Ticket number
- Item details (name, quantity, price)
- Estimated ready time

Customize email templates in `supabase/functions/place-order/index.ts` where `queue_email` is called.

## Analytics Data Collection

Item stats are collected via the `update_item_stats()` function which should be run daily. This aggregates:
- Total orders per item
- Total quantity sold
- Total revenue
- Average order value

## Troubleshooting

### Emails Not Sending
1. Check RESEND_API_KEY is set correctly
2. Verify domain is verified in Resend dashboard
3. Check email_queue table for failed emails
4. Review logs in `process-email-queue` edge function

### Notifications Not Appearing
1. Verify realtime is enabled for notifications table
2. Check browser console for WebSocket errors
3. Verify user is authenticated
4. Check notifications table has entries for the user

### Analytics Not Loading
1. Verify user has owner role
2. Check if orders exist in database
3. Run `update_item_stats()` to populate data
4. Check browser console for query errors

## Future Enhancements
- SMS notifications (requires Twilio integration)
- Push notifications (requires service worker)
- Export analytics to PDF/CSV
- Custom date range selection
- More granular analytics filtering
- Email templates with React Email
- Scheduled promotional campaigns
