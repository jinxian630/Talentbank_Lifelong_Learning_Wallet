import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { prepareZkLogin, completeZkLogin, deriveAddressOnly, type ZkPrep } from '../lib/zk-login';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [zkPrep, setZkPrep] = useState<ZkPrep | null>(null);
  const [zkLoading, setZkLoading] = useState(false);
  const [zkError, setZkError] = useState<string | null>(null);

  // Prepare ZK nonce before Google OAuth so it's embedded in the JWT
  useEffect(() => {
    prepareZkLogin()
      .then(setZkPrep)
      .catch(console.error);
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    extraParams: zkPrep ? { nonce: zkPrep.nonce } : undefined,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data();
        if (!data?.onboarded) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)/events');
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const { id_token } = response.params;
    if (!id_token) return;

    setZkError(null);
    const credential = GoogleAuthProvider.credential(id_token);
    signInWithCredential(auth, credential)
      .then(async (userCredential) => {
        if (!zkPrep) return;
        setZkLoading(true);
        try {
          const { suiAddress } = await completeZkLogin(
            id_token,
            zkPrep.ephemeralKeypair,
            zkPrep.maxEpoch,
            zkPrep.randomness,
          );
          await setDoc(
            doc(db, 'users', userCredential.user.uid),
            { suiAddress, suiNetwork: 'testnet', zkLoginProvider: 'google' },
            { merge: true },
          );
        } catch (err) {
          setZkError('Could not generate wallet. Please try again.');
          console.error('ZK Login failed:', err);
        } finally {
          setZkLoading(false);
        }
      })
      .catch(console.error);
  }, [response]);

  const signIn = async () => {
    setZkError(null);
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      try {
        setZkLoading(true);
        const userCredential = await signInWithPopup(auth, provider);
        const idToken = await userCredential.user.getIdToken();
        const suiAddress = await deriveAddressOnly(idToken);
        if (suiAddress) {
          await setDoc(
            doc(db, 'users', userCredential.user.uid),
            { suiAddress, suiNetwork: 'testnet', zkLoginProvider: 'google' },
            { merge: true },
          );
        }
      } catch (err) {
        setZkError('Could not generate wallet. Please try again.');
        console.error('Web address derivation failed:', err);
      } finally {
        setZkLoading(false);
      }
    } else {
      await promptAsync();
    }
  };

  const isReady = Platform.OS === 'web' || (!!request && !!zkPrep);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TalentBank</Text>
      <Text style={styles.subtitle}>Your Lifelong Learning Wallet</Text>
      <TouchableOpacity
        style={[styles.button, (!isReady || zkLoading) && styles.buttonDisabled]}
        onPress={signIn}
        disabled={!isReady || zkLoading}
      >
        {zkLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Google</Text>
        )}
      </TouchableOpacity>
      {zkError && <Text style={styles.errorText}>{zkError}</Text>}
      <Text style={styles.footnote}>
        A Sui wallet is automatically created for you.{'\n'}No seed phrase needed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 260,
  },
  footnote: {
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
