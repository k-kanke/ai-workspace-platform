package main

import (
	"log"

	"ai-workspace-platform/api/internal/server"
)

func main() {
    if err := server.Run(); err != nil {
        log.Fatalf("server exit: %v", err)
    }
}
