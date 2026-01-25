'use server';

import { identifySchedulingConflicts, IdentifySchedulingConflictsInput } from '@/ai/flows/identify-scheduling-conflicts';

// This is a type assertion because the generated schema has boolean for schedulingConflict
type SerializableTask = Omit<IdentifySchedulingConflictsInput['tasks'][0], 'schedulingConflict'> & { schedulingConflict?: boolean };

export async function findConflicts(input: { tasks: SerializableTask[], links: IdentifySchedulingConflictsInput['links']}) {
  const formattedInput: IdentifySchedulingConflictsInput = {
    ...input,
    tasks: input.tasks.map(t => ({
      id: t.id,
      name: t.name,
      start: new Date(t.start).toISOString(),
      finish: new Date(t.finish).toISOString(),
      constraintType: t.constraintType ?? null,
      constraintDate: t.constraintDate ? new Date(t.constraintDate).toISOString() : null,
      schedulingConflict: t.schedulingConflict || false,
    }))
  };

  try {
    const conflicts = await identifySchedulingConflicts(formattedInput);
    return { success: true, data: conflicts };
  } catch (error) {
    console.error("AI Conflict Detection Error:", error);
    return { success: false, error: 'Failed to communicate with the AI model.' };
  }
}
