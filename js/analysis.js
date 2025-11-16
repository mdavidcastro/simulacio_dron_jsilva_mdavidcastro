// --- Utilidad ---
function parseArray(str) {
  return str.split(',').map(Number).filter(n => !isNaN(n));
}

// --- Tabs ---
function showTab(tabActive) {
  const tab3D = document.getElementById('tab3D');
  const tabVel = document.getElementById('tabVel');
  const tabPos = document.getElementById('tabPos');
  const chart3D = document.getElementById('simChartContainer');
  const chartVelWrapper = document.getElementById('simChartVelWrapper');
  const chartPosWrapper = document.getElementById('simChartPosWrapper');
  if (!tab3D || !tabVel || !tabPos || !chart3D || !chartVelWrapper || !chartPosWrapper) return;
  [tab3D, tabVel, tabPos].forEach(tab => {
    tab.classList.remove('bg-sky', 'text-white', 'bg-gray-400', 'text-black');
    tab.classList.add('bg-gray-400', 'text-black');
  });
  tabActive.classList.remove('bg-gray-400', 'text-black');
  tabActive.classList.add('bg-sky', 'text-white');
  chart3D.style.display = 'none';
  chartVelWrapper.style.display = 'none';
  chartPosWrapper.style.display = 'none';
  if (tabActive === tab3D) chart3D.style.display = 'block';
  if (tabActive === tabVel) chartVelWrapper.style.display = 'block';
  if (tabActive === tabPos) chartPosWrapper.style.display = 'block';
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
let activeTab = null;

document.addEventListener('DOMContentLoaded', () => {
  // Prevenir cualquier submit accidental del formulario
  const form = document.getElementById('simForm');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); return false; });
  }
  // Capturar errores globales de JS y mostrarlos en el debug
  window.onerror = function(msg, url, line, col, error) {
    const debugDiv = document.getElementById('simDebugMsg');
    if (debugDiv) debugDiv.innerText = '[SimDron] ERROR GLOBAL: ' + msg + ' @' + line + ':' + col;
    return false;
  };
  // Mensaje de debug visual
  const debugDiv = document.getElementById('simDebugMsg');
  if (debugDiv) debugDiv.innerText = '[SimDron] JS activo: esperando simulación...';
  const tab3D = document.getElementById('tab3D');
  const tabVel = document.getElementById('tabVel');
  const tabPos = document.getElementById('tabPos');
  const chart3D = document.getElementById('simChartContainer');
  if (chart3D) chart3D.classList.remove('hidden');
  if (tab3D && tabVel && tabPos) {
    tab3D.addEventListener('click', () => showTab(tab3D));
    tabVel.addEventListener('click', () => showTab(tabVel));
    tabPos.addEventListener('click', () => showTab(tabPos));
    showTab(tab3D);
    activeTab = tab3D;
    if (chart3D) {
      chart3D.innerHTML = '<div id="simWelcomeMsg" class="flex items-center justify-center h-full text-gray-400">Ejecuta la simulación para ver la trayectoria 3D</div>';
    }
  }
  // Ya no se usa submit, el botón llama a runSimulation() directamente
});

// --- Simulación ---
async function runSimulation() {
  // Mostrar resumen de parámetros usados
  const paramsSummary =
    `<b>Parámetros usados:</b> ` +
    `Masa=${document.getElementById('mass').value} kg, ` +
    `Posición=[${document.getElementById('position').value}], ` +
    `Velocidad=[${document.getElementById('velocity').value}], ` +
    `Viento=[${document.getElementById('wind').value}], ` +
    `Gravedad=${document.getElementById('gravity').value}, ` +
    `Drag=${document.getElementById('drag').value}`;
  const simParamsDiv = document.getElementById('simParamsSummary');
  if (simParamsDiv) simParamsDiv.innerHTML = paramsSummary;
  const debugDiv = document.getElementById('simDebugMsg');
  if (debugDiv) debugDiv.innerText = '[SimDron] Ejecutando simulación...';
  console.log('[SimDron] Ejecutando simulación...');
  try {
    if (debugDiv) debugDiv.innerText = '[SimDron] Enviando datos al backend...';
  // Limpiar solo el mensaje de error, no el canvas ni el contenedor
  mostrarErrorGrafica("");
    // Validar y obtener datos
    const drone = {
      Position: parseArray(document.getElementById('position').value),
      Velocity: parseArray(document.getElementById('velocity').value),
      Mass: Number(document.getElementById('mass').value)
    };
    const environment = {
      Wind: parseArray(document.getElementById('wind').value),
      Gravity: Number(document.getElementById('gravity').value),
      Drag: Number(document.getElementById('drag').value)
    };
    if (drone.Position.length !== 3 || drone.Velocity.length !== 3 || environment.Wind.length !== 3) {
      mostrarErrorGrafica('Todos los vectores deben tener 3 valores.');
      return;
    }
    if (isNaN(drone.Mass) || isNaN(environment.Gravity) || isNaN(environment.Drag)) {
      mostrarErrorGrafica('Parámetros numéricos inválidos.');
      return;
    }
    const data = { Drone: drone, Environment: environment };
    console.log('[SimDron] Enviando datos al backend:', data);
  const res = await fetch('http://127.0.0.1:5002/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('[SimDron] Respuesta HTTP:', res.status);
    if (!res.ok) {
      if (debugDiv) debugDiv.innerText = `[SimDron] Error HTTP: ${res.status}`;
      throw new Error(`HTTP ${res.status}`);
    }
  const result = await res.json();
  const simData = result.result || result;
  if (debugDiv) debugDiv.innerText = '[SimDron] Datos recibidos:\n' + JSON.stringify(simData, null, 2).slice(0, 400) + '\nRenderizando...';
    // Limpiar solo el mensaje de bienvenida, no el canvas ni el contenedor
    const chart3D = document.getElementById('simChartContainer');
    const welcomeMsg = document.getElementById('simWelcomeMsg');
    if (welcomeMsg && chart3D) chart3D.removeChild(welcomeMsg);
    render3DTrajectory(simData);
    renderCharts(simData);
    // Restaurar la pestaña activa después de simular
    if (activeTab) {
      showTab(activeTab);
    } else {
      showTab(document.getElementById('tab3D'));
    }
    if (debugDiv) debugDiv.innerText = '[SimDron] Simulación completada.';
  } catch (err) {
    mostrarErrorGrafica('No se pudo ejecutar la simulación.');
    if (debugDiv) debugDiv.innerText = '[SimDron] ERROR: ' + (err && err.message ? err.message : err);
    console.error('Error en runSimulation:', err);
  }
}

// --- Gráficas ---
function renderCharts(data) {
  console.log('[SimDron] renderCharts data:', data);
  const positionArr = data.Position;
  const velocityArr = data.Velocity;
  const timeArr = data.Time || (positionArr && Array.isArray(positionArr) ? Array.from({length: positionArr.length}, (_, i) => i * (data.dt || 0.1)) : []);
  if (!positionArr || !velocityArr || !Array.isArray(positionArr) || !Array.isArray(velocityArr) || positionArr.length === 0 || velocityArr.length === 0) {
    mostrarErrorGrafica('No hay datos válidos para graficar.', false);
    return;
  }
  if (!Array.isArray(timeArr) || timeArr.length !== positionArr.length) {
    mostrarErrorGrafica('Datos de tiempo inconsistentes.', false);
    return;
  }
  const posMag = positionArr.map(p => Array.isArray(p) && p.length === 3 ? Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2) : 0);
  const velMag = velocityArr.map(v => Array.isArray(v) && v.length === 3 ? Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2) : 0);
  const posCanvas = document.getElementById('simChartPos');
  if (!posCanvas) return;
  const posCtx = posCanvas.getContext('2d');
  if (window.positionChartInstance) window.positionChartInstance.destroy();
  try {
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
  } catch (e) {
    mostrarErrorGrafica('Error al graficar posición: ' + e.message);
    return;
  }
  const velCanvas = document.getElementById('simChartVel');
  if (!velCanvas) return;
  const velCtx = velCanvas.getContext('2d');
  if (window.velocityChartInstance) window.velocityChartInstance.destroy();
  try {
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
  } catch (e) {
    mostrarErrorGrafica('Error al graficar velocidad: ' + e.message);
    return;
  }
  mostrarErrorGrafica("");
}

// --- Errores ---
function mostrarErrorGrafica(msg) {
  const chart3D = document.getElementById('simChartContainer');
  if (!chart3D) return;
  let errorDiv = document.getElementById('simErrorMsg');
  if (msg) {
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'simErrorMsg';
      errorDiv.className = 'flex items-center justify-center h-full text-red-400 text-lg absolute top-0 left-0 w-full pointer-events-none';
      chart3D.appendChild(errorDiv);
    }
    errorDiv.innerHTML = msg;
    errorDiv.style.display = 'flex';
  } else {
    if (errorDiv) errorDiv.style.display = 'none';
  }
}

// --- 3D ---
function render3DTrajectory(data) {
  console.log('[SimDron] render3DTrajectory data:', data);
  const container = document.getElementById('simChartContainer');
  // No borres el innerHTML, solo elimina el canvas de Three.js si existe
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) container.removeChild(oldCanvas);
  // Elimina overlays de error si existen
  const errorDiv = document.getElementById('simErrorMsg');
  if (errorDiv) errorDiv.style.display = 'none';
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
  const gridHelper = new THREE.GridHelper(50, 50);
  scene.add(gridHelper);
  const axesHelper = new THREE.AxesHelper(10);
  scene.add(axesHelper);
  const points = data.Position.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  const droneGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const droneMat = new THREE.MeshPhongMaterial({ color: 0x0000ff });
  const droneMesh = new THREE.Mesh(droneGeo, droneMat);
  scene.add(droneMesh);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
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