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
const runtimeErrors = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
});

function send(method, params = {}) {
  const callId = ++id;
  socket.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: targetUrl });
await new Promise(resolve => setTimeout(resolve, 900));

const initial = await evaluate(`(() => ({
  grades:[...document.querySelectorAll("#gradeSelect option")].map(option => option.value),
  modes:[...document.querySelectorAll("[data-mode]")].map(button => button.dataset.mode),
  title:document.querySelector("h1").textContent,
  noListening:!document.getElementById("listenButton"),
  backgroundLoaded:document.querySelector(".forest-footer img").complete && document.querySelector(".forest-footer img").naturalWidth > 0,
  overflow:document.documentElement.scrollWidth-window.innerWidth
}))()`);

if (initial.grades.join(",") !== "2,3,4,5,6") throw new Error("Unexpected grades: " + initial.grades);
if (initial.modes.join(",") !== "shape,line,measure") throw new Error("Unexpected modes: " + initial.modes);
if (!initial.noListening) throw new Error("Listening controls must not exist.");
if (!initial.backgroundLoaded) throw new Error("Forest background failed to load.");
if (initial.overflow > 1) throw new Error("Initial mobile overflow: " + initial.overflow);

const expected = {
  2:{shape:["shapeExplorer","netBuilder","shapeDrawer"]},
  3:{shape:["prismLab","symmetryLab","patternLab"]},
  4:{line:["angleLab","lineLab"],measure:["perimeterLab","areaLab","volumeLab"]},
  5:{shape:["polygonLab"],measure:["compositeArea","compositeVolume"]},
  6:{shape:["polygonLab","circleLab"],line:["angleLab"]}
};

const covered = [];
for (const [grade, modes] of Object.entries(expected)) {
  for (const [mode, activities] of Object.entries(modes)) {
    const result = await evaluate(`(() => {
      const gradeSelect=document.getElementById("gradeSelect");
      gradeSelect.value=${JSON.stringify(grade)};
      gradeSelect.dispatchEvent(new Event("change",{bubbles:true}));
      document.querySelector("[data-mode=${mode}]").click();
      const list=[...document.querySelectorAll("#activitySelect option")].map(option=>option.value);
      const checks=[];
      for(const activity of list){
        const select=document.getElementById("activitySelect");
        select.value=activity;
        select.dispatchEvent(new Event("change",{bubbles:true}));
        checks.push({
          activity,
          stage:document.querySelectorAll("#visualStage > *").length,
          controls:document.querySelectorAll("#controlArea button,#controlArea input").length,
          guideSteps:document.querySelectorAll("#toolGuide .tool-guide-step").length,
          summary:document.getElementById("liveSummary").textContent.trim().length,
          overflow:document.documentElement.scrollWidth-window.innerWidth
        });
      }
      return {list,checks};
    })()`);
    if (result.list.join(",") !== activities.join(",")) throw new Error(grade + "/" + mode + " mismatch: " + result.list);
    if (result.checks.some(check => !check.stage || !check.controls || check.guideSteps !== 3 || !check.summary || check.overflow > 1)) throw new Error(grade + "/" + mode + " incomplete: " + JSON.stringify(result.checks));
    covered.push(...result.list);
  }
}
if (new Set(covered).size !== 15) throw new Error("Unexpected unique tool count: " + new Set(covered).size);

const interactions = await evaluate(`(() => {
  const choose=(grade,mode,activity)=>{
    const gradeSelect=document.getElementById("gradeSelect");
    gradeSelect.value=String(grade);
    gradeSelect.dispatchEvent(new Event("change",{bubbles:true}));
    document.querySelector("[data-mode="+mode+"]").click();
    const select=document.getElementById("activitySelect");
    select.value=activity;
    select.dispatchEvent(new Event("change",{bubbles:true}));
  };

  choose(2,"shape","shapeDrawer");
  document.getElementById("randomExample").click();
  const draw={closed:state.tool.closed,points:state.tool.points.length};

  choose(2,"shape","shapeExplorer");
  const shapeDefaults={rotation:state.tool.rotation,pyramidLabels:0};
  document.querySelector("[data-shape=pyramid]").click();
  shapeDefaults.pyramidLabels=document.querySelectorAll(".shape-picture .diagram-label").length;

  choose(2,"shape","netBuilder");
  const net={initialStep:state.tool.step,steps:[]};
  for(let i=0;i<5;i++){
    document.getElementById("nextFold").click();
    net.steps.push({step:state.tool.step,faces:document.querySelectorAll(".cube-face").length});
  }
  net.numbers=[...document.querySelectorAll(".cube-face-number")].map(node=>node.textContent).sort().join(",");
  net.summary=document.getElementById("liveSummary").textContent;

  choose(3,"shape","symmetryLab");
  const beforeCells=state.tool.cells.length;
  document.querySelector(".mirror-cell.left").click();
  const symmetry={before:beforeCells,after:state.tool.cells.length,mirrors:document.querySelectorAll(".mirror-cell.mirrored").length,axis:document.querySelector(".symmetry-axis-label")?.textContent};

  choose(4,"line","angleLab");
  const angle={initial:state.tool.angle,step:document.getElementById("angleRange").step};
  document.getElementById("anglePlus1").click();
  document.getElementById("anglePlus1").click();
  document.getElementById("angleMinus1").click();
  angle.oneDegree=state.tool.angle;
  const board=document.getElementById("angleBoard");
  const handle=document.getElementById("angleHandle");
  const rect=board.getBoundingClientRect();
  const wanted=37*Math.PI/180;
  const clientX=rect.left+(250+Math.cos(wanted)*155)/500*rect.width;
  const clientY=rect.top+(225-Math.sin(wanted)*155)/260*rect.height;
  handle.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,clientX:rect.left+rect.width*.81,clientY:rect.top+rect.height*.865}));
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,clientX,clientY}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,clientX,clientY}));
  angle.dragValue=state.tool.angle;
  angle.diagram=document.querySelector(".angle-value-label")?.textContent;
  angle.summary=document.getElementById("liveSummary").textContent;

  choose(4,"line","lineLab");
  const lineDefaults={a:state.tool.angleA,b:state.tool.angleB};
  document.getElementById("snapPerpendicular").click();
  const perpendicular={...lineDefaults,difference:Math.abs(state.tool.angleB-state.tool.angleA)%180,summary:document.getElementById("liveSummary").textContent,labels:document.querySelectorAll(".line-lab-svg .diagram-label").length};

  choose(4,"measure","areaLab");
  document.querySelector("[data-area-shape=triangle]").click();
  document.getElementById("areaWidth").value="8";
  document.getElementById("areaWidth").dispatchEvent(new Event("input",{bubbles:true}));
  document.getElementById("areaHeight").value="5";
  document.getElementById("areaHeight").dispatchEvent(new Event("input",{bubbles:true}));
  const area={shape:state.tool.shape,summary:document.getElementById("liveSummary").textContent};

  choose(4,"measure","volumeLab");
  document.getElementById("volLength").value="5";
  document.getElementById("volLength").dispatchEvent(new Event("input",{bubbles:true}));
  const volume={cubes:document.querySelectorAll(".iso-top").length,summary:document.getElementById("liveSummary").textContent};

  choose(6,"shape","polygonLab");
  document.getElementById("polySides").value="8";
  document.getElementById("polySides").dispatchEvent(new Event("input",{bubbles:true}));
  const polygon={sides:state.tool.sides,summary:document.getElementById("liveSummary").textContent};

  choose(6,"shape","circleLab");
  const circleDefault=state.tool.draw;
  document.getElementById("circleRadius").value="70";
  document.getElementById("circleRadius").dispatchEvent(new Event("input",{bubbles:true}));
  const circle={defaultDraw:circleDefault,radius:state.tool.radius,summary:document.getElementById("liveSummary").textContent,labels:[...document.querySelectorAll(".circle-wrap .diagram-label")].map(node=>node.textContent).join("|")};

  choose(5,"measure","compositeArea");
  document.getElementById("teacherButton").click();
  const first=document.getElementById("teacherField0");
  first.value="10";
  document.getElementById("useTeacherSettings").click();
  const teacher={open:document.getElementById("teacherDialog").open,width:state.tool.width};

  document.querySelector("[data-lang=zh]").click();
  const zh={lang:document.documentElement.lang,title:document.querySelector("h1").textContent,overflow:document.documentElement.scrollWidth-window.innerWidth};

  return {draw,shapeDefaults,net,symmetry,angle,perpendicular,area,volume,polygon,circle,teacher,zh};
})()`);

if (!interactions.draw.closed || interactions.draw.points < 3) throw new Error("Drawing board failed.");
if (interactions.shapeDefaults.rotation !== 0 || interactions.shapeDefaults.pyramidLabels < 4) throw new Error("Shape defaults or labels failed.");
if (interactions.net.initialStep !== 0 || interactions.net.steps.map(item=>item.faces).join(",") !== "2,3,4,5,6" || interactions.net.numbers !== "1,2,3,4,5,6" || !interactions.net.summary.includes("6")) throw new Error("Step-by-step cube net failed: " + JSON.stringify(interactions.net));
if (interactions.symmetry.before === interactions.symmetry.after || interactions.symmetry.mirrors < 0 || !interactions.symmetry.axis) throw new Error("Symmetry board failed.");
if (interactions.angle.initial !== 0 || interactions.angle.step !== "1" || interactions.angle.oneDegree !== 1 || interactions.angle.dragValue !== 37 || interactions.angle.diagram !== "37°" || !interactions.angle.summary.includes("37")) throw new Error("Angle lab failed: " + JSON.stringify(interactions.angle));
if (interactions.perpendicular.a !== 0 || interactions.perpendicular.b !== 0 || interactions.perpendicular.difference !== 90 || interactions.perpendicular.labels < 2) throw new Error("Line lab failed: " + JSON.stringify(interactions.perpendicular));
if (interactions.area.shape !== "triangle" || !interactions.area.summary.includes("20")) throw new Error("Area board failed.");
if (interactions.volume.cubes !== 30 || !interactions.volume.summary.includes("30")) throw new Error("Volume board failed.");
if (interactions.polygon.sides !== 8 || !interactions.polygon.summary.includes("1080")) throw new Error("Polygon lab failed.");
if (interactions.circle.defaultDraw !== 0 || interactions.circle.radius !== 70 || !interactions.circle.summary.includes("140") || !interactions.circle.labels.includes("r = 70") || !interactions.circle.labels.includes("d = 140")) throw new Error("Circle lab failed.");
if (interactions.teacher.open || interactions.teacher.width !== 10) throw new Error("Teacher settings failed.");
if (interactions.zh.lang !== "zh-Hans" || !interactions.zh.title.includes("几何") || interactions.zh.overflow > 1) throw new Error("Chinese UI failed.");
if (runtimeErrors.length) throw new Error("Runtime errors: " + runtimeErrors.join(" | "));

console.log(JSON.stringify({ ok:true, uniqueTools:new Set(covered).size, initial, interactions }, null, 2));
socket.close();

