const fs = require("fs");

const required = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "README.md",
  "LICENSE",
  "assets/favicon.svg"
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`);
    process.exit(1);
  }
}

const html = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

const checks = [
  [html.includes('id="hookForm"'), "index.html must include hookForm"],
  [html.includes('app.js'), "index.html must load app.js"],
  [css.includes(":root"), "styles.css must include CSS variables"],
  [js.includes("function analyzeHook"), "app.js must include analyzeHook"],
  [manifest.name === "Social Media Hook Analyzer", "manifest name must be correct"]
];

for (const [ok, message] of checks) {
  if (!ok) {
    console.error(message);
    process.exit(1);
  }
}

console.log("Smoke test passed.");


const estimateStart = js.indexOf("function estimateSuggestionScore");
const cryptoStart = js.indexOf("function cryptoRandomId");
if (estimateStart === -1 || cryptoStart === -1 || cryptoStart <= estimateStart) {
  console.error("estimateSuggestionScore function block could not be detected");
  process.exit(1);
}
const estimateBlock = js.slice(estimateStart, cryptoStart);
if (estimateBlock.includes("analyzeHook(")) {
  console.error("Regression: estimateSuggestionScore must not call analyzeHook");
  process.exit(1);
}
