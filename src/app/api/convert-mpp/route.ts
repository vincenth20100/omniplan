import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

        // Real implementation would go here.
        // For example, calling an external service or a local Java process.

        // Since we don't have a converter, return 501.
        return NextResponse.json(
            {
                error: 'Server-side MPP conversion is not configured.',
                details: 'To enable MPP import, you must configure a conversion service (e.g. MPXJ) in this API route.'
            },
            { status: 501 }
        );

    } catch (error) {
        console.error('Error in convert-mpp:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
