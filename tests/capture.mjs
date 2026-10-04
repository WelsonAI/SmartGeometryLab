import { writeFile } from "node:fs/promises";

const endpoint = process.argv[2] || "http://127.0.0.1:9445";
const targetUrl = process.argv[3] || "file:///C:/Users/User/Desktop/SmartGeometryLab/index.html";
const targets = await fetch(endpoint + "/json/list").then(response => response.json());
const target = targets.find(item => item.type === "page");
if (!target) throw new Error("No browser page target.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
});

function send(method, params = {}) {
  const callId = ++id;
  socket.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function capture({ width, height, grade, mode, activity, lang, output, after }) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Page.navigate", { url: targetUrl });
  await new Promise(resolve => setTimeout(resolve, 600));
  await evaluate("(() => { const g=document.getElementById('gradeSelect'); g.value='" + grade + "'; g.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('[data-mode=" + mode + "]').click(); const a=document.getElementById('activitySelect'); a.value='" + activity + "'; a.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('[data-lang=" + lang + "]').click(); })()");
  if (after) await evaluate(after);
  await new Promise(resolve => setTimeout(resolve, 150));
  const size = await evaluate("({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})");
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
  await writeFile(output, Buffer.from(screenshot.data, "base64"));
  console.log(output + " " + size.width + "x" + size.height);
}

await send("Page.enable");
await send("Runtime.enable");
await capture({ width: 1440, height: 1000, grade: 2, mode: "shape", activity: "shapeExplorer", lang: "zh", output: "review-shape-3d-desktop.png", after: "(() => { document.querySelector(\"[data-property='1']\").click(); })()" });
await capture({ width: 1440, height: 1000, grade: 2, mode: "shape", activity: "netBuilder", lang: "zh", output: "review-net-3d-desktop.png", after: "(() => { for(let i=0;i<5;i++) document.getElementById('nextFold').click(); })()" });
await capture({ width: 1440, height: 1000, grade: 3, mode: "shape", activity: "symmetryLab", lang: "zh", output: "review-symmetry-desktop.png" });
await capture({ width: 1440, height: 1000, grade: 4, mode: "line", activity: "lineLab", lang: "zh", output: "review-line-drag-desktop.png", after: "(() => { state.tool.angleA=25; state.tool.angleB=108; renderTool(); })()" });
await capture({ width: 1440, height: 1000, grade: 4, mode: "measure", activity: "perimeterLab", lang: "zh", output: "review-perimeter-desktop.png", after: "(() => { document.querySelector('[data-per-shape=square]').click(); })()" });
await capture({ width: 1440, height: 1000, grade: 6, mode: "shape", activity: "circleLab", lang: "zh", output: "review-circle-desktop.png", after: "(() => { state.tool.draw=315; renderTool(); })()" });
await capture({ width: 390, height: 844, grade: 2, mode: "shape", activity: "shapeExplorer", lang: "zh", output: "review-shape-3d-mobile.png" });
await capture({ width: 390, height: 844, grade: 3, mode: "shape", activity: "symmetryLab", lang: "zh", output: "review-symmetry-mobile.png" });
socket.close();
