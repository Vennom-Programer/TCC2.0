from flask import Flask, render_template, request, redirect
import mysql.connector

app = Flask(__name__)


mydb = mysql.connector.connect(
    host="localhost",
    user="root",
    password="root",
    database="smartreserva"
)



@app.route('/')
def menu():
    return render_template('menu.html')

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

    cursor = mydb.cursor()
    query = "INSERT INTO usuarios (nome, email, senha, numeroDaMatricula) VALUES (%s, %s, %s, %s)"
    values = (nome, email, senha, numeroDaMatricula)
    try:
        cursor.execute(query, values)
        mydb.commit()
        cursor.close()
        return redirect('/login')
    except Exception as e:
        cursor.close()
        return render_template('cadastro.html', mensagem=f'Erro ao cadastrar: {str(e)}')

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
@app.route('/login')
def login():
    return render_template('login.html')

def loginPost():
    email = request.form.get('email')
    senha = request.form.get('password')
    
    cursor = mydb.cursor()
    query = "SELECT * FROM usuarios WHERE email = %s AND senha = %s"
    values = (email, senha)
    cursor.execute(query, values)
    user = cursor.fetchone()
    cursor.close()
    
    if user:
        return redirect('/index.html')
    else:
        return render_template('login.html', error="Email ou senha incorretos")
    

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


@app.route('/index.html')
def index():
    return render_template('index.html')

  