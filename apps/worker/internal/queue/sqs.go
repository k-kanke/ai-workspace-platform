package queue

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	sqs "github.com/aws/aws-sdk-go-v2/service/sqs"
)

type SQSClient struct {
    Client   *sqs.Client
    QueueURL string
    QueueName string
}

func NewSQSClient(ctx context.Context) (*SQSClient, error) {
    endpoint := os.Getenv("SQS_ENDPOINT_URL")
    region := os.Getenv("AWS_REGION")
    if region == "" {
        region = "us-east-1"
    }

    var optFns []func(*config.LoadOptions) error
    if endpoint != "" {
        optFns = append(optFns, config.WithEndpointResolverWithOptions(
            aws.EndpointResolverWithOptionsFunc(func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
                if service == sqs.ServiceID {
                    return aws.Endpoint{URL: endpoint, HostnameImmutable: true}, nil
                }
                return aws.Endpoint{}, fmt.Errorf("unknown service: %s", service)
            }),
        ))
    }
    optFns = append(optFns, config.WithRegion(region))

    cfg, err := config.LoadDefaultConfig(ctx, optFns...)
    if err != nil {
        return nil, err
    }
    cli := sqs.NewFromConfig(cfg)

    q := &SQSClient{Client: cli, QueueName: os.Getenv("SQS_QUEUE_NAME")}

    if url := os.Getenv("SQS_QUEUE_URL"); url != "" {
        q.QueueURL = url
        return q, nil
    }

    if q.QueueName == "" {
        q.QueueName = "runs.fifo"
    }

    out, err := cli.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{QueueName: aws.String(q.QueueName)})
    if err != nil {
        if endpoint != "" {
            attrs := map[string]string{
                "FifoQueue":              "true",
                "ContentBasedDeduplication": "false",
                "VisibilityTimeout":      "300",
            }
            _, _ = cli.CreateQueue(ctx, &sqs.CreateQueueInput{QueueName: aws.String(q.QueueName), Attributes: attrs})
            out, err = cli.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{QueueName: aws.String(q.QueueName)})
        }
        if err != nil {
            return nil, err
        }
    }
    q.QueueURL = aws.ToString(out.QueueUrl)
    return q, nil
}

