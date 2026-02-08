
interface Task {
    id: string;
    order?: number;
}

function generateTasks(count: number): Task[] {
    const tasks: Task[] = [];
    for (let i = 0; i < count; i++) {
        tasks.push({
            id: `task-${i}`,
            order: i
        });
    }
    return tasks;
}

function originalReorder(tasks: Task[], sourceIds: string[], targetId: string) {
    let newTasks = [...tasks];
    const targetIndex = newTasks.findIndex(t => t.id === targetId);
    if (targetIndex === -1) return { sourceTasks: [], newTasks: tasks };

    const sourceTasks = sourceIds.map(id => newTasks.find(t => t.id === id)).filter((t): t is Task => !!t);
    // Logic continues...

    newTasks = newTasks.filter(t => !sourceIds.includes(t.id));

    return { sourceTasks, newTasks };
}

function optimizedReorder(tasks: Task[], sourceIds: string[], targetId: string) {
    let newTasks = [...tasks];
    const targetIndex = newTasks.findIndex(t => t.id === targetId);
    if (targetIndex === -1) return { sourceTasks: [], newTasks: tasks };

    // Optimization here
    let sourceTasks: Task[];
    if (sourceIds.length < 100) {
        sourceTasks = sourceIds.map(id => newTasks.find(t => t.id === id)).filter((t): t is Task => !!t);
    } else {
        const taskMap = new Map(newTasks.map(t => [t.id, t]));
        sourceTasks = sourceIds.map(id => taskMap.get(id)).filter((t): t is Task => !!t);
    }

    newTasks = newTasks.filter(t => !sourceIds.includes(t.id));

    return { sourceTasks, newTasks };
}

function runBenchmark() {
    const taskCounts = [1000, 5000, 10000];
    const sourceCounts = [10, 50, 100, 1000];

    console.log("Running Benchmark...");
    console.log("Task Count | Source Count | Original (ms) | Optimized (ms) | Improvement");
    console.log("-----------|--------------|---------------|----------------|------------");

    for (const count of taskCounts) {
        for (const sourceCount of sourceCounts) {
            if (sourceCount > count) continue;

            const tasks = generateTasks(count);
            // Pick random sourceIds to avoid best-case scenarios if finding from start
            const sourceIds: string[] = [];
            for (let i = 0; i < sourceCount; i++) {
                sourceIds.push(tasks[Math.floor(Math.random() * tasks.length)].id);
            }
            const targetId = tasks[tasks.length - 1].id;

            // Warmup
            originalReorder(tasks, sourceIds, targetId);
            optimizedReorder(tasks, sourceIds, targetId);

            // Correctness Check
            const resOriginal = originalReorder(tasks, sourceIds, targetId);
            const resOptimized = optimizedReorder(tasks, sourceIds, targetId);

            if (resOriginal.sourceTasks.length !== resOptimized.sourceTasks.length) {
                console.error("Mismatch in sourceTasks length!");
                throw new Error("Mismatch in sourceTasks length!");
            }
            for (let i = 0; i < resOriginal.sourceTasks.length; i++) {
                if (resOriginal.sourceTasks[i].id !== resOptimized.sourceTasks[i].id) {
                    console.error("Mismatch in sourceTasks content!");
                    throw new Error("Mismatch in sourceTasks content!");
                }
            }

            const startOriginal = performance.now();
            // Run multiple iterations for better stability
            const iterations = 100;
            for(let i=0; i<iterations; i++) {
                originalReorder(tasks, sourceIds, targetId);
            }
            const endOriginal = performance.now();
            const timeOriginal = (endOriginal - startOriginal) / iterations;

            const startOptimized = performance.now();
            for(let i=0; i<iterations; i++) {
                optimizedReorder(tasks, sourceIds, targetId);
            }
            const endOptimized = performance.now();
            const timeOptimized = (endOptimized - startOptimized) / iterations;

            const improvement = ((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2);

            console.log(`${count.toString().padEnd(10)} | ${sourceCount.toString().padEnd(12)} | ${timeOriginal.toFixed(4).padEnd(13)} | ${timeOptimized.toFixed(4).padEnd(14)} | ${improvement}%`);
        }
    }
}

runBenchmark();
