import express from 'express';
import dotenv from 'dotenv';
import { b402 } from 'b402-express';
import { ExampleService } from './ExampleService.js';
import {
  EventQueue,
  Message,
  RequestContext,
  Task,
  TaskState,
} from './b402Types.js';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
// Serve static files from public directory
app.use(express.static('public'));

// Configuration
const PORT = process.env.PORT || 3000;
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
const NETWORK = (process.env.NETWORK || 'testnet') as 'mainnet' | 'testnet';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FACILITATOR_URL = process.env.FACILITATOR_URL;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const EIGENAI_BASE_URL =
  process.env.EIGENAI_BASE_URL || 'https://eigenai.eigencloud.xyz/v1';
const EIGENAI_API_KEY = process.env.EIGENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL;
const AI_TEMPERATURE = process.env.AI_TEMPERATURE
  ? Number.parseFloat(process.env.AI_TEMPERATURE)
  : undefined;
const AI_MAX_TOKENS = process.env.AI_MAX_TOKENS
  ? Number.parseInt(process.env.AI_MAX_TOKENS, 10)
  : undefined;
const AI_SEED = process.env.AI_SEED
  ? Number.parseInt(process.env.AI_SEED, 10)
  : undefined;
const PRICE = process.env.PRICE || '0.01';
const TOKEN = (process.env.TOKEN || 'USD1') as 'USD1' | 'USDT' | 'USDC';

// Validate environment variables
if (AI_PROVIDER === 'openai') {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is required when AI_PROVIDER=openai');
    process.exit(1);
  }
} else if (AI_PROVIDER === 'eigenai') {
  if (!EIGENAI_API_KEY && !OPENAI_API_KEY) {
    console.error('❌ EIGENAI_API_KEY (or OPENAI_API_KEY fallback) is required when AI_PROVIDER=eigenai');
    process.exit(1);
  }
} else {
  console.error(
    `❌ AI_PROVIDER "${AI_PROVIDER}" is not supported. Supported providers: openai, eigenai`
  );
  process.exit(1);
}

if (!PAY_TO_ADDRESS) {
  console.error('❌ PAY_TO_ADDRESS is required');
  process.exit(1);
}

if (NETWORK !== 'mainnet' && NETWORK !== 'testnet') {
  console.error(
    `❌ NETWORK "${NETWORK}" is not supported. Supported networks: mainnet, testnet`
  );
  process.exit(1);
}

const exampleService = new ExampleService({
  provider: AI_PROVIDER === 'eigenai' ? 'eigenai' : 'openai',
  apiKey: AI_PROVIDER === 'openai' ? OPENAI_API_KEY : undefined,
  baseUrl:
    AI_PROVIDER === 'eigenai'
      ? EIGENAI_BASE_URL
      : OPENAI_BASE_URL || undefined,
  defaultHeaders:
    AI_PROVIDER === 'eigenai'
      ? { 'x-api-key': (EIGENAI_API_KEY || OPENAI_API_KEY)! }
      : undefined,
  payToAddress: PAY_TO_ADDRESS,
  network: NETWORK,
  model:
    AI_MODEL ??
    (AI_PROVIDER === 'eigenai' ? 'gpt-oss-120b-f16' : 'gpt-4o-mini'),
  temperature: AI_TEMPERATURE ?? 0.7,
  maxTokens: AI_MAX_TOKENS ?? 500,
  seed: AI_PROVIDER === 'eigenai' ? AI_SEED : undefined,
});

// Configure b402 middleware for payment-protected routes
app.use(
  b402(
    {
      payTo: PAY_TO_ADDRESS,
      facilitatorUrl: FACILITATOR_URL,
      network: NETWORK,
    },
    {
      'POST /process': {
        price: PRICE,
        token: TOKEN,
        description: 'AI request processing service',
      },
    }
  )
);

console.log('🚀 b402 Payment API initialized');
console.log(`💰 Payment address: ${PAY_TO_ADDRESS}`);
console.log(`🌐 Network: ${NETWORK}`);
console.log(`💵 Price per request: $${PRICE} ${TOKEN}`);
if (FACILITATOR_URL) {
  console.log(`🌐 Using custom facilitator: ${FACILITATOR_URL}`);
} else {
  console.log('🌐 Using default facilitator: https://facilitator.b402.ai');
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'b402-payment-api',
    version: '1.0.0',
    payment: {
      address: PAY_TO_ADDRESS,
      network: NETWORK,
      price: `$${PRICE}`,
      token: TOKEN,
    },
  });
});

/**
 * Main endpoint to process paid requests
 * This endpoint accepts A2A-compatible task submissions with b402 payments
 * Payment verification is handled by b402-express middleware
 */
app.post('/process', async (req, res) => {
  try {
    console.log('\n📥 Received request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Payment is already verified by b402-express middleware
    // Access payment info from req.b402
    const paymentInfo = (req as any).b402;
    if (paymentInfo) {
      console.log('💳 Payment verified:');
      console.log(`   Payer: ${paymentInfo.payer}`);
      console.log(`   Transaction: ${paymentInfo.txHash}`);
      console.log(`   Amount: ${paymentInfo.amount} ${paymentInfo.token}`);
    }

    // Parse the incoming request
    const { message, taskId, contextId, metadata } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Missing message in request body',
      });
    }

    // Create a task from the request
    const task: Task = {
      id: taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contextId: contextId || `context-${Date.now()}`,
      status: {
        state: TaskState.INPUT_REQUIRED,
        message: message,
      },
      metadata: {
        ...(metadata || {}),
        ...(paymentInfo
          ? {
              'b402.payment.payer': paymentInfo.payer,
              'b402.payment.txHash': paymentInfo.txHash,
              'b402.payment.amount': paymentInfo.amount,
              'b402.payment.token': paymentInfo.token,
              'b402.payment.status': 'payment-completed',
            }
          : {}),
      },
    };

    // Create request context
    const context: RequestContext = {
      taskId: task.id,
      contextId: task.contextId,
      currentTask: task,
      message: message,
    };

    // Create event queue to collect responses
    const events: Task[] = [];
    const eventQueue: EventQueue = {
      enqueueEvent: async (event: Task) => {
        events.push(event);
      },
    };

    // Process the request with the example service
    await exampleService.execute(context, eventQueue);

    // Update task metadata with final status
    if (events.length === 0) {
      events.push(task);
    }

    console.log('📤 Sending response\n');

    return res.json({
      success: true,
      task: events[events.length - 1],
      events,
      payment: paymentInfo,
    });
  } catch (error: any) {
    console.error('❌ Error processing request:', error);

    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Simple test endpoint to try the agent
 */
app.post('/test', async (req, res) => {
  const message: Message = {
    messageId: `msg-${Date.now()}`,
    role: 'user',
    parts: [
      {
        kind: 'text',
        text: req.body.text || 'Hello, tell me a joke!',
      },
    ],
  };

  try {
    const response = await fetch(`http://localhost:${PORT}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`📖 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: POST http://localhost:${PORT}/test`);
  console.log(`🚀 Main endpoint: POST http://localhost:${PORT}/process\n`);
});
