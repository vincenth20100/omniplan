'use server';

/**
 * @fileOverview An AI agent to identify scheduling conflicts in a Gantt chart.
 *
 * - identifySchedulingConflicts - A function that identifies scheduling conflicts.
 * - IdentifySchedulingConflictsInput - The input type for the identifySchedulingConflicts function.
 * - IdentifySchedulingConflictsOutput - The return type for the identifySchedulingConflicts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifySchedulingConflictsInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      start: z.string().datetime(),
      finish: z.string().datetime(),
      constraintType: z.string().nullable(),
      constraintDate: z.string().datetime().nullable(),
      schedulingConflict: z.boolean().optional(),
    })
  ).describe('An array of task objects with their properties.'),
  links: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.enum(['FS', 'SS', 'FF', 'SF'])
    })
  ).describe('An array of link objects representing task dependencies.')
});

export type IdentifySchedulingConflictsInput = z.infer<typeof IdentifySchedulingConflictsInputSchema>;

const IdentifySchedulingConflictsOutputSchema = z.array(
  z.object({
    taskId: z.string(),
    conflictDescription: z.string()
  }).describe('An array of scheduling conflicts, each detailing the task ID and a description of the conflict.')
);

export type IdentifySchedulingConflictsOutput = z.infer<typeof IdentifySchedulingConflictsOutputSchema>;

export async function identifySchedulingConflicts(input: IdentifySchedulingConflictsInput): Promise<IdentifySchedulingConflictsOutput> {
  return identifySchedulingConflictsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifySchedulingConflictsPrompt',
  input: {schema: IdentifySchedulingConflictsInputSchema},
  output: {schema: IdentifySchedulingConflictsOutputSchema},
  prompt: `You are an AI assistant that identifies scheduling conflicts in a project Gantt chart.

  Analyze the provided tasks and their dependencies (links) to identify any constraint violations.

  Tasks:
  {{#each tasks}}
  - Task ID: {{id}}, Name: {{name}}, Start: {{start}}, Finish: {{finish}}, Constraint Type: {{constraintType}}, Constraint Date: {{constraintDate}}
  {{/each}}

  Links:
  {{#each links}}
  - Source: {{source}}, Target: {{target}}, Type: {{type}}
  {{/each}}

  A scheduling conflict occurs when a task's start or finish date violates its constraint, typically a "Must Start On" constraint, due to dependencies pushing it past the allowed date.

  Identify all such conflicts and return an array of objects, each containing the taskId and a description of the conflict. If no conflicts exist, return an empty array.
  Each link dependency type is one of Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF).
  Consider only Finish-to-Start dependencies when identifying conflicts.
  Only consider the 'Must Start On' constraint type for conflict analysis.

  Format your output as a JSON array of objects, each with 'taskId' and 'conflictDescription' fields.
  `,
});

const identifySchedulingConflictsFlow = ai.defineFlow(
  {
    name: 'identifySchedulingConflictsFlow',
    inputSchema: IdentifySchedulingConflictsInputSchema,
    outputSchema: IdentifySchedulingConflictsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
