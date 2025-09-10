# Orchestration System API Documentation

## Overview
The Orchestration System provides a comprehensive RESTful API for managing workflows, tasks, and execution monitoring.

## Authentication
All API requests require a valid API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Base URL
```
https://api.orchestration-system.com/v1
```

## Workflows

### Create Workflow
Creates a new workflow definition.

**Endpoint:** `POST /workflows`

**Request Body:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "tasks": [
    {
      "name": "string",
      "type": "string",
      "config": "object (optional)",
      "dependsOn": ["string"] (optional)
    }
  ]
}
```

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "status": "draft|active|inactive",
  "createdAt": "ISO8601 datetime",
  "updatedAt": "ISO8601 datetime"
}
```

**Example:**
```bash
curl -X POST https://api.orchestration-system.com/v1/workflows \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Processing Pipeline",
    "tasks": [
      { "name": "extract", "type": "data-extraction" },
      { "name": "transform", "type": "data-transformation", "dependsOn": ["extract"] },
      { "name": "load", "type": "data-loading", "dependsOn": ["transform"] }
    ]
  }'
```

### Get Workflow
Retrieves a workflow by ID.

**Endpoint:** `GET /workflows/{workflowId}`

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "tasks": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "config": "object",
      "dependsOn": ["string"],
      "status": "pending|running|completed|failed"
    }
  ],
  "status": "draft|active|inactive",
  "createdAt": "ISO8601 datetime",
  "updatedAt": "ISO8601 datetime"
}
```

### List Workflows
Lists all workflows with optional filtering.

**Endpoint:** `GET /workflows`

**Query Parameters:**
- `status` (optional): Filter by workflow status
- `limit` (optional, default: 50): Number of results to return
- `offset` (optional, default: 0): Number of results to skip

**Response:**
```json
{
  "workflows": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "status": "draft|active|inactive",
      "createdAt": "ISO8601 datetime",
      "updatedAt": "ISO8601 datetime"
    }
  ],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

### Update Workflow
Updates an existing workflow.

**Endpoint:** `PUT /workflows/{workflowId}`

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "tasks": [
    {
      "name": "string",
      "type": "string",
      "config": "object (optional)",
      "dependsOn": ["string"] (optional)
    }
  ]
}
```

### Delete Workflow
Deletes a workflow.

**Endpoint:** `DELETE /workflows/{workflowId}`

**Response:**
```json
{
  "success": true
}
```

## Executions

### Execute Workflow
Starts a new execution of a workflow.

**Endpoint:** `POST /workflows/{workflowId}/execute`

**Request Body:**
```json
{
  "parameters": "object (optional)"
}
```

**Response:**
```json
{
  "executionId": "string",
  "status": "started",
  "startedAt": "ISO8601 datetime"
}
```

### Get Execution
Retrieves the status and details of a workflow execution.

**Endpoint:** `GET /executions/{executionId}`

**Response:**
```json
{
  "id": "string",
  "workflowId": "string",
  "status": "pending|running|completed|failed|cancelled",
  "startedAt": "ISO8601 datetime",
  "completedAt": "ISO8601 datetime (optional)",
  "tasks": [
    {
      "id": "string",
      "name": "string",
      "status": "pending|running|completed|failed",
      "startedAt": "ISO8601 datetime (optional)",
      "completedAt": "ISO8601 datetime (optional)",
      "result": "object (optional)"
    }
  ]
}
```

### List Executions
Lists executions with optional filtering.

**Endpoint:** `GET /executions`

**Query Parameters:**
- `workflowId` (optional): Filter by workflow ID
- `status` (optional): Filter by execution status
- `limit` (optional, default: 50): Number of results to return
- `offset` (optional, default: 0): Number of results to skip

## Schedules

### Create Schedule
Creates a new schedule for recurring workflow execution.

**Endpoint:** `POST /schedules`

**Request Body:**
```json
{
  "workflowId": "string",
  "cronExpression": "string",
  "timezone": "string (optional, default: UTC)",
  "parameters": "object (optional)"
}
```

**Response:**
```json
{
  "id": "string",
  "workflowId": "string",
  "cronExpression": "string",
  "timezone": "string",
  "nextRunAt": "ISO8601 datetime",
  "createdAt": "ISO8601 datetime"
}
```

### Get Schedule
Retrieves a schedule by ID.

**Endpoint:** `GET /schedules/{scheduleId}`

### List Schedules
Lists all schedules.

**Endpoint:** `GET /schedules`

### Delete Schedule
Deletes a schedule.

**Endpoint:** `DELETE /schedules/{scheduleId}`
