import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { safeSetDoc } from '../lib/firestore-utils';
import { v4 as uuidv4 } from 'uuid';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  householdId: string | null;
  personalHouseholdId: string | null;
  inviteCode?: string | null;
  creditCardClosingDay?: number;
  salary?: number;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  householdMembers: UserProfile[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeHousehold: (() => void) | undefined;
    let unsubscribeMembers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      setUser(firebaseUser);
      if (firebaseUser) {
        // Listen to user profile changes
        const userRef = doc(db, 'users', firebaseUser.uid);
        let currentHouseholdId: string | null = null;

        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            
            // Auto-create personal household if missing
            if (!userData.personalHouseholdId) {
              const personalId = uuidv4();
              const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              
              try {
                await safeSetDoc(doc(db, 'households', personalId), {
                  id: personalId,
                  inviteCode,
                  members: [firebaseUser.uid],
                  isPersonal: true,
                  ownerId: firebaseUser.uid,
                  createdAt: new Date().toISOString(),
                });
                
                await safeSetDoc(userRef, { 
                  personalHouseholdId: personalId,
                  householdId: userData.householdId || personalId 
                }, { merge: true });
                return; // Snapshot will trigger again
              } catch (err) {
                console.error('Error creating personal household:', err);
              }
            }

            // If householdId changed or we don't have a listener yet
            if (userData.householdId !== currentHouseholdId) {
              if (unsubscribeHousehold) {
                unsubscribeHousehold();
                unsubscribeHousehold = undefined;
              }
              if (unsubscribeMembers) {
                unsubscribeMembers();
                unsubscribeMembers = undefined;
              }
              currentHouseholdId = userData.householdId;

              if (currentHouseholdId) {
                // Listen to household data
                unsubscribeHousehold = onSnapshot(doc(db, 'households', currentHouseholdId), async (hSnap) => {
                  if (hSnap.exists()) {
                    const hData = hSnap.data();
                    let inviteCode = hData.inviteCode;

                    // Auto-repair: Generate inviteCode if missing (legacy data)
                    if (!inviteCode) {
                      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                      try {
                        await safeSetDoc(doc(db, 'households', currentHouseholdId!), { inviteCode }, { merge: true });
                      } catch (err) {
                        console.error('Error auto-repairing invite code:', err);
                      }
                    }

                    setUserProfile({ ...userData, inviteCode });
                  } else {
                    // Household deleted or inaccessible, fallback to personal
                    if (userData.personalHouseholdId && userData.householdId !== userData.personalHouseholdId) {
                      await safeSetDoc(userRef, { householdId: userData.personalHouseholdId }, { merge: true });
                    }
                    setUserProfile(userData);
                  }
                });

                // Listen to household members
                const qMembers = query(collection(db, 'users'), where('householdId', '==', currentHouseholdId));
                unsubscribeMembers = onSnapshot(qMembers, (mSnap) => {
                  const members = mSnap.docs.map(d => d.data() as UserProfile);
                  setHouseholdMembers(members);
                });
              } else {
                setUserProfile(userData);
                setHouseholdMembers([userData]);
              }
            } else if (!currentHouseholdId) {
              setUserProfile(userData);
              setHouseholdMembers([userData]);
            }
          } else {
            // Create user profile if it doesn't exist
            const personalId = uuidv4();
            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              personalHouseholdId: personalId,
              householdId: personalId,
            };

            try {
              // Create household first
              await safeSetDoc(doc(db, 'households', personalId), {
                id: personalId,
                inviteCode,
                members: [firebaseUser.uid],
                isPersonal: true,
                ownerId: firebaseUser.uid,
                createdAt: new Date().toISOString(),
              });
              // Then create profile
              await safeSetDoc(userRef, newProfile);
            } catch (err) {
              console.error('Error initializing user:', err);
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`, firebaseUser);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error('Profile snapshot error:', error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeHousehold) unsubscribeHousehold();
        if (unsubscribeMembers) unsubscribeMembers();
        setUserProfile(null);
        setHouseholdMembers([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeHousehold) unsubscribeHousehold();
      if (unsubscribeMembers) unsubscribeMembers();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
      throw error;
    }
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!user) return;
    const householdsRef = collection(db, 'households');
    const q = query(householdsRef, where('inviteCode', '==', inviteCode.toUpperCase()));
    
    try {
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const householdDoc = querySnapshot.docs[0];
        const householdId = householdDoc.id;
        const data = householdDoc.data();
        
        if (data.members.length < 2) {
          if (data.members.includes(user.uid)) {
            throw new Error('Você já é um membro desta conta.');
          }
          
          await safeSetDoc(doc(db, 'households', householdId), {
            members: [...data.members, user.uid]
          }, { merge: true });
          
          const userRef = doc(db, 'users', user.uid);
          await safeSetDoc(userRef, { householdId }, { merge: true });
        } else {
          throw new Error('Esta conta já atingiu o limite de 2 membros.');
        }
      } else {
        throw new Error('Código de convite inválido.');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('inválido') || error.message.includes('limite') || error.message.includes('membro'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `households/join`);
    }
  };

  const leaveHousehold = async () => {
    if (!user || !userProfile?.householdId || !userProfile.personalHouseholdId) return;
    
    // If already in personal household, do nothing
    if (userProfile.householdId === userProfile.personalHouseholdId) return;

    const currentHouseholdId = userProfile.householdId;
    const householdRef = doc(db, 'households', currentHouseholdId);
    
    try {
      const hSnap = await getDoc(householdRef);
      if (hSnap.exists()) {
        const data = hSnap.data();
        const newMembers = data.members.filter((m: string) => m !== user.uid);
        
        await safeSetDoc(householdRef, { members: newMembers }, { merge: true });
      }
      
      const userRef = doc(db, 'users', user.uid);
      await safeSetDoc(userRef, { householdId: userProfile.personalHouseholdId }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `households/leave`);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await safeSetDoc(userRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, householdMembers, loading, signInWithGoogle, logout, joinHousehold, leaveHousehold, updateProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
