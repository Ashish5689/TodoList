import { NextApiRequest, NextApiResponse } from 'next';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

// Using the direct API endpoint for gemini-1.5-flash
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({ message: 'Task is required' });
    }

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Task: ${task}

Instructions: Break this task into specific, actionable steps.

Requirements:
1. Provide 4-8 clear steps
2. Make each step concrete and actionable
3. Keep steps in logical order
4. Focus only on the given task
5. Do not use any pre-existing templates

Format: Number each step like this:
1. First step
2. Second step
etc.

Remember: Each step must be directly related to the task. No generic templates.`
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        },
        safetySettings: [{
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to get response from Gemini API');
    }

    const data = await response.json();
    console.log('API Response:', data);

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response generated from the API');
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
    console.log('Generated Text:', text);
    
    // Extract numbered items from the text response
    const subtasks = text
      .split('\n')
      .filter((line: string) => /^\d+\./.test(line.trim())) // Only keep numbered lines
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbers and trim
      .filter((task: string) => task.length > 0); // Remove empty lines

    if (subtasks.length === 0) {
      throw new Error('No valid subtasks found in the response');
    }

    return res.status(200).json({ subtasks });
  } catch (error: any) {
    console.error('AI Task Breakdown Error:', error);
    return res.status(500).json({ 
      message: 'Error processing task breakdown', 
      error: error.message 
    });
  }
} 