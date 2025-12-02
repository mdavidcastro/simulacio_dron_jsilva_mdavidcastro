let chartVelocity = null;
let chartPosition = null;

// Helper
function parseArray(str) {
  return str.split(",").map(Number).filter(n => !isNaN(n));
}

// ----------------------------
// EJECUTAR SIMULACIÓN
// ----------------------------
async function runSimulation() {
  try {
    if (window.event) {
      window.event.preventDefault();
      window.event.stopPropagation();
    }

    const drone = {
      Position: parseArray(document.getElementById("position").value),
      Velocity: parseArray(document.getElementById("velocity").value),
      Mass: Number(document.getElementById("mass").value)
    };

    const environment = {
      Wind: parseArray(document.getElementById("wind").value),
      Gravity: Number(document.getElementById("gravity").value),
      Drag: Number(document.getElementById("drag").value)
    };

    const data = { Drone: drone, Environment: environment };

    const res = await fetch('http://127.0.0.1:5002/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const result = await res.json();
    const simData = result.result || result;

    render3DTrajectory(simData);
    renderCharts(simData);

    showTab("3d");

  } catch (err) {
    console.error(err);
    alert("No se pudo ejecutar la simulación: " + err.message);
  }
  return false;
}

// ----------------------------
// RENDER GRÁFICAS
// ----------------------------
function renderCharts(data) {
  const time = data.Time;
  const pos = data.Position;
  const vel = data.Velocity;

  const posMag = pos.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = vel.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));

  const idxVelCrit = velMag.findIndex(v => v > 15);
  const idxDistCrit = posMag.findIndex(m => m > 80);

  let advertencias = "";
  if (idxVelCrit !== -1) advertencias += `⚠️ Velocidad peligrosa en t=${time[idxVelCrit].toFixed(2)}s\n`;
  if (idxDistCrit !== -1) advertencias += `⚠️ Distancia excesiva en t=${time[idxDistCrit].toFixed(2)}s\n`;
  if (advertencias === "") advertencias = "🟢 Sin advertencias. Todo estable.";

  const summaryDiv = document.getElementById("simSummary");
  summaryDiv.innerHTML = `
    <h3 class="text-lg font-semibold mb-2">Advertencias</h3>
    <pre class="text-sm bg-black/30 p-4 rounded whitespace-pre-wrap ${
      advertencias.includes("⚠️") ? "text-red-400" : "text-green-400"
    }">${advertencias}</pre>
  `;

  // POSICIÓN
  const posCanvas = document.getElementById("simChartPos");
  const posCtx = posCanvas.getContext("2d");
  if (window.positionChartInstance) window.positionChartInstance.destroy();
  window.positionChartInstance = new Chart(posCtx, {
    type: "line",
    data: {
      labels: time,
      datasets: [{
        label: "Posición (módulo)",
        data: posMag,
        borderColor: "rgba(54,162,235,1)",
        backgroundColor: "rgba(54,162,235,0.3)",
        fill: true,
        tension: 0.1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // VELOCIDAD
  const velCanvas = document.getElementById("simChartVel");
  const velCtx = velCanvas.getContext("2d");
  if (window.velocityChartInstance) window.velocityChartInstance.destroy();
  window.velocityChartInstance = new Chart(velCtx, {
    type: "line",
    data: {
      labels: time,
      datasets: [{
        label: "Velocidad (módulo)",
        data: velMag,
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.3)",
        fill: true,
        tension: 0.1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// ----------------------------
// RENDER 3D
// ----------------------------
function render3DTrajectory(data) {
  const container = document.getElementById("simChartContainer");
  container.innerHTML = "";
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(20, 20, 20);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  scene.add(new THREE.GridHelper(50, 50));
  scene.add(new THREE.AxesHelper(10));

  const points = data.Position.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  scene.add(new THREE.Line(geometry, material));

  let droneMesh = null;
  const loader = new THREE.GLTFLoader();
  loader.load('models/drone.glb', function(gltf) {
    droneMesh = gltf.scene;
    droneMesh.scale.set(3, 3, 3);
    scene.add(droneMesh);
  });

  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  let step = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (droneMesh && step < points.length) droneMesh.position.copy(points[step++]);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// ----------------------------------------------------
// 🔥 UN SOLO DOMContentLoaded (ARREGLADO)
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

  // === CONFIG TABS ===
  const tab3D = document.getElementById("tab3D");
  const tabVel = document.getElementById("tabVel");
  const tabPos = document.getElementById("tabPos");

  const cont3D = document.getElementById("simChartContainer");
  const contVel = document.getElementById("simChartVel");
  const contPos = document.getElementById("simChartPos");

  function hideAll() {
    cont3D.style.display = "none";
    contVel.style.display = "none";
    contPos.style.display = "none";

    tab3D.classList.remove("bg-sky", "text-white");
    tabVel.classList.remove("bg-sky", "text-white");
    tabPos.classList.remove("bg-sky", "text-white");

    tab3D.classList.add("bg-gray-400", "text-black");
    tabVel.classList.add("bg-gray-400", "text-black");
    tabPos.classList.add("bg-gray-400", "text-black");
  }

  window.showTab = function(which) {
    hideAll();

    if (which === "3d") {
      cont3D.style.display = "block";
      tab3D.classList.add("bg-sky", "text-white");
    }
    if (which === "vel") {
      contVel.style.display = "block";
      tabVel.classList.add("bg-sky", "text-white");
      if (window.velocityChartInstance) {
        window.velocityChartInstance.resize();
      }
    }
    if (which === "pos") {
      contPos.style.display = "block";
      tabPos.classList.add("bg-sky", "text-white");
      if (window.positionChartInstance) {
        window.positionChartInstance.resize();
      }
    }
  };

  tab3D.addEventListener("click", () => showTab("3d"));
  tabVel.addEventListener("click", () => showTab("vel"));
  tabPos.addEventListener("click", () => showTab("pos"));

  // Activar por defecto
  showTab("3d");

  // === CARGAR ÚLTIMA SIMULACIÓN ===
  try {
    const res = await fetch("http://127.0.0.1:5002/logs");
    if (res.ok) {
      const logs = await res.json();
      if (Array.isArray(logs) && logs.length > 0) {
        const last = logs[0];
        render3DTrajectory(last.result);
        renderCharts(last.result);
      }
    }
  } catch (err) {
    console.error("No se pudieron cargar logs:", err);
  }

});
