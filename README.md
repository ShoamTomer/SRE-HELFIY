# Full-Stack Application with CDC Monitoring

A full-stack application with authentication, database integration, and real-time
change-data-capture (CDC) monitoring. Every login is logged in structured JSON, and
every database change (insert/update/delete) is captured from the MySQL binary log via
Debezium, streamed through Kafka, and logged by a dedicated Node.js consumer.

## Architecture

```
Browser (client)  ──HTTP──>  API (Express)  ──>  MySQL
                                  │                 │
                              log4js JSON       binary log
                              login logs            │
                                                Debezium (Kafka Connect)
                                                    │
                                                  Kafka topic
                                                    │
                                              Consumer (Node.js)
                                                    │
                                              log4js JSON change logs
```

### Data flow for a database change

1. A row is inserted/updated/deleted in MySQL.
2. MySQL records the change in its binary log (binlog).
3. Debezium, running inside Kafka Connect, reads the binlog (connecting as if it were a
   MySQL replica) and publishes a change event to a Kafka topic
   (`dbserver1.appdb.<table>`).
4. The Node.js consumer subscribes to those topics, parses each Debezium event, and logs
   it to the console in structured JSON.

## Services

| Service          | Description                                                        |
|------------------|--------------------------------------------------------------------|
| `mysql`          | MySQL 8.0 database. Binary logging enabled for CDC.                 |
| `api`            | Node.js / Express REST API. Handles login and token auth.          |
| `client`         | Static HTML login page served by nginx.                            |
| `zookeeper`      | Coordinates the Kafka broker.                                      |
| `kafka`          | Message broker that holds the change-event topics.                 |
| `connect`        | Kafka Connect with the Debezium MySQL connector plugin.            |
| `connector-init` | One-shot container that registers the Debezium connector on startup.|
| `consumer`       | Node.js Kafka consumer that logs database changes in JSON.         |

## Technology Stack

- **Frontend:** Basic HTML + fetch
- **Backend:** Node.js with Express.js
- **Database:** MySQL 8.0 with Debezium CDC
- **Message Queue:** Apache Kafka (with Zookeeper)
- **Containerization:** Docker & Docker Compose
- **Logging:** log4js (structured JSON)

## Prerequisites

- Docker Desktop installed and running.

## Running the Project

The entire stack starts with a single command:

```bash
docker compose up -d --build
```

This will:

1. Build and start all services.
2. Initialize the MySQL database, creating the `users` and `tokens` tables and a default
   user (via `db/init.sql`).
3. Automatically register the Debezium connector once Kafka Connect and MySQL are ready
   (via the `connector-init` service).
4. Start the consumer, which begins logging database changes.

Allow roughly 60 seconds on a cold start for all services to become ready (MySQL
initialization and Kafka Connect startup are the slowest).

### Accessing the application

- **Login page:** http://localhost:8080
- **API:** http://localhost:3000
- **Kafka Connect REST API:** http://localhost:8083

### Default credentials

| Username | Password      |
|----------|---------------|
| `admin`  | `password123` |

## Verifying It Works

**1. Log in via the browser**

Open http://localhost:8080 and log in with the default credentials. You should see
"Login successful. Token saved."

View the login log (structured JSON with timestamp, user ID, action, IP):

```bash
docker compose logs api
```

**2. Make a database change and watch it captured**

```bash
docker exec -it mysql mysql -uroot -proot appdb -e "UPDATE users SET password='demo' WHERE username='admin';"
```

View the consumer log to see the change event:

```bash
docker compose logs consumer
```

You should see a structured JSON line with the operation type and before/after state.

## Component Details

### Authentication (API)

- Passwords are stored as **bcrypt hashes**, never plaintext. On login, the submitted
  password is compared against the stored hash with `bcrypt.compare` (a one-way check).
- All SQL uses **parameterized queries** (`?` placeholders) to prevent SQL injection.
- On successful login, a random token is generated with Node's `crypto` module, stored in
  the `tokens` table, and returned to the client. The client sends it back in the
  `x-auth-token` header for authenticated requests.
- A **connection pool** is used so concurrent requests do not contend over a single
  database connection.

### Login logging (log4js)

Every successful login writes a JSON log entry to the console containing `timestamp`,
`userId`, `action`, and `ip`. A custom log4js layout is used to serialize the log object
to clean JSON.

### Database initialization

On first startup, MySQL automatically runs `db/init.sql` (mounted into
`/docker-entrypoint-initdb.d`), which creates the tables and inserts the default user
with a pre-computed bcrypt hash. No manual seeding is required.

### Change Data Capture (Debezium)

- MySQL is configured with `--log-bin`, `--binlog-format=ROW`, and
  `--binlog-row-image=FULL` so that full row-level changes are recorded in the binary log.
- The Debezium MySQL connector connects as a replica (using a unique `database.server.id`)
  and reads the binlog.
- On first connection it takes a **snapshot** of existing rows (events with `op: "r"`),
  then streams subsequent changes live (`op: "c"` create, `u` update, `d` delete).
- Each event contains a `before` and `after` representation of the row, allowing the exact
  change to be reconstructed.
- The connector is registered automatically at startup by the `connector-init` service,
  which waits for both Kafka Connect and MySQL to be ready before posting the connector
  configuration.

### Consumer

The Node.js consumer (using `kafkajs`) subscribes to the Debezium topics, parses each
event's payload, and logs a structured JSON line containing the table, operation, and
before/after state. It belongs to a Kafka **consumer group**, which tracks processing
offsets so it resumes from where it left off after a restart.

## Notes / Possible Improvements

- **Startup ordering:** services tolerate dependencies not yet being ready through client
  retry logic. A more deterministic approach would use Docker healthchecks with
  `depends_on: condition: service_healthy`.
- **Credentials:** database and token secrets are hardcoded for the assignment. In
  production these would be injected via secrets management, and Debezium would use a
  dedicated user with only the required replication privileges rather than `root`.
- **Token storage:** the client stores its token in `localStorage` for simplicity;
  httpOnly cookies would be more resistant to XSS.

## Project Structure

```
.
├── api/                  Express API (auth, logging)
│   ├── main-app-layout.js  App init and routes
│   ├── db.js               MySQL connection pool
│   ├── logger.js           log4js JSON logger
│   └── Dockerfile
├── client/               Static login page (nginx)
│   ├── index.html
│   └── Dockerfile
├── consumer/             Kafka consumer (CDC logging)
│   ├── consumer.js
│   ├── logger.js
│   └── Dockerfile
├── connector/            Debezium connector config + registration
│   ├── register-mysql.json
│   └── register.sh
├── db/
│   └── init.sql          Schema + default user
└── docker-compose.yml
```