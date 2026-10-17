import hmac
import logging
import os
import re
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from functools import wraps
from urllib.parse import urlparse

import mysql.connector
from dotenv import load_dotenv
from flask import (Flask, g, jsonify, redirect, render_template, request,
                   session, url_for)
from mysql.connector import pooling
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo(os.getenv("APP_TZ", "America/Sao_Paulo"))
except Exception:  # tzdata ausente (ex.: Windows sem o pacote tzdata)
    TZ = None

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("reservas")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# =============================================
# CONFIGURAÇÃO DA APLICAÇÃO
# =============================================

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY não definida. Configure-a no arquivo .env")

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    # Em produção (HTTPS) defina SESSION_COOKIE_SECURE=1 no .env
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)

ROLE_ADMIN = "admin"
ROLE_PROFESSOR = "professor"
ROLES_VALIDOS = {ROLE_ADMIN, ROLE_PROFESSOR}

# Classificações 6 (Laboratório) e 7 (Auditório) são espaços; as demais, equipamentos
CLASSIFICACOES_ESPACO = (6, 7)
CLASSIFICACOES_PADRAO = [
    (1, 'Data-Show'),
    (2, 'Caixa de Som'),
    (3, 'Microfone'),
    (4, 'Notebook'),
    (5, 'Eletrônico'),
    (6, 'Laboratório'),
    (7, 'Auditório'),
]

# Status que ocupam o horário (inclui 'ativo' por compatibilidade com registros antigos)
STATUS_ATIVOS = ('reservado', 'em uso', 'ativo')
STATUS_NOVA_RESERVA = 'reservado'

SENHA_MIN = 6
SENHA_MAX = 128
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def agora():
    return datetime.now(TZ) if TZ else datetime.now()


# =============================================
# BANCO DE DADOS (pool + conexão por requisição)
# =============================================

_pool = None
_pool_lock = threading.Lock()


def _db_config():
    config = dict(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306")),
        connection_timeout=10,
    )
    ca_path = os.path.join(BASE_DIR, "ca.pem")
    if os.path.exists(ca_path):
        config.update(ssl_ca=ca_path, ssl_verify_cert=True, ssl_verify_identity=False)
    else:
        log.warning("ca.pem não encontrado; conectando sem verificação de certificado SSL")
    return config


def get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pooling.MySQLConnectionPool(
                    pool_name="reservas_pool",
                    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
                    **_db_config(),
                )
    return _pool


def get_db():
    """Conexão do pool, uma por requisição (devolvida ao pool no teardown)."""
    if 'db' not in g:
        g.db = get_pool().get_connection()
    return g.db


@contextmanager
def db_cursor():
    cursor = get_db().cursor(dictionary=True, buffered=True)
    try:
        yield cursor
    finally:
        try:
            cursor.close()
        except Exception:
            log.exception("Erro ao fechar cursor")


@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop('db', None)
    if db is None:
        return
    try:
        if exc is not None:
            db.rollback()
        db.close()
    except Exception:
        log.exception("Erro ao devolver conexão ao pool")


def init_db():
    """Cria tabelas auxiliares, popula classificações e garante coluna de senha larga."""
    with db_cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS classificacao (
                id INT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS localizacao (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome VARCHAR(100) NOT NULL
            )
        """)
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
        cursor.execute("SELECT COUNT(*) AS total FROM classificacao")
        if cursor.fetchone()['total'] == 0:
            cursor.executemany(
                "INSERT INTO classificacao (id, nome) VALUES (%s, %s)",
                CLASSIFICACOES_PADRAO,
            )
            log.info("Tabela classificacao populada com dados iniciais")
    get_db().commit()

    # Hashes de senha ocupam ~100-170 caracteres: a coluna precisa ser larga
    try:
        with db_cursor() as cursor:
            cursor.execute("""
                SELECT DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS tamanho
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'senha'
            """)
            col = cursor.fetchone()
            if (col and col['tipo'] in ('varchar', 'char')
                    and col['tamanho'] is not None and col['tamanho'] < 255):
                cursor.execute("ALTER TABLE usuarios MODIFY senha VARCHAR(255) NOT NULL")
                log.info("Coluna usuarios.senha ampliada para VARCHAR(255)")
        get_db().commit()
    except mysql.connector.Error:
        log.warning("Não foi possível ampliar usuarios.senha para VARCHAR(255). "
                    "Faça manualmente: ALTER TABLE usuarios MODIFY senha VARCHAR(255) NOT NULL;")


# =============================================
# SEGURANÇA: ORIGEM DAS REQUISIÇÕES E CABEÇALHOS
# =============================================

ALLOWED_ORIGINS = {h.strip() for h in os.getenv("ALLOWED_ORIGINS", "").split(",") if h.strip()}


def _is_api():
    return request.path.startswith('/api/')


@app.before_request
def verificar_origem():
    """Proteção CSRF sem alterar templates: requisições que alteram dados
    precisam vir da mesma origem (cabeçalho Origin/Referer). Combinada com
    cookie SameSite=Lax."""
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    origem = request.headers.get('Origin') or request.headers.get('Referer')
    if not origem:
        return None
    host = urlparse(origem).netloc
    if host == request.host or host in ALLOWED_ORIGINS:
        return None
    log.warning("Requisição bloqueada por origem diferente: %s %s (origem=%s)",
                request.method, request.path, origem)
    if _is_api():
        return jsonify({'success': False, 'error': 'Origem não permitida'}), 403
    return "Origem não permitida", 403


@app.after_request
def cabecalhos_seguranca(resp):
    resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
    resp.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    return resp


@app.errorhandler(mysql.connector.Error)
def erro_banco(e):
    log.error("Erro de banco em %s %s: %s", request.method, request.path, e)
    db = g.get('db')
    if db is not None:
        try:
            db.rollback()
        except Exception:
            pass
    if _is_api():
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    return "Erro interno do servidor. Tente novamente mais tarde.", 500


@app.errorhandler(500)
def erro_interno(e):
    if _is_api():
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    return "Erro interno do servidor. Tente novamente mais tarde.", 500


# =============================================
# AUTENTICAÇÃO E AUTORIZAÇÃO
# =============================================

def normalize_role(role):
    """Normaliza valores de papel para um formato consistente no sistema."""
    if role is None:
        return ''
    role_str = str(role).strip().lower()
    if role_str in {'admin', 'adm'}:
        return ROLE_ADMIN
    if role_str in {'professor', 'prof'}:
        return ROLE_PROFESSOR
    return role_str


def carregar_usuario_sessao():
    """Carrega o usuário logado do banco (fonte da verdade do papel).
    Retorna dict ou None; guarda em g.user para a requisição."""
    email = session.get('usuario_logado')
    if not email:
        return None
    if 'user' in g:
        return g.user
    with db_cursor() as cursor:
        cursor.execute("SELECT Id, nome, email, role FROM usuarios WHERE email = %s", (email,))
        usuario = cursor.fetchone()
    if not usuario:
        session.clear()
        return None
    usuario['role'] = normalize_role(usuario['role'])
    session['usuario_role'] = usuario['role']
    session['usuario_nome'] = usuario['nome']
    session['usuario_id'] = usuario['Id']
    g.user = usuario
    return usuario


def _nao_autorizado():
    if _is_api():
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    return redirect('/login')


def _proibido(msg='Acesso restrito a administradores'):
    if _is_api():
        return jsonify({'success': False, 'error': msg}), 403
    return redirect('/index.html?error=forbidden')


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not carregar_usuario_sessao():
            return _nao_autorizado()
        return view(*args, **kwargs)
    return wrapper


def admin_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        usuario = carregar_usuario_sessao()
        if not usuario:
            return _nao_autorizado()
        if usuario['role'] != ROLE_ADMIN:
            return _proibido()
        return view(*args, **kwargs)
    return wrapper


def verificar_senha(armazenada, informada):
    """Retorna (senha_correta, precisa_rehash).
    Aceita hashes do Werkzeug e senhas legadas em texto puro (que são
    convertidas para hash no primeiro login bem-sucedido)."""
    if not armazenada or informada is None:
        return False, False
    armazenada = str(armazenada)
    if armazenada.startswith(('scrypt:', 'pbkdf2:')):
        return check_password_hash(armazenada, informada), False
    correta = hmac.compare_digest(armazenada.encode('utf-8'), informada.encode('utf-8'))
    return correta, correta


# =============================================
# UTILIDADES
# =============================================

def fmt_hhmm(valor):
    """Converte TIME do MySQL (timedelta) / time / str em 'HH:MM'."""
    if valor is None:
        return ''
    if isinstance(valor, timedelta):
        total = int(valor.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    if hasattr(valor, 'strftime'):
        return valor.strftime('%H:%M')
    return str(valor)[:5]


def _parse_hora(valor):
    valor = str(valor).strip()
    for fmt in ('%H:%M', '%H:%M:%S'):
        try:
            return datetime.strptime(valor, fmt).time()
        except ValueError:
            continue
    raise ValueError(valor)


def _parse_data(valor):
    valor = str(valor).strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(valor, fmt).date()
        except ValueError:
            continue
    raise ValueError(valor)


def _int_ou_none(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


# =============================================
# ROTAS: LOGIN, CADASTRO E LOGOUT
# =============================================

@app.route('/')
def menu():
    if session.get('usuario_logado') and carregar_usuario_sessao():
        return redirect('/index.html')
    return render_template('login.html')


@app.route('/login')
def login():
    return render_template('login.html')


@app.route('/login', methods=['POST'])
def loginPost():
    email = (request.form.get('email') or '').strip().lower()
    senha = request.form.get('password') or ''
    role_normalizado = normalize_role(request.form.get('role'))

    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM usuarios WHERE email = %s", (email,))
        usuario = cursor.fetchone()

        correta, precisa_rehash = (False, False)
        if usuario:
            correta, precisa_rehash = verificar_senha(usuario.get('senha'), senha)

        if not usuario or not correta:
            log.info("Login falhou para o email informado")
            return render_template('login.html', error="Email ou senha incorretos")

        if precisa_rehash:
            try:
                cursor.execute("UPDATE usuarios SET senha = %s WHERE Id = %s",
                               (generate_password_hash(senha), usuario['Id']))
                get_db().commit()
            except mysql.connector.Error as e:
                get_db().rollback()
                log.warning("Não foi possível migrar a senha para hash: %s", e)

    db_role = normalize_role(usuario['role']) if usuario['role'] else ''

    if role_normalizado:
        if db_role == '':
            return render_template('login.html', error="Erro no servidor: função de usuário não definida.")
        if role_normalizado != db_role:
            log.info("Login falhou: tipo de usuário incorreto (esperado %s)", db_role)
            return render_template('login.html', error="Você escolheu o tipo de usuário errado.")

    # Nova sessão (evita fixação de sessão)
    session.clear()
    session.permanent = True
    session['usuario_logado'] = usuario['email']
    session['usuario_role'] = db_role
    session['usuario_id'] = usuario['Id']
    session['usuario_nome'] = usuario['nome']

    log.info("Usuário id=%s logou como '%s'", usuario['Id'], db_role)
    return redirect('/index.html')


@app.route('/cadastro')
def cadastro():
    usuario = carregar_usuario_sessao()
    if usuario and usuario['role'] != ROLE_ADMIN:
        return redirect('/index.html?error=forbidden')
    return render_template('cadastro.html')


@app.route('/cadastro', methods=['POST'])
def cadastro_post():
    usuario_atual = carregar_usuario_sessao()
    if usuario_atual and usuario_atual['role'] != ROLE_ADMIN:
        return redirect('/cadastro?error=forbidden')

    nome = (request.form.get('nome') or '').strip()
    email = (request.form.get('email') or '').strip().lower()
    senha = request.form.get('senha') or ''
    matricula = (request.form.get('id') or '').strip()

    # Somente administradores definem o papel; todos os demais viram professor
    role = ROLE_PROFESSOR
    if usuario_atual:
        solicitado = normalize_role(request.form.get('role'))
        if solicitado in ROLES_VALIDOS:
            role = solicitado

    if (not nome or len(nome) > 255
            or not EMAIL_RE.fullmatch(email) or len(email) > 255
            or len(senha) < SENHA_MIN or len(senha) > SENHA_MAX
            or not matricula.isdigit() or len(matricula) > 18):
        return redirect('/cadastro?error=1')

    try:
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT email, nome, Id FROM usuarios WHERE email = %s OR nome = %s OR Id = %s",
                (email, nome, int(matricula)),
            )
            existentes = cursor.fetchall()
            if any(str(r['email']).lower() == email for r in existentes):
                return redirect('/cadastro?error=exists')
            if any(str(r['nome']).strip().lower() == nome.lower() for r in existentes):
                return redirect('/cadastro?error=name_exists')
            if any(str(r['Id']) == str(int(matricula)) for r in existentes):
                return redirect('/cadastro?error=matricula_exists')

            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha, id, role) VALUES (%s, %s, %s, %s, %s)",
                (nome, email, generate_password_hash(senha), int(matricula), role),
            )
        get_db().commit()
    except mysql.connector.IntegrityError:
        get_db().rollback()
        return redirect('/cadastro?error=exists')
    except mysql.connector.Error as e:
        get_db().rollback()
        log.error("Erro no cadastro: %s", e)
        return redirect('/cadastro?error=1')

    return redirect('/cadastro?success=1&role=' + role)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/index.html')
@login_required
def index():
    return render_template('index.html')


@app.route('/voltar_index')
def voltar_index():
    return redirect(url_for('index'))


# =============================================
# CADASTRO DE ITENS (somente administradores)
# =============================================

@app.route('/cadastroItem.html', methods=['GET'])
@admin_required
def cadastroItens():
    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT id, nome FROM classificacao ORDER BY id")
            classificacoes = cursor.fetchall()
            cursor.execute("SELECT id, nome FROM localizacao ORDER BY nome")
            localizacoes = cursor.fetchall()
        return render_template('cadastroItem.html',
                               classificacoes=classificacoes, localizacoes=localizacoes)
    except mysql.connector.Error:
        log.exception("Erro ao carregar cadastro de itens")
        return render_template('cadastroItem.html', classificacoes=[], localizacoes=[])


@app.route('/cadastroItem.html', methods=['POST'])
@admin_required
def cadastroItensPost():
    nome = (request.form.get('item-name') or '').strip()
    id_classificacao = request.form.get('item-type')
    descricao = request.form.get('item-description')
    quantidade = request.form.get('item-quantity')
    id_localizacao = request.form.get('item-location')
    especificacoestec = request.form.get('item-specs')
    categoria = request.form.get('categoria-selecionada') or request.form.get('categoria')

    if not nome or not id_classificacao or not quantidade or not id_localizacao:
        return redirect('/cadastroItem.html?error=campos_obrigatorios')
    if len(nome) > 255:
        return redirect('/cadastroItem.html?error=1')

    try:
        quantidade = int(quantidade)
        if quantidade <= 0:
            return redirect('/cadastroItem.html?error=quantidade_invalida')
    except ValueError:
        return redirect('/cadastroItem.html?error=quantidade_invalida')

    id_classificacao_int = _int_ou_none(id_classificacao)
    id_localizacao_int = _int_ou_none(id_localizacao)
    if id_classificacao_int is None:
        return redirect('/cadastroItem.html?error=classificacao_invalida')
    if id_localizacao_int is None:
        return redirect('/cadastroItem.html?error=localizacao_nao_existe')

    if categoria == 'equipamento' and id_classificacao_int in CLASSIFICACOES_ESPACO:
        return redirect('/cadastroItem.html?error=incompativel_equipamento')
    if categoria == 'espaco' and id_classificacao_int not in CLASSIFICACOES_ESPACO:
        return redirect('/cadastroItem.html?error=incompativel_espaco')

    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT id FROM classificacao WHERE id = %s", (id_classificacao_int,))
            if not cursor.fetchone():
                return redirect('/cadastroItem.html?error=classificacao_nao_existe')

            cursor.execute("SELECT id FROM localizacao WHERE id = %s", (id_localizacao_int,))
            if not cursor.fetchone():
                return redirect('/cadastroItem.html?error=localizacao_nao_existe')

            cursor.execute("""
                INSERT INTO itens (Nome, id_classificacao, descricao, quantidade,
                                   id_localizacao, especificacoestec, categoria)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (nome, id_classificacao_int, descricao, quantidade,
                  id_localizacao_int, especificacoestec, categoria))
        get_db().commit()
        log.info("Item '%s' cadastrado", nome)
        return redirect('/catalogo.html?success=1')

    except mysql.connector.IntegrityError as e:
        get_db().rollback()
        log.error("Erro de integridade ao cadastrar item: %s", e)
        return redirect('/cadastroItem.html?error=integridade')
    except mysql.connector.Error as e:
        get_db().rollback()
        log.error("Erro MySQL ao cadastrar item: %s", e)
        return redirect('/cadastroItem.html?error=banco_dados')


# =============================================
# LOCALIZAÇÕES
# =============================================

@app.route('/api/localizacoes', methods=['POST'])
@admin_required
def criar_localizacao():
    data = request.get_json(silent=True) or {}
    nome = (data.get('nome') or '').strip()

    if not nome:
        return jsonify({'success': False, 'error': 'Nome da localização é obrigatório'}), 400
    if len(nome) > 100:
        return jsonify({'success': False, 'error': 'Nome muito longo (máximo 100 caracteres)'}), 400

    with db_cursor() as cursor:
        cursor.execute("SELECT id FROM localizacao WHERE nome = %s", (nome,))
        if cursor.fetchone():
            return jsonify({'success': False, 'error': 'Já existe uma localização com este nome'}), 400

        cursor.execute("INSERT INTO localizacao (nome) VALUES (%s)", (nome,))
        nova_id = cursor.lastrowid
    get_db().commit()

    return jsonify({
        'success': True,
        'message': 'Localização criada com sucesso',
        'localizacao': {'id': nova_id, 'nome': nome},
    })


@app.route('/api/localizacoes', methods=['GET'])
@login_required
def obter_localizacoes():
    with db_cursor() as cursor:
        cursor.execute("SELECT id, nome FROM localizacao ORDER BY nome")
        localizacoes = cursor.fetchall()
    return jsonify({'success': True, 'localizacoes': localizacoes})


@app.route('/api/localizacoes/<int:localizacao_id>', methods=['DELETE'])
@admin_required
def excluir_localizacao(localizacao_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT id FROM localizacao WHERE id = %s", (localizacao_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'error': 'Localização não encontrada'}), 404

        cursor.execute("SELECT COUNT(*) AS total FROM itens WHERE id_localizacao = %s", (localizacao_id,))
        if cursor.fetchone()['total'] > 0:
            return jsonify({'success': False,
                            'error': 'Não é possível excluir localização com itens associados'}), 400

        cursor.execute("DELETE FROM localizacao WHERE id = %s", (localizacao_id,))
    get_db().commit()
    return jsonify({'success': True, 'message': 'Localização excluída com sucesso'})


# =============================================
# CATÁLOGO
# =============================================

SQL_CATALOGO = """
    SELECT i.id, i.Nome, i.descricao, i.quantidade,
           c.nome AS classificacao, l.nome AS localizacao,
           i.especificacoestec, i.id_classificacao, i.id_localizacao
    FROM itens i
    JOIN classificacao c ON i.id_classificacao = c.id
    JOIN localizacao l ON i.id_localizacao = l.id
    ORDER BY i.Nome
"""


@app.route('/catalogo.html')
@login_required
def catalogo():
    usuario_info = {
        'email': g.user['email'],
        'nome': g.user['nome'],
        'role': g.user['role'],
        'id': g.user['Id'],
        'is_admin': g.user['role'] == ROLE_ADMIN,
    }
    try:
        with db_cursor() as cursor:
            cursor.execute(SQL_CATALOGO)
            itens = cursor.fetchall()
    except mysql.connector.Error:
        log.exception("Erro ao carregar catálogo")
        itens = []
    return render_template('catalogo.html', itens=itens, user=usuario_info)


@app.route('/api/catalogo/itens')
@login_required
def api_catalogo_itens():
    with db_cursor() as cursor:
        cursor.execute(SQL_CATALOGO)
        itens = cursor.fetchall()
    return jsonify({'success': True, 'itens': itens})


@app.route('/api/itens/<int:item_id>', methods=['PUT'])
@admin_required
def editar_item(item_id):
    data = request.get_json(silent=True) or {}
    nome = (data.get('nome') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    quantidade = data.get('quantidade')

    if not nome:
        return jsonify({'success': False, 'error': 'Nome do item é obrigatório'}), 400
    if len(nome) > 255:
        return jsonify({'success': False, 'error': 'Nome muito longo (máximo 255 caracteres)'}), 400
    if quantidade is None:
        return jsonify({'success': False, 'error': 'Quantidade é obrigatória'}), 400
    try:
        quantidade = int(quantidade)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Quantidade deve ser um número'}), 400
    if quantidade < 0:
        return jsonify({'success': False, 'error': 'Quantidade não pode ser negativa'}), 400

    with db_cursor() as cursor:
        cursor.execute("SELECT id FROM itens WHERE id = %s", (item_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'error': 'Item não encontrado'}), 404

        cursor.execute(
            "UPDATE itens SET Nome = %s, quantidade = %s, descricao = %s WHERE id = %s",
            (nome, quantidade, descricao, item_id),
        )
    get_db().commit()
    log.info("Item %s atualizado por usuário id=%s", item_id, g.user['Id'])
    return jsonify({'success': True, 'message': f'Item "{nome}" atualizado com sucesso'}), 200


@app.route('/api/itens/<int:item_id>', methods=['DELETE'])
@admin_required
def deletar_item(item_id):
    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT Nome FROM itens WHERE id = %s", (item_id,))
            item = cursor.fetchone()
            if not item:
                return jsonify({'success': False, 'error': 'Item não encontrado'}), 404
            nome = item['Nome']

            cursor.execute("DELETE FROM itens WHERE id = %s", (item_id,))
        get_db().commit()
    except mysql.connector.IntegrityError:
        get_db().rollback()
        return jsonify({'success': False,
                        'error': 'Item possui reservas associadas e não pode ser excluído'}), 409

    log.info("Item %s excluído por usuário id=%s", item_id, g.user['Id'])
    return jsonify({'success': True, 'message': f'Item "{nome}" excluído com sucesso'}), 200


# =============================================
# CALENDÁRIO E APIs AUXILIARES
# =============================================

@app.route('/calendario.html')
@login_required
def calendario():
    try:
        with db_cursor() as cursor:
            cursor.execute("""
                SELECT id, Nome, quantidade, categoria
                FROM itens
                WHERE quantidade > 0
                ORDER BY Nome
            """)
            itens = cursor.fetchall()

            cursor.execute("""
                SELECT e.id, e.id_itens, e.id_usuario, e.data_reserva,
                       e.hora_inicio, e.hora_fim, e.status,
                       i.Nome AS item_nome, u.nome AS usuario_nome
                FROM emprestimo e
                JOIN itens i ON e.id_itens = i.id
                JOIN usuarios u ON e.id_usuario = u.id
                ORDER BY e.data_reserva, e.hora_inicio
            """)
            reservas = cursor.fetchall()

            usuarios = []
            if g.user['role'] == ROLE_ADMIN:
                cursor.execute("SELECT Id, nome, email, role FROM usuarios ORDER BY nome")
                usuarios = cursor.fetchall()

        return render_template('calendario.html', itens=itens, reservas=reservas, usuarios=usuarios)
    except mysql.connector.Error:
        log.exception("Erro ao carregar calendário")
        return render_template('calendario.html', itens=[], reservas=[], usuarios=[])


@app.route('/api/itens/disponiveis')
@login_required
def api_itens_disponiveis():
    tipo = request.args.get('tipo', 'all')
    query = "SELECT id, Nome, quantidade, id_classificacao, categoria FROM itens WHERE quantidade > 0"
    params = []

    placeholders = ', '.join(['%s'] * len(CLASSIFICACOES_ESPACO))
    if tipo == 'equipment':
        query += f" AND id_classificacao NOT IN ({placeholders})"
        params.extend(CLASSIFICACOES_ESPACO)
    elif tipo == 'space':
        query += f" AND id_classificacao IN ({placeholders})"
        params.extend(CLASSIFICACOES_ESPACO)
    query += " ORDER BY Nome"

    with db_cursor() as cursor:
        cursor.execute(query, params)
        itens = cursor.fetchall()
    return jsonify({'success': True, 'itens': itens})


@app.route('/api/itens')
@login_required
def api_itens():
    with db_cursor() as cursor:
        cursor.execute("SELECT id, Nome, quantidade, id_classificacao, categoria FROM itens ORDER BY Nome")
        itens = cursor.fetchall()
    return jsonify({'success': True, 'itens': itens})


@app.route('/api/recursos/tipos')
def api_recursos_tipos():
    return jsonify({
        'tipos': [
            {'id': 'equipment', 'nome': 'Equipamentos'},
            {'id': 'space', 'nome': 'Espaços'},
        ]
    })


@app.route('/api/admin/usuarios')
@admin_required
def api_admin_usuarios():
    with db_cursor() as cursor:
        cursor.execute("SELECT Id, nome, email, role FROM usuarios ORDER BY nome")
        usuarios = cursor.fetchall()
    return jsonify({'success': True, 'usuarios': usuarios})


@app.route('/api/usuario/atual')
def api_usuario_atual():
    usuario = carregar_usuario_sessao()
    if not usuario:
        return jsonify({'logado': False})
    return jsonify({
        'logado': True,
        'email': usuario['email'],
        'role': usuario['role'],
        'nome': usuario['nome'],
        'id': usuario['Id'],
        'is_admin': usuario['role'] == ROLE_ADMIN,
    })


# =============================================
# RESERVAS (regra única para todas as rotas)
# =============================================

class ReservaError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _resolver_id_usuario(id_informado):
    """Usuário dono da reserva: o próprio logado; só admin reserva por outra pessoa."""
    atual = g.user['Id']
    if id_informado in (None, '') or str(id_informado) == str(atual):
        return atual
    if g.user['role'] != ROLE_ADMIN:
        raise ReservaError('Sem permissão para reservar em nome de outro usuário', 403)
    id_int = _int_ou_none(id_informado)
    if id_int is None:
        raise ReservaError('Usuário inválido', 400)
    with db_cursor() as cursor:
        cursor.execute("SELECT Id FROM usuarios WHERE Id = %s", (id_int,))
        if not cursor.fetchone():
            raise ReservaError('Usuário não encontrado', 400)
    return id_int


def registrar_reserva(id_item, data_reserva, hora_inicio, hora_fim, id_usuario=None):
    """Valida e cria a reserva de forma atômica. Retorna o id criado.

    O item é travado (SELECT ... FOR UPDATE) durante a verificação de conflito
    e o INSERT, evitando que duas requisições simultâneas reservem o mesmo
    horário. Conflito = reservas ativas sobrepostas >= quantidade do item.
    """
    item_id = _int_ou_none(id_item)
    if item_id is None:
        raise ReservaError('Item inválido')
    try:
        data = _parse_data(data_reserva)
    except ValueError:
        raise ReservaError('Data inválida (use AAAA-MM-DD)')
    try:
        inicio = _parse_hora(hora_inicio)
        fim = _parse_hora(hora_fim)
    except ValueError:
        raise ReservaError('Horário inválido (use HH:MM)')
    if fim <= inicio:
        raise ReservaError('O horário final deve ser maior que o inicial')
    if data < agora().date():
        raise ReservaError('Não é possível reservar em data passada')

    dono_id = _resolver_id_usuario(id_usuario)
    placeholders = ', '.join(['%s'] * len(STATUS_ATIVOS))

    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT id, quantidade FROM itens WHERE id = %s FOR UPDATE", (item_id,))
            item = cursor.fetchone()
            if not item:
                raise ReservaError('Item não encontrado', 404)
            if item['quantidade'] <= 0:
                raise ReservaError('Item indisponível', 400)

            cursor.execute(f"""
                SELECT COUNT(*) AS total FROM emprestimo
                WHERE id_itens = %s AND data_reserva = %s
                  AND status IN ({placeholders})
                  AND hora_inicio < %s AND hora_fim > %s
            """, (item_id, data, *STATUS_ATIVOS, fim, inicio))
            if cursor.fetchone()['total'] >= item['quantidade']:
                raise ReservaError('Horário já reservado', 409)

            cursor.execute("""
                INSERT INTO emprestimo (id_itens, id_usuario, data_reserva,
                                        hora_inicio, hora_fim, status, data_realizacao_reserva)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (item_id, dono_id, data, inicio, fim, STATUS_NOVA_RESERVA, agora().date()))
            novo_id = cursor.lastrowid
        get_db().commit()
        return novo_id
    except Exception:
        get_db().rollback()
        raise


def _erro_reserva(e):
    return jsonify({'success': False, 'error': e.message}), e.status


@app.route('/api/emprestimo', methods=['GET', 'POST'])
@login_required
def api_emprestimo():
    if request.method == 'GET':
        filtro_item = _int_ou_none(request.args.get('id_itens'))
        query = """
            SELECT id, id_itens, id_usuario, data_reserva, hora_inicio, hora_fim, status
            FROM emprestimo
            WHERE status != 'cancelado'
        """
        params = []
        if filtro_item is not None:
            query += " AND id_itens = %s"
            params.append(filtro_item)
        query += " ORDER BY data_reserva DESC"

        with db_cursor() as cursor:
            cursor.execute(query, params)
            emprestimos = cursor.fetchall()

        # Estrutura: {data: {"HH:MM-HH:MM": {...}}}. Atenção: itens diferentes no
        # mesmo horário colidem na mesma chave; use ?id_itens=<id> para consultar um item.
        resultado = {}
        for emp in emprestimos:
            if emp['data_reserva'] is None:
                continue
            data_key = (emp['data_reserva'].strftime('%Y-%m-%d')
                        if hasattr(emp['data_reserva'], 'strftime') else str(emp['data_reserva']))
            inicio = fmt_hhmm(emp['hora_inicio'])
            fim = fmt_hhmm(emp['hora_fim'])
            resultado.setdefault(data_key, {})[f"{inicio}-{fim}"] = {
                'id': emp['id'],
                'resourceId': emp['id_itens'],
                'userId': emp['id_usuario'],
                'status': emp['status'],
                'startTime': inicio,
                'endTime': fim,
            }
        return jsonify({'emprestimos': resultado}), 200

    data = request.get_json(silent=True) or {}
    obrigatorios = ['id_itens', 'data_reserva', 'hora_inicio', 'hora_fim']
    if not all(data.get(campo) for campo in obrigatorios):
        return jsonify({'success': False, 'error': 'Campos obrigatórios faltando'}), 400
    try:
        novo_id = registrar_reserva(data['id_itens'], data['data_reserva'],
                                    data['hora_inicio'], data['hora_fim'],
                                    data.get('id_usuario'))
    except ReservaError as e:
        return _erro_reserva(e)
    return jsonify({'success': True, 'id': novo_id, 'message': 'Reserva criada com sucesso'}), 201


@app.route('/api/reservas', methods=['POST'])
@login_required
def criar_reserva():
    """Criar reserva - formato compatível com o frontend ("HH:MM às HH:MM")."""
    data = request.get_json(silent=True) or {}
    recurso_id = data.get('recurso')
    data_reserva = data.get('data_reserva')
    horario = data.get('horario')

    if not all([recurso_id, data_reserva, horario]):
        return jsonify({'success': False, 'error': 'Dados incompletos'}), 400

    try:
        hora_inicio, hora_fim = str(horario).split(' às ')
    except ValueError:
        return jsonify({'success': False, 'error': 'Formato de horário inválido'}), 400

    try:
        novo_id = registrar_reserva(recurso_id, data_reserva, hora_inicio, hora_fim,
                                    data.get('id_usuario'))
    except ReservaError as e:
        return _erro_reserva(e)
    return jsonify({'success': True, 'id': novo_id, 'message': 'Reserva criada com sucesso'})


@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
@login_required
def cancelar_reserva(reserva_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT id, id_usuario, status FROM emprestimo WHERE id = %s", (reserva_id,))
        emprestimo = cursor.fetchone()
        if not emprestimo:
            return jsonify({'success': False, 'error': 'Empréstimo não encontrado'}), 404

        is_admin = g.user['role'] == ROLE_ADMIN
        is_owner = str(emprestimo['id_usuario']) == str(g.user['Id'])
        if not (is_admin or is_owner):
            log.warning("Usuário id=%s tentou cancelar reserva %s sem permissão",
                        g.user['Id'], reserva_id)
            return jsonify({'success': False, 'error': 'Sem permissão para cancelar este empréstimo'}), 403

        if emprestimo['status'] != 'cancelado':
            cursor.execute("UPDATE emprestimo SET status = 'cancelado' WHERE id = %s", (reserva_id,))
    get_db().commit()
    return jsonify({'success': True, 'message': 'Empréstimo cancelado com sucesso'})


# =============================================
# GERENCIAMENTO DE USUÁRIOS
# =============================================

@app.route('/usuarios.html')
@admin_required
def usuarios():
    with db_cursor() as cursor:
        cursor.execute("SELECT Id, nome, email, role FROM usuarios ORDER BY nome")
        lista = cursor.fetchall()
    return render_template('usuarios.html', usuarios=lista)


# =============================================
# INICIALIZAÇÃO
# =============================================

try:
    with app.app_context():
        init_db()
except Exception as e:  # o app sobe mesmo se o banco estiver fora do ar
    log.warning("Inicialização do banco ignorada: %s", e)


if __name__ == '__main__':
    # Debug apenas com FLASK_DEBUG=1 no .env. Em produção use gunicorn/waitress.
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1")