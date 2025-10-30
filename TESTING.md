# Testing Guide

This guide explains how to test the b402 starter kit end-to-end.

## Testing Methods

### 1. Web Frontend (Recommended)

The easiest way to test the complete payment flow is using the built-in web frontend.

**Steps:**
1. Start the server: `npm run dev`
2. Open http://localhost:3000 in your browser
3. Connect your MetaMask wallet (must be on BSC Mainnet or BSC Testnet)
4. Click "Test Payment & Request" to complete the full flow

**Features:**
- ✅ Visual wallet connection
- ✅ Payment signature creation
- ✅ Full payment flow testing
- ✅ View transaction hashes and AI responses

### 2. Command Line Test Client

Use the TypeScript test client for automated testing.

**Prerequisites:**
- Set `CLIENT_PRIVATE_KEY` in `.env` with a test wallet
- Wallet should have test tokens on the configured network

**Steps:**
```bash
npm test
```

This will:
- Check server health
- Test payment requirement (unpaid request)
- Test full payment flow (if wallet configured)
- Show complete payment details

### 3. Shell Script

Quick health check and basic testing:

```bash
./test-request.sh
```

### 4. Manual cURL Testing

**Test Payment Requirement:**
```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "parts": [{
        "kind": "text",
        "text": "Hello!"
      }]
    }
  }'
```

Expected: 402 Payment Required with b402 payment details

**Test with Payment:**
1. Get payment requirements from the above call
2. Sign the payment using b402 SDK or your wallet
3. Send the signed payment in the `x-payment` header (base64 encoded JSON)

## Testing Checklist

- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] Unpaid request returns 402 with payment details
- [ ] Paid request processes successfully
- [ ] Payment is verified by facilitator
- [ ] Transaction hash is returned
- [ ] AI response is included in result

## Network Configuration

### Testnet (Recommended for Testing)
- **Network**: `testnet` in `.env`
- **Supported Tokens**: USDT
- **Chain ID**: 97
- **Explorer**: https://testnet.bscscan.com

### Mainnet
- **Network**: `mainnet` in `.env`
- **Supported Tokens**: USD1, USDT, USDC
- **Chain ID**: 56
- **Explorer**: https://bscscan.com

## Troubleshooting

### "Payment verification failed"
- Check that wallet is on the correct network (BSC Mainnet or Testnet)
- Ensure wallet has token balance
- Verify facilitator URL is reachable

### "No payment requirements"
- Check that `PAY_TO_ADDRESS` is set in `.env`
- Verify server is running
- Check network configuration matches wallet network

### Wallet connection issues
- Install MetaMask browser extension
- Switch to BSC Mainnet or Testnet
- Ensure wallet is unlocked

### Transaction not found
- Wait a few seconds for transaction to be mined
- Check explorer URL matches the network
- Verify facilitator is operational

## Example Test Flow

1. **Start server**: `npm run dev`
2. **Open frontend**: http://localhost:3000
3. **Connect wallet**: Click "Connect Wallet" (MetaMask will prompt)
4. **Switch network**: If prompted, switch to BSC Testnet
5. **Test payment**: Enter a message and click "Test Payment & Request"
6. **Confirm signing**: MetaMask will prompt to sign the payment
7. **View result**: See transaction hash and AI response

## Advanced Testing

### Test with Different Tokens

Edit `.env`:
```env
TOKEN=USDT  # or USD1, USDC (mainnet only)
PRICE=0.05  # Adjust price
```

### Test Custom Facilitator

Edit `.env`:
```env
FACILITATOR_URL=https://your-custom-facilitator.com
```

### Test Different AI Providers

Edit `.env`:
```env
AI_PROVIDER=eigenai
EIGENAI_API_KEY=your_key_here
```
