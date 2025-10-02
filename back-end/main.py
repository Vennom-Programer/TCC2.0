from flask import Flask, render_template, request, redirect, session, url_for, jsonify
import mysql.connector
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_aqui'

# Configuração do banco com tratamento de erro
try:
    mydb = mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="smartreserva"
    )
    print("Conexão com o banco estabelecida com sucesso")
except mysql.connector.Error as e:
    print(f"Erro ao conectar com o banco: {e}")
    # Em produção, você deve tratar isso adequadamente
    raise

# =============================================
# CORREÇÕES DE INTEGRIDADE REFERENCIAL
# =============================================

def corrigir_integridade_banco():
    """Corrige problemas de integridade referencial no banco"""
    try:
        cursor = mydb.cursor()
        
        # 1. Verificar e popular tabela classificacao se estiver vazia
        cursor.execute("SELECT COUNT(*) FROM classificacao")
        if cursor.fetchone()[0] == 0:
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
        
        mydb.commit()
        cursor.close()
        
    except mysql.connector.Error as e:
        print(f"Erro ao corrigir integridade do banco: {e}")
        try:
            cursor.close()
        except:
            pass

# Executar correções na inicialização
corrigir_integridade_banco()

# =============================================
# FUNÇÕES AUXILIARES (MANTIDAS)
# =============================================

def get_user_role(email):
    """Query the database for the given user's role. Returns the role string or None."""
    try:
        cursor = mydb.cursor()
        cursor.execute("SELECT role FROM usuarios WHERE email = %s", (email,))
        row = cursor.fetchone()
        cursor.close()
        if row:
            return row[0]
    except Exception as e:
        print(f"Erro ao buscar role: {e}")
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
        cursor_check = mydb.cursor()
        cursor_check.execute("SELECT senha FROM usuarios WHERE email = %s", (session.get('usuario_logado'),))
        row = cursor_check.fetchone()
        cursor_check.close()
        if not row or row[0] != admin_password:
            return redirect('/cadastro?error=admin_auth_failed')

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
    except Exception as e:
        print(f"Erro no cadastro: {e}")
        cursor.close()
        return redirect('/cadastro?error=1')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def loginPost():
    email = request.form.get('email')
    senha = request.form.get('password')
    role = request.form.get('role')
    
    cursor = mydb.cursor()
    try:
        cursor.execute("SELECT role FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
        row = cursor.fetchone()
        cursor.close()
    except Exception as e:
        print(f"Erro no login: {e}")
        try:
            cursor.close()
        except Exception:
            pass
        return render_template('login.html', error="Erro ao verificar credenciais. Tente novamente mais tarde.")

    if not row:
        return render_template('login.html', error="Email ou senha incorretos")

    db_role = row[0]

    if role:
        if not db_role:
            return render_template('login.html', error="Verificação de função indisponível no servidor. Contate o administrador.")
        if role.strip().lower() != str(db_role).strip().lower():
            return render_template('login.html', error="Você escolheu o tipo de usuário errado.")

    session['usuario_logado'] = email
    session['usuario_role'] = db_role

    return redirect(url_for('index'))

@app.route('/cadastroItem.html', methods=['GET'])
def cadastroItens():
    check = require_login_or_redirect()
    if check:
        return check
    
    # Buscar classificações e localizações para o formulário
    try:
        cursor = mydb.cursor()
        cursor.execute("SELECT id, nome FROM classificacao")
        classificacoes = cursor.fetchall()
        
        cursor.execute("SELECT id, nome FROM localizacao")
        localizacoes = cursor.fetchall()
        cursor.close()
        
        return render_template('cadastroItem.html', 
                             classificacoes=classificacoes, 
                             localizacoes=localizacoes)
    except Exception as e:
        print(f"Erro ao carregar cadastro de itens: {e}")
        return render_template('cadastroItem.html', classificacoes=[], localizacoes=[])

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
    
    # Validar se a classificação existe
    if id_classificacao:
        try:
            cursor_check = mydb.cursor()
            cursor_check.execute("SELECT id FROM classificacao WHERE id = %s", (id_classificacao,))
            if not cursor_check.fetchone():
                return redirect('/cadastroItem.html?error=classificacao_invalida')
            cursor_check.close()
        except Exception as e:
            print(f"Erro ao validar classificação: {e}")
            return redirect('/cadastroItem.html?error=erro_validacao')
    
    cursor = mydb.cursor()
    try:
        query = """
        INSERT INTO itens (Nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        values = (nome, id_classificacao, descricao, quantidade, id_localizacao, especificacaotec)
        cursor.execute(query, values)
        mydb.commit()
        cursor.close()
        return redirect('/catalogo.html?success=1')
    except mysql.connector.IntegrityError as e:
        print(f"Erro de integridade ao cadastrar item: {e}")
        cursor.close()
        return redirect('/cadastroItem.html?error=integridade')
    except Exception as e:
        print(f"Erro ao cadastrar item: {e}")
        cursor.close()
        return redirect('/cadastroItem.html?error=1')

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
    cursor = mydb.cursor()
    cursor.execute("SELECT id, id_usuario, id_itens, data_realizacao_reserva, data_reserva, status FROM emprestimo")
    rows = cursor.fetchall()
    cursor.close()

    reservas = []
    for r in rows:
        data_realizacao_reserva = r[3].isoformat() if hasattr(r[3], 'isoformat') else (str(r[3]) if r[3] is not None else None)
        data_reserva = r[4].isoformat() if hasattr(r[4], 'isoformat') else (str(r[4]) if r[4] is not None else None)

        reservas.append({
            'id': r[0],
            'id_usuario': r[1],
            'id_item': r[2],
            'data_realizacao': data_realizacao_reserva,
            'data_reserva': data_reserva,
            'status': r[5]
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
    
    try:
        cursor = mydb.cursor(dictionary=True)
        
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
        cursor.close()
        
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

@app.route('/api/reservas', methods=['POST'])
def api_create_reserva():
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
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
        
        cursor = mydb.cursor()
        cursor.execute("""
            SELECT 1 FROM emprestimo 
            WHERE id_itens = %s AND data_realizacao_reserva = %s AND status = 'reservado'
        """, (recurso, data_realizacao))
        
        if cursor.fetchone():
            cursor.close()
            return jsonify({'error': 'Horário já reservado para este recurso'}), 409
        
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
        return jsonify({'error': f'Erro interno do servidor: {str(e)}'}), 500

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def api_delete_reserva(reserva_id):
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    current_user_email = session.get('usuario_logado')
    current_user_db = get_user_data(current_user_email)
    
    if not current_user_db:
        return jsonify({'error': 'Usuário não encontrado'}), 401
    
    try:
        cursor = mydb.cursor(dictionary=True)
        
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
        mydb.commit()
        cursor.close()
        
        return jsonify({
            'success': True,
            'message': 'Reserva cancelada com sucesso'
        })
        
    except Exception as e:
        print(f"Erro ao cancelar reserva: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/itens', methods=['GET'])
def api_get_itens():
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    try:
        cursor = mydb.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, Nome as nome, descricao, quantidade, 
                   id_classificacao, id_localizacao, especificacoestec
            FROM itens 
            WHERE quantidade > 0
            ORDER BY Nome
        """)
        
        itens = cursor.fetchall()
        cursor.close()
        
        return jsonify({
            'itens': itens,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    
    # =============================================
# NOVAS ROTAS API PARA SUPORTE AO FRONTEND
# =============================================

@app.route('/api/admin/usuarios', methods=['GET'])
def api_get_usuarios_admin():
    """Retorna todos os usuários para admin"""
    check = require_admin_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    try:
        cursor = mydb.cursor(dictionary=True)
        cursor.execute("SELECT numeroDaMatricula, nome, email, role FROM usuarios ORDER BY nome")
        usuarios = cursor.fetchall()
        cursor.close()
        
        return jsonify({
            'usuarios': usuarios,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar usuários: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/itens/disponiveis', methods=['GET'])
def api_get_itens_disponiveis():
    """Retorna itens disponíveis filtrados por tipo"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    try:
        tipo = request.args.get('tipo', 'all')
        cursor = mydb.cursor(dictionary=True)
        
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
        cursor.close()
        
        return jsonify({
            'itens': itens,
            'success': True
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

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
    query = "SELECT id, Nome, quantidade FROM itens"  # CORRIGIDO: usando 'id' em vez de 'numeroDaMatricula'
    cursor.execute(query)
    itens = cursor.fetchall()
    cursor.close()
    return render_template('catalogo.html', itens=itens)

if __name__ == '__main__':
    app.run(debug=True)