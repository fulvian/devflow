import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads the content of a file.
 * @param filePath The path to the file.
 * @returns The content of the file, or null if the file does not exist.
 */
export async function Read(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Writes content to a file, overwriting it if it exists.
 * Creates the directory if it does not exist.
 * @param filePath The path to the file.
 * @param content The content to write.
 */
export async function Write(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * Edits a file by replacing a specific string.
 * @param filePath The path to the file.
 * @param oldString The string to be replaced.
 * @param newString The string to replace with.
 * @throws An error if the oldString is not found in the file.
 */
export async function Edit(filePath: string, oldString: string, newString: string): Promise<void> {
  const content = await Read(filePath);
  if (content === null) {
    throw new Error(`File not found: ${filePath}`);
  }
  if (!content.includes(oldString)) {
    throw new Error(`String to be replaced not found in ${filePath}`);
  }
  const updatedContent = content.replace(oldString, newString);
  await Write(filePath, updatedContent);
}

export interface FileEdit {
  oldString: string;
  newString: string;
}

/**
 * Performs multiple edits on a single file.
 * @param filePath The path to the file.
 * @param edits An array of edits to be performed.
 */
export async function MultiEdit(filePath: string, edits: FileEdit[]): Promise<void> {
  let content = await Read(filePath);
  if (content === null) {
    throw new Error(`File not found: ${filePath}`);
  }
  for (const edit of edits) {
    if (!content.includes(edit.oldString)) {
      throw new Error(`String to be replaced not found in ${filePath}: "${edit.oldString}"`);
    }
    content = content.replace(edit.oldString, edit.newString);
  }
  await Write(filePath, content);
}
