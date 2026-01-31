package httpapi

import (
    "net/http"

    "ai-workspace-platform/api/internal/domain"
    "ai-workspace-platform/api/internal/usecase"
    "github.com/labstack/echo/v4"
)

type RunHandler struct{ U *usecase.Usecase }

type createRunReq struct {
    Status *string `json:"status"` // optional; defaults to queued
}

func (h *RunHandler) Create(c echo.Context) error {
    threadID, err := usecase.ParseID(c.Param("id"))
    if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid thread id"}) }
    var req createRunReq
    _ = c.Bind(&req)
    status := domain.RunQueued
    if req.Status != nil {
        switch *req.Status {
        case string(domain.RunQueued), string(domain.RunRunning), string(domain.RunSucceeded), string(domain.RunFailed), string(domain.RunCancelled):
            status = domain.RunStatus(*req.Status)
        default:
            return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid status"})
        }
    }
    run, err := h.U.Runs.Create(c.Request().Context(), threadID, status)
    if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
    return c.JSON(http.StatusOK, run)
}

func (h *RunHandler) Get(c echo.Context) error {
    runID, err := usecase.ParseID(c.Param("id"))
    if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid run id"}) }
    run, err := h.U.GetRun(c.Request().Context(), runID)
    if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
    return c.JSON(http.StatusOK, run)
}

