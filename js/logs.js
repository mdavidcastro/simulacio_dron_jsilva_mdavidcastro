
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let chartPosition = null;
let chartVelocity = null;
let scene, camera, renderer, controls;
let isPaused = false;
let droneStep = 0;
let dronePoints = [];
let droneMesh = null;
// Exponer funciones globales
window.closeModal = closeModal;
window.showTab = showTab;
//   CARGAR LOGS
async function loadLogs() {
  const loading = document.getElementById('loadingMsg');
  const container = document.getElementById('logsContainer');

  loading.style.display = 'block';
  container.innerHTML = '';

  let logs = [];

  try {
    const res = await fetch('http://127.0.0.1:5002/logs');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    logs = data.map(log => ({
      timestamp: log.params?.Drone?.timestamp || Date.now(),
      input: log.params,
      result: log.result
    }));

  } catch (err) {
    console.error("Error cargando logs:", err);
    logs = [];
  } finally {
    if (logs.length === 0) {
      container.innerHTML = '<p class="col-span-full text-center text-yellow-300">⚠️ No hay simulaciones guardadas</p>';
    } else {
      logs.forEach((log, index) => {
        container.appendChild(createLogCard(log, index, logs.length));
      });
    }

    loading.style.display = 'none';
  }
}
//     TARJETAS DE LOGS
function createLogCard(log, index, total) {
  const card = document.createElement('div');
  card.className = 'log-card p-6 rounded-xl shadow-lg cursor-pointer';

  const date = new Date(log.timestamp).toLocaleString('es-CO');
  const id = `SIM-${index + 1}`;

  card.innerHTML = `
    <h3 class="text-lg font-bold">${id}</h3>
    <p class="timestamp-badge mt-2">📅 ${date}</p>
    <div class="mt-3 text-sm text-gray-300">
      <p>Masa: ${log.input.Drone?.Mass || 'N/A'} kg</p>
      <p>Puntos: ${log.result.Position?.length || 0}</p>
    </div>
  `;

  card.onclick = () => openModal(log);
  return card;
}
//modal
function openModal(log) {
  document.getElementById('modalTitle').textContent =
    `Simulación: ${new Date(log.timestamp).toLocaleString('es-CO')}`;
  
  document.getElementById('visualModal').style.display = 'block';
  showTab('3d');

  render3D(log.result);
  plotCharts(log.result);
  showData(log);
}
function closeModal() {
  document.getElementById('visualModal').style.display = 'none';  

  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement = null;

    renderer = null;
    scene = null;
    camera = null;
    controls = null;
  }

  const container = document.getElementById('chart3d');
  container.innerHTML = '';
}
//pestañas
function showTab(tab) {
  const tabs = ['3d', 'charts', 'data'];

  tabs.forEach(t => {
    document.getElementById(t === '3d' ? 'tab3d' : 'tab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.remove('active');
    document.getElementById('content' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = 'none';
  });

  document.getElementById(tab === '3d' ? 'tab3d' : 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.getElementById('content' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = 'block';
}
//la grafica 3d y sus funciones
function render3D(data) {
  const container = document.getElementById('chart3d');
  container.innerHTML = '';

  // Limpiar renderer previo
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    container.innerHTML = '';
    renderer = null;
    scene = null;
    camera = null;
    controls = null;
  }

  if (!data.Position || data.Position.length === 0) {
    container.innerHTML = '<p class="text-center p-4 text-yellow-300">No hay datos 3D</p>';
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // Escena
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // Cámara
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(30, 30, 30);

  // Luces
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0x404040));

  // Grid y ejes
  scene.add(new THREE.GridHelper(50, 50));
  scene.add(new THREE.AxesHelper(10));

  // Trayectoria
  dronePoints = data.Position.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(dronePoints),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
  );
  scene.add(line);

  // Mesh dron
  new GLTFLoader().load(
    "models/drone.glb",
    gltf => {
      droneMesh = gltf.scene;
      droneMesh.scale.set(10, 10, 10);
      droneMesh.position.copy(dronePoints[0]);
      scene.add(droneMesh);
    },
    undefined,
    () => {
      // fallback cubo
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshLambertMaterial({ color: 0x00aaff })
      );
      cube.position.copy(dronePoints[0]);
      droneMesh = cube;
      scene.add(cube);
    }
  );

  // Controles
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 100;
  controls.minDistance = 5;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 0, 0);

  // Animación
  droneStep = 0;
  isPaused = false;

  function animate() {
    requestAnimationFrame(animate);

    if (droneMesh && !isPaused && droneStep < dronePoints.length) {
      droneMesh.position.copy(dronePoints[droneStep]);
      droneStep++;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c' && droneMesh) {
      const offset = new THREE.Vector3(10, 10, 10);
      camera.position.copy(droneMesh.position).add(offset);
      controls.target.copy(droneMesh.position);
      controls.update();
    }
  });

  
  document.getElementById('btnPlay').onclick = () => { isPaused = false; };
  document.getElementById('btnPause').onclick = () => { isPaused = true; };
  document.getElementById('btnReset').onclick = () => {
    isPaused = true;
    droneStep = 0;
    if (droneMesh) droneMesh.position.copy(dronePoints[0]);
    controls.update();
  };

  //Ajustar tamaño 
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}
//    GRÁFICAS
function plotCharts(result) {
  const timeArr = result.Time || Array.from({ length: result.Position.length }, (_, i) => i);
    
  const posMag = result.Position.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = result.Velocity.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));

  // POSICIÓN
  const ctxPos = document.getElementById('chartPosition').getContext('2d');
  if (chartPosition) chartPosition.destroy();

  chartPosition = new Chart(ctxPos, {
    type: 'line',
    data: {
      labels: timeArr,
      datasets: [{
        label: 'Posición (módulo)',
        data: posMag,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(173, 199, 216, 0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }},
        y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }}
      }
    }
  });

  // VELOCIDAD
  const ctxVel = document.getElementById('chartVelocity').getContext('2d');
  if (chartVelocity) chartVelocity.destroy();

  chartVelocity = new Chart(ctxVel, {
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
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }},
        y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }}
      }
    }
  });
}

function showData(log) {
  const container = document.getElementById('dataDetails');

  const time = log.result.Time;
  const pos = log.result.Position;
  const vel = log.result.Velocity;
  const dt = time[1] - time[0];

  // ----- CÁLCULO DE MÓDULOS -----
  const posMag = pos.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = vel.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));
  const accMag = velMag.map((v, i) => (i === 0 ? 0 : Math.abs((v - velMag[i-1]) / dt)));

  // ----- ESTADÍSTICAS -----
  const posStats = {
    min: Math.min(...posMag).toFixed(2),
    max: Math.max(...posMag).toFixed(2),
    avg: (posMag.reduce((a,b)=>a+b,0)/posMag.length).toFixed(2)
  };

  const velStats = {
    min: Math.min(...velMag).toFixed(2),
    max: Math.max(...velMag).toFixed(2),
    avg: (velMag.reduce((a,b)=>a+b,0)/velMag.length).toFixed(2)
  };

  const accStats = {
    max: Math.max(...accMag).toFixed(2),
    avg: (accMag.reduce((a,b)=>a+b,0)/accMag.length).toFixed(2)
  };

  // =============================================================
  //                  DETECCIÓN ROBUSTA DE ALTURA
  // =============================================================

  const TIEMPO_MIN_RELEVANTE = 1.0;     // Ignorar antes de 1s
  const VENTANA_ESTABILIDAD = 0.3;      // Mínimo tiempo de persistencia
  const ALTURA_MIN_SEGURA = 1.0;        // Hover razonable
  const ALTURA_CRITICA_VUELO = 2.0;     // Vuelo seguro

  // Detectar intervalos donde la altura está por debajo del límite segura
  const lowAltitude = pos
    .map((p, i) => ({ i, t: time[i], alt: p[2] }))
    .filter(e => e.t > TIEMPO_MIN_RELEVANTE && e.alt < ALTURA_MIN_SEGURA);

  let idxAltCrit = -1;

  if (lowAltitude.length > 0) {
    for (let k = 0; k < lowAltitude.length; k++) {
      const start = lowAltitude[k].i;
      const startTime = time[start];

      let end = start;
      while (
        end < pos.length &&
        pos[end][2] < ALTURA_MIN_SEGURA &&
        time[end] - startTime <= VENTANA_ESTABILIDAD
      ) {
        end++;
      }

      if (time[end] - startTime >= VENTANA_ESTABILIDAD) {
        idxAltCrit = start;
        break;
      }
    }
  }

  // Detección adicional para vuelo operacional (>3s)
  let idxAltCritOperativo = -1;
  if (time.some((t, i) => t > 3 && pos[i][2] < ALTURA_CRITICA_VUELO)) {
    idxAltCritOperativo = time.findIndex((t, i) => t > 3 && pos[i][2] < ALTURA_CRITICA_VUELO);
  }

  // =============================================================
  //        RESTO DE DETECCIONES REALISTAS DE RIESGO
  // =============================================================

  // Velocidad crítica persistente
  const idxVelCrit = velMag.findIndex(v => v > 15);

  // Distancia excesiva
  const idxDistCrit = posMag.findIndex(m => m > 80);

  // Viento fuerte (sin detalles porque lo pediste)
  const vientoCritico = log.input.Environment.WWind?.some(w => Math.abs(w) > 7) || false;

  // Oscilaciones fuertes
  const strongOscillation = accMag.some(a => a > 8);

  // Reducción clara de velocidad → hover o frenada
  const idxNearStop = velMag.findIndex(v => v < 0.5);

  // =============================================================
  //                        ANÁLISIS FINAL
  // =============================================================
  let analisis = "";
  const riesgo =
    idxVelCrit !== -1 ||
    idxDistCrit !== -1 ||
    vientoCritico ||
    idxAltCrit !== -1 ||
    idxAltCritOperativo !== -1;

  if (riesgo) {
    analisis += "⚠️ Riesgo detectado:\n";

    if (idxVelCrit !== -1)
      analisis += `- Velocidad excesiva (t=${time[idxVelCrit].toFixed(2)}s)\n`;

    if (idxDistCrit !== -1)
      analisis += `- Distancia excesiva (t=${time[idxDistCrit].toFixed(2)}s)\n`;

    if (vientoCritico)
      analisis += `- Viento fuerte detectado\n`;

    if (idxAltCrit !== -1)
      analisis += `- Altura muy baja sostenida (t=${time[idxAltCrit].toFixed(2)}s)\n`;

    if (idxAltCritOperativo !== -1)
      analisis += `- Altura peligrosa en vuelo operativo (t=${time[idxAltCritOperativo].toFixed(2)}s)\n`;

  } else {
    analisis = "🟢 La simulación muestra parámetros dentro de rangos seguros.";
  }

  // =============================================================
  //               INFORMACIÓN EXTRA ÚTIL
  // =============================================================
  let extraInfo = "";
  extraInfo += `• Tiempo total: ${time[time.length - 1].toFixed(2)} s\n`;
  extraInfo += `• Max aceleración: ${accStats.max} m/s²\n`;
  extraInfo += `• Promedio aceleración: ${accStats.avg} m/s²\n`;

  if (idxNearStop !== -1)
    extraInfo += `• Velocidad casi nula en t=${time[idxNearStop].toFixed(2)}s\n`;

  if (strongOscillation)
    extraInfo += `• Oscilaciones fuertes detectadas (posible PID mal ajustado)\n`;

  extraInfo += `• Punto inicial: [${pos[0].map(n=>n.toFixed(2)).join(', ')}]\n`;
  extraInfo += `• Punto final: [${pos[pos.length-1].map(n=>n.toFixed(2)).join(', ')}]\n`;

  // =============================================================
  //                     RENDER EN HTML
  // =============================================================
  container.innerHTML = `
    <h3 class="text-lg font-semibold mb-2">Resumen estadístico</h3>

    <p class="mb-2 text-blue-300 font-semibold">Posición (módulo):</p>
    <ul class="ml-4 mb-4 text-gray-200">
      <li>Distancia mínima: ${posStats.min} m</li>
      <li>Distancia máxima: ${posStats.max} m</li>
      <li>Distancia promedio: ${posStats.avg} m</li>
    </ul>

    <p class="mb-2 text-blue-300 font-semibold">Velocidad (módulo):</p>
    <ul class="ml-4 mb-4 text-gray-200">
      <li>Velocidad mínima: ${velStats.min} m/s</li>
      <li>Velocidad máxima: ${velStats.max} m/s</li>
      <li>Velocidad promedio: ${velStats.avg} m/s</li>
    </ul>

    <p class="mb-2 text-blue-300 font-semibold">Aceleración:</p>
    <ul class="ml-4 mb-4 text-gray-200">
      <li>Aceleración máxima: ${accStats.max} m/s²</li>
      <li>Aceleración promedio: ${accStats.avg} m/s²</li>
    </ul>

    <h3 class="text-lg font-semibold mb-2">Análisis de seguridad</h3>
    <pre class="text-sm bg-black/30 p-4 rounded whitespace-pre-wrap ${riesgo ? "text-red-400" : "text-green-300"}">
${analisis}
    </pre>

    <h3 class="text-lg font-semibold mt-4 mb-2">Información adicional útil</h3>
    <pre class="text-sm bg-black/20 p-4 rounded whitespace-pre-wrap text-gray-200">
${extraInfo}
    </pre>
  `;
}
document.addEventListener("DOMContentLoaded", loadLogs);
