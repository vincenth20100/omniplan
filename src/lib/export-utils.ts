import { Task, ColumnSpec, Assignment, Resource, ProjectState, Link } from './types';
import { getTaskPropertyValue } from './task-utils';
import * as XLSX from 'xlsx';

function prepareData(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[]
) {
    const resourceMap = new Map(resources.map(r => [r.id, r.name]));

    // Get visible columns objects in order
    const visibleColumns = visibleColumnIds
        .map(id => columns.find(c => c.id === id))
        .filter((c): c is ColumnSpec => !!c);

    const header = visibleColumns.map(c => c.name);

    const data = tasks.map(task => {
        return visibleColumns.map(col => {
            return getTaskPropertyValue(task, col.id, columns, assignments, resourceMap);
        });
    });

    return { header, data };
}

export function exportToCSV(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[],
    filename: string
) {
    const { header, data } = prepareData(tasks, columns, visibleColumnIds, assignments, resources);

    const escapeCsv = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    };

    const csvContent = [
        header.map(escapeCsv).join(','),
        ...data.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportToExcel(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[],
    filename: string
) {
    const { header, data } = prepareData(tasks, columns, visibleColumnIds, assignments, resources);

    const worksheetData = [header, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

    XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// --- MS Project XML Export ---

function formatDateXML(date: Date): string {
    return date.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
}

function formatDurationXML(days: number): string {
    return `PT${days * 8}H0M0S`; // Assuming 8h days
}

export function generateProjectXML(project: ProjectState): string {
    // Basic UID mapping
    let uidCounter = 1;
    const uidMap = new Map<string, number>();
    const getUid = (id: string) => {
        if (!uidMap.has(id)) uidMap.set(id, uidCounter++);
        return uidMap.get(id);
    };

    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
    <Title>Exported Project</Title>
    <StartDate>${formatDateXML(project.tasks[0]?.start || new Date())}</StartDate>
    <FinishDate>${formatDateXML(project.tasks[0]?.finish || new Date())}</FinishDate>
    <CalendarUID>1</CalendarUID>
    <Calendars>
        <Calendar>
            <UID>1</UID>
            <Name>Standard</Name>
            <IsBaseCalendar>1</IsBaseCalendar>
            <WeekDays>
                <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
                <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
                <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
                <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
                <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
                <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
                <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
            </WeekDays>
        </Calendar>
    </Calendars>
    <Resources>
`;

    project.resources.forEach(res => {
        xml += `        <Resource>
            <UID>${getUid(res.id)}</UID>
            <Name>${escapeXML(res.name)}</Name>
            <Type>0</Type>
            <MaxUnits>1.0</MaxUnits>
        </Resource>
`;
    });
    xml += `    </Resources>
    <Tasks>
`;

    // Map Tasks
    project.tasks.forEach((task) => {
        const uid = getUid(task.id);
        const preds = project.links.filter(l => l.target === task.id);

        xml += `        <Task>
            <UID>${uid}</UID>
            <Name>${escapeXML(task.name)}</Name>
            <Start>${formatDateXML(task.start)}</Start>
            <Finish>${formatDateXML(task.finish)}</Finish>
            <Duration>${formatDurationXML(task.duration)}</Duration>
            <PercentComplete>${task.percentComplete}</PercentComplete>
            <Summary>${task.isSummary ? '1' : '0'}</Summary>
            <OutlineLevel>${(task.level || 0) + 1}</OutlineLevel>
`;
        preds.forEach(l => {
            let type = 1; // FS default in MSP is 1?
            // Correct MSP XML Predecessor Types:
            // 1 = FF
            // 2 = FS (Finish-to-Start) - Standard Default
            // 3 = SF
            // 4 = SS
            // Wait, I used different mapping in Import. Let's check online or standard.
            // Documentation says: 0=FF, 1=FS, 2=SF, 3=SS.  Let's trust my previous research or verify.
            // XML schema:
            // Type: The type of the link.
            // Values: 0=FF, 1=FS, 2=SF, 3=SS.

            if (l.type === 'FS') type = 1;
            if (l.type === 'SS') type = 3;
            if (l.type === 'FF') type = 0;
            if (l.type === 'SF') type = 2;

            xml += `            <PredecessorLink>
                <PredecessorUID>${getUid(l.source)}</PredecessorUID>
                <Type>${type}</Type>
            </PredecessorLink>
`;
        });

        xml += `        </Task>
`;
    });

    xml += `    </Tasks>
    <Assignments>
`;

    project.assignments.forEach(asn => {
        xml += `        <Assignment>
            <UID>${getUid(asn.id)}</UID>
            <TaskUID>${getUid(asn.taskId)}</TaskUID>
            <ResourceUID>${getUid(asn.resourceId)}</ResourceUID>
            <Units>${(asn.units || 100) / 100}</Units>
        </Assignment>
`;
    });

    xml += `    </Assignments>
</Project>`;

    return xml;
}

function escapeXML(str: string): string {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}


// --- Primavera P6 XER Export ---

export function generatePrimaveraXER(project: ProjectState): string {
    const lines: string[] = [];
    lines.push('ERMHDR\t5.0\t0'); // Version 5.0 header or similar

    // Helper to generate integer IDs
    let idCounter = 1000;
    const intIdMap = new Map<string, string>();
    const getIntId = (id: string) => {
        if (!intIdMap.has(id)) intIdMap.set(id, (idCounter++).toString());
        return intIdMap.get(id)!;
    };

    const projId = getIntId('project-root');

    // PROJECT table
    lines.push('%T\tPROJECT');
    lines.push('%F\tproj_id\tproj_short_name\tclndr_id\tdef_cost_qty_link_flag\tdef_duration_type_id\tdef_pct_complete_type_id\tdef_rate_type\tproj_url');
    lines.push(`%R\t${projId}\tExportedProject\t1\tN\tDT_FixedDur\tPCT_Duration\tRT_PriceUnit\t`);

    // CALENDAR (Basic)
    lines.push('%T\tCALENDAR');
    lines.push('%F\tclndr_id\tclndr_name\tproj_id');
    lines.push(`%R\t1\tStandard\t${projId}`);

    // PROJWBS (WBS)
    // Create a root WBS
    const wbsId = getIntId('wbs-root');
    lines.push('%T\tPROJWBS');
    lines.push('%F\twbs_id\tproj_id\twbs_short_name\twbs_name\tparent_wbs_id');
    lines.push(`%R\t${wbsId}\t${projId}\tPROJ\tProject WBS\t`);

    // In P6, all tasks must belong to a WBS. We assign all to root WBS for simplicity,
    // or replicate hierarchy if tasks are summaries.
    // Simpler: Just link all tasks to root WBS.
    // High fidelity export would require mapping task hierarchy to WBS hierarchy.

    // TASK
    lines.push('%T\tTASK');
    lines.push('%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tstatus_code\ttask_type');

    project.tasks.forEach(task => {
        const tId = getIntId(task.id);
        const start = task.start.toISOString().replace('T', ' ').substring(0, 19);
        const finish = task.finish.toISOString().replace('T', ' ').substring(0, 19);
        const durHrs = task.duration * 8;
        const status = task.percentComplete === 100 ? 'TK_Done' : (task.percentComplete > 0 ? 'TK_Active' : 'TK_NotStart');

        lines.push(`%R\t${tId}\t${projId}\t${wbsId}\t1\t${tId}\t${task.name}\t${start}\t${finish}\t${durHrs}\t${status}\tTT_Task`);
    });

    // TASKPRED
    lines.push('%T\tTASKPRED');
    lines.push('%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tpred_lag_drtn_hr_cnt');

    project.links.forEach(link => {
        const linkId = getIntId(link.id);
        const succId = getIntId(link.target);
        const predId = getIntId(link.source);

        let type = 'PR_FS';
        if (link.type === 'SS') type = 'PR_SS';
        if (link.type === 'FF') type = 'PR_FF';
        if (link.type === 'SF') type = 'PR_SF';

        lines.push(`%R\t${linkId}\t${succId}\t${predId}\t${type}\t0.0`);
    });

    // RSRC
    lines.push('%T\tRSRC');
    lines.push('%F\trsrc_id\trsrc_short_name\trsrc_name\trsrc_type');

    project.resources.forEach(res => {
        const rId = getIntId(res.id);
        lines.push(`%R\t${rId}\t${res.name.substring(0, 10)}\t${res.name}\tRT_Labor`);
    });

    // TASKRSRC
    lines.push('%T\tTASKRSRC');
    lines.push('%F\ttaskrsrc_id\ttask_id\trsrc_id\ttarget_qty\ttarget_cost');

    project.assignments.forEach(asn => {
        const trId = getIntId(asn.id);
        const tId = getIntId(asn.taskId);
        const rId = getIntId(asn.resourceId);
        lines.push(`%R\t${trId}\t${tId}\t${rId}\t${(asn.units || 100) / 100}\t0.0`);
    });

    return lines.join('\n');
}

export function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
