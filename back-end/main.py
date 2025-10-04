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
# NOVA FUNÇÃO: POPULAR CLASSIFICAÇÕES
# =============================================

def popular_classificacoes():
    """Popula a tabela de classificações com os tipos padrão"""
    cursor = None
    try:
        cursor = get_cursor()
        
        # Verificar se já existem classificações
        cursor.execute("SELECT COUNT(*) as count FROM classificacao")
        result = cursor.fetchone()
        
        if result['count'] == 0:
            # Inserir classificações padrão
            classificacoes = [
                (1, 'Equipamento Eletrônico'),
                (2, 'Material Didático'), 
                (3, 'Mobiliário'),
                (4, 'Ferramenta'),
                (5, 'Outros')
            ]
            
            cursor.executemany(
                "INSERT INTO classificacao (id, nome) VALUES (%s, %s)",
                classificacoes
            )
            get_db_connection().commit()
            print("Tabela classificacao populada com dados iniciais")
            
    except Exception as e:
        print(f"Erro ao popular classificações: {e}")
    finally:
        close_cursor(cursor)

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
        
        # 2. Adicionar tabela localizacao se não existir com campos expandidos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS localizacao (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome VARCHAR(100) NOT NULL,
            )
        """)
        
        # Popular localizacao se estiver vazia
        cursor.execute("SELECT COUNT(*) FROM localizacao")
        if cursor.fetchone()['COUNT(*)'] == 0:
            cursor.execute("""
                INSERT INTO localizacao (nome) VALUES 
                ('Laboratório de Informática', 'laboratorio', 'Bloco A', 'Térreo', 30, 'Laboratório com computadores'),
                ('Sala de Aula 101', 'sala', 'Bloco B', '1º Andar', 40, 'Sala de aula padrão'),
                ('Auditório Principal', 'auditorio', 'Bloco Central', 'Térreo', 100, 'Auditório com capacidade para 100 pessoas'),
                ('Biblioteca', 'sala', 'Bloco A', '2º Andar', 50, 'Setor de empréstimo de livros')
            """)
            print("Tabela localizacao populada")
        
        get_db_connection().commit()
        
    except mysql.connector.Error as e:
        print(f"Erro ao corrigir integridade do banco: {e}")
    finally:
        close_cursor(cursor)

# Executar correções na inicialização
with app.app_context():
    popular_classificacoes()
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
        cursor.execute("SELECT Id, email, senha, nome, role FROM usuarios WHERE email = %s", (email,))
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
    Id = request.form.get('Id')
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
        cursor.execute("SELECT 1 FROM usuarios WHERE Id = %s", (Id,))
        if cursor.fetchone():
            return redirect('/cadastro?error=matricula_exists')

        insert_query = "INSERT INTO usuarios (nome, email, senha, Id, role) VALUES (%s, %s, %s, %s, %s)"
        insert_values = (nome, email, senha, Id, role)
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
        
        # Buscar usuário pelo email e senha
        cursor.execute("SELECT * FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
        usuario = cursor.fetchone()
        
        if not usuario:
            return render_template('login.html', error="Email ou senha incorretos")

        db_role = usuario['role']

        # Verificar se o role selecionado corresponde ao role no banco
        if role:
            if not db_role:
                return render_template('login.html', error="Verificação de função indisponível no servidor. Contate o administrador.")
            if role.strip().lower() != str(db_role).strip().lower():
                return render_template('login.html', error="Você escolheu o tipo de usuário errado.")

        # Configurar sessão do usuário
        session['usuario_logado'] = email
        session['usuario_role'] = db_role
        session['usuario_id'] = usuario['Id']
        session['usuario_nome'] = usuario['nome']

        print(f"Usuário {email} logou com sucesso. Role: {db_role}")  # Log para debug

        # Redirecionar para a página index
        return redirect(url_for('index'))
        
    except Exception as e:
        print(f"Erro no login: {e}")
        return render_template('login.html', error="Erro ao verificar credenciais. Tente novamente mais tarde.")
    finally:
        close_cursor(cursor)

@app.route('/index.html')
def index():
    check = require_login_or_redirect()
    if check:
        return check
    return render_template('index.html')

# =============================================
# NOVA ROTA: VOLTAR PARA INDEX
# =============================================

@app.route('/voltar_index')
def voltar_index():
    """Rota para voltar para a página index"""
    return redirect(url_for('index.html'))

# =============================================
# CADASTRO DE ITENS - CORRIGIDO
# =============================================

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
    especificacoestec = request.form.get('item-specs')
    categoria = request.form.get('categoria')
    
    # Validações básicas
    if not nome or not id_classificacao or not quantidade or not id_localizacao:
        return redirect('/cadastroItem.html?error=campos_obrigatorios')
    
    try:
        quantidade = int(quantidade)
        if quantidade <= 0:
            return redirect('/cadastroItem.html?error=quantidade_invalida')
    except ValueError:
        return redirect('/cadastroItem.html?error=quantidade_invalida')
    
    # Validação categoria vs classificação
    id_classificacao_int = int(id_classificacao)
    
    if categoria == 'equipamento' and id_classificacao_int == 3:
        return redirect('/cadastroItem.html?error=incompativel_equipamento')
    
    if categoria == 'espaco' and id_classificacao_int != 3:
        return redirect('/cadastroItem.html?error=incompativel_espaco')
    
    cursor = None
    try:
        cursor = get_cursor()
        query = """
        INSERT INTO itens (Nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        values = (nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec)
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

        # =============================================
# API PARA CRIAR NOVA LOCALIZAÇÃO
# =============================================

@app.route('/api/localizacoes', methods=['POST'])
def criar_localizacao():
    """API para criar uma nova localização no banco de dados"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    try:
        data = request.get_json()
        id = data.get('id')    
        nome = data.get('nome')
        
        # Validação básica
        if not nome:
            return jsonify({'success': False, 'error': 'Nome da localização é obrigatório'}), 400
        
        cursor = None
        try:
            cursor = get_cursor()
            
            # Verificar se já existe uma localização com o mesmo nome
            cursor.execute("SELECT id FROM localizacao WHERE nome = %s", (id, nome))
            if cursor.fetchone():
                return jsonify({'success': False, 'error': 'Já existe uma localização com este nome'}), 400
            
            # Inserir nova localização
            query = """
                INSERT INTO localizacao (id, nome)
                VALUES (%s, %s)
            """
            values = (nome, id)
            cursor.execute(query, values)
            get_db_connection().commit()
            
            # Obter o ID da localização recém-criada
            nova_localizacao_id = cursor.lastrowid
            
            return jsonify({
                'success': True, 
                'message': 'Localização criada com sucesso',
                'localizacao': {
                    'id': nova_localizacao_id,
                    'nome': nome
                }
            })
            
        except mysql.connector.Error as e:
            print(f"Erro ao criar localização: {e}")
            return jsonify({'success': False, 'error': 'Erro ao salvar localização no banco de dados'}), 500
        finally:
            close_cursor(cursor)
            
    except Exception as e:
        print(f"Erro geral ao criar localização: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500

@app.route('/api/localizacoes', methods=['GET'])
def obter_localizacoes():
    """API para obter todas as localizações"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT id, nome FROM localizacao ORDER BY nome")
        localizacoes = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'localizacoes': localizacoes
        })
        
    except Exception as e:
        print(f"Erro ao buscar localizações: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/localizacoes/<int:localizacao_id>', methods=['DELETE'])
def excluir_localizacao(localizacao_id):
            """API para excluir uma localização"""
check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
cursor = None
try:
        cursor = get_cursor()
        
            # Verificar se existem itens usando esta localização
        cursor.execute("SELECT COUNT(*) as count FROM itens WHERE id_localizacao = %s", (localizacao_id,))
        result = cursor.fetchone()
        
        if result['count'] > 0:
            return jsonify({'success': False, 'error': 'Não é possível excluir localização com itens associados'}), 400
        
        # Verificar se a localização existe
        cursor.execute("SELECT id FROM localizacao WHERE id = %s", (localizacao_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'error': 'Localização não encontrada'}), 404
        
        # Excluir localização
        cursor.execute("DELETE FROM localizacao WHERE id = %s", (localizacao_id,))
        get_db_connection().commit()
        
        return jsonify({'success': True, 'message': 'Localização excluída com sucesso'})
        
    except mysql.connector.Error as e:
        print(f"Erro ao excluir localização: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)


@app.route('/catalogo.html')
def catalogo():
    check = require_login_or_redirect()
    if check:
        return check
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("""
    SELECT i.id, i.Nome, i.descricao, i.quantidade, 
           c.nome as classificacao, l.nome as localizacao, 
           i.especificacoestec, i.categoria 
    FROM itens i 
    JOIN classificacao c ON i.id_classificacao = c.id 
    JOIN localizacao l ON i.id_localizacao = l.id 
    ORDER BY i.Nome
""")
        itens = cursor.fetchall()
        
        # Buscar informações do usuário logado
        usuario_info = {
            'email': session.get('usuario_logado'),
            'nome': session.get('usuario_nome'),
            'role': session.get('usuario_role'),
            'is_admin': session.get('usuario_role') == 'adm'
        }
        
        return render_template('catalogo.html', itens=itens, user=usuario_info)
        
    except Exception as e:
        print(f"Erro ao carregar catálogo: {e}")
        # Retornar dados vazios em caso de erro, mas ainda com informações do usuário
        usuario_info = {
            'email': session.get('usuario_logado'),
            'nome': session.get('usuario_nome'),
            'role': session.get('usuario_role'),
            'is_admin': session.get('usuario_role') == 'adm'
        }
        return render_template('catalogo.html', itens=[], user=usuario_info)
    finally:
        close_cursor(cursor)

# =============================================
# CALENDÁRIO - CORRIGIDO
# =============================================

@app.route('/calendario.html')
def calendario():
    check = require_login_or_redirect()
    if check:
        return check
    
    cursor_itens = None
    cursor_reservas = None
    try:
        # Buscar itens disponíveis para reserva
        cursor_itens = get_cursor()
        cursor_itens.execute("""
            SELECT id, Nome, quantidade, categoria 
            FROM itens 
            WHERE quantidade > 0 
            ORDER BY Nome
        """)
        itens = cursor_itens.fetchall()
        
        # Buscar reservas existentes
        cursor_reservas = get_cursor()
        cursor_reservas.execute("""
            SELECT r.id, r.id_item, i.Nome as item_nome, r.data_inicio, r.data_fim, 
                   r.hora_inicio, r.hora_fim, r.status, u.nome as usuario_nome
            FROM reservas r
            JOIN itens i ON r.id_item = i.id
            JOIN usuarios u ON r.id_usuario = u.Id
            ORDER BY r.data_inicio, r.hora_inicio
        """)
        reservas = cursor_reservas.fetchall()
        
        return render_template('calendario.html', itens=itens, reservas=reservas)
    except Exception as e:
        print(f"Erro ao carregar calendário: {e}")
        return render_template('calendario.html', itens=[], reservas=[])
    finally:
        close_cursor(cursor_itens)
        close_cursor(cursor_reservas)

# =============================================
# NOVAS ROTAS DA API PARA O CALENDÁRIO
# =============================================

@app.route('/api/itens/disponiveis')
def api_itens_disponiveis():
    """API para retornar itens disponíveis para reserva"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    tipo = request.args.get('tipo', 'all')
    cursor = None
    try:
        cursor = get_cursor()
        
        query = "SELECT id, Nome, quantidade, id_classificacao, categoria FROM itens WHERE quantidade > 0"
        
        # Filtrar por tipo se especificado
        if tipo == 'equipment':
            query += " AND id_classificacao IN (1, 2, 4, 5)"
        elif tipo == 'space':
            query += " AND id_classificacao = 3"
        
        query += " ORDER BY Nome"
        
        cursor.execute(query)
        itens = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'itens': itens
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens disponíveis: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/itens')
def api_itens():
    """API para retornar todos os itens"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT id, Nome, quantidade, id_classificacao, categoria FROM itens ORDER BY Nome")
        itens = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'itens': itens
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/recursos/tipos')
def api_recursos_tipos():
    """API para retornar tipos de recursos"""
    return jsonify({
        'tipos': [
            {'id': 'equipment', 'nome': 'Equipamentos'},
            {'id': 'space', 'nome': 'Espaços'}
        ]
    })

@app.route('/api/admin/usuarios')
def api_admin_usuarios():
    """API para retornar usuários (apenas admin)"""
    check = require_admin_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("SELECT Id, nome, email, role FROM usuarios ORDER BY nome")
        usuarios = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'usuarios': usuarios
        })
        
    except Exception as e:
        print(f"Erro ao buscar usuários: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)


# =============================================
# API PARA VERIFICAR USUÁRIO ATUAL
# =============================================

@app.route('/api/usuario/atual')
def api_usuario_atual():
    """API para retornar informações do usuário atual"""
    if not session.get('usuario_logado'):
        return jsonify({'logado': False})
    
    usuario_info = {
        'logado': True,
        'email': session.get('usuario_logado'),
        'role': session.get('usuario_role'),
        'nome': session.get('usuario_nome'),
        'id': session.get('usuario_id')
    }
    
    return jsonify(usuario_info)

# =============================================
# CORREÇÃO DA ROTA DE RESERVAS EXISTENTE
# =============================================

@app.route('/api/reservas', methods=['GET'])
def api_reservas():
    """API para retornar reservas em formato compatível com o frontend"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("""
            SELECT r.id, i.Nome as resourceName, i.id as resourceId,
                   r.data_inicio as data_reserva, 
                   CONCAT(r.hora_inicio, ' às ', r.hora_fim) as horario,
                   u.Id as userId, u.nome as userName,
                   r.status, r.observacao
            FROM reservas r
            JOIN itens i ON r.id_item = i.id
            JOIN usuarios u ON r.id_usuario = u.Id
            WHERE r.status IN ('pendente', 'aprovado')
            ORDER BY r.data_inicio, r.hora_inicio
        """)
        reservas_db = cursor.fetchall()
        
        # Converter para formato esperado pelo frontend
        reservas_formatadas = {}
        
        for reserva in reservas_db:
            data_key = reserva['data_reserva'].strftime('%Y-%m-%d') if isinstance(reserva['data_reserva'], datetime) else reserva['data_reserva']
            
            if data_key not in reservas_formatadas:
                reservas_formatadas[data_key] = {}
            
            # Gerar chave única para a reserva
            reserva_key = f"{reserva['resourceId']}_{reserva['horario'].replace(':', '').replace(' ', '')}"
            
            reservas_formatadas[data_key][reserva_key] = {
                'id': reserva['id'],
                'resourceName': reserva['resourceName'],
                'resourceId': reserva['resourceId'],
                'userId': reserva['userId'],
                'userName': reserva['userName'],
                'horario': reserva['horario'],
                'data_reserva': data_key,
                'status': reserva['status'],
                'reserved': True,
                'originalSlotKey': reserva_key  # Chave simplificada para matching
            }
        
        return jsonify({
            'success': True,
            'reservas': reservas_formatadas
        })
        
    except Exception as e:
        print(f"Erro ao buscar reservas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)

@app.route('/api/reservas', methods=['POST'])
def criar_reserva():
    """Criar uma nova reserva - formato compatível com frontend"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    try:
        data = request.get_json()
        recurso_id = data.get('recurso')
        data_reserva = data.get('data_reserva')
        horario = data.get('horario')
        id_usuario = data.get('id_usuario')
        resource_name = data.get('resource_name', '')
        
        # Validar dados
        if not all([recurso_id, data_reserva, horario]):
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        # Buscar usuário atual se id_usuario não foi fornecido
        if not id_usuario:
            usuario = get_user_data(session.get('usuario_logado'))
            if not usuario:
                return jsonify({'success': False, 'error': 'Usuário não encontrado'}), 400
            id_usuario = usuario['Id']
        
        # Parse do horário (formato: "HH:MM às HH:MM")
        try:
            hora_inicio, hora_fim = horario.split(' às ')
        except ValueError:
            return jsonify({'success': False, 'error': 'Formato de horário inválido'}), 400
        
        # Verificar conflitos de reserva
        cursor_check = None
        cursor_insert = None
        try:
            cursor_check = get_cursor()
            cursor_check.execute("""
                SELECT 1 FROM reservas 
                WHERE id_item = %s AND status IN ('pendente', 'aprovado')
                AND data_inicio = %s
                AND (
                    (hora_inicio BETWEEN %s AND %s OR hora_fim BETWEEN %s AND %s)
                    OR (%s BETWEEN hora_inicio AND hora_fim OR %s BETWEEN hora_inicio AND hora_fim)
                )
            """, (recurso_id, data_reserva, 
                  hora_inicio, hora_fim, hora_inicio, hora_fim,
                  hora_inicio, hora_fim))
            
            if cursor_check.fetchone():
                return jsonify({'success': False, 'error': 'Conflito de horário com reserva existente'}), 400
            
            # Inserir reserva
            cursor_insert = get_cursor()
            cursor_insert.execute("""
                INSERT INTO reservas (id_item, id_usuario, data_inicio, data_fim, 
                                    hora_inicio, hora_fim, observacao, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pendente')
            """, (recurso_id, id_usuario, data_reserva, data_reserva, 
                  hora_inicio, hora_fim, data.get('observacao', '')))
            
            get_db_connection().commit()
            return jsonify({'success': True, 'message': 'Reserva criada com sucesso'})
            
        except mysql.connector.Error as e:
            print(f"Erro ao criar reserva: {e}")
            return jsonify({'success': False, 'error': 'Erro ao criar reserva'}), 500
        finally:
            close_cursor(cursor_check)
            close_cursor(cursor_insert)
            
    except Exception as e:
        print(f"Erro geral ao criar reserva: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def cancelar_reserva(reserva_id):
    """Cancelar uma reserva"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        
        # Verificar se o usuário é o dono da reserva ou admin
        cursor.execute("""
            SELECT r.id_usuario, u.email, r.status 
            FROM reservas r 
            JOIN usuarios u ON r.id_usuario = u.Id 
            WHERE r.id = %s
        """, (reserva_id,))
        
        reserva = cursor.fetchone()
        if not reserva:
            return jsonify({'success': False, 'error': 'Reserva não encontrada'}), 404
        
        usuario_atual = get_user_data(session.get('usuario_logado'))
        is_admin = usuario_atual and usuario_atual.get('role') == 'adm'
        is_owner = reserva['email'] == session.get('usuario_logado')
        
        if not (is_admin or is_owner):
            return jsonify({'success': False, 'error': 'Sem permissão para cancelar esta reserva'}), 403
        
        # Cancelar reserva
        cursor.execute("UPDATE reservas SET status = 'cancelado' WHERE id = %s", (reserva_id,))
        get_db_connection().commit()
        
        return jsonify({'success': True, 'message': 'Reserva cancelada com sucesso'})
        
    except Exception as e:
        print(f"Erro ao cancelar reserva: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)


# =============================================
# ROTA DE GERENCIAMENTO DE USUÁRIOS
# =============================================

@app.route('/usuarios.html')
def usuarios():
    """Rota para exibir e gerenciar usuários (apenas admin)"""
    # Verificar se o usuário é administrador
    check = require_admin_or_redirect()
    if check:
        return check
    
    cursor = None
    try:
        cursor = get_cursor()
        # Buscar todos os usuários do banco de dados
        cursor.execute("SELECT nome, email, role FROM usuarios ORDER BY nome")
        usuarios = cursor.fetchall()
        
        return render_template('usuarios.html', usuarios=usuarios)
        
    except Exception as e:
        print(f"Erro ao buscar usuários: {e}")
        return render_template('usuarios.html', usuarios=[])
    finally:
        close_cursor(cursor)

# =============================================
# ROTA DE LOGOUT
# =============================================

@app.route('/logout')
def logout():
    """Rota para fazer logout do usuário"""
    # Limpa todos os dados da sessão
    session.clear()
    print("Usuário fez logout")  # Log para debug
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)