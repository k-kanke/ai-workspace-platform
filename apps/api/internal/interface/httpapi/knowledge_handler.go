package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"ai-workspace-platform/api/internal/usecase"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

type KnowledgeHandler struct{ U *usecase.Usecase }

type knowledgeReq struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (h *KnowledgeHandler) List(c echo.Context) error {
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
	items, err := h.U.ListKnowledge(c.Request().Context(), limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, items)
}

func (h *KnowledgeHandler) Create(c echo.Context) error {
	var req knowledgeReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	k, err := h.U.CreateKnowledgeWithName(c.Request().Context(), req.Name, req.Content)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidKnowledgeName) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid name"})
		}
		if errors.Is(err, usecase.ErrInvalidContent) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid content"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, k)
}

func (h *KnowledgeHandler) Update(c echo.Context) error {
	id, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid knowledge id"})
	}
	var req knowledgeReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	k, err := h.U.UpdateKnowledge(c.Request().Context(), id, req.Name, req.Content)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidKnowledgeName) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid name"})
		}
		if errors.Is(err, usecase.ErrInvalidContent) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid content"})
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "knowledge not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, k)
}
