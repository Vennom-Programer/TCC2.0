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

# Rota para tela de login
@app.route('/login')
def login():
    return render_template('login.html')
    

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
    
    return render_template('cadastroItem.html')


#@app.route('/')
#def index():
    # cursor = db.cursor(dictionary=True)
    # cursor.execute("SELECT * FROM items")
 #return render_template("index.html")