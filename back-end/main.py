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



@app.route('/')
def menu():
    return render_template('login.html')

# Rota para tela de cadastro
@app.route('/cadastro')
def cadastro():
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
    cursor = mydb.cursor()
    db_role = None
    user_found = False

    # Try to get the user's role directly from the DB (strict verification)
    try:
        cursor.execute("SELECT role FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
        row = cursor.fetchone()
        if row:
            db_role = row[0]
            user_found = True
    except mysql.connector.Error:
        # Role column may not exist; we'll attempt a fallback to check credentials without role
        try:
            cursor.execute("SELECT 1 FROM usuarios WHERE email = %s AND senha = %s", (email, senha))
            if cursor.fetchone():
                user_found = True
                db_role = None
        except Exception:
            user_found = False

    cursor.close()

    if not user_found:
        return render_template('login.html', error="Email ou senha incorretos")

    # If a role was submitted in the form, require it to match the stored DB role
    if role:
        if db_role is None:
            # Can't verify role because DB does not have role column
            return render_template('login.html', error="Verificação de função indisponível no servidor. Contate o administrador.")
        if role != db_role:
            return render_template('login.html', error="As credenciais não correspondem ao tipo selecionado.")

    # Authentication and role verification passed -> set session role from DB when available
    session['usuario_logado'] = email
    if db_role:
        session['usuario_role'] = db_role
    elif role:
        # If DB didn't provide a role but user submitted one (unlikely after migration), trust submitted
        session['usuario_role'] = role

    return redirect('/index.html')
    

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
    return render_template('/index.html')

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


