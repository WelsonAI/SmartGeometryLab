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
  const shapeDefaults={rotation:state.tool.rotation,faces:document.querySelectorAll("#shapeSolid3d .solid-face").length,faceLabels:document.querySelectorAll("#shapeSolid3d .solid-face-label").length,viewY:state.tool.viewY,pyramidLabels:0};
  const shapeSvg=document.getElementById("shapeSolid3d");
  shapeSvg.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerId:11,clientX:180,clientY:130}));
  shapeSvg.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,pointerId:11,clientX:240,clientY:160}));
  shapeSvg.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,pointerId:11,clientX:240,clientY:160}));
  shapeDefaults.draggedViewY=state.tool.viewY;
  document.querySelector("[data-property='1']").click();
  shapeDefaults.highlightedEdges=document.querySelectorAll("#shapeSolid3d .solid-edge.feature-active").length;
  document.querySelector("[data-property='2']").click();
  shapeDefaults.highlightedVertices=document.querySelectorAll("#shapeSolid3d .solid-vertex").length;
  document.querySelector("[data-shape=pyramid]").click();
  shapeDefaults.pyramidLabels=document.querySelectorAll("#shapeSolid3d .solid-face-label").length;
  document.querySelector("[data-shape=sphere]").click();
  shapeDefaults.sphereGrid=document.querySelectorAll("#shapeSolid3d .sphere-grid").length;
  document.querySelector("[data-shape=square]").click();
  shapeDefaults.planarEdges=document.querySelectorAll(".planar-edge").length;
  shapeDefaults.planarEdgeLabels=[...document.querySelectorAll(".planar-edge-label")].map(node=>node.textContent).join(",");
  document.querySelector("[data-property='1']").click();
  shapeDefaults.planarVertices=document.querySelectorAll(".planar-vertex").length;

  choose(2,"shape","netBuilder");
  const net={initialStep:state.tool.step,steps:[],shapeChoices:document.querySelectorAll("[data-net-shape]").length};
  for(let i=0;i<5;i++){
    document.getElementById("nextFold").click();
    net.steps.push({step:state.tool.step,faces:document.querySelectorAll("#netFold3d .solid-face").length,active:document.querySelectorAll("#netFold3d .folding-face-group.active").length});
  }
  net.numbers=[...document.querySelectorAll("#netFold3d .solid-face-label")].map(node=>node.textContent).sort().join(",");
  net.viewY=state.tool.viewY;
  const netSvg=document.getElementById("netFold3d");
  netSvg.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerId:12,clientX:180,clientY:130}));
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,pointerId:12,clientX:230,clientY:140}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,pointerId:12,clientX:230,clientY:140}));
  net.draggedViewY=state.tool.viewY;
  net.summary=document.getElementById("liveSummary").textContent;
  document.querySelector("[data-net-shape=pyramid]").click();
  net.pyramidFaces=document.querySelectorAll("#netFold3d .solid-face").length;
  net.pyramidMax=document.getElementById("foldStep").max;
  document.querySelector("[data-net-shape=cylinder]").click();
  net.cylinderFlatPieces=document.querySelectorAll("#netFold3d .net-piece").length;
  document.getElementById("nextFold").click();
  document.getElementById("nextFold").click();
  net.cylinderLabels=document.querySelectorAll("#netFold3d .solid-face-label").length;
  document.querySelector("[data-net-shape=cuboid]").click();
  document.getElementById("nextFold").click();
  net.cuboidFaces=document.querySelectorAll("#netFold3d .solid-face").length;

  choose(3,"shape","symmetryLab");
  const symmetry={source:document.querySelectorAll(".source-stamp").length,mirrors:document.querySelectorAll(".mirror-stamp").length,beforeX:state.tool.stamps[0].x};
  const stamp=document.querySelector(".source-stamp");
  const symmetryCanvas=document.getElementById("symmetryCanvas");
  const stampRect=symmetryCanvas.getBoundingClientRect();
  stamp.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerId:13,clientX:stampRect.left+80,clientY:stampRect.top+80}));
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,pointerId:13,clientX:stampRect.left+stampRect.width*.36,clientY:stampRect.top+stampRect.height*.62}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,pointerId:13,clientX:stampRect.left+stampRect.width*.36,clientY:stampRect.top+stampRect.height*.62}));
  symmetry.afterX=state.tool.stamps[0].x;
  symmetry.mirrorX=600-state.tool.stamps[0].x;
  document.querySelector("[data-symmetry-mode=grid]").click();
  const beforeCells=state.tool.cells.length;
  document.querySelector(".mirror-cell.left").click();
  const symmetryBoard=document.querySelector(".symmetry-board");
  const symmetryCells=[...document.querySelectorAll(".mirror-cell")].map(cell=>cell.getBoundingClientRect());
  const symmetryRect=symmetryBoard.getBoundingClientRect();
  const split=(symmetryCells[4].right+symmetryCells[5].left)/2;
  Object.assign(symmetry,{before:beforeCells,after:state.tool.cells.length,gridMirrors:document.querySelectorAll(".mirror-cell.mirrored").length,axis:document.querySelector(".symmetry-axis-label")?.textContent,axisOffset:Math.abs(split-(symmetryRect.left+symmetryRect.width/2))});

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
  const lineBoard=document.getElementById("lineBoard");
  const lineRect=lineBoard.getBoundingClientRect();
  const lineHandle=document.querySelector("[data-line-handle='A']");
  const lineWanted=33*Math.PI/180;
  const lineX=lineRect.left+(320+Math.cos(lineWanted)*230)/640*lineRect.width;
  const lineY=lineRect.top+(150-Math.sin(lineWanted)*230)/300*lineRect.height;
  lineHandle.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,clientX:lineRect.right-30,clientY:lineRect.top+lineRect.height/2}));
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,clientX:lineX,clientY:lineY}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,clientX:lineX,clientY:lineY}));
  lineDefaults.draggedA=state.tool.angleA;
  document.getElementById("snapPerpendicular").click();
  const arc=document.getElementById("lineAngleArc");
  const perpendicular={...lineDefaults,difference:Math.abs(state.tool.angleB-state.tool.angleA)%180,summary:document.getElementById("liveSummary").textContent,labels:document.querySelectorAll(".line-lab-svg .diagram-label").length,arcStart:arc?Number(arc.dataset.startAngle):null,arcEnd:arc?Number(arc.dataset.endAngle):null};

  choose(4,"measure","perimeterLab");
  document.querySelector("[data-per-shape=triangle]").click();
  const triangleBefore=document.getElementById("perimeterTriangle").getAttribute("points");
  const sideA=document.getElementById("perA");
  sideA.value="11";
  sideA.dispatchEvent(new Event("input",{bubbles:true}));
  const triangleAfter=document.getElementById("perimeterTriangle").getAttribute("points");
  const triangleShape={before:triangleBefore,after:triangleAfter,a:state.tool.a};
  document.querySelector("[data-per-shape=square]").click();
  const perimeterSvg=document.querySelector(".perimeter-svg");
  const perimeterRect=perimeterSvg.getBoundingClientRect();
  const perimeterLabels=[...perimeterSvg.querySelectorAll(".diagram-label")].map(node=>node.getBoundingClientRect());
  const perimeter={labels:perimeterLabels.length,allVisible:perimeterLabels.every(rect=>rect.top>=perimeterRect.top-1&&rect.bottom<=perimeterRect.bottom+1&&rect.left>=perimeterRect.left-1&&rect.right<=perimeterRect.right+1)};

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
  const volume={cubes:document.querySelectorAll(".iso-top").length,dimensions:document.querySelectorAll(".block-dimension").length,labels:[...document.querySelectorAll(".block-dimension text")].map(node=>node.textContent).join("|"),summary:document.getElementById("liveSummary").textContent};

  choose(6,"shape","polygonLab");
  document.getElementById("polySides").value="8";
  document.getElementById("polySides").dispatchEvent(new Event("input",{bubbles:true}));
  const polygon={sides:state.tool.sides,summary:document.getElementById("liveSummary").textContent};

  choose(6,"shape","circleLab");
  const circleDefault=state.tool.draw;
  document.getElementById("circleRadius").value="70";
  document.getElementById("circleRadius").dispatchEvent(new Event("input",{bubbles:true}));
  const circleBoard=document.getElementById("circleBoard");
  const circleRect=circleBoard.getBoundingClientRect();
  const circleHandle=document.getElementById("circleDragHandle");
  const circleWanted=315*Math.PI/180;
  const circleX=circleRect.left+(260+Math.cos(circleWanted)*70)/520*circleRect.width;
  const circleY=circleRect.top+(155+Math.sin(circleWanted)*70)/315*circleRect.height;
  circleHandle.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,clientX:circleRect.left+circleRect.width*.5,clientY:circleRect.top+circleRect.height*.5}));
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,clientX:circleX,clientY:circleY}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,clientX:circleX,clientY:circleY}));
  const circle={defaultDraw:circleDefault,radius:state.tool.radius,draggedDraw:state.tool.draw,step:document.getElementById("circleDraw").step,summary:document.getElementById("liveSummary").textContent,labels:[...document.querySelectorAll(".circle-wrap .diagram-label")].map(node=>node.textContent).join("|"),centre:document.querySelector(".centre-label")?.textContent};

  choose(5,"measure","compositeArea");
  document.getElementById("teacherButton").click();
  const first=document.getElementById("teacherField0");
  first.value="10";
  document.getElementById("useTeacherSettings").click();
  const teacher={open:document.getElementById("teacherDialog").open,width:state.tool.width};

  document.querySelector("[data-lang=zh]").click();
  const zh={lang:document.documentElement.lang,title:document.querySelector("h1").textContent,overflow:document.documentElement.scrollWidth-window.innerWidth};

  const dragRange=document.getElementById("compWidth");
  const dragRangeRect=dragRange.getBoundingClientRect();
  dragRange.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,clientX:dragRangeRect.left+dragRangeRect.width*.2,clientY:dragRangeRect.top+5}));
  const afterRangeDown=state.tool.width;
  window.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,cancelable:true,clientX:dragRangeRect.left+dragRangeRect.width*.8,clientY:dragRangeRect.top+5}));
  window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,clientX:dragRangeRect.left+dragRangeRect.width*.8,clientY:dragRangeRect.top+5}));
  const rangeStyle=getComputedStyle(document.getElementById("compWidth"));
  const ranges={cursor:rangeStyle.cursor,touchAction:rangeStyle.touchAction,afterDown:afterRangeDown,afterMove:state.tool.width};

  return {draw,shapeDefaults,net,symmetry,angle,perpendicular,triangleShape,perimeter,area,volume,polygon,circle,teacher,ranges,zh};
})()`);

if (!interactions.draw.closed || interactions.draw.points < 3) throw new Error("Drawing board failed.");
if (interactions.shapeDefaults.rotation !== 0 || interactions.shapeDefaults.faces !== 6 || interactions.shapeDefaults.faceLabels !== 6 || interactions.shapeDefaults.draggedViewY === interactions.shapeDefaults.viewY || interactions.shapeDefaults.highlightedEdges !== 12 || interactions.shapeDefaults.highlightedVertices !== 8 || interactions.shapeDefaults.pyramidLabels !== 5 || interactions.shapeDefaults.sphereGrid < 10 || interactions.shapeDefaults.planarEdges !== 4 || interactions.shapeDefaults.planarEdgeLabels !== "1,2,3,4" || interactions.shapeDefaults.planarVertices !== 4) throw new Error("Interactive shape explorer failed: " + JSON.stringify(interactions.shapeDefaults));
if (interactions.net.initialStep !== 0 || interactions.net.shapeChoices !== 4 || interactions.net.steps.map(item=>item.faces).join(",") !== "6,6,6,6,6" || interactions.net.steps.some(item=>item.active !== 1) || interactions.net.numbers !== "1,2,3,4,5,6" || interactions.net.draggedViewY === interactions.net.viewY || !interactions.net.summary.includes("6") || interactions.net.pyramidFaces !== 5 || interactions.net.pyramidMax !== "4" || interactions.net.cylinderFlatPieces !== 3 || interactions.net.cylinderLabels !== 3 || interactions.net.cuboidFaces !== 6) throw new Error("Step-by-step connected net failed: " + JSON.stringify(interactions.net));
if (interactions.symmetry.source !== interactions.symmetry.mirrors || interactions.symmetry.source < 1 || interactions.symmetry.beforeX === interactions.symmetry.afterX || Math.abs(interactions.symmetry.afterX + interactions.symmetry.mirrorX - 600) > .01 || interactions.symmetry.before === interactions.symmetry.after || interactions.symmetry.gridMirrors < 1 || !interactions.symmetry.axis || interactions.symmetry.axisOffset > 2) throw new Error("Symmetry board failed: " + JSON.stringify(interactions.symmetry));
if (interactions.angle.initial !== 0 || interactions.angle.step !== "1" || interactions.angle.oneDegree !== 1 || interactions.angle.dragValue !== 37 || interactions.angle.diagram !== "37°" || !interactions.angle.summary.includes("37")) throw new Error("Angle lab failed: " + JSON.stringify(interactions.angle));
if (interactions.perpendicular.a !== 0 || interactions.perpendicular.b !== 0 || interactions.perpendicular.draggedA !== 33 || interactions.perpendicular.difference !== 90 || interactions.perpendicular.labels < 2) throw new Error("Line lab failed: " + JSON.stringify(interactions.perpendicular));
if (interactions.triangleShape.a !== 11 || interactions.triangleShape.before === interactions.triangleShape.after) throw new Error("Triangle did not reshape with its side lengths: " + JSON.stringify(interactions.triangleShape));
if (interactions.perimeter.labels !== 4 || !interactions.perimeter.allVisible) throw new Error("Perimeter labels are clipped: " + JSON.stringify(interactions.perimeter));
if (interactions.area.shape !== "triangle" || !interactions.area.summary.includes("20")) throw new Error("Area board failed.");
if (interactions.volume.cubes !== 30 || interactions.volume.dimensions !== 3 || !interactions.volume.labels.includes("5") || !interactions.volume.summary.includes("30")) throw new Error("Volume board failed: " + JSON.stringify(interactions.volume));
if (interactions.polygon.sides !== 8 || !interactions.polygon.summary.includes("1080")) throw new Error("Polygon lab failed.");
if (interactions.circle.defaultDraw !== 0 || interactions.circle.radius !== 70 || interactions.circle.draggedDraw !== 315 || interactions.circle.step !== "1" || !interactions.circle.summary.includes("140") || !interactions.circle.labels.includes("r = 70") || !interactions.circle.labels.includes("d = 140") || !interactions.circle.centre.includes("O")) throw new Error("Circle lab failed: " + JSON.stringify(interactions.circle));
if (interactions.teacher.open || interactions.teacher.width !== 10) throw new Error("Teacher settings failed.");
if (interactions.ranges.cursor !== "ew-resize" || interactions.ranges.touchAction !== "none" || interactions.ranges.afterDown !== 7 || interactions.ranges.afterMove !== 11) throw new Error("Range controls are not freely draggable: " + JSON.stringify(interactions.ranges));
if (interactions.zh.lang !== "zh-Hans" || !interactions.zh.title.includes("几何") || interactions.zh.overflow > 1) throw new Error("Chinese UI failed.");
if (runtimeErrors.length) throw new Error("Runtime errors: " + runtimeErrors.join(" | "));

console.log(JSON.stringify({ ok:true, uniqueTools:new Set(covered).size, initial, interactions }, null, 2));
socket.close();

