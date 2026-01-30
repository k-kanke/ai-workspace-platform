FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/worker ./

FROM alpine:3.20
RUN adduser -D -g '' app
USER app
COPY --from=build /bin/worker /bin/worker
ENTRYPOINT ["/bin/worker"]
