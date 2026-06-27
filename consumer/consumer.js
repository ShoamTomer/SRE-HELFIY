const { Kafka } = require("kafkajs");
const logger = require("./logger");

const kafka = new Kafka({
  clientId: "db-change-consumer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "db-change-group" });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: "dbserver1.appdb.users", fromBeginning: true });
  await consumer.subscribe({ topic: "dbserver1.appdb.tokens", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const payload = event.payload;
      if (!payload) return;

      logger.info({
        timestamp: new Date().toISOString(),
        source: "cdc",
        table: payload.source.table,
        operation: payload.op,
        before: payload.before,
        after: payload.after,
      });
    },
  });
}

run().catch((err) => {
  console.error("CONSUMER ERROR:", err);
  process.exit(1);
});