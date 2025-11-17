// logs.js
// Visualización de logs de simulaciones en log.html

// Utilidad para calcular resumen
function resumenSimulacion(data) {
  if (!data || !data.Position || !data.Velocity) return '';
  const posMag = data.Position.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = data.Velocity.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));
  const timeArr = data.Time || Array.from({length: data.Position.length}, (_, i) => i * (data.dt || 0.1));
  const distTotal = posMag.length > 0 ? (posMag[posMag.length-1] - posMag[0]).toFixed(2) : '0';
  const velMax = velMag.length > 0 ? Math.max(...velMag).toFixed(2) : '0';
  const velMin = velMag.length > 0 ? Math.min(...velMag).toFixed(2) : '0';
  const tTotal = timeArr.length > 0 ? timeArr[timeArr.length-1].toFixed(2) : '0';
  let texto = `Distancia: <b>${distTotal} m</b><br>`;
  texto += `Vel. máx: <b>${velMax} m/s</b>, mín: <b>${velMin} m/s</b><br>`;
  texto += `Tiempo: <b>${tTotal} s</b>`;
  return texto;
}

async function fetchLogs() {
  const container = document.getElementById('logsContainer');
  container.innerHTML = '<div class="col-span-3 text-center text-gray-400">Cargando logs...</div>';
  try {
    const res = await fetch('http://127.0.0.1:5002/logs');
    if (!res.ok) throw new Error('No se pudo obtener logs');
    const logs = await res.json();
    if (!Array.isArray(logs) || logs.length === 0) {
      container.innerHTML = '<div class="col-span-3 text-center text-gray-400">No hay simulaciones guardadas.</div>';
      return;
    }
    container.innerHTML = '';
    logs.forEach((log, idx) => {
      const fecha = formatFecha(log.fecha || log.date);
      const resumen = resumenSimulacion(log.result);
      const card = document.createElement('div');
      card.className = 'bg-white rounded-lg shadow p-4 flex flex-col gap-2 hover:ring-2 hover:ring-blue-400 transition';
      card.innerHTML = `
        <div class='text-xs text-gray-500 mb-1'>${fecha}</div>
        <div class='font-semibold text-blue-700'>Simulación #${logs.length-idx}</div>
        <div class='text-sm text-gray-700 mb-2'>${resumen}</div>
        <button class='ver-detalle bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-xs font-bold self-end' data-idx='${idx}'>Ver detalle</button>
      `;
      container.appendChild(card);
    });
    // Listeners para ver detalle (modal)
    container.querySelectorAll('.ver-detalle').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = this.getAttribute('data-idx');
        mostrarDetalleModal(logs[idx]);
      });
    });
  } catch (err) {
    container.innerHTML = '<div class="col-span-3 text-center text-red-400">Error cargando logs</div>';
    console.error('Error cargando logs:', err);
  }
}

// Modal helpers
function crearModal() {
  let modal = document.getElementById('modalDetalle');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalDetalle';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 relative flex flex-col gap-4">
        <button id="cerrarModal" class="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-2xl font-bold">&times;</button>
        <div id="modalContent"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#cerrarModal').onclick = () => modal.classList.add('hidden');
    modal.onclick = e => { if (e.target === modal) modal.classList.add('hidden'); };
  }
  return modal;
}

function abrirModal(html) {
  const modal = crearModal();
  modal.querySelector('#modalContent').innerHTML = html;
  modal.classList.remove('hidden');
}

function formatFecha(fecha) {
  if (!fecha) return '(sin fecha)';
  // Intenta parsear y mostrar formato local
  const d = new Date(fecha);
  if (!isNaN(d)) return d.toLocaleString();
  return fecha;
}

// Modal de detalles con 3 gráficas
function mostrarDetalleModal(log) {
  if (!log || !log.result) return;
  // Modal content: resumen, 3 gráficas (vel, pos, 3D)
  const idBase = 'id' + (log._id || Math.floor(Math.random()*1e6));
  const html = `
    <div class='mb-2 text-blue-800 font-semibold'>Resumen</div>
    <div class='mb-2 text-gray-700 text-sm'>${resumenSimulacion(log.result)}</div>
    <div class='flex flex-col md:flex-row gap-4'>
      <div class='flex-1'><canvas id='chartVel${idBase}' class='w-full h-64 bg-gray-100 rounded'></canvas></div>
      <div class='flex-1'><canvas id='chartPos${idBase}' class='w-full h-64 bg-gray-100 rounded'></canvas></div>
    </div>
    <div class='mt-4'>
      <div class='font-semibold text-green-700 mb-1'>Trayectoria 3D</div>
      <div id='threeContainer${idBase}' class='w-full h-64 bg-gray-100 rounded'></div>
    </div>
  `;
  abrirModal(html);
  // Renderizar gráficas
  setTimeout(() => {
    renderChartVel(log.result, document.getElementById('chartVel'+idBase));
    renderChartPos(log.result, document.getElementById('chartPos'+idBase));
    renderThreeTraj(log.result, document.getElementById('threeContainer'+idBase));
  }, 100);
}

// Renderizar trayectoria 3D usando Three.js si está disponible
function renderThreeTraj(data, container) {
  if (!container || !data.Position || typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
    container.innerHTML = '<div class="text-gray-400 text-center mt-8">Three.js o GLTFLoader no cargado</div>';
    return;
  }
  // Forzar tamaño del contenedor
  container.style.minHeight = '256px';
  container.style.height = '256px';
  container.innerHTML = '';
  console.log('[Three.js] Creando escena 3D...');
  const scene = new THREE.Scene();
  // Grid y ejes
  const gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);
  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);
  // Trayectoria
  const points = data.Position.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 3 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  // Cámara
  const aspect = container.offsetWidth / container.offsetHeight;
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  let center = new THREE.Vector3(0,0,0);
  if (points.length > 0) {
    center = points.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(points.length);
  }
  camera.position.set(center.x + 5, center.y + 5, center.z + 5);
  camera.lookAt(center);
  // Luz ambiental y direccional
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(10, 10, 10);
  scene.add(light);
  // Render
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setClearColor(0xcccccc); // Color de fondo visible
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  container.appendChild(renderer.domElement);
  console.log('[Three.js] Renderizador y canvas agregados', renderer.domElement);
  // Animación para asegurar render tras carga
  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
  // Cargar modelo dron.glb en la última posición
  if (points.length > 0) {
    const last = points[points.length - 1];
    const loader = new THREE.GLTFLoader();
    loader.load('models/drone.glb', function(gltf) {
      const drone = gltf.scene;
      drone.position.copy(last);
      // Centrar y escalar el modelo
      drone.scale.set(0.5, 0.5, 0.5);
      scene.add(drone);
      console.log('[Three.js] Modelo drone.glb cargado y agregado a la escena');
    }, undefined, function(error) {
      // Si falla, mostrar esfera roja
      const droneGeometry = new THREE.SphereGeometry(0.15, 32, 32);
      const droneMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const droneMesh = new THREE.Mesh(droneGeometry, droneMaterial);
      droneMesh.position.copy(last);
      scene.add(droneMesh);
      console.warn('[Three.js] No se pudo cargar drone.glb, usando esfera roja');
    });
  }
}

function renderChartVel(data, canvas) {
  if (!canvas || !data.Velocity) return;
  const ctx = canvas.getContext('2d');
  const velMag = data.Velocity.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));
  const timeArr = data.Time || Array.from({length: data.Velocity.length}, (_, i) => i * (data.dt || 0.1));
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeArr,
      datasets: [{
        label: 'Velocidad (módulo)',
        data: velMag,
        borderColor: 'rgba(37, 99, 235, 1)',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
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

function renderChartPos(data, canvas) {
  if (!canvas || !data.Position) return;
  const ctx = canvas.getContext('2d');
  const posMag = data.Position.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const timeArr = data.Time || Array.from({length: data.Position.length}, (_, i) => i * (data.dt || 0.1));
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeArr,
      datasets: [{
        label: 'Posición (módulo)',
        data: posMag,
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchLogs);
} else {
  fetchLogs();
}
