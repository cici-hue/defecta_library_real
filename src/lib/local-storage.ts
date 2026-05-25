/**
 * Local File Storage
 * 本地文件存储，用于开发测试环境
 */

import { promises as fs } from "fs";
import { join } from "path";

// 存储目录
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || "./uploads";

// 确保存储目录存在
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

/**
 * 上传文件到本地存储
 */
export async function uploadFileLocal(options: {
  fileContent: Buffer;
  fileName: string;
  contentType?: string;
}): Promise<string> {
  await ensureStorageDir();

  // 生成唯一文件名
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const safeFileName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueName = `${timestamp}-${random}-${safeFileName}`;
  
  // 按日期分子目录
  const date = new Date();
  const subDir = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const dirPath = join(STORAGE_DIR, subDir);
  
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }

  const filePath = join(dirPath, uniqueName);
  await fs.writeFile(filePath, options.fileContent);

  // 返回相对路径作为 fileKey
  return join(subDir, uniqueName);
}

/**
 * 从本地存储读取文件
 */
export async function readFileLocal(fileKey: string): Promise<Buffer> {
  const filePath = join(STORAGE_DIR, fileKey);
  
  // 安全检查：确保文件在存储目录内
  const resolvedPath = await fs.realpath(filePath);
  const resolvedStorageDir = await fs.realpath(STORAGE_DIR);
  
  if (!resolvedPath.startsWith(resolvedStorageDir)) {
    throw new Error("Invalid file key: path traversal detected");
  }

  return fs.readFile(filePath);
}

/**
 * 删除本地文件
 */
export async function deleteFileLocal(fileKey: string): Promise<void> {
  const filePath = join(STORAGE_DIR, fileKey);
  
  // 安全检查
  const resolvedPath = await fs.realpath(filePath);
  const resolvedStorageDir = await fs.realpath(STORAGE_DIR);
  
  if (!resolvedPath.startsWith(resolvedStorageDir)) {
    throw new Error("Invalid file key: path traversal detected");
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    // 文件不存在时忽略错误
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExistsLocal(fileKey: string): Promise<boolean> {
  try {
    const filePath = join(STORAGE_DIR, fileKey);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
