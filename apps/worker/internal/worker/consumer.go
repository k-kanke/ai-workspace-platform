package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	sqs "github.com/aws/aws-sdk-go-v2/service/sqs"
	sqstypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"ai-workspace-platform/worker/internal/queue"
)

type runMessage struct {
	RunID    int64 `json:"run_id"`
	ThreadID int64 `json:"thread_id"`
}

type Runner interface {
	ProcessRun(ctx context.Context, runID, threadID int64) error
}

func Consume(ctx context.Context, q *queue.SQSClient, r Runner) error {
	if q == nil || q.Client == nil || q.QueueURL == "" {
		return ErrInvalidQueueClient
	}
	if r == nil {
		return ErrNoRunner
	}

	conc := 3
	if v := os.Getenv("WORKER_CONCURRENCY"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			conc = n
		}
	}
	log.Printf("starting %d poller(s) for queue %s", conc, q.QueueURL)

	errCh := make(chan error, conc)
	for i := 0; i < conc; i++ {
		go func(idx int) {
			if err := pollLoop(ctx, q, r, idx); err != nil && ctx.Err() == nil {
				errCh <- fmt.Errorf("poller %d: %w", idx, err)
			}
		}(i)
	}

	select {
	case <-ctx.Done():
		return nil
	case err := <-errCh:
		return err
	}
}

func pollLoop(ctx context.Context, q *queue.SQSClient, r Runner, idx int) error {
	client := q.Client
	queueURL := q.QueueURL
	backoff := time.Second

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		out, err := client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl:              aws.String(queueURL),
			MaxNumberOfMessages:   1,
			WaitTimeSeconds:       20,
			MessageAttributeNames: []string{"All"},
			MessageSystemAttributeNames: []sqstypes.MessageSystemAttributeName{
				sqstypes.MessageSystemAttributeNameApproximateReceiveCount,
				sqstypes.MessageSystemAttributeNameSentTimestamp,
			},
		})
		if err != nil {
			log.Printf("poller %d: sqs receive error: %v", idx, err)
			select {
			case <-time.After(backoff):
				if backoff < 10*time.Second {
					backoff *= 2
				}
				continue
			case <-ctx.Done():
				return nil
			}
		}
		backoff = time.Second

		if len(out.Messages) == 0 {
			continue
		}

		for _, m := range out.Messages {
			var body runMessage
			if err := json.Unmarshal([]byte(aws.ToString(m.Body)), &body); err != nil {
				log.Printf("poller %d: invalid message body, deleting: err=%v body=%s", idx, err, aws.ToString(m.Body))
				_, _ = client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
					QueueUrl:      aws.String(queueURL),
					ReceiptHandle: m.ReceiptHandle,
				})
				continue
			}

			if err := r.ProcessRun(ctx, body.RunID, body.ThreadID); err != nil {
				log.Printf("poller %d: process run error: %v (deleting message)", idx, err)
				_, _ = client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
					QueueUrl:      aws.String(queueURL),
					ReceiptHandle: m.ReceiptHandle,
				})
				continue
			}

			_, err := client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
				QueueUrl:      aws.String(queueURL),
				ReceiptHandle: m.ReceiptHandle,
			})
			if err != nil {
				log.Printf("poller %d: delete message error: %v", idx, err)
			}
		}
	}
}

var ErrInvalidQueueClient = &invalidQueueClientError{}
var ErrNoRunner = &noRunnerError{}

type invalidQueueClientError struct{}

func (e *invalidQueueClientError) Error() string { return "invalid SQS client or queue URL" }

type noRunnerError struct{}

func (e *noRunnerError) Error() string { return "runner is nil" }
