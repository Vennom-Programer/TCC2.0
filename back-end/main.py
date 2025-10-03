from flask import Flask, render_template, request, redirect, session, url_for, jsonify
import mysql.connector
from datetime import datetime
import threading

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_aqui'

# Thread-local storage para conexões do banco
thread_local = threading.local()

def get_db_connection():
    """Obtém ou cria uma conexão com o banco de dados para a thread atual"""
    if not hasattr(thread_local, 'db_connection') or not thread_local.db_connection.is_connected():
        try:
            thread_local.db_connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="root",
                database="smartreserva",
                autocommit=True
            )
            print("Nova conexão MySQL estabelecida")
        except mysql.connector.Error as e:
            print(f"Erro ao conectar com o banco: {e}")
            raise
    return thread_local.db_connection

def get_cursor():
    """Obtém um cursor para a conexão atual"""
    connection = get_db_connection()
    return connection.cursor(dictionary=True)

def close_cursor(cursor):
    """Fecha o cursor de forma segura"""
    try:
        if cursor:
            cursor.close()
    except Exception as e:
        print(f"Erro ao fechar cursor: {e}")

# =============================================
# CORREÇÕES DE INTEGRIDADE REFERENCIAL
# =============================================

def corrigir_integridade_banco():
    """Corrige problemas de integridade referencial no banco"""
    cursor = None
    try:
        cursor = get_cursor()
        
        # 1. Verificar e popular tabela classificacao se estiver vazia
        cursor.execute("SELECT COUNT(*) FROM classificacao")
        if cursor.fetchone()['COUNT(*)'] == 0:
            cursor.execute("""
                INSERT INTO classificacao (id, nome) VALUES 
                (1, 'Equipamento Eletrônico'),
                (2, 'Material Didático'),
                (3, 'Mobiliário'),
                (4, 'Ferramenta'),
                (5, 'Outros')
            """)
            print("Tabela classificacao populada")
        
        # 2. Adicionar FK para classificacao se não existir
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_NAME = 'itens' 
            AND CONSTRAINT_NAME = 'fk_classificacao'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        """)
        if not cursor.fetchone():
            # Temporariamente desabilita verificações para adicionar a FK
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            try:
                cursor.execute("""
                    ALTER TABLE itens 
                    ADD CONSTRAINT fk_classificacao 
                    FOREIGN KEY (id_classificacao) 
                    REFERENCES classificacao(id)
                """)
                print("Foreign Key fk_classificacao adicionada")
            except mysql.connector.Error as e:
                print(f"Aviso: Não foi possível adicionar fk_classificacao: {e}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        # 3. Adicionar FKs para emprestimo se não existirem
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_NAME = 'emprestimo' 
            AND CONSTRAINT_NAME = 'fk_emprestimo_usuario'
        """)
        if not cursor.fetchone():
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            try:
                cursor.execute("""
                    ALTER TABLE emprestimo 
                    ADD CONSTRAINT fk_emprestimo_usuario 
                    FOREIGN KEY (id_usuario) 
                    REFERENCES usuarios(numeroDaMatricula)
                """)
                print("Foreign Key fk_emprestimo_usuario adicionada")
            except mysql.connector.Error as e:
                print(f"Aviso: Não foi possível adicionar fk_emprestimo_usuario: {e}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_NAME = 'emprestimo' 
            AND CONSTRAINT_NAME = 'fk_emprestimo_itens'
        """)
        if not cursor.fetchone():
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            try:
                cursor.execute("""
                    ALTER TABLE emprestimo 
                    ADD CONSTRAINT fk_emprestimo_itens 
                    FOREIGN KEY (id_itens) 
                    REFERENCES itens(id)
                """)
                print("Foreign Key fk_emprestimo_itens adicionada")
            except mysql.connector.Error as e:
                print(f"Aviso: Não foi possível adicionar fk_emprestimo_itens: {e}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        get_db_connection().commit()
        
    except mysql.connector.Error as e:
        print(f"Erro ao corrigir integridade do banco: {e}")
    finally:
        close_cursor(cursor)

# Executar correções na inicialização
with app.app_context():
    corrigir_integridade_banco()

# =============================================
# FUNÇÕES AUXILIARES CORRIGIDAS
# =============================================

def get_user_role(email):
    """Query the database for the given user's role. Returns the role string or None."""
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT role FROM usuarios WHERE email = %s", (email,))
        row = cursor.fetchone()
        if row:
            return row['role']
    except Exception as e:
        print(f"Erro ao buscar role: {e}")
        return None
    finally:
        close_cursor(cursor)
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
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT numeroDaMatricula, email, senha, nome, role FROM usuarios WHERE email = %s", (email,))
        user = cursor.fetchone()
        return user
    except Exception as e:
        print(f"Erro ao buscar dados do usuário: {e}")
        return None
    finally:
        close_cursor(cursor)

# =============================================
# ROTAS PRINCIPAIS (CORRIGIDAS)
# =============================================

@app.route('/')
def menu():
    return render_template('login.html')

@app.route('/cadastro')
def cadastro():
    if session.get('usuario_logado'):
        db_role = get_user_role(session.get('usuario_logado'))
        if not db_role:
            db_role = session.get('usuario_role')
        if db_role and str(db_role).strip().lower() != 'adm':
            return redirect('/?error=forbidden')
    return render_template('cadastro.html')

@app.route('/cadastro', methods=['POST'])
def cadastro_post():
    nome = request.form.get('nome')
    email = request.form.get('email')
    senha = request.form.get('senha')
    numeroDaMatricula = request.form.get('numeroDaMatricula')
    role = request.form.get('role')

    current_role = None
    if session.get('usuario_logado'):
        current_role = get_user_role(session.get('usuario_logado'))
        if not current_role:
            current_role = session.get('usuario_role')
    if session.get('usuario_logado') and current_role != 'adm':
        return redirect('/cadastro?error=forbidden')

    if role and current_role != 'adm':
        return redirect('/cadastro?error=forbidden')

    if current_role == 'adm' and role and str(role).strip().lower() == 'adm':
        admin_password = request.form.get('admin_password')
        cursor_check = None
        try:
            cursor_check = get_cursor()
            cursor_check.execute("SELECT senha FROM usuarios WHERE email = %s", (session.get('usuario_logado'),))
            row = cursor_check.fetchone()
            if not row or row['senha'] != admin_password:
                return redirect('/cadastro?error=admin_auth_failed')
        finally:
            close_cursor(cursor_check)

    if not session.get('usuario_logado'):
        role = 'professor'

    cursor = None
    try:
        cursor = get_cursor()
        
        # Verificar se o email já existe
        cursor.execute("SELECT 1 FROM usuarios WHERE email = %s", (email,))
        if cursor.fetchone():
            return redirect('/cadastro?error=exists')
        
        # Verificar se o nome completo já existe
        cursor.execute("SELECT 1 FROM usuarios WHERE nome = %s", (nome,))
        if cursor.fetchone():
            return redirect('/cadastro?error=name_exists')
        
        # Verificar se o número da matrícula já existe
        cursor.execute("SELECT 1 FROM usuarios WHERE numeroDaMatricula = %s", (numeroDaMatricula,))
        if cursor.fetchone():
            return redirect('/cadastro?error=matricula_exists')

        insert_query = "INSERT INTO usuarios (nome, email, senha, numeroDaMatricula, role) VALUES (%s, %s, %s, %s, %s)"
        insert_values = (nome, email, senha, numeroDaMatricula, role)
        cursor.execute(insert_query, insert_values)
        get_db_connection().commit()
        
        redirect_url = '/cadastro?success=1'
        if role:
            redirect_url += '&role=' + role
        return redirect(redirect_url)
        
    except Exception as e:
        print(f"Erro no cadastro: {e}")
        return redirect('/cadastro?error=1')
    finally:
        close_cursor(cursor)

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def loginPost():
    email = request.form.get('email')
    senha = request.form.get('password')
    role = request.form.get('role')
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT role FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
        row = cursor.fetchone()
        
        if not row:
            return render_template('login.html', error="Email ou senha incorretos")

        db_role = row['role']

        if role:
            if not db_role:
                return render_template('login.html', error="Verificação de função indisponível no servidor. Contate o administrador.")
            if role.strip().lower() != str(db_role).strip().lower():
                return render_template('login.html', error="Você escolheu o tipo de usuário errado.")

        session['usuario_logado'] = email
        session['usuario_role'] = db_role

        return redirect(url_for('index'))
        
    except Exception as e:
        print(f"Erro no login: {e}")
        return render_template('login.html', error="Erro ao verificar credenciais. Tente novamente mais tarde.")
    finally:
        close_cursor(cursor)

@app.route('/cadastroItem.html', methods=['GET'])
def cadastroItens():
    check = require_login_or_redirect()
    if check:
        return check
    
    # Buscar classificações e localizações para o formulário
    cursor_classificacoes = None
    cursor_localizacoes = None
    try:
        cursor_classificacoes = get_cursor()
        cursor_classificacoes.execute("SELECT id, nome FROM classificacao ORDER BY id")
        classificacoes = cursor_classificacoes.fetchall()
        
        cursor_localizacoes = get_cursor()
        cursor_localizacoes.execute("SELECT id, nome FROM localizacao")
        localizacoes = cursor_localizacoes.fetchall()
        
        return render_template('cadastroItem.html', 
                             classificacoes=classificacoes, 
                             localizacoes=localizacoes)
    except Exception as e:
        print(f"Erro ao carregar cadastro de itens: {e}")
        return render_template('cadastroItem.html', classificacoes=[], localizacoes=[])
    finally:
        close_cursor(cursor_classificacoes)
        close_cursor(cursor_localizacoes)

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
    categoria_selecionada = request.form.get('categoria-selecionada')
    
    # Validação da categoria selecionada
    if not categoria_selecionada:
        return redirect('/cadastroItem.html?error=categoria_nao_selecionada')
    
    if not id_classificacao:
        return redirect('/cadastroItem.html?error=tipo_nao_selecionado')
    
    # Validar se a classificação existe e é compatível com a categoria
    cursor_check = None
    try:
        cursor_check = get_cursor()
        cursor_check.execute("SELECT id FROM classificacao WHERE id = %s", (id_classificacao,))
        classificacao = cursor_check.fetchone()
        
        if not classificacao:
            return redirect('/cadastroItem.html?error=classificacao_invalida')
            
        # Validação adicional de compatibilidade categoria-classificação
        id_classificacao_int = int(id_classificacao)
        if categoria_selecionada == 'equipamento' and id_classificacao_int == 3:
            return redirect('/cadastroItem.html?error=incompativel_equipamento')
        elif categoria_selecionada == 'espaco' and id_classificacao_int in [1, 2, 4]:
            return redirect('/cadastroItem.html?error=incompativel_espaco')
            
    except Exception as e:
        print(f"Erro ao validar classificação: {e}")
        return redirect('/cadastroItem.html?error=erro_validacao')
    finally:
        close_cursor(cursor_check)
    
    cursor = None
    try:
        cursor = get_cursor()
        query = """
        INSERT INTO itens (Nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        values = (nome, id_classificacao, descricao, quantidade, id_localizacao, especificacaotec)
        cursor.execute(query, values)
        get_db_connection().commit()
        return redirect('/catalogo.html?success=1')
    except mysql.connector.IntegrityError as e:
        print(f"Erro de integridade ao cadastrar item: {e}")
        return redirect('/cadastroItem.html?error=integridade')
    except Exception as e:
        print(f"Erro ao cadastrar item: {e}")
        return redirect('/cadastroItem.html?error=1')
    finally:
        close_cursor(cursor)

@app.route('/index.html', methods=['GET', 'POST'])
def index():
    check = require_login_or_redirect()
    if check:
        return check
    return render_template('index.html')

@app.route('/logout')
def logout():
    session.pop('usuario_logado', None)
    session.pop('usuario_role', None)
    return redirect('/login')

# =============================================
# ROTAS DO CALENDÁRIO (CORRIGIDAS)
# =============================================

@app.route('/calendario.html', methods=['GET', 'POST'])
def calendario():
    check = require_login_or_redirect()
    if check:
        return check

    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        session.pop('usuario_logado', None)
        session.pop('usuario_role', None)
        return redirect('/login?error=user_not_found')
    
    session['usuario_role'] = current_user_db['role']
    
    current_user = {
        'numeroDaMatricula': current_user_db['numeroDaMatricula'],
        'nome': current_user_db['nome'],
        'email': current_user_db['email'],
        'role': current_user_db['role']
    }

    # Buscar reservas - CORRIGIDO: usando colunas corretas
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT id, id_usuario, id_itens, data_realizacao_reserva, data_reserva, status FROM emprestimo")
        rows = cursor.fetchall()

        reservas = []
        for r in rows:
            data_realizacao_reserva = r['data_realizacao_reserva'].isoformat() if hasattr(r['data_realizacao_reserva'], 'isoformat') else (str(r['data_realizacao_reserva']) if r['data_realizacao_reserva'] is not None else None)
            data_reserva = r['data_reserva'].isoformat() if hasattr(r['data_reserva'], 'isoformat') else (str(r['data_reserva']) if r['data_reserva'] is not None else None)

            reservas.append({
                'id': r['id'],
                'id_usuario': r['id_usuario'],
                'id_item': r['id_itens'],
                'data_realizacao': data_realizacao_reserva,
                'data_reserva': data_reserva,
                'status': r['status']
            })

        # Buscar lista de usuários (apenas para admins)
        usuarios = []
        if current_user_db['role'] == 'adm':
            cursor_usuarios = None
            try:
                cursor_usuarios = get_cursor()
                cursor_usuarios.execute("SELECT numeroDaMatricula, nome FROM usuarios ORDER BY nome ASC")
                usuarios_rows = cursor_usuarios.fetchall()
                for u in usuarios_rows:
                    usuarios.append({ 'numeroDaMatricula': u['numeroDaMatricula'], 'nome': u['nome'] })
            except Exception as e:
                print(f"Erro ao buscar usuários: {e}")
            finally:
                close_cursor(cursor_usuarios)

        return render_template('calendario.html', reservas=reservas, current_user=current_user, usuarios=usuarios)
        
    except Exception as e:
        print(f"Erro no calendário: {e}")
        return render_template('calendario.html', reservas=[], current_user=current_user, usuarios=[])
    finally:
        close_cursor(cursor)

# Funções auxiliares do calendário (mantidas)
def map_time_to_slot_key(data_hora):
    if not data_hora:
        return '1'
    
    if isinstance(data_hora, str):
        try:
            data_hora = datetime.strptime(data_hora, '%Y-%m-%d %H:%M:%S')
        except:
            return '1'
    
    hora = data_hora.hour
    minuto = data_hora.minute
    
    if 7 <= hora < 12:
        if hora == 7 and minuto >= 30: return '1'
        elif hora == 8 and minuto < 20: return '1'
        elif hora == 8 and minuto >= 20: return '2'
        elif hora == 9 and minuto < 40: return '2'
        elif hora == 9 and minuto >= 40: return '3'
        elif hora == 10 and minuto < 20: return '3'
        elif hora == 10 and minuto >= 20: return '4'
        elif hora == 11 and minuto < 10: return '4'
        elif hora == 11 and minuto >= 10: return '5'
    
    elif 13 <= hora < 17:
        if hora == 13 and minuto >= 30: return '6'
        elif hora == 14 and minuto < 20: return '6'
        elif hora == 14 and minuto >= 20: return '7'
        elif hora == 15 and minuto < 30: return '7'
        elif hora == 15 and minuto >= 30: return '8'
        elif hora == 16 and minuto < 10: return '8'
        elif hora == 16 and minuto >= 10: return '9'
    
    elif 19 <= hora < 22:
        if hora == 19 and minuto >= 30: return '10'
        elif hora == 20 and minuto < 20: return '10'
        elif hora == 20 and minuto >= 20: return '11'
        elif hora == 21 and minuto < 10: return '11'
        elif hora == 21 and minuto >= 10: return '12'
    
    return '1'

def get_time_range_from_slot(slot_key):
    time_ranges = {
        '1': '07:30 às 08:20',
        '2': '08:20 às 09:10', 
        '3': '09:40 às 10:20',
        '4': '10:20 às 11:10',
        '5': '11:10 às 12:00',
        '6': '13:30 às 14:20',
        '7': '14:20 às 15:00',
        '8': '15:30 às 16:10',
        '9': '16:10 às 17:00',
        '10': '19:30 às 20:20',
        '11': '20:20 às 21:10',
        '12': '21:10 às 22:00'
    }
    return time_ranges.get(slot_key, '07:30 às 08:20')

def generate_user_color(user_id):
    colors = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#16a085', '#8e44ad', '#c0392b']
    return colors[hash(str(user_id)) % len(colors)]

# =============================================
# APIs DO CALENDÁRIO (CORRIGIDAS)
# =============================================

@app.route('/api/reservas', methods=['GET'])
def api_get_reservas():
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        
        # Query CORRIGIDA: usando colunas corretas
        if current_user_db['role'] != 'adm':
            cursor.execute("""
                SELECT 
                    e.id as reserva_id,
                    e.id_usuario,
                    e.id_itens,
                    e.data_realizacao_reserva,
                    e.data_reserva,
                    e.status,
                    u.nome as usuario_nome,
                    u.numeroDaMatricula as usuario_id,
                    i.Nome as item_nome,
                    i.id as item_id
                FROM emprestimo e
                LEFT JOIN usuarios u ON e.id_usuario = u.numeroDaMatricula
                LEFT JOIN itens i ON e.id_itens = i.id
                WHERE u.email = %s AND e.status = 'reservado'
                ORDER BY e.data_reserva, e.data_realizacao_reserva
            """, (current_user_email,))
        else:
            cursor.execute("""
                SELECT 
                    e.id as reserva_id,
                    e.id_usuario,
                    e.id_itens,
                    e.data_realizacao_reserva,
                    e.data_reserva,
                    e.status,
                    u.nome as usuario_nome,
                    u.numeroDaMatricula as usuario_id,
                    i.Nome as item_nome,
                    i.id as item_id
                FROM emprestimo e
                LEFT JOIN usuarios u ON e.id_usuario = u.numeroDaMatricula
                LEFT JOIN itens i ON e.id_itens = i.id
                WHERE e.status = 'reservado'
                ORDER BY e.data_reserva, e.data_realizacao_reserva
            """)
            
        reservas_db = cursor.fetchall()
        
        reservas_formatadas = {}
        for r in reservas_db:
            if not r['data_reserva']:
                continue
                
            data_key = r['data_reserva'].strftime('%Y-%m-%d')
            if data_key not in reservas_formatadas:
                reservas_formatadas[data_key] = {}
            
            horario_key = map_time_to_slot_key(r['data_realizacao_reserva'])
            
            reserva_key = f"{r['reserva_id']}"
            
            reservas_formatadas[data_key][reserva_key] = {
                'id': r['reserva_id'],
                'reserved': True,
                'resource': str(r['item_id']),
                'resourceName': r['item_nome'] or f'Item {r["item_id"]}',
                'userId': r['usuario_id'],
                'userName': r['usuario_nome'],
                'originalSlotKey': horario_key,
                'timeRange': get_time_range_from_slot(horario_key),
                'userColor': generate_user_color(r['usuario_id'])
            }
        
        return jsonify({'reservas': reservas_formatadas})
        
    except Exception as e:
        print(f"Erro ao buscar reservas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/reservas', methods=['POST'])
def api_create_reserva():
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    cursor = None
    try:
        data = request.get_json()
        data_reserva = data.get('data_reserva')
        horario = data.get('horario')
        recurso = data.get('recurso')
        resource_name = data.get('resource_name', '')
        
        if not all([data_reserva, horario, recurso]):
            return jsonify({'error': 'Dados incompletos'}), 400
        
        if current_user_db['role'] != 'adm':
            id_usuario = current_user_db['numeroDaMatricula']
        else:
            id_usuario = data.get('id_usuario', current_user_db['numeroDaMatricula'])
        
        data_obj = datetime.strptime(data_reserva, '%Y-%m-%d')
        
        horario_inicio = horario.split(' às ')[0]
        data_realizacao = datetime.strptime(f"{data_reserva} {horario_inicio}", '%Y-%m-%d %H:%M')
        
        cursor = get_cursor()
        cursor.execute("""
            SELECT 1 FROM emprestimo 
            WHERE id_itens = %s AND data_realizacao_reserva = %s AND status = 'reservado'
        """, (recurso, data_realizacao))
        
        if cursor.fetchone():
            return jsonify({'error': 'Horário já reservado para este recurso'}), 409
        
        cursor.execute("""
            INSERT INTO emprestimo (id_usuario, id_itens, data_realizacao_reserva, data_reserva, status)
            VALUES (%s, %s, %s, %s, 'reservado')
        """, (id_usuario, recurso, data_realizacao, data_obj))
        
        get_db_connection().commit()
        reserva_id = cursor.lastrowid
        
        return jsonify({
            'success': True,
            'reserva_id': reserva_id,
            'message': 'Reserva criada com sucesso'
        })
        
    except Exception as e:
        print(f"Erro ao criar reserva: {e}")
        return jsonify({'error': f'Erro interno do servidor: {str(e)}'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def api_delete_reserva(reserva_id):
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        
        cursor.execute("""
            SELECT id_usuario, status FROM emprestimo 
            WHERE id = %s
        """, (reserva_id,))
        
        reserva = cursor.fetchone()
        
        if not reserva:
            return jsonify({'error': 'Reserva não encontrada'}), 404
        
        if current_user_db['role'] != 'adm':
            if reserva['id_usuario'] != current_user_db['numeroDaMatricula']:
                return jsonify({'error': 'Não autorizado a cancelar esta reserva'}), 403
        
        cursor.execute("DELETE FROM emprestimo WHERE id = %s", (reserva_id,))
        get_db_connection().commit()
        
        return jsonify({
            'success': True,
            'message': 'Reserva cancelada com sucesso'
        })
        
    except Exception as e:
        print(f"Erro ao cancelar reserva: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/itens', methods=['GET'])
def api_get_itens():
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("""
            SELECT id, Nome as nome, descricao, quantidade, 
                   id_classificacao, id_localizacao, especificacoestec
            FROM itens 
            WHERE quantidade > 0
            ORDER BY Nome
        """)
        
        itens = cursor.fetchall()
        
        return jsonify({
            'itens': itens,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

# =============================================
# NOVAS ROTAS API PARA SUPORTE AO FRONTEND
# =============================================

@app.route('/api/admin/usuarios', methods=['GET'])
def api_get_usuarios_admin():
    """Retorna todos os usuários para admin"""
    check = require_admin_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT numeroDaMatricula, nome, email, role FROM usuarios ORDER BY nome")
        usuarios = cursor.fetchall()
        
        return jsonify({
            'usuarios': usuarios,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar usuários: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/itens/disponiveis', methods=['GET'])
def api_get_itens_disponiveis():
    """Retorna itens disponíveis filtrados por tipo"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        tipo = request.args.get('tipo', 'all')
        cursor = get_cursor()
        
        if tipo == 'equipment':
            # Equipamentos: classificações 1, 2, 4
            cursor.execute("""
                SELECT id, Nome as nome, descricao, quantidade, 
                       id_classificacao, id_localizacao, especificacoestec
                FROM itens 
                WHERE quantidade > 0 AND id_classificacao IN (1, 2, 4)
                ORDER BY Nome
            """)
        elif tipo == 'space':
            # Espaços: classificação 3 (Mobiliário)
            cursor.execute("""
                SELECT id, Nome as nome, descricao, quantidade, 
                       id_classificacao, id_localizacao, especificacoestec
                FROM itens 
                WHERE quantidade > 0 AND id_classificacao = 3
                ORDER BY Nome
            """)
        else:
            # Todos os itens
            cursor.execute("""
                SELECT id, Nome as nome, descricao, quantidade, 
                       id_classificacao, id_localizacao, especificacoestec
                FROM itens 
                WHERE quantidade > 0
                ORDER BY Nome
            """)
        
        itens = cursor.fetchall()
        
        return jsonify({
            'itens': itens,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/recursos/tipos', methods=['GET'])
def api_get_tipos_recursos():
    """Retorna os tipos de recursos disponíveis"""
    return jsonify({
        'tipos': [
            {'id': 'equipment', 'nome': 'Equipamentos', 'classificacoes': [1, 2, 4]},
            {'id': 'space', 'nome': 'Espaços', 'classificacoes': [3]}
        ],
        'success': True
    })

# =============================================
# OUTRAS ROTAS (MANTIDAS)
# =============================================

@app.route('/relatorios')
def relatorios():
    check = require_admin_or_redirect()
    if check:
        return check
    return render_template('relatorios.html')

@app.route('/usuarios')
def usuarios():
    check = require_admin_or_redirect()
    if check:
        return check
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT nome, email, role FROM usuarios ORDER BY nome ASC")
        usuarios = cursor.fetchall()
        return render_template('usuarios.html', usuarios=usuarios)
    finally:
        close_cursor(cursor)

@app.route('/catalogo.html', methods=['GET'])
def catalogo():
    check = require_login_or_redirect()
    if check:
        return check
    
    # Buscar dados do usuário atual do banco
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        session.pop('usuario_logado', None)
        session.pop('usuario_role', None)
        return redirect('/login?error=user_not_found')
    
    # Atualizar a role na sessão com dados do banco
    session['usuario_role'] = current_user_db['role']
    
    cursor = None
    try:
        cursor = get_cursor()
        # Buscar itens com mais informações para o catálogo
        cursor.execute("""
            SELECT i.id, i.Nome, i.quantidade, i.descricao, 
                   c.nome as classificacao_nome, l.nome as localizacao_nome
            FROM itens i
            LEFT JOIN classificacao c ON i.id_classificacao = c.id
            LEFT JOIN localizacao l ON i.id_localizacao = l.id
            ORDER BY i.Nome
        """)
        itens = cursor.fetchall()
        
        # Preparar dados do usuário para o template
        user_data = {
            'numeroDaMatricula': current_user_db['numeroDaMatricula'],
            'nome': current_user_db['nome'],
            'email': current_user_db['email'],
            'role': current_user_db['role'],
            'is_admin': current_user_db['role'] and str(current_user_db['role']).strip().lower() == 'adm'
        }
        
        return render_template('catalogo.html', itens=itens, user=user_data)
        
    except Exception as e:
        print(f"Erro ao carregar catálogo: {e}")
        user_data = {
            'numeroDaMatricula': current_user_db['numeroDaMatricula'],
            'nome': current_user_db['nome'],
            'email': current_user_db['email'],
            'role': current_user_db['role'],
            'is_admin': current_user_db['role'] and str(current_user_db['role']).strip().lower() == 'adm'
        }
        return render_template('catalogo.html', itens=[], user=user_data)
    finally:
        close_cursor(cursor)

@app.teardown_appcontext
def close_db_connection(error):
    """Fecha a conexão com o banco quando o contexto da aplicação é destruído"""
    if hasattr(thread_local, 'db_connection'):
        try:
            thread_local.db_connection.close()
            print("Conexão MySQL fechada")
        except Exception as e:
            print(f"Erro ao fechar conexão: {e}")

if __name__ == '__main__':
    app.run(debug=True, threaded=True)