## Components

1. A cron job that reads inverter metrics periodically
2. A notification service that can send whatsapp, in-app and email notifications
3. A notification socket gateway
4. A worker for each kind of notification delivery

### Cron Job

- Queries the db for unresolved alerts
- Checks if notification has been sent
- Queues notification job
- Marks notification delivery status as pending

### Whatsapp Worker (bullmq)

- Creates notification details


# Endpoints

- GET /alerts/summary
- GET /alerts?type=${query}&is_read={boolean}
- PATCH /alerts/:id/resolve