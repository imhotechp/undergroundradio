from fastapi import FastAPI

app = FastAPI()

@app.get("/stream")
async def root():
    return {"message": "Hello World"}