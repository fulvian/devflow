import { StdioServerTransport, Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.env.DEVFLOW_PROJECT_ROOT || process.cwd();

function resolveSafe(p: string): string {
  const abs = path.resolve(PROJECT_ROOT, p);
  const root = path.resolve(PROJECT_ROOT);
  if (!abs.startsWith(root)) {
    throw new Error(`Percorso non consentito fuori dal progetto: ${p}`);
  }
  return abs;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function toolFsRead({ filePath }: { filePath: string }) {
  const abs = resolveSafe(filePath);
  const data = await fs.readFile(abs, "utf8");
  return { path: abs, content: data };
}

async function toolFsWrite({ filePath, content, createDirs, overwrite }: { filePath: string; content: string; createDirs?: boolean; overwrite?: boolean; }) {
  const abs = resolveSafe(filePath);
  if (createDirs) await ensureDir(path.dirname(abs));
  if (!overwrite) {
    try { await fs.access(abs); throw new Error("File esistente: impostare overwrite:true per sovrascrivere"); } catch { /* ok if not exists */ }
  }
  await fs.writeFile(abs, content, "utf8");
  return { path: abs, bytes: Buffer.byteLength(content, "utf8") };
}

async function toolFsDelete({ targetPath, recursive }: { targetPath: string; recursive?: boolean }) {
  const abs = resolveSafe(targetPath);
  await fs.rm(abs, { recursive: !!recursive, force: true });
  return { path: abs, deleted: true };
}

async function toolFsMkdir({ dirPath, recursive }: { dirPath: string; recursive?: boolean }) {
  const abs = resolveSafe(dirPath);
  await fs.mkdir(abs, { recursive: !!recursive });
  return { path: abs, created: true };
}

async function toolShellExec({ command, args, cwd, timeoutMs }: { command: string; args?: string[]; cwd?: string; timeoutMs?: number; }) {
  const execCwd = cwd ? resolveSafe(cwd) : PROJECT_ROOT;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args ?? [], { cwd: execCwd, shell: false });
    let stdout = ""; let stderr = "";
    let timedOut = false;
    const to = timeoutMs ? setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs) : null;
    child.stdout.on("data", d => { stdout += d.toString(); });
    child.stderr.on("data", d => { stderr += d.toString(); });
    child.on("error", err => { if (to) clearTimeout(to); reject(err); });
    child.on("close", code => { if (to) clearTimeout(to); resolve({ code, stdout, stderr, cwd: execCwd, timedOut }); });
  });
}

async function main() {
  const transport = new StdioServerTransport();
  const server = new Server({ name: "devflow-ops", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.tool(
    {
      name: "fs_read",
      description: "Legge un file dal progetto (UTF-8)",
      inputSchema: z.object({ filePath: z.string() })
    },
    async (input) => toolFsRead(input)
  );

  server.tool(
    {
      name: "fs_write",
      description: "Scrive/sovrascrive un file nel progetto",
      inputSchema: z.object({
        filePath: z.string(),
        content: z.string(),
        createDirs: z.boolean().optional(),
        overwrite: z.boolean().optional()
      })
    },
    async (input) => toolFsWrite(input)
  );

  server.tool(
    {
      name: "fs_delete",
      description: "Cancella file o directory nel progetto",
      inputSchema: z.object({ targetPath: z.string(), recursive: z.boolean().optional() })
    },
    async (input) => toolFsDelete(input)
  );

  server.tool(
    {
      name: "fs_mkdir",
      description: "Crea directory nel progetto",
      inputSchema: z.object({ dirPath: z.string(), recursive: z.boolean().optional() })
    },
    async (input) => toolFsMkdir(input)
  );

  server.tool(
    {
      name: "shell_exec",
      description: "Esegue un comando shell nel progetto",
      inputSchema: z.object({
        command: z.string(),
        args: z.array(z.string()).optional(),
        cwd: z.string().optional(),
        timeoutMs: z.number().optional()
      })
    },
    async (input) => toolShellExec(input)
  );

  await server.connect(transport);
}

main().catch((err) => {
  console.error("devflow-ops MCP server error:", err);
  process.exit(1);
});

