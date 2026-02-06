package httpapi

import (
	"errors"
	"net/http"

	"ai-workspace-platform/api/internal/usecase"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

type WorkspaceKnowledgeLinkHandler struct{ U *usecase.Usecase }

type linkReq struct {
	KnowledgeID int64 `json:"knowledge_id"`
}

func (h *WorkspaceKnowledgeLinkHandler) ListByWorkspace(c echo.Context) error {
	wsID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	items, err := h.U.ListWorkspaceKnowledgeLinks(c.Request().Context(), wsID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, items)
}

func (h *WorkspaceKnowledgeLinkHandler) Link(c echo.Context) error {
	wsID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	var req linkReq
	if err := c.Bind(&req); err != nil || req.KnowledgeID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	if err := h.U.LinkWorkspaceKnowledge(c.Request().Context(), wsID, req.KnowledgeID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *WorkspaceKnowledgeLinkHandler) Unlink(c echo.Context) error {
	wsID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	kID, err := usecase.ParseID(c.Param("knowledge_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid knowledge id"})
	}
	if err := h.U.UnlinkWorkspaceKnowledge(c.Request().Context(), wsID, kID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "link not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}
