import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, language } = body;

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        if (!language || !["python", "javascript"].includes(language)) {
            return NextResponse.json(
                { error: "Language must be 'python' or 'javascript'" },
                { status: 400 }
            );
        }

        const result = await executeCode(code, language);
        return NextResponse.json(result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

async function executeCode(
    code: string,
    language: "python" | "javascript"
): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    error?: string;
    executionTime: number;
}> {
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds

    // Create a temporary file for the code
    const tmpDir = os.tmpdir();
    const fileExt = language === "python" ? "py" : "js";
    const fileName = `cowork_exec_${Date.now()}.${fileExt}`;
    const filePath = path.join(tmpDir, fileName);

    try {
        // Write code to temp file
        await writeFile(filePath, code, "utf-8");

        // Execute the file
        const command = language === "python"
            ? `python3 "${filePath}"`
            : `node "${filePath}"`;

        const { stdout, stderr } = await execAsync(command, {
            timeout,
            maxBuffer: 1024 * 1024, // 1MB buffer
            env: {
                ...process.env,
                PYTHONDONTWRITEBYTECODE: "1",
                NODE_OPTIONS: "--max-old-space-size=256",
            },
        });

        return {
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime: Date.now() - startTime,
        };
    } catch (error: unknown) {
        const execError = error as { stderr?: string; message?: string; killed?: boolean };
        const executionTime = Date.now() - startTime;

        if (execError.killed) {
            return {
                success: false,
                stdout: "",
                stderr: "",
                error: "Execution timed out after 30 seconds",
                executionTime,
            };
        }

        return {
            success: false,
            stdout: "",
            stderr: execError.stderr || "",
            error: execError.message || "Execution failed",
            executionTime,
        };
    } finally {
        // Clean up temp file
        try {
            await unlink(filePath);
        } catch {
            // Ignore cleanup errors
        }
    }
}
