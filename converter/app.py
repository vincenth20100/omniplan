import os
import sys
import jpype
import jpype.imports
import mpxj
import pandas as pd
from flask import Flask, request, jsonify, send_file, render_template_string
import tempfile
import json

app = Flask(__name__)

JVM_ERROR = None
STARTUP_LOG = []

def log(msg):
    print(msg, flush=True)
    STARTUP_LOG.append(msg)

# --- JVM STARTUP ---
if not jpype.isJVMStarted():
    try:
        java_home = os.environ.get("JAVA_HOME")
        log(f"[STARTUP] JAVA_HOME = {java_home}")

        if not java_home or not os.path.exists(java_home):
            for path in [
                "/usr/lib/jvm/java-21-openjdk-amd64",
                "/usr/lib/jvm/java-17-openjdk-amd64",
                "/usr/lib/jvm/java-11-openjdk-amd64",
                "/usr/lib/jvm/default-java"
            ]:
                if os.path.exists(path):
                    os.environ["JAVA_HOME"] = path
                    log(f"[STARTUP] Auto-detected JAVA_HOME: {path}")
                    break

        jars = []
        fallback_jar_dir = "/app/jars"
        if os.path.exists(fallback_jar_dir):
            for file in os.listdir(fallback_jar_dir):
                if file.endswith('.jar'):
                    jars.append(os.path.join(fallback_jar_dir, file))

        mpxj_path = os.path.dirname(mpxj.__file__)
        for root, dirs, files in os.walk(mpxj_path):
            for file in files:
                if file.endswith('.jar'):
                    full_path = os.path.join(root, file)
                    if full_path not in jars:
                        jars.append(full_path)

        if not jars:
            raise Exception("No JAR files found anywhere.")

        log(f"[STARTUP] Starting JVM with {len(jars)} JARs")
        jpype.startJVM(classpath=jars)

        from net.sf.mpxj.reader import UniversalProjectReader
        log("[STARTUP] SUCCESS: JVM started and net.sf.mpxj loaded!")

    except Exception as e:
        import traceback
        log(f"[STARTUP] CRITICAL ERROR: {e}")
        log(traceback.format_exc())
        JVM_ERROR = str(e)


def safe_str(val):
    """Safely convert Java objects to string"""
    if val is None:
        return ""
    try:
        return str(val)
    except:
        return ""


def extract_full_project(file_path):
    """Extract all data from an MPP file"""
    from net.sf.mpxj.reader import UniversalProjectReader

    reader = UniversalProjectReader()
    project = reader.read(file_path)

    result = {
        "project_info": {},
        "tasks": [],
        "resources": [],
        "assignments": [],
        "calendars": [],
        "predecessors": [],
    }

    # --- PROJECT INFO ---
    props = project.getProjectProperties()
    if props:
        result["project_info"] = {
            "Project Title": safe_str(props.getProjectTitle()),
            "Subject": safe_str(props.getSubject()),
            "Author": safe_str(props.getAuthor()),
            "Manager": safe_str(props.getManager()),
            "Company": safe_str(props.getCompany()),
            "Category": safe_str(props.getCategory()),
            "Keywords": safe_str(props.getKeywords()),
            "Comments": safe_str(props.getComments()),
            "Start Date": safe_str(props.getStartDate()),
            "Finish Date": safe_str(props.getFinishDate()),
            "Current Date": safe_str(props.getCurrentDate()),
            "Status Date": safe_str(props.getStatusDate()),
            "Calendar Name": safe_str(props.getDefaultCalendarName()),
            "Currency Symbol": safe_str(props.getCurrencySymbol()),
            "Creation Date": safe_str(props.getCreationDate()),
            "Last Saved": safe_str(props.getLastSaved()),
            "Revision": safe_str(props.getRevision()),
            "Schedule From": safe_str(props.getScheduleFrom()),
            "Minutes Per Day": safe_str(props.getMinutesPerDay()),
            "Minutes Per Week": safe_str(props.getMinutesPerWeek()),
            "Days Per Month": safe_str(props.getDaysPerMonth()),
        }

    # --- TASKS ---
    for task in project.getTasks():
        if task.getID() is None:
            continue

        # Get predecessors for this task
        preds = []
        predecessors = task.getPredecessors()
        if predecessors:
            for pred in predecessors:
                source_task = pred.getSourceTask()
                if source_task:
                    preds.append({
                        "predecessor_id": safe_str(source_task.getID()),
                        "predecessor_name": safe_str(source_task.getName()),
                        "type": safe_str(pred.getType()),
                        "lag": safe_str(pred.getLag()),
                    })
                    result["predecessors"].append({
                        "Task ID": safe_str(task.getID()),
                        "Task Name": safe_str(task.getName()),
                        "Predecessor ID": safe_str(source_task.getID()),
                        "Predecessor Name": safe_str(source_task.getName()),
                        "Type": safe_str(pred.getType()),
                        "Lag": safe_str(pred.getLag()),
                    })

        # Get resource assignments for this task
        assigned_resources = []
        assignments = task.getResourceAssignments()
        if assignments:
            for assignment in assignments:
                resource = assignment.getResource()
                if resource:
                    assigned_resources.append(safe_str(resource.getName()))

        # Get notes
        notes = ""
        try:
            notes_obj = task.getNotes()
            if notes_obj:
                notes = safe_str(notes_obj)
        except:
            pass

        task_data = {
            "ID": safe_str(task.getID()),
            "Unique ID": safe_str(task.getUniqueID()),
            "WBS": safe_str(task.getWBS()),
            "Outline Level": safe_str(task.getOutlineLevel()),
            "Task Name": safe_str(task.getName()),
            "Duration": safe_str(task.getDuration()),
            "Start": safe_str(task.getStart()),
            "Finish": safe_str(task.getFinish()),
            "Actual Start": safe_str(task.getActualStart()),
            "Actual Finish": safe_str(task.getActualFinish()),
            "% Complete": safe_str(task.getPercentageComplete()),
            "% Work Complete": safe_str(task.getPercentageWorkComplete()),
            "Work": safe_str(task.getWork()),
            "Actual Work": safe_str(task.getActualWork()),
            "Remaining Work": safe_str(task.getRemainingWork()),
            "Cost": safe_str(task.getCost()),
            "Actual Cost": safe_str(task.getActualCost()),
            "Remaining Cost": safe_str(task.getRemainingCost()),
            "Baseline Start": safe_str(task.getBaselineStart()),
            "Baseline Finish": safe_str(task.getBaselineFinish()),
            "Baseline Duration": safe_str(task.getBaselineDuration()),
            "Baseline Work": safe_str(task.getBaselineWork()),
            "Baseline Cost": safe_str(task.getBaselineCost()),
            "Priority": safe_str(task.getPriority()),
            "Milestone": safe_str(task.getMilestone()),
            "Summary": safe_str(task.getSummary()),
            "Critical": safe_str(task.getCritical()),
            "Constraint Type": safe_str(task.getConstraintType()),
            "Constraint Date": safe_str(task.getConstraintDate()),
            "Deadline": safe_str(task.getDeadline()),
            "Type": safe_str(task.getType()),
            "Free Slack": safe_str(task.getFreeSlack()),
            "Total Slack": safe_str(task.getTotalSlack()),
            "Early Start": safe_str(task.getEarlyStart()),
            "Early Finish": safe_str(task.getEarlyFinish()),
            "Late Start": safe_str(task.getLateStart()),
            "Late Finish": safe_str(task.getLateFinish()),
            "Resources": ", ".join(assigned_resources),
            "Predecessors": "; ".join([f"{p['predecessor_id']}({p['type']})" for p in preds]),
            "Notes": notes,
        }

        # Try to get custom text fields (Text1 through Text10)
        for i in range(1, 11):
            try:
                from net.sf.mpxj import TaskField
                field = getattr(TaskField, f"TEXT{i}", None)
                if field:
                    val = task.getCachedValue(field)
                    if val:
                        task_data[f"Text{i}"] = safe_str(val)
            except:
                pass

        result["tasks"].append(task_data)

    # --- RESOURCES ---
    for resource in project.getResources():
        if resource.getID() is None:
            continue

        resource_data = {
            "ID": safe_str(resource.getID()),
            "Unique ID": safe_str(resource.getUniqueID()),
            "Name": safe_str(resource.getName()),
            "Type": safe_str(resource.getType()),
            "Initials": safe_str(resource.getInitials()),
            "Group": safe_str(resource.getGroup()),
            "Email": safe_str(resource.getEmailAddress()),
            "Max Units": safe_str(resource.getMaxUnits()),
            "Standard Rate": safe_str(resource.getStandardRate()),
            "Overtime Rate": safe_str(resource.getOvertimeRate()),
            "Cost Per Use": safe_str(resource.getCostPerUse()),
            "Work": safe_str(resource.getWork()),
            "Actual Work": safe_str(resource.getActualWork()),
            "Remaining Work": safe_str(resource.getRemainingWork()),
            "Cost": safe_str(resource.getCost()),
            "Actual Cost": safe_str(resource.getActualCost()),
            "Remaining Cost": safe_str(resource.getRemainingCost()),
            "Baseline Work": safe_str(resource.getBaselineWork()),
            "Baseline Cost": safe_str(resource.getBaselineCost()),
            "Calendar": safe_str(resource.getCalendar()),
        }

        # Notes
        try:
            notes_obj = resource.getNotes()
            if notes_obj:
                resource_data["Notes"] = safe_str(notes_obj)
        except:
            pass

        result["resources"].append(resource_data)

    # --- RESOURCE ASSIGNMENTS ---
    for assignment in project.getResourceAssignments():
        task = assignment.getTask()
        resource = assignment.getResource()
        result["assignments"].append({
            "Task ID": safe_str(task.getID()) if task else "",
            "Task Name": safe_str(task.getName()) if task else "",
            "Resource ID": safe_str(resource.getID()) if resource else "",
            "Resource Name": safe_str(resource.getName()) if resource else "",
            "Units": safe_str(assignment.getUnits()),
            "Work": safe_str(assignment.getWork()),
            "Actual Work": safe_str(assignment.getActualWork()),
            "Remaining Work": safe_str(assignment.getRemainingWork()),
            "Start": safe_str(assignment.getStart()),
            "Finish": safe_str(assignment.getFinish()),
            "Actual Start": safe_str(assignment.getActualStart()),
            "Actual Finish": safe_str(assignment.getActualFinish()),
            "Cost": safe_str(assignment.getCost()),
            "Actual Cost": safe_str(assignment.getActualCost()),
        })

    # --- CALENDARS ---
    for calendar in project.getCalendars():
        cal_data = {
            "Name": safe_str(calendar.getName()),
            "Unique ID": safe_str(calendar.getUniqueID()),
            "Type": safe_str(calendar.getCalendarType()) if hasattr(calendar, 'getCalendarType') else "",
        }

        # Get parent calendar
        parent = calendar.getParent()
        if parent:
            cal_data["Parent Calendar"] = safe_str(parent.getName())

        # Get working days info
        days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        from net.sf.mpxj import DayType
        for day_name in days:
            try:
                from java.time import DayOfWeek
                day = getattr(DayOfWeek, day_name, None)
                if day:
                    day_type = calendar.getCalendarDayType(day)
                    cal_data[day_name.capitalize()] = safe_str(day_type)
            except:
                pass

        # Get calendar exceptions
        exceptions = calendar.getCalendarExceptions()
        if exceptions:
            exc_list = []
            for exc in exceptions:
                exc_list.append(f"{safe_str(exc.getFromDate())} to {safe_str(exc.getToDate())}: {safe_str(exc.getName())}")
            cal_data["Exceptions"] = "; ".join(exc_list[:20])  # Limit to 20

        result["calendars"].append(cal_data)

    return result


# --- HTML TEMPLATE ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>OmniPlan Converter</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { padding: 20px; background: #f8f9fa; }
        .container-fluid { max-width: 1400px; }
        .card { margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .table-container { max-height: 500px; overflow: auto; }
        .table th { position: sticky; top: 0; background: #343a40; color: white; z-index: 1; white-space: nowrap; }
        .table td { white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
        .table td:hover { white-space: normal; overflow: visible; }
        .error-banner { background: #ffebee; color: #c62828; padding: 10px; border-radius: 5px; margin-bottom: 20px; display: none; }
        .badge-count { font-size: 0.75em; }
        .project-info td:first-child { font-weight: bold; width: 200px; }
        .nav-pills .nav-link.active { background-color: #198754; }
        #loading { display: none; }
        .stat-card { text-align: center; padding: 15px; }
        .stat-card h3 { margin: 0; color: #198754; }
        .stat-card p { margin: 0; color: #6c757d; font-size: 0.85em; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <h2 class="mb-3">📂 OmniPlan Converter</h2>

        <div id="jvmError" class="error-banner"></div>
        
        <div class="card">
            <div class="card-body">
                <div class="row align-items-end">
                    <div class="col-md-6">
                        <label class="form-label">Upload .mpp file</label>
                        <input type="file" class="form-control" id="fileInput" accept=".mpp,.mpx,.mpt,.xml,.planner,.xer,.pmxml,.schedule_grid,.ppx,.pod,.fts,.gan">
                    </div>
                    <div class="col-md-6 d-flex gap-2 mt-2">
                        <button onclick="analyzeFile()" class="btn btn-primary">🔍 Analyze Full Project</button>
                        <div class="dropdown">
                            <button class="btn btn-success dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                ⬇️ Download As...
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="downloadFile('json')">📄 JSON (full data)</a></li>
                                <li><a class="dropdown-item" href="#" onclick="downloadFile('xml')">📋 MS Project XML</a></li>
                                <li><a class="dropdown-item" href="#" onclick="downloadFile('xlsx')">📊 Excel (all sheets)</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="loading" class="text-center my-4">
            <div class="spinner-border text-primary" role="status"></div>
            <p>Analyzing project file...</p>
        </div>

        <!-- Stats Row -->
        <div id="statsRow" class="row mb-3" style="display:none;">
            <div class="col"><div class="card stat-card"><h3 id="statTasks">0</h3><p>Tasks</p></div></div>
            <div class="col"><div class="card stat-card"><h3 id="statResources">0</h3><p>Resources</p></div></div>
            <div class="col"><div class="card stat-card"><h3 id="statAssignments">0</h3><p>Assignments</p></div></div>
            <div class="col"><div class="card stat-card"><h3 id="statPredecessors">0</h3><p>Dependencies</p></div></div>
            <div class="col"><div class="card stat-card"><h3 id="statCalendars">0</h3><p>Calendars</p></div></div>
        </div>

        <!-- Tab Navigation -->
        <div id="resultArea" style="display:none;">
            <ul class="nav nav-pills mb-3" id="dataTabs" role="tablist">
                <li class="nav-item"><a class="nav-link active" data-bs-toggle="pill" href="#tab-info">📋 Project Info</a></li>
                <li class="nav-item"><a class="nav-link" data-bs-toggle="pill" href="#tab-tasks">📝 Tasks <span class="badge bg-secondary badge-count" id="badgeTasks"></span></a></li>
                <li class="nav-item"><a class="nav-link" data-bs-toggle="pill" href="#tab-resources">👥 Resources <span class="badge bg-secondary badge-count" id="badgeResources"></span></a></li>
                <li class="nav-item"><a class="nav-link" data-bs-toggle="pill" href="#tab-assignments">🔗 Assignments <span class="badge bg-secondary badge-count" id="badgeAssignments"></span></a></li>
                <li class="nav-item"><a class="nav-link" data-bs-toggle="pill" href="#tab-predecessors">↔️ Dependencies <span class="badge bg-secondary badge-count" id="badgePredecessors"></span></a></li>
                <li class="nav-item"><a class="nav-link" data-bs-toggle="pill" href="#tab-calendars">📅 Calendars <span class="badge bg-secondary badge-count" id="badgeCalendars"></span></a></li>
            </ul>

            <div class="tab-content">
                <div class="tab-pane fade show active" id="tab-info"><div class="card"><div class="card-body" id="projectInfoBody"></div></div></div>
                <div class="tab-pane fade" id="tab-tasks"><div class="card"><div class="card-body table-container" id="tasksBody"></div></div></div>
                <div class="tab-pane fade" id="tab-resources"><div class="card"><div class="card-body table-container" id="resourcesBody"></div></div></div>
                <div class="tab-pane fade" id="tab-assignments"><div class="card"><div class="card-body table-container" id="assignmentsBody"></div></div></div>
                <div class="tab-pane fade" id="tab-predecessors"><div class="card"><div class="card-body table-container" id="predecessorsBody"></div></div></div>
                <div class="tab-pane fade" id="tab-calendars"><div class="card"><div class="card-body table-container" id="calendarsBody"></div></div></div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        fetch('/health').then(r => r.json()).then(data => {
            if(data.jvm_error) {
                const banner = document.getElementById('jvmError');
                banner.style.display = 'block';
                banner.innerText = "SERVER ERROR: " + data.jvm_error;
            }
        });

        function buildTable(data, containerId) {
            const container = document.getElementById(containerId);
            if (!data || data.length === 0) {
                container.innerHTML = '<p class="text-muted">No data available</p>';
                return;
            }

            // Get all unique keys, filter out empty columns
            const allKeys = [...new Set(data.flatMap(Object.keys))];
            const keys = allKeys.filter(key => data.some(row => row[key] && row[key] !== "" && row[key] !== "null" && row[key] !== "None"));

            let html = '<table class="table table-striped table-sm table-bordered"><thead><tr>';
            keys.forEach(k => html += `<th>${k}</th>`);
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                keys.forEach(k => {
                    let val = row[k] || '';
                    // Highlight milestones
                    if (k === 'Milestone' && val === 'true') val = '🔷 Yes';
                    if (k === 'Critical' && val === 'true') val = '🔴 Yes';
                    if (k === 'Summary' && val === 'true') val = '📁 Yes';
                    html += `<td title="${val}">${val}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function buildProjectInfo(info) {
            const container = document.getElementById('projectInfoBody');
            if (!info || Object.keys(info).length === 0) {
                container.innerHTML = '<p class="text-muted">No project properties found</p>';
                return;
            }

            let html = '<table class="table table-sm project-info">';
            for (const [key, val] of Object.entries(info)) {
                if (val && val !== "" && val !== "null" && val !== "None") {
                    html += `<tr><td>${key}</td><td>${val}</td></tr>`;
                }
            }
            html += '</table>';
            container.innerHTML = html;
        }

        async function analyzeFile() {
            const file = document.getElementById('fileInput').files[0];
            if (!file) return alert("Please select a file first!");
            
            document.getElementById('loading').style.display = 'block';
            document.getElementById('resultArea').style.display = 'none';
            document.getElementById('statsRow').style.display = 'none';
            document.getElementById('jvmError').style.display = 'none';

            const formData = new FormData();
            formData.append("file", file);

            try {
                const res = await fetch('/analyze', { method: 'POST', body: formData });
                const data = await res.json();

                if (data.error) {
                    const banner = document.getElementById('jvmError');
                    banner.style.display = 'block';
                    banner.innerText = "Error: " + data.error;
                } else {
                    // Update stats
                    document.getElementById('statTasks').innerText = data.tasks.length;
                    document.getElementById('statResources').innerText = data.resources.length;
                    document.getElementById('statAssignments').innerText = data.assignments.length;
                    document.getElementById('statPredecessors').innerText = data.predecessors.length;
                    document.getElementById('statCalendars').innerText = data.calendars.length;

                    // Update badges
                    document.getElementById('badgeTasks').innerText = data.tasks.length;
                    document.getElementById('badgeResources').innerText = data.resources.length;
                    document.getElementById('badgeAssignments').innerText = data.assignments.length;
                    document.getElementById('badgePredecessors').innerText = data.predecessors.length;
                    document.getElementById('badgeCalendars').innerText = data.calendars.length;

                    // Build tables
                    buildProjectInfo(data.project_info);
                    buildTable(data.tasks, 'tasksBody');
                    buildTable(data.resources, 'resourcesBody');
                    buildTable(data.assignments, 'assignmentsBody');
                    buildTable(data.predecessors, 'predecessorsBody');
                    buildTable(data.calendars, 'calendarsBody');

                    document.getElementById('statsRow').style.display = 'flex';
                    document.getElementById('resultArea').style.display = 'block';
                }
            } catch (e) {
                alert("Error: " + e);
            }
            document.getElementById('loading').style.display = 'none';
        }

        async function downloadFile(format) {
            const file = document.getElementById('fileInput').files[0];
            if (!file) return alert("Please select a file first!");

            const formData = new FormData();
            formData.append("file", file);
            formData.append("format", format);

            try {
                const res = await fetch('/convert', { method: 'POST', body: formData });
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const baseName = file.name.replace(/\.[^/.]+$/, "");
                    a.download = `${baseName}.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } else {
                    const err = await res.json();
                    alert("Failed: " + (err.error || "Unknown error"));
                }
            } catch (e) {
                alert("Download Error: " + e);
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/health')
def health():
    return jsonify({"status": "ok", "jvm_error": JVM_ERROR, "startup_log": STARTUP_LOG})

@app.route('/debug')
def debug():
    return jsonify({
        "jvm_started": jpype.isJVMStarted(),
        "jvm_error": JVM_ERROR,
        "startup_log": STARTUP_LOG,
        "java_home": os.environ.get("JAVA_HOME"),
    })


def parse_mpp(file_path):
    from net.sf.mpxj.reader import UniversalProjectReader
    reader = UniversalProjectReader()
    return reader.read(file_path)


@app.route('/analyze', methods=['POST'])
def analyze():
    """Full project analysis endpoint"""
    if JVM_ERROR:
        return jsonify({"error": f"Server Error: {JVM_ERROR}"}), 500
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    with tempfile.NamedTemporaryFile(suffix=".mpp", delete=True) as temp:
        file.save(temp.name)
        try:
            result = extract_full_project(temp.name)
            return jsonify(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500


@app.route('/convert', methods=['POST'])
def convert():
    if JVM_ERROR:
        return jsonify({"error": JVM_ERROR}), 500
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    format_type = request.form.get('format', 'json')
    file = request.files['file']
    base_name = os.path.splitext(file.filename)[0] if file.filename else "converted"

    with tempfile.NamedTemporaryFile(suffix=".mpp", delete=False) as temp_in:
        file.save(temp_in.name)
        temp_in_path = temp_in.name

    temp_out_path = None
    try:
        if format_type == 'json':
            # Full JSON export with all data
            result = extract_full_project(temp_in_path)
            temp_out_path = temp_in_path + ".json"
            with open(temp_out_path, 'w') as f:
                json.dump(result, f, indent=2, default=str)

        elif format_type == 'xml':
            temp_out_path = temp_in_path + ".xml"
            project = parse_mpp(temp_in_path)
            from net.sf.mpxj.mspdi import MSPDIWriter
            writer = MSPDIWriter()
            writer.write(project, temp_out_path)

        elif format_type == 'xlsx':
            # Multi-sheet Excel with all data
            result = extract_full_project(temp_in_path)
            temp_out_path = temp_in_path + ".xlsx"

            with pd.ExcelWriter(temp_out_path, engine='openpyxl') as writer:
                # Project Info as a vertical table
                if result["project_info"]:
                    info_df = pd.DataFrame(list(result["project_info"].items()), columns=["Property", "Value"])
                    info_df.to_excel(writer, sheet_name="Project Info", index=False)

                if result["tasks"]:
                    pd.DataFrame(result["tasks"]).to_excel(writer, sheet_name="Tasks", index=False)
                if result["resources"]:
                    pd.DataFrame(result["resources"]).to_excel(writer, sheet_name="Resources", index=False)
                if result["assignments"]:
                    pd.DataFrame(result["assignments"]).to_excel(writer, sheet_name="Assignments", index=False)
                if result["predecessors"]:
                    pd.DataFrame(result["predecessors"]).to_excel(writer, sheet_name="Dependencies", index=False)
                if result["calendars"]:
                    pd.DataFrame(result["calendars"]).to_excel(writer, sheet_name="Calendars", index=False)

        return send_file(temp_out_path, as_attachment=True, download_name=f"{base_name}.{format_type}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_in_path):
            os.remove(temp_in_path)
        if temp_out_path and os.path.exists(temp_out_path):
            # Don't remove yet - send_file needs it
            pass


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)
