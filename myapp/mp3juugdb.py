from pymongo import MongoClient

client = MongoClient("mongodb+srv://GM:<db_password>@amoco-cadiz.9c3xn4v.mongodb.net/?appName=Amoco-Cadiz")
db = client["test"]
collection = db["downloads"]

def find(value):
    docs = collection.find({'token':value}, projection=['song'])
    return docs



