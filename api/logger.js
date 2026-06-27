const log4js = require("log4js");

log4js.addLayout("json", function () {
  return function (logEvent) {
    return JSON.stringify(logEvent.data[0]);
  };
});

log4js.configure({
  appenders: {
    out: { type: "stdout", layout: { type: "json" } },
  },
  categories: {
    default: { appenders: ["out"], level: "info" },
  },
});

module.exports = log4js.getLogger();