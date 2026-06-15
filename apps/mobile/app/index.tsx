import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { Colors, FontFamily, Radius, FontSize } from '../constants/theme';

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
        // credentialFromResult gives the Google-issued JWT (iss: accounts.google.com),
        // which is what jwtToAddress / Sui ZK Login requires.
        // getIdToken() returns a Firebase JWT (wrong issuer — Sui rejects it).
        const googleCredential = GoogleAuthProvider.credentialFromResult(userCredential);
        const idToken = googleCredential?.idToken;
        if (!idToken) throw new Error('No Google ID token from credential');
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
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Lifelong{'\n'}Learning Wallet</Text>

        <View style={styles.divider} />

        <View style={styles.featureRow}>
          <Text style={styles.featureEmoji}>🎓</Text>
          <Text style={styles.featureText}>
            A Sui wallet is automatically created for you.{'\n'}No seed phrase needed.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (!isReady || zkLoading) && styles.buttonDisabled]}
          onPress={signIn}
          disabled={!isReady || zkLoading}
          activeOpacity={0.8}
        >
          {zkLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>
      </View>

      {zkError && <Text style={styles.errorText}>{zkError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 28,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    shadowColor: '#3A332C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    lineHeight: 32,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 28,
  },
  featureEmoji: {
    fontSize: 22,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textSub,
    lineHeight: 22,
  },
  button: {
    backgroundColor: Colors.xp,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemi,
  },
  errorText: {
    color: Colors.streak,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 280,
  },
});
