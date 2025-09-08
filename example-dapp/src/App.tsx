import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import type { Adapter } from '@solana/wallet-adapter-base';
import type { SolanaSignInInput, SolanaSignInOutput } from '@solana/wallet-standard-features';
import { verifySignIn } from '@solana/wallet-standard-util';
import bs58 from 'bs58';
// import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

import { createSignInData, createSignInErrorData } from './utils';

import { TLog } from './types';

import { Logs, Sidebar, AutoConnectProvider } from './components';
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Constants
// =============================================================================

const message = 'To avoid digital dognappers, sign below to authenticate with CryptoCorgis.';

// =============================================================================
// Typedefs
// =============================================================================

export type ConnectedMethods =
  | {
      name: string;
      onClick: () => Promise<string>;
    }
  | {
      name: string;
      onClick: () => Promise<void>;
    }
  | {
      name: string;
      onClick: () => Promise<Uint8Array>;
    };

function toBase64(uint8Arr: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 큰 배열 대비 성능 최적화
  for (let i = 0; i < uint8Arr.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Arr.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function createTransferTransaction(from: string, to: string, amount: number, recentBlockhash: string) {
  const fromPubkey = new PublicKey(from);
  const toPubkey = new PublicKey(to);
  const lamports = Number(amount);

  const transferInstruction = SystemProgram.transfer({ fromPubkey, toPubkey, lamports });

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash,
    instructions: [transferInstruction],
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

const StatelessApp = () => {
  const {
    wallets,
    wallet,
    publicKey,
    connect,
    disconnect,
    signMessage,
    signIn,
    signTransaction,
    signAllTransactions,
    sendTransaction,
  } = useWallet();

  console.log('🚀 ~ StatelessApp ~ wallets:', wallets);

  const [logs, setLogs] = useState<TLog[]>([]);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    if (!publicKey || !wallet) return;

    createLog({
      status: 'success',
      method: 'connect',
      message: `Connected to account ${publicKey.toBase58()}`,
    });
  }, [createLog, publicKey, wallet]);

  /** SignMessage */
  const handleSignMessage = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      const text = bs58.encode(signature);

      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed with signature Hex: ${text}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signMessage, wallet]);

  /** SignIn */
  const handleSignIn = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const signInData = await createSignInData();

    console.log('🚀 ~ StatelessApp ~ signInData:', signInData);

    try {
      const aaaa = await signIn(signInData);

      console.log('🚀 ~ StatelessApp ~ signInData:', signInData);

      const signedMessageText = bs58.encode(aaaa.signedMessage);
      const signatureText = bs58.encode(aaaa.signature);

      createLog({
        status: 'success',
        method: 'signIn',
        message: `Message signed: ${signedMessageText} by ${aaaa.account.address} with signature ${signatureText}`,
      });

      const a = verifySignIn(signInData, {
        ...aaaa,
        account: {
          ...aaaa.account,
          publicKey: new Uint8Array(aaaa.account.publicKey),
        },
      });

      console.log('🚀 ~ StatelessApp ~ a:', a);
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signIn',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signIn, wallet]);

  const handleSignTx = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      const sender = publicKey.toBase58();
      const recipientAddress = '4RE747BaYaWCoGBR4EjbMES41r3Kwsqqhho59WPVgsxG';
      const baseSendAmount = 1000000;

      const connection = new Connection('https://solana-rpc.publicnode.com', 'confirmed');
      const latestBlockHash = await connection.getLatestBlockhash();

      const tx = createTransferTransaction(sender, recipientAddress, Number(baseSendAmount), latestBlockHash.blockhash);

      const signedTx = await signTransaction(tx);

      const aa = signedTx.serialize();

      createLog({
        status: 'success',
        method: 'signTransaction',
        message: `Signed Tx: ${toBase64(aa)}`,
      });

      return aa;
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signTransaction',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signTransaction, wallet]);

  const handleSendTxWithJustSignedTx = useCallback(
    async (serializedTx: Uint8Array) => {
      if (!publicKey || !wallet) return;

      try {
        const connection = new Connection('https://solana-rpc.publicnode.com', 'confirmed');

        const signature = await connection.sendRawTransaction(serializedTx);

        createLog({
          status: 'success',
          method: 'sendTransaction',
          message: `signature: ${signature}`,
        });
      } catch (error) {
        createLog({
          status: 'error',
          method: 'sendTransaction',
          message: error.message,
        });
      }
    },
    [createLog, publicKey, wallet]
  );

  const handleSignAllTx = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      const sender = publicKey.toBase58();
      const recipientAddress = '4RE747BaYaWCoGBR4EjbMES41r3Kwsqqhho59WPVgsxG';
      const baseSendAmount = 1000000;

      const connection = new Connection('https://solana-rpc.publicnode.com', 'confirmed');
      const latestBlockHash = await connection.getLatestBlockhash();

      const tx = createTransferTransaction(sender, recipientAddress, Number(baseSendAmount), latestBlockHash.blockhash);

      const signedTx = await signAllTransactions([tx, tx]);

      const resolvedResponses = signedTx.map((item) => toBase64(item.serialize()));

      for (const element of resolvedResponses) {
        createLog({
          status: 'success',
          method: 'signAllTransaction',
          message: `Signed  Tx: ${element}`,
        });
      }
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signTransaction',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signAllTransactions, wallet]);

  const handleSignAndSendTx = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      const sender = publicKey.toBase58();
      const recipientAddress = '4RE747BaYaWCoGBR4EjbMES41r3Kwsqqhho59WPVgsxG';
      const baseSendAmount = 1000000;

      const connection = new Connection('https://solana-rpc.publicnode.com', 'confirmed');
      const latestBlockHash = await connection.getLatestBlockhash();

      const tx = createTransferTransaction(sender, recipientAddress, Number(baseSendAmount), latestBlockHash.blockhash);

      // NOTE 사인요청 들어가는지 체크
      const signedTx = await sendTransaction(tx, connection);

      createLog({
        status: 'success',
        method: 'sendTransaction',
        message: `signature: ${signedTx}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'sendTransaction',
        message: error.message,
      });
    }
  }, [createLog, publicKey, sendTransaction, wallet]);

  /** SignInError */
  const handleSignInError = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const signInData = await createSignInErrorData();

    try {
      const { account, signedMessage, signature } = await signIn(signInData);
      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signedMessage)} by ${
          account.address
        } with signature ${JSON.stringify(signature)}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signIn',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signIn, wallet]);

  /** Connect */
  const handleConnect = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      await connect();
    } catch (error) {
      createLog({
        status: 'error',
        method: 'connect',
        message: error.message,
      });
    }
  }, [connect, createLog, publicKey, wallet]);

  /** Disconnect */
  const handleDisconnect = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      await disconnect();
      createLog({
        status: 'warning',
        method: 'disconnect',
        message: '👋',
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'disconnect',
        message: error.message,
      });
    }
  }, [createLog, disconnect, publicKey, wallet]);

  // NOTE 이벤트 리스너 테스트 코드 추가 필요.
  useEffect(() => {
    wallet?.adapter?.on('connect', (accounts) => {
      createLog({
        status: 'info',
        method: 'accountChanged',
        message: `${accounts[0]}`,
      });
    });

    wallet?.adapter?.on('disconnect', () => {
      console.log('🚀 ~ disconnect:');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.adapter]);

  const connectedMethods = useMemo(() => {
    return [
      {
        name: 'Sign Message',
        onClick: handleSignMessage,
      },
      {
        name: 'Sign In',
        onClick: handleSignIn,
      },
      {
        name: 'Sign In Error',
        onClick: handleSignInError,
      },
      {
        name: 'Sign Tx',
        onClick: handleSignTx,
      },
      {
        name: 'signTransaction으로 나온걸 직접 브로드',
        onClick: async () => {
          const response = await handleSignTx();
          handleSendTxWithJustSignedTx(response);
        },
      },

      {
        name: 'Sign ALL Tx',
        onClick: handleSignAllTx,
      },
      {
        name: 'Send Tx',
        onClick: handleSignAndSendTx,
      },
      {
        name: 'Disconnect',
        onClick: handleDisconnect,
      },
    ];
  }, [
    handleSignMessage,
    handleSignIn,
    handleSignInError,
    handleSignTx,
    handleSignAllTx,
    handleSignAndSendTx,
    handleDisconnect,
    handleSendTxWithJustSignedTx,
  ]);

  return (
    <StyledApp>
      <Sidebar
        publicKey={publicKey}
        connectedMethods={connectedMethods}
        connect={handleConnect}
        signMessage={handleSignMessage}
      />
      <Logs publicKey={publicKey} logs={logs} clearLogs={clearLogs} />
    </StyledApp>
  );
};

// =============================================================================
// Main Component
// =============================================================================
const App = () => {
  const network = WalletAdapterNetwork.Mainnet;

  const endpoint = `https://api.mainnet-beta.solana.com`;

  const wallets = useMemo(
    () => [], // confirmed also with `() => []` for wallet-standard only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );

  // const autoSignIn = useCallback(async (adapter: Adapter) => {
  //   if (!('signIn' in adapter)) return true;

  //   // Fetch the signInInput from the backend
  //   /*
  //   const createResponse = await fetch("/backend/createSignInData");
  //   const input: SolanaSignInInput = await createResponse.json();
  //   */
  //   const input: SolanaSignInInput = await createSignInData();

  //   // Send the signInInput to the wallet and trigger a sign-in request
  //   const output = await adapter.signIn(input);
  //   const constructPayload = JSON.stringify({ input, output });

  //   // Verify the sign-in output against the generated input server-side
  //   /*
  //   const verifyResponse = await fetch("/backend/verifySIWS", {
  //     method: "POST",
  //     body: strPayload,
  //   });
  //   const success = await verifyResponse.json();
  //   */

  //   /* ------------------------------------ BACKEND ------------------------------------ */
  //   // "/backend/verifySIWS" endpoint, `constructPayload` receieved

  //   const deconstructPayload: { input: SolanaSignInInput; output: SolanaSignInOutput } = JSON.parse(constructPayload);
  //   const backendInput = deconstructPayload.input;

  //   const backendOutput: SolanaSignInOutput = {
  //     account: {
  //       ...output.account,
  //       publicKey: new Uint8Array(output.account.publicKey),
  //     },
  //     signature: new Uint8Array(output.signature),
  //     signedMessage: new Uint8Array(output.signedMessage),
  //   };

  //   if (!verifySignIn(backendInput, backendOutput)) {
  //     console.error('Sign In verification failed!');
  //     throw new Error('Sign In verification failed!');
  //   }

  //   // if (verifySignIn(backendInput, backendOutput)) {
  //   //   console.error('검증성공!');
  //   //   throw new Error('검증성공!!');
  //   // }
  //   /* ------------------------------------ BACKEND ------------------------------------ */

  //   return false;
  // }, []);

  // const autoConnect = useCallback(
  //   async (adapter: Adapter) => {
  //     adapter.autoConnect().catch((e) => {
  //       return autoSignIn(adapter);
  //     });
  //     return false;
  //   },
  //   [autoSignIn]
  // );

  return (
    <AutoConnectProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>
            <StatelessApp />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </AutoConnectProvider>
  );
};

export default App;
