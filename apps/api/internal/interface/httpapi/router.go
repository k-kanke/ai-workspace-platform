package httpapi

import (
    "net/http"

    "ai-workspace-platform/api/internal/usecase"
    "github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, u *usecase.Usecase) {
    e.GET("/healthz", func(c echo.Context) error { return c.String(http.StatusOK, "ok") })
    e.GET("/", func(c echo.Context) error { return c.String(http.StatusOK, "ai-workspace api") })

    th := &ThreadHandler{U: u}
    mh := &MessageHandler{U: u}
    rh := &RunHandler{U: u}

    e.POST("/threads", th.Create)
    e.GET("/threads/:id/messages", mh.ListByThread)
    e.POST("/threads/:id/messages", mh.PostAndEnqueue)
    e.POST("/threads/:id/runs", rh.Create)
    e.GET("/runs/:id", rh.Get)
}

