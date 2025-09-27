CC‑Tools Integrazione Produzione — Piano di Test

Fase 1: Setup
- Env: `export CC_TOOLS_USE_DEBUG=true` (reflection on), `export GRPC_PORT=50051`.
- Build (se serve):
  - `cd go-server && go build -o cc-tools-server .`
  - `go build -tags debug -o cc-tools-server-debug .`

Fase 2: Avvio Sistema
- `./devflow-start.sh` (usa binario debug se CC_TOOLS_USE_DEBUG=true)
- `./devflow-start.sh status` → verifica “CC-Tools gRPC Server: Running (Port 50051)”
- Porta: `lsof -i :50051`, `nc -zv localhost 50051`

Fase 3: Test gRPC base
- Reflection: `grpcurl -plaintext localhost:50051 list`
- Metadata: `grpcurl -plaintext localhost:50051 cc_tools_integration.CCToolsIntegration/GetProjectMetadata -d '{"project_root":"/path/progetto","hook_type":"pre-commit"}'`

Fase 4: Validazione Progetti
- `grpcurl -plaintext localhost:50051 cc_tools_integration.CCToolsIntegration/ValidateProject -d '{"project_root":"/path/progetto","hook_type":"pre-commit","timeout_ms":15000}'`

Fase 5: Client Python
- Install: `pip install grpcio grpcio-tools grpcio-reflection`
- Stub: `python -m grpc_tools.protoc -I go-server/proto --python_out=src/grpc --grpc_python_out=src/grpc go-server/proto/cc_tools_integration.proto`
- Test: `./test_grpc_client.py`

Fase 6: Hook Integration
- PreToolUse: `echo '{"hook_event_name":"PreToolUse",...}' | python .claude/hooks/cc-tools-integration.py`
- PostToolUse: idem
- Log: `tail -f logs/cc-tools-server.log`

Comandi Rapidi (CLI helper)
- List: `scripts/cc-tools-cli.sh list --auto-start`
- Metadata: `scripts/cc-tools-cli.sh metadata --project-root /path/progetto --auto-start`
- Validate: `scripts/cc-tools-cli.sh validate --project-root /path/progetto --timeout-ms 15000 --auto-start`

Troubleshooting
- Debug end‑to‑end: `./debug_cc_tools.sh`
- Verifica porta: `lsof -i :50051`, `nc -z localhost 50051`
- Reflection solo in debug: rimuovere `CC_TOOLS_USE_DEBUG` per profilo prod “strict”.

