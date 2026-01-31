package httpapi

import (
    "net/http"

    "ai-workspace-platform/api/internal/usecase"
    "github.com/labstack/echo/v4"
)

type MessageHandler struct{ U *usecase.Usecase }

type postMessageReq struct {
    Content string `json:"content"`
}

func (h *MessageHandler) ListByThread(c echo.Context) error {
    threadID, err := usecase.ParseID(c.Param("id"))
    if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid thread id"}) }
    msgs, err := h.U.ListMessages(c.Request().Context(), threadID, 100)
    if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
    return c.JSON(http.StatusOK, msgs)
}

func (h *MessageHandler) PostAndEnqueue(c echo.Context) error {
    threadID, err := usecase.ParseID(c.Param("id"))
    if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid thread id"}) }
    var req postMessageReq
    if err := c.Bind(&req); err != nil || req.Content == "" {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
    }
    run, err := h.U.PostMessageAndEnqueueRun(c.Request().Context(), threadID, req.Content)
    if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
    return c.JSON(http.StatusOK, run)
}

