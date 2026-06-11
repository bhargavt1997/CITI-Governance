# ---- Stage 1: build the React frontend ----
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # outputs /app/dist

# ---- Stage 2: build the Spring Boot jar with the UI bundled as static resources ----
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /app
COPY backend/ ./
# Drop the compiled UI into Spring Boot's static folder so it's packaged into the jar
COPY --from=frontend /app/dist ./src/main/resources/static
RUN mvn -B -q -DskipTests package

# ---- Stage 3: lightweight runtime ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
