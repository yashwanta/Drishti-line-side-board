# ── Build stage ───────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Install Maven
RUN apk add --no-cache maven && mvn -B package -DskipTests

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
RUN apk --no-cache add curl tzdata
WORKDIR /app
COPY --from=builder /app/target/mars-service-*.jar app.jar
EXPOSE 8080
# Tuned JVM flags for a small plant server
ENTRYPOINT ["java", "-Xms128m", "-Xmx512m", "-jar", "app.jar"]
