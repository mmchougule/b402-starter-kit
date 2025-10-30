# b402 Starter Kit - Quick Start Guide

Get up and running with b402 payments in 5 minutes!

## Prerequisites

- Node.js 18+
- A BSC wallet address
- OpenAI API key (for the example service)

## Step 1: Install

```bash
cd ~/development/b402/b402-starter-kit
npm install
```

## Step 2: Configure

```bash
cp .env.example .env
```

Edit `.env` and set:
- `PAY_TO_ADDRESS` - Your BSC wallet address
- `OPENAI_API_KEY` - Your OpenAI API key
- `NETWORK` - `testnet` for testing or `mainnet` for production

## Step 3: Run

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Step 4: Test

In another terminal:

```bash
# Simple health check
curl http://localhost:3000/health

# Test payment requirement
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{"message": {"parts": [{"kind": "text", "text": "Hello!"}]}}'
```

You should see a 402 Payment Required response with b402 payment details.

## Step 5: Test with Payment

To test the complete flow with actual payment:

1. Set `CLIENT_PRIVATE_KEY` in `.env` with a test wallet private key
2. Make sure the wallet has testnet tokens (USDT on BSC testnet)
3. Run the test client:

```bash
npm test
```

## Next Steps

- Replace `ExampleService.ts` with your own service logic
- Customize payment amounts and tokens
- Deploy to your preferred hosting platform
- Read the full [README.md](./README.md) for detailed documentation

## Support

- Check the [README.md](./README.md) for troubleshooting
- Review [b402 SDK documentation](https://github.com/vistara-labs/b402-sdk)
- Join the b402 community for help
