package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"ai-workspace-platform/api/internal/usecase"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

type ThreadHandler struct{ U *usecase.Usecase }

type createThreadReq struct {
	WorkspaceID int64   `json:"workspace_id"`
	Title       *string `json:"title"`
}

type updateThreadTitleReq struct {
	Title *string `json:"title"`
}

func (h *ThreadHandler) Create(c echo.Context) error {
	var req createThreadReq
	if err := c.Bind(&req); err != nil || req.WorkspaceID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	t, err := h.U.CreateThread(c.Request().Context(), req.WorkspaceID, req.Title)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, t)
}

func (h *ThreadHandler) ListByWorkspace(c echo.Context) error {
	wsID := c.QueryParam("workspace_id")
	if wsID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "workspace_id is required"})
	}
	wID, err := usecase.ParseID(wsID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace_id"})
	}
	limit := 50
	offset := 0
	if v := c.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	if v := c.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = n
		}
	}
	ts, err := h.U.ListThreadsByWorkspace(c.Request().Context(), wID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, ts)
}

func (h *ThreadHandler) UpdateTitle(c echo.Context) error {
	threadID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
	}
	var req updateThreadTitleReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	t, err := h.U.UpdateThreadTitle(c.Request().Context(), threadID, req.Title)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidTitle) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid title"})
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "thread not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, t)
}
