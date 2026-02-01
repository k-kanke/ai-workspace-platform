package httpapi

import (
	"ai-workspace-platform/api/internal/usecase"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type WorkspaceHandler struct{ U *usecase.Usecase }

type createWorkspaceReq struct{
	Name       *string `json:"name"`
}

func (h *WorkspaceHandler) Create(c echo.Context) error {
	var req createWorkspaceReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	w, err := h.U.CreateWorkspace(c.Request().Context(), req.Name)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, w)
}

func (h *WorkspaceHandler) List(c echo.Context) error {
    // simple pagination
    limit := 50
    offset := 0
    if v := c.QueryParam("limit"); v != "" { if n, err := strconv.Atoi(v); err == nil { limit = n } }
    if v := c.QueryParam("offset"); v != "" { if n, err := strconv.Atoi(v); err == nil { offset = n } }
    ws, err := h.U.ListWorkspaces(c.Request().Context(), limit, offset)
    if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
    return c.JSON(http.StatusOK, ws)
}
