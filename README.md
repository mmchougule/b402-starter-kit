# b402 Starter Kit

A starter kit for building paid APIs using the b402 payment protocol on BNB Chain.

## Overview

This starter kit demonstrates how to build paid APIs using b402. It:

1. Receives API requests
2. Requires payment (in this example of $0.01 USD1/USDT/USDC) before processing
3. Verifies and settles payments through the b402 facilitator (defaulting to https://facilitator.b402.ai)
4. Processes requests (using OpenAI/EigenAI as configurable examples)
5. Returns responses after payment is confirmed

## Architecture

The API consists of three main components:

- **ExampleService**: Example service logic that processes requests using OpenAI or EigenAI (replace with your own service implementation)
- **b402-express middleware**: Automatically handles payment verification and settlement via the b402 facilitator
- **Server**: Express HTTP server that orchestrates payment validation and request processing

## Prerequisites

- Node.js 18 or higher
- A wallet with some BNB for gas fees (on your chosen network)
- An OpenAI API key (for the example implementation - replace with your own API)
- A wallet address to receive payments (USD1/USDT/USDC on BSC)
- Optional: to use EigenAI (for Verifiable Inference), start [here](https://docs.eigencloud.xyz/products/eigenai/eigenai-overview)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Server Configuration
PORT=3000

# Payment Configuration
# Wallet address that will receive payments
PAY_TO_ADDRESS=0xYourWalletAddress

# Network Configuration
# Options: "mainnet" or "testnet"
NETWORK=testnet

# Payment Settings
# Price per request (in USD)
PRICE=0.01
# Token to accept: "USD1", "USDT", or "USDC"
TOKEN=USD1

# AI Provider Configuration
# Options: "openai" (default) or "eigenai"
# AI_PROVIDER=openai
# AI_MODEL=gpt-4o-mini
# AI_TEMPERATURE=0.7
# AI_MAX_TOKENS=500
# AI_SEED=42

# OpenAI Configuration
# Your OpenAI API key for the example service (replace with your own API configuration)
OPENAI_API_KEY=your_openai_api_key_here
# Optional: override the OpenAI base URL
# OPENAI_BASE_URL=https://api.openai.com/v1

# EigenAI Configuration (required if AI_PROVIDER=eigenai)
# EIGENAI_API_KEY=your_eigenai_api_key_here
# EIGENAI_BASE_URL=https://eigenai.eigencloud.xyz/v1

# Facilitator Configuration (optional)
# FACILITATOR_URL=https://your-custom-facilitator.com

# Test Client Configuration (optional - only needed for end-to-end payment testing)
# CLIENT_PRIVATE_KEY=your_test_wallet_private_key_here
# AGENT_URL=http://localhost:3000

# Optional: Debug logging
B402_DEBUG=true
```

## Quickstart

1. **Run the API**
   ```bash
   npm run dev
   ```

2. **Run the test suite (in another terminal)**
   ```bash
   npm test
   ```

**Important:**
- `PAY_TO_ADDRESS` should be your wallet address where you want to receive payments
- `NETWORK` should be `testnet` for testing or `mainnet` for production
- `TOKEN` options are `USD1`, `USDT`, or `USDC` (available tokens depend on network)
- `OPENAI_API_KEY` is required unless `AI_PROVIDER=eigenai` (then provide `EIGENAI_API_KEY`)
- Never commit your `.env` file to version control

## Running the API

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Docker

```bash
# Build the image
docker build -t b402-starter .

# Run the container (make sure .env has the required variables)
docker run --env-file .env -p 3000:3000 b402-starter
```

## Usage

### Health Check

Check if the API is running:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "b402-payment-api",
  "version": "1.0.0",
  "payment": {
    "address": "0xYourAddress...",
    "network": "testnet",
    "price": "$0.01",
    "token": "USD1"
  }
}
```

### Testing the API

We provide multiple ways to test the API:

#### 1. Quick Test Script

Run the simple shell test:

```bash
./test-request.sh
```

This tests the health endpoint and payment requirement flow.

#### 2. Full Test Suite

Run the comprehensive test client:

```bash
npm test
```

This will:
- Check API health
- Test unpaid requests (returns 402)
- Test paid requests (if CLIENT_PRIVATE_KEY is configured)
- Show the complete payment flow

#### 4. Manual Testing (Simple)

For quick testing without the full payment protocol:

```bash
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"text": "Tell me a joke about programming"}'
```

This will return a payment required error since no payment was made.

#### Main Endpoint (A2A Compatible)

Send a request using the A2A message format:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "parts": [
        {
          "kind": "text",
          "text": "What is the meaning of life?"
        }
      ]
  }'
```

**Expected Response (402 Payment Required):**

```json
{
  "error": "Payment required",
  "x402": {
    "version": 1,
    "scheme": "exact",
    "network": "bsc-testnet",
    "asset": "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d",
    "payTo": "0xYourAddress...",
    "maxAmountRequired": "10000000000000000",
    "maxTimeoutSeconds": 3600,
    "relayerContract": "0x62150F2c3A29fDA8bCf22c0F22Eb17270FCBb78A",
    "description": "Payment for POST /process"
  }
}
```

To complete the payment and process the request, you'll need to:

1. Create a payment payload using the b402 SDK
2. Sign the payment with your wallet
3. Submit the payment back to the `/process` endpoint with the `x-payment` header

For a complete client example, see the [b402 SDK documentation](https://github.com/vistara-labs/b402-sdk).

## How It Works

### Payment Flow

1. **Client sends request** → API receives the request
2. **API requires payment** → Returns 402 with payment requirements
3. **Client signs payment** → Creates EIP-3009 authorization using b402 SDK
4. **Client submits payment** → Sends signed payment back to API with `x-payment` header
5. **b402-express verifies payment** → Checks signature and authorization via facilitator
6. **API processes request** → Calls your service (OpenAI in this example)
7. **API settles payment** → Facilitator completes blockchain transaction (gasless for buyer!)
8. **API returns response** → Sends the service response

### Payment Verification

The `b402-express` middleware automatically handles payment verification by:
- Intercepting requests to protected routes
- Checking for the `x-payment` header
- Verifying the payment signature via the b402 facilitator
- Settling the payment on-chain (facilitator pays gas)

The payment info is available in `req.b402`:
- `req.b402.payer` - Address of the payer
- `req.b402.txHash` - Transaction hash of the settlement
- `req.b402.amount` - Amount paid
- `req.b402.token` - Token used for payment

### Error Handling

- **Missing payment**: Returns 402 Payment Required
- **Invalid payment**: Returns payment verification failure
- **OpenAI error**: Returns error message in task status
- **Settlement failure**: Returns settlement error details

## Development

### Project Structure

```
b402-developer-starter-kit/
├── src/
│   ├── server.ts                     # Express server and endpoints
│   ├── ExampleService.ts             # Example service logic (replace with your own)
│   ├── b402Types.ts                  # Shared task/message types
│   └── testClient.ts                 # Test client for development
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── test-request.sh
```

### Building

```bash
npm run build
```

Compiled files will be in the `dist/` directory.

### Cleaning

```bash
npm run clean
```

## Testing with Real Payments

To test with real payments:

1. Switch to testnet (recommended for testing)
2. Get testnet tokens from a faucet:
   - BNB for gas: [BNB Chain Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
   - Testnet USDT: Available on BSC testnet
3. Use a client that implements the b402 protocol (see `src/testClient.ts`)
4. Make sure your wallet has testnet BNB for gas (though b402 payments are gasless for buyers!)

## Token Support

### Mainnet
- **USD1**: `0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d`
- **USDT**: `0x55d398326f99059fF775485246999027B3197955`
- **USDC**: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`

### Testnet
- **USDT**: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`

## Troubleshooting

### "OPENAI_API_KEY is required"

Make sure you've set `OPENAI_API_KEY` in your `.env` file.

### "PAY_TO_ADDRESS is required"

Make sure you've set `PAY_TO_ADDRESS` in your `.env` file to your wallet address.

### Payment verification fails

- Check that you're using the correct network
- Verify your wallet has token approval set
- Make sure the payment amount matches
- Ensure the facilitator URL is reachable
- Check that you're using the correct token for the network

### OpenAI rate limits

If you hit OpenAI rate limits, consider:
- Using `gpt-3.5-turbo` instead of `gpt-4o-mini`
- Implementing request queuing
- Adding rate limiting to your API
- Replacing OpenAI with your own service

## Security Considerations

- Never commit your `.env` file
- Keep your private key secure
- Use testnet for development
- Validate all payment data before processing
- Implement rate limiting for production
- Monitor for failed payment attempts

## Next Steps

- Replace the example OpenAI service with your own API logic
- Implement request queuing for high volume
- Add support for different payment tiers
- Create a web client interface
- Add analytics and monitoring
- Implement caching for common requests
- Add support for streaming responses

## License

ISC

## Resources

- [b402 SDK on npm](https://www.npmjs.com/package/b402-sdk)
- [b402 Express Middleware](https://www.npmjs.com/package/b402-express)
- [A2A Specification](https://github.com/google/a2a)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [BNB Chain Documentation](https://docs.bnbchain.org/)
