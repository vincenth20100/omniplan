import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    let tempPath: string | null = null;
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const isMock = request.nextUrl.searchParams.get('mock') === 'true';

        if (isMock) {
            // Return a dummy XML for testing
            const dummyXML = `
                <Project>
                    <Title>Mock Project</Title>
                    <Tasks>
                        <Task>
                            <UID>1</UID>
                            <Name>Converted Task 1</Name>
                            <Start>${new Date().toISOString()}</Start>
                            <Finish>${new Date(Date.now() + 86400000).toISOString()}</Finish>
                            <Duration>PT8H0M0S</Duration>
                        </Task>
                        <Task>
                            <UID>2</UID>
                            <Name>Converted Task 2</Name>
                            <Start>${new Date().toISOString()}</Start>
                            <Finish>${new Date(Date.now() + 86400000).toISOString()}</Finish>
                            <Duration>PT8H0M0S</Duration>
                        </Task>
                    </Tasks>
                </Project>
            `;
            return new NextResponse(dummyXML, {
                headers: { 'Content-Type': 'application/xml' }
            });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Sanitize filename to prevent directory traversal or weird chars issues in shell
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        tempPath = join(tmpdir(), `upload-${Date.now()}-${sanitizedName}`);
        await writeFile(tempPath, buffer);

        // Assume scripts/convert_project.py is in the project root.
        const scriptPath = join(process.cwd(), 'scripts', 'convert_project.py');

        // Command execution
        // We assume python3 is available in the path.
        const command = `python3 "${scriptPath}" "${tempPath}"`;

        try {
            // Increase maxBuffer to 10MB just in case XML is large
            // Set PYTHONPATH to include locally installed python_modules
            const pythonModulesPath = join(process.cwd(), 'python_modules');
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 1024 * 1024 * 10,
                env: { ...process.env, PYTHONPATH: pythonModulesPath }
            });

            // Basic validation
            if (!stdout || !stdout.trim().startsWith('<')) {
                console.error("Conversion failed:", stderr);
                throw new Error(stderr || "Conversion produced no output");
            }

            return new NextResponse(stdout, {
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, "")}.xml"`
                }
            });

        } catch (execError: any) {
             console.error('Execution error:', execError);
             const stderr = execError.stderr || execError.message;

             // Detect missing python modules or python itself
             if (stderr.includes('Missing required modules') || stderr.includes('ModuleNotFoundError') || stderr.includes('not found')) {
                 return NextResponse.json(
                    {
                        error: 'Server configuration error',
                        details: 'Python environment or dependencies (jpype1, mpxj) are missing/misconfigured.'
                    },
                    { status: 501 }
                );
             }

             return NextResponse.json(
                 { error: 'Conversion failed', details: stderr },
                 { status: 500 }
             );
        }

    } catch (error: any) {
        console.error('Error in convert-project:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    } finally {
        if (tempPath) {
            try {
                await unlink(tempPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}
