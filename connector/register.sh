#!/bin/bash
echo "Waiting for Kafka Connect to be ready..."
until curl -s http://connect:8083/connectors > /dev/null; do
  sleep 2
done
echo "Kafka Connect is up."

echo "Waiting for MySQL to be reachable..."
until curl -s connect:8083 > /dev/null && nc -z mysql 3306; do
  sleep 2
done
echo "MySQL port is open. Giving it a moment to fully initialize..."
sleep 10

echo "Registering connector..."
curl -s -X POST -H "Content-Type: application/json" \
  --data @/config/register-mysql.json \
  http://connect:8083/connectors
echo "Connector registration request sent."