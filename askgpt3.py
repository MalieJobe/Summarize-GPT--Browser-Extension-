from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import openai
import json

openai.api_key = open("key.txt", "r").read().strip('\n')
message_history = []

def reset_history():
    global message_history
    message_history = [
        {"role": "user", "content": f"You are a summarization bot. In my messages I will provide you with the content of webpages. Reply only with summaries to further input! Never include technical information about the website itself like wether it uses cookies or not. Summarize in the language of the website, for example if the websites content is in german, summarize in german. Use bullet points and other structure when deemed relevant"},
        {"role": "assistant", "content": "OK, let's start!"}
    ]

def generate_completion(input):
    global message_history
    message_history.append({"role": "user", "content": input})
    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.2,
        stream=True,
        n=1,
        messages=message_history
    )

    for chunk in completion:
        if "content" in chunk["choices"][0]["delta"]: # https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb
            yield json.dumps({"content": chunk["choices"][0]["delta"]["content"]})
        
        if not chunk["choices"][0]["delta"]:
            yield json.dumps({"content": "", "stop": "true"})
            
    return 200



app = Flask(__name__)
CORS(app, origins=r"^chrome-extension://")

@app.route('/', methods=["POST"])
def process_request():
    payload = request.get_data()
    
    prompt = json.loads(payload)["prompt"]
    print('Payload received!')

    reset_history()
    return Response(stream_with_context(generate_completion(prompt)), mimetype="application/json")

@app.route('/', methods=["GET"])
def hello_world():
    return "Hello World!"