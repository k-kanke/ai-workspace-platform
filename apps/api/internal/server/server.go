package server

import (
	"context"
	"net/http"
	"os"
	"time"

	"ai-workspace-platform/api/internal/infra/db"
	"ai-workspace-platform/api/internal/interface/httpapi"
	"ai-workspace-platform/api/internal/usecase"

	"github.com/labstack/echo/v4"
)

func Run() error {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    // DB
    dsn := os.Getenv("DATABASE_URL")
    ctx := context.Background()
    pool, err := db.Connect(ctx, dsn)
    if err != nil {
        return err
    }
    defer pool.Close()

    u := usecase.New(pool)

    e := echo.New()
    e.HideBanner = true

    httpapi.RegisterRoutes(e, u)

    srv := &http.Server{
        Addr:              ":" + port,
        ReadHeaderTimeout: 5 * time.Second,
    }
    e.Logger.Infof("api listening on %s", srv.Addr)
    return e.StartServer(srv)
}
