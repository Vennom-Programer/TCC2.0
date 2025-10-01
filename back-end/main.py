from flask import Flask, render_template, request, redirect, session, url_for, jsonify
import mysql.connector

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_aqui'


mydb = mysql.connector.connect(
    host="localhost",
    user="root",
    password="root",
    database="smartreserva"
)


def get_user_role(email):
    """Query the database for the given user's role. Returns the role string or None."""
    try:
        cursor = mydb.cursor()
        cursor.execute("SELECT role FROM usuarios WHERE email = %s", (email,))
        row = cursor.fetchone()
        cursor.close()
        if row:
            return row[0]
    except Exception:
        # If role column doesn't exist or query fails, return None
        try:
            cursor.close()
        except Exception:
            pass
    return None


def require_admin_or_redirect():
    """Helper used in routes to ensure the current session user is an admin. Returns None if OK or a redirect response."""
    if not session.get('usuario_logado'):
        return redirect('/login')
    db_role = get_user_role(session.get('usuario_logado'))
    if not db_role:
        db_role = session.get('usuario_role')
    if str(db_role).strip().lower() != 'adm':
        return redirect('/?error=forbidden')
    return None


def require_login_or_redirect():
    """Ensure a user is logged in; if not, redirect to /login. Refreshes session role from DB."""
    if not session.get('usuario_logado'):
        return redirect('/login')
    # refresh authoritative role from DB when possible
    db_role = get_user_role(session.get('usuario_logado'))
    if db_role:
        session['usuario_role'] = db_role
    return None

def get_user_data(email):
    """Query the database for the given user's complete data. Returns dict or None."""
    try:
        cursor = mydb.cursor(dictionary=True)
        cursor.execute("SELECT numeroDaMatricula, email, senha, nome, role FROM usuarios WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        return user
    except Exception as e:
        print(f"Erro ao buscar dados do usuário: {e}")
        try:
            cursor.close()
        except Exception:
            pass
        return None



@app.route('/')
def menu():
    return render_template('login.html')

# Rota para tela de cadastro
@app.route('/cadastro')
def cadastro():
    # Allow access to registration page for anonymous users (auto-register as professor)
    # For logged-in users, ensure only admins may access the user-creation form
    if session.get('usuario_logado'):
        db_role = get_user_role(session.get('usuario_logado'))
        if not db_role:
            # If DB has no role info, fall back to session (legacy)
            db_role = session.get('usuario_role')
        if db_role and str(db_role).strip().lower() != 'adm':
            return redirect('/?error=forbidden')
    return render_template('cadastro.html')

# Rota para processar cadastro via POST
@app.route('/cadastro', methods=['POST'])
def cadastro_post():
    nome = request.form.get('nome')
    email = request.form.get('email')
    senha = request.form.get('senha')
    numeroDaMatricula = request.form.get('numeroDaMatricula')
    role = request.form.get('role')  # optional, only present when admin creates a user

    # Security: if a user is logged in but is not an admin, disallow creating new users
    # (prevents non-admins from creating users or assigning roles via forged requests)
    # Refresh current user's role from DB when possible to ensure authoritative permission checks
    current_role = None
    if session.get('usuario_logado'):
        current_role = get_user_role(session.get('usuario_logado'))
        # If DB doesn't have role info, fall back to session value (legacy)
        if not current_role:
            current_role = session.get('usuario_role')
    if session.get('usuario_logado') and current_role != 'adm':
        # Logged-in non-admins cannot create other users
        return redirect('/cadastro?error=forbidden')

    # If role provided but the requester is not an admin, reject
    if role and current_role != 'adm':
        return redirect('/cadastro?error=forbidden')

    # If the requester is an admin and is trying to create another admin, require admin password confirmation
    if current_role == 'adm' and role and str(role).strip().lower() == 'adm':
        admin_password = request.form.get('admin_password')
        # Verify the admin_password matches the logged-in admin's password stored in DB
        cursor_check = mydb.cursor()
        cursor_check.execute("SELECT senha FROM usuarios WHERE email = %s", (session.get('usuario_logado'),))
        row = cursor_check.fetchone()
        cursor_check.close()
        if not row or row[0] != admin_password:
            return redirect('/cadastro?error=admin_auth_failed')

    # If requester is not logged in (auto-registration), force the new account to be a Professor
    if not session.get('usuario_logado'):
        role = 'professor'

    cursor = mydb.cursor()
    # Verificar se o email já existe
    cursor.execute("SELECT 1 FROM usuarios WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close()
        return redirect('/cadastro?error=exists')
    # Verificar se o nome completo já existe
    cursor.execute("SELECT 1 FROM usuarios WHERE nome = %s", (nome,))
    if cursor.fetchone():
        cursor.close()
        return redirect('/cadastro?error=name_exists')
    # Verificar se o número da matrícula já existe
    cursor.execute("SELECT 1 FROM usuarios WHERE numeroDaMatricula = %s", (numeroDaMatricula,))
    if cursor.fetchone():
        cursor.close()
        return redirect('/cadastro?error=matricula_exists')

    # At this point `role` is always set: admin provided it, or we forced 'professor' for auto-registration.
    try:
        insert_query = "INSERT INTO usuarios (nome, email, senha, numeroDaMatricula, role) VALUES (%s, %s, %s, %s, %s)"
        insert_values = (nome, email, senha, numeroDaMatricula, role)
        cursor.execute(insert_query, insert_values)
        mydb.commit()
        cursor.close()
        redirect_url = '/cadastro?success=1'
        if role:
            redirect_url += '&role=' + role
        return redirect(redirect_url)
    except Exception:
        cursor.close()
        return redirect('/cadastro?error=1')

def cadastroPost():
    nome = request.form.get('name')
    email = request.form.get('email')
    senha = request.form.get('password')
    numeroDaMatricula = request.form.get('numeroDaMatricula')
    
    cursor = mydb.cursor()
    query = "INSERT INTO usuarios (email, senha, nome, numeroDaMatricula) VALUES ('1', %s, %s, %s)"
    values = (nome, email, senha, numeroDaMatricula)
    cursor.execute(query, values)
    mydb.commit()
    cursor.close()
    
    return redirect('/login')

# Rota para tela de login
@app.route('/login',)
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def loginPost():
    email = request.form.get('email')
    senha = request.form.get('password')
    role = request.form.get('role')
    # Strict verification: check credentials and obtain DB role in one query
    cursor = mydb.cursor()
    try:
        cursor.execute("SELECT role FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
        row = cursor.fetchone()
        cursor.close()
    except Exception:
        # Query failed; deny login (and avoid leaking details)
        try:
            cursor.close()
        except Exception:
            pass
        return render_template('login.html', error="Erro ao verificar credenciais. Tente novamente mais tarde.")

    if not row:
        # No matching user/password
        return render_template('login.html', error="Email ou senha incorretos")

    db_role = row[0]

    # If a role was submitted in the form, require it to match the stored DB role (case-insensitive)
    if role:
        if not db_role:
            return render_template('login.html', error="Verificação de função indisponível no servidor. Contate o administrador.")
        if role.strip().lower() != str(db_role).strip().lower():
            return render_template('login.html', error="Você escolheu o tipo de usuário errado.")

    # Authentication and role verification passed -> set session role from DB (authoritative)
    session['usuario_logado'] = email
    session['usuario_role'] = db_role

    # Redirect to the shared index page; the template will show content based on session role
    return redirect(url_for('index'))
    

@app.route('/cadastroItem.html', methods=['GET'])
def cadastroItens():
    check = require_login_or_redirect()
    if check:
        return check
    return render_template('cadastroItem.html')


@app.route('/cadastroItem.html', methods=['POST'])
def cadastroItensPost():

    check = require_login_or_redirect()
    if check:
        return check
    nome = request.form.get('item-name')
    id_classificacao = request.form.get('item-type')
    descricao = request.form.get('item-description')
    quantidade = request.form.get('item-quantity')
    id_localizacao = request.form.get('item-location')
    especificacaotec = request.form.get('item-specs')
    
    cursor = mydb.cursor()
    query = "INSERT INTO itens ( Nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec) VALUES (%s, %s, %s, %s, %s, %s)"

    values = (nome, id_classificacao, descricao, quantidade, id_localizacao, especificacaotec)
    cursor.execute(query, values)
    mydb.commit()
    cursor.close()

    return redirect('/catalogo.html')


@app.route('/index.html', methods=['GET', 'POST'])
def index():
    # Require login to view the index menu
    check = require_login_or_redirect()
    if check:
        return check
    return render_template('index.html')


@app.route('/logout')
def logout():
    # Clear user session and redirect to login
    session.pop('usuario_logado', None)
    session.pop('usuario_role', None)
    return redirect('/login')

@app.route('/calendario.html', methods=['GET', 'POST'])
def calendario():
    check = require_login_or_redirect()
    if check:
        return check

    # Get current logged user info from database
    current_user_email = session.get('usuario_logado')
    
    # Buscar dados completos do usuário no banco - CORRIGIDO: passando o email como argumento
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        # Se não encontrou no banco, limpa a sessão e redireciona
        session.pop('usuario_logado', None)
        session.pop('usuario_role', None)
        return redirect('/login?error=user_not_found')
    
    # Atualizar sessão com dados do banco (autoritativos)
    session['usuario_role'] = current_user_db['role']
    
    current_user = {
        'numeroDaMatricula': current_user_db['numeroDaMatricula'],
        'nome': current_user_db['nome'],
        'email': current_user_db['email'],
        'role': current_user_db['role']
    }

    # Buscar reservas
    cursor = mydb.cursor()
    cursor.execute("SELECT id_usuario, id_itens, data_realizacao_reserva, data_reserva, status FROM emprestimo")
    rows = cursor.fetchall()
    cursor.close()

    reservas = []
    for r in rows:
        # Converter datas para string se forem datetime
        data_realizacao_reserva = r[2].isoformat() if hasattr(r[2], 'isoformat') else (str(r[2]) if r[2] is not None else None)
        data_reserva = r[3].isoformat() if hasattr(r[3], 'isoformat') else (str(r[3]) if r[3] is not None else None)

        reservas.append({
            'id_usuario': r[0],
            'id_item': r[1],
            'data_realizacao': data_realizacao_reserva,
            'data_reserva': data_reserva,
            'status': r[4]
        })

    # Buscar lista de usuários (apenas para admins)
    usuarios = []
    if current_user_db['role'] == 'adm':
        try:
            cursor = mydb.cursor()
            cursor.execute("SELECT numeroDaMatricula, nome FROM usuarios ORDER BY nome ASC")
            usuarios_rows = cursor.fetchall()
            cursor.close()
            for u in usuarios_rows:
                usuarios.append({ 'numeroDaMatricula': u[0], 'nome': u[1] })
        except Exception as e:
            print(f"Erro ao buscar usuários: {e}")
            try:
                cursor.close()
            except Exception:
                pass

    return render_template('calendario.html', reservas=reservas, current_user=current_user, usuarios=usuarios)
# =============================================
# NOVAS ROTAS API PARA O CALENDÁRIO
# =============================================

@app.route('/api/reservas', methods=['GET'])
def api_get_reservas():
    """Retorna todas as reservas do banco de dados"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Verificar usuário no banco - CORRIGIDO: passando o email como argumento
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    try:
        cursor = mydb.cursor(dictionary=True)
        
        # Se não for admin, mostrar apenas as próprias reservas
        if current_user_db['role'] != 'adm':
            cursor.execute("""
                SELECT e.numeroDaMatricula, e.id_usuario, e.id_itens, e.data_realizacao_reserva, 
                       e.data_reserva, e.status, u.nome as usuario_nome,
                       i.Nome as item_nome
                FROM emprestimo e
                LEFT JOIN usuarios u ON e.id_usuario = u.numeroDaMatricula
                LEFT JOIN itens i ON e.id_itens = i.numeroDaMatricula
                WHERE u.email = %s
                ORDER BY e.data_reserva
            """, (current_user_email,))
        else:
            # Admin vê todas as reservas
            cursor.execute("""
                SELECT e.numeroDaMatricula, e.id_usuario, e.id_itens, e.data_realizacao_reserva, 
                       e.data_reserva, e.status, u.nome as usuario_nome,
                       i.Nome as item_nome
                FROM emprestimo e
                LEFT JOIN usuarios u ON e.id_usuario = u.numeroDaMatricula
                LEFT JOIN itens i ON e.id_itens = i.numeroDaMatricula
                ORDER BY e.data_reserva
            """)
            
        reservas_db = cursor.fetchall()
        cursor.close()
        
        # Resto do código permanece igual...
        reservas_formatadas = {}
        for r in reservas_db:
            data_key = r['data_reserva'].strftime('%Y-%m-%d') if r['data_reserva'] else None
            if data_key:
                if data_key not in reservas_formatadas:
                    reservas_formatadas[data_key] = {}
                
                horario_key = '1'
                if r['data_realizacao_reserva']:
                    hora = r['data_realizacao_reserva'].hour
                    if 7 <= hora < 12:
                        horario_key = '1'
                    elif 13 <= hora < 17:
                        horario_key = '6'  
                    elif 19 <= hora < 22:
                        horario_key = '10'
                
                reserva_key = f"{horario_key}_{r['id_itens']}"
                
                reservas_formatadas[data_key][reserva_key] = {
                    'numeroDaMatricula': r['numeroDaMatricula'],
                    'reserved': True,
                    'resource': str(r['id_itens']),
                    'resourceName': r['item_nome'] or 'Recurso',
                    'userId': r['id_usuario'],
                    'userName': r['usuario_nome'],
                    'originalSlotKey': horario_key,
                    'timeRange': r['data_realizacao_reserva'].strftime('%H:%M') if r['data_realizacao_reserva'] else '07:30-08:20'
                }
        
        return jsonify({'reservas': reservas_formatadas})
        
    except Exception as e:
        print(f"Erro ao buscar reservas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    
@app.route('/api/reservas', methods=['POST'])
def api_create_reserva():
    """Cria uma nova reserva"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Verificar usuário no banco - CORRIGIDO: passando o email como argumento
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    try:
        data = request.get_json()
        data_reserva = data.get('data_reserva')
        horario = data.get('horario')
        recurso = data.get('recurso')
        
        # Para não-admins, usar o próprio ID do usuário
        if current_user_db['role'] != 'adm':
            id_usuario = current_user_db['numeroDaMatricula']
        else:
            id_usuario = data.get('id_usuario', current_user_db['numeroDaMatricula'])
        
        # Resto do código permanece igual...
        from datetime import datetime
        
        data_obj = datetime.strptime(data_reserva, '%Y-%m-%d')
        horario_inicio = horario.split(' às ')[0]
        data_realizacao = datetime.strptime(f"{data_reserva} {horario_inicio}", '%Y-%m-%d %H:%M')
        
        cursor = mydb.cursor()
        cursor.execute("""
            INSERT INTO emprestimo (id_usuario, id_itens, data_realizacao_reserva, data_reserva, status)
            VALUES (%s, %s, %s, %s, 'reservado')
        """, (id_usuario, recurso, data_realizacao, data_obj))
        
        mydb.commit()
        reserva_id = cursor.lastrowid
        cursor.close()
        
        return jsonify({
            'success': True,
            'reserva_id': reserva_id,
            'message': 'Reserva criada com sucesso'
        })
        
    except Exception as e:
        print(f"Erro ao criar reserva: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    
@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def api_delete_reserva(reserva_id):
    """Cancela uma reserva existente"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    # Verificar usuário no banco - CORRIGIDO: passando o email como argumento
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    try:
        cursor = mydb.cursor()
        
        # Se não for admin, verificar se a reserva pertence ao usuário
        if current_user_db['role'] != 'adm':
            cursor.execute("SELECT id_usuario FROM emprestimo WHERE numeroDaMatricula = %s", (reserva_id,))
            reserva = cursor.fetchone()
            
            if not reserva:
                return jsonify({'error': 'Reserva não encontrada'}), 404
                
            if reserva[0] != current_user_db['numeroDaMatricula']:
                return jsonify({'error': 'Não autorizado a cancelar esta reserva'}), 403
        
        cursor.execute("DELETE FROM emprestimo WHERE numeroDaMatricula = %s", (reserva_id,))
        mydb.commit()
        cursor.close()
        
        return jsonify({
            'success': True,
            'message': 'Reserva cancelada com sucesso'
        })
        
    except Exception as e:
        print(f"Erro ao cancelar reserva: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500



@app.route('/relatorios')
def relatorios():
    # Only admins can access reports
    check = require_admin_or_redirect()
    if check:
        return check
    return render_template('relatorios.html')


@app.route('/usuarios')
def usuarios():
    # Admin-only user management view
    check = require_admin_or_redirect()
    if check:
        return check
    # Fetch all users and their roles from DB
    cursor = mydb.cursor()
    cursor.execute("SELECT nome, email, role FROM usuarios ORDER BY nome ASC")
    usuarios = cursor.fetchall()
    cursor.close()
    return render_template('usuarios.html', usuarios=usuarios)

@app.route('/catalogo.html', methods=['GET', 'POST'])
def catalogo():
    check = require_login_or_redirect()
    if check:
        return check
    cursor = mydb.cursor()
    query = "SELECT Nome, quantidade, numeroDaMatricula FROM itens"
    cursor.execute(query)
    itens = cursor.fetchall()
    cursor.close()
    return render_template('catalogo.html', itens=itens)


