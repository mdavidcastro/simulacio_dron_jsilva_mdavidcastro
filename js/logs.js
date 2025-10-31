// Mostrar historial de simulaciones desde el backend Python
async function fetchLogs() {
  try {
    const res = await fetch('http://127.0.0.1:5002/logs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const logs = await res.json();
    const container = document.getElementById('logsContainer');
    container.innerHTML = '';
    logs.forEach(log => {
      const div = document.createElement('div');
      div.textContent = `ID: ${log.id}, Posición inicial: ${log.params.Drone.Position}, Resultado final: ${JSON.stringify(log.result.Position.at(-1))}`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Error al obtener logs:', err);
  }
}
const API_BASE = "http://127.0.0.1:5001";

async function fetchLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const logs = await res.json();
    console.log("📥 Logs recibidos:", logs);

    // ✅ Renderizar los logs en pantalla
    renderLogs(logs);

  } catch (err) {
    console.error("❌ Error cargando logs:", err);
    document.getElementById("logContainer").innerHTML = `
      <p class="text-red-500 text-center">
        Error cargando logs: No pudimos conectar con el servidor
      </p>`;
  }
}


function renderLogs(logs) {
  const container = document.getElementById("logContainer");
  container.innerHTML = "";

  if (logs.length === 0) {
    container.innerHTML = `<p class="text-gray-600 text-center col-span-full">
      No hay simulaciones guardadas.
    </p>`;
    return;
  }

  logs.forEach(log => {
    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition transform hover:-translate-y-1";

    card.innerHTML = `
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Simulación #${log.id}</h2>
      <p><strong>Posición inicial:</strong> [${log.Position.join(", ")}]</p>
      <p><strong>Velocidad:</strong> [${log.Velocity.join(", ")}]</p>
      <p><strong>Batería:</strong> ${log.Battery}%</p>
      <p><strong>Viento:</strong> [${log.Wind.join(", ")}]</p>
      <p><strong>Gravedad:</strong> ${log.Gravity}</p>
      <p><strong>Temperatura:</strong> ${log.Temperature}°C</p>
      <button
        class="mt-3 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        onclick="verSimulacion(${log.id})">
        🔍 Ver Simulación
      </button>
    `;

    container.appendChild(card);
  });
}

function verSimulacion(id) {
  alert(`👉 Aquí podrías cargar la simulación #${id} en el visor 3D.`);
}

fetchLogs();
