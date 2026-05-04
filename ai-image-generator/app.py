from flask import Flask, request, jsonify, render_template, Response
import requests
import os
import base64
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Pollinations AI — free, no API key needed
# Using 'turbo' model for much faster generation
def build_url(prompt, model="flux"):
    encoded = quote(prompt)
    return f"https://image.pollinations.ai/prompt/{encoded}?model={model}&width=1024&height=1024&nologo=true&enhance=false"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate_image():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Try fast model first, fall back to default
    models = ["turbo", "flux"]

    for model in models:
        url = build_url(prompt, model)
        print(f"Trying model={model}: {url}")

        for attempt in range(2):  # 2 attempts per model
            try:
                response = requests.get(url, timeout=90)

                if response.status_code == 200:
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    if "image" in content_type:
                        image_b64 = base64.b64encode(response.content).decode("utf-8")
                        image_data_url = f"data:{content_type};base64,{image_b64}"
                        print(f"Success with model={model} attempt={attempt+1}")
                        return jsonify({"image_url": image_data_url, "prompt": prompt})

                print(f"model={model} attempt={attempt+1} status={response.status_code}")

            except requests.exceptions.Timeout:
                print(f"model={model} attempt={attempt+1} timed out")
                continue

            except requests.exceptions.RequestException as e:
                print(f"model={model} attempt={attempt+1} error: {e}")
                continue

    return jsonify({"error": "Could not generate image after multiple attempts. Please try again."}), 504


@app.route("/download", methods=["POST"])
def download_image():
    data = request.get_json()
    image_data_url = data.get("url", "")

    if not image_data_url:
        return jsonify({"error": "No image data provided"}), 400

    try:
        header, b64data = image_data_url.split(",", 1)
        image_bytes = base64.b64decode(b64data)
        mime_type = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
        ext = mime_type.split("/")[-1]

        return Response(
            image_bytes,
            mimetype=mime_type,
            headers={"Content-Disposition": f"attachment; filename=textlens_image.{ext}"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)