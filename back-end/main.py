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
                auth_plugin='mysql_native_password'
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
                (1, 'Data-Show'),
                (2, 'Caixa de Som'), 
                (3, 'Microfone'),
                (4, 'Notebook'),
                (5, 'Eletrônico'),
                (6, 'Laboratório'),
                (7, 'Auditório')
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
                (1, 'Data-Show'),
                (2, 'Caixa de Som'),
                (3, 'Microfone'),
                (4, 'Notebook'),
                (5, 'Eletrônico'),
                (6, 'Laboratório'),
                (7, 'Auditório')
            """)
            print("Tabela classificacao populada")
        
       # 2. Adicionar tabela localizacao se não existir com campos expandidos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS localizacao (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nome VARCHAR(100) NOT NULL
            )
            """)
        
        # Popular localizacao se estiver vazia
        cursor.execute("SELECT COUNT(*) FROM localizacao")
        if cursor.fetchone()['COUNT(*)'] == 0:
            cursor.execute("""
                INSERT INTO localizacao (nome) VALUES 
                ('Laboratório de Informática'),
                ('Auditório'),
                ('Sala')
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


def verificar_tabela_itens():
    """Verifica e cria a tabela itens se não existir"""
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS itens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                Nome VARCHAR(255) NOT NULL,
                id_classificacao INT NOT NULL,
                descricao TEXT,
                quantidade INT NOT NULL DEFAULT 1,
                id_localizacao INT NOT NULL,
                especificacoestec TEXT,
                categoria VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_classificacao) REFERENCES classificacao(id),
                FOREIGN KEY (id_localizacao) REFERENCES localizacao(id)
            )
        """)
        get_db_connection().commit()
        print("Tabela itens verificada/criada com sucesso")
    except Exception as e:
        print(f"Erro ao verificar/criar tabela itens: {e}")
    finally:
        close_cursor(cursor)

# Adicione esta chamada na inicialização
with app.app_context():
    popular_classificacoes()
    corrigir_integridade_banco()
    verificar_tabela_itens()  # ← ADICIONE ESTA LINHA

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
    if str(db_role).strip().lower() != 'admin':
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
        if db_role and str(db_role).strip().lower() != 'admin':
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
    if session.get('usuario_logado') and str(current_role).strip().lower() != 'admin':
        return redirect('/cadastro?error=forbden')

    if role and str(current_role).strip().lower() != 'admin':
        return redirect('/cadastro?error=forbden')

    if str(current_role).strip().lower() == 'admin' and role and str(role).strip().lower() == 'admin':
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

        insert_query = "INSERT INTO usuarios (nome, email, senha, id, role) VALUES (%s, %s, %s, %s, %s)"
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
        session['usuario_id'] = usuario['id']
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
    return redirect(url_for('index'))

# =============================================
# CADASTRO DE ITENS - CORRIGIDO
# =============================================

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
        cursor_localizacoes.execute("SELECT id, nome FROM localizacao ORDER BY nome")
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
    
    print(f"Dados recebidos do formulário:")
    print(f"Nome: {nome}")
    print(f"ID Classificação: {id_classificacao}")
    print(f"Descrição: {descricao}")
    print(f"Quantidade: {quantidade}")
    print(f"ID Localização: {id_localizacao}")
    print(f"Especificações: {especificacoestec}")
    print(f"Categoria: {categoria}")
    
    # Validações básicas
    if not nome or not id_classificacao or not quantidade or not id_localizacao:
        print("Erro: Campos obrigatórios não preenchidos")
        return redirect('/cadastroItem.html?error=campos_obrigatorios')
    
    try:
        quantidade = int(quantidade)
        if quantidade <= 0:
            return redirect('/cadastroItem.html?error=quantidade_invalida')
    except ValueError:
        return redirect('/cadastroItem.html?error=quantidade_invalida')
    
    # Validação categoria vs classificação
    try:
        id_classificacao_int = int(id_classificacao)
        
        if categoria == 'equipamento' and id_classificacao_int == 3:
            return redirect('/cadastroItem.html?error=incompativel_equipamento')
        
        if categoria == 'espaco' and id_classificacao_int != 3:
            return redirect('/cadastroItem.html?error=incompativel_espaco')
    except ValueError:
        return redirect('/cadastroItem.html?error=classificacao_invalida')
    
    cursor = None
    try:
        cursor = get_cursor()
        
        # Verificar se a classificação existe
        cursor.execute("SELECT id FROM classificacao WHERE id = %s", (id_classificacao,))
        if not cursor.fetchone():
            return redirect('/cadastroItem.html?error=classificacao_nao_existe')
        
        # Verificar se a localização existe
        cursor.execute("SELECT id FROM localizacao WHERE id = %s", (id_localizacao,))
        if not cursor.fetchone():
            return redirect('/cadastroItem.html?error=localizacao_nao_existe')
        
        # Inserir item no banco de dados
        query = """
        INSERT INTO itens (Nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec, categoria)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        values = (nome, id_classificacao, descricao, quantidade, id_localizacao, especificacoestec, categoria)
        
        print(f"Executando query: {query}")
        print(f"Com valores: {values}")
        
        cursor.execute(query, values)
        
        # COMMIT EXPLÍCITO para garantir que os dados sejam salvos
        connection = get_db_connection()
        connection.commit()
        
        print("Item cadastrado com sucesso no banco de dados!")
        
        # Redirecionar para o catálogo com mensagem de sucesso
        return redirect('/catalogo.html?success=1')
        
    except mysql.connector.IntegrityError as e:
        print(f"Erro de integridade ao cadastrar item: {e}")
        return redirect('/cadastroItem.html?error=integridade')
    except mysql.connector.Error as e:
        print(f"Erro MySQL ao cadastrar item: {e}")
        return redirect('/cadastroItem.html?error=banco_dados')
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
        nome = data.get('nome')
        
        # Validação básica
        if not nome:
            return jsonify({'success': False, 'error': 'Nome da localização é obrigatório'}), 400
        
        cursor = None
        try:
            cursor = get_cursor()
            
            # Verificar se já existe uma localização com o mesmo nome
            cursor.execute("SELECT id FROM localizacao WHERE nome = %s", (nome,))
            if cursor.fetchone():
                return jsonify({'success': False, 'error': 'Já existe uma localização com este nome'}), 400
            
            # Inserir nova localização
            query = """
                INSERT INTO localizacao (nome)
                VALUES (%s)
            """
            values = (nome,)  # ← CORRIGIDO: adicione a vírgula para criar uma tupla
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
            
        except mysql.connector.IntegrityError as e:
            print(f"Erro de integridade ao criar localização: {e}")
            return jsonify({'success': False, 'error': 'Erro de integridade do banco de dados'}), 500
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
                   i.especificacoestec, i.id_classificacao, i.id_localizacao
            FROM itens i 
            JOIN classificacao c ON i.id_classificacao = c.id 
            JOIN localizacao l ON i.id_localizacao = l.id 
            ORDER BY i.Nome
        """)
        itens = cursor.fetchall()
        
        # Buscar informações do usuário logado
        usuario_role = session.get('usuario_role') or ''
        usuario_info = {
            'email': session.get('usuario_logado'),
            'nome': session.get('usuario_nome'),
            'role': usuario_role,
            'id': session.get('usuario_id'),
            'is_admin': str(usuario_role).strip().lower() == 'admin'
        }

        
        return render_template('catalogo.html', itens=itens, user=usuario_info)
        
    except Exception as e:
        print(f"Erro ao carregar catálogo: {e}")
        # Retornar dados vazios em caso de erro, mas ainda com informações do usuário
        usuario_info = {
            'email': session.get('usuario_logado'),
            'nome': session.get('usuario_nome'),
            'role': session.get('usuario_role'),
            'is_admin': str(session.get('usuario_role', '')).strip().lower() == 'admin'
        }
        return render_template('catalogo.html', itens=[], user=usuario_info)
    finally:
        close_cursor(cursor)

@app.route('/api/catalogo/itens')
def api_catalogo_itens():
    """API para retornar itens do catálogo"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    cursor = None
    try:
        cursor = get_cursor()
        cursor.execute("""
            SELECT i.id, i.Nome, i.descricao, i.quantidade, 
                   c.nome as classificacao, l.nome as localizacao, 
                   i.especificacoestec, i.id_classificacao, i.id_localizacao
            FROM itens i 
            JOIN classificacao c ON i.id_classificacao = c.id 
            JOIN localizacao l ON i.id_localizacao = l.id 
            ORDER BY i.Nome
        """)
        itens = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'itens': itens
        })
        
    except Exception as e:
        print(f"Erro ao buscar itens do catálogo: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    finally:
        close_cursor(cursor)


# =============================================
# ROTAS PARA GERENCIAR ITENS DO CATÁLOGO
# =============================================

@app.route('/api/itens/<int:item_id>', methods=['PUT'])
def editar_item(item_id):
    """API para editar um item do catálogo"""
    print(f"\n[PUT /api/itens/{item_id}] Requisição de edição recebida")
    
    check = require_login_or_redirect()
    if check:
        print(f"[PUT /api/itens/{item_id}] Erro: Usuário não autenticado")
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401

    # Verificar se o usuário é administrador
    usuario_role = str(session.get('usuario_role', '')).strip().lower()
    if usuario_role != 'admin':
        print(f"[PUT /api/itens/{item_id}] Erro: Usuário não é admin (role={usuario_role})")
        return jsonify({'success': False, 'error': 'Apenas administradores podem editar itens'}), 403

    try:
        data = request.get_json()
        nome = data.get('nome')
        quantidade = data.get('quantidade')
        descricao = data.get('descricao')

        print(f"[PUT /api/itens/{item_id}] Dados recebidos: nome={nome}, quantidade={quantidade}")

        # Validações básicas
        if not nome or nome.strip() == '':
            print(f"[PUT /api/itens/{item_id}] Erro: Nome vazio ou inválido")
            return jsonify({'success': False, 'error': 'Nome do item é obrigatório'}), 400

        if quantidade is None:
            print(f"[PUT /api/itens/{item_id}] Erro: Quantidade não fornecida")
            return jsonify({'success': False, 'error': 'Quantidade é obrigatória'}), 400

        try:
            quantidade = int(quantidade)
            if quantidade < 0:
                print(f"[PUT /api/itens/{item_id}] Erro: Quantidade negativa ({quantidade})")
                return jsonify({'success': False, 'error': 'Quantidade não pode ser negativa'}), 400
        except (ValueError, TypeError) as e:
            print(f"[PUT /api/itens/{item_id}] Erro: Quantidade inválida - {e}")
            return jsonify({'success': False, 'error': 'Quantidade deve ser um número'}), 400

        cursor = None
        try:
            cursor = get_cursor()

            # Verificar se o item existe
            cursor.execute("SELECT Nome FROM itens WHERE id = %s", (item_id,))
            item_atual = cursor.fetchone()
            if not item_atual:
                print(f"[PUT /api/itens/{item_id}] Erro: Item não encontrado")
                return jsonify({'success': False, 'error': 'Item não encontrado'}), 404

            print(f"[PUT /api/itens/{item_id}] Item encontrado: {item_atual['Nome']}")

            # Atualizar o item
            cursor.execute("""
                UPDATE itens
                SET Nome = %s, quantidade = %s, descricao = %s
                WHERE id = %s
            """, (nome.strip(), quantidade, descricao.strip() if descricao else '', item_id))

            get_db_connection().commit()
            print(f"[PUT /api/itens/{item_id}] ✅ Item atualizado com sucesso - Nova quantidade: {quantidade}")

            return jsonify({
                'success': True,
                'message': f'Item \"{nome}\" atualizado com sucesso'
            }), 200

        except mysql.connector.Error as e:
            print(f"[PUT /api/itens/{item_id}] ❌ Erro BD ao editar item: {e}")
            get_db_connection().rollback()
            return jsonify({'success': False, 'error': 'Erro ao atualizar item no banco de dados'}), 500
        finally:
            close_cursor(cursor)

    except Exception as e:
        print(f"[PUT /api/itens/{item_id}] ❌ Erro geral ao editar item: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500

@app.route('/api/itens/<int:item_id>', methods=['DELETE'])
def deletar_item(item_id):
    """API para deletar um item do catálogo"""
    print(f"\n[DELETE /api/itens/{item_id}] Requisição de exclusão recebida")
    
    check = require_login_or_redirect()
    if check:
        print(f"[DELETE /api/itens/{item_id}] Erro: Usuário não autenticado")
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401

    # Verificar se o usuário é administrador
    usuario_role = str(session.get('usuario_role', '')).strip().lower()
    if usuario_role != 'admin':
        print(f"[DELETE /api/itens/{item_id}] Erro: Usuário não é admin (role={usuario_role})")
        return jsonify({'success': False, 'error': 'Apenas administradores podem excluir itens'}), 403

    cursor = None
    try:
        cursor = get_cursor()

        # Verificar se o item existe
        cursor.execute("SELECT Nome FROM itens WHERE id = %s", (item_id,))
        item = cursor.fetchone()
        if not item:
            print(f"[DELETE /api/itens/{item_id}] Erro: Item não encontrado")
            return jsonify({'success': False, 'error': 'Item não encontrado'}), 404

        print(f"[DELETE /api/itens/{item_id}] Item encontrado: {item['Nome']}")

        # Deletar o item
        cursor.execute("DELETE FROM itens WHERE id = %s", (item_id,))
        get_db_connection().commit()
        
        print(f"[DELETE /api/itens/{item_id}] ✅ Item '{item['Nome']}' excluído com sucesso do banco de dados")

        return jsonify({
            'success': True,
            'message': f'Item \"{item['Nome']}\" excluído com sucesso'
        }), 200

    except mysql.connector.Error as e:
        print(f"[DELETE /api/itens/{item_id}] ❌ Erro BD ao excluir item: {e}")
        if cursor:
            get_db_connection().rollback()
        return jsonify({'success': False, 'error': 'Erro ao excluir item do banco de dados'}), 500
    except Exception as e:
        print(f"[DELETE /api/itens/{item_id}] ❌ Erro geral ao excluir item: {e}")
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
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
    """API para retornar informações do usuário atual com validação do banco"""
    if not session.get('usuario_logado'):
        return jsonify({'logado': False})
    
    # Buscar informações atualizadas do banco de dados
    cursor = None
    try:
        cursor = get_cursor()
        email = session.get('usuario_logado')
        cursor.execute("SELECT Id, nome, email, role FROM usuarios WHERE email = %s", (email,))
        usuario = cursor.fetchone()
        
        if usuario:
            # Atualizar sessão com dados do banco
            session['usuario_role'] = usuario['role']
            session['usuario_nome'] = usuario['nome']
            session['usuario_id'] = usuario['Id']
            
            usuario_info = {
                'logado': True,
                'email': usuario['email'],
                'role': usuario['role'],
                'nome': usuario['nome'],
                'id': usuario['Id'],
                'is_admin': str(usuario['role']).strip().lower() == 'admin'
            }
            
            print(f"Usuário {email} - Role: {usuario['role']} - admin: {usuario_info['is_admin']}")
            return jsonify(usuario_info)
        else:
            # Usuário não encontrado, limpar sessão
            session.clear()
            return jsonify({'logado': False})
            
    except Exception as e:
        print(f"Erro ao buscar informações do usuário: {e}")
        return jsonify({
            'logado': True,
            'email': session.get('usuario_logado'),
            'role': session.get('usuario_role'),
            'nome': session.get('usuario_nome'),
            'id': session.get('usuario_id'),
                'is_admin': str(session.get('usuario_role', '')).strip().lower() == 'admin'
        })
    finally:
        close_cursor(cursor)

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
            SELECT e.id, i.Nome as resourceName, i.id as resourceId,
                   e.data_emprestimo as data_reserva, 
                   CONCAT(e.hora_inicio, ' às ', e.hora_fim) as horario,
                   u.Id as userId, u.nome as userName,
                   e.status, e.observacao
            FROM emprestimo e
            JOIN itens i ON e.id_item = i.id
            JOIN usuarios u ON e.id_usuario = u.Id
            WHERE e.status IN ('pendente', 'aprovado')
            ORDER BY e.data_emprestimo, e.hora_inicio
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
            'emprestimos': reservas_formatadas
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
    
    # Retornar erro indicando que a funcionalidade não está implementada
    return jsonify({'success': False, 'error': 'Funcionalidade de reservas ainda não foi configurada no banco de dados'}), 503

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def cancelar_reserva(reserva_id):
    """Cancelar uma reserva"""
    check = require_login_or_redirect()
    if check:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    # Retornar erro indicando que a funcionalidade não está implementada
    return jsonify({'success': False, 'error': 'Funcionalidade de reservas ainda não foi configurada no banco de dados'}), 503


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
        cursor.execute("SELECT Id, nome, email, role FROM usuarios ORDER BY nome")
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