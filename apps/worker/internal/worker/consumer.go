package worker

import (
	"context"
	"encoding/json"
	"log"
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

func Consume(ctx context.Context, q *queue.SQSClient) error {
    if q == nil || q.Client == nil || q.QueueURL == "" {
        return ErrInvalidQueueClient
    }

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
            QueueUrl:            aws.String(queueURL),
            MaxNumberOfMessages: 2,
            WaitTimeSeconds:     20,
            MessageAttributeNames: []string{"All"},
            MessageSystemAttributeNames: []sqstypes.MessageSystemAttributeName{
                sqstypes.MessageSystemAttributeNameApproximateReceiveCount,
                sqstypes.MessageSystemAttributeNameSentTimestamp,
            },
        })
        if err != nil {
            log.Printf("sqs receive error: %v", err)
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
                log.Printf("invalid message body, deleting: err=%v body=%s", err, aws.ToString(m.Body))
                _, _ = client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
                    QueueUrl:      aws.String(queueURL),
                    ReceiptHandle: m.ReceiptHandle,
                })
                continue
            }

            log.Printf("received run: run_id=%d thread_id=%d", body.RunID, body.ThreadID)

            _, err := client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
                QueueUrl:      aws.String(queueURL),
                ReceiptHandle: m.ReceiptHandle,
            })
            if err != nil {
                log.Printf("delete message error: %v", err)
            }
        }
    }
}

var ErrInvalidQueueClient = &invalidQueueClientError{}

type invalidQueueClientError struct{}

func (e *invalidQueueClientError) Error() string { return "invalid SQS client or queue URL" }
