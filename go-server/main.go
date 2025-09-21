//go:build !debug
// +build !debug

package main

import (
    "log"
    "net"
    "os"

    "google.golang.org/grpc"
    health "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
    pb "github.com/devflow/cc-tools-server/proto"
)

func main() {
    port := os.Getenv("GO_GRPC_PORT")
    if port == "" {
        port = os.Getenv("GRPC_PORT")
    }
    if port == "" {
        port = "50051"
    }

    lis, err := net.Listen("tcp", ":"+port)
    if err != nil {
        log.Fatalf("Failed to listen: %v", err)
    }

    grpcServer := grpc.NewServer(
        grpc.MaxRecvMsgSize(4*1024*1024),
        grpc.MaxSendMsgSize(4*1024*1024),
        grpc.ChainUnaryInterceptor(loggingUnaryInterceptor),
        grpc.ChainStreamInterceptor(loggingStreamInterceptor),
    )
    ccToolsServer := NewCCToolsServer()

    pb.RegisterCCToolsIntegrationServer(grpcServer, ccToolsServer)

    // Health service registration
    hs := health.NewServer()
    healthpb.RegisterHealthServer(grpcServer, hs)
    // Set overall and service-specific statuses to SERVING
    hs.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
    hs.SetServingStatus("cc_tools_integration.CCToolsIntegration", healthpb.HealthCheckResponse_SERVING)

    log.Printf("CC-Tools gRPC server listening on port %s", port)

    if err := grpcServer.Serve(lis); err != nil {
        log.Fatalf("Failed to serve: %v", err)
    }
}
