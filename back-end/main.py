from flask import Flask, render_template, request, redirect, make_response, jsonify # pyright: ignore[reportMissingImports]
# import mysql.connector # type: ignore

app = Flask(__name__)

# db = mysql.connector.connect(
#     host="localhost",
#     user="root",
#     password="root",
#     database="smartreserva"
# )

@app.route('/')
def index():
    # cursor = db.cursor(dictionary=True)
    # cursor.execute("SELECT * FROM items")
    return render_template("index.html")