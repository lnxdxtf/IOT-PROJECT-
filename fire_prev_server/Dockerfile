# Build stage
FROM rust:1.83 AS builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock* ./

# Create a dummy src to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release || true && \
    rm -rf src

# Copy actual source code
COPY src ./src
COPY Rocket.toml ./

# Build for release
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /app/target/release/fire_prev_server /app/fire_prev_server
COPY --from=builder /app/Rocket.toml /app/Rocket.toml

# Expose port
EXPOSE 8000

# Run the binary
CMD ["/app/fire_prev_server"]
