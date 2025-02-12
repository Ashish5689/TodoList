import { NextApiRequest, NextApiResponse } from 'next';

// Check for API key at startup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Validate API key availability
if (!GEMINI_API_KEY) {
  // In production (Netlify), log the error but don't crash the server
  if (IS_PRODUCTION) {
    console.error(
      'Warning: GEMINI_API_KEY is not defined in environment variables. ' +
      'Make sure it is properly set in Netlify environment variables.'
    );
  } else {
    // In development, throw an error to make it more obvious
    throw new Error(
      'GEMINI_API_KEY is not defined in environment variables. ' +
      'Create a .env.local file with your API key for local development.'
    );
  }
}

// Using the direct API endpoint for gemini-1.5-flash
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enhanced runtime API key validation
  if (!GEMINI_API_KEY) {
    const errorMessage = IS_PRODUCTION
      ? 'API key not configured in Netlify environment variables'
      : 'API key not found in local environment';
    
    console.error(`Environment Error: ${errorMessage}`);
    return res.status(500).json({ 
      message: 'Server configuration error - API key not available',
      error: 'MISSING_API_KEY',
      details: IS_PRODUCTION ? 'Check Netlify environment settings' : 'Check .env.local file'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({ message: 'Task is required' });
    }

    // Log the environment we're running in (but not the key!)
    console.log(`Executing in ${IS_PRODUCTION ? 'production' : 'development'} environment`);

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
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
      let errorData;
      const contentType = response.headers.get('content-type');
      
      try {
        // Check if response is JSON
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          // If not JSON, get the text response
          const textResponse = await response.text();
          console.error('Non-JSON error response:', textResponse);
          errorData = { error: { message: 'Invalid response format from API' } };
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        errorData = { error: { message: 'Failed to parse API response' } };
      }

      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        error: errorData,
        environment: IS_PRODUCTION ? 'production' : 'development'
      });

      throw new Error(errorData.error?.message || 'Failed to get response from Gemini API');
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Error parsing successful response:', parseError);
      throw new Error('Failed to parse API response data');
    }
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('Empty response data:', data);
      throw new Error('No response generated from the API');
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
    
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
    console.error('AI Task Breakdown Error:', {
      message: error.message,
      environment: IS_PRODUCTION ? 'production' : 'development',
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ 
      message: 'Error processing task breakdown', 
      error: error.message 
    });
  }
} 