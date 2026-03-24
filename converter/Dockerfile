FROM python:3.9-slim

# Install headless Java + wget for JAR download
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-21-jdk-headless wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    java -version

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# DEBUG: Show exactly what mpxj installed
RUN echo "=== mpxj package contents ===" && \
    python -c "import mpxj, os; p=os.path.dirname(mpxj.__file__); [print(os.path.join(r,f)) for r,d,fs in os.walk(p) for f in fs]"

# Copy any JARs from pip install to /app/jars
RUN mkdir -p /app/jars && \
    find /usr/local/lib -name "*.jar" -exec cp {} /app/jars/ \; ; \
    echo "=== JARs from pip ===" && ls /app/jars/ 2>/dev/null || echo "NONE"

# GUARANTEED FALLBACK: Download mpxj JAR + dependencies from Maven Central
RUN wget -q -P /app/jars/ \
    https://repo1.maven.org/maven2/net/sf/mpxj/mpxj/10.12.0/mpxj-10.12.0.jar \
    https://repo1.maven.org/maven2/org/glassfish/jakarta.json/2.0.1/jakarta.json-2.0.1.jar \
    https://repo1.maven.org/maven2/jakarta/json/jakarta.json-api/2.1.3/jakarta.json-api-2.1.3.jar && \
    echo "=== Final JARs ===" && ls -la /app/jars/

COPY . .

EXPOSE 7860

# Force unbuffered output so we see logs
ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--workers", "1", "--threads", "8", "--timeout", "120", "app:app"]
