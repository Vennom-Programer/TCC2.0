from flask import Flask, render_template, request, redirect, make_response, jsonify
import mysql.connector

app = Flask(__name__)

@app.route('/')
def menu():
    return render_template('menu.html')

#mydb = mysql.connector.connect(
#     host="localhost",
#     user="root",
#     password="root",
#     database="smartreserva"
#)
#@app.route('/')
#def index():
    # cursor = db.cursor(dictionary=True)
    # cursor.execute("SELECT * FROM items")
 #return render_template("index.html")