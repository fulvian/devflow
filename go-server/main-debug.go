//go:build debug
// +build debug

package main

import (
    "fmt"
    "log"
    "net"
    "os"
    "os/signal"
    "syscall"

    "google.golang.org/grpc"
    "google.golang.org/grpc/reflection"
    health "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
    pb "github.com/devflow/cc-tools-server/proto"
)

func main() {
    port := os.Getenv("GRPC_PORT")
    if port == "" {
        port = "50051"
    }

    log.Printf("Starting CC-Tools gRPC server (debug mode)...")
    log.Printf("Binding to 0.0.0.0:%s", port)

    lis, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%s", port))
    if err != nil {
        log.Fatalf("Failed to listen: %v", err)
    }

    log.Printf("Successfully bound to %s", lis.Addr().String())

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
    hs.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
    hs.SetServingStatus("cc_tools_integration.CCToolsIntegration", healthpb.HealthCheckResponse_SERVING)

    // Enable reflection for debugging
    reflection.Register(grpcServer)
    log.Printf("Services registered successfully; reflection enabled")

    // Graceful shutdown on SIGINT/SIGTERM
    go func() {
        sigCh := make(chan os.Signal, 1)
        signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
        <-sigCh
        log.Printf("Shutting down gracefully...")
        grpcServer.GracefulStop()
    }()

    log.Printf("CC-Tools gRPC server (debug) ready on port %s", port)

    if err := grpcServer.Serve(lis); err != nil {
        log.Fatalf("Failed to serve: %v", err)
    }
}
