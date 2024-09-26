import { NextRequest } from 'next/server'

// Set the runtime to edge for best performance
export const config = {
  runtime: 'edge',
  unstable_allowDynamic: [
    '/node_modules/function-bind/**', // use a glob to allow anything in the function-bind 3rd party module
  ],
}

export default async function handler(req: NextRequest) {
  console.log('API route called');
  if (req.method !== 'POST') {
    console.log('Method not allowed');
    return new Response('Method not allowed', { status: 405 })
  }

  const { activity } = await req.json()
  console.log('Received activity:', activity);

  if (!activity) {
    console.log('Activity is required');
    return new Response('Activity is required', { status: 400 })
  }

  // Mock response
  const mockTasks = [
    "1. Gather materials: container, gravel, sand, activated charcoal, cloth",
    "2. Layer gravel at the bottom of the container",
    "3. Add a layer of sand on top of the gravel",
    "4. Place a layer of activated charcoal above the sand",
    "5. Cover the top with a cloth to catch larger particles",
    "6. Slowly pour water through the layers",
    "7. Collect the filtered water in a clean container",
    "8. Boil the filtered water to kill bacteria and pathogens",
    "9. Allow the boiled water to cool",
    "10. Store the purified water in a sterilized container"
  ];

  const stream = new ReadableStream({
    async start(controller) {
      for (const task of mockTasks) {
        const message = { choices: [{ delta: { content: task + '\n' } }] };
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}