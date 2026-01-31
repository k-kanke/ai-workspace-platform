package httpapi

import (
	"ai-workspace-platform/api/internal/usecase"
	"net/http"

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