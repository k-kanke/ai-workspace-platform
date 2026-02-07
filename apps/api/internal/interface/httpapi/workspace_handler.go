package httpapi

import (
	"ai-workspace-platform/api/internal/usecase"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

type WorkspaceHandler struct{ U *usecase.Usecase }

type createWorkspaceReq struct {
	Name         *string `json:"name"`
	SystemPrompt *string `json:"system_prompt"`
}

type updateSystemPromptReq struct {
	SystemPrompt *string `json:"system_prompt"`
}

type upsertKnowledgeReq struct {
	Content string `json:"content"`
}

type upsertNameReq struct {
	Name *string `json:"name"`
}

type updateLLMEnabledReq struct {
	LLMEnabled *bool `json:"llm_enabled"`
}

type knowledgeResp struct {
	WorkspaceID int64   `json:"workspace_id"`
	KnowledgeID *int64  `json:"knowledge_id,omitempty"`
	Content     *string `json:"content"`
	UpdatedAt   *string `json:"updated_at"`
}

func (h *WorkspaceHandler) Create(c echo.Context) error {
	var req createWorkspaceReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	w, err := h.U.CreateWorkspace(c.Request().Context(), req.Name, req.SystemPrompt)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, w)
}

func (h *WorkspaceHandler) List(c echo.Context) error {
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
	ws, err := h.U.ListWorkspaces(c.Request().Context(), limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, ws)
}

func (h *WorkspaceHandler) UpdateSystemPrompt(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	var req updateSystemPromptReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	w, err := h.U.UpdateWorkspaceSystemPrompt(c.Request().Context(), id, req.SystemPrompt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "workspace not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, w)
}

func (h *WorkspaceHandler) GetKnowledge(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	k, err := h.U.GetWorkspaceKnowledge(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if k == nil {
		return c.JSON(http.StatusOK, knowledgeResp{WorkspaceID: id, KnowledgeID: nil, Content: nil, UpdatedAt: nil})
	}
	updated := k.UpdatedAt.Format("2006-01-02T15:04:05Z07:00")
	content := k.Content
	return c.JSON(http.StatusOK, knowledgeResp{
		WorkspaceID: k.WorkspaceID,
		KnowledgeID: &k.KnowledgeID,
		Content:     &content,
		UpdatedAt:   &updated,
	})
}

func (h *WorkspaceHandler) UpsertKnowledge(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	var req upsertKnowledgeReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	k, err := h.U.UpsertWorkspaceKnowledge(c.Request().Context(), id, req.Content)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	updated := k.UpdatedAt.Format("2006-01-02T15:04:05Z07:00")
	content := k.Content
	return c.JSON(http.StatusOK, knowledgeResp{
		WorkspaceID: k.WorkspaceID,
		KnowledgeID: &k.KnowledgeID,
		Content:     &content,
		UpdatedAt:   &updated,
	})
}

func (h *WorkspaceHandler) UpdateName(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	var req upsertNameReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	w, err := h.U.UpdateWorkspaceName(c.Request().Context(), id, req.Name)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidName) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid name"})
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "workspace not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, w)
}

func (h *WorkspaceHandler) Delete(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	err = h.U.DeleteWorkspace(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "workspace not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *WorkspaceHandler) UpdateLLMEnabled(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid workspace id"})
	}
	var req updateLLMEnabledReq
	if err := c.Bind(&req); err != nil || req.LLMEnabled == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	w, err := h.U.UpdateWorkspaceLLMEnabled(c.Request().Context(), id, *req.LLMEnabled)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "workspace not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, w)
}
