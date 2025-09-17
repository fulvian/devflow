package main

import (
    "context"
    "fmt"
    "os"
    "os/exec"
    "strings"
    "sync"
    "time"

    pb "github.com/devflow/cc-tools-server/proto"
)

// LockManager handles project locking
type LockManager struct {
    locks map[string]*LockInfo
    mutex sync.RWMutex
}

type LockInfo struct {
    ProcessID   int32
    AcquiredAt  int64
    ProjectPath string
}

// CCToolsServer implements the gRPC service
type CCToolsServer struct {
    pb.UnimplementedCCToolsIntegrationServer
    lockManager *LockManager
}

func NewCCToolsServer() *CCToolsServer {
    return &CCToolsServer{
        lockManager: &LockManager{
            locks: make(map[string]*LockInfo),
        },
    }
}

// ValidateProject implements validation with cc-tools integration
func (s *CCToolsServer) ValidateProject(ctx context.Context, req *pb.ValidationRequest) (*pb.ValidationResponse, error) {
    startTime := time.Now()

    // Get project metadata first
    metadata, err := s.detectProjectMetadata(req.ProjectRoot)
    if err != nil {
        return &pb.ValidationResponse{
            Success:         false,
            ErrorMessage:    fmt.Sprintf("Failed to detect project metadata: %v", err),
            ExecutionTimeMs: time.Since(startTime).Milliseconds(),
        }, nil
    }

    // Execute validations based on project type
    results := make([]*pb.ValidationResult, 0)

    // Run lint if available
    if lintCmd, exists := metadata.Commands["lint"]; exists {
        result := s.executeValidator("lint", lintCmd, req.ProjectRoot, req.TimeoutMs)
        results = append(results, result)
    }

    // Run test if available
    if testCmd, exists := metadata.Commands["test"]; exists {
        result := s.executeValidator("test", testCmd, req.ProjectRoot, req.TimeoutMs)
        results = append(results, result)
    }

    // Check overall success
    success := true
    for _, result := range results {
        if !result.Success {
            success = false
            break
        }
    }

    return &pb.ValidationResponse{
        Success:         success,
        Results:         results,
        Metadata:        metadata,
        ExecutionTimeMs: time.Since(startTime).Milliseconds(),
    }, nil
}

// GetProjectMetadata detects and returns project metadata
func (s *CCToolsServer) GetProjectMetadata(ctx context.Context, req *pb.ValidationRequest) (*pb.ProjectMetadata, error) {
    return s.detectProjectMetadata(req.ProjectRoot)
}

// AcquireLock acquires a PID-based lock for the project
func (s *CCToolsServer) AcquireLock(ctx context.Context, req *pb.LockRequest) (*pb.LockStatus, error) {
    s.lockManager.mutex.Lock()
    defer s.lockManager.mutex.Unlock()

    lockID := fmt.Sprintf("devflow_%s", req.ProjectPath)

    // Check if already locked
    if lockInfo, exists := s.lockManager.locks[lockID]; exists {
        // Check if process is still alive
        if s.isProcessAlive(lockInfo.ProcessID) && !req.ForceRelease {
            return &pb.LockStatus{
                LockId:      lockID,
                ProjectPath: req.ProjectPath,
                ProcessId:   lockInfo.ProcessID,
                AcquiredAt:  lockInfo.AcquiredAt,
                IsLocked:    true,
            }, nil
        }
    }

    // Acquire lock
    currentPID := int32(os.Getpid())
    lockInfo := &LockInfo{
        ProcessID:   currentPID,
        AcquiredAt:  time.Now().Unix(),
        ProjectPath: req.ProjectPath,
    }

    s.lockManager.locks[lockID] = lockInfo

    return &pb.LockStatus{
        LockId:      lockID,
        ProjectPath: req.ProjectPath,
        ProcessId:   currentPID,
        AcquiredAt:  lockInfo.AcquiredAt,
        IsLocked:    true,
    }, nil
}

// ReleaseLock releases the lock for the project
func (s *CCToolsServer) ReleaseLock(ctx context.Context, req *pb.LockRequest) (*pb.LockStatus, error) {
    s.lockManager.mutex.Lock()
    defer s.lockManager.mutex.Unlock()

    lockID := fmt.Sprintf("devflow_%s", req.ProjectPath)
    delete(s.lockManager.locks, lockID)

    return &pb.LockStatus{
        LockId:      lockID,
        ProjectPath: req.ProjectPath,
        IsLocked:    false,
    }, nil
}

// CheckLock checks the current lock status
func (s *CCToolsServer) CheckLock(ctx context.Context, req *pb.LockRequest) (*pb.LockStatus, error) {
    s.lockManager.mutex.RLock()
    defer s.lockManager.mutex.RUnlock()

    lockID := fmt.Sprintf("devflow_%s", req.ProjectPath)

    if lockInfo, exists := s.lockManager.locks[lockID]; exists {
        return &pb.LockStatus{
            LockId:      lockID,
            ProjectPath: req.ProjectPath,
            ProcessId:   lockInfo.ProcessID,
            AcquiredAt:  lockInfo.AcquiredAt,
            IsLocked:    s.isProcessAlive(lockInfo.ProcessID),
        }, nil
    }

    return &pb.LockStatus{
        LockId:      lockID,
        ProjectPath: req.ProjectPath,
        IsLocked:    false,
    }, nil
}

// Helper methods
func (s *CCToolsServer) detectProjectMetadata(projectRoot string) (*pb.ProjectMetadata, error) {
    metadata := &pb.ProjectMetadata{
        ProjectRoot: projectRoot,
        Commands:    make(map[string]string),
    }

    // Check for different project types
    if s.fileExists(projectRoot + "/package.json") {
        metadata.ProjectType = "npm"
        metadata.Language = "javascript"
        metadata.ConfigFiles = append(metadata.ConfigFiles, "package.json")
        metadata.Commands["lint"] = "npm run lint"
        metadata.Commands["test"] = "npm test"
    } else if s.fileExists(projectRoot + "/Cargo.toml") {
        metadata.ProjectType = "cargo"
        metadata.Language = "rust"
        metadata.ConfigFiles = append(metadata.ConfigFiles, "Cargo.toml")
        metadata.Commands["lint"] = "cargo clippy"
        metadata.Commands["test"] = "cargo test"
    } else if s.fileExists(projectRoot + "/Makefile") {
        metadata.ProjectType = "make"
        metadata.ConfigFiles = append(metadata.ConfigFiles, "Makefile")
        metadata.Commands["lint"] = "make lint"
        metadata.Commands["test"] = "make test"
    } else {
        metadata.ProjectType = "unknown"
    }

    return metadata, nil
}

func (s *CCToolsServer) executeValidator(name, command, projectRoot string, timeoutMs int32) *pb.ValidationResult {
    startTime := time.Now()

    // Parse command
    parts := strings.Fields(command)
    if len(parts) == 0 {
        return &pb.ValidationResult{
            Validator:       name,
            Success:        false,
            Error:          "Empty command",
            ExecutionTimeMs: time.Since(startTime).Milliseconds(),
        }
    }

    // Create command with timeout
    timeout := time.Duration(timeoutMs) * time.Millisecond
    if timeout == 0 {
        timeout = 30 * time.Second // Default timeout
    }

    ctx, cancel := context.WithTimeout(context.Background(), timeout)
    defer cancel()

    cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
    cmd.Dir = projectRoot

    output, err := cmd.CombinedOutput()

    success := err == nil
    errorMsg := ""
    if err != nil {
        errorMsg = err.Error()
    }

    return &pb.ValidationResult{
        Validator:       name,
        Success:        success,
        Output:         string(output),
        Error:          errorMsg,
        ExecutionTimeMs: time.Since(startTime).Milliseconds(),
    }
}

func (s *CCToolsServer) fileExists(filepath string) bool {
    _, err := os.Stat(filepath)
    return err == nil
}

func (s *CCToolsServer) isProcessAlive(pid int32) bool {
    // Simple check - in production would be more robust
    process, err := os.FindProcess(int(pid))
    if err != nil {
        return false
    }
    return process.Signal(nil) == nil
}

