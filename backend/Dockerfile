FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Go 1.25: -installsuffix cgo is deprecated, use -trimpath for reproducible builds
# -ldflags "-s -w" strips symbol table and debug info for smaller binary
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o main ./cmd/server

# Use specific Alpine version for reproducibility
FROM alpine:3.23

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
