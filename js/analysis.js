// analysis.js


// --- Funciones de Utilidad ---
function parseArray(str) {
  return str.split(",").map(Number).filter(n => !isNaN(n));
}


// --- Ejecutar Simulación ---
// ...existing code...
// --- Ejecutar Simulación ---
async function runSimulation() {
  try {
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  const simData = result.result || result;
      // Renderizar siempre los gráficos y la trayectoria 3D
    render3DTrajectory(simData);
    renderCharts(simData);
    // Obtener los elementos de los gráficos en el scope correcto
    const chartVel = document.getElementById('simChartVel');
    const chartPos = document.getElementById('simChartPos');
    const chart3D = document.getElementById('simChartContainer');
    chartVel.classList.remove('hidden');
    chartPos.classList.remove('hidden');
    chart3D.classList.remove('hidden');
  } catch (err) {
    console.error("Error en runSimulation:", err);
    alert("No se pudo ejecutar la simulación");
  }
}

// --- Renderizado de gráficas con Chart.js ---
function renderCharts(data) {
  // Extraer datos de simulación
  const positionArr = data.Position; // [[x,y,z], ...]
  const velocityArr = data.Velocity; // [[vx,vy,vz], ...]
  const timeArr = data.Time || Array.from({length: positionArr.length}, (_, i) => i * (data.dt || 0.1));


// --- Lógica de pestañas para gráficas ---
document.addEventListener('DOMContentLoaded', () => {
  const tab3D = document.getElementById('tab3D');
  const tabVel = document.getElementById('tabVel');
  const tabPos = document.getElementById('tabPos');
  const chart3D = document.getElementById('simChartContainer');
  const chartVel = document.getElementById('simChartVel');
  const chartPos = document.getElementById('simChartPos');
  if (!tab3D || !tabVel || !tabPos || !chart3D || !chartVel || !chartPos) return;

  function showTab(tabActive) {
    // Alternar color activo
    [tab3D, tabVel, tabPos].forEach(tab => {
      tab.classList.remove('bg-sky', 'text-white', 'bg-gray-400', 'text-black');
      tab.classList.add('bg-gray-400', 'text-black');
    });
    tabActive.classList.remove('bg-gray-400', 'text-black');
    tabActive.classList.add('bg-sky', 'text-white');

    // Alternar visibilidad
    chart3D.classList.add('hidden');
    chartVel.classList.add('hidden');
    chartPos.classList.add('hidden');
    if (tabActive === tab3D) chart3D.classList.remove('hidden');
    if (tabActive === tabVel) chartVel.classList.remove('hidden');
    if (tabActive === tabPos) chartPos.classList.remove('hidden');

    // Redibujar Chart.js si corresponde
    if (tabActive === tabVel && window.velocityChartInstance) {
      window.velocityChartInstance.resize();
      window.velocityChartInstance.update();
    }
    if (tabActive === tabPos && window.positionChartInstance) {
      window.positionChartInstance.resize();
      window.positionChartInstance.update();
    }
  }

  tab3D.addEventListener('click', function() { showTab(tab3D); });
  tabVel.addEventListener('click', function() { showTab(tabVel); });
  tabPos.addEventListener('click', function() { showTab(tabPos); });

  // Inicializar mostrando 3D
  showTab(tab3D);
  if (chart3D.innerHTML.trim() === "") {
    chart3D.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400">Ejecuta la simulación para ver la trayectoria 3D</div>';
  }
});
  // Posición y velocidad en magnitud
  const posMag = positionArr.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = velocityArr.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));

  // Renderizar posición vs tiempo
  const posCanvas = document.getElementById('simChartPos');
  if (!posCanvas) return;
  const posCtx = posCanvas.getContext('2d');
  if (window.positionChartInstance) window.positionChartInstance.destroy();
  window.positionChartInstance = new Chart(posCtx, {
    type: 'line',
    data: {
      labels: timeArr,
      datasets: [{
        label: 'Posición (módulo)',
        data: posMag,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Tiempo (s)' } },
        y: { title: { display: true, text: 'Posición (m)' } }
      }
    }
  });

  // Renderizar velocidad vs tiempo
  const velCanvas = document.getElementById('simChartVel');
  if (!velCanvas) return;
  const velCtx = velCanvas.getContext('2d');
  if (window.velocityChartInstance) window.velocityChartInstance.destroy();
  window.velocityChartInstance = new Chart(velCtx, {
    type: 'line',
    data: {
      labels: timeArr,
      datasets: [{
        label: 'Velocidad (módulo)',
        data: velMag,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Tiempo (s)' } },
        y: { title: { display: true, text: 'Velocidad (m/s)' } }
      }
    }
  });
}


// --- Renderizado 3D con Three.js ---
function render3DTrajectory(data) {
  const container = document.getElementById("simChartContainer");
  container.innerHTML = ""; // Limpiar antes de renderizar

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // Escena
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // Cámara
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(20, 20, 20);

  // Luces
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  // Grid y ejes de referencia
  const gridHelper = new THREE.GridHelper(50, 50);
  scene.add(gridHelper);
  const axesHelper = new THREE.AxesHelper(10);
  scene.add(axesHelper);

  // Trayectoria
  const points = data.Position.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  // Dron
  const droneGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const droneMat = new THREE.MeshPhongMaterial({ color: 0x0000ff });
  const droneMesh = new THREE.Mesh(droneGeo, droneMat);
  scene.add(droneMesh);

  // Controles de cámara
  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  // Animación del dron sobre la trayectoria
  let step = 0;
  function animate() {
    requestAnimationFrame(animate);

    if (step < points.length) {
      droneMesh.position.copy(points[step]);
      step++;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// --- Exportar análisis (placeholder) ---
// ...existing code...


/* // --- Ejecutar Simulación ---
// ...existing code...
*/