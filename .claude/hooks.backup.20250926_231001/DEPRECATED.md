# Deprecated Hooks - DevFlow Context7 Migration

**Date**: 2025-09-24
**Reason**: Context7 consolidation and conflict resolution

## IMMEDIATELY DEPRECATED (Remove)

### 1. Test Hooks (Development/Debug Only)
- `test-posttooluse.py` - Test hook, not needed in production
- `test-userprompt-hook.py` - Test hook, not needed in production

### 2. Duplicate/Workaround Implementations
- `memory-stream-workaround.py` - Temporary workaround, replaced by `robust-memory-stream.py`

**Reasoning**: Workaround was created for temporary bug fixes. Robust implementation is now stable.

## DEPRECATION SCHEDULE

### Phase 1 - Immediate (Next 24h)
- Move deprecated files to `.deprecated/` folder
- Update any references to point to current implementations
- Test system functionality

### Phase 2 - Cometa Consolidation (Next Week)
- Audit 11 Cometa hooks for overlaps
- Consolidate into fewer Context7-compliant hooks
- Standardize naming patterns

### Phase 3 - Integration Review (Following Week)
- Review external integration hooks
- Migrate essential functionality to Context7
- Remove obsolete integrations

## FILES TO DEPRECATED NOW

```bash
# Create deprecated folder
mkdir -p .claude/hooks/.deprecated

# Move test hooks
mv .claude/hooks/test-posttooluse.py .claude/hooks/.deprecated/
mv .claude/hooks/test-userprompt-hook.py .claude/hooks/.deprecated/

# Move workaround
mv .claude/hooks/memory-stream-workaround.py .claude/hooks/.deprecated/
```

## IMPACT ASSESSMENT

### Immediate Impact: NONE
- Test hooks not used in production
- Workaround replaced by robust implementation

### Systems Affected: NONE
- No production dependencies on deprecated hooks
- All functionality preserved in current implementations

## ROLLBACK PLAN
If issues arise, files can be restored from `.deprecated/` folder within 48h.

---
**Approved by**: DevFlow Context7 Migration Phase 3
**Review Date**: 2025-09-26