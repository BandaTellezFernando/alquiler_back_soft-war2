
from flask import Flask, request, redirect, make_response, render_template_string, session, url_for
import sqlite3
import hashlib
import json
import datetime
import random
import os
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional

# --- CONFIGURACIÓN PARA VERCEL ---
app = Flask(__name__)
app.secret_key = "tu_clave_secreta_super_segura"  # Necesario para sesiones

# En Vercel solo se puede escribir en /tmp
DB_NAME = "/tmp/p2p_trading.db" 

# --- DATOS Y CLASES (Igual que tu código original) ---
RANDOM_NAMES = [
    "CryptoMaster", "BitcoinPro", "ElonMusk", "SatoshiNakamoto", "DigitalTrader",
    "BlockchainKing", "CryptoWhale", "TradingExpert", "Web3Enthusiast", "DeFiMaster"
]

RANDOM_PAYMENT_METHODS = [
    ["Bank Transfer", "PayPal"],
    ["Bank Transfer", "Wise", "Revolut"],
    ["PayPal", "Credit Card"],
    ["Bank Transfer", "Cash Deposit"],
    ["Wise", "PayPal", "Bank Transfer"]
]

ASSETS = ["USDT", "BTC", "ETH"]
FIATS = ["USD", "EUR"]

class OrderType(Enum):
    BUY = "BUY"
    SELL = "SELL"

class OrderStatus(Enum):
    PENDING = "PENDING"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"

class TradeStatus(Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAYMENT_SENT = "PAYMENT_SENT"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

@dataclass
class User:
    id: int
    username: str
    email: str
    created_at: str

@dataclass
class P2POrder:
    id: int
    user_id: int
    username: str
    order_type: OrderType
    asset: str
    fiat: str
    price: float
    quantity: float
    available_quantity: float
    payment_methods: List[str]
    status: OrderStatus
    created_at: str
    min_amount: float
    max_amount: float

# --- SISTEMA P2P (Adaptado para persistencia en /tmp) ---
class P2PSystem:
    def __init__(self, db_name: str = DB_NAME):
        self.db_name = db_name
        self.init_database()
    
    def init_database(self):
        # En Vercel, verificamos si la DB existe en /tmp, si no, la creamos
        # Nota: En Vercel los datos en /tmp se borran ocasionalmente.
        # Para una app real necesitas una base de datos externa (Postgres/MySQL)
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        # Tabla de usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                reputation INTEGER DEFAULT 100,
                completed_trades INTEGER DEFAULT 0
            )
        ''')
        
        # Tabla de órdenes P2P
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS p2p_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                order_type TEXT NOT NULL,
                asset TEXT NOT NULL,
                fiat TEXT NOT NULL,
                price REAL NOT NULL,
                quantity REAL NOT NULL,
                available_quantity REAL NOT NULL,
                payment_methods TEXT NOT NULL,
                status TEXT NOT NULL,
                min_amount REAL NOT NULL,
                max_amount REAL NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Tabla de trades
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_id INTEGER NOT NULL,
                seller_id INTEGER NOT NULL,
                order_id INTEGER NOT NULL,
                asset TEXT NOT NULL,
                fiat TEXT NOT NULL,
                price REAL NOT NULL,
                quantity REAL NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                qr_code TEXT,
                payment_deadline TEXT,
                FOREIGN KEY (buyer_id) REFERENCES users (id),
                FOREIGN KEY (seller_id) REFERENCES users (id),
                FOREIGN KEY (order_id) REFERENCES p2p_orders (id)
            )
        ''')
        
        # Tabla de wallets
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                asset TEXT NOT NULL,
                balance REAL NOT NULL,
                locked_balance REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Verificar si hay datos, si no, crear datos de ejemplo
        cursor.execute('SELECT count(*) FROM users')
        if cursor.fetchone()[0] == 0:
            self._create_sample_data(cursor)
        
        conn.commit()
        conn.close()
    
    def _create_sample_data(self, cursor):
        """Crear datos de ejemplo"""
        users_data = [
            ("trader1", "trader1@example.com", "password123"),
            ("trader2", "trader2@example.com", "password123"),
            ("trader3", "trader3@example.com", "password123")
        ]
        
        for username, email, password in users_data:
            try:
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                created_at = datetime.datetime.now().isoformat()
                cursor.execute(
                    'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
                    (username, email, password_hash, created_at)
                )
                user_id = cursor.lastrowid
                
                # Crear wallets
                assets = [
                    ('USDT', 5000.0), ('BTC', 0.5), ('ETH', 3.0), 
                    ('USD', 10000.0), ('EUR', 8000.0)
                ]
                for asset, balance in assets:
                    cursor.execute(
                        'INSERT INTO wallets (user_id, asset, balance, locked_balance) VALUES (?, ?, ?, ?)',
                        (user_id, asset, balance, 0.0)
                    )
            except sqlite3.IntegrityError:
                continue
        
        self._generate_random_orders(cursor, num_orders=8)
    
    def _generate_random_orders(self, cursor, num_orders=8):
        for i in range(num_orders):
            try:
                cursor.execute("SELECT id FROM users ORDER BY RANDOM() LIMIT 1")
                user_result = cursor.fetchone()
                if not user_result: continue
                    
                user_id = user_result[0]
                order_type = random.choice(['BUY', 'SELL'])
                asset = random.choice(ASSETS)
                fiat = random.choice(FIATS)
                
                base_prices = {
                    'USDT': {'USD': 1.0, 'EUR': 0.92},
                    'BTC': {'USD': 45000.0, 'EUR': 41400.0},
                    'ETH': {'USD': 2800.0, 'EUR': 2576.0}
                }
                
                base_price = base_prices[asset][fiat]
                if order_type == 'SELL':
                    price_variation = random.uniform(0.01, 0.03)
                else:
                    price_variation = random.uniform(-0.03, -0.01)
                
                price = round(base_price * (1 + price_variation), 2)
                
                quantity_ranges = {
                    'USDT': (100, 1000), 'BTC': (0.01, 0.1), 'ETH': (0.1, 2.0)
                }
                min_qty, max_qty = quantity_ranges[asset]
                quantity = round(random.uniform(min_qty, max_qty), 2)
                
                payment_methods = random.choice(RANDOM_PAYMENT_METHODS)
                min_amount = round(random.uniform(50, 200), 2)
                max_amount = round(quantity * price * 0.8, 2)
                
                created_at = datetime.datetime.now().isoformat()
                payment_json = json.dumps(payment_methods)
                
                cursor.execute('''
                    INSERT INTO p2p_orders 
                    (user_id, order_type, asset, fiat, price, quantity, available_quantity, 
                     payment_methods, status, min_amount, max_amount, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, order_type, asset, fiat, price, quantity, quantity,
                      payment_json, 'PENDING', min_amount, max_amount, created_at))
            except Exception:
                pass

    # ... (Resto de métodos de base de datos se mantienen igual, solo copiarlos) ...
    # Por brevedad, asumo que copias los métodos: hash_password, register_user, 
    # authenticate_user, get_user_stats, create_order, get_orders, start_trade, 
    # confirm_payment, get_trade_status, get_user_balance aquí.
    # DEBES PEGAR AQUI EL RESTO DE MÉTODOS DE LA CLASE P2PSystem DEL CÓDIGO ORIGINAL
    
    def hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def register_user(self, username: str, email: str, password: str) -> bool:
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            password_hash = self.hash_password(password)
            created_at = datetime.datetime.now().isoformat()
            cursor.execute('''INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)''', (username, email, password_hash, created_at))
            user_id = cursor.lastrowid
            initial_assets = [('USDT', 1000.0), ('BTC', 0.01), ('ETH', 0.1), ('USD', 2000.0), ('EUR', 1600.0)]
            for asset, balance in initial_assets:
                cursor.execute('''INSERT INTO wallets (user_id, asset, balance, locked_balance) VALUES (?, ?, ?, ?)''', (user_id, asset, balance, 0.0))
            conn.commit()
            conn.close()
            return True
        except sqlite3.IntegrityError:
            return False

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        password_hash = self.hash_password(password)
        cursor.execute('SELECT id, username, email, created_at FROM users WHERE username = ? AND password_hash = ?', (username, password_hash))
        result = cursor.fetchone()
        conn.close()
        return User(*result) if result else None
    
    def get_user_balance(self, user_id: int) -> Dict[str, Dict[str, float]]:
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        cursor.execute('SELECT asset, balance, locked_balance FROM wallets WHERE user_id = ?', (user_id,))
        results = cursor.fetchall()
        conn.close()
        balance = {}
        for asset, bal, locked in results:
            balance[asset] = {'available': bal, 'locked': locked, 'total': bal + locked}
        return balance

    def get_orders(self, asset: str = "USDT", fiat: str = "USD", order_type: str = None) -> List[P2POrder]:
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        query = '''SELECT po.id, po.user_id, u.username, po.order_type, po.asset, po.fiat, po.price, 
                   po.quantity, po.available_quantity, po.payment_methods, po.status, 
                   po.min_amount, po.max_amount, po.created_at
                   FROM p2p_orders po JOIN users u ON po.user_id = u.id
                   WHERE po.asset = ? AND po.fiat = ? AND po.status = ?'''
        params = [asset, fiat, OrderStatus.PENDING.value]
        if order_type:
            query += ' AND po.order_type = ?'
            params.append(order_type)
        query += ' ORDER BY po.price ASC'
        cursor.execute(query, params)
        results = cursor.fetchall()
        conn.close()
        orders = []
        for result in results:
            payment_methods = json.loads(result[9])
            orders.append(P2POrder(
                id=result[0], user_id=result[1], username=result[2],
                order_type=OrderType(result[3]), asset=result[4], fiat=result[5],
                price=result[6], quantity=result[7], available_quantity=result[8],
                payment_methods=payment_methods, status=OrderStatus(result[10]),
                min_amount=result[11], max_amount=result[12], created_at=result[13]
            ))
        return orders

    def create_order(self, user_id: int, order_type: str, asset: str, fiat: str, 
                    price: float, quantity: float, payment_methods: List[str],
                    min_amount: float, max_amount: float) -> bool:
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            if order_type == 'SELL':
                cursor.execute('SELECT balance FROM wallets WHERE user_id = ? AND asset = ?', (user_id, asset))
                result = cursor.fetchone()
                if not result or result[0] < quantity: return False
            else:
                cursor.execute('SELECT balance FROM wallets WHERE user_id = ? AND asset = ?', (user_id, fiat))
                result = cursor.fetchone()
                if not result or result[0] < (price * quantity): return False
            
            created_at = datetime.datetime.now().isoformat()
            payment_json = json.dumps(payment_methods)
            cursor.execute('''INSERT INTO p2p_orders 
                (user_id, order_type, asset, fiat, price, quantity, available_quantity, payment_methods, status, min_amount, max_amount, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                (user_id, order_type, asset, fiat, price, quantity, quantity, payment_json, 'PENDING', min_amount, max_amount, created_at))
            
            if order_type == 'SELL':
                cursor.execute('UPDATE wallets SET balance = balance - ?, locked_balance = locked_balance + ? WHERE user_id = ? AND asset = ?', (quantity, quantity, user_id, asset))
            else:
                total_amount = price * quantity
                cursor.execute('UPDATE wallets SET balance = balance - ?, locked_balance = locked_balance + ? WHERE user_id = ? AND asset = ?', (total_amount, total_amount, user_id, fiat))
            conn.commit()
            conn.close()
            return True
        except Exception:
            return False

    def start_trade(self, buyer_id: int, order_id: int, quantity: float) -> Optional[int]:
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('SELECT user_id, order_type, asset, fiat, price, available_quantity, min_amount, max_amount FROM p2p_orders WHERE id = ? AND status = ?', (order_id, OrderStatus.PENDING.value))
            order_data = cursor.fetchone()
            if not order_data: return None
            seller_id, order_type, asset, fiat, price, avail_qty, min_amt, max_amt = order_data
            
            amount = price * quantity
            if quantity > avail_qty or amount < min_amt or amount > max_amt: return None

            # Validar fondos comprador
            check_asset = fiat if order_type == 'SELL' else asset
            check_amount = amount if order_type == 'SELL' else quantity
            cursor.execute('SELECT balance FROM wallets WHERE user_id = ? AND asset = ?', (buyer_id, check_asset))
            res = cursor.fetchone()
            if not res or res[0] < check_amount: return None

            # Bloquear fondos comprador
            cursor.execute('UPDATE wallets SET balance = balance - ?, locked_balance = locked_balance + ? WHERE user_id = ? AND asset = ?', (check_amount, check_amount, buyer_id, check_asset))
            
            # Actualizar orden
            new_avail = avail_qty - quantity
            new_status = OrderStatus.FILLED.value if new_avail == 0 else OrderStatus.PARTIALLY_FILLED.value
            cursor.execute('UPDATE p2p_orders SET available_quantity = ?, status = ? WHERE id = ?', (new_avail, new_status, order_id))
            
            # Crear trade
            created_at = datetime.datetime.now().isoformat()
            cursor.execute('''INSERT INTO trades (buyer_id, seller_id, order_id, asset, fiat, price, quantity, amount, status, created_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                              (buyer_id, seller_id, order_id, asset, fiat, price, quantity, amount, TradeStatus.PENDING_PAYMENT.value, created_at))
            trade_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return trade_id
        except Exception:
            return None

    def confirm_payment(self, trade_id: int) -> bool:
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('SELECT buyer_id, seller_id, order_id, asset, fiat, price, quantity, amount FROM trades WHERE id = ? AND status = ?', (trade_id, TradeStatus.PENDING_PAYMENT.value))
            trade_data = cursor.fetchone()
            if not trade_data: return False
            buyer_id, seller_id, order_id, asset, fiat, price, quantity, amount = trade_data
            
            cursor.execute('SELECT order_type FROM p2p_orders WHERE id = ?', (order_id,))
            order_type = cursor.fetchone()[0]

            # Liberar y transferir
            # Seller entrega Asset, recibe Fiat. Buyer entrega Fiat, recibe Asset.
            # Fondos del vendedor ya estaban bloqueados (Asset en SELL, Fiat en BUY)
            # Fondos del comprador se bloquearon al iniciar trade
            
            # 1. Desbloquear fondos del vendedor y darselos al comprador
            if order_type == 'SELL': # Vendedor vendía Crypto
                 # Vendedor: -Locked Asset
                 cursor.execute('UPDATE wallets SET locked_balance = locked_balance - ? WHERE user_id = ? AND asset = ?', (quantity, seller_id, asset))
                 # Comprador: +Asset
                 cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND asset = ?', (quantity, buyer_id, asset))
                 
                 # Pago del comprador (Fiat bloqueado) -> al vendedor
                 cursor.execute('UPDATE wallets SET locked_balance = locked_balance - ? WHERE user_id = ? AND asset = ?', (amount, buyer_id, fiat))
                 cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND asset = ?', (amount, seller_id, fiat))
            else: # BUY: Vendedor compraba Crypto (pagaba con Fiat)
                 # Vendedor: -Locked Fiat -> al comprador
                 cursor.execute('UPDATE wallets SET locked_balance = locked_balance - ? WHERE user_id = ? AND asset = ?', (amount, seller_id, fiat))
                 cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND asset = ?', (amount, buyer_id, fiat))
                 
                 # Comprador: -Locked Asset -> al vendedor
                 cursor.execute('UPDATE wallets SET locked_balance = locked_balance - ? WHERE user_id = ? AND asset = ?', (quantity, buyer_id, asset))
                 cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND asset = ?', (quantity, seller_id, asset))

            cursor.execute('UPDATE trades SET status = ? WHERE id = ?', (TradeStatus.COMPLETED.value, trade_id))
            conn.commit()
            conn.close()
            return True
        except Exception:
            return False

# Inicializar sistema
p2p_system = P2PSystem()

# --- TEMPLATES HTML (Los mismos que tenías, pero adaptados a Flask no es necesario,
# Flask puede renderizar el string directo, pero por limpieza los dejo aquí) ---
HTML_TEMPLATES = {
    'base': '''... (copia tu template base aquí) ...''',
    # Nota: Copia todos tus strings HTML grandes aquí abajo o déjalos donde estaban
    # Para que funcione este código, asumiré que usas los mismos strings que pasaste
}
# (Por limitación de espacio en la respuesta, usa tus mismos strings HTML_TEMPLATES
#  que tenías en el código original, no cambian)

# --- RUTAS DE FLASK (Reemplaza la clase P2PRequestHandler) ---

@app.route('/')
def index():
    return redirect('/login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect('/dashboard')
    
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = p2p_system.authenticate_user(username, password)
        
        if user:
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect('/dashboard')
        else:
            error = "Usuario o contraseña incorrectos"

    # Aquí debes pegar tu HTML de login completo o usar render_template_string
    # Usaré una versión simplificada basada en tu código para que funcione
    # Reemplaza esto con tu HTML_TEMPLATES['login'] inyectado en 'base'
    return render_template_string(YOUR_FULL_LOGIN_HTML_STRING, error=error if error else "")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect('/dashboard')
        
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if p2p_system.register_user(username, email, password):
            return redirect('/login')
        else:
            error = "Usuario o email ya existen"

    return render_template_string(YOUR_FULL_REGISTER_HTML_STRING, error=error if error else "")

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect('/login')
    
    user_id = session['user_id']
    username = session['username']
    
    balance = p2p_system.get_user_balance(user_id)
    # Generar HTML del balance... (lógica de tu serve_dashboard)
    balance_items = "" 
    for asset, bal in balance.items():
        balance_items += f'''<div class="balance-item"><strong>{asset}</strong><br>
                             Disp: {bal["available"]:.2f}<br>Bloq: {bal["locked"]:.2f}</div>'''

    orders = p2p_system.get_orders()
    # Generar HTML de órdenes... (lógica de tu serve_dashboard)
    orders_html = ""
    for order in orders:
        # ... Tu lógica de generación de HTML de orders ...
        action = "vender" if order.order_type.value == 'BUY' else "comprar"
        btn_cls = "btn-buy" if order.order_type.value == 'BUY' else "btn-sell"
        orders_html += f'''
        <div class="order-card {order.order_type.value.lower()}">
             <strong>{order.username}</strong> ({order.order_type.value}) - {order.price} {order.fiat}
             <form class="trade-form" onsubmit="startTrade(event, {order.id})">
                <input type="number" step="0.01" placeholder="Cantidad" required>
                <button type="submit" class="btn {btn_cls}">{action}</button>
             </form>
        </div>'''

    # Reemplaza con tu HTML completo dashboard
    return render_template_string(YOUR_FULL_DASHBOARD_HTML_STRING, 
                                  balance_items=balance_items, 
                                  orders=orders_html, 
                                  message="", 
                                  orders_count=len(orders),
                                  nav_menu=f'<span class="nav-user">{username}</span><a href="/logout" class="nav-link">Salir</a>',
                                  script=YOUR_JS_SCRIPT,
                                  modal=YOUR_MODAL_HTML)

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

@app.route('/create_order', methods=['POST'])
def create_order():
    if 'user_id' not in session: return "Unauthorized", 401
    
    user_id = session['user_id']
    # Flask obtiene los datos del form diferente a socketserver
    success = p2p_system.create_order(
        user_id, 
        request.form.get('order_type'),
        request.form.get('asset'),
        request.form.get('fiat'),
        float(request.form.get('price')),
        float(request.form.get('quantity')),
        [], # Payment methods simplificado
        float(request.form.get('min_amount')),
        float(request.form.get('max_amount'))
    )
    return "OK" if success else "Error", 200 if success else 400

@app.route('/start_trade', methods=['POST'])
def start_trade():
    if 'user_id' not in session: return "Unauthorized", 401
    trade_id = p2p_system.start_trade(
        session['user_id'],
        int(request.form.get('order_id')),
        float(request.form.get('quantity'))
    )
    return str(trade_id) if trade_id else "Error", 200 if trade_id else 400

@app.route('/confirm_payment', methods=['POST'])
def confirm_payment():
    if 'user_id' not in session: return "Unauthorized", 401
    success = p2p_system.confirm_payment(int(request.form.get('trade_id')))
    return "OK" if success else "Error", 200 if success else 400

# IMPORTANTE: Necesitas copiar tus variables con los strings HTML largos aqui
# y asignarlos a estas variables para que el render_template_string funcione:
YOUR_FULL_LOGIN_HTML_STRING = """ ... pega aquí tu HTML base + login ... """
YOUR_FULL_REGISTER_HTML_STRING = """ ... pega aquí tu HTML base + register ... """
YOUR_FULL_DASHBOARD_HTML_STRING = """ ... pega aquí tu HTML base + dashboard ... """
YOUR_JS_SCRIPT = """ ... pega aquí tu JS ... """
YOUR_MODAL_HTML = """ ... pega aquí tu Modal ... """

# NO USAR: socketserver.TCPServer
# NO USAR: webbrowser.open

# Para probar en local (Vercel ignorará esto y usará 'app')
if __name__ == "__main__":
    app.run(port=8000, debug=True)