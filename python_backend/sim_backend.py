import sqlite3
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np



app = Flask(__name__)
CORS(app)
DB_PATH = 'simulations.db'

# Inicializar base de datos
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS simulations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	params TEXT,
	result TEXT
)''')
conn.commit()
conn.close()

@app.route('/simulate', methods=['POST'])
def simulate():
	data = request.json
	drone = data['Drone']
	env = data['Environment']

	# Parámetros iniciales
	pos = np.array(drone['Position'], dtype=float)
	vel = np.array(drone['Velocity'], dtype=float)
	mass = float(drone.get('Mass', 1.0))
	g = env.get('Gravity', -9.81)
	wind = np.array(env.get('Wind', [0, 0, 0]), dtype=float)
	k = env.get('Drag', 0.1)  # Coeficiente de resistencia del aire

	steps = 200
	dt = 0.1
	result = {'Time': [], 'Position': [], 'Velocity': []}

	for i in range(steps):
		# Fuerza de resistencia y aceleración
		F_drag = -k * vel
		F_wind = wind
		F_gravity = np.array([0, 0, g * mass])
		F_total = F_drag + F_wind + F_gravity
		acc = F_total / mass
		vel += acc * dt
		pos += vel * dt
		result['Time'].append(i * dt)
		result['Position'].append(pos.tolist())
		result['Velocity'].append(vel.tolist())

	# Guardar en la base de datos
	conn = sqlite3.connect(DB_PATH)
	c = conn.cursor()
	c.execute('INSERT INTO simulations (params, result) VALUES (?, ?)',
			  (json.dumps(data), json.dumps(result)))
	conn.commit()
	sim_id = c.lastrowid
	conn.close()

	return jsonify({'id': sim_id, 'result': result})
@app.route('/logs', methods=['GET'])
def get_logs():
	conn = sqlite3.connect(DB_PATH)
	c = conn.cursor()
	c.execute('SELECT id, params, result FROM simulations ORDER BY id DESC')
	rows = c.fetchall()
	conn.close()
	logs = []
	for row in rows:
		logs.append({
			'id': row[0],
			'params': json.loads(row[1]),
			'result': json.loads(row[2])
		})
	return jsonify(logs)

if __name__ == '__main__':
	app.run(port=5002)
