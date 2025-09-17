package main

import (
    "context"
    "log"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/peer"
    "google.golang.org/grpc/status"
)

func loggingUnaryInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()
    p, _ := peer.FromContext(ctx)
    resp, err := handler(ctx, req)
    s, _ := status.FromError(err)
    dur := time.Since(start)
    peerAddr := ""
    if p != nil {
        peerAddr = p.Addr.String()
    }
    log.Printf("grpc unary: method=%s code=%s dur_ms=%d peer=%s", info.FullMethod, s.Code().String(), dur.Milliseconds(), peerAddr)
    return resp, err
}

func loggingStreamInterceptor(
    srv interface{},
    ss grpc.ServerStream,
    info *grpc.StreamServerInfo,
    handler grpc.StreamHandler,
) error {
    start := time.Now()
    p, _ := peer.FromContext(ss.Context())
    err := handler(srv, ss)
    s, _ := status.FromError(err)
    dur := time.Since(start)
    peerAddr := ""
    if p != nil {
        peerAddr = p.Addr.String()
    }
    log.Printf("grpc stream: method=%s code=%s dur_ms=%d peer=%s", info.FullMethod, s.Code().String(), dur.Milliseconds(), peerAddr)
    return err
}

