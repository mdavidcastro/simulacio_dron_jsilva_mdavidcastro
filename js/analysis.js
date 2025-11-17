// analysis.js
let chartVelocity = null;
let chartPosition = null;


// --- Funciones de Utilidad ---
function parseArray(str) {
  return str.split(",").map(Number).filter(n => !isNaN(n));
}


// --- Ejecutar Simulación ---
async function runSimulation() {
  try {
    if (window.event) {
      window.event.preventDefault();
      window.event.stopPropagation();
    }
    
    console.log("Iniciando simulación...");
    
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
    console.log("Datos a enviar:", data);
    
    const res = await fetch('http://127.0.0.1:5002/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    
    const result = await res.json();
    console.log("Resultado recibido:", result);
    
    const simData = result.result || result;
    
    render3DTrajectory(simData);
    renderCharts(simData);

    document.getElementById('simChartContainer').classList.remove('hidden');
    document.getElementById('simChartVel').classList.add('hidden');
    document.getElementById('simChartPos').classList.add('hidden');

    console.log("Simulación completada exitosamente");
    
  } catch (err) {
    console.error("Error en runSimulation:", err);
    alert("No se pudo ejecutar la simulación: " + err.message);
  }
  
  return false;
}

// --- Renderizado de gráficas ---
function renderCharts(data) {
  // --- RESUMEN DE RESULTADOS ---
  const summaryDiv = document.getElementById('simSummary');
  if (summaryDiv) {
    // Magnitudes
    const posMag = data.Position.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
    const velMag = data.Velocity.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));
    const timeArr = data.Time || Array.from({length: data.Position.length}, (_, i) => i * (data.dt || 0.1));
    // Distancia total recorrida
    const distTotal = posMag.length > 0 ? (posMag[posMag.length-1] - posMag[0]).toFixed(2) : '0';
    // Velocidad máxima y mínima
    const velMax = velMag.length > 0 ? Math.max(...velMag).toFixed(2) : '0';
    const velMin = velMag.length > 0 ? Math.min(...velMag).toFixed(2) : '0';
    // Tiempo total
    const tTotal = timeArr.length > 0 ? timeArr[timeArr.length-1].toFixed(2) : '0';
    // Texto explicativo
    let texto = `El dron recorrió <b>${distTotal} m</b> en <b>${tTotal} s</b>.<br>`;
    texto += `Velocidad máxima: <b>${velMax} m/s</b>, mínima: <b>${velMin} m/s</b>.<br>`;
    if (velMax === velMin && velMax !== '0') {
      texto += 'El dron mantuvo velocidad constante.';
    } else if (velMax === '0') {
      texto += 'El dron permaneció en reposo.';
    } else {
      texto += 'El dron aceleró o frenó durante la simulación.';
    }
    summaryDiv.innerHTML = texto;
  }

  const positionArr = data.Position;
  const velocityArr = data.Velocity;
  const timeArr = data.Time || Array.from({length: positionArr.length}, (_, i) => i * (data.dt || 0.1));

  // Magnitudes
  const posMag = positionArr.map(p => Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2));
  const velMag = velocityArr.map(v => Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2));

  // === POSICIÓN ===
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

  // === VELOCIDAD ===
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


// --- Renderizado 3D ---
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
  // Ajusta el tamaño si es necesario
  droneMesh.scale.set(3, 3, 3); // Cambia el factor según tu modelo
  scene.add(droneMesh);
}, undefined, function(error) {
  console.error('Error cargando el modelo de dron:', error);
});

  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  let step = 0;
  function animate() {
    window._threeAnimation = requestAnimationFrame(animate);
    

    if (droneMesh && step < points.length) droneMesh.position.copy(points[step++]);

    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}




/***********************
 *   SISTEMA DE PESTAÑAS
 ***********************/
document.addEventListener("DOMContentLoaded", () => {

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

    // Mostrar contenedor específico
    function showTab(which) {
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
                window.velocityChartInstance.update();
            }
        }

        if (which === "pos") {
            contPos.style.display = "block";
            tabPos.classList.add("bg-sky", "text-white");

            if (window.positionChartInstance) {
                window.positionChartInstance.resize();
                window.positionChartInstance.update();
            }
        }
    }

    // Listeners
    tab3D.addEventListener("click", () => showTab("3d"));
    tabVel.addEventListener("click", () => showTab("vel"));
    tabPos.addEventListener("click", () => showTab("pos"));

    // Activar 3D por defecto
    showTab("3d");
});



// ===============================================
// CARGAR ÚLTIMA SIMULACIÓN AL ENTRAR A LA PÁGINA
// ===============================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("http://127.0.0.1:5002/logs");
    if (!res.ok) throw new Error("No se pudo obtener logs");

    const logs = await res.json();
    if (!Array.isArray(logs) || logs.length === 0) {
      console.log("No hay simulaciones guardadas.");
      return;
    }

    const last = logs[0]; // Última simulación
    console.log("Última simulación cargada:", last);

    // Dibujar gráficas y 3D
    render3DTrajectory(last.result);
    renderCharts(last.result);

    // Mostrar 3D al inicio
    document.getElementById("tab3D").click();

    // Asegurar que las gráficas existen pero ocultas
    document.getElementById("simChartVel").classList.add("hidden");
    document.getElementById("simChartPos").classList.add("hidden");
    document.getElementById("simChartContainer").classList.remove("hidden");

  } catch (err) {
    console.error("Error cargando última simulación:", err);
  }
});


