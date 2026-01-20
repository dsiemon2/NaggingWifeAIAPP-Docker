import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger';
import { FamilyTaskSummary, SatisfactionRating } from '../../types/index.js';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export interface ReminderAnalysis {
  summary: string;
  keyPoints: string[];
  accomplishments: string[];
  pendingItems: string[];
  notableResponses: string[];
  completionRate: number;
  satisfactionRating: SatisfactionRating;
  taskSummary: FamilyTaskSummary;
}

export interface ConversationSegment {
  speaker: 'user' | 'ai' | 'family_member';
  text: string;
  timestamp?: Date;
  taskId?: string;
}

export interface FamilyContext {
  familyName: string;
  assistantMode: string;
  categories: {
    name: string;
    tasks: {
      id: string;
      description: string;
      dueDate?: string;
    }[];
  }[];
}

/**
 * Generate a comprehensive reminder session summary using GPT-4
 */
export async function generateReminderSummary(
  userName: string,
  familyContext: FamilyContext,
  transcript: ConversationSegment[]
): Promise<ReminderAnalysis> {
  // Format transcript for GPT
  const formattedTranscript = transcript
    .map((seg) => `[${seg.speaker.toUpperCase()}]: ${seg.text}`)
    .join('\n\n');

  // Build category/task context
  const taskContext = familyContext.categories
    .map((cat) => {
      const tasks = cat.tasks.map((t) => `  - ${t.description}${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`).join('\n');
      return `${cat.name}:\n${tasks}`;
    })
    .join('\n\n');

  const systemPrompt = `You are a helpful family assistant analyzing reminder conversations.
Your task is to analyze the conversation and provide insights on task completion and family organization.

Family: ${familyContext.familyName}
Assistant Mode: ${familyContext.assistantMode}

Tasks by Category:
${taskContext}

Analyze the conversation and provide:
1. A concise summary (2-3 paragraphs)
2. Key points from the conversation (3-5 bullets)
3. Accomplishments - tasks completed or progress made (3-5 bullets)
4. Pending items - tasks still needing attention (2-4 bullets)
5. Notable responses from family members
6. Overall completion rate (0-100%)
7. Satisfaction rating (VERY_HAPPY, HAPPY, NEUTRAL, UNHAPPY, VERY_UNHAPPY)
8. Detailed task summary by category

Be encouraging, specific, and helpful in your analysis.`;

  const userPrompt = `User: ${userName}

Conversation Transcript:
${formattedTranscript}

Please analyze this reminder session and respond in the following JSON format:
{
  "summary": "string - 2-3 paragraph summary",
  "keyPoints": ["string array of 3-5 key points"],
  "accomplishments": ["string array of completed tasks or progress"],
  "pendingItems": ["string array of items still pending"],
  "notableResponses": ["string array of notable user responses"],
  "completionRate": number (0-100),
  "satisfactionRating": "VERY_HAPPY" | "HAPPY" | "NEUTRAL" | "UNHAPPY" | "VERY_UNHAPPY",
  "taskSummary": {
    "categories": {
      "CategoryName": {
        "completedCount": number,
        "pendingCount": number,
        "overdueCount": number,
        "tasks": [
          {
            "taskId": "string or null",
            "taskName": "string",
            "status": "string",
            "dueDate": "string or null",
            "notes": "string"
          }
        ]
      }
    },
    "overallCompletionRate": number (0-100),
    "upcomingDates": ["string array of upcoming important dates"],
    "overdueItems": ["string array of overdue items"],
    "satisfactionRating": "VERY_HAPPY" | "HAPPY" | "NEUTRAL" | "UNHAPPY" | "VERY_UNHAPPY"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    const analysis = JSON.parse(content) as ReminderAnalysis;

    // Validate and normalize the response
    return {
      summary: analysis.summary || 'Summary not available.',
      keyPoints: analysis.keyPoints || [],
      accomplishments: analysis.accomplishments || [],
      pendingItems: analysis.pendingItems || [],
      notableResponses: analysis.notableResponses || [],
      completionRate: Math.min(100, Math.max(0, Math.round(analysis.completionRate || 0))),
      satisfactionRating: validateSatisfactionRating(analysis.satisfactionRating),
      taskSummary: analysis.taskSummary || createDefaultTaskSummary(),
    };
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error generating reminder summary:');
    throw error;
  }
}

/**
 * Generate quick insights for an in-progress reminder session
 */
export async function generateQuickInsights(
  transcript: ConversationSegment[],
  currentTask?: string
): Promise<{ suggestions: string[]; urgentItems: string[]; encouragements: string[] }> {
  const recentTranscript = transcript.slice(-10); // Last 10 segments
  const formattedTranscript = recentTranscript
    .map((seg) => `[${seg.speaker.toUpperCase()}]: ${seg.text}`)
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster model for real-time suggestions
      messages: [
        {
          role: 'system',
          content: `You are a helpful family assistant providing real-time insights.
Be concise and encouraging. Respond in JSON format.`,
        },
        {
          role: 'user',
          content: `Recent conversation:
${formattedTranscript}

${currentTask ? `Current task being discussed: ${currentTask}` : ''}

Provide brief insights in this JSON format:
{
  "suggestions": ["1-2 word suggestions for the next reminder"],
  "urgentItems": ["any urgent items that need attention"],
  "encouragements": ["encouraging messages for task completion"]
}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { suggestions: [], urgentItems: [], encouragements: [] };
    }

    return JSON.parse(content);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error generating quick insights:');
    return { suggestions: [], urgentItems: [], encouragements: [] };
  }
}

/**
 * Generate comparison between family members' task completion
 */
export async function compareFamilyProgress(
  members: Array<{
    name: string;
    summary: string;
    completionRate: number;
    accomplishments: string[];
    pendingItems: string[];
  }>,
  familyName: string
): Promise<{
  ranking: Array<{ name: string; rank: number; highlight: string }>;
  comparison: string;
}> {
  const memberData = members
    .map(
      (m, i) => `
Family Member ${i + 1}: ${m.name}
Completion Rate: ${m.completionRate}%
Summary: ${m.summary}
Accomplishments: ${m.accomplishments.join(', ')}
Pending: ${m.pendingItems.join(', ')}
`
    )
    .join('\n---\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly family assistant comparing task progress for the ${familyName} family.
Be encouraging and positive while providing helpful comparisons.`,
        },
        {
          role: 'user',
          content: `Compare these family members' progress:
${memberData}

Respond in JSON format:
{
  "ranking": [
    { "name": "string", "rank": number, "highlight": "string - positive highlight about this person" }
  ],
  "comparison": "string - 2-3 paragraph encouraging comparison"
}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    return JSON.parse(content);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error comparing family progress:');
    throw error;
  }
}

// Helper functions
function validateSatisfactionRating(rating: string): SatisfactionRating {
  const valid: SatisfactionRating[] = ['VERY_HAPPY', 'HAPPY', 'NEUTRAL', 'UNHAPPY', 'VERY_UNHAPPY'];
  const upper = (rating || 'NEUTRAL').toUpperCase() as SatisfactionRating;
  return valid.includes(upper) ? upper : 'NEUTRAL';
}

function createDefaultTaskSummary(): FamilyTaskSummary {
  return {
    categories: {},
    overallCompletionRate: 0,
    upcomingDates: [],
    overdueItems: [],
    satisfactionRating: 'NEUTRAL',
  };
}
