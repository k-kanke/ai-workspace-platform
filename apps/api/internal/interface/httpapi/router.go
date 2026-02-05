package httpapi

import (
	"net/http"

	"ai-workspace-platform/api/internal/stream"
	"ai-workspace-platform/api/internal/usecase"

	"github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, u *usecase.Usecase, hub *stream.Hub) {
	e.GET("/healthz", func(c echo.Context) error { return c.String(http.StatusOK, "ok") })
	e.GET("/", func(c echo.Context) error { return c.String(http.StatusOK, "ai-workspace api") })

	wh := &WorkspaceHandler{U: u}
	th := &ThreadHandler{U: u}
	mh := &MessageHandler{U: u}
	rh := &RunHandler{U: u, Hub: hub}

	e.POST("/workspace", wh.Create)
	e.GET("/workspaces", wh.List)
	e.PUT("/workspaces/:id/system_prompt", wh.UpdateSystemPrompt)
	e.GET("/workspaces/:id/knowledge", wh.GetKnowledge)
	e.PUT("/workspaces/:id/knowledge", wh.UpsertKnowledge)
	e.POST("/threads", th.Create)
	e.GET("/threads", th.ListByWorkspace)
	e.GET("/threads/:id/messages", mh.ListByThread)
	e.POST("/threads/:id/messages", mh.PostAndEnqueue)
	e.POST("/threads/:id/runs", rh.Create)
	e.GET("/runs/:id", rh.Get)
	e.GET("/runs/:id/stream", rh.Stream)
}
