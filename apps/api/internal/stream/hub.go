package stream

import (
	"sync"
)

type RunEvent struct {
	RunID     int64
	ThreadID  int64
	MessageID int64
	Type      string
	Content   string
}

type Hub struct {
	mu      sync.Mutex
	waiters map[int64][]chan RunEvent
}

func NewHub() *Hub {
	return &Hub{waiters: make(map[int64][]chan RunEvent)}
}

func (h *Hub) Subscribe(runID int64) (<-chan RunEvent, func()) {
	ch := make(chan RunEvent, 1)
	h.mu.Lock()
	h.waiters[runID] = append(h.waiters[runID], ch)
	h.mu.Unlock()
	cancel := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		arr := h.waiters[runID]
		out := arr[:0]
		for _, c := range arr {
			if c != ch {
				out = append(out, c)
			}
		}
		if len(out) == 0 {
			delete(h.waiters, runID)
		} else {
			h.waiters[runID] = out
		}
	}
	return ch, cancel
}

func (h *Hub) Publish(evt RunEvent) {
	h.mu.Lock()
	arr := h.waiters[evt.RunID]
	if evt.Type == "done" {
		delete(h.waiters, evt.RunID)
	}
	h.mu.Unlock()
	for _, ch := range arr {
		select {
		case ch <- evt:
		default:
		}
		if evt.Type == "done" {
			close(ch)
		}
	}
}
