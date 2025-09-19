from flask import Flask, render_template, request, redirect, session, url_for
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
            return render_template('login.html', error="As credenciais não correspondem ao tipo selecionado.")

    # Authentication and role verification passed -> set session role from DB (authoritative)
    session['usuario_logado'] = email
    session['usuario_role'] = db_role

    # Redirect to the shared index page; the template will show content based on session role
    return redirect(url_for('index'))
    

@app.route('/cadastroItens')
def cadastroItens():
    return render_template('cadastroItem.html')


@app.route('/cadastroItens', methods=['POST'])
def cadastroItensPost():
    nomeItem = request.form.get('item-name')
    tipoItem = request.form.get('item-type')
    descricao = request.form.get('item-description')
    quantidade = request.form.get('item-quantity')
    localizacao = request.form.get('item-location')
    especificacaoTecnica = request.form.get('item-specs')
    
    cursor = mydb.cursor()
    query = "INSERT INTO itenscadastrados (id, NomeItem, TipoItem, descricao, quantidade, localização, especificacoestec) VALUES ('1',%s, %s, %s, %s, %s, %s)"

    values = (nomeItem, tipoItem, descricao, quantidade, localizacao, especificacaoTecnica)
    cursor.execute(query, values)
    mydb.commit()
    cursor.close()
    
    return render_template('cadastroItem.html')


@app.route('/index.html', methods=['GET', 'POST'])
def index():
    # Render the shared index template which will show/hide elements based on session role
    # Refresh the session role from DB for the logged user to keep it authoritative
    if session.get('usuario_logado'):
        db_role = get_user_role(session.get('usuario_logado'))
        if db_role:
            session['usuario_role'] = db_role
    return render_template('index.html')

@app.route('/calendario.html', methods=['GET', 'POST'])
def calendario():
    return render_template('calendario.html')

@app.route('/catalogo.html', methods=['GET', 'POST'])
def catalogo():
    cursor = mydb.cursor()
    query = "SELECT Nome, quantidade, id FROM itens"
    cursor.execute(query)
    itens = cursor.fetchall()
    cursor.close()
    return render_template('catalogo.html', itens=itens)


