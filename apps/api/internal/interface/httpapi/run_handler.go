package httpapi

import (
	"net/http"
	"time"

	"ai-workspace-platform/api/internal/domain"
	"ai-workspace-platform/api/internal/stream"
	"ai-workspace-platform/api/internal/usecase"

	"github.com/labstack/echo/v4"
)

type RunHandler struct {
	U   *usecase.Usecase
	Hub *stream.Hub
}

type createRunReq struct {
	Status *string `json:"status"` // optional; defaults to queued
}

func (h *RunHandler) Create(c echo.Context) error {
	threadID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
	}
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
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, run)
}

func (h *RunHandler) Get(c echo.Context) error {
	runID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid run id"})
	}
	run, err := h.U.GetRun(c.Request().Context(), runID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, run)
}

func (h *RunHandler) Stream(c echo.Context) error {
	ctx := c.Request().Context()
	runID, err := usecase.ParseID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid run id"})
	}

	res := c.Response()
	res.Header().Set(echo.HeaderContentType, "text/event-stream")
	res.Header().Set(echo.HeaderCacheControl, "no-cache")
	res.Header().Set("Connection", "keep-alive")

	flusher, ok := res.Writer.(http.Flusher)
	if !ok {
		return c.String(http.StatusInternalServerError, "streaming unsupported")
	}

	writeEvent := func(event, data string) {
		if event != "" {
			_, _ = res.Write([]byte("event: " + event + "\n"))
		}
		if data != "" {
			_, _ = res.Write([]byte("data: " + data + "\n"))
		}
		_, _ = res.Write([]byte("\n"))
		flusher.Flush()
	}

	ping := time.NewTicker(10 * time.Second)
	defer ping.Stop()

	// 初期ステータスを送信
	if run, err := h.U.GetRun(ctx, runID); err == nil {
		if run.Status == domain.RunQueued || run.Status == domain.RunRunning {
			writeEvent("status", string(run.Status))
		}
	}

	// 既にメッセージがあれば即送信
	if m, err := h.U.Messages.FindAssistantByRun(ctx, runID); err == nil && m != nil {
		writeEvent("message", m.Content)
		writeEvent("done", "")
		return nil
	}

	// Hubにサブスクライブしてストリーム/完了通知を待機
	ch, cancel := h.Hub.Subscribe(runID)
	defer cancel()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ping.C:
			_, _ = res.Write([]byte(":ping\n\n"))
			flusher.Flush()
		case evt := <-ch:
			if evt.Type == "stream" {
				if evt.Content != "" {
					writeEvent("message", evt.Content)
				}
				continue
			}
			if m, err := h.U.Messages.FindAssistantByRun(ctx, runID); err == nil && m != nil {
				writeEvent("message", m.Content)
			}
			writeEvent("done", "")
			return nil
		}
	}
}
