import { Wallet, JsonRpcProvider } from 'ethers';
import { processPayment, DefaultFacilitatorClient } from 'b402-sdk';
import type { B402PaymentPayload, B402PaymentRequirements } from 'b402-sdk';
import dotenv from 'dotenv';
import { Message, Task } from './b402Types.js';

dotenv.config();

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:3000';
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
const NETWORK = (process.env.NETWORK || 'testnet') as 'mainnet' | 'testnet';
const TOKEN = (process.env.TOKEN || 'USD1') as 'USDT' | 'USDC' | 'USD1';

interface AgentResponse {
  success?: boolean;
  task?: Task;
  events?: Task[];
  error?: string;
  x402?: any;
  payment?: any;
}

/**
 * Test client that can interact with the b402 AI agent
 * This demonstrates the complete payment flow using b402 SDK
 */
export class TestClient {
  private wallet?: Wallet;
  private facilitator?: DefaultFacilitatorClient;
  private agentUrl: string;
  private network: 'mainnet' | 'testnet';

  // Token addresses
  private static readonly TOKENS = {
    mainnet: {
      USD1: '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d',
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    },
    testnet: {
      USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    },
  };

  // Relayer contracts
  private static readonly RELAYERS = {
    mainnet: '0xE1C2830d5DDd6B49E9c46EbE03a98Cb44CD8eA5a',
    testnet: '0x62150F2c3A29fDA8bCf22c0F22Eb17270FCBb78A',
  };

  constructor(
    privateKey?: string,
    agentUrl: string = AGENT_URL,
    network: 'mainnet' | 'testnet' = NETWORK
  ) {
    this.network = network;
    if (privateKey) {
      const provider = new JsonRpcProvider(
        network === 'mainnet'
          ? 'https://bsc-dataseed1.binance.org'
          : 'https://data-seed-prebsc-1-s1.binance.org:8545'
      );
      this.wallet = new Wallet(privateKey, provider);
      this.facilitator = new DefaultFacilitatorClient();
      console.log(`💼 Client wallet: ${this.wallet.address}`);
    }
    this.agentUrl = agentUrl;
  }

  /**
   * Send a request to the agent
   */
  async sendRequest(text: string): Promise<AgentResponse> {
    const message: Message = {
      messageId: `msg-${Date.now()}`,
      role: 'user',
      parts: [
        {
          kind: 'text',
          text: text,
        },
      ],
    };

    console.log(`\n📤 Sending request: "${text}"`);

    const response = await fetch(`${this.agentUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const data = (await response.json()) as any;

    // Check for payment requirement (HTTP 402)
    if (response.status === 402) {
      console.log('💳 Payment required!');
      return {
        error: 'Payment Required',
        x402: data.x402 || data,
      };
    }

    return data as AgentResponse;
  }

  /**
   * Send a paid request (with payment using b402 SDK)
   */
  async sendPaidRequest(text: string): Promise<AgentResponse> {
    if (!this.wallet || !this.facilitator) {
      throw new Error(
        'Client wallet not configured. Set CLIENT_PRIVATE_KEY in .env'
      );
    }

    // Step 1: Send initial request to get payment requirements
    console.log('\n=== STEP 1: Initial Request ===');
    const initialResponse = await this.sendRequest(text);

    if (!initialResponse.x402) {
      console.log(
        '✅ Request processed without payment (unexpected, payment was already made?)'
      );
      return initialResponse;
    }

    // Step 2: Get payment details from 402 response
    console.log('\n=== STEP 2: Creating Payment Payload ===');
    const paymentRequired = initialResponse.x402;

    // Extract payment details from x402 response
    const payTo = paymentRequired.payTo;
    const amountWei = paymentRequired.maxAmountRequired;
    const tokenAddress = paymentRequired.asset;

    console.log(`Payment required: ${(BigInt(amountWei) / BigInt(1e18)).toString()} ${TOKEN}`);
    console.log(`Pay to: ${payTo}`);
    console.log(`Token: ${tokenAddress}`);

    try {
      // Step 3: Create payment requirements structure
      const requirements: B402PaymentRequirements = {
        scheme: 'exact',
        network: this.network === 'mainnet' ? 'bsc' : 'bsc-testnet',
        asset: tokenAddress,
        payTo: payTo,
        maxAmountRequired: amountWei,
        maxTimeoutSeconds: paymentRequired.maxTimeoutSeconds || 3600,
        relayerContract: TestClient.RELAYERS[this.network],
        description: paymentRequired.description,
      };

      // Step 4: Create and sign payment payload (without settling)
      console.log('🔐 Signing payment...');

      // Type assertion to work around ESM/CommonJS Wallet type mismatch
      const paymentPayload: B402PaymentPayload = await processPayment(
        requirements,
        this.wallet as any
      );

      console.log('✅ Payment payload created!');
      console.log(`   Payer: ${paymentPayload.payload.authorization.from}`);
      console.log(`   Amount: ${(BigInt(paymentPayload.payload.authorization.value) / BigInt(1e18)).toString()}`);

      // Step 5: Submit request with payment header
      console.log('\n=== STEP 3: Submitting Request with Payment ===');

      // Create payment header in the format b402-express expects (base64 encoded JSON)
      const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

      const message: Message = {
        messageId: `msg-${Date.now()}`,
        role: 'user',
        parts: [
          {
            kind: 'text',
            text: text,
          },
        ],
      };

      const paidResponse = await fetch(`${this.agentUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': paymentHeader,
        },
        body: JSON.stringify({ message }),
      });

      const paidData = (await paidResponse.json()) as any;

      if (paidResponse.ok) {
        console.log('✅ Payment accepted and request processed!');
        if (paidData.payment?.txHash) {
          const explorerUrl = this.network === 'mainnet'
            ? 'https://bscscan.com'
            : 'https://testnet.bscscan.com';
          console.log(`   Transaction: ${paidData.payment.txHash}`);
          console.log(`   Explorer: ${explorerUrl}/tx/${paidData.payment.txHash}`);
        }
        return paidData as AgentResponse;
      } else {
        console.log(`❌ Request failed: ${paidData.error || 'Unknown error'}`);
        return paidData as AgentResponse;
      }
    } catch (error) {
      console.error('❌ Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Check agent health
   */
  async checkHealth(): Promise<any> {
    console.log('\n🏥 Checking agent health...');
    const response = await fetch(`${this.agentUrl}/health`);
    const data = (await response.json()) as any;

    if (response.ok) {
      console.log('✅ Agent is healthy');
      console.log(`   Service: ${data.service}`);
      console.log(`   Payment address: ${data.payment.address}`);
      console.log(`   Network: ${data.payment.network}`);
      console.log(`   Price: ${data.payment.price} ${data.payment.token}`);
    } else {
      console.log('❌ Agent is not healthy');
    }

    return data;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 b402 AI Agent Test Client');
  console.log('================================\n');

  const client = new TestClient(CLIENT_PRIVATE_KEY);

  // Check agent health
  await client.checkHealth();

  // Test 1: Request without payment
  console.log('\n\n📋 TEST 1: Request without payment');
  console.log('=====================================');
  try {
    const response = await client.sendRequest('What is 2+2?');
    if (response.x402) {
      console.log('✅ Correctly received payment requirement');
    } else {
      console.log('❌ Expected payment requirement');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  // Test 2: Request with payment (only if wallet configured)
  if (CLIENT_PRIVATE_KEY) {
    console.log('\n\n📋 TEST 2: Request with payment');
    console.log('=====================================');
    try {
      const response = await client.sendPaidRequest(
        'Tell me a joke about TypeScript!'
      );

      if (response.success && response.task) {
        console.log('\n🎉 SUCCESS! Response from AI:');
        console.log('-----------------------------------');
        const aiResponse = response.task.status.message?.parts
          ?.filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');
        console.log(aiResponse);
        console.log('-----------------------------------');
      } else {
        console.log('❌ Request failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Test 2 failed:', error);
    }
  } else {
    console.log('\n\n⚠️  TEST 2: Skipped (no CLIENT_PRIVATE_KEY configured)');
    console.log('=====================================');
    console.log('To test with payment, set CLIENT_PRIVATE_KEY in .env');
    console.log('This wallet needs:');
    console.log(`  - ${TOKEN} tokens (${NETWORK})`);
    console.log(`  - Gas tokens (BNB) for ${NETWORK}`);
  }

  console.log('\n\n✅ Tests complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runTests };
