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
