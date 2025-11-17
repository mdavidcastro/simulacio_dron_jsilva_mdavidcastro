import sqlite3
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np



app = Flask(__name__)
CORS(app)
DB_PATH = 'simulations.db'

# =======================================
#   Base de Datos
# =======================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        params TEXT,
        result TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

# =======================================
#   Dinámica Física (modelo mejorado)
# =======================================

ρ = 1.225   # densidad del aire (kg/m3)
Cd = 1.0    # coef arrastre típico
A = 0.1     # área frontal (m2)


def dynamics(state, t, params):
    pos = state[:3]
    vel = state[3:]

    m = params["mass"]
    g = params["g"]
    wind = params["wind"]

    # Velocidad relativa aire - dron
    v_rel = vel - wind
    v_rel_mag = np.linalg.norm(v_rel)

    # Fuerzas físicas
    F_gravity = np.array([0, 0, -m * g])
    F_drag = -0.5 * ρ * Cd * A * v_rel_mag * v_rel  # drag cuadrático

    F_total = F_gravity + F_drag
    acc = F_total / m

    return np.concatenate([vel, acc])  # [dx/dt, dv/dt]


# =======================================
#   Método RK4 (mucho más preciso)
# =======================================

def rk4_step(f, y, t, dt, params):
    k1 = f(y, t, params)
    k2 = f(y + dt/2 * k1, t + dt/2, params)
    k3 = f(y + dt/2 * k2, t + dt/2, params)
    k4 = f(y + dt * k3, t + dt, params)
    return y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)


# =======================================
#   Endpoint: /simulate
# =======================================

@app.route('/simulate', methods=['POST'])
def simulate():
    try:
        data = request.json

        if not data or "Drone" not in data or "Environment" not in data:
            return jsonify({"error": "Missing required data"}), 400

        drone = data["Drone"]
        env = data["Environment"]

        # Parámetros desde JSON
        pos = np.array(drone["Position"], dtype=float)
        vel = np.array(drone["Velocity"], dtype=float)
        mass = float(drone.get("Mass", 1.0))

        g = float(env.get("Gravity", 9.81))
        wind = np.array(env.get("Wind", [0,0,0]), dtype=float)

        # Crear estructura de parámetros
        params = {
            "mass": mass,
            "g": g,
            "wind": wind
        }

        # Simulación temporal
        steps = 500
        dt = 0.05

        state = np.concatenate([pos, vel])
        t = 0.0

        result = {"Time": [], "Position": [], "Velocity": []}

        for i in range(steps):

            # Guardar datos
            result["Time"].append(round(t, 3))
            result["Position"].append([round(x, 4) for x in state[:3].tolist()])
            result["Velocity"].append([round(x, 4) for x in state[3:].tolist()])

            # Integración RK4
            state = rk4_step(dynamics, state, t, dt, params)
            t += dt

            if state[2] <= 0:  # si toca el suelo
                break

        # Guardar simulación en DB
        conn = get_db()
        c = conn.cursor()
        c.execute("INSERT INTO simulations (params, result) VALUES (?, ?)",
                  (json.dumps(data), json.dumps(result)))
        conn.commit()
        sim_id = c.lastrowid
        conn.close()

        return jsonify({"id": sim_id, "result": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =======================================
#   Endpoint: /logs (todas las simulaciones)
# =======================================

@app.route('/logs', methods=['GET'])
def get_logs():
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id, params, result FROM simulations ORDER BY id DESC")
        rows = c.fetchall()
        conn.close()

        logs = [{
            "id": row["id"],
            "params": json.loads(row["params"]),
            "result": json.loads(row["result"])
        } for row in rows]

        return jsonify(logs)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =======================================
#   Main
# =======================================

if __name__ == "__main__":
    app.run(port=5002, debug=True)
