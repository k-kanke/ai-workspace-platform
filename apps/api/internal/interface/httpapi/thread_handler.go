package httpapi

import (
    "net/http"

    "ai-workspace-platform/api/internal/usecase"
    "github.com/labstack/echo/v4"
)

type ThreadHandler struct{ U *usecase.Usecase }

type createThreadReq struct {
    WorkspaceID int64   `json:"workspace_id"`
    Title       *string `json:"title"`
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

