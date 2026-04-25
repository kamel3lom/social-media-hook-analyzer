const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const checks = [
  [html.includes("html2canvas"), "Poster export library missing"],
  [html.includes("posterpng"), "Poster button missing"],
  [app.includes("getClassSpec"), "Class specs missing"],
  [app.includes("classifyImageForMap"), "Classification engine missing"],
  [app.includes("downloadPosterPNG"), "Poster export function missing"],
  [app.includes("makeClassLegendHtml"), "Class legend function missing"],
  [app.includes("displayImg.getMap"), "Map must use classified display image"]
];

for (const [ok, msg] of checks) {
  if (!ok) {
    console.error(msg);
    process.exit(1);
  }
}
console.log("Smoke test passed.");
