from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import openai
import json

openai.api_key = open("key.txt", "r").read().strip('\n')
message_history = []

def reset_history(length):
    global message_history
    message_history = [
        {"role": "user",
            "content": f"""You are a summarization bot.
            I will provide you with the content of a webpage.
            Reply only with a {length} summary to further input!
            Never include technical information about the website itself like wether it uses cookies or not.
            Use paragraphs and bullet points like so:
            '''This website is about a thing. Here are its key takeaways: - Thing 1 - Thing 2 - Thing 3'''
            """},
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
        if "content" in chunk["choices"][0]["delta"]:
            yield json.dumps({"message": chunk["choices"][0]["delta"]["content"]})
            # https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb

    return 200



app = Flask(__name__)
CORS(app, origins=r"^chrome-extension://")

@app.route('/', methods=["POST"])
def process_request():
    json_payload = json.loads(request.get_data())
    print(json_payload)
    prompt = json_payload["prompt"]
    length = "normal"
    if "length" in json_payload:
        length = json_payload["length"]

    print('Payload received!')

    reset_history(length)
    return Response(stream_with_context(generate_completion(prompt)), mimetype="application/json")

@app.route('/', methods=["GET"])
def hello_world():
    return "Hello World!"