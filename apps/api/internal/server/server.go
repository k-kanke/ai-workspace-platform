package server

import (
    "context"
    "log"
    "net/http"
    "os"
    "time"

    "ai-workspace-platform/api/internal/infra/db"
    "ai-workspace-platform/api/internal/infra/queue"
    "ai-workspace-platform/api/internal/interface/httpapi"
    "ai-workspace-platform/api/internal/notify"
    "ai-workspace-platform/api/internal/stream"
    "ai-workspace-platform/api/internal/usecase"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
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

    pub, perr := queue.NewSQSPublisher(ctx)
    if perr != nil {
        log.Printf("SQS publisher init failed: %v (continuing without queue)", perr)
    }
    var pubInst queue.Publisher
    if perr == nil { pubInst = pub }
    u := usecase.New(pool, pubInst)

    e := echo.New()
    e.HideBanner = true
    e.Use(middleware.Recover())

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodOptions},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))

    hub := stream.NewHub()
    notify.StartAssistantMessageListener(ctx, pool, hub)

    httpapi.RegisterRoutes(e, u, hub)

    srv := &http.Server{
        Addr:              ":" + port,
        ReadHeaderTimeout: 5 * time.Second,
    }
    e.Logger.Infof("api listening on %s", srv.Addr)
    return e.StartServer(srv)
}
