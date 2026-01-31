package queue

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	sqs "github.com/aws/aws-sdk-go-v2/service/sqs"
	sqstypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

type Publisher interface {
    PublishRunQueued(ctx context.Context, runID int64, threadID int64) error
}

type SQSPublisher struct {
    client   *sqs.Client
    queueURL string
    queueName string
}

func NewSQSPublisher(ctx context.Context) (*SQSPublisher, error) {
    endpoint := os.Getenv("SQS_ENDPOINT_URL")
    region := os.Getenv("AWS_REGION")
    if region == "" { region = "us-east-1" }

    var optFns []func(*config.LoadOptions) error
    if endpoint != "" {
        optFns = append(optFns, config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
            func(service, region string, options ...interface{}) (aws.Endpoint, error) {
                if service == sqs.ServiceID { return aws.Endpoint{URL: endpoint, HostnameImmutable: true}, nil }
                return aws.Endpoint{}, fmt.Errorf("unknown service: %s", service)
            },
        )))
    }
    optFns = append(optFns, config.WithRegion(region))
    cfg, err := config.LoadDefaultConfig(ctx, optFns...)
    if err != nil { return nil, err }
    cli := sqs.NewFromConfig(cfg)

    q := &SQSPublisher{client: cli, queueName: os.Getenv("SQS_QUEUE_NAME")}

    if url := os.Getenv("SQS_QUEUE_URL"); url != "" {
        q.queueURL = url
    } else {
        if q.queueName == "" { q.queueName = "runs.fifo" }
        out, err := cli.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{QueueName: aws.String(q.queueName)})
        if err != nil {
            if endpoint != "" {
                attrs := map[string]string{"FifoQueue": "true", "ContentBasedDeduplication": "false", "VisibilityTimeout": "300"}
                _, _ = cli.CreateQueue(ctx, &sqs.CreateQueueInput{QueueName: aws.String(q.queueName), Attributes: attrs})
                out, err = cli.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{QueueName: aws.String(q.queueName)})
            }
            if err != nil { return nil, err }
        }
        q.queueURL = aws.ToString(out.QueueUrl)
    }
    return q, nil
}

func (p *SQSPublisher) PublishRunQueued(ctx context.Context, runID int64, threadID int64) error {
    if p == nil || p.client == nil {
        return fmt.Errorf("sqs publisher not initialized")
    }
    if p.queueURL == "" { return fmt.Errorf("queueURL is empty") }
    body := fmt.Sprintf(`{"run_id":%d,"thread_id":%d}`, runID, threadID)
    groupID := fmt.Sprintf("%d", threadID)
    dedupID := fmt.Sprintf("run-%d", runID)
    _, err := p.client.SendMessage(ctx, &sqs.SendMessageInput{
        QueueUrl:               aws.String(p.queueURL),
        MessageBody:            aws.String(body),
        MessageGroupId:         aws.String(groupID),
        MessageDeduplicationId: aws.String(dedupID),
        MessageAttributes: map[string]sqstypes.MessageAttributeValue{
            "type": {DataType: aws.String("String"), StringValue: aws.String("run_queued")},
        },
    })
    return err
}
