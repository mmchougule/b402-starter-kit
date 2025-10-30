// b402 Frontend Test Client
// Uses ethers.js to connect wallet and create payments

// Ensure ethers is available
if (typeof ethers === 'undefined') {
    console.error('ethers.js is not loaded. Please refresh the page.');
    throw new Error('ethers.js is not available');
}

const TOKENS = {
  mainnet: {
    USD1: '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  testnet: {
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  },
};

const RELAYERS = {
  mainnet: '0xE1C2830d5DDd6B49E9c46EbE03a98Cb44CD8eA5a',
  testnet: '0x62150F2c3A29fDA8bCf22c0F22Eb17270FCBb78A',
};

const FACILITATOR_URL = 'https://facilitator.b402.ai';

// Global state
let wallet = null;
let provider = null;
let network = 'testnet'; // Default to testnet for safety

// DOM elements
const connectBtn = document.getElementById('connectBtn');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const walletStatus = document.getElementById('walletStatus');
const testPaymentBtn = document.getElementById('testPaymentBtn');
const testDirectBtn = document.getElementById('testDirectBtn');
const healthBtn = document.getElementById('healthBtn');
const apiUrlInput = document.getElementById('apiUrl');
const messageInput = document.getElementById('messageInput');

// Event listeners
connectBtn.addEventListener('click', connectWallet);
testPaymentBtn.addEventListener('click', testPayment);
testDirectBtn.addEventListener('click', testDirect);
healthBtn.addEventListener('click', checkHealth);

// Connect wallet
async function connectWallet() {
  try {
    if (!window.ethereum) {
      showStatus(walletStatus, 'error', 'Please install MetaMask or another Web3 wallet');
      return;
    }

    showStatus(walletStatus, 'info', 'Connecting wallet...');
    
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const networkDetails = await provider.getNetwork();

    // Determine network
    if (networkDetails.chainId === 56n) {
      network = 'mainnet';
    } else if (networkDetails.chainId === 97n) {
      network = 'testnet';
    } else {
      showStatus(walletStatus, 'error', `Unsupported network (Chain ID: ${networkDetails.chainId}). Please switch to BSC Mainnet (56) or BSC Testnet (97)`);
      return;
    }

    wallet = signer;
    walletAddressConnected = address;
    walletAddress.textContent = `${address.substring(0, 6)}...${address.substring(38)}`;
    walletInfo.classList.remove('hidden');
    testPaymentBtn.disabled = false;
    testDirectBtn.disabled = false;
    
    showStatus(walletStatus, 'success', `Connected to ${network.toUpperCase()} - Chain ID: ${networkDetails.chainId}`);
    connectBtn.textContent = '✓ Wallet Connected';
    connectBtn.style.background = 'rgba(16, 185, 129, 0.2)';
    connectBtn.style.color = '#10B981';
    connectBtn.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    connectBtn.disabled = true;
  } catch (error) {
    showStatus(walletStatus, 'error', `Failed to connect: ${error.message}`);
    console.error('Wallet connection error:', error);
  }
}

// Check server health
async function checkHealth() {
  const apiUrl = apiUrlInput.value || 'http://localhost:3000';
  const statusEl = document.getElementById('healthStatus');
  const responseEl = document.getElementById('healthResponse');
  
  try {
    showStatus(statusEl, 'loading', 'Checking server health...');
    responseEl.classList.add('hidden');
    
    const response = await fetch(`${apiUrl}/health`);
    const data = await response.json();
    
    if (response.ok) {
      showStatus(statusEl, 'success', 'Server is healthy!');
      responseEl.textContent = JSON.stringify(data, null, 2);
      responseEl.classList.remove('hidden');
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    showStatus(statusEl, 'error', `Health check failed: ${error.message}`);
    responseEl.textContent = error.message;
    responseEl.classList.remove('hidden');
  }
}

// Test direct request (no payment)
async function testDirect() {
  const apiUrl = apiUrlInput.value || 'http://localhost:3000';
  const message = messageInput.value || 'Hello';
  const statusEl = document.getElementById('directStatus');
  const responseEl = document.getElementById('directResponse');
  
  try {
    showStatus(statusEl, 'loading', 'Sending request...');
    responseEl.classList.add('hidden');
    
    const response = await fetch(`${apiUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          parts: [
            {
              kind: 'text',
              text: message,
            },
          ],
        },
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 402) {
      showStatus(statusEl, 'info', '✅ Correctly received 402 Payment Required response');
      responseEl.textContent = JSON.stringify(data, null, 2);
      responseEl.classList.remove('hidden');
    } else if (response.ok) {
      showStatus(statusEl, 'success', 'Request processed (payment may have been skipped)');
      responseEl.textContent = JSON.stringify(data, null, 2);
      responseEl.classList.remove('hidden');
    } else {
      throw new Error(data.error || `Server returned ${response.status}`);
    }
  } catch (error) {
    showStatus(statusEl, 'error', `Request failed: ${error.message}`);
    responseEl.textContent = error.message;
    responseEl.classList.remove('hidden');
  }
}

// Test payment flow
async function testPayment() {
  if (!wallet) {
    showStatus(document.getElementById('paymentStatus'), 'error', 'Please connect your wallet first');
    return;
  }
  
  const apiUrl = apiUrlInput.value || 'http://localhost:3000';
  const message = messageInput.value || 'Hello';
  const statusEl = document.getElementById('paymentStatus');
  const responseEl = document.getElementById('paymentResponse');
  
  try {
    showStatus(statusEl, 'loading', 'Step 1: Requesting payment requirements...');
    responseEl.classList.add('hidden');
    
    // Step 1: Get payment requirements
    const initialResponse = await fetch(`${apiUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          parts: [
            {
              kind: 'text',
              text: message,
            },
          ],
        },
      }),
    });
    
    const initialData = await initialResponse.json();
    
    if (initialResponse.status !== 402) {
      throw new Error('Expected 402 Payment Required, got: ' + initialResponse.status);
    }
    
    if (!initialData.x402) {
      throw new Error('No payment requirements in response');
    }
    
    const paymentReq = initialData.x402;
    showStatus(statusEl, 'loading', 'Step 2: Creating payment signature...');
    
    // Step 2: Create payment payload
    const requirements = {
      scheme: 'exact',
      network: paymentReq.network,
      asset: paymentReq.asset,
      payTo: paymentReq.payTo,
      maxAmountRequired: paymentReq.maxAmountRequired,
      maxTimeoutSeconds: paymentReq.maxTimeoutSeconds || 3600,
      relayerContract: paymentReq.relayerContract || RELAYERS[network],
    };
    
    const paymentPayload = await createPaymentPayload(requirements, wallet);
    
    showStatus(statusEl, 'loading', 'Step 3: Submitting payment and request...');
    
    // Step 3: Submit with payment
    const paymentHeader = btoa(JSON.stringify(paymentPayload));
    
    const paidResponse = await fetch(`${apiUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-payment': paymentHeader,
      },
      body: JSON.stringify({
        message: {
          parts: [
            {
              kind: 'text',
              text: message,
            },
          ],
        },
      }),
    });
    
    const paidData = await paidResponse.json();
    
    if (paidResponse.ok) {
      showStatus(statusEl, 'success', '🎉 Payment successful! Request processed.');

      let responseText = '';

      // Extract AI response if available
      if (paidData.task?.status?.message?.parts) {
        const aiResponse = paidData.task.status.message.parts
          .filter(p => p.kind === 'text')
          .map(p => p.text)
          .join(' ');
        responseText += `🤖 AI Response:\n${aiResponse}\n\n`;
      }

      // Add transaction link if available
      if (paidData.payment?.txHash) {
        const explorerUrl = network === 'mainnet'
          ? 'https://bscscan.com'
          : 'https://testnet.bscscan.com';
        const txLink = `${explorerUrl}/tx/${paidData.payment.txHash}`;
        responseText += `💰 Payment Details:\n`;
        responseText += `  Payer: ${paidData.payment.payer}\n`;
        responseText += `  Amount: ${paidData.payment.amount} ${paidData.payment.token}\n`;
        responseText += `  Tx: ${paidData.payment.txHash}\n`;
        responseText += `  Explorer: ${txLink}\n\n`;
      }

      responseText += `📋 Full Response:\n${JSON.stringify(paidData, null, 2)}`;

      responseEl.textContent = responseText;
      responseEl.classList.remove('hidden');
    } else {
      throw new Error(paidData.error || `Payment failed: ${paidResponse.status}`);
    }
  } catch (error) {
    showStatus(statusEl, 'error', `Payment test failed: ${error.message}`);
    responseEl.textContent = error.message;
    responseEl.classList.remove('hidden');
    console.error('Payment test error:', error);
  }
}

// Create payment payload (matches b402 SDK processPayment)
async function createPaymentPayload(requirements, wallet) {
  // Generate timestamps
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + requirements.maxTimeoutSeconds;
  
  // Generate random 32-byte nonce
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = '0x' + Array.from(nonceBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Use cached address instead of calling getAddress() which might trigger ENS resolution
  const walletAddress = walletAddressConnected;
  
  if (!walletAddress) {
    throw new Error('Wallet address not available. Please reconnect your wallet.');
  }
  
  // Create authorization
  const authorization = {
    from: walletAddress,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: 0,
    validBefore,
    nonce,
  };
  
  // EIP-712 domain
  const domain = {
    name: 'B402',
    version: '1',
    chainId: requirements.network === 'bsc' ? 56 : 97,
    verifyingContract: requirements.relayerContract,
  };
  
  // EIP-712 types
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };
  
  // Sign with EIP-712
  const signature = await wallet.signTypedData(domain, types, authorization);
  
  // Return b402-compatible payload
  return {
    x402Version: 1,
    scheme: 'exact',
    network: requirements.network,
    token: requirements.asset,
    payload: {
      authorization,
      signature,
    },
  };
}

// Helper to show status messages
function showStatus(element, type, message) {
  element.className = `status ${type}`;
  element.textContent = message;
  element.classList.remove('hidden');
}
