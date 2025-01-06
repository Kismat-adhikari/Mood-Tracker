# Use a base Python image
FROM python:3.9-slim

# Install Rust toolchain (needed for tokenizers)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libssl-dev \
    libffi-dev \
    rustc \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy your project files into the container
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port the app will run on
EXPOSE 5000

# Set the entry point to start the Flask app
CMD ["gunicorn", "api.app:app"]
